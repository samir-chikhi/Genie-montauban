# Espace membres : inviter quelqu'un (2 minutes)

Seules les personnes invitées peuvent se connecter. Quand quelqu'un clique sur
« Demander un accès en un clic » (écran de connexion), tu reçois un e-mail sur
contact@genie-montauban.fr avec son prénom et son e-mail. Ensuite :

1. Ouvre https://supabase.com/dashboard, puis le projet **genie-montauban**.
2. Menu de gauche : **Authentication** → **Users**.
3. Bouton **Add user** → **Send invitation**.
4. Colle l'e-mail de la personne → **Send invitation**.
5. Réponds-lui : « C'est fait ! Va sur https://genie-montauban.fr/espace-membres.html,
   saisis ton e-mail et clique sur le lien que tu recevras. »

À sa première connexion, le site lui demande le prénom à afficher.

## Si « ça ne marche pas »

- **La personne ne reçoit rien** : regarder les spams. Supabase (offre gratuite)
  n'envoie que **quelques e-mails par heure pour tout le site** ; au-delà, l'écran
  affiche « Trop de liens envoyés récemment ». Il suffit d'attendre une heure.
- **Le lien mène sur une page d'erreur ou sur l'accueil** : dans Supabase,
  **Authentication → URL Configuration** :
  - *Site URL* : `https://genie-montauban.fr/espace-membres.html`
  - *Redirect URLs* : `https://genie-montauban.fr/**`
- **Retirer quelqu'un** : Authentication → Users → ⋯ sur la ligne → **Delete user**.
