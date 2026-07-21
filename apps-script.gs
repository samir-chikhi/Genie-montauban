// ============================================================
// GÉNIE MONTAUBAN — Google Apps Script Unifié v5.0
// Durcissement v5.0 vs v4.3 :
//   1. AUTH ADMIN : toutes les actions admin (getAll, addResa,
//      updateResa, deleteResa, saveConfig, ADMIN_UPDATE_STATUS,
//      getCalendar, syncFromCal) exigent un token de session délivré
//      par ADMIN_LOGIN et vérifié côté serveur. Sessions 8h.
//   2. ANTI DOUBLE-RÉSERVATION : creerReservation vérifie les
//      chevauchements de créneaux (LockService + capacité par espace).
//   3. PRIX SERVEUR : le montant est recalculé depuis la grille
//      tarifaire serveur ; écart signalé dans l'email admin.
//   4. SANITISATION : neutralisation de l'injection de formules
//      Sheets (=, +, @) sur toutes les entrées publiques.
//   5. RATE LIMITING : max 5 soumissions/heure par email sur les
//      formulaires publics (réservation, inscription, adhésion, contact).
//   6. IDEMPOTENCE : une resoumission identique (même email/espace/
//      date/heure) renvoie la réservation existante au lieu d'un doublon.
//   7. deleteResa supprime aussi l'événement Google Calendar lié.
//   Mot de passe admin : exécuter definirMotDePasseAdmin() dans
//   l'éditeur → hash stocké dans Config, mot de passe envoyé par email.
// ============================================================

const CONFIG = {
  SPREADSHEET_ID:     '1mf3D2YGnpWpzufGOaLLaomxAkuzp0AiJY7RzcbpIq2w',
  EMAIL_ADMIN:        'genie.montauban@gmail.com',
  NOM_LIEU:           'Génie Montauban',
  ADRESSE:            '12 rue du Génie, 82000 Montauban',
  TEL:                '06 51 50 97 18',
  URL_SITE:           'https://genie-montauban.fr',
  URL_MON_COMPTE:     'https://genie-montauban.fr/mon-compte.html',
  CALENDAR_ID:        'genie.montauban@gmail.com',
  TOKEN_EXPIRY_MIN:   60,
  QUOTA_ALERTE_MIN:   20,
  RESA_ATTENTE_MAX_H: 24,
  ADH_ATTENTE_MAX_H:  48,
  SESSION_ADMIN_H:    8,   // durée de validité d'une session admin
  RATE_LIMIT_MAX:     5,   // soumissions max / heure / email
};

// ============================================================
// GRILLE TARIFAIRE SERVEUR — alignée sur tarifs.html (référence)
// capacite = nb de réservations simultanées possibles sur le même créneau
// ============================================================
const TARIFS = {
  bourdelle  : { type:'salle',  capacite:1,  plein:{heure:45,demi:150,journee:250}, adherent:{heure:30,demi:90,journee:150}, locataire:{heure:20,demi:70,journee:120}, asso:{heure:0,demi:0,journee:0} },
  freinet    : { type:'salle',  capacite:1,  plein:{heure:30,demi:100,journee:180}, adherent:{heure:20,demi:60,journee:100}, locataire:{heure:15,demi:45,journee:80},  asso:{heure:0,demi:0,journee:0} },
  gouges     : { type:'salle',  capacite:1,  plein:{heure:30,demi:100,journee:180}, adherent:{heure:20,demi:60,journee:100}, locataire:{heure:15,demi:45,journee:80},  asso:{heure:0,demi:0,journee:0} },
  montessori : { type:'salle',  capacite:1,  plein:{heure:20,demi:60,journee:100},  adherent:{heure:15,demi:45,journee:80},  locataire:{heure:10,demi:30,journee:70},  asso:{heure:0,demi:0,journee:0} },
  aristote   : { type:'nomade', capacite:1,  plein:{demi:18,journee:33,semaine:130,mois:280}, adherent:{demi:12,journee:22,semaine:90,mois:200}, locataire:{demi:12,journee:22,semaine:90,mois:200}, asso:{demi:0,journee:0,semaine:0,mois:0} },
  rousseau   : { type:'nomade', capacite:20, plein:{demi:15,journee:26,semaine:90,mois:250},  adherent:{demi:10,journee:17,semaine:60,mois:180}, locataire:{demi:10,journee:17,semaine:60,mois:180}, asso:{demi:0,journee:0,semaine:0,mois:0} },
  michel     : { type:'nomade', capacite:1,  plein:{demi:12,journee:22,semaine:90,mois:200},  adherent:{demi:12,journee:22,semaine:90,mois:200}, locataire:{demi:12,journee:22,semaine:90,mois:200}, asso:{demi:0,journee:0,semaine:0,mois:0} },
};

// Retrouve la clé tarifaire d'un espace depuis son nom libre
// ('Antoine Bourdelle' → 'bourdelle'). null si espace inconnu.
function cleEspace(nom) {
  var s = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  var cles = Object.keys(TARIFS);
  for (var i = 0; i < cles.length; i++) {
    if (s.indexOf(cles[i]) !== -1) return cles[i];
  }
  return null;
}

// Meilleur prix serveur pour nbH heures (hors options badge/adhésion).
// null si l'espace est inconnu de la grille.
function calculerMontantServeur(espaceNom, nbH, profil) {
  var cle = cleEspace(espaceNom);
  if (!cle) return null;
  var p = ['plein', 'adherent', 'locataire', 'asso'].indexOf(String(profil)) !== -1 ? profil : 'plein';
  var t = TARIFS[cle][p];
  var candidats = [];
  if (t.heure !== undefined) candidats.push(t.heure * Math.ceil(nbH));
  if (t.demi !== undefined && nbH <= 4) candidats.push(t.demi);
  if (t.journee !== undefined && nbH <= 8) candidats.push(t.journee);
  if (!candidats.length) candidats.push(t.journee !== undefined ? t.journee : (t.demi || 0));
  return Math.min.apply(null, candidats);
}

// ============================================================
// SÉCURITÉ v5 — sanitisation, rate limiting, sessions admin
// ============================================================

// Neutralise l'injection de formules Sheets et borne la longueur
function sanit(v) {
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (/^[=+@\t\r]/.test(s)) s = "'" + s;
  return s.substring(0, 2000);
}

// true si l'appelant (clé = email) n'a pas dépassé le quota horaire
function rateLimitOk(cle) {
  try {
    var cache = CacheService.getScriptCache();
    var k = 'rl_' + String(cle || 'anonyme').toLowerCase();
    var n = parseInt(cache.get(k) || '0', 10);
    if (n >= CONFIG.RATE_LIMIT_MAX) return false;
    cache.put(k, String(n + 1), 3600);
    return true;
  } catch (e) { return true; }
}

function hashSha256(txt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt)
    .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function lireSessions() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('ADMIN_SESSIONS') || '{}');
  } catch (e) { return {}; }
}

function ecrireSessions(sessions) {
  PropertiesService.getScriptProperties().setProperty('ADMIN_SESSIONS', JSON.stringify(sessions));
}

function creerSessionAdmin() {
  var sessions = lireSessions();
  var now = Date.now();
  Object.keys(sessions).forEach(function(t) { if (sessions[t] < now) delete sessions[t]; });
  var token = Utilities.getUuid() + '-' + hashSha256(String(Math.random()) + now).substring(0, 12);
  sessions[token] = now + CONFIG.SESSION_ADMIN_H * 3600000;
  ecrireSessions(sessions);
  return token;
}

function verifierSessionAdmin(token) {
  if (!token) return false;
  var sessions = lireSessions();
  return !!(sessions[token] && sessions[token] > Date.now());
}

// null si la session est valide, sinon l'objet d'erreur à renvoyer
function requireAdmin(data) {
  return verifierSessionAdmin(data && data.adminToken)
    ? null
    : { success: false, error: 'NON_AUTORISE', message: 'Session admin requise. Reconnectez-vous.' };
}

// À exécuter DEPUIS L'ÉDITEUR Apps Script pour (ré)initialiser le mot
// de passe admin : génère un mot de passe fort, stocke son hash dans
// l'onglet Config, invalide les sessions et envoie le mot de passe
// par email à CONFIG.EMAIL_ADMIN. À relancer pour changer de mot de passe.
function definirMotDePasseAdmin() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#%*+';
  var mdp = '';
  for (var i = 0; i < 16; i++) mdp += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  var ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var cfg = ss.getSheetByName('Config') || ss.insertSheet('Config');
  var rows = cfg.getDataRange().getValues();
  var hash = hashSha256(mdp);
  var trouve = false;
  for (var j = 0; j < rows.length; j++) {
    if (rows[j][0] === 'ADMIN_PASSWORD_HASH') { cfg.getRange(j + 1, 2).setValue(hash); trouve = true; break; }
  }
  if (!trouve) cfg.appendRow(['ADMIN_PASSWORD_HASH', hash]);
  ecrireSessions({});
  MailApp.sendEmail(CONFIG.EMAIL_ADMIN, '🔐 Génie — Nouveau mot de passe admin',
    'Nouveau mot de passe de l\'interface admin (' + CONFIG.URL_SITE + '/admin.html) :\n\n' + mdp +
    '\n\nConservez-le dans un gestionnaire de mots de passe.\n' +
    'Pour le changer : relancer definirMotDePasseAdmin() dans l\'éditeur Apps Script.\n' +
    'Toutes les sessions admin en cours ont été déconnectées.');
  Logger.log('✅ Mot de passe régénéré et envoyé à ' + CONFIG.EMAIL_ADMIN);
}

// À exécuter DEPUIS L'ÉDITEUR uniquement (tests/maintenance) :
// crée une session admin et affiche le token dans le journal.
function genererSessionAdminDepuisEditeur() {
  Logger.log('Token de session admin (valable ' + CONFIG.SESSION_ADMIN_H + 'h) : ' + creerSessionAdmin());
}

// ============================================================
// POINT D'ENTRÉE POST
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case 'INSCRIRE':                return ok(inscrireClient(data));
      case 'DEMANDER_LIEN':           return ok(demanderLienMagique(data));
      case 'GET_PROFIL':              return ok(getProfil(data));
      case 'RESERVER':                return ok(creerReservation(data));
      case 'GET_RESERVATIONS_CLIENT': return ok(getReservationsClient(data));
      case 'ADHERER':                 return ok(creerAdhesion(data));
      case 'CONTACT':                 return ok(traiterContact(data));
      // ── Actions admin : session vérifiée côté serveur ──
      case 'addResa':                 return ok(requireAdmin(data) || adminAddResa(data.resa));
      case 'updateResa':              return ok(requireAdmin(data) || adminUpdateResa(data.resa));
      case 'deleteResa':              return ok(requireAdmin(data) || adminDeleteResa(data.id));
      case 'saveConfig':              return ok(requireAdmin(data) || adminSaveConfig(data.config));
      case 'ADMIN_LOGIN':             return ok(adminLogin(data));
      case 'ADMIN_UPDATE_STATUS':     return ok(requireAdmin(data) || adminUpdateStatus(data));
      default: return ok({ success: false, error: 'Action inconnue: ' + data.action });
    }
  } catch (err) {
    logErreur('doPost', err);
    return ok({ success: false, error: err.message });
  }
}

// ============================================================
// POINT D'ENTRÉE GET
// ============================================================
function doGet(e) {
  try {
    const a = e.parameter.action || '';
    if (a === 'GET_DISPO')         return ok(getDisponibilites(e.parameter));
    if (a === 'GET_RESERVATIONS')  return ok(getReservations(e.parameter));
    if (a === 'VALIDER_TOKEN')     return ok(validerToken(e.parameter));
    // ── Lectures admin : session vérifiée côté serveur ──
    if (a === 'getAll' || a === 'ADMIN_GET_ALL')
      return ok(requireAdmin(e.parameter) || adminGetAll());
    if (a === 'getCalendar')
      return ok(requireAdmin(e.parameter) || getCalendarEvents(e.parameter));
    if (a === 'syncFromCal')
      return ok(requireAdmin(e.parameter) || syncFromCal(e.parameter));

    if (e.parameter.payload) {
      var data = JSON.parse(e.parameter.payload);
      switch (data.action) {
        case 'RESERVER':            return ok(creerReservation(data));
        case 'INSCRIRE':            return ok(inscrireClient(data));
        case 'ADHERER':             return ok(creerAdhesion(data));
        case 'CONTACT':             return ok(traiterContact(data));
        // ── Actions admin : session vérifiée côté serveur ──
        case 'addResa':             return ok(requireAdmin(data) || adminAddResa(data.resa));
        case 'updateResa':          return ok(requireAdmin(data) || adminUpdateResa(data.resa));
        case 'deleteResa':          return ok(requireAdmin(data) || adminDeleteResa(data.id));
        case 'ADMIN_LOGIN':         return ok(adminLogin(data));
        case 'ADMIN_UPDATE_STATUS': return ok(requireAdmin(data) || adminUpdateStatus(data));
        case 'saveConfig':          return ok(requireAdmin(data) || adminSaveConfig(data.config));
        case 'GET_RESERVATIONS_CLIENT': return ok(getReservationsClient(data));
        case 'GET_PROFIL':          return ok(getProfil(data));
        default: return ok({ success: false, error: 'Action inconnue: ' + data.action });
      }
    }
    return ok({ success: true, message: 'API Génie Montauban v5.0' });
  } catch (err) {
    logErreur('doGet', err);
    return ok({ success: false, error: err.message });
  }
}

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// EMAIL SÉCURISÉ — identique v4.2
// ============================================================
function envoyerEmailSafe(destinataire, sujet, corps, options) {
  try {
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < 2) {
      Logger.log('⛔ QUOTA EPUISE — email non envoyé à ' + destinataire);
      return false;
    }
    if (quota <= CONFIG.QUOTA_ALERTE_MIN) {
      Logger.log('⚠️ Quota faible : ' + quota + ' emails restants');
    }
    if (options) {
      MailApp.sendEmail(destinataire, sujet, corps, options);
    } else {
      MailApp.sendEmail(destinataire, sujet, corps);
    }
    return true;
  } catch (err) {
    Logger.log('❌ Erreur envoi email à ' + destinataire + ' : ' + err.message);
    try {
      if (destinataire !== CONFIG.EMAIL_ADMIN) {
        MailApp.sendEmail(CONFIG.EMAIL_ADMIN,
          '⚠️ Génie — Echec envoi email',
          'Email non délivré à : ' + destinataire + '\nSujet : ' + sujet + '\nErreur : ' + err.message);
      }
    } catch(e2) { Logger.log('❌ Impossible d\'alerter l\'admin : ' + e2.message); }
    return false;
  }
}

// ============================================================
// LOG D'ERREUR CENTRALISÉ — identique v4.2
// ============================================================
function logErreur(contexte, err) {
  var msg = '[' + new Date().toISOString() + '] ERREUR dans ' + contexte + ' : ' + err.message;
  Logger.log(msg);
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var logSheet = ss.getSheetByName('Logs');
    if (logSheet) {
      logSheet.appendRow([new Date().toISOString(), contexte, err.message, err.stack || '']);
    }
  } catch(e) {}
}

// ============================================================
// INSCRIPTION CLIENT — identique v4.2
// ============================================================
function inscrireClient(data) {
  if (!data.email || !data.prenom || !data.nom)
    return { success: false, error: 'CHAMPS_MANQUANTS', message: 'Prénom, nom et email sont obligatoires.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
    return { success: false, error: 'EMAIL_INVALIDE', message: 'Format email invalide.' };
  if (!rateLimitOk('insc_' + data.email))
    return { success: false, error: 'TROP_DE_REQUETES', message: 'Trop de tentatives. Réessayez dans une heure.' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Clients');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4] && rows[i][4].toString().toLowerCase() === data.email.toLowerCase())
        return { success: false, error: 'EMAIL_EXISTE', message: 'Un compte existe déjà avec cet email.' };
    }
    const id = 'CLI-' + Date.now();
    const now = new Date().toISOString();
    let profil = 'plein';
    if (data.type === 'asso') profil = 'asso';
    else if (data.type === 'locataire') profil = 'locataire';
    sheet.appendRow([id, now, sanit(data.prenom), sanit(data.nom), data.email.toLowerCase(),
      sanit(data.tel), sanit(data.type || 'particulier'), sanit(data.structure),
      profil, 'ACTIF', data.cgv ? now : '', data.ri ? now : '', data.statuts ? now : '',
      sanit(data.ip), 0, now]);
    envoyerEmailSafe(data.email, '🎉 Bienvenue chez Génie Montauban !',
      'Bonjour ' + data.prenom + ',\n\nVotre compte est créé !\n\nRéférence : ' + id +
      '\nProfil : ' + (data.type || 'particulier') +
      '\n\nConnectez-vous : ' + CONFIG.URL_MON_COMPTE +
      '\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE + ' · ' + CONFIG.TEL);
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '🆕 Inscription — ' + data.prenom + ' ' + data.nom + ' (' + (data.type || '') + ')',
      'ID : ' + id + '\nNom : ' + data.prenom + ' ' + data.nom +
      '\nEmail : ' + data.email + '\nType : ' + (data.type || ''));
    return { success: true, id: id, message: 'Compte créé.' };
  } catch (err) {
    logErreur('inscrireClient', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// LIEN MAGIQUE — identique v4.2
// ============================================================
function demanderLienMagique(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rows = ss.getSheetByName('Clients').getDataRange().getValues();
    let prenom = '', found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4] && rows[i][4].toString().toLowerCase() === data.email.toLowerCase()) {
        found = true; prenom = rows[i][2]; break;
      }
    }
    if (!found) return { success: false, error: 'EMAIL_INCONNU', message: 'Aucun compte trouvé.' };
    const token = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      data.email + Date.now() + Math.random())
      .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
    const now = new Date();
    const exp = new Date(now.getTime() + CONFIG.TOKEN_EXPIRY_MIN * 60000);
    ss.getSheetByName('Tokens').appendRow([token, data.email.toLowerCase(), now.toISOString(), exp.toISOString(), false]);
    const lien = CONFIG.URL_MON_COMPTE + '?token=' + token;
    envoyerEmailSafe(data.email, '🔑 Votre lien de connexion — Génie Montauban',
      'Bonjour ' + prenom + ',\n\nVoici votre lien de connexion (valable 1h) :\n' + lien +
      '\n\nSi vous n\'avez pas fait cette demande, ignorez cet email.\n\n' + CONFIG.NOM_LIEU);
    return { success: true, message: 'Lien envoyé.' };
  } catch (err) {
    logErreur('demanderLienMagique', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// VALIDER TOKEN — identique v4.2
// ============================================================
function validerToken(params) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Tokens');
    const rows = sheet.getDataRange().getValues();
    const now = new Date();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === params.token) {
        if (rows[i][4] === true) return { success: false, error: 'TOKEN_UTILISE' };
        if (new Date(rows[i][3]) < now) return { success: false, error: 'TOKEN_EXPIRE' };
        sheet.getRange(i + 1, 5).setValue(true);
        const email = rows[i][1];
        const profil = getProfilParEmail(email, ss);
        if (!profil) return { success: false, error: 'CLIENT_INCONNU' };
        majDerniereConnexion(email, ss);
        return { success: true, email: email, profil: profil };
      }
    }
    return { success: false, error: 'TOKEN_INVALIDE' };
  } catch (err) {
    logErreur('validerToken', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// PROFIL CLIENT — identique v4.2
// ============================================================
function getProfil(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const profil = getProfilParEmail(data.email, ss);
    if (!profil) return { success: false, error: 'CLIENT_INCONNU' };
    return { success: true, profil: profil };
  } catch (err) {
    logErreur('getProfil', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

function getProfilParEmail(email, ss) {
  const rows = ss.getSheetByName('Clients').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][4] && rows[i][4].toString().toLowerCase() === email.toLowerCase()) {
      return { id: rows[i][0], prenom: rows[i][2], nom: rows[i][3], email: rows[i][4],
               tel: rows[i][5], type: rows[i][6], structure: rows[i][7],
               profilTarifaire: rows[i][8], statut: rows[i][9], nbReservations: rows[i][14] };
    }
  }
  return null;
}

function majDerniereConnexion(email, ss) {
  const rows = ss.getSheetByName('Clients').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][4] && rows[i][4].toString().toLowerCase() === email.toLowerCase()) {
      ss.getSheetByName('Clients').getRange(i + 1, 16).setValue(new Date().toISOString());
      return;
    }
  }
}

// ============================================================
// RÉSERVATION (formulaire public) — identique v4.2
// ============================================================
// Convertit "HH:MM" en minutes depuis minuit (defaut si invalide)
function hMin(v, defaut) {
  var m = String(v || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : defaut;
}

// Nombre de réservations actives qui chevauchent [debMin, finMin[
// sur le même espace et la même date
function compterChevauchements(rows, cle, dateStr, debMin, finMin, emailExclu) {
  var n = 0;
  for (var i = 1; i < rows.length; i++) {
    var statut = String(rows[i][18] || '');
    if (statut === 'ANNULE' || statut === 'cancelled') continue;
    if (String(rows[i][10] || '').split('T')[0] !== dateStr) continue;
    if (cleEspace(rows[i][7] || rows[i][6]) !== cle) continue;
    if (emailExclu && String(rows[i][3] || '').toLowerCase() === emailExclu) continue;
    var d = hMin(rows[i][13], 8 * 60);
    var f = hMin(rows[i][14], d + 60);
    if (debMin < f && finMin > d) n++;
  }
  return n;
}

function creerReservation(data) {
  if (!data.espace || !data.date || !data.heureDebut || !data.prenom || !data.nom || !data.email)
    return { success: false, error: 'CHAMPS_MANQUANTS' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
    return { success: false, error: 'EMAIL_INVALIDE' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date))
    return { success: false, error: 'DATE_INVALIDE' };
  if (data.date < new Date().toISOString().split('T')[0])
    return { success: false, error: 'DATE_PASSEE', message: 'La date est déjà passée.' };
  if (!/^\d{1,2}:\d{2}$/.test(data.heureDebut))
    return { success: false, error: 'HEURE_INVALIDE' };
  if (!data.duree || isNaN(parseFloat(data.duree)) || parseFloat(data.duree) <= 0)
    return { success: false, error: 'DUREE_INVALIDE' };
  if (!rateLimitOk(data.email))
    return { success: false, error: 'TROP_DE_REQUETES', message: 'Trop de demandes. Réessayez dans une heure ou appelez le ' + CONFIG.TEL + '.' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, error: 'SERVEUR_OCCUPE', message: 'Serveur occupé, merci de réessayer.' };
  }
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Reservations');
    if (!sheet) {
      sheet = ss.insertSheet('Reservations');
      sheet.appendRow(['id','prenom','nom','email','tel','orga','espace','nomEspace',
        'usage','profil','date','typeDuree','nbHeures','heureDebut','heureFin',
        'montant','montantBase','options','statut','participants','objet',
        'createdAt','updatedAt','calendarEventId']);
    }
    const hFin   = heuresFin(data.heureDebut, data.duree);
    const rows   = sheet.getDataRange().getValues();
    const email  = String(data.email).toLowerCase();
    const cle    = cleEspace(data.espace);
    const debMin = hMin(data.heureDebut, 8 * 60);
    const finMin = hMin(hFin, debMin + 60);

    // Idempotence : resoumission identique → renvoyer l'existante
    for (let i = 1; i < rows.length; i++) {
      const statut = String(rows[i][18] || '');
      if (statut === 'ANNULE' || statut === 'cancelled') continue;
      if (String(rows[i][3] || '').toLowerCase() === email &&
          String(rows[i][10] || '').split('T')[0] === data.date &&
          String(rows[i][13] || '') === data.heureDebut &&
          cleEspace(rows[i][7] || rows[i][6]) === cle) {
        return { success: true, id: String(rows[i][0]), dejaEnregistree: true,
                 message: 'Cette réservation était déjà enregistrée.' };
      }
    }

    // Anti double-réservation : capacité de l'espace sur le créneau
    if (cle) {
      const capacite = TARIFS[cle].capacite;
      if (compterChevauchements(rows, cle, data.date, debMin, finMin, email) >= capacite) {
        return { success: false, error: 'CRENEAU_OCCUPE',
                 message: 'Ce créneau vient d\'être réservé. Choisissez un autre horaire ou appelez le ' + CONFIG.TEL + '.' };
      }
    }

    // Prix recalculé côté serveur (hors options badge/adhésion)
    const nbH = parseFloat(data.duree);
    const montantServeur = calculerMontantServeur(data.espace, nbH, data.profil);
    const montantClient  = parseFloat(data.montantEstime) || 0;
    // Options facturées côté client : badge 25 €, adhésion 50 €
    let montantOptions = 0;
    const opts = String(data.options || '');
    if (opts.indexOf('Badge') !== -1)    montantOptions += 25;
    if (opts.indexOf('Adhésion') !== -1) montantOptions += 50;
    const montantAttendu = montantServeur === null ? null : montantServeur + montantOptions;
    const ecart = montantAttendu === null ? 0 : Math.abs(montantClient - montantAttendu);

    const id  = 'RES-' + Date.now();
    const now = new Date().toISOString();
    sheet.appendRow([id, sanit(data.prenom), sanit(data.nom), sanit(email), sanit(data.tel),
      sanit(data.structure), sanit(data.espace), sanit(data.typeEspace || data.espace),
      sanit(data.typeEspace || 'reunion'), sanit(data.profil || 'plein'),
      data.date, 'heure', nbH,
      data.heureDebut, hFin, montantClient,
      montantServeur === null ? montantClient : montantServeur,
      sanit(data.options), 'EN_ATTENTE', parseInt(data.participants) || 1,
      sanit(data.message), now, now, '']);
    try {
      const cRows = ss.getSheetByName('Clients').getDataRange().getValues();
      for (let i = 1; i < cRows.length; i++) {
        if (cRows[i][4] && cRows[i][4].toString().toLowerCase() === email) {
          ss.getSheetByName('Clients').getRange(i + 1, 15).setValue((parseInt(cRows[i][14]) || 0) + 1);
          break;
        }
      }
    } catch(e) {}
    const corps = 'Bonjour ' + data.prenom + ',\n\nVotre demande de réservation est enregistrée.\n\n'
      + '📋 Référence : ' + id + '\n📍 Espace : ' + data.espace + '\n'
      + '📅 Date : ' + formaterDate(data.date) + '\n'
      + '⏰ Horaire : ' + data.heureDebut + ' → ' + hFin + '\n'
      + '💰 Estimation : ' + (data.montantEstime || '?') + ' €\n\n'
      + 'L\'équipe confirme sous 24h ouvrées.\n📞 ' + CONFIG.TEL
      + '\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE;
    envoyerEmailSafe(data.email, '⏳ Demande reçue — ' + data.espace + ' le ' + formaterDate(data.date), corps);
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '🔔 Réservation ' + id + ' — ' + data.espace + ' — ' + data.prenom + ' ' + data.nom,
      'ID : ' + id + '\nEspace : ' + data.espace + '\nDate : ' + data.date +
      ' ' + data.heureDebut + '→' + hFin + '\nClient : ' + data.prenom + ' ' + data.nom +
      '\nEmail : ' + data.email + '\nMontant client : ' + (data.montantEstime || '?') + ' €' +
      (montantAttendu !== null ? '\nMontant grille : ' + montantAttendu + ' €' : '') +
      (ecart > 0.5 ? '\n⚠️ ÉCART DE PRIX : vérifier avant confirmation !' : '') +
      '\n\n👉 Confirmer dans l\'admin : ' + CONFIG.URL_SITE + '/admin.html');
    const evId = ajouterAuCalendrier(data.espace, data.date, data.heureDebut, hFin,
      data.prenom + ' ' + data.nom, id, data.email, false);
    if (evId) sheet.getRange(sheet.getLastRow(), 24).setValue(evId);
    return { success: true, id: id };
  } catch (err) {
    logErreur('creerReservation', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// RÉSERVATIONS CLIENT
// ============================================================
function getReservationsClient(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rows = ss.getSheetByName('Reservations').getDataRange().getValues();
    const list = [];
    for (let i = 1; i < rows.length; i++) {
      // Nouveau schéma : email en col 3
      if (rows[i][3] && rows[i][3].toString().toLowerCase() === data.email.toLowerCase()) {
        list.push({ id: rows[i][0], statut: rows[i][18], espace: rows[i][6],
                    date: rows[i][10], heureDebut: rows[i][13], heureFin: rows[i][14],
                    nbHeures: rows[i][12], montant: rows[i][15] });
      }
    }
    return { success: true, reservations: list.reverse() };
  } catch (err) {
    logErreur('getReservationsClient', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// DISPONIBILITÉS
// ============================================================
function getDisponibilites(params) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rows = ss.getSheetByName('Reservations').getDataRange().getValues();
    const espace = params.espace || '';
    const dateDebut = params.dateDebut || '';
    const dateFin = params.dateFin || dateDebut;
    const occup = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Nouveau schéma : statut col18, espace col6, date col10, hdebut col13, hfin col14
      const statut = String(row[18] || '');
      if (statut === 'ANNULE' || statut === 'cancelled') continue;
      const esp = String(row[6] || '');
      const dat = String(row[10] || '');
      if (espace && esp !== espace) continue;
      if (dat < dateDebut || dat > dateFin) continue;
      const hD = String(row[13] || '08:00');
      const hF = String(row[14] || '09:00');
      if (!occup[esp]) occup[esp] = {};
      if (!occup[esp][dat]) occup[esp][dat] = [];
      const p1 = hD.split(':').map(Number);
      const p2 = hF.split(':').map(Number);
      let cur = p1[0] * 60 + (p1[1] || 0);
      const end = p2[0] * 60 + (p2[1] || 0);
      while (cur < end) {
        occup[esp][dat].push(pad(Math.floor(cur / 60)) + ':' + pad(cur % 60));
        cur += 30;
      }
    }
    return { success: true, occupations: occup };
  } catch (err) {
    logErreur('getDisponibilites', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

function getReservations(params) { return getDisponibilites(params); }

// ============================================================
// ADHÉSION — identique v4.2
// ============================================================
function creerAdhesion(data) {
  if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
    return { success: false, error: 'EMAIL_INVALIDE' };
  if (!rateLimitOk('adh_' + data.email))
    return { success: false, error: 'TROP_DE_REQUETES', message: 'Trop de tentatives. Réessayez dans une heure.' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Adhesions');
    if (!sheet) {
      sheet = ss.insertSheet('Adhesions');
      sheet.appendRow(['ID','Statut','Date','Type','Montant','Paiement','Prénom','Nom','Email','Tél','Adresse','Notes']);
    }
    const id = 'ADH-' + Date.now();
    sheet.appendRow([id, 'EN_ATTENTE', new Date().toISOString(),
      sanit(data.typeAdhesion), sanit(data.montant), sanit(data.modePaiement),
      sanit(data.prenom), sanit(data.nom), sanit(data.email), sanit(data.tel), sanit(data.adresse), '']);
    envoyerEmailSafe(data.email, '✅ Demande d\'adhésion reçue — ' + CONFIG.NOM_LIEU,
      'Bonjour ' + data.prenom + ',\n\nNous avons bien reçu votre demande d\'adhésion.\n\n' +
      'Type : ' + data.typeAdhesion + '\nMontant : ' + data.montant + ' €\n' +
      'Mode : ' + (data.modePaiement || 'À préciser') + '\nRéférence : ' + id +
      '\n\nL\'équipe vous contacte sous 48h.\n\n' +
      CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE + ' · ' + CONFIG.TEL);
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '🆕 Adhésion — ' + data.typeAdhesion + ' — ' + data.prenom + ' ' + data.nom,
      'ID : ' + id + '\nType : ' + data.typeAdhesion + '\nMontant : ' + data.montant +
      ' €\nNom : ' + data.prenom + ' ' + data.nom + '\nEmail : ' + data.email +
      '\n\n👉 Traiter dans l\'admin : ' + CONFIG.URL_SITE + '/admin.html');
    return { success: true, id: id };
  } catch (err) {
    logErreur('creerAdhesion', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// CONTACT — identique v4.2
// ============================================================
function traiterContact(data) {
  if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
    return { success: false, error: 'EMAIL_INVALIDE' };
  if (!rateLimitOk('contact_' + data.email))
    return { success: false, error: 'TROP_DE_REQUETES', message: 'Trop de messages. Réessayez dans une heure.' };
  try {
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '💬 Contact site — ' + (data.sujet || '(sans sujet)'),
      'De : ' + (data.prenom || '') + ' ' + (data.nom || '') + ' <' + data.email + '>\n' +
      'Sujet : ' + (data.sujet || '') + '\n\n' + data.message,
      { replyTo: data.email });
    return { success: true };
  } catch (err) {
    logErreur('traiterContact', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — GET ALL
// CORRECTION v4.3 : schéma Sheet réel (24 colonnes)
// id(0) prenom(1) nom(2) email(3) tel(4) orga(5)
// espace(6) nomEspace(7) usage(8) profil(9) date(10) typeDuree(11)
// nbHeures(12) heureDebut(13) heureFin(14) montant(15) montantBase(16)
// options(17) statut(18) participants(19) objet(20)
// createdAt(21) updatedAt(22) calendarEventId(23)
// ============================================================
function adminGetAll() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resSheet = ss.getSheetByName('Reservations');
    if (!resSheet) {
      resSheet = ss.insertSheet('Reservations');
      resSheet.appendRow(['id','prenom','nom','email','tel','orga','espace','nomEspace',
        'usage','profil','date','typeDuree','nbHeures','heureDebut','heureFin',
        'montant','montantBase','options','statut','participants','objet',
        'createdAt','updatedAt','calendarEventId']);
    }
    const resRows = resSheet.getDataRange().getValues();

    // Mapping statut dans les deux sens (compatibilité ancien + nouveau)
    const statutMap = {
      'EN_ATTENTE':'pending', 'CONFIRME':'confirmed',
      'ANNULE':'cancelled',   'TERMINE':'completed',
      'pending':'pending',    'confirmed':'confirmed',
      'cancelled':'cancelled','completed':'completed',
      'brouillon':'pending'
    };

    const reservations = resRows.slice(1).map(function(r) {
      // Détection automatique du schéma :
      // Ancien (19 col) : col1 = 'EN_ATTENTE'/'CONFIRME'/etc.
      // Nouveau (24 col) : col1 = prénom (texte libre)
      const isAncienSchema = ['EN_ATTENTE','CONFIRME','ANNULE','TERMINE'].includes(String(r[1]));

      var id, prenom, nom, email, tel, orga, espace, nomEspace, usage, profil,
          date, typeDuree, nbH, heureDebut, heureFin, montant, options,
          statut, participants, objet, createdAt, calEventId;

      if (isAncienSchema) {
        // ANCIEN schéma (19 col) : ID,Statut,DateCréa,Espace,Usage,Profil,Date,Hdeb,Hfin,Durée,Part,Prénom,Nom,Email...
        id          = String(r[0]);
        statut      = statutMap[String(r[1])] || 'pending';
        createdAt   = String(r[2] || '');
        nomEspace   = String(r[3] || '');
        usage       = String(r[4] || 'reunion');
        profil      = String(r[5] || 'locataire');
        date        = String(r[6] || '');
        heureDebut  = String(r[7] || '');
        heureFin    = String(r[8] || '');
        nbH         = parseFloat(r[9]) || 1;
        participants= String(r[10] || 1);
        prenom      = String(r[11] || '');
        nom         = String(r[12] || '');
        email       = String(r[13] || '');
        tel         = String(r[14] || '');
        orga        = String(r[15] || '');
        montant     = String(r[16] || 0);
        objet       = String(r[17] || '');
        options     = String(r[18] || '');
        calEventId  = '';
      } else {
        // NOUVEAU schéma (24 col)
        id          = String(r[0]);
        prenom      = String(r[1]  || '');
        nom         = String(r[2]  || '');
        email       = String(r[3]  || '');
        tel         = String(r[4]  || '');
        orga        = String(r[5]  || '');
        espace      = String(r[6]  || '');
        nomEspace   = String(r[7]  || r[6] || '');
        usage       = String(r[8]  || 'reunion');
        profil      = String(r[9]  || 'locataire');
        date        = String(r[10] || '');
        typeDuree   = String(r[11] || 'heure');
        nbH         = parseFloat(r[12]) || 1;
        heureDebut  = String(r[13] || '');
        heureFin    = String(r[14] || '');
        montant     = String(r[15] || 0);
        options     = String(r[17] || '');
        statut      = statutMap[String(r[18])] || 'pending';
        participants= String(r[19] || 1);
        objet       = String(r[20] || '');
        createdAt   = String(r[21] || '');
        calEventId  = String(r[23] || '');
      }

      // Normaliser typeDuree si c'est un chiffre
      if (!typeDuree || !isNaN(parseFloat(typeDuree))) {
        if      (nbH >= 7) typeDuree = 'journee';
        else if (nbH >= 3) typeDuree = 'demi';
        else               typeDuree = 'heure';
      }

      // Clé espace normalisée (dernier mot sans accents, pour correspondre aux clés admin.html)
      const espaceKey = nomEspace
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim().split(/\s+/).pop() || (espace || '').toLowerCase();

      return {
        id, prenom, nom, email, tel, orga,
        espace     : espaceKey,
        nomEspace,
        usage, profil, date,
        typeDuree,
        nbHeures   : String(nbH),
        heureDebut, heureFin,
        montant,
        montantBase: montant,
        options,
        statut,
        participants,
        objet,
        createdAt,
        calEventId
      };
    }).reverse();

    const cfg = lireConfig(ss);
    return { success: true, reservations: reservations, config: cfg };
  } catch (err) {
    logErreur('adminGetAll', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — ADD RESA
// CORRECTION v4.3 : bon ordre de colonnes + email notification
// ============================================================
function adminAddResa(resa) {
  if (!resa) return { success: false, error: 'Données manquantes' };
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    if (!sheet) return { success: false, error: 'Onglet Reservations introuvable' };
    const statutMap = { pending:'EN_ATTENTE', confirmed:'CONFIRME', cancelled:'ANNULE', completed:'TERMINE' };
    const now = new Date().toISOString();

    // Écriture dans le nouveau schéma (24 colonnes)
    sheet.appendRow([
      resa.id          || ('RSV-' + Date.now()),
      resa.prenom      || '',
      resa.nom         || '',
      resa.email       || '',
      resa.tel         || '',
      resa.orga        || '',
      resa.espace      || '',
      resa.nomEspace   || resa.espace || '',
      resa.usage       || 'reunion',
      resa.profil      || 'locataire',
      resa.date        || '',
      resa.typeDuree   || 'heure',
      resa.nbHeures    || '1',
      resa.heureDebut  || '',
      resa.heureFin    || '',
      resa.montant     || 0,
      resa.montantBase || resa.montant || 0,
      resa.options     || '',
      statutMap[resa.statut] || 'EN_ATTENTE',
      resa.participants || 1,
      resa.objet       || '',
      resa.createdAt   || now,
      now,
      ''  // calendarEventId
    ]);

    // Email client + admin
    if (resa.email) {
      const dl = resa.typeDuree === 'heure'
        ? (resa.nbHeures + 'h (' + resa.heureDebut + '→' + resa.heureFin + ')')
        : ({demi:'½ journée',journee:'Journée',semaine:'Semaine',mois:'Mois'}[resa.typeDuree] || resa.typeDuree);
      const montantStr = (parseFloat(resa.montant)||0) === 0 ? 'Gratuit' : resa.montant + ' €';
      envoyerEmailSafe(resa.email,
        '⏳ Réservation reçue — ' + (resa.nomEspace||resa.espace) + ' — Génie Montauban',
        'Bonjour ' + (resa.prenom||resa.nom||'') + ',\n\n'
        + 'Votre demande a bien été enregistrée.\n\n'
        + '📋 Référence : ' + (resa.id||'') + '\n'
        + '📍 Espace    : ' + (resa.nomEspace||resa.espace||'') + '\n'
        + '📅 Date      : ' + formaterDate(resa.date) + '\n'
        + '⏰ Durée     : ' + dl + '\n'
        + '💰 Montant   : ' + montantStr + '\n'
        + (resa.options ? '➕ Options  : ' + resa.options + '\n' : '')
        + "\nL'équipe Génie vous confirme sous 24h ouvrées.\n"
        + '📞 ' + CONFIG.TEL + '\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE);
      envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
        '🔔 Réservation ' + (resa.id||'') + ' — ' + (resa.nomEspace||resa.espace||'') + ' — ' + (resa.prenom||'') + ' ' + (resa.nom||''),
        'Réf    : ' + (resa.id||'') + '\nEspace : ' + (resa.nomEspace||resa.espace||'')
        + '\nDate   : ' + (resa.date||'') + ' ' + (resa.heureDebut||'') + '→' + (resa.heureFin||'')
        + '\nClient : ' + (resa.prenom||'') + ' ' + (resa.nom||'')
        + '\nEmail  : ' + (resa.email||'')
        + '\nMontant: ' + (resa.montant||0) + ' €'
        + (resa.orga  ? '\nOrg.   : ' + resa.orga  : '')
        + (resa.objet ? '\nObjet  : ' + resa.objet : '')
        + '\n\n👉 ' + CONFIG.URL_SITE + '/admin.html');
    }

    if (resa.statut === 'confirmed') {
      ajouterAuCalendrier(resa.nomEspace||resa.espace, resa.date, resa.heureDebut, resa.heureFin,
        (resa.prenom||'') + ' ' + (resa.nom||''), resa.id, resa.email, true);
    }

    return { success: true, ok: true, id: resa.id };
  } catch (err) {
    logErreur('adminAddResa', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — UPDATE RESA
// CORRECTION v4.3 : bon ordre de colonnes (24 colonnes)
// ============================================================
function adminUpdateResa(resa) {
  if (!resa) return { success: false, error: 'Données manquantes' };
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    if (!sheet) return { success: false, error: 'Onglet Reservations introuvable' };
    const rows  = sheet.getDataRange().getValues();
    const statutMap = { pending:'EN_ATTENTE', confirmed:'CONFIRME', cancelled:'ANNULE', completed:'TERMINE' };
    const now   = new Date().toISOString();

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(resa.id)) {
        const newStatut = statutMap[resa.statut] || 'EN_ATTENTE';
        sheet.getRange(i + 1, 1, 1, 24).setValues([[
          resa.id,
          resa.prenom      || '',
          resa.nom         || '',
          resa.email       || '',
          resa.tel         || '',
          resa.orga        || '',
          resa.espace      || '',
          resa.nomEspace   || resa.espace || '',
          resa.usage       || 'reunion',
          resa.profil      || 'locataire',
          resa.date        || '',
          resa.typeDuree   || 'heure',
          resa.nbHeures    || '1',
          resa.heureDebut  || '',
          resa.heureFin    || '',
          resa.montant     || 0,
          resa.montantBase || resa.montant || 0,
          resa.options     || '',
          newStatut,
          resa.participants || 1,
          resa.objet        || '',
          rows[i][21]       || now,  // createdAt inchangé
          now,                       // updatedAt
          rows[i][23]       || ''    // calendarEventId inchangé
        ]]);

        if (newStatut === 'CONFIRME') {
          envoyerEmailSafe(resa.email,
            '✅ Réservation confirmée — ' + (resa.nomEspace||resa.espace) + ' — Génie Montauban',
            'Bonjour ' + (resa.prenom||resa.nom) + ',\n\nVotre réservation est confirmée !\n\n'
            + '• Espace    : ' + (resa.nomEspace||resa.espace) + '\n'
            + '• Date      : ' + formaterDate(resa.date) + '\n'
            + '• Horaire   : ' + resa.heureDebut + ' → ' + resa.heureFin + '\n'
            + '• Référence : ' + resa.id + '\n\nÀ bientôt !\n' + CONFIG.NOM_LIEU);
          ajouterAuCalendrier(resa.nomEspace||resa.espace, resa.date, resa.heureDebut, resa.heureFin,
            (resa.prenom||'') + ' ' + resa.nom, resa.id, resa.email, true);
        }
        return { success: true, ok: true };
      }
    }
    return { success: false, error: 'ID non trouvé : ' + resa.id };
  } catch (err) {
    logErreur('adminUpdateResa', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — DELETE RESA
// ============================================================
function adminDeleteResa(id) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    if (!sheet) return { success: false, error: 'Onglet Reservations introuvable' };
    const rows  = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        // Nouveau schéma : statut en col 19 (index 18)
        sheet.getRange(i + 1, 19).setValue('ANNULE');
        // Supprimer l'événement Google Calendar lié (v5)
        try {
          const calEventId = String(rows[i][23] || '');
          if (calEventId) {
            const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
            const ev  = cal && cal.getEventById(calEventId);
            if (ev) ev.deleteEvent();
          }
        } catch(eCal) { Logger.log('Suppression événement Calendar impossible : ' + eCal.message); }
        return { success: true, ok: true };
      }
    }
    return { success: false, error: 'ID non trouvé' };
  } catch (err) {
    logErreur('adminDeleteResa', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — SAVE CONFIG — identique v4.2
// ============================================================
function adminSaveConfig(config) {
  if (!config) return { success: false, error: 'Config manquante' };
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Config');
    if (!sheet) return { success: false, error: 'Feuille Config absente' };
    const rows  = sheet.getDataRange().getValues();
    function setVal(key, val) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === key) { sheet.getRange(i + 1, 2).setValue(val); return; }
      }
      sheet.appendRow([key, val]);
    }
    if (config.email) setVal('EMAIL_CONTACT', config.email);
    if (config.tel)   setVal('TEL_CONTACT',   config.tel);
    return { success: true };
  } catch (err) {
    logErreur('adminSaveConfig', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — LOGIN — identique v4.2
// ============================================================
function adminLogin(data) {
  try {
    const ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const cfg = ss.getSheetByName('Config');
    if (!cfg) return { success: false };
    const rows    = cfg.getDataRange().getValues();
    const hashRow = rows.find(function(r) { return r[0] === 'ADMIN_PASSWORD_HASH'; });
    if (!hashRow) return { success: false, error: 'MDP_NON_INITIALISE',
      message: 'Exécuter definirMotDePasseAdmin() dans l\'éditeur Apps Script.' };
    // Rate limiting anti force brute (5 essais/heure)
    if (!rateLimitOk('adminlogin'))
      return { success: false, error: 'TROP_DE_REQUETES', message: 'Trop de tentatives. Réessayez dans une heure.' };
    const inputHash = hashSha256(String(data.password || ''));
    if (inputHash !== hashRow[1]) return { success: false };
    // Session serveur : token aléatoire, jamais dérivé du mot de passe
    return { success: true, token: creerSessionAdmin(), expireDansH: CONFIG.SESSION_ADMIN_H };
  } catch (err) {
    logErreur('adminLogin', err);
    return { success: false, error: 'ERREUR_SERVEUR' };
  }
}

// ============================================================
// ADMIN — UPDATE STATUS
// CORRECTION v4.3 : indices colonnes alignés nouveau schéma
// ============================================================
function adminUpdateStatus(data) {
  try {
    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetName = data.type === 'reservation' ? 'Reservations' : 'Adhesions';
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Onglet introuvable' };
    const rows      = sheet.getDataRange().getValues();
    const couleurs  = {
      'CONFIRME':   { bg: '#D4EDDA', fg: '#155724' },
      'EN_ATTENTE': { bg: '#FFF3CD', fg: '#856404' },
      'ANNULE':     { bg: '#F8D7DA', fg: '#721C24' },
      'TERMINE':    { bg: '#E2E3E5', fg: '#383D41' }
    };
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        // Reservations nouveau schéma : statut col 19 (index 18)
        // Adhesions : statut col 2 (index 1) — inchangé
        const statCol = data.type === 'reservation' ? 19 : 2;
        sheet.getRange(i + 1, statCol).setValue(data.statut);
        const c = couleurs[data.statut] || { bg: '#fff', fg: '#000' };
        sheet.getRange(i + 1, statCol).setBackground(c.bg).setFontColor(c.fg);

        if (data.statut === 'CONFIRME' && data.type === 'reservation') {
          // Nouveau schéma : email=col3, prenom=col1, nom=col2, espace=col7, date=col10, hdeb=col13, hfin=col14
          envoyerEmailSafe(rows[i][3],
            '✅ Réservation confirmée — ' + rows[i][7] + ' — ' + rows[i][10],
            'Bonjour ' + (rows[i][1]||rows[i][2]) + ',\n\nVotre réservation est confirmée !\n\n'
            + '• Espace    : ' + rows[i][7] + '\n'
            + '• Date      : ' + rows[i][10] + '\n'
            + '• Horaire   : ' + rows[i][13] + ' → ' + rows[i][14] + '\n'
            + '• Référence : ' + rows[i][0] + '\n\n'
            + (data.messageAdmin || '') + '\n\nÀ bientôt !\n' + CONFIG.NOM_LIEU);
          ajouterAuCalendrier(rows[i][7], rows[i][10], rows[i][13], rows[i][14],
            rows[i][1] + ' ' + rows[i][2], rows[i][0], rows[i][3], true);
        }
        return { success: true, ok: true };
      }
    }
    return { success: false, error: 'ID non trouvé' };
  } catch (err) {
    logErreur('adminUpdateStatus', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// GOOGLE CALENDAR — GET EVENTS (ajouté v4.3)
// ============================================================
function getCalendarEvents(params) {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!cal) return { success: false, error: 'Calendrier introuvable', events: [] };
    const start = new Date((params.start||'') + 'T00:00:00');
    const end   = new Date((params.end  ||'') + 'T23:59:59');
    const events = cal.getEvents(start, end).map(ev => ({
      calEventId : ev.getId(),
      title      : ev.getTitle(),
      start      : ev.getStartTime().toISOString(),
      end        : ev.getEndTime().toISOString(),
      resaId     : (ev.getDescription().match(/Référence : ([A-Z]{2,3}-[A-Z0-9]+)/) || [])[1] || null
    }));
    return { success: true, events: events };
  } catch(e) {
    return { success: false, error: e.message, events: [] };
  }
}

function syncFromCal(params) {
  const calData = getCalendarEvents(params);
  if (!calData.success) return calData;
  const ss       = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet    = ss.getSheetByName('Reservations');
  if (!sheet) return { success: false, error: 'Onglet Reservations introuvable' };
  const rows     = sheet.getDataRange().getValues();
  const existIds = rows.slice(1).map(r => String(r[0]));
  const now      = new Date().toISOString();
  const imported = [];
  // Noms des salles Génie — seuls les événements contenant un de ces mots sont importés
  const SALLES = ['bourdelle','freinet','gouges','aristote','rousseau','montessori',
                  'génie','genie','✅','⏳'];

  (calData.events || []).forEach(ev => {
    // ── Filtre : n'importer QUE les événements liés aux salles Génie ──
    const titre = (ev.title || '').toLowerCase();
    const estGenie = SALLES.some(s => titre.includes(s));
    if (!estGenie) return; // ignorer les RDV personnels

    if (ev.resaId && existIds.includes(ev.resaId)) return;
    const s  = new Date(ev.start);
    const id = 'CAL-' + s.getTime().toString(36).toUpperCase();
    if (existIds.includes(id)) return;
    const hd = pad(s.getHours()) + ':' + pad(s.getMinutes());
    const he = pad(new Date(ev.end).getHours()) + ':' + pad(new Date(ev.end).getMinutes());
    // Extraire la salle depuis le titre (format "✅ Bourdelle — Client")
    const salleMatch = ev.title.match(/✅\s*(\w+)|⏳\s*(\w+)/i);
    const salleKey   = salleMatch ? (salleMatch[1]||salleMatch[2]).toLowerCase() : '';
    sheet.appendRow([id,'','',ev.title,'','',salleKey,ev.title,'reunion','locataire',
      ev.start.split('T')[0],'heure','',hd,he,0,0,'','CONFIRME',1,
      'Importé depuis Calendar',now,now,ev.calEventId||'']);
    imported.push(id);
  });
  return { success: true, imported: imported };
}

// ============================================================
// GOOGLE AGENDA — identique v4.2 + nettoyage date
// ============================================================
function ajouterAuCalendrier(espace, date, heureDebut, heureFin, client, ref, email, confirme) {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!cal) return '';
    // Nettoyer la date (peut contenir T00:00:00.000Z)
    const dateStr = String(date || '').split('T')[0];
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const hd = String(heureDebut || '09:00').substring(0,5);
    const hf = String(heureFin  || '10:00').substring(0,5);
    const debut = new Date(dateStr + 'T' + hd + ':00');
    const fin   = new Date(dateStr + 'T' + hf + ':00');
    if (isNaN(debut.getTime()) || isNaN(fin.getTime()) || fin <= debut) return '';
    const titre = (confirme ? '✅ ' : '⏳ ') + espace + ' — ' + client;
    const ev = cal.createEvent(titre, debut, fin, {
      description: 'Référence : ' + ref + '\nEmail : ' + email,
      location: CONFIG.ADRESSE
    });
    return ev ? ev.getId() : '';
  } catch (err) {
    Logger.log('Calendrier erreur : ' + err.message);
    return '';
  }
}

// ============================================================
// VÉRIFIER NOUVEL AVIS — déplacé depuis "Projet sans titre"
// Trigger : toutes les heures ou toutes les 4h selon préférence
// ============================================================
function verifierNouvelAvis() {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Avis_Qualite');
    if (!sheet) {
      Logger.log('⚠️ Onglet Avis_Qualite introuvable — vérifier le nom exact dans le Sheet.');
      return;
    }
    const last = sheet.getLastRow();
    if (last < 2) return;

    const props      = PropertiesService.getScriptProperties();
    const derniereOK = parseInt(props.getProperty('derniere_ligne')) || 1;
    if (last <= derniereOK) return;

    const nbNouveaux = last - derniereOK;
    if (MailApp.getRemainingDailyQuota() < nbNouveaux) {
      Logger.log('⚠️ Quota insuffisant (' + MailApp.getRemainingDailyQuota() + ' restants pour ' + nbNouveaux + ' avis)');
      return;
    }

    const data = sheet.getRange(derniereOK + 1, 3, nbNouveaux, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      var note     = parseInt(data[i][0]) || 0;
      var services = data[i][1] || 'Non précisé';
      var avis     = data[i][2] || '(vide)';
      var amelio   = data[i][3] || '(vide)';
      var reco     = data[i][4] || 'Non renseigné';
      var prenom   = data[i][5] || 'Anonyme';
      var etoiles  = '';
      for (var j = 1; j <= 5; j++) etoiles += (j <= note ? '★' : '☆');
      envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
        '⭐ Nouvel avis Génie — ' + note + '/5 de ' + prenom,
        'Bonjour Samir,\n\n'
        + 'Note       : ' + etoiles + ' (' + note + '/5)\n'
        + 'Prénom     : ' + prenom + '\n'
        + 'Service(s) : ' + services + '\n'
        + 'Recommande : ' + reco + '\n\n'
        + 'CE QUI A PLU :\n' + avis + '\n\n'
        + 'À AMÉLIORER :\n' + amelio + '\n\n'
        + (note >= 4 ? '✅ Éligible publication. Tape "oui" dans la colonne Approuvé.\n\n'
                     : '⚠️ Note < 4 — ne sera pas affiché.\n\n')
        + 'Sheets : https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID);
    }
    props.setProperty('derniere_ligne', last);
    Logger.log('verifierNouvelAvis : ' + nbNouveaux + ' avis traité(s).');
  } catch (err) {
    Logger.log('❌ ERREUR verifierNouvelAvis : ' + err.message + '\n' + (err.stack||''));
  }
}

// ============================================================
// HELPERS — identiques v4.2
// ============================================================
function pad(n) { return String(n).padStart(2, '0'); }

function formaterDate(s) {
  if (!s) return '';
  const str = String(s).split('T')[0];
  const p   = str.split('-');
  if (p.length < 3) return str;
  const mois = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];
  return parseInt(p[2]) + ' ' + (mois[parseInt(p[1]) - 1]||'') + ' ' + p[0];
}

function heuresFin(debut, duree) {
  const p = String(debut || '08:00').split(':');
  const total = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0) + Math.round(parseFloat(duree) * 60);
  return pad(Math.floor(total / 60) % 24) + ':' + pad(total % 60);
}

function lireConfig(ss) {
  try {
    const rows = ss.getSheetByName('Config').getDataRange().getValues();
    const cfg  = { email: CONFIG.EMAIL_ADMIN, tel: CONFIG.TEL };
    rows.forEach(function(r) {
      if (r[0] === 'EMAIL_CONTACT' || r[0] === 'email') cfg.email = r[1];
      if (r[0] === 'TEL_CONTACT'   || r[0] === 'tel')   cfg.tel   = r[1];
    });
    return cfg;
  } catch(e) {
    return { email: CONFIG.EMAIL_ADMIN, tel: CONFIG.TEL };
  }
}

// ============================================================
// MONITORING — identique v4.2
// ============================================================
function checkSante() {
  var lignes = [], alertes = [], now = new Date();
  try {
    var quota = MailApp.getRemainingDailyQuota();
    lignes.push('📧 Quota email restant : ' + quota + '/jour');
    if (quota < CONFIG.QUOTA_ALERTE_MIN) alertes.push('⚠️ QUOTA CRITIQUE : ' + quota + ' emails restants !');
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var resSheet = ss.getSheetByName('Reservations');
    if (resSheet) {
      var resRows = resSheet.getDataRange().getValues();
      var resBloquees = [];
      for (var i = 1; i < resRows.length; i++) {
        // Nouveau schéma : statut col18, createdAt col21, prenom col1, nom col2, id col0
        var statutResa = String(resRows[i][18]||resRows[i][1]||'');
        if (statutResa === 'EN_ATTENTE') {
          var createdAt = new Date(resRows[i][21]||resRows[i][2]||now);
          var h = (now - createdAt) / 3600000;
          if (h > CONFIG.RESA_ATTENTE_MAX_H) {
            var prenomR = String(resRows[i][1]||resRows[i][11]||'');
            var nomR    = String(resRows[i][2]||resRows[i][12]||'');
            resBloquees.push(resRows[i][0] + ' — ' + prenomR + ' ' + nomR + ' (' + Math.round(h) + 'h)');
          }
        }
      }
      lignes.push('📋 Réservations EN_ATTENTE > ' + CONFIG.RESA_ATTENTE_MAX_H + 'h : ' + resBloquees.length);
      if (resBloquees.length > 0)
        alertes.push('🔔 ' + resBloquees.length + ' réservation(s) sans réponse :\n  - ' + resBloquees.join('\n  - '));
    }
    var adhSheet = ss.getSheetByName('Adhesions');
    if (adhSheet) {
      var adhRows = adhSheet.getDataRange().getValues();
      var adhBloquees = [];
      for (var j = 1; j < adhRows.length; j++) {
        if (adhRows[j][1] === 'EN_ATTENTE') {
          var hAdh = (now - new Date(adhRows[j][2])) / 3600000;
          if (hAdh > CONFIG.ADH_ATTENTE_MAX_H)
            adhBloquees.push(adhRows[j][0] + ' — ' + adhRows[j][6] + ' ' + adhRows[j][7] + ' (' + Math.round(hAdh) + 'h)');
        }
      }
      lignes.push('🤝 Adhésions EN_ATTENTE > ' + CONFIG.ADH_ATTENTE_MAX_H + 'h : ' + adhBloquees.length);
      if (adhBloquees.length > 0)
        alertes.push('🔔 ' + adhBloquees.length + ' adhésion(s) sans réponse :\n  - ' + adhBloquees.join('\n  - '));
    }
    var sujet  = alertes.length > 0 ? '🚨 Génie — ' + alertes.length + ' alerte(s)' : '✅ Génie — Bilan quotidien OK';
    var corps  = '=== BILAN SANTÉ GÉNIE — ' + now.toLocaleDateString('fr-FR') + ' ===\n\n' + lignes.join('\n') + '\n\n';
    if (alertes.length > 0) corps += '=== ALERTES ===\n\n' + alertes.join('\n\n') + '\n\n👉 ' + CONFIG.URL_SITE + '/admin.html\n';
    else corps += '✅ Tout fonctionne normalement.\n';
    corps += '\n---\nGénie Montauban v4.3';
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN, sujet, corps);
  } catch (err) {
    Logger.log('❌ checkSante ERREUR : ' + err.message);
    try { MailApp.sendEmail(CONFIG.EMAIL_ADMIN, '❌ Génie — Erreur bilan santé', err.message); } catch(e2) {}
  }
}

function nettoyerTokens() {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Tokens');
    if (!sheet) return;
    var rows  = sheet.getDataRange().getValues();
    var now   = new Date(), supprimees = 0;
    for (var i = rows.length - 1; i >= 1; i--) {
      if (new Date(rows[i][3]) < now || rows[i][4] === true) {
        sheet.deleteRow(i + 1); supprimees++;
      }
    }
    Logger.log('🧹 Tokens nettoyés : ' + supprimees);
  } catch (err) { logErreur('nettoyerTokens', err); }
}

function alerterResasBloquees() {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservations');
    if (!sheet) return;
    var rows  = sheet.getDataRange().getValues();
    var now   = new Date(), bloquees = [];
    for (var i = 1; i < rows.length; i++) {
      var statut = String(rows[i][18]||rows[i][1]||'');
      if (statut === 'EN_ATTENTE') {
        var h = (now - new Date(rows[i][21]||rows[i][2]||now)) / 3600000;
        if (h > CONFIG.RESA_ATTENTE_MAX_H) {
          bloquees.push({ id: rows[i][0],
            client : String(rows[i][1]||rows[i][11]||'') + ' ' + String(rows[i][2]||rows[i][12]||''),
            espace : String(rows[i][7]||rows[i][3]||''),
            date   : String(rows[i][10]||rows[i][6]||''),
            heures : Math.round(h) });
        }
      }
    }
    if (bloquees.length === 0) return;
    var corps = '🔔 ' + bloquees.length + ' réservation(s) EN_ATTENTE depuis +' + CONFIG.RESA_ATTENTE_MAX_H + 'h :\n\n';
    bloquees.forEach(function(r) { corps += '• ' + r.id + ' — ' + r.client + ' — ' + r.espace + ' le ' + r.date + ' (' + r.heures + 'h)\n'; });
    corps += '\n👉 ' + CONFIG.URL_SITE + '/admin.html';
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '⏰ Génie — ' + bloquees.length + ' réservation(s) à confirmer', corps);
  } catch (err) { logErreur('alerterResasBloquees', err); }
}

// ============================================================
// TEST SYSTÈME
// ============================================================
function testSysteme() {
  Logger.log('=== TEST SYSTÈME GÉNIE v4.3 ===');
  try {
    var ss      = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var feuilles = ss.getSheets().map(function(s) { return s.getName(); });
    Logger.log('✅ Spreadsheet OK — Feuilles : ' + feuilles.join(', '));
    Logger.log('✅ Quota email : ' + MailApp.getRemainingDailyQuota() + ' restants');
    var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    Logger.log(cal ? '✅ Agenda OK : ' + cal.getName() : '⚠️ Agenda introuvable : ' + CONFIG.CALENDAR_ID);
    ['Clients','Tokens','Reservations','Adhesions','Config','Avis_Qualite'].forEach(function(nom) {
      var s = ss.getSheetByName(nom);
      Logger.log(s ? '✅ "' + nom + '" (' + Math.max(0,s.getLastRow()-1) + ' lignes)' : '❌ "' + nom + '" MANQUANT');
    });
    var cfg     = ss.getSheetByName('Config');
    var hashRow = cfg ? cfg.getDataRange().getValues().find(function(r){return r[0]==='ADMIN_PASSWORD_HASH';}) : null;
    Logger.log(hashRow ? '✅ Hash admin OK' : '❌ Hash admin MANQUANT');
    Logger.log('=== FIN TEST ===');
  } catch (err) {
    Logger.log('❌ ERREUR : ' + err.message);
  }
}

// ============================================================
// MIGRATION SHEET v2 — Écriture directe des données corrigées
// Basé sur analyse complète de chaque ligne (06/06/2026)
// Exécuter UNE SEULE FOIS puis supprimer cette fonction.
// ============================================================
function migrateReservations() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservations');

  // ── Données 100% corrigées — analyse ligne par ligne du 06/06/2026 ──
  // Colonnes : id | prenom | nom | email | tel | orga | espace | nomEspace |
  //            usage | profil | date | typeDuree | nbHeures | heureDebut |
  //            heureFin | montant | montantBase | options | statut |
  //            participants | objet | createdAt | updatedAt | calendarEventId
  var data = [
    // ── EN-TÊTES ──
    ['id','prenom','nom','email','tel','orga','espace','nomEspace','usage','profil',
     'date','typeDuree','nbHeures','heureDebut','heureFin','montant','montantBase',
     'options','statut','participants','objet','createdAt','updatedAt','calendarEventId'],

    // ── L01 : Marcelle — Bourdelle — 03/06/2026 (données v4.3 OK) ──
    ['GEN-MO1L3WA6','Marcelle','','marcelle.naany@gmail.com','0767682102','LE GENIE',
     'bourdelle','Antoine Bourdelle','reservation-publique','asso',
     '2026-06-03','demi','4','18:50','22:50','0','0','','CONFIRME','1','',
     '2026-04-16T14:38:26.094Z','2026-04-17T06:56:48.194Z',
     '27jp1emh6mq7pokchjeciqt6lc@google.com'],

    // ── L02 : Andrea — Bourdelle — 20/05/2026 (données v4.3 OK) ──
    ['GEN-MO2PL320','Andrea','','andrea.caro@boutdunez.fr','650488553',
     'Compagnie du Bout Du nez','bourdelle','Antoine Bourdelle',
     'reservation-publique','asso','2026-05-20','journee','9','08:50','17:50',
     '0','0','','CONFIRME','1','',
     '2026-04-17T09:31:32.664Z','2026-04-17T09:33:04.600Z',
     's5n5nsnujs9qltht5o1ntg6qe8@google.com'],

    // ── L03 : Augustin — Aristote (colonnes décalées reconstituées, date inconnue) ──
    ['GEN-MONBPYEJ','Augustin','','anaisreflexologue82@gmail.com','646015367',
     'Entreprise en cours de création','aristote','Aristote','reunion','plein',
     '','demi','4','10:05','14:05','12','12','','CONFIRME','1','','','',''],

    // ── L04 : connaissance — Freinet (colonnes décalées reconstituées, date inconnue) ──
    ['RSV-MOZLZRKO','connaissance','','actresorerie.toulouse@gmail.com','',
     'antre-connaissance','freinet','Célestin Freinet','reunion','locataire',
     '','heure','1','10:00','11:00','20','20','','CONFIRME','1','','','',''],

    // ── L05 : connaissance — Freinet (colonnes décalées reconstituées, date inconnue) ──
    ['RSV-MOZM3W3N','connaissance','','actresorerie.toulouse@gmail.com','',
     'antre connaissance','freinet','Célestin Freinet','reunion','locataire',
     '','heure','1','10:00','11:00','20','20','','CONFIRME','1','','','',''],

    // ── L06 : CONNAISSANCE — Freinet (colonnes décalées reconstituées, date inconnue) ──
    ['RSV-MOZM56KD','CONNAISSANCE','','actresorerie.toulouse@gmail.com','',
     '','freinet','Célestin Freinet','reunion','locataire',
     '','heure','1','10:00','11:00','20','20','','CONFIRME','1','','','',''],

    // ── L07 : FNE82/Enercit — Bourdelle (import Calendar, date inconnue) ──
    ['CAL-MPCGGZQJ','FNE82/Enercit','','','','FNE82/Enercit',
     'bourdelle','Antoine Bourdelle','reunion','locataire',
     '','journee','8','09:00','17:00','0','0','','CONFIRME','1',
     'FNE82/Enercit - Réservation salle Antoine Bourdelle','','',''],

    // ── L08 : Perrine Leparc — Freinet — 05/06/2026 (date corrigée) ──
    ['GEN-MPXT2VX1','Perrine','Leparc','perrine.leparc@gmail.com','679314094',
     'particulier','freinet','Célestin Freinet','reservation-publique','plein',
     '2026-06-05','journee','8','07:30','18:30','180','180','','CONFIRME','1','',
     '2026-06-03T08:29:55.861Z','2026-06-03T08:29:55.861Z',''],

    // ── L09 : Lefevre — Freinet — 07/06/2026 (date corrigée) ──
    ['GEN-MPZLMF7Q','Lefevre','','actresorerie.toulouse@gmail.com','641066283',
     "L'Antre Connaissance",'freinet','Célestin Freinet',
     'reservation-publique','adherent','2026-06-07','heure','1','10:00','11:00',
     '20','20','','CONFIRME','1','Ce sera Guillaume Koke qui animera.',
     '2026-06-04T14:36:42.758Z','2026-06-04T14:36:42.758Z',''],

    // ── L10 : Julie — Bourdelle — 09/06/2026 (date corrigée, virgule supprimée) ──
    ['GEN-MQ0OIN4B','Julie','','julie.suau@mobicoop.org','768826061',
     'Association Covoiturons sur le Pouce','bourdelle','Antoine Bourdelle',
     'reservation-publique','locataire','2026-06-09','demi','4','17:00','20:00',
     '70','70','Adhésion Génie','CONFIRME','1','Vidéo projecteur ?',
     '2026-06-05T08:45:31.403Z','2026-06-05T08:45:31.403Z','']
  ];

  // ── Réécriture complète ──
  sheet.clearContents();
  sheet.getRange(1, 1, data.length, 24).setValues(data);
  sheet.getRange(1, 1, 1, 24)
    .setFontWeight('bold').setBackground('#1E4A6E').setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 24);

  var msg = '✅ Migration OK — ' + (data.length - 1) + ' réservations écrites proprement.';
  Logger.log(msg);
  return msg;
}

// ============================================================
// NETTOYAGE — Supprime les lignes importées depuis Calendar
// Exécuter manuellement pour nettoyer les imports parasites
// ============================================================
function nettoyerImportsCal() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservations');
  var rows  = sheet.getDataRange().getValues();
  var suppr = 0;
  // Parcourir en ordre inverse pour ne pas décaler les indices
  for (var i = rows.length - 1; i >= 1; i--) {
    var id    = String(rows[i][0] || '');
    var objet = String(rows[i][20] || '');
    var email = String(rows[i][3] || '');
    // Supprimer : lignes CAL- avec "Importé depuis Calendar" OU sans email OU données parasites
    var isCalImport  = id.startsWith('CAL-') && objet === 'Importé depuis Calendar';
    var isGarbage    = id.startsWith('RSV-') && !email.includes('@');
    if (isCalImport || isGarbage) {
      sheet.deleteRow(i + 1);
      suppr++;
    }
  }
  var msg = '✅ Nettoyage terminé : ' + suppr + ' lignes supprimées.';
  Logger.log(msg);
  return msg;
}

// ============================================================
// SETUP DÉCLENCHEURS
// ============================================================
function setupDeclencheurs() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkSante').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('alerterResasBloquees').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('nettoyerTokens').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('verifierNouvelAvis').timeBased().everyHours(4).create();
  Logger.log('✅ Déclencheurs configurés : checkSante(8h), alerterResasBloquees(6h), nettoyerTokens(lundi), verifierNouvelAvis(4h)');
  Logger.log('Total : ' + ScriptApp.getProjectTriggers().length + ' déclencheur(s)');
}

// ============================================================
// SETUP COMPLET
// ============================================================
function setupComplet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  function creerFeuille(nom, entetes, couleur) {
    var s = ss.getSheetByName(nom);
    if (!s) {
      s = ss.insertSheet(nom);
      s.getRange(1,1,1,entetes.length).setValues([entetes]).setFontWeight('bold').setBackground(couleur).setFontColor('#FFFFFF');
      s.setFrozenRows(1);
    }
    return s;
  }
  creerFeuille('Clients',['ID','Date inscription','Prénom','Nom','Email','Téléphone','Type','Structure','Profil tarifaire','Statut','CGV','RI','Statuts','IP','Nb réservations','Dernière connexion'],'#1E4A6E');
  creerFeuille('Tokens',['Token','Email','Date création','Expiration','Utilisé'],'#2D3748');
  creerFeuille('Reservations',['id','prenom','nom','email','tel','orga','espace','nomEspace','usage','profil','date','typeDuree','nbHeures','heureDebut','heureFin','montant','montantBase','options','statut','participants','objet','createdAt','updatedAt','calendarEventId'],'#1E4A6E');
  creerFeuille('Adhesions',['ID','Statut','Date demande',"Type d'adhésion",'Montant (€)','Mode paiement','Prénom','Nom / Structure','Email','Téléphone','Adresse','Notes'],'#27AE60');
  creerFeuille('Logs',['Timestamp','Contexte','Erreur','Stack'],'#C0392B');
  var cfg = ss.getSheetByName('Config');
  if (!cfg) {
    cfg = ss.insertSheet('Config');
    var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    var pwd = '';
    for (var i = 0; i < 16; i++) pwd += charset.charAt(Math.floor(Math.random() * charset.length));
    var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd)
      .map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2);}).join('');
    cfg.getRange(1,1,2,2).setValues([['ADMIN_PASSWORD_HASH',hash],['CALENDAR_ID',CONFIG.CALENDAR_ID]]);
    Logger.log('🔑 MOT DE PASSE ADMIN : ' + pwd);
  }
  Logger.log('✅ Setup terminé — lancer setupDeclencheurs()');
  return 'OK';
}

function reinitMotDePasse() {
  var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  var pwd = '';
  for (var i = 0; i < 16; i++) pwd += charset.charAt(Math.floor(Math.random() * charset.length));
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd)
    .map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2);}).join('');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Config');
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'ADMIN_PASSWORD_HASH') { sheet.getRange(i+1,2).setValue(hash); break; }
    }
  }
  Logger.log('🔑 NOUVEAU MOT DE PASSE ADMIN : ' + pwd);
  return pwd;
}
