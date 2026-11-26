(() => {
  const SEEN_KEY = 'sandbox:seen-version';
  const meta = document.querySelector('meta[name="application-version"]');
  const pageVersion = meta?.content ?? '';
  if (!/^\d+\.\d+\.\d+$/.test(pageVersion)) return;

  let previous = null;
  try {
    previous = window.localStorage.getItem(SEEN_KEY);
  } catch {
    return;
  }

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, pageVersion);
    } catch {
      // Storage can be unavailable; the game still works.
    }
  };

  if (!previous) {
    markSeen();
    return;
  }
  if (previous === pageVersion) return;

  const url = new URL('version.json', document.baseURI);
  url.searchParams.set('_notice', Date.now().toString(36));

  fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    .then(response => (response.ok ? response.json() : null))
    .then(latest => {
      if (!latest) return;
      const notes = Array.isArray(latest.notes)
        ? latest.notes.filter(note => typeof note === 'string' && note.trim())
        : [];
      if (latest.mode === 'announced' && notes.length === 3) {
        markSeen();
        show(pageVersion, notes);
        return;
      }
      if (latest.mode === 'silent') markSeen();
    })
    .catch(() => undefined);

  function show(version, notes) {
    const backdrop = document.createElement('div');
    backdrop.className = 'update-notice-backdrop';

    const dialog = document.createElement('section');
    dialog.className = 'update-notice';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'update-notice-title');

    const kicker = document.createElement('p');
    kicker.className = 'update-notice-kicker';
    kicker.textContent = `Sandbox v${version}`;

    const title = document.createElement('h2');
    title.id = 'update-notice-title';
    title.textContent = 'Update installiert';

    const list = document.createElement('ul');
    list.className = 'update-notice-list';
    for (const note of notes) {
      const item = document.createElement('li');
      item.textContent = note;
      list.append(item);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'update-notice-button';
    button.textContent = 'Alles klar';

    dialog.append(kicker, title, list, button);
    backdrop.append(dialog);
    document.body.append(backdrop);
    button.focus();

    const close = () => backdrop.remove();
    button.addEventListener('click', close);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) close();
    });
    document.addEventListener('keydown', function onKeydown(event) {
      if (event.key !== 'Escape') return;
      document.removeEventListener('keydown', onKeydown);
      close();
    });
  }
})();
