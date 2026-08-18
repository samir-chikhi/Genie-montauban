/**
 * ════════════════════════════════════════════════════════════════
 *  GÉNIE MONTAUBAN — Libération des créneaux impayés
 *  Fichier AUTONOME à coller dans un NOUVEAU fichier Apps Script.
 * ════════════════════════════════════════════════════════════════
 *
 *  À QUOI ÇA SERT
 *  Quand un client réserve et part payer sur HelloAsso, son créneau est
 *  bloqué. S'il abandonne son paiement, sans ce script le créneau reste
 *  bloqué pour toujours. Ce script le rend automatiquement au bout de
 *  30 minutes.
 *
 *  MODE D'EMPLOI — 4 clics
 *  1. Éditeur Apps Script → à gauche, "Fichiers" → le + → Script
 *  2. Nommez-le : declencheur
 *  3. Effacez ce qu'il contient, collez TOUT ce fichier, Ctrl+S
 *  4. En haut, dans la liste déroulante, choisissez :
 *         genieInstallerDeclencheur
 *     puis cliquez ▶ Exécuter. Autorisez si Google le demande.
 *
 *  C'est fini. Vous pouvez vérifier dans ⏰ Déclencheurs : une ligne
 *  "genieLibererCreneauxExpires — Toutes les 10 minutes" doit apparaître.
 *
 *  ⚠️ Les noms de fonctions commencent tous par "genie" exprès : ils ne
 *  peuvent donc pas entrer en conflit avec le fichier principal
 *  apps-script.gs, que vous le colliez avant ou après.
 */

// ── Le seul réglage : votre feuille de calcul ──────────────────────
// (déjà rempli, ne pas modifier sauf changement de Sheet)
var GENIE_SPREADSHEET_ID = '1mf3D2YGnpWpzufGOaLLaomxAkuzp0AiJY7RzcbpIq2w';

// Délai laissé au client pour régler, en minutes.
var GENIE_DELAI_PAIEMENT_MIN = 30;


/**
 * ▶ LANCEZ CETTE FONCTION UNE SEULE FOIS.
 * Elle installe le déclencheur automatique et vous confirme le résultat.
 */
function genieInstallerDeclencheur() {
  // On retire d'abord un éventuel déclencheur déjà posé, pour ne pas
  // en accumuler plusieurs qui feraient le même travail en double.
  var existants = ScriptApp.getProjectTriggers();
  var retires = 0;
  for (var i = 0; i < existants.length; i++) {
    var h = existants[i].getHandlerFunction();
    if (h === 'genieLibererCreneauxExpires' || h === 'libererCreneauxExpires') {
      ScriptApp.deleteTrigger(existants[i]);
      retires++;
    }
  }

  ScriptApp.newTrigger('genieLibererCreneauxExpires')
    .timeBased()
    .everyMinutes(10)
    .create();

  var msg = 'OK — le declencheur est installe. Les creneaux non regles au bout de '
          + GENIE_DELAI_PAIEMENT_MIN + ' min seront liberes automatiquement.'
          + (retires ? ' (' + retires + ' ancien(s) declencheur(s) remplace(s).)' : '');
  Logger.log(msg);
  return msg;
}


/**
 * Exécutée automatiquement toutes les 10 minutes.
 * Vous n'avez jamais besoin de la lancer vous-même.
 */
function genieLibererCreneauxExpires() {
  try {
    var ss = SpreadsheetApp.openById(GENIE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservations');
    if (!sheet || sheet.getLastRow() < 2) return 0;

    var rows = sheet.getDataRange().getValues();
    var limite = Date.now() - GENIE_DELAI_PAIEMENT_MIN * 60 * 1000;
    var liberes = 0;

    for (var i = 1; i < rows.length; i++) {
      // colonne 19 (index 18) : statut  ·  colonne 27 (index 26) : état du paiement
      if (String(rows[i][18]) !== 'EN_ATTENTE') continue;
      if (String(rows[i][26]) !== 'EN_ATTENTE_PAIEMENT') continue;

      // colonne 22 (index 21) : date de création
      var cree = new Date(rows[i][21]);
      if (isNaN(cree.getTime()) || cree.getTime() > limite) continue;

      sheet.getRange(i + 1, 19).setValue('ANNULE');
      sheet.getRange(i + 1, 19).setBackground('#F8D7DA').setFontColor('#721C24');
      sheet.getRange(i + 1, 27).setValue('EXPIRE');
      liberes++;
    }

    if (liberes) Logger.log(liberes + ' creneau(x) libere(s).');
    return liberes;
  } catch (err) {
    Logger.log('Erreur genieLibererCreneauxExpires : ' + err.message);
    return -1;
  }
}


/**
 * Facultatif — pour vérifier sans rien modifier.
 * Lancez-la et regardez "Journal d'exécution" : elle dit combien de
 * créneaux SERAIENT libérés, sans y toucher.
 */
function genieTesterSansRienChanger() {
  try {
    var ss = SpreadsheetApp.openById(GENIE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservations');
    if (!sheet) { Logger.log('Onglet "Reservations" introuvable.'); return; }
    if (sheet.getLastRow() < 2) { Logger.log('Aucune reservation.'); return; }

    var rows = sheet.getDataRange().getValues();
    var limite = Date.now() - GENIE_DELAI_PAIEMENT_MIN * 60 * 1000;
    var n = 0, enAttentePaiement = 0;

    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][26]) === 'EN_ATTENTE_PAIEMENT') enAttentePaiement++;
      if (String(rows[i][18]) !== 'EN_ATTENTE') continue;
      if (String(rows[i][26]) !== 'EN_ATTENTE_PAIEMENT') continue;
      var cree = new Date(rows[i][21]);
      if (isNaN(cree.getTime()) || cree.getTime() > limite) continue;
      n++;
      Logger.log('  a liberer : ' + rows[i][0] + '  (' + rows[i][10] + ' ' + rows[i][13] + ')');
    }
    Logger.log('Total : ' + sheet.getLastRow() - 1 + ' reservation(s), '
      + enAttentePaiement + ' en attente de paiement, ' + n + ' a liberer maintenant.');
  } catch (err) {
    Logger.log('Erreur : ' + err.message);
  }
}
