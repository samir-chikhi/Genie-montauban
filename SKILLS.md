# Skills IA installés

Skills issus de [skills.sh](https://www.skills.sh/), l'annuaire de capacités
réutilisables pour agents IA (Claude Code, Cursor, Copilot…).

Ils sont versionnés dans `.claude/skills/` et donc actifs automatiquement dans
ce dépôt. Pour les rendre disponibles sur **tous** vos projets (c2fa.fr,
krissbarthe, MUSIVA, chikhi-fr…), lancez `bash install-skills.sh` sur votre
poste : cela les installe au niveau utilisateur.

## Sites web (HTML statique)

| Skill | À quoi ça sert |
|---|---|
| `frontend-design` | Direction visuelle, typographie, mise en page — évite le rendu « template générique » |
| `web-design-guidelines` | Relecture des pages selon les bonnes pratiques d'interface web |
| `accessibility` | Audit WCAG 2.2 : navigation clavier, lecteurs d'écran, contrastes |
| `performance` | Temps de chargement, Core Web Vitals, poids des images |

## Référencement

| Skill | À quoi ça sert |
|---|---|
| `seo` | SEO technique : balises meta, sitemap, indexation |
| `seo-audit` | Audit SEO complet : pourquoi une page ne se positionne pas |
| `ai-seo` | Être cité par ChatGPT, Perplexity, Claude — exploite les fichiers `llms.txt` déjà présents sur les sites |
| `schema` | Données structurées JSON-LD (LocalBusiness, Course, Event) pour les résultats enrichis Google |
| `site-architecture` | Arborescence des pages, navigation, maillage interne |
| `cro` | Optimisation des conversions sur les pages tarifs, inscription et contact |

## Données et outils

| Skill | À quoi ça sert |
|---|---|
| `baserow` | Lecture et écriture dans les bases Baserow (activités, adhérents, réservations) |
| `find-skills` | Cherche et installe automatiquement de nouveaux skills selon le besoin |
| `grill-me` | Relecture critique et exigeante du code avant publication |

## Utilisation

Aucune commande à retenir : décrivez simplement votre besoin et le skill
correspondant se déclenche. Par exemple « audite le SEO de la page tarifs »,
« ajoute les données structurées LocalBusiness », ou « liste les inscrits dans
Baserow ».

Pour mettre à jour les skills : `npx skills update`.
Pour en chercher d'autres : `npx skills find <mot-clé>`.
