# Génie Montauban — site

Site vitrine + réservation d'un tiers-lieu associatif (ESS, éducation populaire) à
Montauban. HTML/CSS/JS statique, **pas de build**. Servi par **GitHub Pages**
depuis `main` (repo `samir-chikhi/Genie-montauban`, domaine `genie-montauban.fr`).

Samir n'est pas développeur : privilégier les explications claires et les
procédures pas-à-pas quand une action lui revient.

## Déploiement

- **Front** : tout push sur `main` déclenche `.github/workflows/deploy.yml` →
  lance `python generate_seo.py` (régénère `sitemap.xml`, `llms.txt`, `md/*`),
  committe ces fichiers via github-actions[bot], puis déploie Pages.
  → Ne PAS lancer `generate_seo.py` en local (Python bloqué par une stratégie
  de contrôle d'application sur cette machine) ; laisser le workflow le faire.
- **Cron** : le même workflow tourne aussi chaque jour à 5h17 UTC. Le bot
  committe sur `main` → **toujours `git fetch` + rebase avant un push**.
- Le workflow « pages build and deployment » affiche une croix rouge à chaque
  push : **c'est attendu**, le vrai déploiement (`Déploiement GitHub Pages`) passe.
- **Backend** = `apps-script.gs`, un projet Google Apps Script séparé.
  L'éditer dans le repo ne change **rien** en prod tant que Samir (ou moi via
  navigateur, compte `genie.montauban@gmail.com`) n'a pas collé le fichier dans
  l'éditeur Apps Script et créé une **nouvelle version** du déploiement
  (Déployer → Gérer les déploiements → ✏️ → Nouvelle version). URL `/exec`
  stable, ne pas en créer une nouvelle.

## Points fragiles

- **Pages privées** en `noindex,nofollow` : `admin.html`, `mon-compte.html`,
  `crypto-session*.html`, `reunion-conseil-*.html`. Ne PAS les remettre dans
  `robots.txt` (ça publiait leurs URLs). Le lien « Admin » discret dans le
  footer (`.footer-legal`, `opacity:.55`, `rel="nofollow"`) est **voulu** par
  Samir pour accéder à l'admin.
- **Footer** : bloc identique sur les 15 pages publiques. Styles autoportants
  dans `assets/css/footer.css` (13 pages ne chargent pas `assets/css/site.css`).
- **HelloAsso** : creds + `HELLOASSO_WEBHOOK_SECRET` dans les Propriétés du
  script ; l'URL de callback doit finir par `?whsecret=<ce secret>`.
- `generate_seo.py` : la liste `PAGES` pilote le sitemap ET les miroirs md.
  Une page indexable absente de cette liste n'est ni dans le sitemap ni dans
  `md/`.

## Mémoire détaillée

Voir `~/.claude/projects/.../memory/` (chargée à chaque session via `MEMORY.md`) :
redéploiement Apps Script, rebase cron, intégration HelloAsso, audit sécurité,
récupération de branche périmée, et la consigne « travailler économe en tokens »
(concision, pas de relecture inutile, batching, sous-agents seulement si demandé).
