const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../assets/js/engine.js');
const H = () => E.clone(E.DEFAUT);
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, a + ' ≠ ' + b);

test('mensualité du prêt : 9 000 € à 5 % sur 48 mois ≈ 207,26 €', () => near(E.calc(H()).mens, 207.26, 0.05));
test('trésorerie initiale = apport + prêt - investissements', () => assert.equal(E.calc(H()).t0, 3000));
test('CA du mois 1 = clients de départ × prix', () => assert.equal(E.calc(H()).rows[0].ca, 30 * 55));
test('le plafond de clients est respecté', () => assert.ok(E.calc(H()).rows.every(r => r.cl <= 110 + 1e-9)));
test('la trésorerie finale = trésorerie initiale + somme des flux', () => {
  const c = E.calc(H()), flux = c.rows.reduce((s, r) => s + r.flux, 0);
  near(c.rows[35].tre, c.t0 + flux, 1e-6);
});
test('sans prêt : mensualité nulle, aucun NaN', () => {
  const h = H(); h.pret = 0; const c = E.calc(h);
  assert.equal(c.mens, 0); assert.ok(c.rows.every(r => Number.isFinite(r.tre)));
});
test('prêt à taux zéro', () => { const h = H(); h.taux = 0; near(E.calc(h).mens, 9000 / 48, 1e-9); });
test('durée de prêt à 0 : pas de division par zéro', () => { const h = H(); h.duree = 0; assert.ok(Number.isFinite(E.calc(h).mens)); });
test('valeurs négatives ou vides : pas de NaN', () => {
  const h = H(); h.prix = -5; h.loyer = NaN; const c = E.calc(h);
  assert.ok(c.rows.every(r => Number.isFinite(r.tre)));
});
test('scénarios : prudent < central < ambitieux sur le CA de l\'année 1', () => {
  const ca = k => E.calc(E.scen(H(), k)).an[0].ca;
  assert.ok(ca('prudent') < ca('central') && ca('central') < ca('ambitieux'));
});
test('le scénario central est identique aux hypothèses', () => assert.deepEqual(E.scen(H(), 'central'), H()));
test('seuil de rentabilité inatteignable si achats + cotisations ≥ 100 %', () => {
  const h = H(); h.achats = 80; h.cotis = 25; assert.equal(E.calc(h).seuil, Infinity);
  assert.ok(E.robustesse(E.calc(h), h).al.some(a => a.code === 'seuil-inatteignable'));
});
test('trésorerie négative : alerte bloquante et score réduit', () => {
  const h = H(), c = E.calc(h), r = E.robustesse(c, h);
  assert.ok(c.minT < 0); assert.ok(r.al.some(a => a.code === 'tre-neg' && a.n === 'ko')); assert.ok(r.score <= 60);
});
test('plan sain : trésorerie positive, score élevé', () => {
  const h = H(); h.apport = 15000; const r = E.robustesse(E.calc(h), h);
  assert.ok(r.al.some(a => a.code === 'tre-ok')); assert.ok(r.score >= 75);
});
test('sensibilité : classée par effet décroissant', () => {
  const s = E.sensibilite(H());
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].d >= s[i].d);
});
test('déterminisme : deux calculs identiques', () => assert.deepEqual(E.calc(H()), E.calc(H())));
