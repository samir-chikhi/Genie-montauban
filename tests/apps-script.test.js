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

console.log(`\n${ko === 0 ? 'TOUS LES TESTS PASSENT' : ko + ' TEST(S) EN ÉCHEC'}`);
process.exit(ko === 0 ? 0 : 1);
