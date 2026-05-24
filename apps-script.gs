// ============================================================
// GÉNIE MONTAUBAN — Google Apps Script Unifié v4.2
// Réservations + Adhésions + Comptes clients + Admin
// + Monitoring & alertes automatiques
//
// INSTALLATION :
// 1. script.google.com → coller ce fichier dans Code.gs
// 2. Exécuter setupComplet() une seule fois pour créer les feuilles
//    → Le mot de passe admin généré s'affiche dans les Logs (Exécution)
// 3. Exécuter setupDeclencheurs() pour activer la surveillance automatique
// 4. Déployer → Nouvelle version → Application web
//    - Exécuter en tant que : Moi (genie.montauban@gmail.com)
//    - Accès : Tout le monde
// 5. Copier l'URL de déploiement dans les HTML (APPS_SCRIPT_URL)
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
  QUOTA_ALERTE_MIN:   20,   // alerter si moins de 20 emails restants dans la journée
  RESA_ATTENTE_MAX_H: 24,   // alerter si réservation EN_ATTENTE depuis plus de 24h
  ADH_ATTENTE_MAX_H:  48,   // alerter si adhésion EN_ATTENTE depuis plus de 48h
};

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
      case 'addResa':                 return ok(adminAddResa(data.resa));
      case 'updateResa':              return ok(adminUpdateResa(data.resa));
      case 'deleteResa':              return ok(adminDeleteResa(data.id));
      case 'saveConfig':              return ok(adminSaveConfig(data.config));
      case 'ADMIN_LOGIN':             return ok(adminLogin(data));
      case 'ADMIN_UPDATE_STATUS':     return ok(adminUpdateStatus(data));
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
    if (a === 'getAll' || a === 'ADMIN_GET_ALL') return ok(adminGetAll());

    if (e.parameter.payload) {
      var data = JSON.parse(e.parameter.payload);
      switch (data.action) {
        case 'RESERVER':            return ok(creerReservation(data));
        case 'INSCRIRE':            return ok(inscrireClient(data));
        case 'ADHERER':             return ok(creerAdhesion(data));
        case 'CONTACT':             return ok(traiterContact(data));
        case 'addResa':             return ok(adminAddResa(data.resa));
        case 'updateResa':          return ok(adminUpdateResa(data.resa));
        case 'deleteResa':          return ok(adminDeleteResa(data.id));
        case 'ADMIN_LOGIN':         return ok(adminLogin(data));
        case 'ADMIN_UPDATE_STATUS': return ok(adminUpdateStatus(data));
        case 'saveConfig':          return ok(adminSaveConfig(data.config));
        case 'GET_RESERVATIONS_CLIENT': return ok(getReservationsClient(data));
        case 'GET_PROFIL':          return ok(getProfil(data));
        default: return ok({ success: false, error: 'Action inconnue: ' + data.action });
      }
    }

    return ok({ success: true, message: 'API Génie Montauban v4.2' });
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
// EMAIL SÉCURISÉ — quota + try/catch + alerte sur échec
// Remplace tous les MailApp.sendEmail() directs
// ============================================================
function envoyerEmailSafe(destinataire, sujet, corps, options) {
  try {
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < 2) {
      // Quota critique : log uniquement, pas d'envoi
      Logger.log('⛔ QUOTA EPUISE — email non envoyé à ' + destinataire + ' — sujet : ' + sujet);
      return false;
    }
    if (quota <= CONFIG.QUOTA_ALERTE_MIN) {
      Logger.log('⚠️ Quota faible : ' + quota + ' emails restants aujourd\'hui');
    }
    if (options) {
      MailApp.sendEmail(destinataire, sujet, corps, options);
    } else {
      MailApp.sendEmail(destinataire, sujet, corps);
    }
    return true;
  } catch (err) {
    Logger.log('❌ Erreur envoi email à ' + destinataire + ' : ' + err.message);
    // Tentative d'alerte admin (une seule fois pour éviter boucle)
    try {
      if (destinataire !== CONFIG.EMAIL_ADMIN) {
        MailApp.sendEmail(CONFIG.EMAIL_ADMIN,
          '⚠️ Génie — Echec envoi email',
          'Email non délivré à : ' + destinataire + '\nSujet : ' + sujet + '\nErreur : ' + err.message);
      }
    } catch(e2) {
      Logger.log('❌ Impossible d\'alerter l\'admin : ' + e2.message);
    }
    return false;
  }
}

// ============================================================
// LOG D'ERREUR CENTRALISÉ
// ============================================================
function logErreur(contexte, err) {
  var msg = '[' + new Date().toISOString() + '] ERREUR dans ' + contexte + ' : ' + err.message;
  Logger.log(msg);
  // Tenter d'écrire dans la feuille Log si elle existe
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var logSheet = ss.getSheetByName('Logs');
    if (logSheet) {
      logSheet.appendRow([new Date().toISOString(), contexte, err.message, err.stack || '']);
    }
  } catch(e) { /* ne pas crasher dans le handler d'erreur */ }
}

// ============================================================
// INSCRIPTION CLIENT
// ============================================================
function inscrireClient(data) {
  if (!data.email || !data.prenom || !data.nom)
    return { success: false, error: 'CHAMPS_MANQUANTS', message: 'Prénom, nom et email sont obligatoires.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
    return { success: false, error: 'EMAIL_INVALIDE', message: 'Format email invalide.' };

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
    sheet.appendRow([id, now, data.prenom, data.nom, data.email.toLowerCase(),
      data.tel || '', data.type || 'particulier', data.structure || '',
      profil, 'ACTIF', data.cgv ? now : '', data.ri ? now : '', data.statuts ? now : '',
      data.ip || '', 0, now]);

    envoyerEmailSafe(data.email,
      '🎉 Bienvenue chez Génie Montauban !',
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
// LIEN MAGIQUE
// ============================================================
function demanderLienMagique(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rows = ss.getSheetByName('Clients').getDataRange().getValues();
    let prenom = '';
    let found = false;
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
    envoyerEmailSafe(data.email,
      '🔑 Votre lien de connexion — Génie Montauban',
      'Bonjour ' + prenom + ',\n\nVoici votre lien de connexion (valable 1h) :\n' + lien +
      '\n\nSi vous n\'avez pas fait cette demande, ignorez cet email.\n\n' + CONFIG.NOM_LIEU);

    return { success: true, message: 'Lien envoyé.' };
  } catch (err) {
    logErreur('demanderLienMagique', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// VALIDER TOKEN
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
// PROFIL CLIENT
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
// RÉSERVATION (formulaire public)
// ============================================================
function creerReservation(data) {
  if (!data.espace || !data.date || !data.heureDebut || !data.prenom || !data.nom || !data.email)
    return { success: false, error: 'CHAMPS_MANQUANTS' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date))
    return { success: false, error: 'DATE_INVALIDE' };
  if (!/^\d{1,2}:\d{2}$/.test(data.heureDebut))
    return { success: false, error: 'HEURE_INVALIDE' };
  if (!data.duree || isNaN(parseFloat(data.duree)) || parseFloat(data.duree) <= 0)
    return { success: false, error: 'DUREE_INVALIDE' };

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Reservations');
    if (!sheet) {
      sheet = ss.insertSheet('Reservations');
      sheet.appendRow(['ID','Statut','Date création','Espace','Usage','Profil','Date','H.début','H.fin','Durée','Participants','Prénom','Nom','Email','Tél','Organisation','Montant','Objet','Options']);
    }
    const id = 'RES-' + Date.now();
    const now = new Date();
    const hFin = heuresFin(data.heureDebut, data.duree);
    sheet.appendRow([id, 'EN_ATTENTE', now.toISOString(),
      data.espace, data.typeEspace || '', data.profil || 'plein',
      data.date, data.heureDebut, hFin, data.duree,
      data.participants || 1, data.prenom, data.nom, data.email,
      data.tel || '', data.structure || '', data.montantEstime || 0, data.message || '',
      data.options || '']);

    // Incrémenter nb réservations client
    try {
      const cRows = ss.getSheetByName('Clients').getDataRange().getValues();
      for (let i = 1; i < cRows.length; i++) {
        if (cRows[i][4] && cRows[i][4].toString().toLowerCase() === data.email.toLowerCase()) {
          ss.getSheetByName('Clients').getRange(i + 1, 15).setValue((parseInt(cRows[i][14]) || 0) + 1);
          break;
        }
      }
    } catch(e) { Logger.log('Avertissement maj nb réservations : ' + e.message); }

    // Email confirmation client
    const corps = 'Bonjour ' + data.prenom + ',\n\nVotre demande de réservation est enregistrée.\n\n'
      + '📋 Référence : ' + id + '\n'
      + '📍 Espace : ' + data.espace + '\n'
      + '📅 Date : ' + formaterDate(data.date) + '\n'
      + '⏰ Horaire : ' + data.heureDebut + ' → ' + hFin + ' (' + data.duree + 'h)\n'
      + '👥 Participants : ' + (data.participants || 1) + '\n'
      + '💰 Estimation : ' + (data.montantEstime || '?') + ' €\n\n'
      + 'L\'équipe confirme sous 24h ouvrées.\n📞 ' + CONFIG.TEL + '\n\n'
      + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE;

    envoyerEmailSafe(data.email, '⏳ Demande reçue — ' + data.espace + ' le ' + formaterDate(data.date), corps);
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '🔔 Réservation ' + id + ' — ' + data.espace + ' — ' + data.prenom + ' ' + data.nom,
      'ID : ' + id + '\nEspace : ' + data.espace + '\nDate : ' + data.date +
      ' ' + data.heureDebut + '→' + hFin +
      '\nClient : ' + data.prenom + ' ' + data.nom +
      '\nEmail : ' + data.email +
      '\nMontant : ' + (data.montantEstime || '?') + ' €\n\n' +
      '👉 Confirmer dans l\'admin : ' + CONFIG.URL_SITE + '/admin.html');

    ajouterAuCalendrier(data.espace, data.date, data.heureDebut, hFin,
      data.prenom + ' ' + data.nom, id, data.email, false);

    return { success: true, id: id };
  } catch (err) {
    logErreur('creerReservation', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
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
      if (rows[i][13] && rows[i][13].toString().toLowerCase() === data.email.toLowerCase()) {
        list.push({ id: rows[i][0], statut: rows[i][1], espace: rows[i][3],
                    date: rows[i][6], heureDebut: rows[i][7], heureFin: rows[i][8],
                    duree: rows[i][9], montant: rows[i][16] });
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
      if (row[1] === 'ANNULE') continue;
      const esp = String(row[3] || '');
      const dat = String(row[6] || '');
      if (espace && esp !== espace) continue;
      if (dat < dateDebut || dat > dateFin) continue;
      const hD = String(row[7] || '08:00');
      const hF = String(row[8] || '09:00');
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
// ADHÉSION
// ============================================================
function creerAdhesion(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Adhesions');
    if (!sheet) {
      sheet = ss.insertSheet('Adhesions');
      sheet.appendRow(['ID','Statut','Date','Type','Montant','Paiement','Prénom','Nom','Email','Tél','Adresse','Notes']);
    }
    const id = 'ADH-' + Date.now();
    sheet.appendRow([id, 'EN_ATTENTE', new Date().toISOString(),
      data.typeAdhesion, data.montant, data.modePaiement || '',
      data.prenom, data.nom, data.email, data.tel || '', data.adresse || '', '']);

    envoyerEmailSafe(data.email,
      '✅ Demande d\'adhésion reçue — ' + CONFIG.NOM_LIEU,
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
// CONTACT
// ============================================================
function traiterContact(data) {
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
// ============================================================
function adminGetAll() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let resSheet = ss.getSheetByName('Reservations');
    if (!resSheet) {
      resSheet = ss.insertSheet('Reservations');
      resSheet.appendRow(['ID','Statut','Date création','Espace','Usage','Profil','Date','H.début','H.fin','Durée','Participants','Prénom','Nom','Email','Tél','Organisation','Montant','Objet','Options']);
    }
    const resRows = resSheet.getDataRange().getValues();
    const statutMap = { 'EN_ATTENTE': 'pending', 'CONFIRME': 'confirmed', 'ANNULE': 'cancelled', 'TERMINE': 'completed' };

    const reservations = resRows.slice(1).map(function(r) {
      const dureeH = parseFloat(r[9]) || 1;
      var typeDuree = 'heure';
      var nbHeures = dureeH;
      if (dureeH >= 7)      { typeDuree = 'journee'; nbHeures = 8; }
      else if (dureeH >= 3) { typeDuree = 'demi';    nbHeures = 4; }

      const rawEspace = String(r[3] || '');
      const espaceKey = rawEspace
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim()
        .split(/\s+/).pop() || '';

      return {
        id:          String(r[0]),
        statut:      statutMap[r[1]] || 'pending',
        createdAt:   String(r[2]),
        espace:      espaceKey,
        nomEspace:   rawEspace,
        usage:       String(r[4]) || 'reunion',
        profil:      String(r[5]) || 'locataire',
        date:        String(r[6]),
        heureDebut:  String(r[7]),
        heureFin:    String(r[8]),
        nbHeures:    String(nbHeures),
        typeDuree:   typeDuree,
        participants:String(r[10] || 1),
        prenom:      String(r[11]),
        nom:         String(r[12]),
        email:       String(r[13]),
        tel:         String(r[14]),
        orga:        String(r[15]),
        montant:     String(r[16] || 0),
        montantBase: String(r[16] || 0),
        objet:       String(r[17]),
        options:     String(r[18] || '')
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
// ============================================================
function adminAddResa(resa) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    const statutMap = { 'pending': 'EN_ATTENTE', 'confirmed': 'CONFIRME', 'cancelled': 'ANNULE', 'completed': 'TERMINE' };
    const dureeH = resa.typeDuree === 'demi' ? 4 : resa.typeDuree === 'journee' ? 8 : parseFloat(resa.nbHeures) || 1;
    sheet.appendRow([
      resa.id || ('RES-' + Date.now()),
      statutMap[resa.statut] || 'EN_ATTENTE',
      resa.createdAt || new Date().toISOString(),
      resa.nomEspace || resa.espace, resa.usage || 'reunion', resa.profil || 'locataire',
      resa.date, resa.heureDebut, resa.heureFin, dureeH,
      resa.participants || 1, resa.prenom, resa.nom, resa.email,
      resa.tel || '', resa.orga || '', resa.montant || 0, resa.objet || '', resa.options || ''
    ]);
    return { success: true };
  } catch (err) {
    logErreur('adminAddResa', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — UPDATE RESA
// ============================================================
function adminUpdateResa(resa) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    const rows = sheet.getDataRange().getValues();
    const statutMap = { 'pending': 'EN_ATTENTE', 'confirmed': 'CONFIRME', 'cancelled': 'ANNULE', 'completed': 'TERMINE' };
    const dureeH = resa.typeDuree === 'demi' ? 4 : resa.typeDuree === 'journee' ? 8 : parseFloat(resa.nbHeures) || 1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(resa.id)) {
        const newStatut = statutMap[resa.statut] || 'EN_ATTENTE';
        sheet.getRange(i + 1, 1, 1, 19).setValues([[
          resa.id, newStatut, rows[i][2],
          resa.nomEspace || resa.espace, resa.usage || 'reunion', resa.profil || 'locataire',
          resa.date, resa.heureDebut, resa.heureFin, dureeH,
          resa.participants || 1, resa.prenom, resa.nom, resa.email,
          resa.tel || '', resa.orga || '', resa.montant || 0, resa.objet || '', resa.options || ''
        ]]);
        if (newStatut === 'CONFIRME') {
          envoyerEmailSafe(resa.email,
            '✅ Réservation confirmée — ' + (resa.nomEspace || resa.espace) + ' — ' + resa.date,
            'Bonjour ' + resa.prenom + ',\n\nVotre réservation est confirmée !\n\n' +
            '• Espace : ' + (resa.nomEspace || resa.espace) + '\n' +
            '• Date : ' + formaterDate(resa.date) + '\n' +
            '• Horaire : ' + resa.heureDebut + ' → ' + resa.heureFin + '\n' +
            '• Référence : ' + resa.id + '\n\nÀ bientôt !\n' + CONFIG.NOM_LIEU);
          ajouterAuCalendrier(resa.nomEspace || resa.espace, resa.date, resa.heureDebut, resa.heureFin,
            resa.prenom + ' ' + resa.nom, resa.id, resa.email, true);
        }
        return { success: true };
      }
    }
    return { success: false, error: 'ID non trouvé' };
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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        sheet.getRange(i + 1, 2).setValue('ANNULE');
        return { success: true };
      }
    }
    return { success: false, error: 'ID non trouvé' };
  } catch (err) {
    logErreur('adminDeleteResa', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// ADMIN — SAVE CONFIG
// ============================================================
function adminSaveConfig(config) {
  if (!config) return { success: false, error: 'Config manquante' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Config');
    if (!sheet) return { success: false, error: 'Feuille Config absente' };
    const rows = sheet.getDataRange().getValues();
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
// ADMIN — LOGIN
// ============================================================
function adminLogin(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const config = ss.getSheetByName('Config');
    if (!config) return { success: false };
    const rows = config.getDataRange().getValues();
    const hashRow = rows.find(function(r) { return r[0] === 'ADMIN_PASSWORD_HASH'; });
    if (!hashRow) return { success: false };
    const inputHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.password)
      .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
    return inputHash === hashRow[1]
      ? { success: true, token: inputHash.substring(0, 16) }
      : { success: false };
  } catch (err) {
    logErreur('adminLogin', err);
    return { success: false, error: 'ERREUR_SERVEUR' };
  }
}

// ============================================================
// ADMIN — UPDATE STATUS (v3)
// ============================================================
function adminUpdateStatus(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetName = data.type === 'reservation' ? 'Reservations' : 'Adhesions';
    const sheet = ss.getSheetByName(sheetName);
    const rows = sheet.getDataRange().getValues();
    const couleurs = {
      'CONFIRME':   { bg: '#D4EDDA', fg: '#155724' },
      'EN_ATTENTE': { bg: '#FFF3CD', fg: '#856404' },
      'ANNULE':     { bg: '#F8D7DA', fg: '#721C24' },
      'TERMINE':    { bg: '#E2E3E5', fg: '#383D41' }
    };
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 2).setValue(data.statut);
        const c = couleurs[data.statut] || { bg: '#fff', fg: '#000' };
        sheet.getRange(i + 1, 2).setBackground(c.bg).setFontColor(c.fg);
        if (data.statut === 'CONFIRME' && data.type === 'reservation') {
          const row = rows[i];
          envoyerEmailSafe(row[13],
            '✅ Réservation confirmée — ' + row[3] + ' — ' + row[6],
            'Bonjour ' + row[11] + ',\n\nVotre réservation est confirmée !\n\n' +
            '• Espace : ' + row[3] + '\n• Date : ' + row[6] + '\n' +
            '• Horaire : ' + row[7] + ' → ' + row[8] + '\n• Référence : ' + row[0] + '\n\n' +
            (data.messageAdmin || '') + '\n\nÀ bientôt !\n' + CONFIG.NOM_LIEU);
          ajouterAuCalendrier(row[3], row[6], row[7], row[8], row[11] + ' ' + row[12], row[0], row[13], true);
        }
        return { success: true };
      }
    }
    return { success: false, error: 'ID non trouvé' };
  } catch (err) {
    logErreur('adminUpdateStatus', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

// ============================================================
// GOOGLE AGENDA
// ============================================================
function ajouterAuCalendrier(espace, date, heureDebut, heureFin, client, ref, email, confirme) {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!cal) return;
    const debut = new Date(date + 'T' + heureDebut + ':00');
    const fin   = new Date(date + 'T' + heureFin   + ':00');
    if (isNaN(debut.getTime()) || isNaN(fin.getTime())) return;
    const titre = (confirme ? '✅ ' : '⏳ ') + espace + ' — ' + client;
    cal.createEvent(titre, debut, fin, {
      description: 'Référence : ' + ref + '\nEmail : ' + email,
      location: CONFIG.ADRESSE
    });
  } catch (err) {
    Logger.log('Calendrier erreur : ' + err.message);
  }
}

// ============================================================
// HELPERS
// ============================================================
function pad(n) { return String(n).padStart(2, '0'); }

function formaterDate(s) {
  if (!s) return '';
  const p = s.split('-');
  const mois = ['janvier','février','mars','avril','mai','juin',
                 'juillet','août','septembre','octobre','novembre','décembre'];
  return parseInt(p[2]) + ' ' + mois[parseInt(p[1]) - 1] + ' ' + p[0];
}

function heuresFin(debut, duree) {
  const p = String(debut || '08:00').split(':');
  const total = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0) + Math.round(parseFloat(duree) * 60);
  return pad(Math.floor(total / 60) % 24) + ':' + pad(total % 60);
}

function lireConfig(ss) {
  try {
    const rows = ss.getSheetByName('Config').getDataRange().getValues();
    const cfg = { email: CONFIG.EMAIL_ADMIN, tel: CONFIG.TEL };
    rows.forEach(function(r) {
      if (r[0] === 'EMAIL_CONTACT') cfg.email = r[1];
      if (r[0] === 'TEL_CONTACT')   cfg.tel   = r[1];
    });
    return cfg;
  } catch(e) {
    return { email: CONFIG.EMAIL_ADMIN, tel: CONFIG.TEL };
  }
}

// ============================================================
// MONITORING — BILAN SANTÉ QUOTIDIEN
// Déclencher : chaque jour à 08h00
// ============================================================
function checkSante() {
  var lignes = [];
  var alertes = [];
  var now = new Date();

  try {
    // 1. Quota email
    var quota = MailApp.getRemainingDailyQuota();
    lignes.push('📧 Quota email restant : ' + quota + '/jour');
    if (quota < CONFIG.QUOTA_ALERTE_MIN) {
      alertes.push('⚠️ QUOTA CRITIQUE : seulement ' + quota + ' emails restants !');
    }

    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // 2. Réservations EN_ATTENTE depuis trop longtemps
    var resSheet = ss.getSheetByName('Reservations');
    if (resSheet) {
      var resRows = resSheet.getDataRange().getValues();
      var resBloquees = [];
      for (var i = 1; i < resRows.length; i++) {
        if (resRows[i][1] === 'EN_ATTENTE') {
          var createdAt = new Date(resRows[i][2]);
          var heuresEcoulees = (now - createdAt) / 3600000;
          if (heuresEcoulees > CONFIG.RESA_ATTENTE_MAX_H) {
            resBloquees.push(resRows[i][0] + ' — ' + resRows[i][11] + ' ' + resRows[i][12] +
              ' (' + Math.round(heuresEcoulees) + 'h en attente)');
          }
        }
      }
      lignes.push('📋 Réservations EN_ATTENTE > ' + CONFIG.RESA_ATTENTE_MAX_H + 'h : ' + resBloquees.length);
      if (resBloquees.length > 0) {
        alertes.push('🔔 ' + resBloquees.length + ' réservation(s) sans réponse depuis +' +
          CONFIG.RESA_ATTENTE_MAX_H + 'h :\n  - ' + resBloquees.join('\n  - '));
      }
    }

    // 3. Adhésions EN_ATTENTE
    var adhSheet = ss.getSheetByName('Adhesions');
    if (adhSheet) {
      var adhRows = adhSheet.getDataRange().getValues();
      var adhBloquees = [];
      for (var j = 1; j < adhRows.length; j++) {
        if (adhRows[j][1] === 'EN_ATTENTE') {
          var createdAdh = new Date(adhRows[j][2]);
          var heuresAdh = (now - createdAdh) / 3600000;
          if (heuresAdh > CONFIG.ADH_ATTENTE_MAX_H) {
            adhBloquees.push(adhRows[j][0] + ' — ' + adhRows[j][6] + ' ' + adhRows[j][7] +
              ' (' + Math.round(heuresAdh) + 'h en attente)');
          }
        }
      }
      lignes.push('🤝 Adhésions EN_ATTENTE > ' + CONFIG.ADH_ATTENTE_MAX_H + 'h : ' + adhBloquees.length);
      if (adhBloquees.length > 0) {
        alertes.push('🔔 ' + adhBloquees.length + ' adhésion(s) sans réponse depuis +' +
          CONFIG.ADH_ATTENTE_MAX_H + 'h :\n  - ' + adhBloquees.join('\n  - '));
      }
    }

    // 4. Tokens actifs
    var tokenSheet = ss.getSheetByName('Tokens');
    if (tokenSheet) {
      var tokenRows = tokenSheet.getDataRange().getValues();
      var tokensTotal = Math.max(0, tokenRows.length - 1);
      var tokensExpires = 0;
      for (var k = 1; k < tokenRows.length; k++) {
        if (new Date(tokenRows[k][3]) < now) tokensExpires++;
      }
      lignes.push('🔑 Tokens : ' + tokensTotal + ' total, ' + tokensExpires + ' expirés (nettoyage hebdo)');
    }

    // 5. Clients
    var clientSheet = ss.getSheetByName('Clients');
    if (clientSheet) {
      var nbClients = Math.max(0, clientSheet.getLastRow() - 1);
      lignes.push('👥 Clients enregistrés : ' + nbClients);
    }

    // Envoi du rapport
    var sujet = alertes.length > 0
      ? '🚨 Génie — ' + alertes.length + ' alerte(s) système'
      : '✅ Génie — Bilan quotidien OK';

    var corps = '=== BILAN SANTÉ GÉNIE MONTAUBAN — ' + now.toLocaleDateString('fr-FR') + ' ===\n\n';
    corps += lignes.join('\n') + '\n\n';

    if (alertes.length > 0) {
      corps += '=== ALERTES À TRAITER ===\n\n' + alertes.join('\n\n') + '\n\n';
      corps += '👉 Admin : ' + CONFIG.URL_SITE + '/admin.html\n';
    } else {
      corps += '✅ Tout fonctionne normalement.\n';
    }

    corps += '\n---\nRapport automatique — Génie Montauban v4.2';
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN, sujet, corps);

  } catch (err) {
    Logger.log('❌ checkSante ERREUR : ' + err.message);
    try {
      MailApp.sendEmail(CONFIG.EMAIL_ADMIN,
        '❌ Génie — Erreur critique bilan santé',
        'Le bilan santé automatique a échoué :\n' + err.message + '\n' + (err.stack || ''));
    } catch(e2) { Logger.log('Impossible d\'envoyer l\'alerte : ' + e2.message); }
  }
}

// ============================================================
// MONITORING — NETTOYAGE DES TOKENS EXPIRÉS
// Déclencher : chaque semaine (lundi matin)
// ============================================================
function nettoyerTokens() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Tokens');
    if (!sheet) return;
    var rows = sheet.getDataRange().getValues();
    var now = new Date();
    var supprimees = 0;
    // Parcours à l'envers pour supprimer sans décalage d'index
    for (var i = rows.length - 1; i >= 1; i--) {
      var expire = new Date(rows[i][3]);
      var utilise = rows[i][4] === true;
      if (expire < now || utilise) {
        sheet.deleteRow(i + 1);
        supprimees++;
      }
    }
    Logger.log('🧹 Nettoyage tokens : ' + supprimees + ' supprimés, ' +
      Math.max(0, rows.length - 1 - supprimees) + ' conservés.');
  } catch (err) {
    logErreur('nettoyerTokens', err);
  }
}

// ============================================================
// MONITORING — ALERTE RÉSERVATIONS BLOQUÉES
// Déclencher : toutes les 6h en semaine
// ============================================================
function alerterResasBloquees() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservations');
    if (!sheet) return;
    var rows = sheet.getDataRange().getValues();
    var now = new Date();
    var bloquees = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] === 'EN_ATTENTE') {
        var created = new Date(rows[i][2]);
        var h = (now - created) / 3600000;
        if (h > CONFIG.RESA_ATTENTE_MAX_H) {
          bloquees.push({
            id: rows[i][0],
            client: rows[i][11] + ' ' + rows[i][12],
            email: rows[i][13],
            espace: rows[i][3],
            date: rows[i][6],
            heures: Math.round(h)
          });
        }
      }
    }
    if (bloquees.length === 0) return;

    var corps = '🔔 ' + bloquees.length + ' réservation(s) EN_ATTENTE depuis plus de ' +
      CONFIG.RESA_ATTENTE_MAX_H + 'h :\n\n';
    bloquees.forEach(function(r) {
      corps += '• ' + r.id + ' — ' + r.client + ' — ' + r.espace + ' le ' + r.date +
        ' (' + r.heures + 'h en attente)\n';
    });
    corps += '\n👉 Traiter maintenant : ' + CONFIG.URL_SITE + '/admin.html';

    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '⏰ Génie — ' + bloquees.length + ' réservation(s) à confirmer',
      corps);
  } catch (err) {
    logErreur('alerterResasBloquees', err);
  }
}

// ============================================================
// TEST SYSTÈME — à exécuter manuellement pour vérifier tout
// ============================================================
function testSysteme() {
  Logger.log('=== TEST SYSTÈME GÉNIE v4.2 ===');
  try {
    // Test 1 : accès au spreadsheet
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var feuilles = ss.getSheets().map(function(s) { return s.getName(); });
    Logger.log('✅ Spreadsheet OK — Feuilles : ' + feuilles.join(', '));

    // Test 2 : quota email
    var quota = MailApp.getRemainingDailyQuota();
    Logger.log('✅ Quota email : ' + quota + ' emails restants aujourd\'hui');

    // Test 3 : accès agenda
    var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    Logger.log(cal ? '✅ Agenda OK : ' + cal.getName() : '⚠️ Agenda introuvable avec ID : ' + CONFIG.CALENDAR_ID);

    // Test 4 : vérifier feuilles obligatoires
    var feillesRequises = ['Clients', 'Tokens', 'Reservations', 'Adhesions', 'Config'];
    feillesRequises.forEach(function(nom) {
      var s = ss.getSheetByName(nom);
      if (s) {
        Logger.log('✅ Feuille "' + nom + '" OK (' + Math.max(0, s.getLastRow() - 1) + ' lignes)');
      } else {
        Logger.log('❌ Feuille "' + nom + '" MANQUANTE — lancer setupComplet()');
      }
    });

    // Test 5 : vérifier hash admin
    var cfg = ss.getSheetByName('Config');
    if (cfg) {
      var rows = cfg.getDataRange().getValues();
      var hashRow = rows.find(function(r) { return r[0] === 'ADMIN_PASSWORD_HASH'; });
      Logger.log(hashRow ? '✅ Hash admin configuré' : '❌ Hash admin MANQUANT — lancer setupComplet()');
    }

    Logger.log('=== FIN TEST SYSTÈME ===');
    Logger.log('ℹ️ Si tout est ✅ : lancer setupDeclencheurs() pour activer la surveillance automatique');
  } catch (err) {
    Logger.log('❌ ERREUR SYSTÈME : ' + err.message + '\n' + (err.stack || ''));
  }
}

// ============================================================
// CONFIGURATION DES DÉCLENCHEURS AUTOMATIQUES
// À exécuter UNE SEULE FOIS depuis l'éditeur Apps Script
// ============================================================
function setupDeclencheurs() {
  // Supprimer les anciens déclencheurs pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Bilan santé quotidien à 8h00
  ScriptApp.newTrigger('checkSante')
    .timeBased().everyDays(1).atHour(8).create();

  // Alerte réservations bloquées toutes les 6h (08h, 14h, 20h)
  ScriptApp.newTrigger('alerterResasBloquees')
    .timeBased().everyHours(6).create();

  // Nettoyage tokens hebdomadaire (lundi matin)
  ScriptApp.newTrigger('nettoyerTokens')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();

  Logger.log('✅ Déclencheurs configurés :');
  Logger.log('  - checkSante : tous les jours à 8h');
  Logger.log('  - alerterResasBloquees : toutes les 6h');
  Logger.log('  - nettoyerTokens : tous les lundis à 7h');
  Logger.log('Total : ' + ScriptApp.getProjectTriggers().length + ' déclencheur(s) actif(s)');
}

// ============================================================
// DIAGNOSTIC TEST ADHÉSION — à exécuter manuellement
// ============================================================
function testAdhesion() {
  try {
    const result = creerAdhesion({
      action: 'ADHERER',
      typeAdhesion: 'TEST – Sympathisant',
      montant: '10',
      modePaiement: 'Test',
      prenom: 'Test',
      nom: 'Diagnostic',
      email: CONFIG.EMAIL_ADMIN,
      tel: '',
      adresse: ''
    });
    Logger.log('✅ testAdhesion réussi : ' + JSON.stringify(result));
  } catch(e) {
    Logger.log('❌ testAdhesion ERREUR : ' + e.message + '\n' + e.stack);
  }
}

// ============================================================
// SETUP COMPLET (à exécuter une seule fois)
// ============================================================
function setupComplet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  function creerFeuille(nom, entetes, couleur) {
    var s = ss.getSheetByName(nom);
    if (!s) {
      s = ss.insertSheet(nom);
      s.getRange(1, 1, 1, entetes.length).setValues([entetes])
       .setFontWeight('bold').setBackground(couleur).setFontColor('#FFFFFF');
      s.setFrozenRows(1);
    }
    return s;
  }

  creerFeuille('Clients',
    ['ID','Date inscription','Prénom','Nom','Email','Téléphone','Type','Structure',
     'Profil tarifaire','Statut','CGV','RI','Statuts','IP','Nb réservations','Dernière connexion'],
    '#1E4A6E');
  creerFeuille('Tokens', ['Token','Email','Date création','Expiration','Utilisé'], '#2D3748');
  creerFeuille('Reservations',
    ['ID','Statut','Date création','Espace','Type espace','Profil tarifaire',
     'Date réservation','Heure début','Heure fin','Durée (h)','Participants',
     'Prénom','Nom','Email','Téléphone','Structure','Montant (€)','Message','Options'],
    '#1E4A6E');
  creerFeuille('Adhesions',
    ['ID','Statut','Date demande',"Type d'adhésion",'Montant (€)','Mode paiement',
     'Prénom','Nom / Structure','Email','Téléphone','Adresse','Notes'],
    '#27AE60');
  creerFeuille('Logs',
    ['Timestamp','Contexte','Erreur','Stack'],
    '#C0392B');

  // Feuille Config — mot de passe admin aléatoire
  var cfg = ss.getSheetByName('Config');
  if (!cfg) {
    cfg = ss.insertSheet('Config');
    var scriptProps = PropertiesService.getScriptProperties();
    var pwdHash = scriptProps.getProperty('ADMIN_PASSWORD_HASH');
    var plainPwd = null;
    if (!pwdHash) {
      var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
      var generated = '';
      for (var i = 0; i < 16; i++) {
        generated += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      plainPwd = generated;
      pwdHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plainPwd)
        .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
      scriptProps.setProperty('ADMIN_PASSWORD_HASH', pwdHash);
    }
    cfg.getRange(1, 1, 2, 2).setValues([
      ['ADMIN_PASSWORD_HASH', pwdHash],
      ['CALENDAR_ID', CONFIG.CALENDAR_ID]
    ]);
    if (plainPwd) {
      Logger.log('🔑 MOT DE PASSE ADMIN (noter maintenant) : ' + plainPwd);
    }
  }
  Logger.log('✅ Setup terminé — lancer setupDeclencheurs() pour activer la surveillance');
  return 'OK';
}

// ============================================================
// RESET MOT DE PASSE ADMIN
// ============================================================
function reinitMotDePasse() {
  var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  var pwd = '';
  for (var i = 0; i < 16; i++) {
    pwd += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd)
    .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Config');
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'ADMIN_PASSWORD_HASH') {
        sheet.getRange(i + 1, 2).setValue(hash);
        Logger.log('🔑 NOUVEAU MOT DE PASSE ADMIN : ' + pwd);
        Logger.log('✅ Hash mis à jour dans Config et Script Properties');
        return pwd;
      }
    }
    sheet.appendRow(['ADMIN_PASSWORD_HASH', hash]);
  }
  Logger.log('🔑 NOUVEAU MOT DE PASSE ADMIN : ' + pwd);
  return pwd;
}
