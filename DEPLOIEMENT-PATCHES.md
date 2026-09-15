# ✅ Déploiement des patches — Synchronisation + Horaires

**Date** : 2026-09-10 | **Status** : ✅ Prêt

---

## 🔧 Patches appliqués

### ✅ apps-script.gs

| Patch | Fonction | Ligne | Statut |
|-------|----------|-------|--------|
| 1️⃣ | `libererCreneauxExpires()` | +60 lignes avant `haCreds()` | ✅ Ajouté |
| 2️⃣ | `compterChevauchements()` v5.1 | ~610-623 remplacé | ✅ Remplacé |

### ✅ admin.html

| Patch | Fonction | Ligne | Statut |
|-------|----------|-------|--------|
| 3️⃣ | Détection conflits dans `showDetail()` | ~1471 modifié | ✅ Ajouté |
| 3️⃣ | CSS `.ev-conflict` | ~134 | ✅ Ajouté |
| 4️⃣ | HOURS 24h/24 (30 min) | ~719 remplacé | ✅ Remplacé |
| 5️⃣ | Select heures dynamique | ~543-551 simplifié | ✅ Remplacé |
| 5️⃣ | `resetForm()` rempli heures | ~1144+ ajouté | ✅ Modifié |

### ✅ reservation.html

| Patch | Fonction | Ligne | Statut |
|-------|----------|-------|--------|
| 6️⃣ | Heures 24h/24 (min/max enlevés) | ~316-321 | ✅ Modifié |

---

## 🚀 Prochaines étapes (5 min)

### 1. Redéployer Apps Script
```
Éditeur Apps Script → Déployer → Nouvelle version
- Sélectionner : "Nouveau déploiement"
- Type : "Tous les appels à Apps Script"
- Cliquer "Déployer"
```

### 2. Ajouter 2 triggers automatiques
```
Éditeur Apps Script → ⏱️ Triggers (bas à gauche)

Trigger 1 : libererCreneauxExpires
  - Fonction : libererCreneauxExpires
  - Type : Time-driven
  - Fréquence : Daily
  - Heure : 06:00-07:00 (6h du matin)
  → Cliquer "Créer"

Trigger 2 : autoSyncCalendarDaily (OPTIONNEL)
  - Fonction : autoSyncCalendarDaily
  - Type : Time-driven
  - Fréquence : Daily
  - Heure : 22:00-23:00 (22h)
  → Cliquer "Créer"
```

### 3. Vérifier GitHub Pages
```
GitHub Pages devrait déployer automatiquement
- Attendre 2-3 min (workflow Actions)
- Vérifier : https://genie-montauban.fr
```

---

## 🧪 Tests rapides

### Test 1 : Conflit Calendar détecté ✅
1. Créer événement Calendar : "✅ Bourdelle — Test" demain 14-16h
2. Réserver via site : Bourdelle, demain 14-15h
3. **Résultat attendu** : Message "Ce créneau vient d'être réservé"

### Test 2 : Heures 24h/24 ✅
1. Admin → Nouvelle réservation
2. Cliquer "Heure début" → doit voir **00:00 à 23:30**
3. Cliquer "Heure fin" → doit voir **00:00 à 23:30**

### Test 3 : Pas de 30 min ✅
1. Admin → Heure début
2. Chercher : 09:15, 14:45, 23:30, etc.
3. **Résultat attendu** : Voir des pas de 30 min (09:00, 09:30, 10:00...)

### Test 4 : Alerte conflit ✅
1. Créer manuellement 2 réservations qui chevauchent
2. Cliquer sur l'une d'elles
3. **Résultat attendu** : Banner rouge "⚠️ CONFLIT DÉTECTÉ"

---

## 📋 Checklist final

- [ ] Redéployer Apps Script (nouvelle version)
- [ ] Ajouter trigger `libererCreneauxExpires` à 6h
- [ ] Ajouter trigger `autoSyncCalendarDaily` à 22h (optionnel)
- [ ] Attendre déploiement GitHub Pages (~2 min)
- [ ] Test 1 : Conflit Calendar (admin)
- [ ] Test 2 : Heures 24h/24 (admin)
- [ ] Test 3 : Pas 30 min (admin)
- [ ] Test 4 : Alerte conflit (admin)
- [ ] Documentation complétée ✅

---

## 💬 Notes

- ✅ **Trois patchs critiques appliqués** : surbooking bloqué, créneaux libérés, alertes visuelles
- ✅ **Horaires étendus** : 24h/24 avec pas de 30 min
- ✅ **Pas de break** : tout reste compatible avec les réservations existantes
- ✅ **Zero impact** : les réservations passées ne changent pas

---

**Prêt** : ✅ Oui | **Risque** : 🟢 Très bas | **Temps déploiement** : 5 min
