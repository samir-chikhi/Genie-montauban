// membres-utils.js — petites fonctions partagées entre les pages de l'espace membres.
(function () {
  const CATEGORY_LABELS = {
    service: 'Service',
    utile: 'Utile',
    divertissement: 'Divertissement',
    conseils: 'Conseils',
    'contacts-pro': 'Contact pro',
    fournisseurs: 'Fournisseur'
  };
  const CHANNEL_LABELS = {
    general: 'Général',
    covoiturage: 'Covoiturage',
    'bons-plans': 'Bons plans',
    'annonces-pro': 'Annonces pro'
  };

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function formatDayShort(isoDate) {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function categoryLabel(c) { return CATEGORY_LABELS[c] || c; }
  function channelLabel(c) { return CHANNEL_LABELS[c] || c; }

  window.GenieUtils = { escapeHtml, formatDate, formatDayShort, categoryLabel, channelLabel, CATEGORY_LABELS, CHANNEL_LABELS };
})();
