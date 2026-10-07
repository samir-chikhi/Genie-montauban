# Simulateur de business plan · La Fabrique du Génie

Outil gratuit pour passer d'une idée à un prévisionnel sur 3 ans, en 12 étapes.
Site statique (HTML, CSS, JavaScript), **sans build**, publié sur GitHub Pages à
`https://simulateur.genie-montauban.fr/`. Il se rattache à la page Entreprendre du site
`genie-montauban.fr` mais vit dans son propre dépôt, comme l'outil d'aides
(`aide-entreprises` → `aides.genie-montauban.fr`).

## Ce que fait la version actuelle (0.1)

| Étape | État |
|---|---|
| 1 à 6 · idée, offre, ventes, charges, financement, cadre français | Saisie complète, un seul produit |
| 7 · prévision | Compte de résultat simplifié et trésorerie sur 36 mois, seuil de rentabilité, tableau et courbe |
| 8 · scénarios | Prudent, central, ambitieux, plus classement des variables qui pèsent le plus |
| 9 · rédaction | Texte généré à partir des chiffres (pas d'IA) |
| 10 · validation | Alertes automatiques, liste de relecture, zone de commentaire (non enregistrée) |
| 11 · export | PDF par impression du navigateur, CSV pour Excel, sauvegarde des hypothèses en JSON |
| 12 · suivi | Chiffre d'affaires réel comparé au plan, 6 mois |

Pas encore fait : bilan, BFR, TVA, impôt sur les résultats, plusieurs produits, Word, comptes
utilisateurs, espace conseiller. Détail dans `docs/FEUILLE-DE-ROUTE.md`.

## Organisation

```
index.html                 page unique
assets/css/simulateur.css  charte du Génie (nuit, brique, pierre, or ; arc surbaissé)
assets/js/engine.js        moteur financier : aucun accès à la page, testable seul
assets/js/app.js           interface : étapes, tableaux, courbes, exports
tests/engine.test.js       16 tests du moteur
docs/                      cadrage, règles à faire valider, feuille de route, mise en ligne
CNAME                      adresse du site
.github/workflows/pages.yml  tests puis publication automatique à chaque push sur main
```

Principe : le moteur calcule, l'interface affiche. Le texte du business plan est écrit à partir
des chiffres du moteur, jamais l'inverse. Les règles fiscales et sociales sont des paramètres
visibles, listés dans `docs/REGLES-A-VALIDER.md`.

## Travailler en local

```bash
npm test           # 16 tests du moteur
npm run serve      # puis ouvrir http://localhost:8080
```

Ouvrir `index.html` directement dans le navigateur fonctionne aussi.

## Mise en ligne

Voir `docs/MISE-EN-LIGNE.md` (pas à pas, sans compétence technique).

## Données et confidentialité

Les saisies restent dans le navigateur de la personne (`localStorage`). Rien n'est envoyé
à un serveur. Aucun secret, aucune clé d'API dans ce dépôt.
