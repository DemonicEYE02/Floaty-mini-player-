// Floaty background: relays music state to every tab, fetches artwork, opens links in
// tabs, injects the content script into already-open tabs, drives the offscreen audio
// analyser (so the wave follows the real music even on DRM sites), and (optionally)
// strips X-Frame-Options / CSP so pages that normally forbid embedding can still be
// shown in the crop / mini window.

const ports = new Set();
let sourcePort = null; // the tab currently playing music
let lastTick = null;   // most recent playback tick, replayed to tabs that join later
let nextRule = 100;

function broadcast(m) {
  for (const p of ports) { try { p.postMessage(m); } catch (e) {} }
}

/* ───────────────── tab audio capture (real wave levels) ───────────────── */
let captureLevels = null;
let capTab = null;

async function ensureOffscreen() {
  try {
    if (chrome.offscreen && chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Analyse the tab audio to drive the music visualiser'
    });
  } catch (e) {}
}

async function startCapture(tabId) {
  if (typeof tabId !== 'number') return false;
  try {
    await ensureOffscreen();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await chrome.runtime.sendMessage({ type: 'cap-start', streamId });
    capTab = tabId;
    return true;
  } catch (e) {
    captureLevels = null;
    try { await chrome.runtime.sendMessage({ type: 'cap-stop' }); } catch (e2) {}
    return false;
  }
}

async function stopCapture() {
  capTab = null;
  captureLevels = null;
  try { await chrome.runtime.sendMessage({ type: 'cap-stop' }); } catch (e) {}
}

chrome.runtime.onConnect.addListener((port) => {
  ports.add(port);
  port.track = null;
  if (sourcePort && sourcePort.track) port.postMessage(sourcePort.track);
  // Give a page that just turned the disc/bar on the current progress + waves right away.
  if (lastTick && Date.now() - lastTick.at < 4000) port.postMessage(lastTick);

  port.onMessage.addListener((m) => {
    if (m.type === 'track') {
      port.track = m;
      if (!sourcePort) sourcePort = port;
      if (port === sourcePort) broadcast(m);
    } else if (m.type === 'tick') {
      if (port !== sourcePort) {
        if (!m.playing || !port.track) return; // another music tab only takes over when it actually plays
        sourcePort = port;
        broadcast(port.track);
      }
      if (captureLevels && m.playing) m.levels = captureLevels; // real audio wins over the simulated wave
      lastTick = { ...m, at: Date.now() };
      broadcast(m);
    } else if (m.type === 'cmd') {
      if (sourcePort) { try { sourcePort.postMessage(m); } catch (e) {} }
      else { try { port.postMessage({ type: 'fx', text: 'No music is playing — open Spotify or YouTube Music' }); } catch (e) {} }
    } else if (m.type === 'fx') {
      broadcast(m);
    }
  });

  port.onDisconnect.addListener(() => {
    ports.delete(port);
    if (port === sourcePort) {
      sourcePort = null;
      lastTick = null;
      broadcast({ type: 'gone' });
    }
  });
});

// Let a content script embed its own site even when the site sends X-Frame-Options: DENY
// or a CSP frame-ancestors rule. Adds a per-site session rule, removed when the window closes.
async function allowFrame(host) {
  const id = nextRule++;
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: [{
        id,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' }
          ]
        },
        condition: { resourceTypes: ['sub_frame'], requestDomains: [host] }
      }]
    });
    return id;
  } catch (e) {
    return 0;
  }
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === 'img') {
    // Fetch artwork here so the page's CORS rules don't block colour extraction.
    fetch(m.url)
      .then((r) => r.blob())
      .then(async (b) => {
        const buf = new Uint8Array(await b.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
          s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        }
        reply({ data: `data:${b.type || 'image/jpeg'};base64,${btoa(s)}` });
      })
      .catch(() => reply({ data: null }));
    return true;
  }

  if (m.type === 'openTab' && /^https?:/i.test(m.url || '')) {
    chrome.tabs.create({ url: m.url });
    return;
  }

  if (m.type === 'allowFrame' && m.host) {
    allowFrame(m.host).then((id) => reply({ id }));
    return true;
  }

  if (m.type === 'freeFrame' && m.id) {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [m.id] }).catch(() => {});
    return;
  }

  // Start / stop capturing a tab's audio. The content script that asks is always the
  // music tab itself, so sender.tab.id is the right target.
  if (m.type === 'cap') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (m.on) startCapture(tabId).then((ok) => reply({ ok }));
    else stopCapture().then(() => reply({ ok: true }));
    return true;
  }

  if (m.type === 'levels') { captureLevels = m.levels || null; return; }
  if (m.type === 'cap-result') { if (!m.ok) { captureLevels = null; capTab = null; } return; }
});

chrome.tabs.onRemoved.addListener((id) => { if (id === capTab) stopCapture(); });

/* Make sure the script is present in every open tab — no manual reload, no
   "manage extensions" step. Existing tabs from before install are covered here. */
function inject(tabId) {
  if (typeof tabId !== 'number') return;
  chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});
}
function injectAll() {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    const list = tabs || [];
    // Stagger the injections so a machine with many open tabs doesn't get a CPU burst.
    list.forEach((t, i) => setTimeout(() => inject(t.id), Math.min(i * 20, 4000)));
  });
}

chrome.runtime.onInstalled.addListener((d) => {
  injectAll();
  if (d.reason === 'install') {
    // One-time welcome / permission page with a single Allow button.
    chrome.tabs.create({ url: chrome.runtime.getURL('onboard.html') });
  }
});
chrome.runtime.onStartup.addListener(injectAll);

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  // Self-heal: inject first, then talk to the page. Never leave a dead "!" badge.
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch (e) {}
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'showLauncher' });
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch (e) {
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#d93025' });
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    chrome.action.setTitle({ tabId: tab.id, title: 'Floaty cannot run on this page (browser/extension pages). Try a normal website.' });
  }
});
