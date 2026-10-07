/* Moteur financier du simulateur : déterministe, sans accès au DOM.
   Mêmes hypothèses en entrée, mêmes résultats en sortie.
   Utilisable dans le navigateur (window.Engine) et dans Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /* Hypothèses d'exemple : atelier de réparation de vélos à Montauban. */
  var DEFAUT = {
    nom: 'Vélo Atelier Villebourbon',
    desc: 'Réparation et entretien de vélos, vente de pièces, location de vélos cargo, atelier ouvert en centre-ville de Montauban.',
    prix: 55, clients0: 30, croiss: 6, plafond: 110, achats: 28,
    loyer: 350, autres: 150, salaire: 800,
    invest: 12000, apport: 6000, pret: 9000, taux: 5, duree: 48,
    cotis: 22, tva: 'franchise'
  };

  var AMORT_ANNEES = 5; /* durée d'amortissement des investissements, paramètre à valider */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sum(a, k) { return a.reduce(function (s, x) { return s + x[k]; }, 0); }
  function pos(x) { return isFinite(x) && x > 0 ? x : 0; }

  /* Calcule `mois` mois (36 par défaut) à partir des hypothèses h. */
  function calc(h, mois) {
    mois = mois || 36;
    var n = Math.max(1, Math.round(pos(h.duree)));
    var r = pos(h.taux) / 100 / 12;
    var pret = pos(h.pret);
    var mens = pret > 0 ? (r > 0 ? pret * r / (1 - Math.pow(1 + r, -n)) : pret / n) : 0;
    var cap = pret;
    var t0 = pos(h.apport) + pret - pos(h.invest);
    var t = t0, minT = t0, minM = 0, eq = null, rows = [];
    for (var m = 1; m <= mois; m++) {
      var cl = Math.min(pos(h.plafond) || Infinity, pos(h.clients0) * Math.pow(1 + h.croiss / 100, m - 1));
      var ca = cl * pos(h.prix);
      var ach = ca * pos(h.achats) / 100;
      var fix = pos(h.loyer) + pos(h.autres) + pos(h.salaire);
      var cot = ca * pos(h.cotis) / 100;
      var inter = 0, mensM = 0;
      if (m <= n) { inter = cap * r; mensM = mens; cap -= (mens - inter); }
      var dot = pos(h.invest) / (AMORT_ANNEES * 12);
      var res = ca - ach - fix - cot - dot - inter;
      var flux = ca - ach - fix - cot - mensM;
      t += flux;
      if (t < minT) { minT = t; minM = m; }
      if (eq === null && res >= 0) eq = m;
      rows.push({ m: m, cl: cl, ca: ca, ach: ach, fix: fix, cot: cot, dot: dot, inter: inter, res: res, flux: flux, tre: t });
    }
    var chargesFixes = pos(h.loyer) + pos(h.autres) + pos(h.salaire) + pos(h.invest) / (AMORT_ANNEES * 12) + pret * r;
    var marge = 1 - pos(h.achats) / 100 - pos(h.cotis) / 100;
    var seuil = marge > 0 ? chargesFixes / marge : Infinity;
    var an = [0, 1, 2].map(function (y) {
      var s = rows.slice(y * 12, y * 12 + 12);
      return { ca: sum(s, 'ca'), res: sum(s, 'res'), tre: s[s.length - 1].tre };
    });
    return {
      rows: rows, mens: mens, t0: t0, minT: minT, minM: minM, eq: eq,
      seuil: seuil, seuilCl: seuil / (pos(h.prix) || 1), an: an
    };
  }

  /* Scénarios : écarts appliqués aux hypothèses de ventes uniquement. */
  function scen(h, k) {
    var s = clone(h);
    if (k === 'prudent') { s.clients0 *= 0.7; s.croiss *= 0.6; s.prix *= 0.95; }
    if (k === 'ambitieux') { s.clients0 *= 1.25; s.croiss *= 1.3; s.plafond *= 1.2; }
    return s;
  }

  /* Alertes de cohérence et score de robustesse (0 à 100). */
  function robustesse(c, h) {
    var s = 100, al = [];
    if (c.minT < 0) { s -= 40; al.push({ n: 'ko', code: 'tre-neg', mois: c.minM, val: c.minT }); }
    else if (c.minT < 2000) { s -= 15; al.push({ n: 'warn', code: 'tre-fragile', mois: c.minM, val: c.minT }); }
    else al.push({ n: 'ok', code: 'tre-ok', mois: c.minM, val: c.minT });
    if (c.eq === null) { s -= 30; al.push({ n: 'ko', code: 'eq-jamais' }); }
    else if (c.eq > 12) { s -= 15; al.push({ n: 'warn', code: 'eq-tardif', mois: c.eq }); }
    else al.push({ n: 'ok', code: 'eq-ok', mois: c.eq });
    if (pos(h.pret) > 0 && pos(h.apport) < pos(h.invest) * 0.2) { s -= 10; al.push({ n: 'warn', code: 'apport-faible' }); }
    if (!(h.salaire > 0)) { s -= 10; al.push({ n: 'warn', code: 'sans-salaire' }); }
    if (!isFinite(c.seuil)) { s -= 20; al.push({ n: 'ko', code: 'seuil-inatteignable' }); }
    return { score: Math.max(0, s), al: al };
  }

  /* Variables classées par effet d'une variation de ±10 % sur la trésorerie de fin d'année 1. */
  var VARIABLES = [['prix', 'Prix moyen'], ['clients0', 'Clients au démarrage'], ['croiss', 'Croissance mensuelle'],
    ['achats', 'Coût des achats'], ['loyer', 'Loyer'], ['salaire', 'Rémunération'], ['cotis', 'Cotisations']];
  function sensibilite(h) {
    var base = calc(h).an[0].tre;
    return VARIABLES.map(function (v) {
      var d = 0;
      [-0.1, 0.1].forEach(function (f) {
        var x = clone(h); x[v[0]] *= 1 + f;
        d = Math.max(d, Math.abs(calc(x).an[0].tre - base));
      });
      return { k: v[0], n: v[1], d: d };
    }).sort(function (a, b) { return b.d - a.d; });
  }

  return { DEFAUT: DEFAUT, AMORT_ANNEES: AMORT_ANNEES, calc: calc, scen: scen, robustesse: robustesse, sensibilite: sensibilite, clone: clone };
});
