# Audit des sources externes

## 02/09/2026 — premières vérifications

- `https://aides.gouv.fr` : la résolution DNS a échoué depuis l’environnement de vérification. Ne pas conclure à l’absence d’API ; rechercher l’URL canonique ou un portail de données associé.
- `https://data.aides-entreprises.fr/api` : page officielle d’Open Data Aides-Entreprises. L’accès à l’API demande une authentification. Le site expose des rubriques Documentation, Cas d’usage et Licence ; une inscription ou un accès autorisé sera nécessaire avant toute connexion automatisée.
- Pistes découvertes à auditer : API publique Aides Territoires, API Entreprise et Data.Subvention sur data.gouv.fr.

Règle d’intégration : conserver pour chaque source l’URL officielle, la méthode d’accès, la licence, la date d’audit et le statut de connexion ; ne pas contourner une authentification ni scraper une interface protégée.

## API publiques vérifiées

- `https://www.data.gouv.fr/dataservices/api-aides-territoires` : API ouverte, URL de base `https://aides-territoires.beta.gouv.fr/api`. Elle permet de récupérer les aides et critères d’Aides-Territoires : porteur, description, nature, zone géographique, critères d’éligibilité et lien de candidature. La plateforme indique environ 3 000 dispositifs et plus de 600 porteurs ; elle prévoit des flux automatiques pour les porteurs disposant d’une base structurée. C’est la priorité pour alimenter le moteur territorial.
- `https://datasubvention.beta.gouv.fr/api/` : API officielle orientée administrations et données associatives. Elle collecte les informations administratives et demandes de subventions des associations ; une partie des données est ouverte via api.gouv.fr. L’équipe indique qu’il faut la contacter pour l’utilisation de l’API ; ne pas l’utiliser comme catalogue public de dispositifs sans vérifier le périmètre et les droits d’accès.

## Compte Aides-Entreprises connecté

- La session du compte `contact@genie-montauban.fr` est active.
- La documentation confirme deux headers API : `X-Aidesentreprises-Id` et `X-Aidesentreprises-Key`.
- La documentation indique quatre voies d’accès : fichiers complets CSV/JSON/XML, API REST avec filtres, synchronisation cloud et webhook vers une URL choisie.
- Les champs utiles pour Fabrique du Génie incluent : identifiant, nom, objet, opérations éligibles, conditions, montant, bénéficiaires, date de validation, couverture géographique, horodatage, domaine, public ciblé, date de fin et statut.
- La base distingue notamment subvention, avance remboursable, prêt, prêt d’honneur, bonification d’intérêt, garantie, allègement fiscal, participation au capital, appel à projets, accompagnement gratuit et crédit-bail.
- La page `user/cloud-sync` propose une synchronisation vers Google Drive ; ce n’est pas une connexion directe à Fabrique du Génie. Pour l’application, privilégier l’API REST côté serveur ou un webhook vers un endpoint `/api/scheduled/` après validation des conditions du fournisseur.

## Portails particuliers et associations vérifiés

- `https://associations.gouv.fr/appels-projets` : page officielle recensant les appels à projets et AMI des ministères ; elle référence notamment FDVA et renvoie vers Aides Territoires, Le Compte Asso et Guid’Asso. Les contenus sont indiqués sous licence Etalab 2.0. Aucun endpoint API public n’a été identifié sur cette page ; prévoir une veille par flux/page et renvoi vers la fiche officielle.
- `https://www.service-public.gouv.fr` : portail officiel d’information et d’orientation ; il renvoie vers Entreprendre.Service-Public, des simulateurs et des démarches. Les contenus sont indiqués sous licence Etalab 2.0. Il doit être traité comme source de liens et d’explications, pas comme une base de scraping libre sans vérifier les conditions propres aux pages.
- `https://www.anah.gouv.fr` : source officielle des aides de l’Anah et renvoi vers France Rénov’, MaPrimeRénov’, MaPrimeAdapt’ et Ma Prime Logement Décent. La page ne fournit pas d’API publique évidente ; utiliser les pages officielles et les guides datés, avec date de vérification.
- `https://www.justice.fr/simulateurs/aide-juridictionnelle` : fiche officielle mise à jour le 5 août 2026, renvoyant vers le simulateur et les démarches. À classer comme simulateur/orientation pour particuliers, pas comme aide au financement d’entreprise.

## Concours validé

Le site dédié `concours-talents.com` n’a pas pu être chargé lors de l’audit. La fiche officielle Bpifrance Création `https://bpifrance-creation.fr/encyclopedie/financements/concours-a-creation-dentreprises/concours-nationaux-a-creation-ou-reprise` confirme toutefois que le **Concours Talents BGE de la création d’entreprise** est organisé par le réseau BGE et existe aux niveaux régional et national ; les catégories varient selon le territoire et il faut se rapprocher de l’antenne BGE locale. La source est donc institutionnelle et justifie l’entrée `concours-talents` du registre, avec renvoi vers la source officielle et vérification de la campagne en cours.
