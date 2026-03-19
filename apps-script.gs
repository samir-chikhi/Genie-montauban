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
 */

// ─── CONFIGURATION ───────────────────────────────────────────────
const EMAIL_ADMIN        = 'genie.montauban@gmail.com';
const SPREADSHEET_ID     = '17dxvMah1AlINEN2InJzuTSJ4UtuC_QAg5bo3Snq2YYs';
const CALENDAR_ID        = 'genie.montauban@gmail.com'; // Agenda Google principal

// ─── POINT D'ENTRÉE HTTP ─────────────────────────────────────────
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch(_) {
    data = {};
  }

  const action = data.action || '';

  // Vérification du token partagé (API key simple)
  const scriptProperties = PropertiesService.getScriptProperties();
  const expectedToken = scriptProperties.getProperty('API_SHARED_KEY');
  const providedToken =
    (data && data.token) ||
    (e && e.parameter && e.parameter.token) ||
    '';

  if (!expectedToken || providedToken !== expectedToken) {
    return repondre({ ok: false, erreur: 'Accès non autorisé' });
  }

  try {
    if (action === 'RESERVER') {
      if (!validerReservationPayload(data)) {
        return repondre({ ok: false, erreur: 'Données de réservation invalides ou incomplètes' });
      }
      return repondre(traiterReservation(data));
    }
    if (action === 'ADHERER')   return repondre(traiterAdhesion(data));
    if (action === 'CONTACT')   return repondre(traiterContact(data));
    return repondre({ ok: false, erreur: 'Action inconnue : ' + action });
  } catch(err) {
    return repondre({ ok: false, erreur: err.toString() });
  }
}

function doGet(e) {
  const action = e.parameter.action || '';

  // Vérification du token partagé (API key simple)
  const scriptProperties = PropertiesService.getScriptProperties();
  const expectedToken = scriptProperties.getProperty('API_SHARED_KEY');
  const providedToken = (e && e.parameter && e.parameter.token) || '';

  if (!expectedToken || providedToken !== expectedToken) {
    return repondreJSON({ ok: false, erreur: 'Accès non autorisé' });
  }

  try {
    if (action === 'GET_RESERVATIONS') return repondreJSON(getReservations(e));
    return repondreJSON({ ok: true, message: 'API Génie Montauban opérationnelle' });
  } catch(err) {
    return repondreJSON({ ok: false, erreur: err.toString() });
  }
}

// ─── RÉSERVATION ─────────────────────────────────────────────────
/**
 * Valide les champs essentiels pour une réservation avant de lancer les effets de bord.
 */
function validerReservationPayload(d) {
  if (!d) return false;

  // Champs obligatoires de base
  const requiredStringFields = [
    'espace',
    'profil',
    'date',
    'heureDebut',
    'prenom',
    'nom',
    'email'
  ];

  for (var i = 0; i < requiredStringFields.length; i++) {
    var field = requiredStringFields[i];
    if (!d[field] || typeof d[field] !== 'string') {
      return false;
    }
  }

  // Durée obligatoire et numérique positive
  if (d.duree === undefined || d.duree === null || isNaN(Number(d.duree)) || Number(d.duree) <= 0) {
    return false;
  }

  // Date au format simple AAAA-MM-JJ (validation basique)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
    return false;
  }

  // Heure de début au format H ou HH ou HH:MM (validation basique)
  if (!/^\d{1,2}(:\d{2})?$/.test(d.heureDebut)) {
    return false;
  }

  // Email forme simple
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
    return false;
  }

  return true;
}

function traiterReservation(d) {
  const ref = 'RES-' + Date.now();

  // 1. Enregistrer dans Google Sheets
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Réservations') || ss.insertSheet('Réservations');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Référence','Date réservation','Espace','Profil','Date','Heure','Durée (h)',
                     'Participants','Prénom','Nom','Email','Téléphone','Structure',
                     'Message','Montant estimé','Badge 24h','Adhésion']);
  }
  sheet.appendRow([
    ref,
    new Date().toLocaleString('fr-FR'),
    d.espace, d.profil, d.date, d.heureDebut, d.duree,
    d.participants, d.prenom, d.nom, d.email, d.tel, d.structure,
    d.message, d.montantEstime, d.optionBadge ? 'Oui' : 'Non', d.optionAdhesion ? 'Oui' : 'Non'
  ]);

  // 2. Ajouter à Google Agenda
  ajouterEvenementCalendar(d, ref);

  // 3. Email de confirmation au réserveur
  const corps = `Bonjour ${d.prenom},

Votre demande de réservation a bien été reçue. Voici le récapitulatif :

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Référence    : ${ref}
📍 Espace       : ${d.espace}
📅 Date         : ${formaterDate(d.date)}
⏰ Horaire      : ${d.heureDebut}h → ${heuresFin(d.heureDebut, d.duree)}h (${d.duree}h)
👥 Participants : ${d.participants || 1}
💰 Tarif estimé : ${d.montantEstime}
━━━━━━━━━━━━━━━━━━━━━━━━━━

L'équipe Génie vous contactera sous 24h pour confirmer la disponibilité et le mode de paiement.

📞 06 51 50 97 18
✉️ ${EMAIL_ADMIN}
📍 12 rue du Génie, 82000 Montauban

À bientôt !
L'équipe Génie Montauban`;

  GmailApp.sendEmail(d.email, `✅ Réservation reçue — ${d.espace} le ${formaterDate(d.date)}`, corps, {
    name: 'Génie Montauban',
    replyTo: EMAIL_ADMIN
  });

  // 4. Notification admin
  const corpAdmin = `Nouvelle réservation reçue !

Référence : ${ref}
Espace    : ${d.espace}
Date      : ${formaterDate(d.date)} — ${d.heureDebut}h (${d.duree}h)
Profil    : ${d.profil}
Participants : ${d.participants || 1}

Contact :
- ${d.prenom} ${d.nom}
- ${d.email}
- ${d.tel || 'Non renseigné'}
- ${d.structure || ''}

Message : ${d.message || 'Aucun'}
Montant estimé : ${d.montantEstime}
Badge 24h : ${d.optionBadge ? 'Oui' : 'Non'}
Adhésion : ${d.optionAdhesion ? 'Oui' : 'Non'}`;

  GmailApp.sendEmail(EMAIL_ADMIN, `🔔 Réservation ${ref} — ${d.espace}`, corpAdmin);

  return { ok: true, ref: ref };
}

// ─── GOOGLE AGENDA ────────────────────────────────────────────────
function ajouterEvenementCalendar(d, ref) {
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) return; // Calendrier non trouvé, on ignore

    // Construire la date/heure de début et de fin
    const [annee, mois, jour] = (d.date || '').split('-').map(Number);
    const heureDebut = parseInt(d.heureDebut) || 9;
    const duree      = parseFloat(d.duree) || 1;

    const debut = new Date(annee, mois - 1, jour, heureDebut, 0, 0);
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
      ``,
      `Montant estimé : ${d.montantEstime}`,
      d.optionBadge ? '🔑 Option badge 24h demandée' : '',
      d.optionAdhesion ? '🤝 Demande d\'adhésion jointe' : '',
    ].filter(Boolean).join('\n');

    calendar.createEvent(titre, debut, fin, {
      description: description,
      location: '12 rue du Génie, 82000 Montauban',
      guests: d.email,
      sendInvites: false // Mettre true pour envoyer l'invitation au réserveur
    });

  } catch(err) {
    // On ne bloque pas si le calendrier échoue
    console.error('Erreur Calendar :', err);
  }
}

// ─── ADHÉSION ─────────────────────────────────────────────────────
function traiterAdhesion(d) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Adhésions') || ss.insertSheet('Adhésions');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date','Type','Montant (€)','Mode paiement','Prénom','Nom','Email','Téléphone','Adresse']);
  }
  sheet.appendRow([
    new Date().toLocaleString('fr-FR'),
    d.typeAdhesion, d.montant, d.modePaiement,
    d.prenom, d.nom, d.email, d.tel, d.adresse
  ]);

  // Email de confirmation
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
    name: 'Génie Montauban',
    replyTo: EMAIL_ADMIN
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
  const corps = `Message reçu via le formulaire de contact du site.

De : ${d.prenom || ''} ${d.nom || ''} <${d.email}>
Sujet : ${sujet}

${d.message}`;

  GmailApp.sendEmail(EMAIL_ADMIN, `💬 Contact site — ${sujet}`, corps, {
    replyTo: d.email,
    name: `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Formulaire site'
  });

  return { ok: true };
}

// ─── GET RÉSERVATIONS (pour affichage dispos) ──────────────────────
function getReservations(e) {
  const espace    = e.parameter.espace    || '';
  const dateDebut = e.parameter.dateDebut || '';
  const dateFin   = e.parameter.dateFin   || dateDebut;

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Réservations');
  if (!sheet) return { success: true, occupations: {} };

  const data  = sheet.getDataRange().getValues();
  const occup = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Colonnes : [0]Ref [1]DateResa [2]Espace [3]Profil [4]Date [5]Heure [6]Durée ...
    if (row[2] === espace && row[4] >= dateDebut && row[4] <= dateFin) {
      const date  = row[4];
      const heure = row[5];
      const duree = parseFloat(row[6]) || 1;
      if (!occup[date]) occup[date] = [];
      for (let h = 0; h < duree; h++) {
        occup[date].push(parseInt(heure) + h);
      }
    }
  }

  return { success: true, occupations: occup };
}

// ─── UTILITAIRES ──────────────────────────────────────────────────
function formaterDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${parseInt(d)} ${mois[parseInt(m)-1]} ${y}`;
}

function heuresFin(debut, duree) {
  const h = parseInt(debut) + parseFloat(duree);
  return h < 10 ? '0' + h : String(h);
}

function repondre(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function repondreJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
