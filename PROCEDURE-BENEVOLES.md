# Passer le relais : procédure

Document interne (non publié sur le site). Aucun code ni mot de passe ici.

## A. Pour Samir : mise en service (une seule fois, ~20 min)

1. **Site** : le push sur `main` publie `admin.html` tout seul (workflow GitHub).
2. **Backend** (obligatoire, sinon rien ne change en ligne) :
   1. Ouvrir le projet Apps Script avec le compte `genie.montauban@gmail.com`.
   2. Remplacer tout le contenu de l'éditeur par `apps-script.gs`, puis enregistrer.
   3. Déployer → Gérer les déploiements → ✏️ → **Nouvelle version** → Déployer.
      Ne pas créer un nouveau déploiement : l'URL `/exec` doit rester la même.
3. **Créer les 3 comptes initiaux** (Loic, Andrea, Marcelle) : dans l'éditeur Apps Script, choisir la fonction `creerBenevolesInitiaux` dans la liste en haut, cliquer **Exécuter**, puis ouvrir **Journaux d'exécution** : un code par personne s'affiche. Les noter tout de suite (ils ne seront plus affichés) et les transmettre en privé. Relancer la fonction ne recrée pas un compte déjà actif.
4. **Se connecter** sur `genie-montauban.fr/admin.html` : dans la liste, choisir « Moi — Samir (super admin) » + votre mot de passe actuel (inchangé). Les bénévoles choisissent leur prénom + leur code.
5. Ensuite, pour ajouter ou retirer quelqu'un : menu **Équipe et journal**.
6. Noter dans la fiche B « qui appeler en cas de doute » (nom + téléphone).

Si un bénévole perd son code : Équipe et journal → **Nouveau code** (l'ancien est coupé).
Si un bénévole arrête : **Retirer** (accès coupé tout de suite).
Pour vérifier à distance : le **journal** en bas de la même page (qui a fait quoi, ancien et nouveau prix, motif).

### Ce que peut faire un bénévole « Accueil »
- Voir « Aujourd'hui », le planning, les réservations, les adhésions.
- Confirmer, refuser, créer, modifier une réservation (date, horaire, salle, prix).
- Valider ou refuser une adhésion.

### Ce qu'il ne peut pas faire
- Supprimer définitivement, vider les données.
- Modifier la grille de tarifs, la configuration, les invitations de membres, l'équipe, le journal.
- Changer un prix sans motif. Remise de plus de 30 % de la grille : refusée sans l'accord du responsable
  (réglage `PLAFOND_REMISE_ACCUEIL_PCT` dans `apps-script.gs` ; mettre 100 pour supprimer le plafond).

Les droits sont vérifiés par le serveur, pas seulement par l'affichage.

---

## B. Fiche bénévole (à imprimer ou envoyer)

**Accès** : genie-montauban.fr/admin.html
Choisir votre **prénom** dans la liste et saisir votre **code personnel** (reçu de Samir) dans le champ « Mot de passe». Ne le partagez pas.

**Chaque jour, 5 minutes**
1. Ouvrir l'écran **Aujourd'hui**.
2. Bloc **À traiter** : pour chaque ligne, cliquer
   - **✓ Confirmer** : le client reçoit un e-mail de confirmation ;
   - **Refuser** : la réservation est annulée ;
   - **✏️ Modifier** : changer date, horaire, salle ou prix, puis enregistrer.
3. Bloc **Aujourd'hui et demain** : vérifier qui vient, quelle salle, à quelle heure.
4. Quand « ✔ Rien à faire » s'affiche, c'est terminé.

**Si un client appelle pour réserver**
Bouton **Nouvelle réservation** : prénom, nom, e-mail, espace, date, durée. Le prix se calcule seul.

**Changer un prix**
Dans Modifier, remplir « Montant négocié », puis **choisir le motif** (obligatoire). Au-delà de 30 % de remise, appeler le responsable.

**Enregistrer : deux boutons**
- « sans prévenir le client » : pour corriger une erreur de saisie ;
- « et prévenir le client » : quand la date, l'horaire ou le prix change vraiment.

**Un doute ? Règle d'or : ne rien supprimer.**
Laisser la réservation « En attente » et appeler : ____________ (nom + téléphone).

Toutes vos actions sont notées dans un journal (c'est normal et sert à se protéger mutuellement).
Le bouton **❓ Aide** de l'écran Aujourd'hui rappelle ces étapes.

---

## C. Limites actuelles (à savoir)
- Les messages du formulaire de contact et les inscriptions Académie ne sont pas encore dans « À traiter » :
  ils arrivent toujours par e-mail sur la boîte du Génie. Les bénévoles doivent y avoir accès.
- Le journal est un onglet « Journal » créé automatiquement dans le classeur Google.
- Le mot de passe responsable reste celui d'aujourd'hui.
