/**
 * Google Apps Script — Génie Montauban
 *
 * INSTALLATION :
 * 1. Ouvrir https://script.google.com
 * 2. Créer un nouveau projet, coller ce code
 * 3. Déployer → Nouvelle version → Application web
 *    - Exécuter en tant que : Moi (genie.montauban@gmail.com)
 *    - Accès : Tout le monde
 * 4. Copier l'URL de déploiement dans chaque fichier HTML (APPS_SCRIPT_URL)
 * 5. Dans Paramètres du projet → Propriétés de script, définir :
 *    - API_SHARED_KEY  : jeton secret (même valeur dans les HTML)
 */

// ─── CONFIGURATION ───────────────────────────────────────────────
const EMAIL_ADMIN    = 'genie.montauban@gmail.com';
const SPREADSHEET_ID = '1mf3D2YGnpWpzufGOaLLaomxAkuzp0AiJY7RzcbpIq2w';
const CALENDAR_ID    = 'genie.montauban@gmail.com';

// ─── POINT D'ENTRÉE HTTP GET ──────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';

  // Confirmer / Refuser depuis lien email : pas besoin de token (URL secrète suffit)
  if (action === 'CONFIRMER_RESA') return htmlConfirmer(e);
  if (action === 'REFUSER_RESA')   return htmlRefuser(e);

  // Vérification token pour les autres actions
  const token = (e.parameter && e.parameter.token) || '';
  if (!verifierToken(token)) return repondreJSON({ ok: false, erreur: 'Accès non autorisé' });

  try {
    if (action === 'GET_RESERVATIONS') return repondreJSON(getReservations(e));
    if (action === 'getAll')           return repondreJSON(getAllAdmin());
    return repondreJSON({ ok: true, message: 'API Génie Montauban opérationnelle' });
  } catch(err) {
    return repondreJSON({ ok: false, erreur: err.toString() });
  }
}

// ─── POINT D'ENTRÉE HTTP POST ─────────────────────────────────────
function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch(_) { data = {}; }

  const action = data.action || '';
  const token  = (data && data.token) || (e.parameter && e.parameter.token) || '';

  if (!verifierToken(token)) return repondre({ ok: false, erreur: 'Accès non autorisé' });

  try {
    if (action === 'RESERVER') {
      if (!validerReservationPayload(data)) return repondre({ ok: false, erreur: 'Données invalides ou incomplètes' });
      return repondre(traiterReservation(data));
    }
    if (action === 'ADHERER')    return repondre(traiterAdhesion(data));
    if (action === 'CONTACT')    return repondre(traiterContact(data));
    if (action === 'addResa')    return repondre(adminAddResa(data.resa));
    if (action === 'updateResa') return repondre(adminUpdateResa(data.resa));
    if (action === 'deleteResa') return repondre(adminDeleteResa(data.id));
    return repondre({ ok: false, erreur: 'Action inconnue : ' + action });
  } catch(err) {
    return repondre({ ok: false, erreur: err.toString() });
  }
}

// ─── VÉRIFICATION TOKEN ───────────────────────────────────────────
function verifierToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_SHARED_KEY');
  return expected && token === expected;
}

// ─── RÉSERVATION (formulaire public) ────────────────────────────
function validerReservationPayload(d) {
  if (!d) return false;
  const reqStr = ['espace','profil','date','heureDebut','prenom','nom','email'];
  for (var i = 0; i < reqStr.length; i++) {
    if (!d[reqStr[i]] || typeof d[reqStr[i]] !== 'string') return false;
  }
  if (!d.duree || isNaN(Number(d.duree)) || Number(d.duree) <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return false;
  if (!/^\d{1,2}(:\d{2})?$/.test(d.heureDebut)) return false;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return false;
  return true;
}

function traiterReservation(d) {
  const ref = 'RES-' + Date.now();

  // 1. Enregistrer dans Google Sheets (statut : En attente)
  const sheet = getOrCreateSheet('Réservations');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Référence','Date réservation','Espace','Profil','Date','Heure','Durée (h)',
      'Participants','Prénom','Nom','Email','Téléphone','Structure',
      'Message','Montant estimé','Badge 24h','Adhésion','Statut','HeureFin'
    ]);
  }
  const heureFin = heuresFin(d.heureDebut, d.duree);
  sheet.appendRow([
    ref,
    new Date().toLocaleString('fr-FR'),
    d.espace, d.profil, d.date, d.heureDebut, d.duree,
    d.participants, d.prenom, d.nom, d.email, d.tel, d.structure,
    d.message, d.montantEstime,
    d.optionBadge    ? 'Oui' : 'Non',
    d.optionAdhesion ? 'Oui' : 'Non',
    'En attente',
    heureFin
  ]);

  // 2. Email de réception au client (demande reçue, pas encore confirmée)
  const corpsClient = `Bonjour ${d.prenom},

Votre demande de réservation a bien été reçue et est en cours de traitement.

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Référence    : ${ref}
📍 Espace       : ${d.espace}
📅 Date         : ${formaterDate(d.date)}
⏰ Horaire      : ${d.heureDebut} → ${heureFin} (${d.duree}h)
👥 Participants : ${d.participants || 1}
💰 Tarif estimé : ${d.montantEstime} €
━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ Votre réservation sera confirmée sous 24h par notre équipe.

📞 06 51 50 97 18
✉️ ${EMAIL_ADMIN}
📍 12 rue du Génie, 82000 Montauban

À bientôt !
L'équipe Génie Montauban`;

  GmailApp.sendEmail(d.email,
    `⏳ Demande reçue — ${d.espace} le ${formaterDate(d.date)} [${ref}]`,
    corpsClient, { name: 'Génie Montauban', replyTo: EMAIL_ADMIN }
  );

  // 3. Email à l'admin avec liens Confirmer / Refuser
  const scriptUrl = ScriptApp.getService().getUrl();
  const lienOui = `${scriptUrl}?action=CONFIRMER_RESA&ref=${encodeURIComponent(ref)}`;
  const lienNon = `${scriptUrl}?action=REFUSER_RESA&ref=${encodeURIComponent(ref)}`;

  const corpsAdmin = `Nouvelle demande de réservation — validation requise.

━━━━━━━━━━━━━━━━━━━━━━━━━━
Référence    : ${ref}
Espace       : ${d.espace}
Date         : ${formaterDate(d.date)} — ${d.heureDebut} → ${heureFin} (${d.duree}h)
Profil       : ${d.profil}
Participants : ${d.participants || 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Contact :
  ${d.prenom} ${d.nom}
  ${d.email}
  ${d.tel || 'Non renseigné'}
  ${d.structure || ''}
Message : ${d.message || 'Aucun'}
Montant estimé : ${d.montantEstime} €
Badge 24h : ${d.optionBadge ? 'Oui' : 'Non'}
Adhésion  : ${d.optionAdhesion ? 'Oui' : 'Non'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CONFIRMER la réservation :
${lienOui}

❌ REFUSER la réservation :
${lienNon}`;

  GmailApp.sendEmail(EMAIL_ADMIN,
    `🔔 À valider : ${ref} — ${d.espace} — ${d.prenom} ${d.nom}`,
    corpsAdmin
  );

  return { ok: true, ref: ref };
}

// ─── CONFIRMER (lien dans email) ─────────────────────────────────
function htmlConfirmer(e) {
  const ref = e.parameter.ref || '';
  try {
    const sheet = getOrCreateSheet('Réservations');
    const row   = trouverLigne(sheet, ref);
    if (!row) return htmlPage('Introuvable', `Réservation ${ref} non trouvée.`);

    const statut = sheet.getRange(row, 18).getValue();
    if (statut === 'Confirmée') return htmlPage('Déjà confirmée', `La réservation ${ref} est déjà confirmée.`);

    // Mettre à jour le statut
    sheet.getRange(row, 18).setValue('Confirmée');

    // Lire les données pour le calendrier et l'email
    const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
    // [0]Ref [1]DateResa [2]Espace [3]Profil [4]Date [5]Heure [6]Durée [7]Part [8]Prenom [9]Nom [10]Email [11]Tel [12]Structure [13]Msg [14]Montant [15]Badge [16]Ade [17]Statut [18]HeureFin
    const d = {
      espace:data[2], profil:data[3], date:data[4],
      heureDebut:data[5], duree:data[6], participants:data[7],
      prenom:data[8], nom:data[9], email:data[10],
      tel:data[11], structure:data[12], message:data[13],
      montantEstime:data[14], optionBadge:data[15]==='Oui', optionAdhesion:data[16]==='Oui'
    };
    const hFin = data[18] || heuresFin(d.heureDebut, d.duree);

    // Créer l'événement Google Calendar
    ajouterEvenementCalendar(d, ref);

    // Email de confirmation au client
    const corps = `Bonjour ${d.prenom},

Votre réservation est confirmée ! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Référence    : ${ref}
📍 Espace       : ${d.espace}
📅 Date         : ${formaterDate(String(d.date))}
⏰ Horaire      : ${d.heureDebut} → ${hFin} (${d.duree}h)
👥 Participants : ${d.participants || 1}
💰 Montant      : ${d.montantEstime} €
━━━━━━━━━━━━━━━━━━━━━━━━━━

L'équipe Génie vous attend !

📞 06 51 50 97 18
📍 12 rue du Génie, 82000 Montauban

L'équipe Génie Montauban`;

    GmailApp.sendEmail(d.email,
      `✅ Réservation confirmée — ${d.espace} le ${formaterDate(String(d.date))}`,
      corps, { name: 'Génie Montauban', replyTo: EMAIL_ADMIN }
    );

    return htmlPage('Réservation confirmée ✅',
      `La réservation <strong>${ref}</strong> de <strong>${d.prenom} ${d.nom}</strong>
       pour <strong>${d.espace}</strong> le <strong>${formaterDate(String(d.date))}</strong>
       a été confirmée.<br><br>
       Un email de confirmation a été envoyé à ${d.email}.<br>
       L'événement a été ajouté au Google Agenda.`
    );

  } catch(err) {
    return htmlPage('Erreur', 'Une erreur est survenue : ' + err.toString());
  }
}

// ─── REFUSER (lien dans email) ────────────────────────────────────
function htmlRefuser(e) {
  const ref = e.parameter.ref || '';
  try {
    const sheet = getOrCreateSheet('Réservations');
    const row   = trouverLigne(sheet, ref);
    if (!row) return htmlPage('Introuvable', `Réservation ${ref} non trouvée.`);

    const statut = sheet.getRange(row, 18).getValue();
    if (statut === 'Refusée') return htmlPage('Déjà refusée', `La réservation ${ref} a déjà été refusée.`);

    sheet.getRange(row, 18).setValue('Refusée');

    const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
    const prenom = data[8], nom = data[9], email = data[10];
    const espace = data[2], date = String(data[4]);

    const corps = `Bonjour ${prenom},

Nous sommes désolés, votre demande de réservation n'a pas pu être confirmée.

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Référence : ${ref}
📍 Espace    : ${espace}
📅 Date      : ${formaterDate(date)}
━━━━━━━━━━━━━━━━━━━━━━━━━━

N'hésitez pas à nous contacter pour trouver une alternative :
📞 06 51 50 97 18
✉️ ${EMAIL_ADMIN}

L'équipe Génie Montauban`;

    GmailApp.sendEmail(email,
      `❌ Réservation non disponible — ${espace} le ${formaterDate(date)}`,
      corps, { name: 'Génie Montauban', replyTo: EMAIL_ADMIN }
    );

    return htmlPage('Réservation refusée',
      `La réservation <strong>${ref}</strong> de <strong>${prenom} ${nom}</strong>
       a été refusée.<br><br>
       Un email d'information a été envoyé à ${email}.`
    );

  } catch(err) {
    return htmlPage('Erreur', 'Une erreur est survenue : ' + err.toString());
  }
}

// ─── GOOGLE AGENDA ────────────────────────────────────────────────
function ajouterEvenementCalendar(d, ref) {
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) { console.error('Calendrier non trouvé : ' + CALENDAR_ID); return; }

    const [annee, mois, jour] = String(d.date).split('-').map(Number);
    const parts   = String(d.heureDebut).split(':');
    const hDebut  = parseInt(parts[0]) || 9;
    const mDebut  = parseInt(parts[1]) || 0;
    const duree   = parseFloat(d.duree) || 1;

    const debut = new Date(annee, mois - 1, jour, hDebut, mDebut, 0);
    const fin   = new Date(debut.getTime() + duree * 3600 * 1000);

    const titre = `📍 ${d.espace} — ${d.prenom} ${d.nom}`;
    const description = [
      `Référence : ${ref}`,
      `Profil : ${d.profil}`,
      `Participants : ${d.participants || 1}`,
      ``,
      `Contact :`,
      `  ${d.prenom} ${d.nom}`,
      `  ${d.email}`,
      `  ${d.tel || 'Non renseigné'}`,
      d.structure ? `  ${d.structure}` : '',
      ``,
      d.message ? `Message : ${d.message}` : '',
      `Montant : ${d.montantEstime} €`,
      d.optionBadge    ? '🔑 Option badge 24h' : '',
      d.optionAdhesion ? '🤝 Demande adhésion' : '',
    ].filter(Boolean).join('\n');

    calendar.createEvent(titre, debut, fin, {
      description: description,
      location: '12 rue du Génie, 82000 Montauban',
      guests: d.email,
      sendInvites: true
    });

  } catch(err) {
    console.error('Erreur Calendar :', err);
  }
}

// ─── ADMIN : GET ALL ──────────────────────────────────────────────
function getAllAdmin() {
  const sheet = getOrCreateSheet('Réservations');
  if (sheet.getLastRow() <= 1) return { reservations: [] };

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues();
  const reservations = rows.map(r => {
    const espace = String(r[2] || '');
    return {
      id:          String(r[0] || ''),
      createdAt:   String(r[1] || ''),
      espace:      espace,
      usage:       typeEspace(espace),
      profil:      String(r[3] || ''),
      date:        String(r[4] || ''),
      heureDebut:  String(r[5] || ''),
      nbHeures:    String(r[6] || '1'),
      typeDuree:   'heure',
      participants: String(r[7] || '1'),
      prenom:      String(r[8] || ''),
      nom:         String(r[9] || ''),
      email:       String(r[10] || ''),
      tel:         String(r[11] || ''),
      orga:        String(r[12] || ''),
      objet:       String(r[13] || ''),
      montant:     String(r[14] || '0'),
      options:     [r[15]==='Oui'?'Badge 24h':'', r[16]==='Oui'?'Adhésion':''].filter(Boolean).join(', '),
      statut:      String(r[17] || 'En attente'),
      heureFin:    String(r[18] || ''),
      updatedAt:   String(r[1] || '')
    };
  }).filter(r => r.id);

  return { reservations: reservations };
}

function typeEspace(nom) {
  const reunions = ['Bourdelle','Freinet','Gouges','Montessori'];
  const nomades  = ['Aristote'];
  if (reunions.includes(nom)) return 'reunion';
  if (nomades.includes(nom))  return 'nomade';
  return 'coworking';
}

// ─── ADMIN : CRUD ─────────────────────────────────────────────────
function adminAddResa(r) {
  if (!r || !r.id) return { ok: false, erreur: 'Données manquantes' };
  const sheet = getOrCreateSheet('Réservations');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Référence','Date réservation','Espace','Profil','Date','Heure','Durée (h)',
      'Participants','Prénom','Nom','Email','Téléphone','Structure',
      'Message','Montant estimé','Badge 24h','Adhésion','Statut','HeureFin'
    ]);
  }
  sheet.appendRow([
    r.id, r.createdAt || new Date().toLocaleString('fr-FR'),
    r.espace, r.profil || '', r.date, r.heureDebut, r.nbHeures || 1,
    r.participants || 1, r.prenom, r.nom, r.email, r.tel || '', r.orga || '',
    r.objet || '', r.montant || 0,
    (r.options||'').includes('Badge') ? 'Oui' : 'Non',
    (r.options||'').includes('Adhésion') ? 'Oui' : 'Non',
    r.statut || 'Confirmée',
    r.heureFin || ''
  ]);
  return { ok: true };
}

function adminUpdateResa(r) {
  if (!r || !r.id) return { ok: false, erreur: 'ID manquant' };
  const sheet = getOrCreateSheet('Réservations');
  const row   = trouverLigne(sheet, r.id);
  if (!row) return { ok: false, erreur: 'Réservation introuvable : ' + r.id };

  sheet.getRange(row, 1, 1, 19).setValues([[
    r.id,
    sheet.getRange(row, 2).getValue(), // garder la date de création
    r.espace, r.profil || '', r.date, r.heureDebut, r.nbHeures || 1,
    r.participants || 1, r.prenom, r.nom, r.email, r.tel || '', r.orga || '',
    r.objet || '', r.montant || 0,
    (r.options||'').includes('Badge') ? 'Oui' : 'Non',
    (r.options||'').includes('Adhésion') ? 'Oui' : 'Non',
    r.statut || 'Confirmée',
    r.heureFin || ''
  ]]);

  // Si passage à Confirmée et pas encore dans le calendrier : ajouter l'événement
  if (r.statut === 'Confirmée') {
    try { ajouterEvenementCalendar(r, r.id); } catch(_) {}
  }

  return { ok: true };
}

function adminDeleteResa(id) {
  if (!id) return { ok: false, erreur: 'ID manquant' };
  const sheet = getOrCreateSheet('Réservations');
  const row   = trouverLigne(sheet, id);
  if (!row) return { ok: false, erreur: 'Introuvable : ' + id };
  sheet.deleteRow(row);
  return { ok: true };
}

// ─── GET RÉSERVATIONS (dispos formulaire public) ─────────────────
function getReservations(e) {
  const espaceFiltre = e.parameter.espace    || '';
  const dateDebut    = e.parameter.dateDebut || '';
  const dateFin      = e.parameter.dateFin   || dateDebut;

  const sheet = getOrCreateSheet('Réservations');
  if (sheet.getLastRow() <= 1) return { success: true, occupations: {} };

  const data  = sheet.getDataRange().getValues();
  const occup = {};

  for (let i = 1; i < data.length; i++) {
    const row       = data[i];
    const rowEspace = String(row[2] || '');
    const rowDate   = String(row[4] || '');
    const rowStatut = String(row[17] || '');

    if (rowStatut === 'Refusée' || rowStatut === 'Annulée') continue;
    if (espaceFiltre && rowEspace !== espaceFiltre) continue;
    if (rowDate < dateDebut || rowDate > dateFin) continue;

    const heureDebut = String(row[5] || '08:00');
    const duree      = parseFloat(row[6]) || 1;

    if (!occup[rowEspace])         occup[rowEspace] = {};
    if (!occup[rowEspace][rowDate]) occup[rowEspace][rowDate] = [];

    const [hH, hM] = heureDebut.split(':').map(Number);
    const debutMin = hH * 60 + (hM || 0);
    const finMin   = debutMin + Math.round(duree * 60);

    for (let m = debutMin; m < finMin; m += 30) {
      const slot = String(Math.floor(m / 60) % 24).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0');
      if (!occup[rowEspace][rowDate].includes(slot)) occup[rowEspace][rowDate].push(slot);
    }
  }

  return { success: true, occupations: occup };
}

// ─── ADHÉSION ─────────────────────────────────────────────────────
function traiterAdhesion(d) {
  const sheet = getOrCreateSheet('Adhésions');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date','Type','Montant (€)','Mode paiement','Prénom','Nom','Email','Téléphone','Adresse']);
  }
  sheet.appendRow([
    new Date().toLocaleString('fr-FR'),
    d.typeAdhesion, d.montant, d.modePaiement,
    d.prenom, d.nom, d.email, d.tel, d.adresse
  ]);

  const corps = `Bonjour ${d.prenom},

Votre demande d'adhésion à l'Association Génie Montauban a bien été reçue.

━━━━━━━━━━━━━━━━━━━━━━━━━━
Type d'adhésion : ${d.typeAdhesion}
Cotisation      : ${d.montant} €
Mode de paiement: ${d.modePaiement}
━━━━━━━━━━━━━━━━━━━━━━━━━━

Nous vous contacterons sous 48h pour finaliser votre inscription.

📞 06 51 50 97 18
✉️ ${EMAIL_ADMIN}

Bienvenue dans la communauté Génie !`;

  GmailApp.sendEmail(d.email, '🤝 Demande d\'adhésion reçue — Génie Montauban', corps, {
    name: 'Génie Montauban', replyTo: EMAIL_ADMIN
  });

  GmailApp.sendEmail(EMAIL_ADMIN,
    `🔔 Nouvelle adhésion — ${d.prenom} ${d.nom} (${d.typeAdhesion})`,
    `Prénom : ${d.prenom}\nNom : ${d.nom}\nEmail : ${d.email}\nTél : ${d.tel}\nType : ${d.typeAdhesion}\nMontant : ${d.montant} €\nPaiement : ${d.modePaiement}\nAdresse : ${d.adresse}`
  );

  return { ok: true };
}

// ─── CONTACT ──────────────────────────────────────────────────────
function traiterContact(d) {
  const sujet = d.sujet || '(sans sujet)';
  GmailApp.sendEmail(EMAIL_ADMIN, `💬 Contact site — ${sujet}`,
    `De : ${d.prenom || ''} ${d.nom || ''} <${d.email}>\nSujet : ${sujet}\n\n${d.message}`,
    { replyTo: d.email, name: `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Formulaire site' }
  );
  return { ok: true };
}

// ─── UTILITAIRES ──────────────────────────────────────────────────
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function trouverLigne(sheet, ref) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(ref)) return i + 1; // 1-indexed
  }
  return null;
}

function formaterDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${parseInt(d)} ${mois[parseInt(m)-1]} ${y}`;
}

function heuresFin(debut, duree) {
  const parts   = String(debut || '08:00').split(':');
  const hDebut  = parseInt(parts[0]) || 0;
  const mDebut  = parseInt(parts[1]) || 0;
  const totalMin = hDebut * 60 + mDebut + Math.round(parseFloat(duree) * 60);
  const hFin    = Math.floor(totalMin / 60) % 24;
  const mFin    = totalMin % 60;
  return String(hFin).padStart(2,'0') + 'h' + (mFin > 0 ? String(mFin).padStart(2,'0') : '');
}

function repondre(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function repondreJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function htmlPage(titre, corps) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre} — Génie Montauban</title>
<style>
  body{font-family:system-ui,sans-serif;background:#F4F6F9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
  .box{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.1);text-align:center;}
  h1{font-size:1.5rem;margin-bottom:16px;color:#1E4A6E;}
  p{color:#4A5568;line-height:1.6;}
  a{color:#1E4A6E;font-weight:600;}
</style></head><body>
<div class="box">
  <h1>${titre}</h1>
  <p>${corps}</p>
  <p style="margin-top:20px;font-size:13px;color:#6B7A8D;">
    <a href="https://www.genie-montauban.fr">genie-montauban.fr</a>
  </p>
</div>
</body></html>`;
  return ContentService.createTextOutput(html).setMimeType(ContentService.MimeType.HTML);
}
