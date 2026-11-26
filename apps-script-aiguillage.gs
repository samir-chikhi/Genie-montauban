// ============================================================
// AIGUILLAGE DES RÉSERVATIONS DE SALLES (décision de Samir, 26/11/2026)
// ============================================================
// Fichier à ajouter dans le projet Apps Script (« + » → Script → « aiguillage »).
// Utilise CONFIG, dateISO, formaterDate, envoyerEmailSafe, hashSha256,
// remplacerEvenementCalendrier, envoyerDocumentsReservation, journaliser,
// logErreur (apps-script.gs).
//
// Passe AUTOMATIQUEMENT au paiement : une personne déjà venue (ou à
// l'identité vérifiée) qui réserve pour une réunion / du travail, dans la
// jauge, entre 8h et 22h.
// Passe par la VALIDATION de l'équipe (un clic dans l'e-mail) :
//   – première réservation au Génie (hors L'Escale, qui a son propre flux) ;
//   – formation / atelier, événement ouvert au public, vente / commercial ;
//   – plus de personnes que la jauge de la salle ;
//   – créneau qui commence avant 8h ou finit après 22h.
// Pièce d'identité : jointe au formulaire, elle part UNIQUEMENT en pièce
// jointe de l'e-mail de validation à l'équipe. Elle n'est enregistrée ni
// dans le classeur ni dans Drive (minimisation RGPD).

var JAUGE_SALLES = { bourdelle: 40, freinet: 15, gouges: 15, montessori: 4, lavoisier: 8 };
var USAGES_A_VALIDER = {
  formation: 'formation / atelier',
  evenement: 'événement ouvert au public',
  vente: 'vente / activité commerciale'
};
var AIG_HEURE_MIN = 8 * 60, AIG_HEURE_MAX = 22 * 60;
var PIECE_MAX_OCTETS = 8 * 1024 * 1024;

// Déjà venu (réservation confirmée passée) ou identité vérifiée (Clients, col Q).
function clientConnu(email, ss, rows) {
  var auj = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][3] || '').toLowerCase() === email &&
        /^(CONFIRME|TERMINE)$/.test(String(rows[i][18])) && dateISO(rows[i][10]) <= auj) return true;
  }
  var c = ss.getSheetByName('Clients').getDataRange().getValues();
  for (var j = 1; j < c.length; j++) {
    if (String(c[j][4] || '').toLowerCase() === email && c[j][16]) return true;
  }
  return false;
}

// Liste lisible des raisons de valider à la main ([] = automatique).
function motifsValidation(data, email, ss, rows, cle, debMin, finMin) {
  var m = [];
  if (!clientConnu(email, ss, rows)) m.push('première réservation au Génie');
  var u = String(data.usage || '');
  if (USAGES_A_VALIDER[u]) m.push(USAGES_A_VALIDER[u]);
  var n = parseInt(data.participants, 10) || 1;
  if (JAUGE_SALLES[cle] && n > JAUGE_SALLES[cle]) m.push(n + ' personnes pour une jauge de ' + JAUGE_SALLES[cle]);
  if (debMin < AIG_HEURE_MIN || finMin > AIG_HEURE_MAX) m.push('horaire en dehors de 8h-22h');
  return m;
}

function cleDecision(id, d) {
  var secret = PropertiesService.getScriptProperties().getProperty('HELLOASSO_WEBHOOK_SECRET');
  return secret ? hashSha256('decision|' + id + '|' + d + '|' + secret).slice(0, 32) : '';
}
function lienDecision(id, d) {
  // URL /exec stable du déploiement (la même que dans reservation.html).
  return 'https://script.google.com/macros/s/AKfycbyJ-Dk-yZZNdfxFigchP953rNyjSLJv4oOVUbxzuAbX4kuBfwTFBJvnnLuJMLWRnd9c4w/exec'
    + '?action=DECISION&id=' + encodeURIComponent(id) +
    '&d=' + d + '&k=' + cleDecision(id, d);
}

// Appelé par creerReservation() quand motifs.length > 0 : la ligne est
// déjà écrite (EN_ATTENTE). Pas de lien de paiement avant l'accord.
function traiterDemandeAValider(sheet, ligne, data, motifs, montant, id, hFin) {
  var piece = null;
  try {
    var p = data.piece;
    if (p && p.data && String(p.data).length < PIECE_MAX_OCTETS * 1.4) {
      var mime = /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(String(p.type)) ? p.type : 'image/jpeg';
      piece = Utilities.newBlob(Utilities.base64Decode(String(p.data)), mime,
        'piece-identite-' + id + (mime === 'application/pdf' ? '.pdf' : '.jpg'));
    }
  } catch (eP) { logErreur('traiterDemandeAValider/piece', eP); }
  sheet.getRange(ligne, 27).setValue(piece ? 'A_VALIDER_PIECE' : 'A_VALIDER');

  var premiere = motifs.indexOf('première réservation au Génie') >= 0;
  var quand = formaterDate(data.date) + ', ' + data.heureDebut + ' → ' + hFin;
  envoyerEmailSafe(data.email, '📨 Demande reçue — ' + data.espace + ' le ' + formaterDate(data.date),
    'Bonjour ' + data.prenom + ',\n\nMerci, votre demande est bien reçue :\n\n'
    + '• Espace    : ' + data.espace + '\n• Date      : ' + quand + '\n• Référence : ' + id + '\n'
    + '• Montant   : ' + (montant > 0 ? montant + ' €' : 'gratuit') + '\n\n'
    + 'Elle est vérifiée par l\'équipe avant paiement (' + motifs.join(', ') + ').\n'
    + 'Réponse sous 24 h, souvent bien plus vite. Le créneau vous est gardé en attendant.\n'
    + 'Dès l\'accord, vous recevez la confirmation' + (montant > 0 ? ' et le lien de paiement' : '') + '.\n'
    + (premiere && !piece ? '\n🪪 Première réservation chez nous : merci de répondre à cet e-mail avec la photo d\'une '
       + 'pièce d\'identité avec photo (carte d\'identité, passeport, permis de conduire ou titre de séjour). '
       + 'Elle sert uniquement à vérifier votre identité et n\'est pas conservée.\n' : '')
    + '\nUne question ? ' + CONFIG.TEL + '\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE,
    { name: CONFIG.NOM_LIEU, replyTo: CONFIG.EMAIL_CONTACT });

  var corps = '🟡 Demande à valider — ' + id + '\n\n'
    + 'Pourquoi : ' + motifs.join(' ; ') + '\n\n'
    + 'Client  : ' + data.prenom + ' ' + data.nom + (data.structure ? ' (' + data.structure + ')' : '') + '\n'
    + 'E-mail  : ' + data.email + (data.tel ? ' · ' + data.tel : '') + '\n'
    + 'Espace  : ' + data.espace + '\nQuand   : ' + quand + '\n'
    + 'Usage   : ' + (USAGES_A_VALIDER[data.usage] || data.usage || 'non précisé') + ' · '
    + (parseInt(data.participants, 10) || 1) + ' personne(s)\n'
    + 'Montant : ' + (montant > 0 ? montant + ' €' : 'gratuit') + '\n'
    + (data.message ? 'Message : ' + data.message + '\n' : '')
    + '\n🪪 Pièce d\'identité : ' + (piece ? 'en pièce jointe. Après décision, supprimez cet e-mail : '
       + 'la pièce n\'est conservée nulle part ailleurs.' : (premiere ? 'non fournie (le client est invité à répondre avec).' : 'non requise.'))
    + '\n\n✅ ACCEPTER (le client reçoit confirmation + code d\'accès' + (montant > 0 ? ' + lien de paiement' : '') + ') :\n'
    + lienDecision(id, 'ok')
    + '\n\n❌ REFUSER (le client est prévenu poliment, le créneau est libéré) :\n' + lienDecision(id, 'non')
    + '\n\nOu depuis l\'admin : ' + CONFIG.URL_SITE + '/admin.html';
  envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '🟡 À valider — ' + data.espace + ' ' + formaterDate(data.date) + ' — ' + data.prenom + ' ' + data.nom,
    corps, piece ? { attachments: [piece] } : undefined);
}

// Page ouverte depuis les liens ACCEPTER / REFUSER. Deux temps (page de
// confirmation puis action) : les antivirus de messagerie qui « visitent »
// les liens ne déclenchent donc rien.
function decisionDemande(p) {
  var id = String(p.id || ''), d = p.d === 'ok' ? 'ok' : 'non';
  var page = function (titre, texte, bouton) {
    return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.5">'
      + '<h2>' + titre + '</h2><p>' + texte + '</p>' + (bouton || '') + '</div>').setTitle('Génie — décision');
  };
  var echapper = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  if (!id || !p.k || !comparaisonConstante(String(p.k), cleDecision(id, d)))
    return page('Lien invalide', 'Ce lien n\'est pas valable. Passez par l\'admin.');
  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Reservations');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    var r = rows[i];
    if (!/^A_VALIDER/.test(String(r[26])) || String(r[18]) !== 'EN_ATTENTE')
      return page('Déjà traitée', 'La demande ' + echapper(id) + ' a déjà été traitée (statut : ' + echapper(r[18]) + ').');
    var resume = echapper(r[1] + ' ' + r[2]) + ' — ' + echapper(r[7] || r[6]) + ', ' + formaterDate(dateISO(r[10]));
    if (p.confirm !== '1') {
      var url = lienDecision(id, d) + '&confirm=1';
      return page(d === 'ok' ? 'Accepter la demande ?' : 'Refuser la demande ?', resume,
        '<a href="' + url + '" target="_top" style="display:inline-block;padding:12px 20px;border-radius:8px;color:#fff;text-decoration:none;background:'
        + (d === 'ok' ? '#2e7d32' : '#b3261e') + '">' + (d === 'ok' ? '✅ Oui, accepter' : '❌ Oui, refuser') + '</a>');
    }
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var ligne = i + 1, now = new Date().toISOString();
      if (d === 'ok') {
        if (String(r[26]) === 'A_VALIDER_PIECE') marquerIdentiteVerifiee(r);
        sheet.getRange(ligne, 19).setValue('CONFIRME').setBackground('#D4EDDA').setFontColor('#155724');
        sheet.getRange(ligne, 27).setValue('');
        sheet.getRange(ligne, 23).setValue(now);
        try { remplacerEvenementCalendrier(sheet, ligne, r[23], r[7], r[10], r[13], r[14], r[1] + ' ' + r[2], id, r[3], true); }
        catch (eCal) { logErreur('decisionDemande/calendrier', eCal); }
        try { envoyerDocumentsReservation(sheet, ligne, {}); } catch (eDoc) { logErreur('decisionDemande/documents', eDoc); }
        journaliser({ nom: 'Lien e-mail', role: 'responsable' }, 'Demande acceptée', id, '');
        return page('✅ Demande acceptée', resume + '<br>Le client a reçu la confirmation, son code d\'accès'
          + ((Number(r[15]) || 0) > 0 ? ' et le lien de paiement.' : '.'));
      }
      sheet.getRange(ligne, 19).setValue('ANNULE').setBackground('#F8D7DA').setFontColor('#721C24');
      sheet.getRange(ligne, 27).setValue('REFUSE');
      sheet.getRange(ligne, 23).setValue(now);
      if (r[23]) { try { var ev = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID).getEventById(String(r[23])); if (ev) ev.deleteEvent(); } catch (eC) {} }
      envoyerEmailSafe(r[3], 'Votre demande — ' + (r[7] || r[6]) + ' le ' + formaterDate(dateISO(r[10])),
        'Bonjour ' + (r[1] || '') + ',\n\nMerci pour votre demande ' + id + '. Nous ne pouvons malheureusement pas '
        + 'l\'accepter sur ce créneau. Appelez-nous au ' + CONFIG.TEL + ' : nous chercherons ensemble une autre solution.\n\n'
        + 'Aucun paiement n\'a été effectué.\n\n' + CONFIG.NOM_LIEU, { name: CONFIG.NOM_LIEU, replyTo: CONFIG.EMAIL_CONTACT });
      journaliser({ nom: 'Lien e-mail', role: 'responsable' }, 'Demande refusée', id, '');
      return page('❌ Demande refusée', resume + '<br>Le client est prévenu, le créneau est libéré.');
    } finally { lock.releaseLock(); }
  }
  return page('Introuvable', 'Réservation ' + echapper(id) + ' introuvable.');
}

// Ligne de la fiche Clients (1-based) pour la réservation r ; crée la fiche si besoin.
function ligneClientPourResa(sh, r) {
  var email = String(r[3] || '').toLowerCase(), rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][4] || '').toLowerCase() === email) return i + 1;
  var now = new Date().toISOString();
  sh.appendRow(['CLI-' + Date.now(), now, r[1], r[2], email, r[4], r[5] ? 'structure' : 'particulier', r[5],
    'plein', 'ACTIF', '', '', '', '', 1, now]);
  return sh.getLastRow();
}

// Clients, colonne Q : « identité vérifiée le … ».
function marquerIdentiteVerifiee(r) {
  try {
    var sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Clients');
    if (!sh.getRange(1, 17).getValue()) sh.getRange(1, 17).setValue('identiteVerifiee');
    sh.getRange(ligneClientPourResa(sh, r), 17).setValue('vérifiée le ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
      + ' (pièce reçue avec la demande ' + r[0] + ')');
  } catch (e) { logErreur('marquerIdentiteVerifiee', e); }
}

// ============================================================
// L'ESCALE — PIÈCE D'IDENTITÉ DES NOUVEAUX (automatique, non bloquant)
// ============================================================
// Un nouveau coworker réserve et paie sans attendre. S'il joint sa pièce,
// elle part en pièce jointe à l'équipe (lien « identité vérifiée ») ; sinon,
// l'e-mail de confirmation Stripe lui demande de répondre avec. Rien n'est
// stocké : la propriété ESC_PIECES ne garde que « jointe » / « manquante ».
function escalePieceIdentite(data, email, ss, rows, id) {
  try {
    if (clientConnu(email, ss, rows)) return;
    var props = PropertiesService.getScriptProperties(), suivi = {};
    try { suivi = JSON.parse(props.getProperty('ESC_PIECES') || '{}'); } catch (e) {}
    var limite = Date.now() - 30 * 86400000;
    Object.keys(suivi).forEach(function (k) { if (suivi[k].t < limite) delete suivi[k]; });
    var piece = null, p = data.piece;
    if (p && p.data && String(p.data).length < PIECE_MAX_OCTETS * 1.4) {
      var mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(String(p.type)) ? p.type : 'image/jpeg';
      piece = Utilities.newBlob(Utilities.base64Decode(String(p.data)), mime, 'piece-identite-' + id + (mime === 'application/pdf' ? '.pdf' : '.jpg'));
    }
    suivi[id] = { s: piece ? 'jointe' : 'manquante', t: Date.now() };
    props.setProperty('ESC_PIECES', JSON.stringify(suivi));
    if (piece) envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '🪪 Nouveau client L\'Escale — ' + data.prenom + ' ' + data.nom,
      'Nouveau coworker à L\'Escale : ' + data.prenom + ' ' + data.nom + ' (' + email + '), le ' + formaterDate(data.date)
      + '.\nSa pièce d\'identité est en pièce jointe (paiement Stripe en cours : si le créneau expire, ignorez ce message).\n\n'
      + 'Après vérification, marquez son identité comme vérifiée (ses prochaines réservations de salle passeront directement) :\n'
      + URL_EXEC_GENIE + '?action=IDV&id=' + encodeURIComponent(id) + '&k=' + cleRC('idv' + id)
      + '\n\nPuis supprimez cet e-mail : la pièce n\'est conservée nulle part ailleurs.', { attachments: [piece] });
  } catch (err) { logErreur('escalePieceIdentite', err); }
}

// Ligne à ajouter à l'e-mail de confirmation Stripe si la pièce manque.
function escaleDemandePiece(id) {
  try {
    var s = JSON.parse(PropertiesService.getScriptProperties().getProperty('ESC_PIECES') || '{}')[id];
    if (!s || s.s !== 'manquante') return '';
    return '🪪 Première venue : merci de répondre à cet e-mail avec la photo d\'une pièce d\'identité avec photo '
      + '(carte d\'identité, passeport, permis de conduire ou titre de séjour). Elle sert uniquement à vérifier '
      + 'votre identité et n\'est pas conservée.\n\n';
  } catch (e) { return ''; }
}

// Lien « identité vérifiée » (deux temps, comme les décisions).
function pageIdentiteVerifiee(p) {
  var id = String(p.id || '');
  var page = function (titre, corps) {
    return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.5">'
      + '<h2>' + titre + '</h2>' + corps + '</div>').setTitle('Génie — identité');
  };
  if (!id || !p.k || !comparaisonConstante(String(p.k), cleRC('idv' + id))) return page('Lien invalide', '<p>Ce lien n\'est pas valable.</p>');
  var rs = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Reservations').getDataRange().getValues();
  var r = null;
  for (var i = 1; i < rs.length; i++) if (String(rs[i][0]) === id) { r = rs[i]; break; }
  if (!r) return page('Introuvable', '<p>Réservation introuvable.</p>');
  var qui = echapperHtml(r[1] + ' ' + r[2]);
  if (p.confirm !== '1') return page('Identité vérifiée ?', '<p>' + qui + '</p><a target="_top" href="' + URL_EXEC_GENIE
    + '?action=IDV&id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(p.k) + '&confirm=1" style="display:inline-block;padding:12px 20px;'
    + 'border-radius:8px;background:#2e7d32;color:#fff;text-decoration:none">✅ Oui, la pièce est conforme</a>');
  marquerIdentiteVerifiee(r);
  journaliser({ nom: 'Lien e-mail', role: 'responsable' }, 'Identité vérifiée', id, String(r[3]));
  return page('✅ Enregistré', '<p>' + qui + ' : identité vérifiée. Pensez à supprimer l\'e-mail qui contenait la pièce.</p>');
}

// ============================================================
// ASSURANCE RC — PROFESSIONNELS SEULEMENT, NON BLOQUANT (Samir, 26/11/2026)
// ============================================================
// Un particulier ou une association n'a rien à fournir. Un professionnel
// réserve normalement ; si aucune attestation valable n'est enregistrée
// (Clients, colonne R « rcValideJusquau »), on la lui demande et l'équipe
// reçoit un lien pour enregistrer sa date de fin. Rappel 30 et 7 jours
// avant l'échéance (déclencheur de 17h, via rappelsVeille).
var URL_EXEC_GENIE = 'https://script.google.com/macros/s/AKfycbyJ-Dk-yZZNdfxFigchP953rNyjSLJv4oOVUbxzuAbX4kuBfwTFBJvnnLuJMLWRnd9c4w/exec';

function echapperHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

function rcFinClient(email, ss) {
  var c = ss.getSheetByName('Clients').getDataRange().getValues();
  for (var j = 1; j < c.length; j++) {
    if (String(c[j][4] || '').toLowerCase() === email && c[j][17]) return dateISO(c[j][17]);
  }
  return '';
}

function cleRC(id) {
  var secret = PropertiesService.getScriptProperties().getProperty('HELLOASSO_WEBHOOK_SECRET');
  return secret ? hashSha256('rc|' + id + '|' + secret).slice(0, 32) : '';
}
function lienRC(id) { return URL_EXEC_GENIE + '?action=RC&id=' + encodeURIComponent(id) + '&k=' + cleRC(id); }

// Appelé par creerReservation() pour toute réservation de salle.
function traiterAssurancePro(data, email, ss, id) {
  try {
    if (String(data.statutClient || '') !== 'professionnel') return;
    var fin = rcFinClient(email, ss);
    if (fin && fin >= data.date) return;                       // attestation valable : rien à faire
    var piece = null, a = data.attestation;
    if (a && a.data && String(a.data).length < PIECE_MAX_OCTETS * 1.4) {
      var mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(String(a.type)) ? a.type : 'image/jpeg';
      piece = Utilities.newBlob(Utilities.base64Decode(String(a.data)), mime,
        'attestation-rc-' + id + (mime === 'application/pdf' ? '.pdf' : '.jpg'));
    }
    var props = PropertiesService.getScriptProperties(), demandes = {};
    try { demandes = JSON.parse(props.getProperty('RC_DEMANDES') || '{}'); } catch (e) {}
    if (!piece && demandes[email] && Date.now() - demandes[email] < 30 * 86400000) return;  // déjà demandée ce mois-ci
    if (!piece) envoyerEmailSafe(email, '📄 Votre attestation d\'assurance — Génie',
      'Bonjour ' + data.prenom + ',\n\nMerci pour votre réservation ' + id + '.\n\n'
      + 'Comme vous venez à titre professionnel, merci de nous envoyer votre attestation d\'assurance '
      + 'responsabilité civile professionnelle' + (fin ? ' (celle que nous avons a expiré le ' + formaterDate(fin) + ')' : '')
      + ' : il suffit de répondre à cet e-mail avec le document (PDF ou photo).\n'
      + 'Votre réservation n\'est pas bloquée pour autant. Nous la conservons jusqu\'à sa date de fin et vous '
      + 'préviendrons avant qu\'elle expire.\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.TEL,
      { name: CONFIG.NOM_LIEU, replyTo: CONFIG.EMAIL_CONTACT });
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '📄 Assurance RC pro — ' + data.prenom + ' ' + data.nom + (data.structure ? ' (' + data.structure + ')' : ''),
      'Réservation ' + id + ' (' + data.espace + ', ' + formaterDate(data.date) + ') par un professionnel.\n\n'
      + (piece ? 'L\'attestation est en pièce jointe.' : 'Aucune attestation valable enregistrée : le client est invité à répondre avec la sienne.')
      + '\n\nQuand vous l\'avez vérifiée, enregistrez sa date de fin de validité (rappels automatiques ensuite) :\n'
      + lienRC(id) + '\n\nRien ne bloque la réservation.', piece ? { attachments: [piece] } : undefined);
    demandes[email] = Date.now();
    props.setProperty('RC_DEMANDES', JSON.stringify(demandes));
  } catch (err) { logErreur('traiterAssurancePro', err); }
}

// Page du lien « enregistrer la date de fin » : formulaire, puis enregistrement.
function pageRC(p) {
  var id = String(p.id || '');
  var page = function (titre, corps) {
    return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.5">'
      + '<h2>' + titre + '</h2>' + corps + '</div>').setTitle('Génie — assurance');
  };
  if (!id || !p.k || !comparaisonConstante(String(p.k), cleRC(id))) return page('Lien invalide', '<p>Ce lien n\'est pas valable.</p>');
  var rs = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Reservations').getDataRange().getValues();
  var r = null;
  for (var i = 1; i < rs.length; i++) if (String(rs[i][0]) === id) { r = rs[i]; break; }
  if (!r) return page('Introuvable', '<p>Réservation introuvable.</p>');
  var qui = echapperHtml(r[1] + ' ' + r[2] + (r[5] ? ' (' + r[5] + ')' : ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fin || ''))) {
    return page('Attestation RC pro', '<p>' + qui + '</p><form method="get" action="' + URL_EXEC_GENIE + '" target="_top">'
      + '<input type="hidden" name="action" value="RC"><input type="hidden" name="id" value="' + echapperHtml(id) + '">'
      + '<input type="hidden" name="k" value="' + echapperHtml(p.k) + '">'
      + '<label>Valable jusqu\'au : <input type="date" name="fin" required style="padding:8px;font:inherit"></label><br><br>'
      + '<button style="padding:12px 20px;border:0;border-radius:8px;background:#2e7d32;color:#fff;font:inherit">Enregistrer</button></form>');
  }
  var sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName('Clients');
  if (!sh.getRange(1, 18).getValue()) sh.getRange(1, 18).setValue('rcValideJusquau');
  var ligne = ligneClientPourResa(sh, r);
  sh.getRange(ligne, 18).setValue(p.fin);
  sh.getRange(ligne, 7).setValue('professionnel');
  journaliser({ nom: 'Lien e-mail', role: 'responsable' }, 'Assurance RC enregistrée', id, String(r[3]) + ' → ' + p.fin);
  return page('✅ Enregistré', '<p>' + qui + '<br>Attestation valable jusqu\'au <b>' + formaterDate(p.fin)
    + '</b>. Le client sera prévenu 30 jours puis 7 jours avant l\'échéance.</p>');
}

// Rappels d'échéance (appelé chaque jour par rappelsVeille, à 17h).
function rappelsAssurance() {
  try {
    var tz = Session.getScriptTimeZone(), auj = new Date();
    var dans = function (n) { return Utilities.formatDate(new Date(auj.getTime() + n * 86400000), tz, 'yyyy-MM-dd'); };
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var c = ss.getSheetByName('Clients').getDataRange().getValues();
    var rs = ss.getSheetByName('Reservations').getDataRange().getValues();
    for (var j = 1; j < c.length; j++) {
      var fin = c[j][17] ? dateISO(c[j][17]) : '', email = String(c[j][4] || '');
      if (!fin || !email) continue;
      var n = fin === dans(30) ? 30 : fin === dans(7) ? 7 : 0;
      if (!n) continue;
      envoyerEmailSafe(email, '📄 Votre attestation d\'assurance expire le ' + formaterDate(fin),
        'Bonjour ' + (c[j][2] || '') + ',\n\nL\'attestation d\'assurance responsabilité civile professionnelle que nous avons '
        + 'pour vous expire dans ' + n + ' jours (le ' + formaterDate(fin) + ').\n'
        + 'Merci de répondre à cet e-mail avec la nouvelle attestation dès que vous l\'avez.\n\n' + CONFIG.NOM_LIEU + ' · ' + CONFIG.TEL,
        { name: CONFIG.NOM_LIEU, replyTo: CONFIG.EMAIL_CONTACT });
      var derniere = '';   // dernière réservation du client : sert de clé au lien d'enregistrement
      for (var i = rs.length - 1; i >= 1 && !derniere; i--) if (String(rs[i][3] || '').toLowerCase() === email.toLowerCase()) derniere = String(rs[i][0]);
      envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '📄 RC pro à renouveler (J-' + n + ') — ' + (c[j][2] || '') + ' ' + (c[j][3] || ''),
        'L\'attestation de ' + (c[j][2] || '') + ' ' + (c[j][3] || '') + (c[j][7] ? ' (' + c[j][7] + ')' : '') + ' expire le '
        + formaterDate(fin) + '. Le client a été relancé.'
        + (derniere ? '\n\nQuand vous recevez la nouvelle, enregistrez sa date de fin :\n' + lienRC(derniere) : ''));
    }
  } catch (e) { logErreur('rappelsAssurance', e); }
}
