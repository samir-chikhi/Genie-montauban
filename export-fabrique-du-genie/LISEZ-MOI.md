# La Fabrique du Génie · dossier d'export

Préparé le 7 octobre 2026. Quatre dossiers.

| Dossier | Contenu | À faire |
|---|---|---|
| `simulateur-autonome.html` et `outil-aides-maquette.html` | Les deux outils en un seul fichier chacun : double-clic, ils s'ouvrent dans le navigateur (internet requis pour les polices). | Essayer en premier |
| `01-simulateur-business-plan/` | Le simulateur, prêt à devenir un dépôt GitHub. Moteur testé (16 tests), interface en 12 étapes, exports CSV et PDF, documents de cadrage. | Suivre `docs/MISE-EN-LIGNE.md` |
| `02-maquette-outil-aides/` | Maquette de l'outil d'aides à la charte du Génie, branchée sur les 8 fiches et 15 sources du dépôt `aide-entreprises`. Ouvrir `maquette-aides.html` dans un navigateur. | Choisir si elle remplace l'interface actuelle de l'outil |
| `03-site-genie/` | Le bouton « Trouver des aides » ajouté à la page Entreprendre du site. | Fusionner la branche après vérification de `aides.genie-montauban.fr` |
| `04-documents-source/` | Étude comparative, présentation, fiches d'aides (JSON) et notes sur les sources de l'outil d'aides. | Archivage |

## Où se trouvent les outils

- Outil d'aides : dépôt https://github.com/samir-chikhi/aide-entreprises (public), adresse prévue https://aides.genie-montauban.fr/.
- Simulateur : adresse prévue https://simulateur.genie-montauban.fr/ (à créer, voir le pas-à-pas).

## Limites connues

- Les règles fiscales et sociales du simulateur sont des paramètres d'exemple (`01-simulateur-business-plan/docs/REGLES-A-VALIDER.md`). À faire valider avant l'ouverture au public.
- L'outil d'aides ne contient aujourd'hui que 8 fiches. Les API Aides-Entreprises et Aides-territoires demandent des clés que seul le propriétaire du compte possède.
- Les adresses `aides.` et `simulateur.genie-montauban.fr` n'ont pas pu être testées depuis l'environnement de travail.
