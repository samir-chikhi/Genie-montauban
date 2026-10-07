# Mettre le simulateur en ligne, pas à pas

Durée : environ 20 minutes. Aucun logiciel à installer.

## 1. Créer le dépôt sur GitHub

1. Aller sur https://github.com/new (compte `samir-chikhi`).
2. Nom du dépôt : `simulateur-business-plan`. Visibilité : **Public** (obligatoire pour GitHub Pages gratuit).
3. Ne rien cocher (ni README, ni .gitignore, ni licence). Cliquer **Create repository**.

## 2. Envoyer les fichiers

1. Sur la page du nouveau dépôt, cliquer **uploading an existing file**.
2. Glisser **tout le contenu** du dossier `01-simulateur-business-plan` (les fichiers et dossiers, pas le dossier lui-même). Le dossier caché `.github` doit y figurer : s'il n'apparaît pas, dire à Claude de le pousser à votre place.
3. Cliquer **Commit changes**.

## 3. Activer la publication

1. Dépôt → **Settings** → **Pages**.
2. Dans **Build and deployment**, choisir **Source : GitHub Actions**.
3. Onglet **Actions** : attendre la coche verte du workflow « Publier le simulateur ». Si besoin, **Run workflow**.

L'adresse provisoire est `https://samir-chikhi.github.io/simulateur-business-plan/`.

## 4. Brancher l'adresse simulateur.genie-montauban.fr

1. Chez le gestionnaire du domaine `genie-montauban.fr`, ajouter un enregistrement DNS :
   type **CNAME**, nom **simulateur**, valeur **samir-chikhi.github.io**.
   (C'est le même principe que pour `aides`.)
2. Dépôt → **Settings** → **Pages** → **Custom domain** : `simulateur.genie-montauban.fr`, puis **Save**.
3. Attendre la vérification (quelques minutes à quelques heures), puis cocher **Enforce HTTPS**.

## 5. Rattacher à la page Entreprendre

Sur le site `genie-montauban.fr`, ajouter à côté du bouton « Trouver des aides » un bouton
« Simuler mon business plan » vers `https://simulateur.genie-montauban.fr/`. Claude peut le faire
dès que l'adresse répond.

## Vérifier

- L'adresse répond et affiche l'étape 1.
- `npm test` passe (onglet Actions : la ligne « tests » est verte).
- Modifier un prix à l'étape 2, recharger : la valeur reste.
