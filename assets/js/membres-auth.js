// membres-auth.js — authentification partagée de l'espace membres (Supabase magic link).
// Nécessite : le script CDN @supabase/supabase-js, puis membres-config.js, chargés avant ce fichier.

(function () {
  if (!window.GENIE_SUPABASE_URL || !window.GENIE_SUPABASE_ANON_KEY) {
    window.GenieAuth = { notConfigured: true };
    return;
  }

  const client = window.supabase.createClient(window.GENIE_SUPABASE_URL, window.GENIE_SUPABASE_ANON_KEY);
  window.genieDb = client;

  async function getUser() {
    const { data: { session } } = await client.auth.getSession();
    return session ? session.user : null;
  }

  async function sendMagicLink(email) {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // seuls les membres déjà invités par un admin Supabase peuvent se connecter
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    return error;
  }

  async function signOut() {
    await client.auth.signOut();
    window.location.reload();
  }

  // Première visite : petite fenêtre d'accueil (à la place du prompt() du navigateur).
  function askName(suggestion) {
    return new Promise((resolve) => {
      if (typeof HTMLDialogElement === 'undefined') return resolve(window.prompt("Bienvenue ! Quel prénom ou pseudo afficher aux autres membres ?", suggestion));
      const d = document.createElement('dialog');
      d.className = 'gm-dialog';
      d.innerHTML = '<h3>Bienvenue au Génie 👋</h3>' +
        '<p style="margin:0 0 14px;font-size:14px;color:var(--muted)">Quel prénom (ou pseudo) voulez-vous afficher aux autres membres ? Vous pourrez le garder tel quel.</p>' +
        '<form method="dialog"><div class="gm-field"><input class="gm-input" id="gm-name-in" maxlength="40" autocomplete="given-name"></div>' +
        '<div class="gm-dialog-actions"><button class="gm-btn gm-btn-primary" value="ok">C\'est parti</button></div></form>';
      document.body.appendChild(d);
      const input = d.querySelector('#gm-name-in');
      input.value = suggestion;
      d.addEventListener('close', () => { const v = input.value; d.remove(); resolve(v); });
      d.showModal();
      input.select();
    });
  }

  async function ensureProfile(user) {
    const { data } = await client.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (data && data.display_name) return data.display_name;
    let name = (user.email || 'membre').split('@')[0];
    const chosen = await askName(name);
    if (chosen && chosen.trim()) name = chosen.trim();
    await client.from('profiles').upsert({ id: user.id, display_name: name });
    return name;
  }

  // Affiche l'écran de connexion OU le contenu, selon la session.
  // onReady(user, displayName) est appelé une fois connecté.
  async function guard(onReady) {
    const loginEl = document.getElementById('gm-login');
    const appEl = document.getElementById('gm-app');
    const user = await getUser();

    if (!user) {
      if (loginEl) loginEl.style.display = 'flex';
      if (appEl) appEl.style.display = 'none';
      return;
    }

    const name = await ensureProfile(user);
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = '';
    const nameTag = document.getElementById('gm-user-name');
    if (nameTag) nameTag.textContent = name;
    onReady(user, name);
  }

  window.GenieAuth = { client, getUser, sendMagicLink, signOut, ensureProfile, guard, notConfigured: false };
})();
