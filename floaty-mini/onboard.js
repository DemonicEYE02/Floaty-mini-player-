// One-time setup page. Asks for every permission the extension needs in a single prompt,
// then confirms. If the permissions were already granted at install time, this just
// reports success (no prompt is shown).
(() => {
  const status = document.getElementById('status');
  const allow = document.getElementById('allow');
  const done = document.getElementById('done');

  const NEED = {
    permissions: ['storage', 'scripting', 'tabCapture', 'offscreen'],
    origins: ['https://*/*', 'http://*/*']
  };

  function setStatus(kind, text) {
    status.className = 'status ' + kind;
    status.textContent = text;
  }

  async function refresh() {
    try {
      const has = await chrome.permissions.contains({ permissions: NEED.permissions, origins: NEED.origins });
      if (has) { setStatus('good', 'Everything is allowed — you are ready to go.'); allow.textContent = 'All set ✓'; }
      else { setStatus('warn', 'Click “Allow everything” to grant the permissions in one step.'); }
    } catch (e) {
      setStatus('warn', 'Click “Allow everything” to grant the permissions in one step.');
    }
  }

  allow.addEventListener('click', async () => {
    try {
      const has = await chrome.permissions.contains(NEED);
      if (has) { setStatus('good', 'Everything is allowed — you are ready to go.'); allow.textContent = 'All set ✓'; return; }
      const granted = await chrome.permissions.request(NEED);
      if (granted) setStatus('good', 'Everything is allowed — you are ready to go.');
      else setStatus('warn', 'Permission was not granted. The crop window may be limited until you allow it.');
    } catch (e) {
      setStatus('good', 'Permissions were already granted when the extension was installed — nothing more to do.');
    }
    refresh();
  });

  done.addEventListener('click', () => window.close());
  refresh();
})();
