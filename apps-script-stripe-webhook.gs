/**
 * ════════════════════════════════════════════════════════════════════════
 *  PHASE 2 — Webhook Stripe pour « L'Escale du Génie » (coworking nomade)
 * ════════════════════════════════════════════════════════════════════════
 *
 *  ⚠ Ce fichier n'est PAS encore actif. Il faut, dans l'éditeur Apps Script :
 *     1. coller ce code à la fin de apps-script.gs (ou dans un fichier séparé
 *        du même projet) ;
 *     2. ajouter UNE ligne dans doPost (voir « BRANCHEMENT » plus bas) ;
 *     3. renseigner les propriétés du script (voir « PROPRIÉTÉS ») ;
 *     4. créer une NOUVELLE VERSION du déploiement (Déployer → Gérer les
 *        déploiements → ✏️ → Nouvelle version). L'URL /exec ne change pas.
 *     5. déclarer l'endpoint chez Stripe (voir DEPLOIEMENT-PHASE-2-STRIPE.md).
 *
 *  Apps Script n'expose PAS les en-têtes HTTP → impossible de vérifier la
 *  signature « Stripe-Signature ». On applique donc le même modèle que
 *  HelloAsso : un secret partagé dans l'URL de l'endpoint
 *      https://script.google.com/.../exec?stripe_whsecret=LE_SECRET
 *  et, si STRIPE_SECRET_KEY est fournie, une contre-vérification par appel
 *  API (on re-lit la session chez Stripe et on exige payment_status=paid).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  PROPRIÉTÉS DU SCRIPT (Fichier → Paramètres du projet → Propriétés) :
 *
 *    STRIPE_WHSECRET        chaîne aléatoire de votre choix, recopiée à la
 *                           fin de l'URL de l'endpoint Stripe.
 *    STRIPE_SECRET_KEY      (recommandé) clé secrète LIVE « sk_live_… ».
 *                           Sert uniquement à re-vérifier la session.
 *    ESCALE_CODE_PORTE_RUE  code de la porte de rue (ex. « 1958 »).
 *    ESCALE_CODE_PORTE_INT  code de la porte intérieure (ex. « 42A »).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  BRANCHEMENT — dans doPost(e), juste après la ligne
 *      const data = JSON.parse(e.postData.contents);
 *  insérer :
 *
 *      // Webhook Stripe (L'Escale) : évènements « type: 'xxx.yyy' », pas d'action
 *      if (!data.action && typeof data.type === 'string' && data.object === 'event') {
 *        return ok(stripeWebhook(data, e && e.parameter));
 *      }
 *
 *  (Le test est volontairement étroit : un évènement Stripe a toujours
 *   object==='event' et type==='...'. Aucune requête du site n'a ces champs,
 *   donc les flux réservation / adhésion / admin existants sont intacts.)
 * ════════════════════════════════════════════════════════════════════════
 */

function stripeWebhook(evt, params) {
  try {
    // ── 1. Authentification par secret d'URL ────────────────────────────
    var attendu = PropertiesService.getScriptProperties().getProperty('STRIPE_WHSECRET');
    if (!attendu) {
      logErreur('stripeWebhook', new Error('STRIPE_WHSECRET absent : notification refusée'));
      return { success: false, error: 'WEBHOOK_NON_CONFIGURE' };
    }
    if (!params || String(params.stripe_whsecret || '') !== attendu) {
      logErreur('stripeWebhook', new Error('Notification Stripe refusée : secret absent ou incorrect'));
      return { success: false, error: 'NON_AUTORISE' };
    }

    // ── 2. On ne traite que le paiement abouti ─────────────────────────
    if (evt.type !== 'checkout.session.completed') {
      return { success: true, ignore: 'type=' + evt.type };
    }
    var session = (evt.data && evt.data.object) || {};
    var sessionId = String(session.id || '');
    if (!sessionId) return { success: true, ignore: 'session sans id' };

    // ── 3. Contre-vérification API (si la clé secrète est fournie) ──────
    var secretKey = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
    if (secretKey) {
      try {
        var resp = UrlFetchApp.fetch(
          'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
          { headers: { Authorization: 'Bearer ' + secretKey }, muteHttpExceptions: true });
        if (resp.getResponseCode() !== 200) {
          logErreur('stripeWebhook', new Error('Re-lecture session HTTP ' + resp.getResponseCode()));
          return { success: false, error: 'VERIF_API_ECHOUEE' };
        }
        session = JSON.parse(resp.getContentText());
      } catch (eApi) {
        logErreur('stripeWebhook/verifApi', eApi);
        return { success: false, error: 'VERIF_API_ERREUR' };
      }
    }
    if (String(session.payment_status || '') !== 'paid') {
      return { success: true, ignore: 'payment_status=' + session.payment_status };
    }

    // ── 4. Idempotence : Stripe rejoue ses évènements ──────────────────
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservations');
    if (!sheet) return { success: false, error: 'Onglet Reservations introuvable' };
    var rows = sheet.getDataRange().getValues();
    var idResa = 'STRIPE-' + sessionId;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === idResa) return { success: true, ignore: 'deja enregistree' };
    }

    // ── 5. Données du paiement ────────────────────────────────────────
    var cd        = session.customer_details || {};
    var email     = String(cd.email || session.customer_email || '').trim();
    var nomComplet = String(cd.name || '').trim();
    var prenom = nomComplet, nom = '';
    var sp = nomComplet.indexOf(' ');
    if (sp > 0) { prenom = nomComplet.slice(0, sp); nom = nomComplet.slice(sp + 1); }
    var montantEur = Number(session.amount_total || 0) / 100;
    var libelle = libelleFormuleEscale(montantEur);
    var recu = String(session.receipt_url || '');   // souvent vide sur Checkout ; le reçu carte part automatiquement
    var now = new Date().toISOString();
    var dateStr = now.split('T')[0];

    // ── 6. Enregistrement (ligne « réservation » allégée) ─────────────
    // Colonnes Reservations : id, prenom, nom, email, tel, orga, espace,
    // nomEspace, usage, profil, date, typeDuree, nbHeures, heureDebut,
    // heureFin, montant, montantBase, options, statut, participants, objet,
    // createdAt, updatedAt, calendarEventId, checkoutIntentId, paymentUrl,
    // paymentState, paymentReceiptUrl
    sheet.appendRow([
      idResa, prenom, nom, email, '', '',
      'rousseau', 'Jean-Jacques Rousseau',
      'nomade', 'escale',
      dateStr, 'forfait', '', '', '',
      montantEur, montantEur,
      libelle, 'CONFIRME', 1,
      'L\'Escale du Génie — paiement Stripe ' + sessionId,
      now, now, '',
      sessionId, '', 'PAYE', recu
    ]);
    var ligne = sheet.getLastRow();
    sheet.getRange(ligne, 27).setBackground('#D4EDDA').setFontColor('#155724'); // paymentState

    // ── 7. E-mail client : confirmation + codes d'accès ───────────────
    var props = PropertiesService.getScriptProperties();
    var codeRue = props.getProperty('ESCALE_CODE_PORTE_RUE') || '(code porte de rue — à communiquer)';
    var codeInt = props.getProperty('ESCALE_CODE_PORTE_INT') || '(code porte intérieure — à communiquer)';

    if (email) {
      envoyerEmailSafe(email,
        '✅ L\'Escale du Génie — c\'est réservé (' + libelle + ')',
        'Bonjour ' + (prenom || '') + ',\n\n' +
        'Votre paiement est bien reçu. Votre place à L\'Escale du Génie est confirmée.\n\n' +
        '• Formule   : ' + libelle + '\n' +
        '• Montant   : ' + montantEur.toFixed(2) + ' EUR\n' +
        '• Référence : ' + sessionId + '\n\n' +
        'ACCÈS (espace Jean-Jacques Rousseau, 1er étage) :\n' +
        '   – Porte de rue     : ' + codeRue + '\n' +
        '   – Porte intérieure : ' + codeInt + '\n\n' +
        'Horaires : lun–ven 8h–19h, sam 9h–17h. Prenez une place libre dans\n' +
        'l\'espace ouvert, servez-vous un thé, installez-vous.\n\n' +
        'Première venue ? Pensez à régler l\'adhésion à l\'association\n' +
        '(elle couvre l\'assurance, se prend une fois pour l\'année) :\n' +
        CONFIG.URL_SITE + '/index.html#rejoindre\n\n' +
        'Annulation possible jusqu\'à 48 h avant → avoir valable un an.\n' +
        'Une question ? ' + CONFIG.TEL + '\n\n' +
        CONFIG.NOM_LIEU + ' · ' + CONFIG.ADRESSE);
    }

    // ── 8. E-mail admin ──────────────────────────────────────────────
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      '💳 L\'Escale — ' + libelle + ' — ' + (nomComplet || email || 'client'),
      'Paiement Stripe encaissé pour L\'Escale du Génie :\n\n' +
      'Formule  : ' + libelle + '\n' +
      'Montant  : ' + montantEur.toFixed(2) + ' EUR\n' +
      'Client   : ' + (nomComplet || '—') + '\n' +
      'Email    : ' + (email || '—') + '\n' +
      'Session  : ' + sessionId + '\n\n' +
      'Ligne ajoutée dans l\'onglet Reservations (id ' + idResa + ').\n' +
      'Le client a reçu la confirmation + les codes d\'accès par e-mail.');

    return { success: true, ok: true, cree: idResa };
  } catch (err) {
    logErreur('stripeWebhook', err);
    return { success: false, error: 'ERREUR_SERVEUR', message: err.message };
  }
}

/**
 * Retrouve le nom de la formule L'Escale à partir du montant payé (EUR).
 * Heure 4 · Demi-journée 9 · Journée 15 · Carnet 10 journées 140.
 */
function libelleFormuleEscale(montantEur) {
  var m = Math.round(Number(montantEur) * 100);
  if (m === 400)   return 'L\'Escale — Coworking à l\'heure';
  if (m === 900)   return 'L\'Escale — Demi-journée';
  if (m === 1500)  return 'L\'Escale — Journée';
  if (m === 14000) return 'L\'Escale — Carnet 10 journées';
  return 'L\'Escale — Coworking (' + Number(montantEur).toFixed(2) + ' €)';
}
