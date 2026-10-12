/* Page salon (index-salon.html) : visites anonymes et demandes de rappel.
   Charge apps-script.gs avec un faux classeur en mémoire.
   node tests/salon.test.js */
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');

const feuilles = {}, mails = [], cache = {};
function feuille(nom) {
  const lignes = [];
  const sh = {
    nom, lignes, formules: {},
    appendRow: r => lignes.push(r),
    setFrozenRows() {}, setColumnWidth() {},
    deleteRow: i => lignes.splice(i - 1, 1),
    getDataRange: () => ({ getValues: () => lignes.map(l => l.slice()) }),
    getRange: (a, b) => {
      const cle = typeof a === 'string' ? a : a + ',' + b;
      const rg = {
        setValue: v => { sh.formules[cle] = v; return rg; }, setValues: () => rg,
        setFormula: f => { sh.formules[cle] = f; return rg; },
        setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg,
        setFontSize: () => rg, setNumberFormat: () => rg,
      };
      return rg;
    },
  };
  return sh;
}
const classeur = {
  getSheetByName: n => feuilles[n] || null,
  insertSheet: n => (feuilles[n] = feuille(n)),
};
const sandbox = {
  SpreadsheetApp: { openById: () => classeur },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
  MailApp: { sendEmail: (...a) => mails.push(a), getRemainingDailyQuota: () => 100 },
  Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: {}, computeDigest: () => [], sleep() {}, formatDate: () => '01/01' },
  Logger: { log() {} }, Session: { getActiveUser: () => ({ getEmail: () => '' }) },
  CalendarApp: { getCalendarById: () => null },
  ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: t => ({ setMimeType: () => t }) },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
  console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script.gs'), 'utf8'), sandbox);

let ko = 0;
const t = (nom, c) => { console.log(`  ${c ? 'OK  ' : 'ÉCHEC'}  ${nom}`); if (!c) ko++; };
const post = d => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(d) } }));

console.log('\n--- Visites anonymes ---');
t('une visite est acceptée', post({ action: 'SALON_VISITE', source: 'assos', onglet: 'assos', appareil: 'mobile' }).success);
t('les trois onglets sont créés', !!(feuilles.Salon_Visites && feuilles.Salon_Rappels && feuilles.Salon_Bilan));
const v = feuilles.Salon_Visites.lignes[1];
t('la visite garde le QR, l\'onglet et l\'appareil', v[1] === 'assos' && v[2] === 'assos' && v[3] === 'mobile');
t('la visite ne contient que 4 colonnes (rien d\'identifiant)', v.length === 4);
post({ action: 'SALON_VISITE', source: '<script>' });
t('une source inconnue est classée « direct »', feuilles.Salon_Visites.lignes[2][1] === 'direct');
t('le bilan compte les scans par QR avec une formule', /COUNTIF\(Salon_Visites!B:B/.test(feuilles.Salon_Bilan.formules['5,2']));

console.log('\n--- Demandes de rappel ---');
let r = post({ action: 'SALON_RAPPEL', prenom: 'Léa', consentement: true });
t('refusée sans téléphone ni email', !r.success && r.error === 'CONTACT_MANQUANT');
r = post({ action: 'SALON_RAPPEL', prenom: 'Léa', telephone: '06 12 34 56 78' });
t('refusée sans consentement', !r.success && r.error === 'CONSENTEMENT');
const avant = feuilles.Salon_Rappels.lignes.length;
r = post({ action: 'SALON_RAPPEL', prenom: 'Robot', telephone: '0612345678', consentement: true, site: 'http://spam' });
t('le champ piège répond OK sans rien enregistrer', r.success && feuilles.Salon_Rappels.lignes.length === avant);
mails.length = 0;
r = post({ action: 'SALON_RAPPEL', prenom: 'Léa', telephone: '06 12 34 56 78', email: 'lea@exemple.fr', interet: 'Salles de réunion',
  creneau: 'Le matin', message: '=HYPERLINK("x")', source: 'salles', onglets: 'salles, tarifs', consentement: true });
t('une demande complète est acceptée', r.success);
const l = feuilles.Salon_Rappels.lignes[feuilles.Salon_Rappels.lignes.length - 1];
t('statut « À RAPPELER », téléphone nettoyé, QR noté', l[1] === 'À RAPPELER' && l[3] === '0612345678' && l[8] === 'salles');
t('une formule injectée est neutralisée', l[7].charAt(0) === "'");
t('un email part à l\'équipe, avec le téléphone', mails.some(m => m[0] === 'genie.montauban@gmail.com' && /0612345678/.test(m[2])));
t('un accusé de réception part au visiteur', mails.some(m => m[0] === 'lea@exemple.fr'));
for (let i = 0; i < 6; i++) r = post({ action: 'SALON_RAPPEL', prenom: 'Léa', telephone: '0612345678', consentement: true });
t('les envois répétés du même numéro sont freinés', !r.success && r.error === 'TROP_DE_REQUETES');

console.log('\n--- Conservation 12 mois ---');
const vieux = new Date(); vieux.setMonth(vieux.getMonth() - 13);
feuilles.Salon_Rappels.lignes.splice(1, 0, [vieux, 'RAPPELÉ', 'Ancien', '0600000000']);
post({ action: 'SALON_RAPPEL', prenom: 'Zoé', telephone: '0700000000', consentement: true });
t('une demande de plus de 12 mois est effacée', !feuilles.Salon_Rappels.lignes.some(l => l[2] === 'Ancien'));
t('les demandes récentes restent', feuilles.Salon_Rappels.lignes.some(l => l[2] === 'Zoé'));

console.log(`\n${ko === 0 ? 'TOUS LES TESTS PASSENT' : ko + ' TEST(S) EN ÉCHEC'}`);
process.exit(ko === 0 ? 0 : 1);
