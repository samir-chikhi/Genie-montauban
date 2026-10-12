# Page salon : mode d'emploi

Page : https://genie-montauban.fr/index-salon.html
Fichiers à imprimer : dossier `assets/salon/`.

## 1. À faire une seule fois avant le salon (5 minutes)

Le site est déjà à jour. **Le serveur (Apps Script) ne l'est pas encore** :
tant que cette étape n'est pas faite, la page s'affiche normalement, mais les
scans ne sont pas comptés. Le formulaire propose alors au visiteur d'envoyer sa
demande par SMS, et la demande est gardée sur son téléphone pour repartir plus tard.

1. Ouvrir https://script.google.com avec le compte `genie.montauban@gmail.com`,
   puis le projet du Génie.
2. Ouvrir le fichier de code, **tout sélectionner** (Ctrl+A), puis coller le
   contenu de `apps-script.gs` (version du dépôt GitHub). Enregistrer (Ctrl+S).
3. **Déployer → Gérer les déploiements → ✏️ (crayon) → Version : Nouvelle
   version → Déployer.** Ne pas créer de nouveau déploiement : l'adresse `/exec`
   doit rester la même.
4. En haut de l'éditeur, choisir la fonction **`salonInitialiser`** puis cliquer
   sur **Exécuter**. Les trois onglets apparaissent dans le classeur.
5. *(Facultatif)* Choisir **`installerBilanSalon`** puis **Exécuter** pour
   recevoir chaque soir à 20 h un e-mail de bilan. Les jours sans visite, rien
   n'est envoyé.
6. **Tester** : scanner le QR « général » avec votre téléphone, remplir le
   formulaire avec votre propre numéro, puis vérifier que l'e-mail
   « 📞 Salon — à rappeler » arrive dans la boîte du Génie.

Aucune nouvelle autorisation Google n'est demandée : le script utilise les mêmes
services qu'avant (classeur, e-mail).

## 2. Où voir les retours

| Quoi | Où | Quand |
|---|---|---|
| Chaque demande de rappel | E-mail **« 📞 Salon — à rappeler : Prénom (sujet) »** dans genie.montauban@gmail.com, avec le numéro cliquable | Tout de suite |
| Le tableau de bord | Classeur Google, onglet **`Salon_Bilan`** (le premier) : scans par QR, demandes par QR, taux de contact, scans et demandes par jour, demandes restant à rappeler | En direct |
| La liste à rappeler | Onglet **`Salon_Rappels`**. Une fois rappelé, remplacer « À RAPPELER » par « RAPPELÉ » dans la colonne Statut. La colonne « Suivi » sert à vos notes | En direct |
| Le détail des scans | Onglet `Salon_Visites` (une ligne par visite, anonyme) | En direct |
| Le récapitulatif | E-mail **« 📊 Salon — bilan du jj/mm »** | Chaque soir à 20 h (si l'étape 5 est faite) |

Le formulaire indique aussi, pour chaque contact, **quel QR il a scanné** et
**quelles rubriques il a regardées**. Vous savez donc de quoi lui parler avant
même de l'appeler.

## 3. Quel QR imprimer, et où le poser

Chaque QR mène à la même page, mais ouvre directement la bonne rubrique et
pré-remplit le sujet du formulaire. Le bilan les compte séparément.

| Fichier | Code dans le bilan | Où le poser |
|---|---|---|
| `affiche-qr-salon-A5.pdf` / `carte-A6-salon.png` | `salon` | Affiche principale du stand |
| `carte-A6-bureaux.png` | `bureaux` | Devant un indépendant, une TPE |
| `carte-A6-salles.png` | `salles` | Organismes de formation, entreprises |
| `carte-A6-academie.png` | `academie` | Salariés, demandeurs d'emploi |
| `carte-A6-fabrique.png` | `fabrique` | Porteurs de projet |
| `carte-A6-assos.png` | `assos` | Associations |
| `carte-A6-quartier.png` | `quartier` | Habitants, grand public |
| `planche-A4-cartes-QR.pdf` | — | **Le plus simple** : 2 feuilles A4, 4 cartes par feuille, traits de coupe |

Les QR seuls (`qr-*.png` pour l'imprimeur, `qr-*.svg` pour un agrandissement
type kakémono) sont dans le même dossier. Taille minimale d'impression : 3 cm
de côté (5 cm conseillés).

Le QR affiché dans la page elle-même (rubrique « Nous trouver ») est compté à
part, sous `partage` : il sert quand un visiteur montre la page à un collègue.

## 4. Le jour J

- Imprimer en couleur, sur papier mat (pas de reflet sous les spots du salon).
- Tester chaque carte imprimée avec deux téléphones différents (iPhone et Android).
- Le réseau passe mal dans les salons. Si l'envoi échoue, la page le dit au
  visiteur, garde sa demande sur son téléphone et lui propose un SMS pré-rempli
  vers le 06 51 50 97 18.

## 5. Après le salon

- Rappeler les contacts, puis passer leur statut à « RAPPELÉ ».
- Les demandes sont **effacées automatiquement au bout de 12 mois**, comme
  annoncé dans la page Confidentialité.
- Pour arrêter l'e-mail du soir : Apps Script → Déclencheurs (icône réveil) →
  supprimer `envoyerBilanSalon`.

## Pour le développeur

- Page : `index-salon.html`, `assets/js/salon.js`, `assets/css/salon.css`.
- API : actions `SALON_VISITE` et `SALON_RAPPEL` (`apps-script.gs`, section SALON).
- Tests : `node tests/salon.test.js`.
- Ajouter un public : une entrée dans `SALON_PUBLICS` (Apps Script) et dans
  `QR_ONGLET` (salon.js), puis un QR `index-salon.html?qr=<code>`. Si l'onglet
  `Salon_Bilan` existe déjà, ajouter aussi la ligne correspondante à la main.
