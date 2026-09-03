# Phase 2 — automatiser la confirmation + les codes d'accès après un paiement Stripe

**But** : aujourd'hui, quand quelqu'un paie une place à L'Escale du Génie sur
Stripe, il ne reçoit **que le reçu de carte Stripe**. Personne n'est prévenu,
rien n'est écrit dans le Google Sheet, et les codes d'accès ne partent pas.

Deux solutions. La **A** est immédiate et sans code. La **B** est propre et
automatique de bout en bout.

---

## Solution A — codes dans la page de confirmation Stripe (5 min, sans code)

Les 4 codes d'accès sont fixes → on peut les afficher directement après le
paiement, sur chacun des 4 Payment Links.

Pour **chaque** lien (dashboard Stripe → **Paiements → Payment Links** →
ouvrir le lien → **Modifier**) :

1. Onglet **« Après le paiement »** (ou « Page de confirmation »).
2. Choisir **« Afficher un message de confirmation »**.
3. Coller par exemple :

   > Merci ! Votre place à L'Escale du Génie est réservée.
   > **Accès (espace Jean-Jacques Rousseau, 1er étage)** — porte de rue : `XXXX` ·
   > porte intérieure : `YYYY`.
   > Horaires : lun–ven 8h–19h, sam 9h–17h.
   > Première venue ? Pensez à régler l'adhésion : https://genie-montauban.fr/index.html#rejoindre

4. **Enregistrer**.

Limite : rien n'est écrit dans le Sheet, et l'e-mail Stripe standard ne
contient pas ce message (il faut que le client note les codes sur la page).
Pour un vrai e-mail + un suivi dans l'admin → solution B.

---

## Solution B — webhook Stripe → Apps Script (≈ 20 min)

Le code est déjà écrit : **`apps-script-stripe-webhook.gs`** dans ce dépôt.

### 1. Propriétés du script

Éditeur Apps Script (`script.google.com`, compte `genie.montauban@gmail.com`,
le projet du fichier `apps-script.gs`) → **Paramètres du projet** (roue
dentée) → **Propriétés du script** → ajouter :

| Propriété | Valeur |
|---|---|
| `STRIPE_WHSECRET` | une chaîne aléatoire que vous inventez (ex. `escale-wh-3fK9…`). Sert de mot de passe d'URL. |
| `STRIPE_SECRET_KEY` | *(recommandé)* la clé secrète **live** `sk_live_…` (dashboard Stripe → Développeurs → Clés API). Sert à re-vérifier chaque paiement. |
| `ESCALE_CODE_PORTE_RUE` | le vrai code de la porte de rue |
| `ESCALE_CODE_PORTE_INT` | le vrai code de la porte intérieure |

### 2. Coller le code

Dans l'éditeur : **＋ → Script**, nommer `stripeWebhook`, coller tout le
contenu de `apps-script-stripe-webhook.gs`. (Ou coller à la fin de
`Code.gs`/`apps-script.gs` — peu importe, même projet.)

### 3. Brancher une ligne dans `doPost`

Dans `doPost(e)`, juste après :

```js
const data = JSON.parse(e.postData.contents);
```

ajouter :

```js
// Webhook Stripe (L'Escale) : évènements « object: 'event' », pas d'action
if (!data.action && typeof data.type === 'string' && data.object === 'event') {
  return ok(stripeWebhook(data, e && e.parameter));
}
```

Ça n'affecte **aucun** flux existant (réservations, adhésions, admin, webhook
HelloAsso) : le test ne matche que la forme exacte d'un évènement Stripe.

### 4. Nouvelle version du déploiement

**Déployer → Gérer les déploiements → ✏️ (crayon) → Version : Nouvelle
version → Déployer.** L'URL `/exec` **ne change pas**.

### 5. Déclarer l'endpoint chez Stripe

Dashboard Stripe (mode **live**) → **Développeurs → Webhooks → Ajouter un
endpoint** :

- **URL** :
  `https://script.google.com/macros/s/AKfycb…/exec?stripe_whsecret=LE_MEME_SECRET_QUE_STRIPE_WHSECRET`
  *(reprendre l'URL /exec exacte du déploiement actuel, cf. mémoire projet)*
- **Évènements à écouter** : `checkout.session.completed` (celui-là suffit).
- **Ajouter l'endpoint**.

### 6. Tester

Stripe → l'endpoint → **« Envoyer un évènement de test »** →
`checkout.session.completed`. Puis faire un vrai paiement de 4 € avec une
vraie carte (remboursable depuis le dashboard). Vérifier :

- une ligne `STRIPE-cs_live_…` apparaît dans l'onglet **Reservations** ;
- l'acheteur reçoit l'e-mail « ✅ L'Escale du Génie — c'est réservé » avec
  les 2 codes ;
- `genie.montauban@gmail.com` reçoit la notif « 💳 L'Escale — … ».

Si rien : Stripe → l'endpoint → onglet **« Tentatives »** montre la réponse
d'Apps Script (code HTTP + corps JSON, ex. `NON_AUTORISE` = secret d'URL qui
ne correspond pas, `WEBHOOK_NON_CONFIGURE` = propriété `STRIPE_WHSECRET`
manquante).

---

## Reste éventuel (plus tard)

- **Carnet 10 journées** : aujourd'hui c'est un paiement unique de 140 €.
  Décrémenter un compteur de jetons à chaque venue = à construire (onglet
  dédié + colonne « jetons restants », ou un simple suivi manuel au début).
- **Avoir annulation 48 h** : géré à la main pour l'instant (rembourser ou
  créer un code promo Stripe).
- **Conflit de tarifs** : `espaces.html` (section #coworking) et
  `reservation.html` vendent encore le même espace J.-J. Rousseau à
  15/26/90/250 € via HelloAsso, alors que L'Escale le vend à 4/9/15 € via
  Stripe. À trancher : soit L'Escale ne couvre que l'usage ponctuel et
  `espaces.html` ne garde que semaine/mois, soit tout passe par L'Escale et
  on retire le coworking de `reservation.html` + `espaces.html`.
