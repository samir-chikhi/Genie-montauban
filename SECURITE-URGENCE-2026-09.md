# Fuite du classeur de réservations — constat, correctifs, procédure

**Date du constat :** 22 septembre 2026
**Statut au 23/09/2026 08h55 : LA FUITE EST FERMÉE.** Le partage public du
classeur a été retiré (vérifié sur les permissions Drive : plus aucune entrée
`type: anyone`). Les correctifs de code sont déployés en production.
**Reste à traiter :** le volet RGPD (§4), la révocation de la clé API (§3.4), et
la rotation du mot de passe admin s'il a été recopié quelque part (§3.3).

---

## 1. Ce qui s'est passé

L'adhérent a raison. Le classeur Google Sheets qui contient les réservations
était **partagé en lecture avec « tous les utilisateurs disposant du lien »**.
Vérification faite le 22/09/2026 sur les permissions du fichier :

```
role: reader,  type: anyone        ← n'importe qui, sans compte Google
role: owner,   type: genie.montauban@gmail.com
```

Et le lien n'était pas secret : **l'identifiant du classeur était écrit en clair
dans le code source de la page d'accueil** de genie-montauban.fr (`index.html`).
N'importe quel visiteur pouvait faire « Afficher le code source », copier
l'identifiant, et ouvrir le classeur entier.

### Pourquoi le classeur était public

Pas de piratage, pas d'erreur de manipulation : c'était une **conséquence
mécanique d'un choix technique**. La section « avis clients » de la page
d'accueil lisait l'onglet `Avis_Qualite` directement depuis le navigateur du
visiteur, via l'adresse d'export de Google (`/gviz/tq?tqx=out:csv`). Pour que
ça fonctionne, il faut que le classeur soit lisible sans être connecté.

Le problème : **Google partage un classeur entier, pas un onglet.** En ouvrant
l'accès pour publier les avis, on a ouvert l'accès à tous les autres onglets.

### Ce qui était exposé

| Onglet | Contenu | Gravité |
|---|---|---|
| `Clients` | prénom, nom, e-mail, téléphone, structure, profil tarifaire, IP, dernière connexion | **Données personnelles** |
| `Reservations` | identité + e-mail + téléphone + espace + date + heure + montant de chaque réservation | **Données personnelles + habitudes de présence** |
| `Adhesions` | identité, e-mail, téléphone, **adresse postale**, montant et mode de paiement | **Données personnelles + financières** |
| `Tokens` | les liens magiques de connexion « Mon compte », **en clair et valides 1 h** | **Prise de contrôle de compte** |
| `Config` | l'empreinte (hash) du mot de passe admin | Sérieux (voir nuance ci-dessous) |
| `Avis_Qualite` | les avis, y compris non approuvés et remarques internes | Modéré |

**Le point le plus grave n'est pas la liste de contacts, c'est l'onglet
`Tokens`.** Quelqu'un qui surveillait le classeur voyait arriver, en direct, le
lien de connexion d'un adhérent qui venait d'en demander un — et pouvait s'en
servir avant lui pour entrer dans son espace « Mon compte ».

**Nuance sur le mot de passe admin :** son empreinte était lisible, mais le mot
de passe lui-même faisait 16 caractères tirés au hasard. Le casser hors ligne
n'est pas réalisable en pratique. On le change quand même par principe (§3.3) :
on ne garde pas un secret dont on sait qu'il a fuité.

**Durée d'exposition : inconnue.** Google ne journalise pas les consultations
par des tiers sur un compte Gmail personnel. Il est donc **impossible d'établir
la liste des personnes qui ont accédé au classeur**, ni même de savoir si
quelqu'un l'a fait. Cette incertitude compte dans l'analyse RGPD (§4).

---

## 2. Ce que j'ai corrigé dans le code

Tout est sur la branche `claude/genie-montauban-security-audit-0dbk0o`.
Les 35 tests automatiques passent (`node tests/apps-script.test.js`).

**La cause racine — la page d'accueil ne lit plus le classeur.**
`index.html` appelle désormais l'API Apps Script (`?action=GET_AVIS`), qui ne
renvoie que les avis approuvés et notés ≥ 4, réduits aux champs affichés :
prénom (premier mot seulement, pour ne pas publier « Marie Dupont »), note,
service, témoignage. Ni e-mail, ni horodatage, ni la colonne interne « à
améliorer ». **Le classeur peut donc redevenir privé sans casser le site.**

**Les autres correctifs**, par ordre d'importance :

- **Liens magiques stockés hachés.** L'onglet `Tokens` ne contient plus le
  jeton lui-même mais son empreinte. Une prochaine fuite du classeur ne
  permettrait plus de rejouer un lien de connexion.
- **Mot de passe admin sorti du classeur.** Son empreinte vit maintenant dans
  les Propriétés du script (jamais partagées, jamais exportées), **salée et
  itérée 10 000 fois** — c'est-à-dire recalculée en boucle, ce qui rend une
  attaque par dictionnaire des milliers de fois plus coûteuse. La comparaison
  se fait à durée constante. La bascule est automatique à la première connexion.
- **Identifiant du classeur retiré de toutes les pages publiques** :
  `index.html`, `admin.html` (l'URL du classeur y descend maintenant *après*
  connexion, avec une session admin valide) et la page d'archive
  `archives/index_avant_refonte_20260731.html`, qui trainait le même identifiant.
- **Mot de passe admin retiré de l'URL.** Il partait dans `?payload={"password":…}`,
  donc dans l'historique du navigateur et dans les journaux d'exécution Apps
  Script. Il voyage maintenant dans le corps de la requête (POST).
- **CSP resserrée** : `docs.google.com` retiré des destinations autorisées de
  la page d'accueil — le navigateur refusera désormais un appel au classeur.
- **Clé API retirée de `.mcp.json`** (voir §3.4).
- **Deux fonctions de secours** ajoutées dans `apps-script.gs` :
  `urgenceCouperFuite()` (§3.1) et `verifierPartageClasseur()` (§3.5).

### Ce qui était déjà correct — à ne pas défaire

L'audit n'a pas trouvé d'autre trou. À mettre au crédit de l'existant :
les actions admin vérifient la session **côté serveur** (`requireAdmin`), le
webhook HelloAsso exige un secret partagé, les pages « Mon compte » exigent un
jeton de session lié à l'e-mail (connaître l'adresse ne suffit pas), le lien
magique est à usage unique et expire en 1 h, il y a une limitation à 5
tentatives par heure sur la connexion admin et sur l'envoi de liens, et les
règles RLS de Supabase (espace membres) sont correctement écrites.

---

## 3. Ce que tu dois faire, dans cet ordre

### 3.1 — Couper la fuite (5 minutes, le plus urgent)

Le plus simple : **une seule fonction fait tout**.

1. Ouvre https://script.google.com, connecté en `genie.montauban@gmail.com`
2. Ouvre le projet du site, puis le fichier `Code.gs`
3. Colle le contenu à jour de `apps-script.gs` (voir §3.2) et enregistre
4. En haut, dans la liste déroulante des fonctions, choisis **`urgenceCouperFuite`**
5. Clique **Exécuter**
6. Google va demander une autorisation supplémentaire (accès à Drive, nécessaire
   pour retirer le partage) → **Autoriser**

La fonction fait quatre choses : elle repasse le classeur en privé, elle vide
l'onglet `Tokens` (les liens en circulation deviennent inutilisables), elle
ferme toutes les sessions ouvertes, et elle génère un nouveau mot de passe
admin. Elle t'envoie le compte-rendu et le nouveau mot de passe par e-mail.

**Si l'étape 5 échoue**, fais-le à la main — c'est l'essentiel :
> Ouvre le classeur → bouton **Partager** (en haut à droite) → section
> **Accès général** → passe de « Tous les utilisateurs disposant du lien » à
> **« Restreint »** → **Terminé**.

Tu peux le faire tout de suite, avant même de toucher au code : le site
affichera juste « Les avis ne sont pas disponibles pour le moment » à la place
des avis, jusqu'au déploiement du §3.2. Rien d'autre ne casse.

### 3.2 — Déployer les correctifs

**Le site (front)** : fusionner la branche dans `main` suffit, le workflow
GitHub Pages fait le reste.

**Le backend (Apps Script)** — rappel, éditer le fichier dans le dépôt ne
change *rien* en production :
1. https://script.google.com → le projet du site → `Code.gs`
2. Remplacer tout le contenu par celui de `apps-script.gs`, enregistrer
3. **Déployer → Gérer les déploiements → ✏️ (crayon) → Nouvelle version → Déployer**
4. Ne pas créer un nouveau déploiement : l'URL `/exec` doit rester la même

Vérifier ensuite que la page d'accueil réaffiche bien les avis.

### 3.3 — Nouveau mot de passe admin

Si tu as lancé `urgenceCouperFuite()`, il est déjà dans ta boîte mail : range-le
dans ton gestionnaire de mots de passe **puis supprime l'e-mail**. Sinon, lance
`definirMotDePasseAdmin()` depuis l'éditeur.

### 3.4 — Révoquer la clé API 21st.dev ✅ fait le 23/09/2026 (clé régénérée)

Le dépôt GitHub est **public**, et le fichier `.mcp.json` y contenait une clé
API en clair (`21st_sk_0166…`). Je l'ai retirée du fichier, **mais elle reste
dans l'historique Git** — la réécrire sur un dépôt public ne servirait à rien,
elle a déjà pu être moissonnée.

→ Va sur https://21st.dev, **révoque cette clé, génère-en une nouvelle**, et
mets-la dans une variable d'environnement `MAGIC_21ST_API_KEY` (le fichier
pointe maintenant dessus) plutôt que dans le fichier.

### 3.5 bis — Si `urgenceCouperFuite()` dit « Partage NON modifié »

Message rencontré le 23/09/2026 :
`Specified permissions are not sufficient to call DriveApp.getFileById`

Ce n'est pas un bug du script. Apps Script déduit les autorisations dont un
projet a besoin en lisant le code — sauf quand le **manifeste** du projet
(`appsscript.json`) fige explicitement la liste. C'est le cas ici : Drive n'y
figure pas, donc l'autorisation n'est jamais demandée, même en réautorisant.

**Le partage se ferme alors à la main** (20 secondes, §3.1) — c'est l'action qui
compte, le reste de la fonction s'est bien exécuté.

Pour que `urgenceCouperFuite()` et `verifierPartageClasseur()` fonctionnent
ensuite (utile pour la vérification trimestrielle, non urgent) :

1. Dans l'éditeur Apps Script : **Paramètres du projet** (roue dentée à gauche)
2. Cocher **« Afficher le fichier manifeste appsscript.json dans l'éditeur »**
3. Ouvrir `appsscript.json`, ajouter dans la liste `oauthScopes` :
   `"https://www.googleapis.com/auth/drive"`
4. Enregistrer, relancer la fonction, **accepter la nouvelle autorisation**

### 3.5 — Vérifier que c'est bien refermé

Dans l'éditeur Apps Script, lance **`verifierPartageClasseur()`** : le journal
doit afficher `OK — classeur restreint`. Ou, à la main : ouvre le lien du
classeur dans une fenêtre de navigation privée → tu dois tomber sur « Vous avez
besoin d'une autorisation ».

Pense aussi à vérifier le **formulaire d'avis** (`forms.gle/9qtVCMTJbaiJSQVw7`) :
ses réponses arrivent dans ce même classeur.

---

## 4. Le volet RGPD — à traiter en parallèle, sous 72 h

Ceci est une **violation de données à caractère personnel** au sens de
l'article 4(12) du RGPD : une violation de confidentialité, par divulgation non
autorisée de données personnelles. Le responsable de traitement est
l'association Génie, représentée par son président.

**Trois obligations distinctes :**

**a) Documenter — obligatoire, sans exception** (art. 33.5)
Tenir un **registre des violations** : date du constat, nature, catégories et
nombre approximatif de personnes concernées, conséquences probables, mesures
prises. Ce document n'est pas envoyé, il est conservé et présenté à la CNIL si
elle le demande. Ce fichier-ci peut en constituer la base.

**b) Notifier la CNIL — sous 72 h après la prise de connaissance** (art. 33.1)
Obligatoire *sauf* si la violation n'est pas susceptible d'engendrer un risque
pour les droits et libertés des personnes. **Ici, mon analyse est qu'il faut
notifier** : les données sont identifiantes et directement contactables (nom,
e-mail, téléphone, adresse postale), elles révèlent des habitudes de présence,
la fuite comportait un mécanisme de prise de contrôle de compte (les jetons), et
il est **impossible de démontrer que personne n'y a accédé** — or c'est à toi
qu'il reviendrait de le démontrer.
→ Formulaire en ligne : https://notifications.cnil.fr
→ **Dossier complet prêt à déposer** (registre des violations, contenu de la
  notification CNIL, message aux adhérents) : transmis à Samir hors dépôt.
  Ce document est interne à l'association et n'a pas sa place dans un dépôt
  public servi par GitHub Pages — le ranger dans le Drive de l'association.
→ Le délai court depuis aujourd'hui. Une notification tardive se justifie
(art. 33.1), une notification incomplète se complète ensuite (art. 33.4) :
**mieux vaut notifier dans les temps avec ce qu'on sait que d'attendre**.

**c) Informer les personnes concernées — si le risque est « élevé »** (art. 34)
Le seuil est plus haut que pour la CNIL. **Mon analyse est qu'il l'est ici**,
surtout à cause des jetons de connexion. Un message sobre aux adhérents, sans
dramatiser : ce qui s'est passé, quelles données, ce que vous avez fait, et le
fait qu'ils doivent redemander un lien de connexion. La transparence sur un
sujet pareil, dans une association d'éducation populaire, protège mieux la
confiance que le silence — et l'adhérent qui a trouvé la faille en parlera.

**Ce point relève de ta décision, pas de la mienne** : c'est le responsable de
traitement qui tranche. Si tu veux un avis extérieur avant d'envoyer, le
délégué à la protection des données d'une structure partenaire ou un juriste
peut relire en une heure. Je peux te rédiger le brouillon des trois documents
(registre, notification CNIL, message aux adhérents) si tu le souhaites.

**À ne pas oublier** : mettre à jour `confidentialite.html` si la politique de
confidentialité décrit les mesures de sécurité.

---

## 5. Pour la suite — règles à ne pas enfreindre

0. **Un secret ne se colle jamais dans une conversation**, un ticket ou une note
   partagée — y compris avec moi. Quand tu me transmets un journal d'exécution,
   retire la ligne du mot de passe. Un secret qui a transité par un canal de
   discussion doit être considéré comme usé : on le régénère.
   (Arrivé le 23/09/2026 ; les fonctions ont été corrigées pour ne plus faire
   apparaître le mot de passe dans le journal d'exécution — il ne part plus que
   par e-mail.)
1. **Ne jamais faire lire un Google Sheet directement par le navigateur.**
   C'est exactement ce qui a créé cette fuite. Toute donnée affichée sur le site
   passe par l'API Apps Script, qui filtre. Cette règle est aussi inscrite en
   commentaire dans `index.html` et dans `CLAUDE.md`.
2. **Un secret ne vit jamais dans le classeur ni dans le dépôt** — ni mot de
   passe, ni empreinte, ni clé API. Sa place est dans les Propriétés du script
   Apps Script, ou dans une variable d'environnement.
3. **`noindex` n'est pas une protection.** `admin.html` et `mon-compte.html`
   sont servies publiquement par GitHub Pages ; leur code source est lisible par
   tout le monde. Le `noindex` empêche le référencement, pas l'accès.
4. **Séparer les données des avis du reste.** À terme, mettre `Avis_Qualite`
   dans un classeur distinct : même si quelqu'un ouvrait à nouveau un partage
   par erreur, il n'y aurait rien de sensible dedans.
5. **Vérifier le partage tous les trimestres** avec `verifierPartageClasseur()`.
6. **Les notes de travail sont servies avec le site.** GitHub Pages publie tout
   le dépôt : `AUDIT-SITE-2026.md`, `DIAGNOSTIC-SYNCHRO.md`, `supabase-schema.sql`,
   ce fichier-ci… sont accessibles à `genie-montauban.fr/<nom-du-fichier>`. Comme
   le dépôt est déjà public, ça n'aggrave rien aujourd'hui, mais c'est une
   habitude à corriger : ranger ces notes dans un dossier `docs-internes/` exclu
   du déploiement, ou passer le dépôt en privé (GitHub Pages fonctionne aussi
   depuis un dépôt privé avec un compte Pro).
