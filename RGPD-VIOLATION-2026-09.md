# Violation de données du 22–23 septembre 2026 — dossier RGPD

Trois documents, à traiter dans cet ordre :

1. **§2 — Registre des violations.** Obligatoire sans exception (art. 33.5). Ne
   s'envoie à personne : se conserve et se présente à la CNIL si elle demande.
2. **§3 — Notification à la CNIL.** À déposer sur https://notifications.cnil.fr
   **avant le jeudi 25 septembre 2026** (72 h après la prise de connaissance).
3. **§4 — Information des adhérents.** Si le risque est qualifié d'élevé (art. 34).

Les passages entre `[ ]` sont les seuls à compléter : ce sont des informations
que je n'ai pas. Tout le reste est factuel et vérifié.

> **Avertissement.** Je ne suis pas avocat et ceci n'est pas une consultation
> juridique. C'est un dossier factuel solide, rédigé à partir des constats
> techniques réels, que tu peux déposer tel quel ou faire relire. Les choix de
> qualification (notamment le « risque élevé » du §4) t'appartiennent : c'est
> l'association, responsable de traitement, qui tranche.

---

## 1. À vérifier avant de déposer

**a) Combien de personnes sont concernées ?**
Ouvre le classeur et relève le nombre de lignes de `Clients`, `Reservations`
et `Adhesions` (hors ligne d'en-tête). Le nombre de *personnes distinctes* est
inférieur au total des lignes — un adhérent qui a réservé dix fois compte pour
une personne. Un ordre de grandeur suffit, la CNIL accepte l'approximation.

**b) Depuis quand le classeur était-il ouvert ?**
Le partage a été ouvert pour que la page d'accueil puisse afficher les avis.
Retrouve la date de mise en ligne de cette section (historique Git de
`index.html`, ou souvenir daté). À défaut : « depuis [mois/année], date
approximative de la mise en ligne du module d'avis ».

**c) Y a-t-il des données sensibles (art. 9) ?**
Cherche dans `Clients` (colonnes `Structure`, `Profil tarifaire`) et
`Reservations` (colonne `orga`, `profil`) des lignes rattachées à un
**syndicat** — le profil tarifaire « Asso Villebourbon / Syndicat salariés »
existe dans la grille. Si de telles lignes existent, la violation porte sur une
**appartenance syndicale**, donnée sensible : le §4 devient obligatoire et il
faut le signaler à la CNIL. Regarde aussi la colonne `Notes` des adhésions,
qui est en texte libre et peut contenir n'importe quoi.

**d) L'historique des versions du classeur** (Fichier → Historique des
versions) ne montre pas les consultations, seulement les modifications. Une
modification inattendue par un tiers serait un signal grave — mais son absence
ne prouve rien, la fuite était en lecture seule.

---

## 2. Registre des violations (à conserver, ne pas envoyer)

**Responsable de traitement :** Association Génie, [adresse du siège],
représentée par [Prénom NOM], [président / présidente].
**Référence interne :** VIOL-2026-001
**Personne ayant traité l'incident :** [Prénom NOM]

| | |
|---|---|
| **Date de début de l'exposition** | [à compléter — voir §1.b], date approximative |
| **Date de prise de connaissance** | 22 septembre 2026, par signalement d'un adhérent |
| **Date de fin de l'exposition** | 23 septembre 2026, vers 8 h 50 |
| **Nature** | Violation de **confidentialité** par divulgation non autorisée (art. 4.12) |
| **Origine** | Erreur de configuration interne. Ni acte malveillant, ni intrusion. |

**Description des faits.** Le classeur Google Sheets support de l'activité de
l'association était partagé en lecture avec « tous les utilisateurs disposant
du lien », sans authentification requise. L'identifiant de ce classeur figurait
en clair dans le code source de la page d'accueil du site genie-montauban.fr,
accessible à tout visiteur. Toute personne consultant le code source de la page
pouvait donc ouvrir le classeur intégral.

**Cause technique.** La section « avis » de la page d'accueil lisait un onglet
du classeur directement depuis le navigateur du visiteur, via l'URL d'export
CSV de Google. Ce mécanisme exige que le classeur soit lisible sans
authentification. Or le partage Google s'applique au **classeur entier** et non
à un onglet : l'ouverture nécessaire à la publication des avis a rendu
accessibles tous les autres onglets.

**Catégories de personnes concernées :** adhérents de l'association ; personnes
ayant effectué une réservation d'espace ; personnes ayant soumis un formulaire
de contact ou un avis.
**Nombre approximatif :** [à compléter — voir §1.a] personnes.

**Catégories de données concernées :**

| Onglet | Données |
|---|---|
| `Clients` | prénom, nom, e-mail, téléphone, structure, profil tarifaire, adresse IP, date de dernière connexion |
| `Reservations` | identité, e-mail, téléphone, organisation, espace réservé, date, horaires, montant |
| `Adhesions` | identité, e-mail, téléphone, **adresse postale**, montant et mode de paiement, notes libres |
| `Tokens` | **jetons de connexion à usage unique**, en clair, valables 1 heure |
| `Config` | empreinte cryptographique du mot de passe d'administration |
| `Avis_Qualite` | avis, y compris non publiés, et remarques internes |

**Aucune donnée bancaire** n'était présente : les paiements transitent par
HelloAsso et Stripe, qui conservent les moyens de paiement sur leurs propres
systèmes. Seuls le montant et le mode de règlement figuraient au classeur.

**Données sensibles (art. 9) :** [à confirmer — voir §1.c]. Le profil tarifaire
« Syndicat salariés » existe dans la grille : si des lignes y sont rattachées,
la violation porte sur une appartenance syndicale.

**Conséquences probables :**
1. **Prise de contrôle de compte.** L'onglet `Tokens` exposait en temps réel
   les liens de connexion à l'espace « Mon compte ». Un tiers qui surveillait
   le classeur pouvait utiliser le lien d'un adhérent avant lui.
2. **Hameçonnage ciblé.** La combinaison identité + e-mail + téléphone +
   historique de réservations permet des messages frauduleux très crédibles,
   se réclamant de l'association.
3. **Divulgation d'habitudes de présence.** Les réservations révèlent les
   jours, horaires et lieux de présence de personnes identifiées.
4. **Sollicitation commerciale non désirée** à partir des coordonnées.

Le risque lié au mot de passe d'administration est considéré comme faible : son
empreinte était exposée, mais le mot de passe comportait 16 caractères tirés
aléatoirement, ce qui rend une attaque hors ligne non réalisable en pratique.
Il a néanmoins été changé.

**Impossibilité d'identifier les accès.** Google ne journalise pas les
consultations par des tiers sur un compte Gmail personnel. Il est donc
impossible d'établir si des accès ont eu lieu, ni par qui. L'association ne
peut pas démontrer l'absence d'accès.

**Mesures correctives prises :**

| Date | Mesure |
|---|---|
| 22/09/2026 | Audit technique complet du site et de ses modules |
| 23/09/2026 | Suppression de la cause : la page d'accueil ne lit plus le classeur, les avis transitent par une interface serveur qui ne renvoie que les avis approuvés, sans coordonnées |
| 23/09/2026 | Identifiant du classeur retiré de toutes les pages publiques |
| 23/09/2026 | **Retrait du partage public du classeur** — fin de l'exposition |
| 23/09/2026 | Invalidation de tous les jetons de connexion et de toutes les sessions ouvertes |
| 23/09/2026 | Changement du mot de passe d'administration, empreinte déplacée hors du classeur, salée et itérée |
| 23/09/2026 | Jetons de connexion désormais stockés sous forme d'empreinte : une nouvelle fuite du classeur ne permettrait plus de les rejouer |

**Mesures préventives :** interdiction documentée de toute lecture directe du
classeur depuis un navigateur ; interdiction de stocker un secret dans le
classeur ou dans le dépôt de code ; vérification trimestrielle du partage ;
tests automatisés bloquant la réintroduction de la faille.

---

## 3. Notification à la CNIL — https://notifications.cnil.fr

Formulaire « Notifier une violation de données ». Notification **initiale**,
complétée ultérieurement si nécessaire (art. 33.4). Réponses prêtes à recopier :

**Organisme concerné** — Association Génie, [SIRET], [adresse].
**Contact** — [Prénom NOM], [président / présidente], [e-mail], [téléphone].
*L'association ne dispose pas d'un délégué à la protection des données ; sa
désignation n'est pas obligatoire au regard de l'article 37 du RGPD.*

**Date de découverte** — 22/09/2026.
**La violation est-elle terminée ?** — Oui, le 23/09/2026 vers 8 h 50.
**Type de violation** — Violation de confidentialité.
**Origine** — Erreur de configuration interne (paramètre de partage d'un
fichier hébergé, associé à la publication de l'identifiant du fichier dans le
code source d'une page publique). Aucun acte malveillant, aucune intrusion.

**Circonstances** — Reprendre le paragraphe « Description des faits » et
« Cause technique » du §2.

**Catégories et nombre de personnes** — Reprendre le §2.
**Catégories de données** — Reprendre le tableau du §2, en précisant l'absence
de données bancaires et [le cas échéant] la présence de données relatives à
une appartenance syndicale.

**Conséquences probables** — Reprendre les quatre points du §2, en indiquant
qu'il est impossible d'établir si des accès ont eu lieu.

**Mesures prises** — Reprendre les deux tableaux du §2.

**Les personnes ont-elles été informées ?** — [Oui, le (date) / Information en
cours de préparation, prévue le (date)].

> **Si le délai de 72 h est dépassé**, le formulaire demande de le justifier
> (art. 33.1). Formulation honnête : « La priorité a été donnée à la
> qualification technique de la violation et à sa cessation effective, obtenue
> le 23/09/2026. La notification a été déposée dès l'établissement des faits. »
> Une notification tardive reste très préférable à une absence de notification.

---

## 4. Message aux adhérents (art. 34)

**Faut-il l'envoyer ?** L'article 34 impose d'informer les personnes lorsque la
violation est susceptible d'engendrer un **risque élevé** pour leurs droits et
libertés. Mon analyse : **oui**, pour trois raisons — l'exposition de jetons de
connexion permettant d'accéder à un compte, l'impossibilité de démontrer
qu'aucun accès n'a eu lieu, et [le cas échéant] la présence de données
relatives à une appartenance syndicale.

L'article 34.3 prévoit des exceptions, notamment lorsque des mesures
postérieures écartent le risque élevé. Elles s'appliquent mal ici : fermer la
fuite empêche de nouvelles copies, mais ne reprend pas les données déjà
éventuellement copiées.

Au-delà du droit : un adhérent a trouvé la faille et en parlera. Dans une
association d'éducation populaire, l'apprendre par la rumeur coûterait plus
cher que de l'apprendre par toi.

---

> **Objet : information sur un incident de sécurité concernant vos données**
>
> Bonjour,
>
> Nous vous informons d'un incident de sécurité survenu sur nos outils de
> gestion, et des mesures prises pour y répondre.
>
> **Ce qui s'est passé.** Le fichier qui centralise les inscriptions, les
> adhésions et les réservations du Génie était accessible en lecture à toute
> personne disposant de son lien, sans mot de passe. Ce lien figurait dans le
> code source de notre site internet. Il ne s'agit pas d'un piratage, mais
> d'une erreur de configuration de notre part, dont nous sommes entièrement
> responsables. Un adhérent nous l'a signalée le 22 septembre ; l'accès a été
> fermé le 23 septembre au matin.
>
> **Les données concernées** peuvent inclure : vos nom et prénom, votre adresse
> e-mail, votre numéro de téléphone, votre adresse postale si vous avez adhéré,
> ainsi que l'historique de vos réservations (dates, espaces, montants).
> **Aucune donnée bancaire n'était concernée** : vos paiements sont traités par
> HelloAsso et Stripe, dont les systèmes n'ont pas été touchés.
>
> **Ce que nous avons fait.** L'accès public a été supprimé. La cause technique
> a été corrigée à la racine : notre site ne lit plus ce fichier. Tous les liens
> de connexion à l'espace « Mon compte » ont été invalidés, les mots de passe
> d'administration changés, et de nouvelles protections ont été mises en place.
> Cet incident a été signalé à la Commission nationale de l'informatique et des
> libertés (CNIL).
>
> **Ce que nous vous invitons à faire.** Aucune action n'est indispensable, mais
> par précaution :
> - Si vous utilisez l'espace « Mon compte », votre ancien lien de connexion ne
>   fonctionne plus : demandez-en simplement un nouveau.
> - Soyez attentif aux messages qui se réclameraient du Génie et vous
>   demanderaient un paiement, un mot de passe ou des informations personnelles.
>   **Nous ne vous demanderons jamais vos identifiants par e-mail ou par
>   téléphone.** Au moindre doute, appelez-nous au 06 51 50 97 18.
>
> **Vos droits.** Vous pouvez nous demander à tout moment l'accès, la
> rectification ou l'effacement de vos données, à genie.montauban@gmail.com.
> Vous pouvez également introduire une réclamation auprès de la CNIL
> (www.cnil.fr).
>
> Nous sommes sincèrement désolés. Nous avons préféré vous en informer
> directement et complètement, plutôt que de minimiser. Nous restons
> disponibles pour toute question.
>
> [Prénom NOM]
> [Président / Présidente] — Association Génie
