/* v2.js — comportements communs de la refonte 2026.
   1. Menu mobile
   2. Formulaires « demande » : tout <form data-demande="Libellé"> est envoyé à
      l'API Apps Script (action CONTACT, déjà en production). L'objet du mail
      commence par [Libellé] → un filtre Gmail par type de demande suffit.
      Si l'API ne répond pas, on bascule sur un email pré-rempli.
   3. Mesure d'audience Google Analytics chargée seulement après accord
      (même clé localStorage « cookie_consent » que les anciennes pages). */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyJ-Dk-yZZNdfxFigchP953rNyjSLJv4oOVUbxzuAbX4kuBfwTFBJvnnLuJMLWRnd9c4w/exec';
  var MAIL = 'contact@genie-montauban.fr';
  var GA_ID = 'G-774PRH98LY';

  // ── 1. Menu mobile ──
  var burger = document.querySelector('.g-burger');
  var nav = document.getElementById('g-nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ── 2. Formulaires de demande ──
  function champs(form) {
    var lignes = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'website' || el.type === 'submit') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      var val = String(el.value || '').trim();
      if (!val) return;
      var lab = el.getAttribute('data-label') || el.name;
      lignes.push(lab + ' : ' + val);
    });
    return lignes;
  }
  function msg(form, cls, html) {
    var box = form.querySelector('.form-msg');
    if (!box) return;
    box.className = 'form-msg ' + cls;
    box.innerHTML = html;
  }
  document.querySelectorAll('form[data-demande]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var hp = form.querySelector('[name=website]');
      if (hp && hp.value) return; // robot
      if (!form.reportValidity()) return;
      var type = form.getAttribute('data-demande');
      var email = (form.querySelector('[name=email]') || {}).value || '';
      var prenom = (form.querySelector('[name=prenom]') || {}).value || '';
      var nom = (form.querySelector('[name=nom]') || {}).value || '';
      var resume = (form.querySelector('[data-resume]') || {}).value || '';
      var sujet = '[' + type + '] ' + (prenom + ' ' + nom).trim() + (resume ? ' — ' + resume : '');
      var corps = champs(form).join('\n') + '\n\nPage : ' + location.pathname;
      var btn = form.querySelector('[type=submit]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
      var mailto = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
      fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
        body: JSON.stringify({ action: 'CONTACT', prenom: prenom, nom: nom, email: email, sujet: sujet, message: corps })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.success) throw new Error((d && (d.message || d.error)) || 'réponse inattendue');
          form.reset();
          msg(form, 'ok', '<strong>C\'est envoyé.</strong> ' + (form.getAttribute('data-merci') || 'On vous répond sous 48 h ouvrées.'));
          if (btn) btn.textContent = 'Envoyé ✓';
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          msg(form, 'err', 'L\'envoi automatique n\'a pas marché. <a href="' + mailto + '">Envoyer par email (pré-rempli)</a> ou appelez le <a href="tel:+33651509718">06 51 50 97 18</a>.');
        });
    });
  });

  // ── 3. Consentement mesure d'audience ──
  function chargerGA() {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  var choix = null;
  try { choix = localStorage.getItem('cookie_consent'); } catch (e) {}
  if (choix === 'accepted') chargerGA();
  else if (choix !== 'refused' && !document.getElementById('cookie-banner')) {
    var b = document.createElement('div');
    b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Mesure d\'audience');
    b.className = "g-consent";
    b.innerHTML = 'On aimerait compter les visites (Google Analytics) pour savoir quelles pages servent. D\'accord ? <a href="confidentialite.html#cookies">En savoir plus</a>' +
      '<div><button class="btn btn-gold" data-c="accepted">Accepter</button><button class="btn btn-ghost" data-c="refused">Refuser</button></div>';
    b.addEventListener('click', function (e) {
      var c = e.target.getAttribute('data-c');
      if (!c) return;
      try { localStorage.setItem('cookie_consent', c); localStorage.setItem('cookie_consent_date', new Date().toISOString()); } catch (er) {}
      if (c === 'accepted') chargerGA();
      b.remove();
    });
    document.body.appendChild(b);
  }
})();
