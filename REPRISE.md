# Reprise tâche — Redesign site Génie Montauban

## Branche de travail
`design/site-complet-slate-emerald`

## État actuel
- ✅ 5 pages redessinées (non-commitées) : `inscription.html`, `notre-histoire.html`, `proposition-formateur.html`, `reservation.html`, `tarifs.html`
- ❌ `index.html` — À RÉÉCRIRE (1456 lignes, thème actuel navy/gold/cream)
- ❌ Aucun commit, aucun push, aucune PR

## Design system à appliquer (identique aux 5 autres pages)
```css
:root {
  --bg-950: #0F172A; --bg-900: #1E293B; --bg-800: #334155;
  --slate-400: #94A3B8; --slate-300: #CBD5E1; --slate-200: #E2E8F0;
  --emerald: #10B981; --emerald-l: #34D399; --emerald-d: #059669;
  --violet: #8B5CF6;
  --glass-bg: rgba(255,255,255,0.05);
  --glass-border: rgba(255,255,255,0.08);
  --radius: 16px;
}
```

## Ce que index.html doit conserver IMPÉRATIVEMENT
1. Google Analytics tag `G-774PRH98LY`
2. JSON-LD LocalBusiness + FAQPage (lignes 31–166)
3. Fonts : Playfair Display + DM Sans + DM Mono
4. Hero : `facade.png` en background avec overlay sombre
5. Galerie photos : coworking3.jpg, bureau-cheminee.jpg, coworking4.jpg, bureau-laptop.jpg, coworking1.png
6. Section témoignages + TOUT le JS Google Sheets CSV (SHEET_ID, parseCSV, render, renderCards, gavFilter)
7. Section espaces avec filtre (filtrerEspaces) + toutes les 12 cartes
8. Section tarifs (tables, profils)
9. Valeurs, Services, Notre-histoire promo, Événements, Adhésion, Contact, FAQ
10. TOUT le JS : cookie consent, nav mobile, filtrerEspaces, showNotif, envoyerAdhesion (no-cors), envoyerContact (no-cors), smoothscroll
11. Apps Script URL : `AKfycbyJ-Dk-yZZNdfxFigchP953rNyjSLJv4oOVUbxzuAbX4kuBfwTFBJvnnLuJMLWRnd9c4w/exec`

## Changements de couleurs dans le JS témoignages
- `#C9993E` → `#10B981` (emerald)
- `#4A7C6F` → `#059669` (emerald-d)
- `#1C2B3A` → `#1E293B` (bg-900)
- cards background `white` → `rgba(30,41,59,0.8)`
- texte `#6B7A8A` → `#94A3B8`

## Nav homepage (10 liens, pas 6)
```html
<li><a href="#espaces">Espaces</a></li>
<li><a href="#tarifs">Tarifs</a></li>
<li><a href="#services">Services</a></li>
<li><a href="#rejoindre">Adhésion</a></li>
<li><a href="#contact">Contact</a></li>
<li><a href="notre-histoire.html">Notre histoire</a></li>
<li><a href="activites.html">Activités</a></li>
<li><a href="academie.html">Académie</a></li>
<li><a href="inscription.html">Mon compte</a></li>
<li><a href="reservation.html" class="nav-cta">Réserver</a></li>
```

## Après avoir écrit index.html : 3 commandes git
```bash
git add inscription.html notre-histoire.html proposition-formateur.html reservation.html tarifs.html index.html
git commit -m "Redesign complet site — dark slate + emerald glassmorphism (6 pages)"
git push -u origin design/site-complet-slate-emerald
```
Puis créer PR via GitHub MCP : `mcp__github__create_pull_request`
- repo : `samir-chikhi/genie-montauban`
- head : `design/site-complet-slate-emerald`
- base : `main`

## Commande de reprise
Dire à Claude : **"reprends REPRISE.md et finis le job"**
