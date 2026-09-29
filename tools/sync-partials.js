// sync-partials.js — recopie l'en-tête et le pied de page communs
// (_partials/header.html, _partials/footer.html) dans toutes les pages qui
// portent les marqueurs <!-- g:header --> … <!-- /g:header --> et
// <!-- g:footer --> … <!-- /g:footer -->. On modifie le menu UNE fois, le
// script le propage partout. Lancé par le workflow de déploiement ; on peut
// aussi le lancer à la main : node tools/sync-partials.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const parts = {
  header: fs.readFileSync(path.join(root, '_partials/header.html'), 'utf8').trim(),
  footer: fs.readFileSync(path.join(root, '_partials/footer.html'), 'utf8').trim(),
};
let n = 0;
for (const f of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const file = path.join(root, f);
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  for (const [k, html] of Object.entries(parts)) {
    const re = new RegExp('(<!-- g:' + k + ' -->)[\\s\\S]*?(<!-- /g:' + k + ' -->)');
    if (!re.test(out)) continue;
    // Page courante signalée dans le menu (accessibilité + style)
    const cur = html.replace(`href="${f}"`, `href="${f}" aria-current="page"`);
    out = out.replace(re, `$1\n${cur}\n$2`);
  }
  if (out !== src) { fs.writeFileSync(file, out); n++; }
}
console.log(`sync-partials : ${n} page(s) mise(s) à jour`);
