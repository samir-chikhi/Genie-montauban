/* salon.js — onglets de index-salon.html.
   Sans JavaScript, tous les contenus restent affichés à la suite.
   Avec : un onglet à la fois, navigation au clavier (flèches, Début, Fin),
   adresse partageable (index-salon.html#tarifs ouvre directement l'onglet). */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.s-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.s-panel'));
  var list = document.querySelector('.s-tablist');
  var barIn = document.querySelector('.s-bar-in');
  if (!tabs.length) return;

  function byId(id) { for (var i = 0; i < tabs.length; i++) if (tabs[i].dataset.id === id) return tabs[i]; return null; }

  function show(id, opts) {
    var tab = byId(id) || tabs[0];
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.hidden = p.id !== 'p-' + tab.dataset.id; });
    // centre l'onglet actif dans la barre défilante
    if (list) {
      var x = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, x), behavior: opts && opts.instant ? 'auto' : 'smooth' });
    }
    if (opts && opts.hash) { try { history.replaceState(null, '', '#' + tab.dataset.id); } catch (e) {} }
    if (opts && opts.scroll) {
      var sec = document.getElementById('onglets');
      var top = sec.getBoundingClientRect().top + window.pageYOffset;
      var cible = top - 64; // sous l'en-tête collant, la barre d'onglets reste visible
      var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: cible, behavior: reduit ? 'auto' : 'smooth' });
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

  function depuisHash() {
    var id = (location.hash || '').replace('#', '');
    if (byId(id)) { show(id, { instant: true, scroll: true }); return true; }
    return false;
  }
  window.addEventListener('hashchange', function () {
    var id = (location.hash || '').replace('#', '');
    if (byId(id)) show(id, { scroll: true });
  });
  if (!depuisHash()) show(tabs[0].dataset.id, { instant: true });
  window.addEventListener('load', majFin);
  window.addEventListener('resize', majFin);
})();
