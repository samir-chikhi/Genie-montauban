/* Exécute apps-script.gs dans un faux environnement Apps Script
   pour vérifier réellement les sessions client et le verrou du webhook. */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');

const props = {};
const cache = {};
const mails = [];
const journal = [];

const sandbox = {
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: k => { delete props[k]; },
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = String(v); },
    }),
  },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (_a, txt) => Array.from(crypto.createHash('sha256').update(String(txt)).digest()),
    sleep: () => {},
  },
  MailApp: { sendEmail: (...a) => mails.push(a), getRemainingDailyQuota: () => 100 },
  Logger: { log: m => journal.push(String(m)) },
  Session: { getActiveUser: () => ({ getEmail: () => 'test@example.com' }) },
  SpreadsheetApp: { openById: () => { throw new Error('feuille non simulée'); } },
  CalendarApp: { getCalendarById: () => null },
  ContentService: {
    MimeType: { JSON: 'JSON' },
    createTextOutput: t => ({ setMimeType: () => t }),
  },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) },
  ScriptApp: { newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() {} }) }) }) },
  console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('/home/user/Genie-montauban/apps-script.gs', 'utf8'), sandbox);

let ko = 0;
const t = (nom, condition) => {
  console.log(`  ${condition ? 'OK  ' : 'ÉCHEC'}  ${nom}`);
  if (!condition) ko++;
};

console.log('\n--- Sessions client ---');
const jeton = sandbox.creerSessionClient('Marie@Exemple.FR');
t('un jeton est délivré', typeof jeton === 'string' && jeton.length > 20);
t("le jeton résout l'email (normalisé en minuscules)",
  sandbox.emailDeSession(jeton) === 'marie@exemple.fr');
t('un jeton inconnu ne résout rien', sandbox.emailDeSession('n-importe-quoi') === null);
t('un jeton absent ne résout rien', sandbox.emailDeSession(null) === null);

let d = { clientToken: jeton, email: 'victime@autre.fr' };
t('accès accordé avec un jeton valide', sandbox.requireClient(d) === null);
t("l'email demandé est écrasé par celui de la session (pas d'usurpation)",
  d.email === 'marie@exemple.fr');

d = { email: 'victime@autre.fr' };                       // sans jeton
let r = sandbox.requireClient(d);
t('accès refusé sans jeton', r && r.error === 'NON_AUTORISE');

const sessions = JSON.parse(props.CLIENT_SESSIONS);
sessions[jeton].exp = Date.now() - 1000;                 // expiration forcée
props.CLIENT_SESSIONS = JSON.stringify(sessions);
t('accès refusé avec un jeton expiré', sandbox.emailDeSession(jeton) === null);

const j2 = sandbox.creerSessionClient('paul@exemple.fr');
t('la session expirée est purgée à la création suivante',
  !(jeton in JSON.parse(props.CLIENT_SESSIONS)));
t('la nouvelle session est bien enregistrée', sandbox.emailDeSession(j2) === 'paul@exemple.fr');

console.log('\n--- Verrou du webhook de paiement ---');
const notif = { eventType: 'Payment', data: { state: 'Authorized', amount: 5000 },
                metadata: { resaId: 'RES-1', type: 'reservation' } };

delete props.HELLOASSO_WEBHOOK_SECRET;
r = sandbox.haWebhook(notif, { whsecret: 'peu importe' });
t('refusé tant que le secret n\'est pas configuré', r.error === 'WEBHOOK_NON_CONFIGURE');

props.HELLOASSO_WEBHOOK_SECRET = 'secret-attendu';
r = sandbox.haWebhook(notif, {});
t('refusé sans secret dans l\'URL', r.error === 'NON_AUTORISE');
r = sandbox.haWebhook(notif, { whsecret: 'mauvais' });
t('refusé avec un mauvais secret', r.error === 'NON_AUTORISE');
r = sandbox.haWebhook(notif, { whsecret: 'secret-attendu' });
t('accepté avec le bon secret (échoue ensuite sur la feuille, ce qui est attendu)',
  r.error !== 'NON_AUTORISE' && r.error !== 'WEBHOOK_NON_CONFIGURE');

console.log('\n--- Limitation du lien magique ---');
let refus = 0;
for (let i = 0; i < 12; i++) {
  const res = sandbox.demanderLienMagique({ email: 'spam@exemple.fr' });
  if (res && res.error === 'TROP_DE_DEMANDES') refus++;
}
t('les demandes répétées finissent par être refusées', refus > 0);

console.log('\n--- Mot de passe admin ---');
t('un hash salé diffère du SHA-256 nu du mot de passe',
  sandbox.hashMotDePasseAdmin('secret', 'sel') !== sandbox.hashSha256('secret'));
t('le même sel redonne le même hash',
  sandbox.hashMotDePasseAdmin('secret', 'sel') === sandbox.hashMotDePasseAdmin('secret', 'sel'));
t('deux sels différents donnent deux hashs différents',
  sandbox.hashMotDePasseAdmin('secret', 'sel-a') !== sandbox.hashMotDePasseAdmin('secret', 'sel-b'));
t('la comparaison constante distingue bien deux valeurs',
  sandbox.comparaisonConstante('abc', 'abc') && !sandbox.comparaisonConstante('abc', 'abd')
  && !sandbox.comparaisonConstante('abc', 'ab'));

const mdpTest = sandbox.genererMotDePasseAdmin();
t('le mot de passe généré fait 20 caractères', mdpTest.length === 20);
props.ADMIN_PASSWORD_SALT = 'sel-de-test';
props.ADMIN_PASSWORD_HASH = sandbox.hashMotDePasseAdmin(mdpTest, 'sel-de-test');
delete cache['rl_adminlogin'];
r = sandbox.adminLogin({ password: mdpTest });
t('connexion admin acceptée avec le bon mot de passe (sans toucher au classeur)',
  r.success === true && typeof r.token === 'string');
delete cache['rl_adminlogin'];
r = sandbox.adminLogin({ password: 'mauvais' });
t('connexion admin refusée avec un mauvais mot de passe', r.success === false);
t('le hash admin ne descend plus dans le classeur',
  !/getSheetByName\('Config'\)[\s\S]{0,400}ADMIN_PASSWORD_HASH',\s*hash/.test(
    fs.readFileSync('/home/user/Genie-montauban/apps-script.gs', 'utf8')));

for (let i = 0; i < 10; i++) sandbox.adminLogin({ password: 'x' });
r = sandbox.adminLogin({ password: mdpTest });
t('les tentatives répétées sont bloquées même avec le bon mot de passe',
  r.error === 'TROP_DE_REQUETES');

console.log('\n--- Avis publics (GET_AVIS) ---');
const lignesAvis = [
  ['Horodatage','Note','Services','Ce qui a plu','À améliorer','Recommande','Prénom','Consentement','Approuvé'],
  ['2026-01-01', 5, 'Coworking', 'Lieu chaleureux', 'RIEN-INTERNE', 'Oui', 'Marie Dupont', 'Oui', 'Oui'],
  ['2026-01-02', 5, 'Salle',     'Très bien',      'RIEN-INTERNE', 'Oui', 'Paul',         'Oui', 'Non'],
  ['2026-01-03', 2, 'Salle',     'Bof',            'RIEN-INTERNE', 'Non', 'Jean',         'Oui', 'Oui'],
];
const ancienSS = sandbox.SpreadsheetApp.openById;
sandbox.SpreadsheetApp.openById = () => ({
  getSheetByName: nom => nom === 'Avis_Qualite'
    ? { getDataRange: () => ({ getValues: () => lignesAvis }) } : null,
});
delete cache['avis_publics'];
const avis = sandbox.getAvis();
t('seul l\'avis approuvé et bien noté est renvoyé',
  avis.success === true && avis.avis.length === 1);
t('le nom de famille n\'est pas publié', avis.avis[0].prenom === 'Marie');
t('la colonne interne « à améliorer » n\'est jamais renvoyée',
  JSON.stringify(avis.avis).indexOf('RIEN-INTERNE') === -1);
t('aucun horodatage ni consentement dans la réponse',
  JSON.stringify(avis.avis).indexOf('2026-01-01') === -1);
sandbox.SpreadsheetApp.openById = ancienSS;

console.log('\n--- Liens magiques ---');
t('le jeton est stocké haché, jamais en clair',
  /appendRow\(\[hashSha256\(token\)/.test(
    fs.readFileSync('/home/user/Genie-montauban/apps-script.gs', 'utf8')));

console.log('\n--- Le classeur n\'est plus lu depuis le navigateur ---');
const accueil = fs.readFileSync('/home/user/Genie-montauban/index.html', 'utf8');
t('la page d\'accueil ne contient plus l\'identifiant du classeur',
  accueil.indexOf('1mf3D2YGnpWpzufGOaLLaomxAkuzp0AiJY7RzcbpIq2w') === -1);
t('la page d\'accueil ne construit plus d\'URL vers un classeur',
  accueil.indexOf('docs.google.com/spreadsheets') === -1);
t('docs.google.com est retiré de la CSP de la page d\'accueil',
  accueil.split('\n')[5].indexOf('docs.google.com') === -1);
const pageAdmin = fs.readFileSync('/home/user/Genie-montauban/admin.html', 'utf8');
t('admin.html ne contient plus l\'identifiant du classeur',
  pageAdmin.indexOf('1mf3D2YGnpWpzufGOaLLaomxAkuzp0AiJY7RzcbpIq2w') === -1);
t('le mot de passe admin ne part plus dans l\'URL en temps normal',
  /method: 'POST'/.test(pageAdmin));
const conf = fs.readFileSync('/home/user/Genie-montauban/.mcp.json', 'utf8');
t('aucune clé API en clair dans .mcp.json', conf.indexOf('21st_sk_') === -1);

console.log(`\n${ko === 0 ? 'TOUS LES TESTS PASSENT' : ko + ' TEST(S) EN ÉCHEC'}`);
process.exit(ko === 0 ? 0 : 1);
