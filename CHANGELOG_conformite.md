# CHANGELOG — Mise en conformité Académie / Qualiopi / RGPD

Chantier réalisé le 23/09/2026 sur la branche `conformite-academie-2026`,
à partir de `20260923_memo_corrections-site-academie_v1.md`. Trois commits
(P0, P1, P2), une archive de chaque page réécrite dans `_archives/`.

**Avant de publier quoi que ce soit sur ce chantier : remplir tous les
`[À COMPLÉTER]` listés en fin de document (surlignés en jaune sur le site),
faire relire `cgv-formation.html` et `reglement-interieur-formation.html`
par MUSIVA, et redéployer `apps-script.gs` dans l'éditeur Google (voir
mémoire de session « Apps Script : redéploiement manuel ») pour activer le
formulaire d'inscription académie.**

---

## P0 — avant tout audit (commit `6414340`)

| Fichier | Avant | Après |
|---|---|---|
| `academie.html` | « OPCO / finançable », « certification Qualiopi à venir », prix « 45€ à partir de » | Toute mention OPCO rattachée à MUSIVA (« Qualiopi via MUSIVA »), suppression de « à venir », prix « 45–65€, 3 modules gratuits » |
| `academie.html` | Section Financements citant BNP Paribas 82, Crédit Agricole NMP, Caisse d'Épargne sans convention, France Travail « conventionnement AIF » inexistant, Département 82 présenté comme acquis | Noms de banques retirés (« nous consulter »), formulation AIF correcte (« peut être sollicitée »), Département 82 marqué « sous réserve de financement » |
| `academie.html` | Fenêtre de module : objectifs, public, programme, cadeau uniquement | + bloc Qualiopi complet par module (méthodes, évaluation, infos pratiques, accessibilité, résultats, contacts, organisme, date de maj), bouton Imprimer la fiche |
| `academie.html` | Objectifs non observables (« comprendre », « maîtriser », « savoir ») sur A1, A3, A6, B1, B2, B3, B5, B6, C1, C3, C4 | Reformulés avec verbes observables, précédés de « À l'issue du module, le participant sera capable de : » |
| `index.html` | GA4 chargé au chargement de la page, avant tout consentement | `gtag('consent','default',{denied})` puis chargement dynamique de gtag.js uniquement après clic « Accepter » ; boutons Accepter/Refuser au même poids visuel ; mémorisation 6 mois |
| `mentions_legales.html` | Représentant légal obsolète (Samir Chikhi) | Andrea Caro-Gomez, Présidente (AG août 2026) ; paragraphe Formations/MUSIVA ; prestataires techniques listés |
| — | CGV et règlement intérieur formation inexistants | `cgv-formation.html`, `reglement-interieur-formation.html` créés (marqués **[PROJET À FAIRE VALIDER PAR MUSIVA]**) |
| 15 pages publiques + 404 | — | Pied de page : liens CGV formation, Règlement formation, Gérer les cookies |

## P1 — RGPD, formulaires, inscription (commit `0bcd9d0`)

| Fichier | Avant | Après |
|---|---|---|
| `confidentialite.html` | Un seul responsable (Génie), pas de base légale par traitement | Traitements Académie (MUSIVA) et proposition-formateur (Formspree) détaillés, base légale, transferts hors UE, répartition Génie/MUSIVA |
| `proposition-formateur.html` | **Le formulaire n'envoyait jamais les données** (le JS affichait « Merci ! » sans appel réseau) ; endpoint Formspree au format email obsolète | Vrai `fetch()` avec repli email en cas d'échec. **Testé le 23/09/2026 : l'endpoint Formspree renvoie une erreur 400 (Bad form post request)** — le formulaire est donc en échec géré proprement (message d'erreur + mailto), mais ne parvient à personne tant que Samir n'a pas créé un formulaire sur formspree.io et remplacé l'URL (voir commentaire dans le fichier) |
| `proposition-formateur.html` | « Rémunération... défrayée » ; « Aucune donnée transmise à des tiers » (faux, Formspree est un tiers) | Texte rémunération corrigé (MUSIVA rémunère, pas de bénévolat) ; mention RGPD honnête sur Formspree ; champs statut/SIRET/déclaration d'activité/CV/charte ajoutés |
| — | Inscription par `mailto:` simple, sans trace structurée | `inscription-academie.html` (nouvelle page) : formulaire complet, préremplissable par `?module=A1`, questionnaire de positionnement (3 questions par module), CGV formation, RGPD |
| `apps-script.gs` | — | Nouvelle action `INSCRIPTION_ACADEMIE` / fonction `traiterInscriptionAcademie` (calquée sur `traiterContact` existante — aucune écriture dans le Sheet des réservations, donc **aucun risque sur son schéma**). **Inactive tant que Samir n'a pas collé le fichier dans l'éditeur Apps Script et créé une nouvelle version du déploiement** |
| `academie.html`, `inscription-academie.html`, `proposition-formateur.html`, `cgv-formation.html`, `reglement-interieur-formation.html` | Google Fonts chargées depuis fonts.googleapis.com/gstatic.com | Playfair Display + DM Sans auto-hébergées (`assets/fonts/`, `assets/css/fonts.css`), CSP resserrée (`style-src 'self'`, `font-src 'self'`) |
| 16 pages | Lien « Admin » visible dans le pied de page public | Retiré (page toujours accessible par URL directe, `noindex`) |
| — | — | `SECURITE_admin.md` : revue en lecture seule de l'authentification admin (déjà solide : hash, rate limiting, jetons serveur) |

## P2 — qualité, accessibilité, cohérence (commit à suivre)

- Accroches non vérifiables adoucies : « Automatisation en prod » → « Objectif : 1 automatisation fonctionnelle », « créer 1 automatisation... ce soir » → « vous travaillez à créer... pendant la session », « 3 visuels prêts à publier ce matin » → « objectif 3 visuels finalisés ».
- Date « Catalogue mis à jour le 23 septembre 2026 » ajoutée en bas d'`academie.html`.
- Section « Accueil des personnes en situation de handicap » ajoutée (indicateur 26).
- Fenêtre modale : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus posé sur le bouton de fermeture à l'ouverture, focus rendu au déclencheur à la fermeture, focus piégé dans la fenêtre (Tab/Shift+Tab).
- Filtres par filière : `aria-pressed` géré dynamiquement (le clavier fonctionnait déjà, ce sont de vrais `<button>`).
- `rel="noopener"` : déjà présent sur tous les `target="_blank"` du site — rien à corriger (vérifié par grep).
- `inscription-academie.html` ajoutée au sitemap (`generate_seo.py`). `admin.html`/`espace-membres.html` déjà absents de `robots.txt` et du sitemap (convention existante du site, voir `CLAUDE.md`) — rien à faire.

### Non traité, à faire en suivi

- **P1-6 (partiel)** : seules 5 pages ont leurs polices auto-hébergées. Les ~14 autres pages publiques utilisent d'autres familles/graisses (DM Mono, DM Serif Display, Syne, Fraunces, Cabinet Grotesk, Playfair 900) non téléchargées dans ce chantier — periomètre volontairement limité aux pages du chantier académie pour ne pas risquer une régression visuelle mal vérifiée ailleurs.
- **P1-8** : renommage du profil tarifaire « MUSIVA » en « Tarif plein » **non fait**, comme demandé explicitement par le mémo (« À CONFIRMER par Samir avant modification »).
- **P2-5 (partiel)** : les pictogrammes emoji (⏱ 🌙 ☀️ 💶 📹 etc., plusieurs dizaines d'occurrences sur les 18 cartes de modules) ne sont pas encore enveloppés dans `<span aria-hidden="true">` avec doublon texte. Le contraste `slate-400` sur fond sombre n'a pas été mesuré.
- **P2-7** : pas de page dédiée « espace formateurs » regroupant canevas/charte/procédure de signalement/pièces à fournir — le canevas et la charte n'existaient pas dans le dépôt (fichiers annoncés par le mémo mais non joints) ; en attendant, `proposition-formateur.html` invite à les demander par email.
- Financement Département 82 (A3, C1, C6) : affiché « sous réserve de financement » car son acquisition réelle n'a pas pu être vérifiée — à confirmer ou infirmer par Samir avant publication.

---

## Complétés le 23/09/2026 (fournis par Samir en conversation)

| Placeholder | Valeur | Où |
|---|---|---|
| `EMAIL_MUSIVA` | contact@musiva.fr | academie.html, cgv-formation.html, reglement-interieur-formation.html, confidentialite.html, mentions_legales.html |
| `REF_PEDAGO`, `REF_HANDICAP`, `REF_SIGNALEMENT` | Samir CHIKHI (contact@musiva.fr) — une seule personne couvre les trois rôles, à confirmer que c'est bien voulu à terme | academie.html, cgv-formation.html, reglement-interieur-formation.html |
| `RNA_GENIE` | W822009896 | mentions_legales.html |
| `SIRET_GENIE` | 100 178 730 00014 | mentions_legales.html |

## Reste à remplir avant publication définitive

| Placeholder | Où | Contenu attendu |
|---|---|---|
| `CATEGORIE_QUALIOPI` | academie.html, cgv-formation.html | Catégorie du certificat Qualiopi (a priori « actions de formation ») |
| `MEDIATEUR_CONSO` | cgv-formation.html | Médiateur de la consommation désigné par MUSIVA |
| `ACCES_PMR` (détail sanitaires) | academie.html | Détail accessibilité au-delà de la salle Maria Montessori |
| `FINANCEMENTS_ACQUIS` | academie.html | Financements réellement obtenus (Département 82, mécénat…) |
| Capital social MUSIVA, adresse de correspondance | cgv-formation.html | Données SASU |
| Délai de réponse aux réclamations | cgv-formation.html | Nombre de jours |
| Conditions de remboursement stagiaire | cgv-formation.html | Politique d'annulation MUSIVA |
| TVA / exonération | cgv-formation.html | Régime applicable à MUSIVA |
| Articulation rétractation 10j/14j pour un module de 3h | cgv-formation.html | Validation juridique |
| Durée de conservation des données Académie | confidentialite.html | Ex. 5 ans (preuves de formation) — actuellement laissé en placeholder |
| Date de lancement des premières sessions | academie.html (section Nos résultats) | Date réelle |
| Effectif par module (min/max) | academie.html (`DEFAULTS.effectif`) | Actuellement 6–12 par défaut pour tous les modules |
| Méthodes pédagogiques par module | academie.html (`DEFAULTS.methodes`) | Actuellement un texte générique commun à tous les modules — à affiner module par module par chaque formateur |
| Hébergement local des polices (14 pages restantes) | mentions_legales.html + follow-up | Voir section « Non traité » ci-dessus |

Chaque `[À COMPLÉTER]` restant est visible en jaune sur le site (classe
`.todo`, définie dans `assets/css/footer.css`) pour que Samir les repère
facilement.
