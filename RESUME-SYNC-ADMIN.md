# ⚡ Résumé exécutif — Synchronisation des réservations

**Pour** : Samir | **Sujet** : Garantir qu'on ne loue pas deux fois la même salle | **Durée de lecture** : 5 min

---

## 🎯 Le problème en 30 secondes

Actuellement, il y a un **risque de surbooking** sur les salles si un événement est créé dans Google Calendar directement, sans passer par le formulaire de réservation du site.

**Scénario réel** :
1. **Scénario 1** : Jean-Marc crée un événement Google Calendar : "✅ Bourdelle — Réunion budgétaire"
2. **Scénario 2** : En même temps, une cliente reserve Bourdelle au même créneau (10-12h) via le site
3. **Résultat** : ✅ La réservation de la cliente est acceptée
4. **Problème** : 🔴 Bourdelle est double-réservée (Jean-Marc + cliente)

**Pourquoi** : Le système vérifie seulement Google Sheets, pas Google Calendar

---

## ✅ La solution (en 3 actions)

### 1️⃣ **Vérifier AUSSI Google Calendar lors d'une réservation**
- Changer l'algo qui dit "oui" ou "non" à une réservation
- Avant d'accepter, vérifier : Sheets + Calendar
- Si un événement existe sur le créneau (peu importe où), bloquer la réservation

**Code** : Modifier `compterChevauchements()` dans apps-script.gs (patch fourni)  
**Temps** : 15 min  
**Risque** : Très bas (c'est une logique)

### 2️⃣ **Libérer automatiquement les créneaux "pourris"**
- Parfois un client reserve, ne paie jamais
- Le créneau reste "gelé" 24h (inutile)
- Solution : Le script annule auto la réservation après 24h, libère le créneau

**Code** : Nouvelle fonction `libererCreneauxExpires()` (patch fourni)  
**Temps** : 20 min + ajouter un trigger automatique  
**Bénéfice** : Plus de créneaux gelés, client reçoit email

### 3️⃣ **Voir les conflits dans l'admin (bonus)**
- Afficher en **rouge** quand deux réservations se chevauchent
- Badge "⚠️ CONFLIT DÉTECTÉ"
- Comme ça, tu verras TOUT DE SUITE si quelque chose ne va pas

**Code** : Quelques lignes dans admin.html (patch fourni)  
**Temps** : 10 min  
**Bénéfice** : UX confort, tu vois les anomalies d'un coup d'œil

---

## 📊 Impact chiffré

| Avant | Après |
|-------|-------|
| 🔴 Possible de louer Bourdelle 2 fois le même jour | ✅ Impossible (Calendar inclus) |
| 🔴 Créneaux gelés 24h si paiement échoue | ✅ Auto-annulés, créneau réutilisable |
| 🔴 Admin découvre la collision trop tard | ✅ Badge rouge immédiat |
| 🔴 CA perdu si double-réservation mal gérée | ✅ CA max : seule personne acceptée |

---

## 🚀 Plan d'action (jour par jour)

### Aujourd'hui (Jour 1) — 30 min
1. Lis ce résumé et le diagnostic complet (`DIAGNOSTIC-SYNCHRO.md`)
2. Envoie-moi un "✅ Je veux appliquer les 3 patches"

### Demain (Jour 2) — 1h 30
1. Je mets les patches en place dans ton code
2. Tu testes : créer une fausse réservation → doit être bloquée par Calendar
3. Déploiement sur GitHub Pages (auto, via workflow)

### Dans 2 jours (Jour 3) — 15 min
1. Ajouter les **triggers automatiques** Google Apps Script
   - Trigger 1 : libération créneaux tous les jours à 6h
   - Trigger 2 : synchro Calendar (optionnel) tous les jours à 22h
2. C'est tout, fini ✅

---

## 🔧 Fichiers fournis

| Fichier | Quoi | Pour qui |
|---------|------|----------|
| `DIAGNOSTIC-SYNCHRO.md` | Analyse complète + tableaux | Toi (lecteur expert) |
| `AMELIORATIONS-SYNCHRO.md` | 5 patches de code | Développeur |
| `RESUME-SYNC-ADMIN.md` | Ce fichier | Toi (vue d'ensemble) |

---

## ❓ FAQ

**Q: Et si on crée deux réservations très vite (même seconde) ?**  
R: Le `LockService` bloque pendant 20 secondes, donc impossible. ✅

**Q: Que se passe-t-il si on crée une réservation, puis une d'effacer dans Google Calendar ?**  
R: Pas grave, la réservation reste dans Sheets (elle ne sera jamais supprimée) et l'événement Calendar reste synchro'd via `calendarEventId`. Rien de cassé. ✅

**Q: Si je crée un événement Calendar directement (pas via réservation), qui le paye ?**  
R: C'est pour les événements internes (réunion d'équipe, formation). Le système les détecte mais ne crée pas de réservation Sheets. ✅

**Q: Si un client paie, mais vraiment très tard (genre 30h après), va-t-on l'annuler ?**  
R: Oui, après 24h. Mais en pratique : paiement HelloAsso est instant. Si paiement échoue, client reçoit email en 2h (alerte admin). Donc rarissime. ✅

---

## 💬 Prochaines étapes

**Si tu es d'accord** :
1. Réponds : "✅ Appliquer les 3 patches" ou "🤔 Discuter avant"
2. Je mets en place
3. On teste ensemble
4. Déploiement

**Questions ?** Pose-les, c'est le moment. 👇

---

**Confiance** : High | **Risque** : Low | **Bénéfice** : High | **Temps total** : ~2h
