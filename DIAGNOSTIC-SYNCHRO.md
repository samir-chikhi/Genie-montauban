# 🔍 Diagnostic Synchronisation Réservations — Génie Montauban

**Date** : 2026-09-10 | **Analyse** : Bidirectionnalité Calendar ↔ Sheets

---

## 📊 État actuel du système

### Architecture
```
Formulaire Public (reservation.html)
         ↓
   Apps Script (creerReservation)
         ↓
    Google Sheets (Reservations)
         ↓
   Google Calendar (ajouterAuCalendrier)
         ↓
    Admin Panel (admin.html, loadData + renderPlanning)
```

### Capacités par espace
| Espace | Capacité | Type | Risque actuel |
|--------|----------|------|---------------|
| Bourdelle | 1 | Salle | ⚠️ Voir 1 seule réservation |
| Freinet | 1 | Salle | ⚠️ Voir 1 seule réservation |
| Gouges | 1 | Salle | ⚠️ Voir 1 seule réservation |
| Montessori | 1 | Salle | ⚠️ Voir 1 seule réservation |
| Rousseau | 20 | Coworking | ✅ Accepte 20 simultanées |
| Aristote | 1 | Privé | ⚠️ Voir 1 seule réservation |
| Michel | 1 | Bureau jour | ⚠️ Voir 1 seule réservation |

---

## ✅ Points forts

1. **Anti-surbooking côté serveur** (ligne 641-685 apps-script.gs)
   - `LockService.getScriptLock()` : acquiert un verrou pendant 20s
   - `compterChevauchements()` : vérifie si capacité dépassée
   - Rejet immédiat si créneau occupé (msg : `CRENEAU_OCCUPE`)

2. **Synchronisation Sheets → Calendar**
   - `ajouterAuCalendrier()` : crée automatiquement l'événement au statut "EN_ATTENTE" ou "CONFIRME"
   - Titre : `⏳ Salle — Client` ou `✅ Salle — Client`
   - Lien réciproque via `Référence : RSA-XXX` en description

3. **Refresh auto** 
   - Admin : `loadData(false)` toutes les 30s
   - Planning : `renderPlanning()` charge Calendar en arrière-plan

---

## ❌ Problèmes identifiés

### 1. **Google Calendar non inclus dans vérification de conflit**
**Ligne** : `creerReservation()` ligne 679-685  
**Problème** :
```javascript
// Seule Sheets est vérifiée
const rows = sheet.getDataRange().getValues();
// Les événements Calendar directs (sans resaId lié) sont ignorés
```
**Scénario de faille** :
1. Admin crée un événement Google Calendar directement : "✅ Bourdelle — Réunion marketing"
2. Client reserve Bourdelle au même créneau via le site
3. ✅ Réservation acceptée (Calendar pas vérifié)
4. 🔴 **SURBOOKING** : deux réservations chevauchantes

**Impact** : Le créneau affiche deux événements en rouge dans le planning

---

### 2. **Créneaux EN_ATTENTE non libérés après expiration**
**Ligne** : `creerReservation()` ligne 718, statut fixé à `EN_ATTENTE`  
**Problème** :
```javascript
sheet.appendRow([..., 'EN_ATTENTE', ...]);
// Le créneau est "tenu" en attente de paiement
// MAIS s'il n'y a pas de paiement, il reste tenu 24h (RESA_ATTENTE_MAX_H = 24)
```
**Scénario** :
1. Client reserve Bourdelle 10-12h le 12/9
2. Paiement HelloAsso lancé → créneau "EN_ATTENTE"
3. Client ferme le navigateur, ne paie jamais
4. Créneau reste gelé 24h → aucun autre client ne peut réserver
5. 🔴 **Créneau perdu** (after 24h : passe à `CONFIRME` ou reste gelé)

**Impact** : Perte de CA + frustration clients

---

### 3. **Pas de détection visuelle de conflit dans l'admin**
**Ligne** : `renderPlanBody()` ligne 1430-1438 (admin.html)  
**Problème** :
```javascript
// Les événements sont affichés normalement (ni rouge, ni surligné)
// Aucun badge d'alerte "⚠️ CHEVAUCHEMENT DÉTECTÉ"
```
**Scénario** :
1. Admin voit le planning et croit que tout va bien
2. Deux clients arrivent le même jour pour "la même" salle
3. 🔴 Conflit découvert trop tard

**Impact** : Friction avec les clients, perte de confiance

---

### 4. **Synchronisation Calendar → Sheets unilatérale**
**Ligne** : `syncFromCal()` ligne 1722-1757 (apps-script.gs)  
**Problème** :
- Les événements Calendar sont chargés (`getCalendarEvents()`)
- MAIS ils ne créent une réservation Sheets que si l'admin clique manuellement
- Événements directs Calendar = "orphelins" (pas dans Sheets)

**Impact** : 
- Admin crée dans Calendar par habitude → pas compté dans la grille tarifaire
- Client voit deux listings disjoints (un dans l'admin Sheets, un dans Calendar)

---

## 🔧 Améliorations proposées

### A. Libération auto des créneaux expirés
**Nouvelle fonction** : `libererCreneauxExpires()`
```javascript
// Chaque jour (ou via trigger) :
// 1. Cherche les réservations EN_ATTENTE créées il y a > 24h
// 2. Les annule automatiquement
// 3. Envoie alerte à l'admin + email au client
```
**Bénéfice** : Les créneaux ne restent jamais gelés

---

### B. Vérification bidirectionnelle (Sheets + Calendar)
**Amélioration** : `compterChevauchements()` v2
```javascript
// Inclut AUSSI les événements Calendar non-liés
// Donc : si un créneau existe dans Calendar OU Sheets → bloqué
```
**Bénéfice** : Impossible de créer un surbooking même si on passe par Calendar

---

### C. Badge d'alerte conflit dans l'admin
**Modification** : `renderPlanBody()` + `showDetail()`
```javascript
// Si deux réservations chevauchent :
// - Colorier en rouge (au lieu de la couleur de la salle)
// - Afficher badge "⚠️ CONFLIT DÉTECTÉ"
// - Lister les deux clients en conflit
```
**Bénéfice** : Admin repère les anomalies d'un coup d'œil

---

### D. Synchronisation Calendar bidirectionnelle
**Amélioration** : `syncFromCal()` v2
```javascript
// 1. Import manuel → resterait sur "Importer depuis Calendar"
// 2. OU : auto-import quotidien des événements "✅ Salle —" 
// 3. OU : refuser les créations directes Calendar (via verrous)
```
**Bénéfice** : Un seul source of truth (Sheets)

---

## 🚀 Plan d'action recommandé

| # | Action | Priorité | Effort | Impact |
|----|--------|----------|--------|--------|
| 1 | Libérer créneaux expirés EN_ATTENTE | 🔴 Haute | 2h | 🟢 Fort |
| 2 | Vérifier Calendar dans `compterChevauchements()` | 🔴 Haute | 3h | 🟢 Fort |
| 3 | Badge "⚠️ CONFLIT" dans l'admin | 🟠 Moyen | 1h | 🟡 Moyen |
| 4 | Webhook de suppression Calendar ↔ Sheets | 🟡 Bas | 4h | 🟡 Moyen |

---

## 📋 Checklist Samir

- [ ] Relire ce diagnostic
- [ ] Valider les 4 améliorations proposées
- [ ] Appliquer les patches fournis
- [ ] Tester sur réservation test (bourdelle, demain 14-16h)
- [ ] Activer les triggers quotidiens (`libererCreneauxExpires`)
- [ ] Documenter dans CLAUDE.md

---

**Version** : v1.0 | **Audité par** : Claude | **Statut** : ✅ Prêt pour implémentation
