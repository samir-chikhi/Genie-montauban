/* Réservations : contrôle de conflit (site + admin) et envoi automatique
   des documents (facture, convention). Faux classeur en mémoire. */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');

const props = { HELLOASSO_WEBHOOK_SECRET: 'secret-test' };
const cache = {};
const mails = [];

function feuille(lignes) {
  const rows = lignes;
  const cell = (r, c) => ({
    getValue: () => (rows[r - 1] || [])[c - 1] === undefined ? '' : rows[r - 1][c - 1],
    setValue(v) { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; return this; },
    setBackground() { return this; }, setFontColor() { return this; },
  });
  return {
    rows,
    getLastRow: () => rows.length,
    getMaxColumns: () => 40,
    insertColumnsAfter() {},
    appendRow: l => { rows.push(l.slice()); },
    getDataRange: () => ({ getValues: () => rows.map(l => { const o = []; for (let i = 0; i < 31; i++) o.push(l[i] === undefined ? '' : l[i]); return o; }) }),
    getRange: (r, c, nr, nc) => Object.assign(cell(r, c), {
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const l = []; for (let j = 0; j < (nc || 1); j++) l.push(cell(r + i, c + j).getValue()); out.push(l); } return out; },
      setValues: vals => vals.forEach((l, i) => l.forEach((v, j) => cell(r + i, c + j).setValue(v))),
    }),
  };
}
const feuilles = { Reservations: feuille([['id']]) };
const ss = {
  getSheetByName: n => (feuilles[n] = feuilles[n] || feuille([['x']])),
  insertSheet: n => (feuilles[n] = feuille([])),
};

const blob = nom => ({ nom, getAs() { return this; }, setName(n) { this.nom = n; return this; } });
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (k in props ? props[k] : null),
    setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = String(v); }, remove() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (_a, t) => Array.from(crypto.createHash('sha256').update(String(t)).digest()),
    sleep() {}, newBlob: (_c, _t, nom) => blob(nom),
    formatDate: (d, _tz, f) => f.replace('yyyy', d.getFullYear()).replace('MM', String(d.getMonth() + 1).padStart(2, '0')).replace('dd', String(d.getDate()).padStart(2, '0')),
  },
  MailApp: { sendEmail: (...a) => mails.push(a), getRemainingDailyQuota: () => 100 },
  Logger: { log() {} },
  Session: { getScriptTimeZone: () => 'Europe/Paris', getActiveUser: () => ({ getEmail: () => 't@example.com' }) },
  SpreadsheetApp: { openById: () => ss },
  CalendarApp: { getCalendarById: () => null },
  ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: t => ({ setMimeType: () => t }) },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 404, getContentText: () => '' }) },
  ScriptApp: {}, console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'apps-script.gs'), 'utf8'), sandbox);

let ko = 0;
const t = (nom, ok) => { console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'}  ${nom}`); if (!ok) ko++; };
const resa = o => Object.assign({ prenom: 'A', nom: 'B', email: '', espace: 'bourdelle', nomEspace: 'Antoine Bourdelle',
  date: '2030-05-14', typeDuree: 'heure', nbHeures: '3', heureDebut: '19:00', heureFin: '22:00',
  montant: '60', montantBase: '60', statut: 'confirmed' }, o);
const qui = { role: 'responsable', nom: 'Test' };
const R = feuilles.Reservations.rows;

console.log('\n--- Admin : plus de double réservation ---');
let r = sandbox.adminAddResa(resa({ id: 'RSV-1' }), qui);
t('première réservation acceptée', r.success === true);
r = sandbox.adminAddResa(resa({ id: 'RSV-2', heureDebut: '20:00', heureFin: '21:00' }), qui);
t('chevauchement refusé', r.success === false && r.code === 'CRENEAU_OCCUPE');
t("le message nomme l'occupant", /RSV-1/.test(r.error) && /^Créneau déjà pris/.test(r.error));
t('rien n\'a été écrit', R.length === 2);
r = sandbox.adminAddResa(resa({ id: 'RSV-3', heureDebut: '22:00', heureFin: '23:00' }), qui);
t('créneau contigu accepté', r.success === true);
r = sandbox.adminAddResa(resa({ id: 'RSV-4', espace: 'freinet', nomEspace: 'Célestin Freinet' }), qui);
t('autre salle acceptée', r.success === true);
r = sandbox.adminAddResa(resa({ id: 'RSV-5', forcer: true }), qui);
t('« enregistrer quand même » passe', r.success === true);
r = sandbox.adminUpdateResa(resa({ id: 'RSV-4', espace: 'freinet', nomEspace: 'Célestin Freinet', objet: 'modif' }), qui);
t('une réservation ne se bloque pas elle-même', r.success === true);
r = sandbox.adminUpdateResa(resa({ id: 'RSV-4', espace: 'bourdelle' }), qui);
t('déplacement vers un créneau pris refusé', r.success === false && r.code === 'CRENEAU_OCCUPE');
sandbox.adminAddResa(resa({ id: 'RSV-6', date: '2030-05-15', typeDuree: 'journee', heureDebut: '', heureFin: '' }), qui);
r = sandbox.adminAddResa(resa({ id: 'RSV-7', date: '2030-05-15', heureDebut: '15:00', heureFin: '16:00' }), qui);
t('une location « journée » sans heures bloque toute la journée', r.code === 'CRENEAU_OCCUPE');

console.log('\n--- Site : gratuit confirmé d\'office, payant en attente ---');
mails.length = 0;
vm.runInContext("CONFIG.ASSOS_GRATUITES.push('asso@exemple.fr')", sandbox);
r = sandbox.creerReservation({ espace: 'Antoine Bourdelle', date: '2030-06-03', heureDebut: '10:00', duree: 2,
  prenom: 'Lea', nom: 'Martin', email: 'asso@exemple.fr' });
t('réservation gratuite acceptée et confirmée', r.success && r.confirmee === true);
let ligne = R.find(l => l[0] === r.id);
t('statut CONFIRME dans le classeur', ligne[18] === 'CONFIRME');
let doc = mails.find(m => m[0] === 'asso@exemple.fr');
t('convention envoyée, sans facture', doc && doc[3].attachments.length === 1 && /^Convention-/.test(doc[3].attachments[0].nom));
r = sandbox.creerReservation({ espace: 'Antoine Bourdelle', date: '2030-06-03', heureDebut: '11:00', duree: 1,
  prenom: 'Paul', nom: 'Durand', email: 'paul@exemple.fr' });
t('le site refuse un créneau pris', r.error === 'CRENEAU_OCCUPE');

console.log('\n--- Paiement reçu : facture + convention automatiques ---');
r = sandbox.creerReservation({ espace: 'Antoine Bourdelle', date: '2030-06-04', heureDebut: '14:00', duree: 2,
  prenom: 'Paul', nom: 'Durand', email: 'paul@exemple.fr', structure: 'SARL Durand' });
t('réservation payante en attente', r.success && !r.confirmee && r.montant === 90);
const idP = r.id;
mails.length = 0;
const notif = { eventType: 'Payment', data: { state: 'Authorized', amount: 9000, paymentReceiptUrl: 'https://recu' },
  metadata: { resaId: idP, type: 'reservation' } };
r = sandbox.haWebhook(notif, { whsecret: 'secret-test' });
ligne = R.find(l => l[0] === idP);
t('paiement accepté, réservation confirmée', r.ok === true && ligne[18] === 'CONFIRME' && ligne[26] === 'PAYE');
doc = mails.find(m => m[0] === 'paul@exemple.fr');
const an = new Date().getFullYear();
t('numéro de facture attribué', ligne[29] === 'GEN-' + an + '-0001');
t('e-mail avec facture + convention', doc && doc[3].attachments.map(a => a.nom).join() === 'Facture-GEN-' + an + '-0001.pdf,Convention-' + idP + '.pdf');
t('copie cachée au Génie', doc && doc[3].bcc === 'genie.montauban@gmail.com');
t('facture acquittée, au nom de la structure', /acquittée/.test(sandbox.factureHtml(sandbox.resaDepuisLigne(ligne), ligne[29], true)) &&
  /SARL Durand/.test(sandbox.factureHtml(sandbox.resaDepuisLigne(ligne), ligne[29], true)));
const nb = mails.length;
r = sandbox.haWebhook(notif, { whsecret: 'secret-test' });
t('notification rejouée : aucun nouvel e-mail', r.ignore === 'deja traite' && mails.length === nb);
t('le numéro de facture ne change pas', sandbox.numeroFacture(feuilles.Reservations, R.indexOf(ligne) + 1) === 'GEN-' + an + '-0001');

console.log('\n--- Admin : confirmation = documents + lien de paiement ---');
mails.length = 0;
sandbox.adminAddResa(resa({ id: 'RSV-8', date: '2030-07-01', email: 'client@exemple.fr', statut: 'pending' }), qui);
t('en attente : pas de documents', !mails.some(m => m[3] && m[3].attachments));
r = sandbox.adminUpdateResa(resa({ id: 'RSV-8', date: '2030-07-01', email: 'client@exemple.fr' }), qui);
doc = mails.find(m => m[3] && m[3].attachments);
t('confirmation : facture « à régler » + convention', r.success && doc && doc[3].attachments.length === 2 && /à régler/.test(doc[2]));
const lien = (doc[2].match(/reservation\.html\?payer=RSV-8&k=([0-9a-f]+)/) || [])[1];
t('lien de paiement signé, sans adresse e-mail', !!lien && !/client@exemple\.fr/.test(doc[2].split('payer=')[1].split('\n')[0]));
const nb2 = mails.length;
sandbox.adminUpdateResa(resa({ id: 'RSV-8', date: '2030-07-01', email: 'client@exemple.fr', objet: 'note interne' }), qui);
t('modification sans changement de créneau : client non dérangé', mails.length === nb2);
r = sandbox.relancerPaiement({ id: 'RSV-8', cle: 'fausse-cle' });
t('lien de paiement : clé invalide refusée', r.error === 'CHAMPS_MANQUANTS');
r = sandbox.relancerPaiement({ id: 'RSV-8', cle: lien });
t('lien de paiement : clé valide acceptée (HelloAsso non simulé)', r.error === 'PAIEMENT_INDISPONIBLE');

console.log(ko ? `\n${ko} test(s) en échec` : '\nTout est vert.');
process.exit(ko ? 1 : 0);
