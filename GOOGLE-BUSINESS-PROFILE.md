# Fiche d'établissement Google — diagnostic et plan d'action

**Établissement :** Génie Montauban - le Tiers Lieu, 12 rue du Génie, 82000 Montauban
**Période analysée :** juillet 2026 (rapport mensuel Google)
**Rédigé le :** 8 août 2026

---

## 1. Le diagnostic

### Les chiffres bruts

Google communique des variations, pas des valeurs absolues pour le mois précédent.
En reconstituant juin à partir des pourcentages :

| Indicateur | Juin (reconstitué) | Juillet 2026 | Variation |
|---|---:|---:|---|
| Consultations de la fiche | ~576 | **881** | +53 % |
| Recherches | ~122 | **186** | +53 % |
| Demandes d'itinéraire | ~58 | **42** | −27 % |
| Visites du site depuis la fiche | ~19 | **13** | −31 % |
| Appels | 5 | **1** | −80 % |
| Clics sur le chat | ≥1 | **0** | −100 % |
| **Total interactions** | **~83** | **56** | **−33 %** |

### La lecture

**Le taux de conversion de la fiche s'effondre.** Interactions ÷ consultations :
**14,4 % en juin → 6,4 % en juillet.** La fiche a été vue 1,5 fois plus et a converti
2,2 fois moins bien. Ce n'est pas un problème de visibilité, c'est un problème de
qualification du trafic.

**Les termes de recherche expliquent tout.** Les trois termes remontés par Google
totalisent 168 des 186 recherches, soit 90 % :

| Rang | Terme | Volume | Pertinence |
|---|---|---:|---|
| 1 | `but` | 91 | ❌ Hors cible — probablement l'enseigne BUT ou le diplôme BUT/IUT |
| 2 | `ressourcerie` | 39 | ❌ Hors cible — il n'y a pas de ressourcerie au Génie |
| 3 | `association montauban` | 38 | ✅ Pertinent |

Deux constats en découlent :

1. **Environ 70 % des recherches qui font apparaître la fiche ne correspondent à
   aucune activité du Génie.** Le terme `ressourcerie` n'apparaît nulle part sur le
   site — c'est donc la fiche Google, et non le site, qui envoie ce signal. La cause
   la plus probable est une **catégorie mal réglée** ou une **fiche fantôme** à la
   même adresse.

2. **Aucune recherche de marque dans le top.** Ni « génie montauban », ni « tiers
   lieu montauban ». Comme les trois premiers termes représentent déjà 90 % du
   volume, la notoriété de marque est marginale : tout le trafic vient de la
   découverte, sur des mots mal ciblés.

**La baisse des itinéraires est largement saisonnière.** 42 demandes en juillet, soit
1,4 par jour, en plein mois de congés. La comparaison pertinente est **juillet 2026
contre juillet 2025**, pas contre juin. Les appels (1) et le chat (0) sont des volumes
trop faibles pour être interprétés statistiquement.

---

## 2. Ce qui a été fait sur le site

Ces éléments sont livrés et déployés — rien à faire de votre côté.

- **Nouvelle page `venir-au-genie.html`** : plan d'accès complet (à pied depuis la
  gare, train, bus ligne 1, voiture et stationnement, vélo), bloc accessibilité PMR,
  carte, boutons d'itinéraire Google Maps / Waze / Apple Plans, et 8 questions
  fréquentes. C'est la page qui capte l'intention « comment y aller », celle qui
  précède une demande d'itinéraire.
- **Données structurées de l'accueil enrichies** : l'entité passe de `Organization`
  à `["NGO", "LocalBusiness"]`, avec identifiant stable `#organization`, coordonnées
  géographiques, horaires d'ouverture, `hasMap`, zone desservie, gamme de prix. Les
  variantes de nom incluent désormais **« Génie Montauban - le Tiers Lieu »**, le nom
  exact de la fiche Google — c'est ce qui aide Google à réconcilier site et fiche.
- **Avis Google mis en avant** : le bouton principal de la section avis pointait vers
  un Google Form, qui alimente les témoignages du site mais **n'a aucun effet sur le
  référencement local**. Un bouton « Nous laisser un avis Google » passe en première
  position ; le formulaire interne reste disponible en second.
- **Carte corrigée** : l'iframe de la page d'accueil utilisait un identifiant de lieu
  invalide (`0x12aecf1c6e4b6e0d:0x1`). Remplacée par une intégration par adresse,
  fiable et sans clé d'API.
- **Horaires harmonisés** : le site affichait « samedi sur réservation » alors que les
  données structurées et `llms.txt` déclaraient 9h–17h. Uniformisé en
  « samedi 9h–17h sur réservation » partout. **À vérifier : est-ce la bonne valeur ?**
  Si le samedi est en réalité fermé, il faut le corriger sur le site *et* sur la fiche.
- **Maillage interne** : liens vers la page d'accès depuis la navigation, le pied de
  page et le bloc contact. Page ajoutée au sitemap, à `llms.txt` et aux miroirs
  markdown destinés aux moteurs IA.

---

## 3. Ce qu'il reste à faire dans la fiche Google

Aucune de ces actions ne peut être faite depuis le dépôt : elles se passent dans
l'interface de la fiche d'établissement.

### Priorité 1 — cette semaine (≈ 45 minutes, impact fort)

- [ ] **Vérifier la catégorie principale.** C'est le levier n°1 : elle détermine sur
      quelles requêtes la fiche apparaît. Si elle est réglée sur « Ressourcerie »,
      « Association caritative » ou « Magasin de meubles d'occasion », c'est
      l'explication complète du trafic parasite.
      Choisir selon l'objectif :
      - remplir bureaux et salles → **Espace de coworking**
      - servir la mission d'éducation populaire → **Centre communautaire** ou **Association**
- [ ] **Ajouter 3 à 4 catégories secondaires** : salle de réunion, centre de formation,
      association, bureau à louer.
- [ ] **Chercher une fiche en double au 12 rue du Génie.** Une ancienne fiche, ou celle
      d'une structure hébergée, cannibalise le classement. Si elle existe : la signaler
      à Google pour fusion ou suppression.
- [ ] **Renseigner les horaires exceptionnels d'août.** Une fiche qui annonce « ouvert »
      pendant une fermeture brûle des visiteurs et dégrade le classement.
- [ ] **Vérifier que les horaires de la fiche correspondent au site** :
      lundi–vendredi 8h–19h, samedi 9h–17h.

### Priorité 2 — ce mois-ci

- [ ] **Remplir la section Produits / Services.** Tout le contenu est déjà rédigé dans
      `llms.txt` : coworking journée 15 €, salle Bourdelle 40 personnes 45 €/h, salle
      Olympe de Gouges 30 €/h, bureaux privatifs dès 180 €/mois, micro-formations dès
      45 €. Chaque entrée ajoute des mots-clés exploitables par Google. ~20 minutes.
- [ ] **Réécrire la description (750 caractères)** avec les termes à capter :
      tiers-lieu, coworking, salle de réunion, Montauban, gare, association ESS,
      ateliers, éducation populaire.
- [ ] **Cocher les attributs** : accès PMR, Wi-Fi gratuit, géré par une association,
      toilettes accessibles. Ils servent de filtres dans Google Maps.
- [ ] **Pré-remplir 8 à 10 questions/réponses.** Poser soi-même les questions est
      autorisé. Le contenu existe déjà : réutiliser la FAQ de `venir-au-genie.html`
      (parking, PMR, horaires, adhésion obligatoire ou non, accès depuis la gare).
- [ ] **Trancher sur la messagerie.** 0 clic et −100 % : soit on l'active en
      s'engageant à répondre vite — Google dégrade les fiches qui ne répondent pas —
      soit on la désactive pour ne pas laisser un bouton mort.
- [ ] **Ajouter le suivi UTM sur le lien du site** dans la fiche :
      `https://genie-montauban.fr/?utm_source=google&utm_medium=organic&utm_campaign=gbp`
      Sans cela, impossible de savoir dans GA4 ce que font les visiteurs venus de la fiche.
- [ ] **Récupérer le lien court d'avis** et le reporter dans le code (voir §4).

### Priorité 3 — en routine, tous les mois

- [ ] **Avis : viser +10 en 60 jours.** C'est le premier facteur, à la fois pour le
      classement local et pour la conversion. Méthode : QR code à l'accueil et sur les
      tables, demande systématique en fin d'atelier et aux adhérents, lien court par SMS.
- [ ] **Répondre à 100 % des avis sous 48 h**, y compris les positifs.
- [ ] **Publier 5 à 10 photos par mois**, prises au téléphone sur place. La façade en
      priorité — c'est elle qui permet de reconnaître le lieu en arrivant, et elle est
      directement corrélée aux demandes d'itinéraire. Puis les salles, les ateliers en
      cours, l'équipe.
- [ ] **Publier 1 à 2 posts par semaine.** L'agenda fournit la matière : Veillées du
      Génie, ateliers, événements. Format « Événement » avec date et bouton d'action.

---

## 4. La seule action à répercuter dans le code

Le lien « Nous laisser un avis Google » ouvre pour l'instant la fiche dans Google Maps
(le visiteur clique ensuite sur « Rédiger un avis »). Pour ouvrir **directement** le
formulaire d'avis — ce qui augmente nettement le taux de dépôt :

1. Dans la fiche d'établissement : **Demander des avis** → copier le lien court, de la
   forme `https://g.page/r/XXXXXXXXXXXX/review`
2. Remplacer l'URL à ces deux endroits, tous deux signalés par un commentaire HTML :
   - `index.html` — section `#avis`
   - `venir-au-genie.html` — section CTA finale

Tant que ce lien n'est pas connu, on peut aussi ajouter l'URL canonique de la fiche
dans le tableau `sameAs` des données structurées de `index.html` : c'est le lien
d'entité le plus explicite entre le site et la fiche.

---

## 5. Tableau de suivi mensuel

À remplir chaque mois à réception du rapport Google. La colonne qui compte vraiment
est le **taux de conversion** : c'est le seul indicateur qui ne se laisse pas duper
par un afflux de trafic non qualifié.

| Mois | Consultations | Recherches | Itinéraires | Clics site | Appels | Interactions | Taux conv. | Avis | Note |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Juin 2026 | ~576 | ~122 | ~58 | ~19 | 5 | ~83 | 14,4 % | | |
| Juillet 2026 | 881 | 186 | 42 | 13 | 1 | 56 | 6,4 % | | |
| Août 2026 | | | | | | | | | |
| Septembre 2026 | | | | | | | | | |

**Deux règles de lecture :**

- Comparer en **année glissante** (juillet 2026 contre juillet 2025), pas contre le
  mois précédent : l'activité d'un tiers-lieu est fortement saisonnière.
- Surveiller les **termes de recherche** en priorité. Si `but` et `ressourcerie`
  disparaissent du top après correction des catégories, les consultations vont
  *baisser* — et ce sera une bonne nouvelle : le taux de conversion, lui, remontera.
