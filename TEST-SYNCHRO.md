# 🧪 Guide de test — Synchronisation Calendar ↔ Sheets

**Après déploiement des patches, valider que tout fonctionne comme prévu**

---

## Test 1️⃣ : Surbooking impossible avec Calendar

### Scénario
1. Créer un événement Google Calendar directement : `✅ Bourdelle — Test conflit`
   - Date : demain (11/09/2026)
   - Horaire : 14:00-16:00
   - Lien : https://calendar.google.com/calendar/r?authuser=contact@genie-montauban.fr

2. Essayer de réserver via le site
   - Aller sur : https://genie-montauban.fr/reservation.html
   - Profil : Tarif plein
   - Espace : Bourdelle
   - Date : demain (11/09/2026)
   - Heure : 14:00 - 15:00
   - Cliquer "Envoyer"

### Résultat attendu
- 🔴 **Message d'erreur** : "Ce créneau vient d'être réservé. Choisissez un autre horaire..."
- ✅ **Pas de réservation créée**

### Si ça fonctionne
- ✅ Patch 2️⃣ OK

### Si ça ne fonctionne pas
- 🔍 Vérifier que `compterChevauchements()` inclut le code Calendar
- 🔍 Vérifier que l'événement Calendar porte le bon titre (`✅ Bourdelle —`)

---

## Test 2️⃣ : Libération auto des créneaux expirés

### Scénario
1. Créer une fausse réservation EN_ATTENTE
   - Admin → "Nouvelle réservation"
   - Saisir : Bourdelle, demain 10-12h, "Test expiration"
   - **Ne pas cliquer "Enregistrer"**, mais vérifier dans les logs

2. OU (plus facile) : Modifier une réservation existante
   - Admin → Réservations
   - Cliquer sur une réservation EN_ATTENTE
   - Changer `createdAt` à hier (retrancher 25h)
   - Enregistrer

3. Attendre que le trigger quotidien s'exécute
   - OU forcer l'exécution : Éditeur Apps Script → Exécuter `libererCreneauxExpires`

### Résultat attendu
- ✅ La réservation passe de `EN_ATTENTE` → `ANNULE`
- ✅ Email reçu par le client : "Votre créneau a expiré"
- ✅ Email reçu par admin : "Créneaux libérés"

### Si ça fonctionne
- ✅ Patch 1️⃣ OK

### Si ça ne fonctionne pas
- 🔍 Vérifier le format de `createdAt` dans Sheets (ISO 8601)
- 🔍 Vérifier que `CONFIG.RESA_ATTENTE_MAX_H = 24` (ou ajuster)

---

## Test 3️⃣ : Alerte visuelle conflit dans l'admin

### Scénario
1. Créer deux réservations qui se chevauchent
   - Admin → "Nouvelle réservation"
   - Réservation A : Bourdelle, 11/09 10:00-12:00, "Client A"
   - Réservation B : Bourdelle, 11/09 11:00-13:00, "Client B"
   
   **Note** : A priori, B devrait être REFUSÉE (test 1 passe d'abord)

2. OU simuler un conflit en changeant les horaires APRÈS création (hack de test)
   - Créer A et B sur des créneaux différents
   - Dans Sheets, modifier B pour que `heureDebut` de B = 11:00 (même que A)

3. Admin → Réservations
4. Cliquer sur la réservation B

### Résultat attendu
- ⚠️ **Banner rouge** en haut du modal : "⚠️ CONFLIT DÉTECTÉ"
- 📋 **Liste** : "Cette réservation chevauche 1 autre(s) :
  - Client A"

### Optionnel (nice-to-have)
- 🎨 La réservation B dans le planning affiche en **rouge** au lieu de la couleur bleue

### Si ça fonctionne
- ✅ Patch 3️⃣ OK

### Si ça ne fonctionne pas
- 🔍 Vérifier que le code `conflits.filter()` est dans `showDetail()`
- 🔍 Vérifier que le CSS `.ev-conflict` existe dans `<style>`

---

## Test 4️⃣ : Auto-import Calendar (optionnel)

### Scénario
1. Créer un événement Google Calendar direct : `✅ Freinet — Test import`
   - Date : demain
   - Horaire : 15:00-17:00

2. Forcer l'exécution du trigger
   - Éditeur Apps Script → Exécuter `autoSyncCalendarDaily`

3. Admin → Réservations

### Résultat attendu
- ✅ Nouvel ligne créée : `CAL-xxxxx`
- ✅ Espace : Freinet
- ✅ Date : demain
- ✅ Statut : CONFIRME
- ✅ Email reçu par admin : "Synchro Calendar — 1 événement importé"

### Si ça fonctionne
- ✅ Patch 4️⃣ OK

### Si ça ne fonctionne pas
- 🔍 Vérifier que `syncFromCal()` cherche bien "freinet" dans le titre
- 🔍 Vérifier que l'événement a le bon format : `✅ Freinet —`

---

## Checklist finale

| # | Test | Résultat | Date | Sig. |
|----|------|----------|------|------|
| 1️⃣ | Surbooking impossible | ✅ / ❌ | ___/09 | ___ |
| 2️⃣ | Libération créneaux | ✅ / ❌ | ___/09 | ___ |
| 3️⃣ | Alerte conflit admin | ✅ / ❌ | ___/09 | ___ |
| 4️⃣ | Auto-import Calendar | ✅ / ❌ | ___/09 | ___ |

---

## 🚨 Edge cases à vérifier

### Edge case A : Conflit sur Rousseau (capacité 20)
- Créer 20 réservations nominales sur Rousseau, même créneau
- La 21ème devrait être refusée
- ✅ Si OK, vérifier qu'on compte bien `capacite: 20` pour Rousseau

### Edge case B : Réservation demi-journée vs journée
- Créer Bourdelle 09:00-13:00 (demi : 4h)
- Créer Bourdelle 13:00-17:00 (demi : 4h)
- Les deux devraient être acceptées (pas de chevauchement)
- ✅ Vérifier que la logique heure est juste

### Edge case C : Timezones
- Créer une réservation via le site (fuseau client local)
- Vérifier que Google Calendar affiche la bonne heure
- ✅ Si décalage > 1h, il y a un bug

### Edge case D : Réservation EN_ATTENTE après 23h50
- Créer une réservation à 23h50 (createdAt = maintenant)
- Attendre que le trigger se lance à 6h (+6h10)
- Vérifier qu'elle n'est PAS annulée (< 24h)
- ✅ Correct

---

## 📞 Support

**Si un test échoue** :
1. Noter le # du test et le résultat exact
2. Copier le log d'erreur (Apps Script → Exécutions)
3. M'envoyer tout

**Temps estimé** : 45 min (tous les tests)

---

**Version** : v1.0 | **À faire après** : AMELIORATIONS-SYNCHRO.md appliqué
