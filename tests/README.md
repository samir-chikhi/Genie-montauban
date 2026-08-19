# Tests du script Apps Script

`apps-script.gs` tourne chez Google : on ne peut pas l'exécuter ici.
Ce harnais le charge dans un faux environnement Apps Script (Node) et
vérifie la logique de sécurité sans toucher au tableur ni aux emails.

```bash
node tests/apps-script.test.js
```

Couvre :
- les sessions client (délivrance, expiration, purge, non-usurpation) ;
- le verrou du webhook de paiement HelloAsso (secret absent, incorrect, valide) ;
- la limitation de fréquence du lien magique.

Le harnais ne simule pas le tableur : les fonctions qui lisent des
feuilles échouent volontairement, ce qui suffit pour tester les
contrôles d'accès placés en amont.
