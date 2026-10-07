# Fabrique du Génie — Aides & partenaires

Plateforme web de qualification des porteurs de projet et d’orientation vers un plan de financement actionnable. Le projet combine un questionnaire multi-critères, un moteur de correspondance explicable, un référentiel d’aides et de partenaires, ainsi qu’un registre de sources avec provenance et date de vérification.

## Fonctionnalités disponibles

L’interface permet de filtrer un projet par territoire, stade, forme juridique, secteur, type d’opportunité, code NAF, effectif, budget, besoin prioritaire, public bénéficiaire, situation d’emploi, âge et indicateurs d’innovation, de transition et d’impact. Les résultats affichent une pertinence estimée, un état d’action, un niveau d’urgence, les critères non confirmés, la source officielle et le partenaire à contacter.

Le référentiel initial couvre les subventions, exonérations, prêts d’honneur, garanties, aides territoriales, appels à projets, mécénat, fondations, réseaux d’investisseurs et concours. L’administration MVP permet d’ajouter, modifier et archiver localement des fiches avec URL officielle, date de vérification et état temporel.

## Installation locale

```bash
pnpm install
pnpm check
pnpm vitest run
pnpm dev
```

Le projet utilise React, Vite, Tailwind, Express, tRPC, Drizzle et Vitest. Le serveur ne doit pas être lancé avec un port codé en dur en production.

## Variables d’environnement

Copier `.env.example` vers `.env` en environnement local. Ne jamais committer les valeurs réelles. Les identifiants Aides-Entreprises doivent rester côté serveur :

```text
AIDES_ENTREPRISES_ID=
AIDES_ENTREPRISES_KEY=
AIDES_TERRITOIRES_API_TOKEN=
```

Les valeurs peuvent être utilisées pour appeler l’API Aides-Entreprises avec les headers `X-Aidesentreprises-Id` et `X-Aidesentreprises-Key`. Le dépôt contient uniquement les noms de variables, les tests de contrat et la documentation ; aucun secret n’est inclus.

## Sources et données

Le registre `shared/sourceRegistry.ts` contient les sources auditées, leur URL officielle, leur couverture, leur méthode d’accès, leurs formats et leur date de vérification. Les notes d’audit sont conservées dans `sources_api_notes.md`.

Les principales sources référencées sont Aides-Entreprises, son export open data data.gouv.fr, Aides Territoires, Data.Subvention, associations.gouv.fr, Service-Public.fr, Anah / France Rénov’, Justice.fr, les aides à la mobilité électrique, la Fondation de France, Admical, la DRAC Occitanie, Occitanie Angels et le Concours Talents BGE documenté par Bpifrance Création.

L’export public de secours Aides-Entreprises est documenté à l’adresse suivante : `https://data.cquest.org/dge_aides_entreprises/aides.json`. Son téléchargement doit être effectué côté serveur, avec traitement par lots et contrôle de taille. Il ne doit pas être chargé directement dans le navigateur.

## Synchronisation

`server/sourceSync.ts` fournit une inspection manuelle contrôlée de l’export public : requête HEAD, timeout, statut HTTP, date de vérification et erreur explicite. La synchronisation automatique, la persistance en base et le journal d’exécution doivent être ajoutés avant un usage de production à grande échelle. Aucun mécanisme ne doit contourner une authentification, un quota ou les conditions de réutilisation d’une source.

## Limites et conformité

Les scores sont des estimations d’orientation et ne constituent pas une décision d’éligibilité. Les conditions non confirmées doivent rester visibles et l’organisme financeur demeure seul compétent pour confirmer l’aide. Les règles de chaque source et les licences doivent être vérifiées avant republication de données détaillées.

Les sujets juridiques, fiscaux, comptables et financiers réglementés doivent être validés par les professionnels compétents. Les pages destinées aux particuliers, comme l’aide juridictionnelle ou certaines aides de l’Anah, doivent être séparées du financement des entreprises dans les évolutions du référentiel.

## Tests

La suite actuelle couvre le scoring, l’authentification de l’API Aides-Entreprises, la cohérence du registre de sources et le service de synchronisation. Avant toute évolution, exécuter `pnpm check && pnpm vitest run`.

## Réutilisation

Ce dépôt peut servir de base à un fork ou à une intégration dans un autre projet. Pour un déploiement public, remplacer la conservation locale de l’administration par une base de données avec authentification et rôles, ajouter une journalisation des synchronisations et faire relire les conditions de licence ainsi que les mentions réglementaires.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie automatiquement le client statique après chaque push sur `main`. L’URL publique actuelle est `https://samir-chikhi.github.io/aide-entreprises/`. Le sous-domaine prévu pour la page dédiée est `https://aides.genie-montauban.fr/`.

GitHub Pages n’exécute pas Express, tRPC, OAuth, Drizzle ni les appels serveur protégés. La version publiée fonctionne donc avec le référentiel embarqué côté client. Pour activer l’authentification, la persistance, l’administration distante et les API Aides-Entreprises, il faut conserver le serveur sur un hébergement adapté et configurer l’URL d’API côté client.

### Stratégie de routage GitHub Pages

Vite est construit avec `base: "/aide-entreprises/"` uniquement dans GitHub Actions. Le fichier `dist/public/404.html` est une copie de `index.html`, ce qui permet à GitHub Pages de remettre l’application SPA au navigateur lors d’une URL profonde. Le routeur détecte explicitement `/aide-entreprises` et `/aide-entreprises/` afin de rendre la page d’accueil publiée sous le chemin du dépôt.

GitHub Pages et son CDN peuvent conserver l’ancien `index.html` ou un ancien bundle pendant quelques minutes. Après un déploiement, utiliser un rechargement forcé du navigateur (`Ctrl+F5` ou `Cmd+Shift+R`) ; pour un contrôle technique, ajouter temporairement un paramètre de version à l’URL. Cette précaution ne contourne pas le cache côté utilisateur à long terme : elle sert uniquement à vérifier la dernière publication.

Pour relier `aides.genie-montauban.fr` à GitHub Pages, créer chez le registrar un enregistrement `CNAME` avec le nom `aides` et la cible `samir-chikhi.github.io` (sans ajouter `https://`). Supprimer tout enregistrement A ou CNAME concurrent pour `aides`, attendre la propagation DNS, puis vérifier HTTPS. Le fichier `CNAME` du dépôt est copié dans `dist/public` par `build:pages`.

L’URL canonique de secours reste `https://samir-chikhi.github.io/aide-entreprises/`. La version Pages est statique et ne fournit pas les routes Express/tRPC, l’authentification OAuth, la persistance Drizzle ou les secrets API. Ces fonctions nécessitent un serveur séparé. La page dédiée pourra être reliée depuis `https://www.genie-montauban.fr/` avec un lien vers `https://aides.genie-montauban.fr/`.
