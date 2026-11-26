// ============================================================
// SWITCHBOT — codes d'accès temporaires sur le Keypad Touch
// ============================================================
// Fichier à ajouter tel quel dans le projet Apps Script (bouton « + » →
// Script → nommer « switchbot »). Il utilise logErreur(), envoyerEmailSafe(),
// dateISO(), plageLigne() et CONFIG définis dans apps-script.gs.
//
// Propriétés du script (Paramètres du projet → Propriétés du script) :
//   SWITCHBOT_TOKEN     : le « Jeton » de l'appli SwitchBot (Options développeur)
//   SWITCHBOT_SECRET    : la « Clé secrète » de l'appli SwitchBot
//   SWITCHBOT_KEYPAD_ID : rempli tout seul par testerSwitchBot()
//   SWITCHBOT_ACTIF     : « oui » pour envoyer les codes aux clients. Tant
//                         qu'elle n'existe pas, rien ne change pour eux.
//   (SB_CODES           : géré par le script — codes émis, ne pas modifier)
//
// API officielle : https://github.com/OpenWonderLabs/SwitchBotAPI (v1.1)
// Un code « timeLimit » ne fonctionne qu'entre startTime et endTime
// (horodatages Unix en secondes) puis expire de lui-même.
// ⚠ Le clavier ne reçoit les commandes que s'il est relié au Hub Mini.

var SB_API = 'https://api.switch-bot.com/v1.1';
var SB_MARGE_MIN = 15;          // code actif 15 min avant / après le créneau
var SB_OUVERTURE = 7, SB_FERMETURE = 21;  // résa « journée » sans heures

function sbProps() { return PropertiesService.getScriptProperties(); }
function sbActif() { return sbProps().getProperty('SWITCHBOT_ACTIF') === 'oui'; }

function sbFetch(methode, chemin, corps) {
  var p = sbProps();
  var token = p.getProperty('SWITCHBOT_TOKEN');
  var secret = p.getProperty('SWITCHBOT_SECRET');
  if (!token || !secret) throw new Error('SWITCHBOT_TOKEN / SWITCHBOT_SECRET absents des Propriétés du script');
  var t = String(Date.now());
  var nonce = Utilities.getUuid();
  var signe = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(token + t + nonce, secret, Utilities.Charset.UTF_8));
  var opts = {
    method: methode, muteHttpExceptions: true,
    headers: { Authorization: token, sign: signe, nonce: nonce, t: t },
    contentType: 'application/json; charset=utf8'
  };
  if (corps) opts.payload = JSON.stringify(corps);
  var r = UrlFetchApp.fetch(SB_API + chemin, opts);
  var json = {};
  try { json = JSON.parse(r.getContentText()); } catch (e) {}
  if (r.getResponseCode() !== 200 || json.statusCode !== 100) {
    throw new Error('SwitchBot HTTP ' + r.getResponseCode() + ' / statut ' + json.statusCode +
      ' : ' + (json.message || r.getContentText()).slice(0, 300));
  }
  return json.body;
}

function sbListerClaviers() {
  var b = sbFetch('get', '/devices');
  return (b.deviceList || []).filter(function (d) { return /keypad/i.test(d.deviceType || ''); });
}

function sbKeypadId() {
  var id = sbProps().getProperty('SWITCHBOT_KEYPAD_ID');
  if (id) return id;
  var claviers = sbListerClaviers();
  if (claviers.length !== 1) throw new Error(claviers.length + ' clavier(s) trouvé(s) : lancer testerSwitchBot()');
  sbProps().setProperty('SWITCHBOT_KEYPAD_ID', claviers[0].deviceId);
  return claviers[0].deviceId;
}

function sbCodeAleatoire() {
  // 8 chiffres, sans commencer par 0 et sans suites triviales.
  var c;
  do { c = String(Math.floor(10000000 + Math.random() * 90000000)); }
  while (/(\d)\1\1/.test(c) || '0123456789'.indexOf(c.slice(0, 4)) >= 0);
  return c;
}

// Crée sur le clavier un code valable de (debut - 15 min) à (fin + 15 min).
// Renvoie { code, nom } ou null si échec (l'admin est alors prévenu).
// type : 'timeLimit' (valable pendant la plage) ou 'disposable' (un seul
// passage dans la plage).
function sbCreerCode(reference, debut, fin, type) {
  try {
    var code = sbCodeAleatoire();
    var nom = 'G' + String(reference).replace(/[^A-Za-z0-9]/g, '').slice(-10) +
              '-' + Math.floor(Math.random() * 1000);
    var de = Math.floor((debut.getTime() - SB_MARGE_MIN * 60000) / 1000);
    var a = Math.floor((fin.getTime() + SB_MARGE_MIN * 60000) / 1000);
    sbFetch('post', '/devices/' + sbKeypadId() + '/commands', {
      commandType: 'command', command: 'createKey',
      parameter: { name: nom, type: type || 'timeLimit', password: code, startTime: de, endTime: a }
    });
    return { code: code, nom: nom };
  } catch (err) {
    logErreur('sbCreerCode ' + reference, err);
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '⚠️ Code porte non créé — ' + reference,
      'Le code SwitchBot de la réservation ' + reference + ' n\'a pas pu être créé.\n' +
      'Erreur : ' + err.message + '\n\nLe client n\'a PAS reçu de code. Vérifier que le Hub Mini ' +
      'est branché et en ligne, puis lui envoyer un code créé à la main dans l\'appli SwitchBot.');
    return null;
  }
}

// Supprime un code par son nom. L'API SwitchBot ne le supprime pas
// toujours : sans gravité, le code expire de toute façon.
function sbSupprimerCode(nom) {
  try {
    var kid = sbKeypadId();
    var clavier = sbListerClaviers().filter(function (d) { return d.deviceId === kid; })[0];
    var cle = clavier && (clavier.keyList || []).filter(function (k) { return k.name === nom; })[0];
    if (!cle) return false;
    sbFetch('post', '/devices/' + kid + '/commands',
      { commandType: 'command', command: 'deleteKey', parameter: { id: cle.id } });
    return true;
  } catch (err) { logErreur('sbSupprimerCode ' + nom, err); return false; }
}

// ── Registre des codes émis (Propriétés du script, pas le classeur) ──
function sbLireCodes() {
  try { return JSON.parse(sbProps().getProperty('SB_CODES') || '{}'); } catch (e) { return {}; }
}
function sbEcrireCodes(codes) {
  var limite = Date.now() - 86400000;
  Object.keys(codes).forEach(function (id) { if (codes[id].f < limite) delete codes[id]; });
  // Une propriété est limitée à 9 Ko : au-delà, on oublie les entrées qui
  // finissent le plus tôt (le code reste valable sur le clavier, on perd
  // seulement la possibilité de le retirer à l'annulation).
  var cles = Object.keys(codes).sort(function (a, b) { return codes[a].f - codes[b].f; });
  while (JSON.stringify(codes).length > 8500 && cles.length) delete codes[cles.shift()];
  sbProps().setProperty('SB_CODES', JSON.stringify(codes));
}

// Fenêtre d'accès d'une ligne Reservations → [Date début, Date fin] ou null.
// semaine / mois : un seul code du 1er jour à l'ouverture au dernier jour
// à la fermeture.
function sbFenetre(row) {
  var date = dateISO(row[10]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  var type = String(row[11] || 'heure');
  var p = plageLigne(type, row[13], row[14]);
  var deb = p[0], fin = p[1];
  if (deb === 0 && fin === 1440) { deb = SB_OUVERTURE * 60; fin = SB_FERMETURE * 60; }
  var y = +date.slice(0, 4), m = +date.slice(5, 7) - 1, d = +date.slice(8, 10);
  var nbJours = type === 'semaine' ? 7
    : type === 'mois' ? Math.round((new Date(y, m + 1, d) - new Date(y, m, d)) / 86400000) : 1;
  return [new Date(y, m, d, 0, deb), new Date(y, m, d + nbJours - 1, 0, fin)];
}

// Code personnel d'une réservation (ligne brute de l'onglet Reservations).
// Idempotent : renvoie le code déjà émis si le créneau n'a pas changé,
// sinon en crée un nouveau. null si SWITCHBOT_ACTIF n'est pas « oui » ou
// en cas d'échec.
function sbCodePourLigne(row) {
  if (!sbActif()) return null;
  var id = String(row[0] || '');
  var fen = sbFenetre(row);
  if (!id || !fen || fen[1].getTime() < Date.now()) return null;
  var sig = fen[0].getTime() + '-' + fen[1].getTime();
  var codes = sbLireCodes();
  var e = codes[id];
  if (e && e.s === sig) return e.c;
  if (e) sbSupprimerCode(e.n);            // créneau modifié : l'ancien code saute
  var cree = sbCreerCode(id, fen[0], fen[1]);
  if (!cree) return null;
  codes[id] = { c: cree.code, n: cree.nom, s: sig, f: fen[1].getTime() };
  sbEcrireCodes(codes);
  return cree.code;
}

// Code valable N jours à partir de maintenant (carnet L'Escale : 182 j ;
// achat sans créneau : 7 j). null si inactif ou en échec (admin alerté).
function sbCodeDuree(reference, jours) {
  if (!sbActif()) return null;
  var debut = new Date(Date.now() + SB_MARGE_MIN * 60000);          // actif tout de suite
  var fin = new Date(Date.now() + jours * 86400000);
  var cree = sbCreerCode(reference, debut, fin);
  if (!cree) return null;
  var codes = sbLireCodes();
  codes[String(reference)] = { c: cree.code, n: cree.nom, s: 'duree', f: fin.getTime() };
  sbEcrireCodes(codes);
  return { code: cree.code, fin: fin };
}

// Bloc « ACCÈS » à insérer dans l'e-mail de confirmation ('' si rien à dire).
function sbTexteAcces(row) {
  var code = sbCodePourLigne(row);
  if (!code) return '';
  var rue = sbProps().getProperty('ESCALE_CODE_PORTE_RUE');
  return '\n🔑 ACCÈS :\n'
    + (rue ? '   – Porte de rue     : ' + rue + '\n' : '')
    + '   – Porte intérieure : ' + code + ' puis ✓\n'
    + '   Code personnel, actif ' + SB_MARGE_MIN + ' min avant votre créneau et jusqu\'à '
    + SB_MARGE_MIN + ' min après. Merci de ne pas le communiquer.\n';
}

// Annulation : retire le code du clavier et du registre.
function sbAnnulerCodeResa(id) {
  var codes = sbLireCodes();
  var e = codes[String(id)];
  if (!e) return;
  sbSupprimerCode(e.n);
  delete codes[String(id)];
  sbEcrireCodes(codes);
}

// ── CODE VISITEUR (admin → « Code porte pour un visiteur ») ───
// Réunion d'association, rendez-vous, intervenant… sans réservation en
// ligne. data : { nom, date 'yyyy-MM-dd', heureDebut 'HH:MM', heureFin,
// unique (bool : un seul passage), email (facultatif) }.
function adminCodeVisiteur(data, qui) {
  var nom = String(data.nom || '').trim().slice(0, 60);
  var date = String(data.date || '');
  var hd = hMin(data.heureDebut, -1), hf = hMin(data.heureFin, -1);
  if (!nom || !/^\d{4}-\d{2}-\d{2}$/.test(date) || hd < 0 || hf <= hd)
    return { success: false, error: 'Indiquez un nom, une date et un horaire valides.' };
  var y = +date.slice(0, 4), m = +date.slice(5, 7) - 1, d = +date.slice(8, 10);
  var debut = new Date(y, m, d, 0, hd), fin = new Date(y, m, d, 0, hf);
  if (fin.getTime() < Date.now()) return { success: false, error: 'Ce créneau est déjà passé.' };
  var id = 'VIS-' + Date.now();
  var cree = sbCreerCode(id, debut, fin, data.unique ? 'disposable' : 'timeLimit');
  if (!cree) return { success: false, error: 'Code non créé (Hub hors ligne ?). Un e-mail d\'alerte est parti.' };
  var plage = String(data.heureDebut).slice(0, 5) + ' → ' + String(data.heureFin).slice(0, 5);
  var codes = sbLireCodes();
  codes[id] = { c: cree.code, n: cree.nom, s: 'visiteur', f: fin.getTime(),
                v: { nom: nom, date: date, plage: plage, deb: hd, unique: !!data.unique } };
  sbEcrireCodes(codes);
  var message = 'Bonjour, voici votre accès au Génie (' + CONFIG.ADRESSE + ') le ' + formaterDate(date) +
    ' de ' + plage + ' :\n• Porte de rue : ' + (sbProps().getProperty('ESCALE_CODE_PORTE_RUE') || '—') +
    '\n• Porte intérieure : ' + cree.code + ' puis ✓' +
    (data.unique ? ' (un seul passage)' : ' (actif 15 min avant et jusqu\'à 15 min après)') +
    '\nMerci de ne pas le diffuser. Une question : ' + CONFIG.TEL;
  var email = String(data.email || '').trim();
  var envoye = false;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    envoye = envoyerEmailSafe(email, '🔑 Votre accès au Génie — ' + formaterDate(date), message + '\n\n' + CONFIG.NOM_LIEU,
      { name: CONFIG.NOM_LIEU });
  journaliser(qui, 'Code visiteur', id, nom + ' · ' + date + ' ' + plage + (data.unique ? ' · 1 passage' : '') + (envoye ? ' · e-mail envoyé' : ''));
  return { success: true, id: id, code: cree.code, message: message, emailEnvoye: envoye };
}

// Récap « qui occupe quoi » d'une date, en texte court pour le groupe
// WhatsApp des locataires. Discret : organisation ou « Prénom N. »,
// coworkers de L'Escale seulement comptés.
function sbTexteOccupation(dateStr, rows) {
  var lignes = [], escale = 0;
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[18]) !== 'CONFIRME' || dateISO(row[10]) !== dateStr) continue;
    var idR = String(row[0]);
    if (/^(ESC|STRIPE)-/.test(idR)) { escale++; continue; }
    var r = resaDepuisLigne(row);
    var p = plageLigne(row[11], row[13], row[14]);
    var qui = r.orga || ((r.prenom + ' ' + (r.nom ? r.nom.charAt(0) + '.' : '')).trim());
    lignes.push([p[0], '• ' + horaireLisible(r) + ' · ' + r.espace + ' · ' + qui]);
  }
  var codes = sbLireCodes();
  Object.keys(codes).forEach(function (k) {
    var v = codes[k].v;
    if (v && v.date === dateStr) lignes.push([v.deb, '• ' + v.plage + ' · ' + v.nom + ' (visiteurs)']);
  });
  lignes.sort(function (a, b) { return a[0] - b[0]; });
  if (!lignes.length && !escale) return '';
  return '📅 Génie — occupation du ' + formaterDate(dateStr) + '\n'
    + lignes.map(function (l) { return l[1]; }).join('\n')
    + (escale ? '\n• L\'Escale (coworking) : ' + escale + ' place(s) réservée(s)' : '')
    + '\nBonne journée à tous !';
}

// ── RAPPEL DE LA VEILLE (déclencheur quotidien à 17h) ─────────
// Chaque client confirmé pour demain reçoit : créneau, code d'accès (si
// réglé ou gratuit), règles de la maison. L'admin reçoit la liste des
// arrivées du lendemain. Le code est créé ici s'il n'existait pas encore
// (réservations confirmées avant la mise en service).
// Installation : exécuter une fois installerRappelVeille() dans l'éditeur.
function installerRappelVeille() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rappelsVeille') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rappelsVeille').timeBased().everyDays(1).atHour(17).create();
  Logger.log('OK — rappel de la veille programmé chaque jour vers 17h.');
}

function rappelsVeille(opts) {
  opts = opts || {};
  var tz = Session.getScriptTimeZone();
  var demain = Utilities.formatDate(new Date(Date.now() + 86400000), tz, 'yyyy-MM-dd');
  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Reservations');
  var rows = sheet.getDataRange().getValues();
  var envoyes = {};
  try { envoyes = JSON.parse(sbProps().getProperty('RAPPELS_ENVOYES') || '{}'); } catch (e) {}
  var arrivees = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[18]) !== 'CONFIRME' || dateISO(row[10]) !== demain) continue;
    var r = resaDepuisLigne(row);
    var aRegler = r.montant > 0 && r.payState !== 'PAYE';
    arrivees.push('• ' + horaireLisible(r) + ' — ' + r.espace + ' — ' + (r.prenom + ' ' + r.nom).trim() +
      (r.orga ? ' (' + r.orga + ')' : '') + (aRegler ? ' — ⚠️ pas encore réglé' : ''));
    if (envoyes[r.id] || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) continue;
    // Toute réservation confirmée reçoit son code (au plus tard ici, la veille).
    var acces = '';
    try { acces = sbTexteAcces(row); } catch (eSb) { logErreur('rappelsVeille/switchbot ' + r.id, eSb); }
    var corps = 'Bonjour ' + (r.prenom || r.nom) + ',\n\n'
      + 'Petit rappel : nous vous attendons demain au Génie.\n\n'
      + '• Espace    : ' + r.espace + '\n'
      + '• Date      : ' + formaterDate(r.date) + '\n'
      + '• Horaire   : ' + horaireLisible(r) + '\n'
      + '• Référence : ' + r.id + '\n'
      + (aRegler ? '\n💳 Votre réservation n\'est pas encore réglée : ' + (lienPaiement(r.id) || 'merci de nous contacter') + '\n' : '')
      + acces
      + '\nPour que chacun travaille dans de bonnes conditions :\n'
      + '  – c\'est un lieu de travail partagé : calme et respect des autres ;\n'
      + '  – seules les personnes prévues dans la réservation entrent (visiteurs à déclarer avant) ;\n'
      + '  – respectez les consignes de sécurité et la jauge, ne bloquez pas les issues ;\n'
      + '  – laissez l\'espace rangé et refermez derrière vous.\n'
      + 'Règlement intérieur : ' + CONFIG.URL_SITE + '/reglement-interieur-genie.html\n'
      + '\nUn empêchement ou un souci sur place ? ' + CONFIG.TEL + ' · ' + CONFIG.EMAIL_CONTACT
      + '\n\nÀ demain !\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE;
    if (opts.simulation) { Logger.log('— SIMULATION, non envoyé à ' + r.email + ' —\n' + corps); continue; }
    if (envoyerEmailSafe(r.email, '⏰ Demain au Génie — ' + r.espace + ', ' + horaireLisible(r), corps,
        { name: CONFIG.NOM_LIEU })) envoyes[r.id] = demain;
  }
  if (!opts.simulation) {
    var limite = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), tz, 'yyyy-MM-dd');
    Object.keys(envoyes).forEach(function (id) { if (envoyes[id] < limite) delete envoyes[id]; });
    sbProps().setProperty('RAPPELS_ENVOYES', JSON.stringify(envoyes));
  }
  if (!opts.simulation && typeof rappelsAssurance === 'function') rappelsAssurance();
  var groupe = sbTexteOccupation(demain, rows);
  var recap = 'Arrivées du ' + formaterDate(demain) + ' (les clients ont reçu leur rappel) :\n\n'
    + (arrivees.join('\n') || '(aucune réservation en ligne)')
    + (groupe ? '\n\n────────\n📲 Pour le groupe WhatsApp des locataires — touchez ce lien depuis '
       + 'votre téléphone, choisissez le groupe, envoyez :\nhttps://wa.me/?text=' + encodeURIComponent(groupe)
       + (sbProps().getProperty('WHATSAPP_GROUPE') ? '\n(Groupe des locataires : ' + sbProps().getProperty('WHATSAPP_GROUPE') + ')' : '')
       + '\n\nTexte (à copier si besoin) :\n' + groupe : '');
  if (opts.simulation) Logger.log('— E-MAIL ADMIN (simulation) —\n' + recap);
  else if (groupe) envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '📅 Demain au Génie : ' + arrivees.length + ' réservation(s)', recap);
  return arrivees.length;
}

// Test du code visiteur (crée puis retire un code « un seul passage »).
function testerCodeVisiteur() {
  var tz = Session.getScriptTimeZone(), t = new Date(Date.now() + 20 * 60000), t2 = new Date(Date.now() + 50 * 60000);
  var r = adminCodeVisiteur({ nom: 'TEST code visiteur', date: Utilities.formatDate(t, tz, 'yyyy-MM-dd'),
    heureDebut: Utilities.formatDate(t, tz, 'HH:mm'), heureFin: Utilities.formatDate(t2, tz, 'HH:mm'), unique: true },
    { nom: 'Test éditeur', role: 'responsable' });
  Logger.log(JSON.stringify(r));
  if (r.success) { var c = sbLireCodes(); sbSupprimerCode(c[r.id].n); delete c[r.id]; sbEcrireCodes(c); Logger.log('Code de test retiré.'); }
}

// Aperçu sans rien envoyer (affiche les e-mails de demain dans le journal).
// ⚠ Crée tout de même les codes manquants si SWITCHBOT_ACTIF = oui.
function testerRappelVeille() {
  Logger.log(rappelsVeille({ simulation: true }) + ' réservation(s) demain.');
}

// ── TESTS À LANCER DEPUIS L'ÉDITEUR ──────────────────────────
// 1) testerSwitchBot : vérifie les clés, trouve le clavier, l'enregistre.
function testerSwitchBot() {
  var claviers = sbListerClaviers();
  if (!claviers.length) { Logger.log('ÉCHEC — aucun clavier vu. Le Keypad Touch est-il relié au Hub Mini dans l\'appli ?'); return; }
  claviers.forEach(function (d) {
    Logger.log('Clavier : ' + d.deviceName + ' (' + d.deviceType + ') id=' + d.deviceId +
      ' — ' + (d.keyList || []).length + ' code(s) enregistrés' +
      (d.hubDeviceId ? ' — relié au hub ' + d.hubDeviceId : ' — ⚠ PAS relié à un hub'));
  });
  if (claviers.length === 1) {
    sbProps().setProperty('SWITCHBOT_KEYPAD_ID', claviers[0].deviceId);
    Logger.log('OK — clavier enregistré. Étape suivante : testerCodeSwitchBot().');
  } else {
    Logger.log('Plusieurs claviers : copier le bon id dans la propriété SWITCHBOT_KEYPAD_ID.');
  }
}

// 3) testerAccesReservation : chaîne complète sur une fausse réservation
//    (demain 9h-10h) — crée le code, affiche le bloc e-mail, puis l'annule.
function testerAccesReservation() {
  if (!sbActif()) { Logger.log('SWITCHBOT_ACTIF n\'est pas « oui » : rien ne serait envoyé aux clients.'); return; }
  var demain = new Date(Date.now() + 86400000);
  var row = []; row[0] = 'TEST-' + Date.now(); row[10] = dateISO(demain);
  row[11] = 'heure'; row[13] = '09:00'; row[14] = '10:00';
  var texte = sbTexteAcces(row);
  Logger.log(texte ? 'OK — bloc e-mail :' + texte : 'ÉCHEC — aucun code (voir Logs / e-mail d\'alerte).');
  Logger.log('Même code au 2e appel (idempotent) : ' + (sbCodePourLigne(row) === sbLireCodes()[row[0]].c));
  sbAnnulerCodeResa(row[0]);
  Logger.log('Code de test annulé (l\'API SwitchBot peut le laisser affiché jusqu\'à expiration).');
}

// 2) testerCodeSwitchBot : crée un code valable ~30 min à partir de maintenant.
function testerCodeSwitchBot() {
  var maintenant = new Date();
  var cree = sbCreerCode('TEST', new Date(maintenant.getTime() + SB_MARGE_MIN * 60000),
                         new Date(maintenant.getTime() + 15 * 60000));
  Logger.log(cree ? 'Commande acceptée — code de test : ' + cree.code + ' (nom ' + cree.nom +
                    '). Il doit apparaître dans l\'appli SwitchBot sous 1 min ; sinon le Hub ne relaie pas.'
                  : 'ÉCHEC — voir l\'onglet Logs et l\'e-mail d\'alerte.');
}
