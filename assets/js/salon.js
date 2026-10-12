/* salon.js — page index-salon.html (atteinte par QR codes).
   1. Onglets : un à la fois, clavier (flèches, Début, Fin), adresse
      partageable (#tarifs). Sans JavaScript, tout reste affiché à la suite.
   2. QR par public : ?qr=assos ouvre directement l'onglet Associations.
   3. Comptage anonyme : une ligne par visite dans le classeur (QR scanné,
      onglet, mobile ou ordinateur). Ni cookie, ni identifiant, ni IP.
   4. Formulaire « Être rappelé » → API Apps Script (action SALON_RAPPEL).
      Sans réseau : la demande est gardée sur le téléphone et repart seule
      dès que la connexion revient ; un SMS pré-rempli est proposé. */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyJ-Dk-yZZNdfxFigchP953rNyjSLJv4oOVUbxzuAbX4kuBfwTFBJvnnLuJMLWRnd9c4w/exec';
  var root = document.documentElement;
  root.classList.add('js');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.s-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.s-panel'));
  var list = document.querySelector('.s-tablist');
  var barIn = document.querySelector('.s-bar-in');
  if (!tabs.length) return;

  // QR scanné → onglet ouvert d'office et intérêt pré-rempli du formulaire
  var QR_ONGLET = { bureaux: 'bureaux', salles: 'salles', academie: 'academie', fabrique: 'fabrique', assos: 'assos', quartier: 'rendez-vous' };
  var ONGLET_INTERET = { bureaux: 'Bureaux et coworking', salles: 'Salle de réunion ou de formation', academie: "Formations de l'Académie",
    fabrique: 'Mon projet (Fabrique du Génie)', assos: 'Mon association', 'rendez-vous': 'Les rendez-vous du quartier' };
  var params = new URLSearchParams(location.search);
  var source = (params.get('qr') || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
  var vus = [];
  var form = document.getElementById('form-rappel');
  var interetTouche = false;

  function byId(id) { for (var i = 0; i < tabs.length; i++) if (tabs[i].dataset.id === id) return tabs[i]; return null; }

  function show(id, opts) {
    var tab = byId(id) || tabs[0];
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.hidden = p.id !== 'p-' + tab.dataset.id; });
    if (vus.indexOf(tab.dataset.id) === -1) vus.push(tab.dataset.id);
    if (form && !interetTouche && ONGLET_INTERET[tab.dataset.id]) form.interet.value = ONGLET_INTERET[tab.dataset.id];
    if (list) {
      var x = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, x), behavior: opts && opts.instant ? 'auto' : 'smooth' });
    }
    if (opts && opts.hash) { try { history.replaceState(null, '', location.pathname + location.search + '#' + tab.dataset.id); } catch (e) {} }
    if (opts && opts.scroll) {
      var sec = document.getElementById('onglets');
      var cible = sec.getBoundingClientRect().top + window.pageYOffset - 64; // sous l'en-tête collant
      var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: cible, behavior: reduit || opts.instant ? 'auto' : 'smooth' });
    }
    majFin();
  }

  function majFin() {
    if (!list || !barIn) return;
    barIn.classList.toggle('fin', list.scrollLeft + list.clientWidth >= list.scrollWidth - 8);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.dataset.id, { hash: true, scroll: true }); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault();
      tabs[n].focus();
      show(tabs[n].dataset.id, { hash: true });
    });
  });
  if (list) list.addEventListener('scroll', majFin, { passive: true });

  // Liens internes vers un onglet (tuiles « porte d'entrée », boutons…)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-tab]');
    if (!a) return;
    e.preventDefault();
    show(a.dataset.tab, { hash: true, scroll: true });
  });

  function ongletDemande() {
    var h = (location.hash || '').replace('#', '');
    if (byId(h)) return h;
    return QR_ONGLET[source] || null;
  }
  window.addEventListener('hashchange', function () {
    var id = (location.hash || '').replace('#', '');
    if (byId(id)) show(id, { scroll: true });
  });
  var depart = ongletDemande();
  if (depart) show(depart, { instant: true, scroll: true });
  else show(tabs[0].dataset.id, { instant: true });
  window.addEventListener('load', majFin);
  window.addEventListener('resize', majFin);

  // ── Envoi vers l'API ──
  function envoyer(payload) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  }
  function stock(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  // ── Comptage anonyme : une fois par visite (recharger ne recompte pas) ──
  var dejaCompte = false;
  try { dejaCompte = sessionStorage.getItem('salon_compte') === '1'; sessionStorage.setItem('salon_compte', '1'); } catch (e) {}
  if (!dejaCompte && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
    var visite = JSON.stringify({ action: 'SALON_VISITE', source: source || 'direct', onglet: depart || '',
      appareil: (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'mobile' : 'ordinateur' });
    var parti = false;
    try { parti = navigator.sendBeacon && navigator.sendBeacon(API, new Blob([visite], { type: 'text/plain' })); } catch (e) {}
    if (!parti) { try { fetch(API, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: visite }); } catch (e) {} }
  }

  // ── Formulaire « Être rappelé » ──
  if (!form) return;
  var erreur = document.getElementById('rappel-erreur');
  var merci = document.getElementById('rappel-merci');
  var bouton = form.querySelector('.s-envoyer');
  var libelle = bouton.innerHTML;
  form.interet.addEventListener('change', function () { interetTouche = true; });

  function smsLien(d) {
    var txt = 'Bonjour, ' + d.prenom + ' (vu au salon). Merci de me rappeler' + (d.creneau ? ' ' + d.creneau.toLowerCase() : '') +
      (d.interet ? ' au sujet de : ' + d.interet : '') + '. ' + d.telephone;
    return 'sms:+33651509718?body=' + encodeURIComponent(txt);
  }
  function afficherErreur(html) { erreur.innerHTML = html; erreur.hidden = false; try { erreur.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
  function remercier(d) {
    merci.querySelector('[data-prenom]').textContent = d.prenom;
    merci.querySelector('[data-creneau]').textContent = d.creneau ? ', de préférence ' + d.creneau.toLowerCase() : '';
    form.hidden = true; merci.hidden = false; merci.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    erreur.hidden = true;
    var d = {
      action: 'SALON_RAPPEL', prenom: form.prenom.value.trim(), telephone: form.telephone.value.trim(),
      email: form.email.value.trim(), interet: form.interet.value, creneau: (form.querySelector('[name=creneau]:checked') || {}).value || '',
      message: form.message.value.trim(), site: form.site.value, consentement: form.consentement.checked,
      source: source || 'direct', onglets: vus.join(', ')
    };
    var manque = null;
    form.querySelectorAll('[aria-invalid]').forEach(function (c) { c.removeAttribute('aria-invalid'); });
    if (!d.prenom) manque = form.prenom;
    else if (d.telephone.replace(/\D/g, '').length < 9) manque = form.telephone;
    else if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) manque = form.email;
    if (manque) {
      manque.setAttribute('aria-invalid', 'true'); manque.focus();
      afficherErreur(manque === form.prenom ? 'Indiquez votre prénom.' : manque === form.telephone ? 'Indiquez un numéro de téléphone complet.' : "L'adresse email semble incomplète.");
      return;
    }
    if (!d.consentement) { afficherErreur("Cochez la case d'accord pour que nous puissions vous rappeler."); form.consentement.focus(); return; }

    bouton.disabled = true; bouton.textContent = 'Envoi…';
    envoyer(d).then(function (r) {
      if (!r || !r.success) throw new Error((r && r.message) || 'refus');
      stock('salon_rappel_attente', null);
      remercier(d);
    }).catch(function (err) {
      bouton.disabled = false; bouton.innerHTML = libelle;
      if (err && err.message && err.message !== 'refus' && !/fetch|network|réseau|Load failed|JSON/i.test(err.message)) {
        afficherErreur(err.message); return;          // refus explicite du serveur (ex. trop de demandes)
      }
      // Réseau absent (fréquent dans un salon) : on garde la demande et on propose le SMS
      stock('salon_rappel_attente', JSON.stringify(d));
      afficherErreur('Le réseau ne passe pas ici. Votre demande est gardée sur ce téléphone et partira toute seule dès le retour de la connexion. ' +
        'Pour être sûr : <a href="' + smsLien(d) + '">l\'envoyer par SMS</a> ou appeler le <a href="tel:+33651509718">06 51 50 97 18</a>.');
    });
  });

  // Demande restée en attente (réseau coupé) : nouvel essai au retour du réseau
  function relancer() {
    var brut = stock('salon_rappel_attente');
    if (!brut) return;
    var d; try { d = JSON.parse(brut); } catch (e) { stock('salon_rappel_attente', null); return; }
    envoyer(d).then(function (r) { if (r && r.success) { stock('salon_rappel_attente', null); if (!form.hidden && erreur && !erreur.hidden) remercier(d); } }).catch(function () {});
  }
  window.addEventListener('online', relancer);
  relancer();
})();
