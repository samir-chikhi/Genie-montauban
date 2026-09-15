# 🔧 Patches d'amélioration — Synchronisation bi-directionnelle

Cet document fournit les **morceaux de code** à ajouter/modifier dans `apps-script.gs` pour sécuriser la synchronisation Calendar ↔ Sheets.

---

## Patch 1️⃣ : Libération auto des créneaux EN_ATTENTE expirés

**Fichier** : `apps-script.gs`  
**À ajouter après** : fonction `haWebhook()` (ligne ~1150)

```javascript
// ============================================================
// NETTOYAGE CRÉNEAUX EXPIRÉS — v5.1
// À exécuter quotidiennement (Triggers → Exécuter tous les jours à 6h)
// ============================================================
function libererCreneauxExpires() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Reservations');
    if (!sheet || sheet.getLastRow() < 2) return;

    const rows = sheet.getDataRange().getValues();
    const now = new Date();
    const delaiExpiration = CONFIG.RESA_ATTENTE_MAX_H * 3600000; // 24h
    let liberees = [];

    for (let i = rows.length - 1; i >= 1; i--) {
      const statut = String(rows[i][18] || '');
      const createdAt = new Date(rows[i][21] || rows[i][2] || now);

      // Condition : EN_ATTENTE depuis > 24h
      if (statut === 'EN_ATTENTE' && (now - createdAt) > delaiExpiration) {
        const id = String(rows[i][0]);
        const prenom = String(rows[i][1]);
        const nom = String(rows[i][2]);
        const email = String(rows[i][3]);
        const espace = String(rows[i][6]);
        const date = String(rows[i][10]);

        // Annuler la réservation
        sheet.getRange(i + 1, 19).setValue('ANNULE');
        sheet.getRange(i + 1, 23).setValue(new Date().toISOString());

        // Supprimer l'événement Calendar si lié
        const calEventId = String(rows[i][23] || '');
        if (calEventId) {
          try {
            const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
            const ev = CalendarApp.getEventById(calEventId);
            if (ev) ev.deleteEvent();
          } catch(eCalDel) {}
        }

        liberees.push({ id, prenom, nom, email, espace, date });

        // Email au client : "Votre réservation a expiré, créneau libéré"
        if (email) {
          envoyerEmailSafe(email,
            '⏰ Génie — Votre créneau a expiré',
            `Bonjour ${prenom},\n\n`
            + `Votre réservation (Ref: ${id}) n'a pas été confirmée dans les 24h.\n`
            + `Elle a été annulée et le créneau a été libéré pour d'autres réservations.\n\n`
            + `Espace : ${espace}\n`
            + `Date : ${date}\n\n`
            + `Vous pouvez faire une nouvelle demande : ${CONFIG.URL_SITE}/reservation.html\n\n`
            + `${CONFIG.NOM_LIEU}`);
        }
      }
    }

    // Log et alerte admin si des créneaux libérés
    if (liberees.length > 0) {
      Logger.log(`✅ libererCreneauxExpires : ${liberees.length} créneau(x) libéré(s)`);
      let msg = `🔓 ${liberees.length} réservation(s) EN_ATTENTE expirée(s) annulée(s) :\n\n`;
      liberees.forEach(r => {
        msg += `• ${r.id} — ${r.prenom} ${r.nom} (${r.email})\n  ${r.espace} le ${r.date}\n`;
      });
      envoyerEmailSafe(CONFIG.EMAIL_ADMIN, '🔓 Créneaux libérés (EN_ATTENTE expiré)', msg);
    } else {
      Logger.log('libererCreneauxExpires : aucun créneau à libérer');
    }
  } catch (err) {
    logErreur('libererCreneauxExpires', err);
  }
}
```

**À faire après** :
- Aller dans Triggers (⏱️ icône en bas à gauche de l'éditeur Apps Script)
- Ajouter un trigger pour `libererCreneauxExpires`
- Fréquence : "Quotidiennement"
- Heure : "06:00 - 07:00" (6h du matin)

---

## Patch 2️⃣ : Vérification bidirectionnelle Calendar + Sheets

**Fichier** : `apps-script.gs`  
**À remplacer** : fonction `compterChevauchements()` (ligne 610-623)

```javascript
// ============================================================
// COMPTEUR CHEVAUCHEMENTS v5.1 — Inclut Google Calendar
// Nombre de réservations ACTIVES qui chevauchent [debMin, finMin[
// sur le même espace et la même date (Sheets + Calendar)
// ============================================================
function compterChevauchements(rows, cle, dateStr, debMin, finMin, emailExclu) {
  var n = 0;

  // ── 1. Compter les réservations Sheets (comme avant) ──
  for (var i = 1; i < rows.length; i++) {
    var statut = String(rows[i][18] || '');
    if (statut === 'ANNULE' || statut === 'cancelled') continue;
    if (dateISO(rows[i][10]) !== dateStr) continue;
    if (cleEspaceRow(rows[i]) !== cle) continue;
    if (emailExclu && String(rows[i][3] || '').toLowerCase() === emailExclu) continue;
    var d = hMin(rows[i][13], 8 * 60);
    var f = hMin(rows[i][14], d + 60);
    if (debMin < f && finMin > d) n++;
  }

  // ── 2. Ajouter les événements Calendar orphelins (nouveauté v5.1) ──
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (cal) {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const dateObjEnd = new Date(dateStr + 'T23:59:59');
      const calEvents = cal.getEvents(dateObj, dateObjEnd);

      calEvents.forEach(function(ev) {
        // Ne compter QUE les événements sans resaId (orphelins)
        // Les événements liés à une réservation Sheets sont déjà comptés
        const desc = ev.getDescription() || '';
        const hasResaId = /Référence\s*:\s*([A-Z]{2,3}-[A-Z0-9]+)/.test(desc);
        if (hasResaId) return; // déjà compté dans Sheets

        // Vérifier si cet événement est sur la même salle
        const titre = (ev.getTitle() || '').toLowerCase();
        if (!titre.includes(cle)) return;

        // Vérifier le chevauchement
        const evStart = ev.getStartTime();
        const evEnd = ev.getEndTime();
        const evDebMin = evStart.getHours() * 60 + evStart.getMinutes();
        const evFinMin = evEnd.getHours() * 60 + evEnd.getMinutes();

        if (debMin < evFinMin && finMin > evDebMin) n++;
      });
    }
  } catch(eCalCheck) {
    Logger.log('⚠️ Vérification Calendar échouée : ' + eCalCheck.message);
  }

  return n;
}
```

**Impact** : Impossible de créer un surbooking via Calendar direct

---

## Patch 3️⃣ : Alerte visuelle conflit dans l'admin

**Fichier** : `admin.html`  
**À modifier** : fonction `showDetail()` (ligne 1471-1505)

**Dans le `<div class="dgrid">` du body** (après la ligne qui affiche le statut), ajouter :

```javascript
// ── APRÈS le statusBadge(r.statut) ──

// Détecter les chevauchements avec d'autres réservations
const conflits = DB.reservations.filter(r2 => {
  if (r2.id === r.id || r2.statut === 'cancelled') return false;
  if (r2.date !== r.date || r2.espace !== r.espace) return false;
  const d1 = (r.heureDebut || '00:00').split(':').map(Number);
  const f1 = (r.heureFin || '01:00').split(':').map(Number);
  const d2 = (r2.heureDebut || '00:00').split(':').map(Number);
  const f2 = (r2.heureFin || '01:00').split(':').map(Number);
  const min1 = d1[0]*60+d1[1], fin1 = f1[0]*60+f1[1];
  const min2 = d2[0]*60+d2[1], fin2 = f2[0]*60+f2[1];
  return min1 < fin2 && fin1 > min2;
});

if (conflits.length > 0) {
  document.getElementById('det-body').innerHTML = `
    <div style="background:var(--red-light);border-left:4px solid var(--red);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-weight:700;color:var(--red);margin-bottom:8px">⚠️ CONFLIT DÉTECTÉ</div>
      <div style="font-size:13px;color:var(--red);line-height:1.6">
        Cette réservation chevauchent ${conflits.length} autre(s) sur le même créneau :
        <ul style="margin-top:8px;margin-left:20px">
          ${conflits.map(c => `<li>${esc(c.prenom)} ${esc(c.nom)}</li>`).join('')}
        </ul>
      </div>
    </div>` + document.getElementById('det-body').innerHTML;
}
```

**Dans `renderPlanBody()`** (ligne 1430-1438), modifier le style des événements en conflit :

```javascript
// ── SI CONFLIT DÉTECTÉ, colorier en rouge ──
const isConflict = sheetsEvts.filter(r2 => {
  if (r2.id === r.id || r2.statut === 'cancelled') return false;
  const min1 = parseInt((r.heureDebut||'00').split(':')[0])*60;
  const min2 = parseInt((r2.heureDebut||'00').split(':')[0])*60;
  const fin1 = min1 + (r.typeDuree==='heure' ? Number(r.nbHeures)*60 : 240);
  const fin2 = min2 + (r2.typeDuree==='heure' ? Number(r2.nbHeures)*60 : 240);
  return min1 < fin2 && fin1 > min2;
}).length > 0;

// Ensuite utiliser `isConflict` pour appliquer une classe CSS :
// `<div class="ev ${isConflict ? 'ev-conflict' : 'ev-'+escId(r.espace)}">`
```

**Ajouter dans `<style>`** (admin.html ligne 11-204) :

```css
.ev-conflict{background:var(--red);color:#fff;border-color:var(--red) !important;font-weight:700}
.ev-conflict::before{content:'⚠️ ';margin-right:4px}
```

**Impact** : Admin voit immédiatement les conflits en rouge dans le planning

---

## Patch 4️⃣ : Auto-import Calendar quotidien (optionnel)

**Fichier** : `apps-script.gs`  
**À modifier** : fonction `syncFromCal()` (ligne 1722-1757)

**Remplacer** le bouton "Importer depuis Calendar" par un trigger automatique :

1. Créer une fonction wrapper :
```javascript
function autoSyncCalendarDaily() {
  // Importer automatiquement les événements Calendar
  // Exécution : quotidienne à 22h
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 8);
  
  const fmt = d => d.toISOString().split('T')[0];
  const result = syncFromCal({
    start: fmt(yesterday),
    end: fmt(tomorrow)
  });

  if (result.imported && result.imported.length > 0) {
    envoyerEmailSafe(CONFIG.EMAIL_ADMIN,
      `📅 Synchro Calendar — ${result.imported.length} événement(s)`,
      `${result.imported.length} événement(s) Calendar ont été importés automatiquement.\n\n` +
      `IDs : ${result.imported.join(', ')}\n\n` +
      `👉 Vérifier dans l'admin : ${CONFIG.URL_SITE}/admin.html`);
  }
}
```

2. Ajouter un trigger quotidien (⏱️ menu Triggers)
   - Fonction : `autoSyncCalendarDaily`
   - Fréquence : "Quotidiennement"
   - Heure : "22:00 - 23:00" (22h)

---

## Patch 5️⃣ : Ajouter l'indicateur de synchro dans l'admin

**Fichier** : `admin.html`  
**À modifier** : fonction `renderTable()` (ligne 1548-1576)

**Dans la colonne options** (avant ou après), ajouter un indicateur :

```javascript
// ── Dans le tableau ──
<td>${esc(r.options||'—')}${r.calEventId ? '<br><span style="color:var(--cal);font-size:11px">✅ Cal</span>' : '<span style="color:var(--muted);font-size:11px">⚠️ Pas synchro</span>'}</td>
```

**Impact** : Admin voit immédiatement quelles réservations sont synchro'd avec Calendar

---

## 🎯 Ordre d'implémentation

1. **D'abord** : Patch 2️⃣ (vérification Calendar) — **critique** pour anti-surbooking
2. **Ensuite** : Patch 1️⃣ (libération créneaux) — **important** pour ne pas geler
3. **Après** : Patch 3️⃣ (alerte visuelle) — **UX/confort admin**
4. **Optionnel** : Patch 4️⃣ (auto-import) — **confort** si Google Calendar usage fréquent
5. **Nice-to-have** : Patch 5️⃣ (indicateur synchro) — **info visuelle**

---

## ✅ Checklist de déploiement

- [ ] Copier Patch 2️⃣ dans `apps-script.gs`
- [ ] Redéployer l'Apps Script (Déployer → Nouvelle version)
- [ ] Copier Patch 1️⃣ dans `apps-script.gs`
- [ ] Ajouter le trigger quotidien `libererCreneauxExpires` à 6h
- [ ] Tester avec une réservation test : créneau devrait être bloqué par Calendar
- [ ] Copier Patch 3️⃣ + CSS dans `admin.html`
- [ ] Rafraîchir et tester l'affichage des conflits
- [ ] Documenter dans CLAUDE.md : "Synchro Calendar sécurisée depuis 2026-09-10"

---

**Version** : v1.0 | **Auteur** : Claude | **Prêt** : ✅ Oui
