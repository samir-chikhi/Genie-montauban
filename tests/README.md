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
- la limitation de fréquence du lien magique ;
- le mot de passe admin (hash salé et itéré, comparaison à durée constante,
  connexion sans lecture du classeur, blocage après trop de tentatives) ;
- l'endpoint public des avis : seuls les avis approuvés sortent, sans nom de
  famille, sans horodatage et sans la colonne interne « à améliorer » ;
- le stockage haché des jetons de lien magique ;
- l'absence, dans les pages publiques et dans `.mcp.json`, de l'identifiant du
  classeur, d'un appel direct à Google Sheets et de toute clé API en clair
  (garde-fous contre la réintroduction de la fuite de septembre 2026 —
  voir `SECURITE-URGENCE-2026-09.md`).

Le harnais ne simule pas le tableur : les fonctions qui lisent des
feuilles échouent volontairement, ce qui suffit pour tester les
contrôles d'accès placés en amont.
