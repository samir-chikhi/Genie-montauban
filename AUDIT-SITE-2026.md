# Audit Complet — www.genie-montauban.fr
**Date :** Mars 2026
**Outil :** Analyse statique du code source + inspection technique
**Périmètre :** Site statique GitHub Pages (HTML/CSS/JS vanilla) + backend Google Apps Script

---

## 1. Analyse Technique — Vitesse, Code, Sécurité, SEO technique

### 1.1 Vitesse & Performance

**Note : 5/10**

| Problème | Sévérité | Impact |
|----------|----------|--------|
| Google Fonts chargé de façon bloquante (pas de `font-display: swap`) | Haute | LCP/FID |
| CSS entièrement inline dans chaque HTML (~78 Ko pour index.html) | Haute | Pas de cache inter-pages |
| Aucune minification HTML/CSS/JS | Moyenne | +20-30% de poids inutile |
| Logo en PNG 48 Ko (format non optimisé) | Moyenne | LCP |
| Aucun `loading="lazy"` sur les images | Moyenne | FCP |
| Pas de service worker / cache applicatif | Basse | Expérience offline nulle |
| Pas de compression gzip/brotli configurée (GitHub Pages la gère partiellement) | Info | — |

**Points positifs :**
- Aucune dépendance JS externe (pas de jQuery, Bootstrap) → bundle minimal
- Pas de font-icon lourd (SVG emoji natifs utilisés)
- `<link rel="preconnect">` défini pour Google Fonts

**Améliorations court terme (coût faible) :**
1. Ajouter `&display=swap` dans l'URL Google Fonts (déjà présent ✓) mais ajouter `font-display: swap` dans le CSS local
2. Convertir `logo.png` en `logo.webp` (économie ~60% de poids)
3. Ajouter `loading="lazy"` sur toutes les balises `<img>` sauf le logo nav
4. Extraire le CSS commun dans un fichier `style.css` partagé entre pages

---

### 1.2 Qualité du Code

**Note : 6/10**

**Problèmes identifiés :**

- **Duplication massive de CSS** : chaque fichier HTML contient la totalité du CSS (nav, footer, variables, etc.), dupliqué 8 fois. Aucune feuille de style partagée.
- **`mode:'no-cors'` sur tous les appels fetch** : les réponses HTTP sont opaques — les erreurs côté serveur (500, validation échouée) sont totalement silencieuses pour l'utilisateur. L'UX peut afficher "succès" même si la requête a échoué.
- **`APPS_TOKEN` vide** : la variable d'authentification API est vide et laissée en commentaire. L'API est donc ouverte sans clé.
- **Validation uniquement côté client** : les formulaires ne valident que dans le navigateur. Aucune validation côté backend n'est visible dans `apps-script.gs` (les données sont insérées directement dans le Google Sheet sans sanitisation documentée).
- **Gestion d'erreur contact incohérente** : le formulaire contact utilise `mode:'no-cors'` mais tente de lire la réponse (ce qui retourne toujours `undefined`), rendant `contact-success` toujours affiché même en cas d'échec.

**Points positifs :**
- HTML5 sémantique (balises `nav`, `section`, `footer`, `main`)
- Variables CSS bien définies et cohérentes sur toutes les pages
- Gestion du menu mobile bien implémentée

---

### 1.3 Sécurité

**Note : 4/10**

| Risque | Sévérité | Détail |
|--------|----------|--------|
| Pas de CSP (Content Security Policy) | Haute | Vulnérabilité XSS non atténuée |
| URL Apps Script exposée en clair dans le JS frontend | Moyenne | Inévitable avec ce stack, mais attention à l'abus |
| `APPS_TOKEN` vide = API sans authentification | Haute | N'importe qui peut soumettre des données ou spam le Google Sheet |
| Pas d'en-têtes de sécurité HTTP (X-Frame-Options, HSTS, etc.) | Moyenne | GitHub Pages ne configure pas ces headers par défaut |
| Admin accessible par URL directe (`/admin.html`) | Moyenne | robots.txt l'exclut des moteurs mais pas de vraie protection |
| Pas de rate limiting sur les formulaires | Moyenne | Risque de spam/flood du Google Sheet |

**Améliorations court terme :**
1. Configurer une `API_SHARED_KEY` dans Apps Script et renseigner `APPS_TOKEN` dans le JS (valeur identique des deux côtés)
2. Ajouter une vérification Google reCAPTCHA v3 (gratuit) sur les formulaires publics
3. Configurer un `_headers` file ou utiliser Cloudflare (gratuit) pour injecter les en-têtes de sécurité

---

### 1.4 SEO Technique

**Note : 6/10**

| Élément | Statut | Commentaire |
|---------|--------|-------------|
| `<html lang="fr">` | ✅ | Correct |
| `<title>` optimisé | ✅ | Bon titre sur l'accueil |
| `<meta description>` | ✅ | Présente et bien rédigée |
| `<meta keywords>` | ⚠️ | Ignoré par Google, neutre |
| `<link rel="canonical">` | ✅ | Présent sur l'accueil uniquement |
| Open Graph `og:image` | ❌ | **Manquant** — partage sur réseaux sociaux sans image |
| Données structurées JSON-LD | ❌ | **Absent** — opportunité majeure pour `LocalBusiness`, `Place` |
| Sitemap.xml | ⚠️ | Présent mais **URL incorrecte** : `mentions-legales.html` au lieu de `mentions_legales.html` |
| robots.txt | ✅ | Correct |
| `<link rel="canonical">` sur pages secondaires | ❌ | Absent sur reservation.html, inscription.html, etc. |
| Textes ALT sur images | ⚠️ | Logo a un alt, mais pas de photos donc peu d'impact |

**Améliorations court terme :**
1. **Corriger le sitemap.xml** : `mentions-legales.html` → `mentions_legales.html`
2. **Ajouter `og:image`** : créer une image de partage (1200×630px) représentant le lieu
3. **Ajouter JSON-LD `LocalBusiness`** sur l'accueil (nom, adresse, téléphone, horaires, GPS)
4. **Ajouter des canonicals** sur toutes les pages secondaires

---

## 2. Analyse Ergonomique — UX, Lisibilité, Navigation, Responsive

**Note globale : 7/10**

### 2.1 UX & Design

**Points forts :**
- Charte graphique cohérente et professionnelle (navy, or, crème)
- Typographie soignée (Playfair Display + DM Sans = bon équilibre serif/sans-serif)
- Cartes d'espaces bien structurées avec emoji, prix, CTA

**Points faibles :**
- **Aucune photo réelle des espaces** : le hero utilise un dégradé CSS. Les visiteurs ne peuvent pas visualiser les lieux. C'est un frein à la conversion majeur pour un tiers-lieu.
- **Pas de témoignages / preuve sociale** : aucune citation de membres, avis Google, logo de partenaires.
- **Tableau de tarifs complexe** : 12 espaces × 4 profils = tableau dense difficile à lire sur mobile.
- **Pas d'indication de page active** dans la navigation.

### 2.2 Lisibilité

- Tailles de polices correctes (16px base)
- Contrastes globalement bons, mais le texte muted (#6B7A8A) sur fond blanc peut être insuffisant (ratio ~3.5:1, en dessous du seuil WCAG AA de 4.5:1)
- Texte du footer sur fond sombre : à vérifier

### 2.3 Navigation

- Navbar sticky claire avec CTA toujours visible ✅
- Hamburger mobile fonctionnel ✅
- Ancres de navigation bien définies ✅
- **Problème** : fermeture du menu mobile lors du clic sur un lien fonctionne, mais le `onclick` inline sur le burger est une pratique déconseillée

### 2.4 Responsive

- Mobile-first avec breakpoints à 1024, 768, 600, 480px ✅
- Grille d'espaces responsive avec `auto-fill` ✅
- Tableau des tarifs : défilement horizontal sur mobile (acceptable mais peu intuitif)
- Formulaire réservation : côté sidebar disparaît sur mobile, le récapitulatif prix est donc moins visible

**Améliorations court terme :**
1. Ajouter au minimum 3-5 photos des espaces (même prises avec un smartphone)
2. Intégrer un ou deux témoignages de membres avec photo
3. Améliorer le contraste des textes `--muted` (passer de #6B7A8A à #586370 minimum)
4. Ajouter un indicateur visuel de page active dans la nav

---

## 3. Analyse Contenu — Clarté, Cohérence, SEO Sémantique

**Note globale : 7/10**

### 3.1 Clarté

- Proposition de valeur claire dès le hero : tiers-lieu ESS, Montauban, 1 min gare ✅
- Statistiques hero (12 espaces, 300+ m², PMR, 24h accès) percutantes ✅
- Descriptions des espaces concises et informatives ✅
- **Manquant** : qu'est-ce qu'un "tiers-lieu ESS" ? Les nouveaux visiteurs non familiers de l'ESS peuvent être désorientés. Une phrase d'accroche explicative manque.

### 3.2 Cohérence

- Nomenclature des espaces (personnages historiques/pédagogiques) : poétique mais peut dérouter sur les caractéristiques (qui est "Aristote" ? Un bureau ? Une salle ?)
- Cohérence visuelle parfaite entre toutes les pages ✅
- Même charte rédactionnelle sur tout le site ✅

### 3.3 SEO Sémantique

| Élément | Statut |
|---------|--------|
| H1 unique par page | ✅ |
| Hiérarchie H1>H2>H3 respectée | ✅ |
| Mots-clés locaux présents ("coworking Montauban") | ✅ |
| Contenu suffisant sur la page d'accueil | ✅ |
| Blog / actualités | ❌ Absent |
| Pages dédiées par espace (URLs propres) | ❌ Absent |
| Avis Google intégrés | ❌ Absent |

**Améliorations court terme :**
1. Ajouter une section "Actualités / Agenda" même minimaliste (2-3 événements) → contenu frais pour le SEO
2. Considérer des URLs propres pour les espaces principaux (`/espaces/salle-bourdelle`)
3. Intégrer le widget d'avis Google My Business

---

## 4. Analyse Conversion — CTA, Formulaires, Parcours Utilisateur

**Note globale : 5/10**

### 4.1 CTA (Appels à l'Action)

- CTA "Réserver →" toujours visible dans la navbar (or sur fond blanc) ✅
- Dual CTA dans le hero (primaire + secondaire) ✅
- Chaque carte d'espace a un CTA individuel ✅
- **Problème** : les CTAs "Bail longue durée" renvoient vers un formulaire de contact générique, sans mentionner le type d'espace concerné → friction inutile

### 4.2 Formulaires

| Formulaire | Problème |
|------------|---------|
| **Adhésion** | `mode:'no-cors'` → succès affiché sans confirmation réelle. L'utilisateur ne sait pas si sa demande est bien reçue. |
| **Contact** | Idem. De plus, validation minimale (email + message seulement) |
| **Réservation** | Complexe (4 étapes) mais bien guidée. Pas de récapitulatif prix en temps réel sur mobile. |
| **Inscription** | Multi-étapes bien conçue. PDF de secours disponible ✅ |
| **Login magic link** | UX moderne et pertinente ✅ |

### 4.3 Parcours Utilisateur

**Scénario 1 — Visiteur découvrant le site :**
1. Arrive sur la page d'accueil → hero clair ✅
2. Voit les espaces → mais pas de photos → hésitation ❌
3. Regarde les tarifs → tableau complexe ❌
4. Veut réserver → clique, processus en 4 étapes ✅
5. Doit créer un compte ou s'inscrire → **friction importante** ❌

**Scénario 2 — Membre cherchant à se reconnecter :**
1. Va sur "Mon compte" → magic link ✅
2. Attends l'email (délai variable Google) → peut frustrer
3. Accède au calendrier de ses réservations ✅

**Améliorations court terme :**
1. **Permettre la réservation sans compte** (ou simplifier l'inscription en 1 étape)
2. Ajouter un **numéro de téléphone cliquable** (`tel:`) bien visible dans le hero ET le footer
3. Ajouter un **chatbot/widget WhatsApp** (gratuit) pour les questions rapides
4. Ajouter une **FAQ** pour les questions récurrentes (horaires, accès PMR, parking)
5. Afficher des **plages de disponibilité indicatives** sur la page d'accueil

---

## 5. Conformité RGPD & Accessibilité

**Note globale : 5/10**

### 5.1 RGPD

| Élément | Statut | Commentaire |
|---------|--------|-------------|
| Politique de confidentialité | ✅ | Complète et bien structurée |
| Mentions légales | ✅ | Présentes |
| CGV | ✅ | Présentes |
| Bandeau cookies | ⚠️ | **HTML présent mais JavaScript non fonctionnel** |
| Consentement conditionnel | ❌ | Aucun script n'est chargé conditionnellement selon le consentement |
| Droits RGPD (accès, effacement, portabilité) | ✅ | Documentés dans la politique |
| Responsable traitement identifié | ✅ | Association Génie, 12 rue du Génie, 82000 Montauban |
| Registre des traitements | ❓ | Non vérifiable côté frontend |
| Analytics (pas de consentement nécessaire) | — | Pas d'analytics du tout actuellement |

**Problème critique :** Le bandeau cookies ne stocke pas le choix dans `localStorage` et ne bloque/active aucun script. Si des analytics sont ajoutés ultérieurement, ce sera non-conforme immédiatement.

**Correction immédiate nécessaire :**
```javascript
// À ajouter dans le JS du bandeau cookies
document.querySelector('.cookie-accept').addEventListener('click', () => {
  localStorage.setItem('cookie-consent', 'accepted');
  document.getElementById('cookie-banner').classList.remove('show');
});
document.querySelector('.cookie-refuse').addEventListener('click', () => {
  localStorage.setItem('cookie-consent', 'refused');
  document.getElementById('cookie-banner').classList.remove('show');
});
// Afficher uniquement si pas encore de choix
if (!localStorage.getItem('cookie-consent')) {
  document.getElementById('cookie-banner').classList.add('show');
}
```

### 5.2 Accessibilité (WCAG 2.1)

| Critère | Statut | Commentaire |
|---------|--------|-------------|
| `lang="fr"` sur `<html>` | ✅ | Correct |
| `aria-label` sur burger menu | ✅ | Présent |
| Textes ALT sur images | ✅ | Logo a un alt descriptif |
| Focus visible sur éléments interactifs | ⚠️ | CSS reset supprime outline par défaut |
| Contraste texte muted (#6B7A8A) | ❌ | Ratio ~3.5:1 < 4.5:1 requis (WCAG AA) |
| Navigation au clavier | ⚠️ | Non testée explicitement |
| Formulaires avec `<label>` associé | ✅ | Labels présents |
| ARIA sur modales/tabs | ⚠️ | Tabs sans `role="tablist"` ni `aria-selected` |
| PMR mentionné et mis en avant | ✅ | Espaces PMR identifiés |

**Améliorations accessibilité :**
1. Restaurer les outlines focus (`:focus-visible` avec style personnalisé)
2. Améliorer le contraste des textes muted
3. Ajouter `role="tablist"` et `aria-selected` sur les onglets d'espaces
4. Tester avec un lecteur d'écran (NVDA gratuit sur Windows)

---

## Synthèse des Notes

| Axe | Note /10 |
|-----|----------|
| Performance / Vitesse | 5/10 |
| Qualité du code | 6/10 |
| Sécurité | 4/10 |
| SEO technique | 6/10 |
| Ergonomie (UX/Design) | 7/10 |
| Lisibilité | 7/10 |
| Navigation & Responsive | 7/10 |
| Clarté du contenu | 7/10 |
| SEO sémantique | 6/10 |
| Conversion | 5/10 |
| RGPD | 5/10 |
| Accessibilité | 5/10 |
| **MOYENNE GÉNÉRALE** | **5.8/10** |

---

## Plan d'Action Priorisé (Court Terme, Faible Coût)

### Urgences (semaine 1)
1. **Corriger le sitemap.xml** : `mentions-legales.html` → `mentions_legales.html`
2. **Corriger le bandeau cookies** : implémenter le localStorage pour mémoriser le choix
3. **Sécuriser l'API** : configurer `API_SHARED_KEY` dans Apps Script + renseigner `APPS_TOKEN`
4. **Ajouter `og:image`** : créer une image de partage 1200×630px

### Court terme (semaine 2-4)
5. **Ajouter des photos** : 5-10 photos des espaces (smartphone suffisant)
6. **Ajouter JSON-LD LocalBusiness** sur l'accueil
7. **Améliorer les contrastes** : textes muted (#6B7A8A → #50606E minimum)
8. **Convertir logo en WebP** : économie de 60% sur le poids
9. **Ajouter canonicals** sur toutes les pages secondaires
10. **Ajouter témoignages** : 2-3 citations de membres

### Moyen terme (mois 2-3)
11. **Installer Google Analytics 4** (avec consentement conditionnel)
12. **Ajouter reCAPTCHA v3** sur les formulaires publics
13. **Extraire le CSS commun** dans un fichier partagé
14. **Créer une FAQ** sur l'accueil ou en page dédiée
15. **Passer par Cloudflare** (gratuit) pour les en-têtes de sécurité et la compression

---

## Résumé Stratégique

> **Comment ce site peut-il mieux servir sa mission et ses visiteurs ?**

Le site de Génie Montauban présente un excellent travail de design et de structuration pour un projet associatif ESS. La charte graphique est professionnelle, la navigation est logique, et l'infrastructure technique (GitHub Pages + Google Apps Script + Sheets) est ingénieuse et à coût quasi nul.

Cependant, le site souffre de trois obstacles majeurs à sa mission :

**1. L'invisibilité visuelle des espaces.** Un tiers-lieu vend avant tout une expérience et une atmosphère. Sans photos réelles, les visiteurs ne peuvent pas se projeter. C'est probablement le facteur de conversion le plus faible du site. **Priorité absolue : photographier les espaces** (même avec un smartphone, en heure de pointe pour montrer la vie du lieu).

**2. La friction dans le parcours de réservation.** Le processus en 4 étapes (espace → calendrier → créneaux → informations) est bien conçu mais oblige à créer un compte ou fournir beaucoup d'informations. Simplifier l'accès à une réservation "visiteur" ou afficher clairement un numéro de téléphone pour une réservation directe réduirait l'abandon.

**3. Des failles de conformité et de sécurité qui exposent la structure.** Le bandeau cookies non fonctionnel, l'API sans authentification, et l'absence de CSP sont des risques réels — à la fois juridiques (CNIL) et techniques (spam du Google Sheet). Ces corrections sont simples et urgentes.

Le potentiel SEO local est fort (Montauban est une ville de taille moyenne avec peu de concurrence en coworking ESS), mais il est sous-exploité sans données structurées, sans photos pour le Knowledge Graph Google, et sans analytics pour mesurer ce qui fonctionne.

**En résumé :** avec 2-3 jours de travail concentré sur les photos, la correction du bandeau cookies, la sécurisation de l'API, et l'ajout de données structurées, le site peut passer d'un outil informatif à un véritable outil de développement commercial au service de la mission ESS de Génie.
