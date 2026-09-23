# Vérification sécurité — admin.html (P1-7 du mémo conformité du 23/09/2026)

Revue effectuée le 23/09/2026, en lecture seule (aucune modification d'`apps-script.gs`).

## 1. Lien « Admin » retiré du pied de page public

Fait dans ce chantier (commits P0 + P1) : le lien `admin.html` a été retiré du
pied de page des 16 pages publiques. La page reste accessible par URL directe
pour Samir — elle porte toujours `<meta name="robots" content="noindex,nofollow">`.

## 2. Authentification admin.html — déjà solide

Lecture de `apps-script.gs` (fonctions `adminLogin`, `requireAdmin`,
`verifierSessionAdmin`, `creerSessionAdmin`) :

- Le mot de passe n'est jamais transmis en clair côté serveur ni stocké en
  clair : comparaison par hash SHA-256 contre `ADMIN_PASSWORD_HASH` (feuille
  `Config`).
- Rate limiting anti force brute : 5 tentatives/heure (`rateLimitOk('adminlogin')`).
- Succès de connexion → jeton de session aléatoire (UUID + hash), **jamais
  dérivé du mot de passe**, stocké côté serveur dans `PropertiesService`
  (`ADMIN_SESSIONS`) avec expiration (`CONFIG.SESSION_ADMIN_H` heures).
- Toutes les actions d'écriture ou de lecture sensibles (`adminGetAll`,
  `getCalendarEvents`, `syncFromCal`, `addResa`, `updateResa`, `deleteResa`,
  `saveConfig`, `ADMIN_UPDATE_STATUS`) passent par `requireAdmin(data)`, qui
  vérifie le jeton côté serveur et refuse sinon (`NON_AUTORISE`).

Conclusion : aucune requête anonyme ne peut lire ou modifier les données
admin (réservations, config) — le contrôle est fait côté serveur, pas
seulement par la présence de l'écran de connexion côté client.

## 3. Point de vigilance identifié (existant, non lié à ce chantier)

`admin.html` (1821 lignes) contient encore une grande quantité de logique et
de références aux données. Aucune fuite de données personnelles n'a été
identifiée dans le HTML statique lui-même (pas de données en dur) : tout est
chargé dynamiquement via l'API Apps Script, qui est protégée comme décrit
ci-dessus.

## 4. Non traité dans cette revue

- Une revue complète du fichier `apps-script.gs` (2369 lignes) n'a pas été
  refaite en détail (cela a déjà fait l'objet d'un audit sécurité en août
  2026, voir mémoire de session). Cette revue s'est concentrée sur le point
  demandé par le mémo P1-7 : lien public + auth admin.
- `apps-script.gs` fait l'objet d'un chantier séparé en cours par ailleurs
  (fichier `apps-script.PROPOSE-v6.gs` et `RGPD-VIOLATION-2026-09.md` non
  suivis présents dans le dépôt à la date de cette revue) : ce chantier de
  conformité académie n'y touche pas, pour ne pas interférer.

**Rien n'a été cassé.** Aucune modification du backend Apps Script.
