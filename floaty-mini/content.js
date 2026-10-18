(() => {
  // Hot-swap: if a previous copy of Floaty is still running in this page (very common right
  // after the extension is reloaded without refreshing the tab), tear it down so the new UI
  // takes over. Without this, an old script would keep running and everything would look
  // "the same as before" until you manually refreshed the page.
  const MY_GEN = (window.__floatyGen || 0) + 1;
  window.__floatyGen = MY_GEN;
  try { if (window.__floaty && typeof window.__floaty.destroy === 'function') window.__floaty.destroy(); } catch (e) {}
  try { document.querySelectorAll('[data-floaty-host]').forEach((n) => n.remove()); } catch (e) {}
  if (!chrome.runtime || !chrome.runtime.id) return;
  // Shared, always-initialised handles. Declared up here (not further down) so the exposed
  // destroy() can always reach them, even if this copy is torn down mid-boot.
  var hostEl = null, toastT = 0, dropT = 0, watchT = 0, port = null, running = false,
      srcLoop = false, activePip = null, activeRestore = null, adTimer = 0, cancelCrop = null, mediaPlayFn = null;

  const VERSION = '1.3.3';

  /* ───────────────────────────────────────────────────────────────────────────
     LIGHTWEIGHT BY DESIGN
     Nothing heavy is created at page load. This script only adds one tiny
     launcher (a few nodes) and a couple of cheap listeners. The shadow UI, the
     canvases, the port and every timer are built lazily the first time you
     actually use Floaty *in that tab*. Idle/background tabs cost ~nothing.
     ─────────────────────────────────────────────────────────────────────────── */

  const hostname = location.hostname;
  const IS_YTM = hostname === 'music.youtube.com';
  const IS_SPOTIFY = hostname === 'open.spotify.com';
  const IS_SOURCE = IS_YTM || IS_SPOTIFY;
  const IS_YT = !IS_YTM && (/(^|\.)youtube\.com$/.test(hostname) || hostname === 'youtu.be');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const q = (s) => document.querySelector(s);

  // Low-end machines get a lighter visualiser automatically (no feature is removed).
  const MEM = (navigator.deviceMemory || 8);
  const CORES = (navigator.hardwareConcurrency || 8);
  const LITE = MEM <= 4 || CORES <= 4;
  const TICK_MS = LITE ? 120 : 72;   // source poll / wave refresh
  const PROG_MS = LITE ? 220 : 110;  // progress-bar DOM writes

  const BANDS = 24;
  let alive = true;
  // A newer copy of Floaty running in the same page supersedes this one. Every timer, loop and
  // listener checks this, so a stale instance can never keep drawing, hold a port open, or fight
  // the fresh UI — that is what used to leave a "glitchy" disc/bar behind until a manual refresh.
  const ok = () => alive && window.__floatyGen === MY_GEN;

  /* ───────── page helpers ───────── */
  function setCss(el, o) { for (const k in o) { try { el.style[k] = o[k]; } catch (e) {} } }
  function pageBg() {
    try {
      const cs = getComputedStyle(document.body);
      let bg = cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.documentElement).backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)') bg = '#fff';
      return bg;
    } catch (e) { return '#fff'; }
  }

  /* ───────── styles ─────────
     SHELL = always present (launcher + toast + mini-window chrome).
     MUSIC = only adopted when the music disc/bar is first built. */
  const SHELL_CSS = `
:host{all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
button{all:unset;cursor:pointer;box-sizing:border-box}
#launcher{position:fixed;right:0;top:50%;display:flex;flex-direction:column;gap:4px;padding:8px 8px 8px 12px;
  border-radius:12px 0 0 12px;background:rgba(18,18,22,.88);backdrop-filter:blur(8px);pointer-events:auto;
  touch-action:none;cursor:grab;transform:translate(calc(100% - 6px),-50%);opacity:.45;transition:transform .18s,opacity .18s}
#launcher:hover,#launcher.show{transform:translate(0,-50%);opacity:1}
#launcher.moved{transform:none}
#launcher button{display:block;color:#fff;font-size:12px;padding:6px 10px;border-radius:8px;text-align:center;cursor:pointer}
#launcher button:hover{background:rgba(255,255,255,.18)}
#toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(18,18,22,.92);color:#fff;
  font-size:13px;padding:8px 14px;border-radius:10px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:82vw;text-align:center}
#toast.on{opacity:1}
#crop{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;background:rgba(0,0,0,.35);display:none}
#sel{position:absolute;border:2px dashed #fff;background:rgba(255,255,255,.12);display:none}
#open{position:absolute;display:none;background:#0a58ca;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;
  border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,.45);z-index:2;white-space:nowrap}
#open:hover{background:#0b6bf2}
#hint{position:absolute;left:50%;top:18px;transform:translateX(-50%);background:rgba(18,18,22,.92);color:#fff;
  font-size:13px;padding:8px 14px;border-radius:10px;white-space:nowrap}
#panel{position:fixed;left:70px;top:70px;width:440px;height:340px;display:none;flex-direction:column;pointer-events:auto;
  background:#111;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.55);
  border:1px solid rgba(255,255,255,.16);min-width:200px;min-height:140px}
#pbar{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 10px;background:rgba(255,255,255,.09);color:#eee;
  font-size:12px;cursor:grab;user-select:none;touch-action:none}
#pbar:active{cursor:grabbing}
#pbar span{margin-right:auto}
#pbar button{color:#eee;font-size:14px;line-height:1;padding:3px 8px;border-radius:6px}
#pbar button:hover{background:rgba(255,255,255,.2)}
#pbody{flex:1;position:relative;background:#fff;overflow:hidden}
#pgrip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;touch-action:none;z-index:3;
  background:linear-gradient(135deg,transparent 0 50%,rgba(255,255,255,.6) 50% 100%)}`;

  const MUSIC_CSS = `
#disc{position:fixed;display:none;pointer-events:auto;touch-action:none;cursor:grab;user-select:none;--c:#1ed760}
#disc:active{cursor:grabbing}
#plate{position:absolute;inset:-8px;border-radius:22px;z-index:0;pointer-events:none;transition:background .2s,backdrop-filter .2s}
#disc.bg-dark #plate{background:rgba(15,15,18,.72);backdrop-filter:blur(10px)}
#disc.bg-light #plate{background:rgba(255,255,255,.88);backdrop-filter:blur(10px)}
#disc.bg-none #plate{background:transparent}
#in{zoom:var(--s,1);width:200px;position:relative;z-index:1}
#stage{position:relative;width:200px;height:200px}
#viz{position:absolute;inset:0;width:200px;height:200px;pointer-events:none}
#vinyl{position:absolute;left:48px;top:48px;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;
  background:repeating-radial-gradient(circle,transparent 0 3px,color-mix(in srgb,var(--c) 38%,transparent) 3px 4px);
  box-shadow:0 0 0 2px var(--c);animation:spin 6s linear infinite;animation-play-state:paused}
#vinyl.on{animation-play-state:running}
#art{width:62px;height:62px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--c);
  -webkit-mask:radial-gradient(circle,transparent 0 4px,#000 4.5px);mask:radial-gradient(circle,transparent 0 4px,#000 4.5px)}
@keyframes spin{to{transform:rotate(360deg)}}
#ctrl{display:flex;justify-content:center;gap:14px;margin-top:-4px}
#ctrl button{position:relative;width:40px;height:40px;display:grid;place-items:center;color:var(--c);transition:transform .12s}
#ctrl button:hover{transform:scale(1.15)}
#ctrl svg{width:28px;height:28px;fill:currentColor}
#ctrl small{position:absolute;bottom:-2px;font-size:10px;font-weight:700}
#prog{display:flex;align-items:center;gap:8px;margin:6px 8px 0}
#ptrack{position:relative;flex:1;height:6px;border-radius:3px;background:color-mix(in srgb,var(--c) 24%,transparent);
  cursor:pointer;touch-action:none}
#pfill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:3px;background:var(--c)}
#phandle{position:absolute;top:50%;left:0;width:12px;height:12px;border-radius:50%;background:var(--c);transform:translate(-50%,-50%)}
#ptime{color:var(--c);opacity:.85;font-size:10px;font-variant-numeric:tabular-nums;white-space:nowrap}
#bgr{display:flex;justify-content:center;gap:10px;margin-top:6px}
#bgr button,#bbgr button{display:grid;place-items:center;color:var(--c);opacity:.55;border-radius:50%;transition:opacity .15s,background .15s}
#bgr button{width:26px;height:26px}
#bbgr button{width:24px;height:24px}
#bgr button:hover,#bbgr button:hover{opacity:.9}
#bgr button.on,#bbgr button.on{opacity:1;background:color-mix(in srgb,var(--c) 26%,transparent);box-shadow:0 0 0 1.5px var(--c)}
#bgr svg{width:17px;height:17px;fill:currentColor}
#x,#dmode{position:absolute;top:2px;z-index:6;color:var(--c);line-height:1;opacity:.85;padding:1px 8px;border-radius:8px;
  transition:opacity .15s,background .15s}
#x{right:2px;font-size:20px}
#dmode{left:2px;font-size:15px}
#x:hover,#dmode:hover{opacity:1;background:color-mix(in srgb,var(--c) 26%,transparent)}
#bar{position:fixed;display:none;pointer-events:auto;touch-action:none;cursor:grab;user-select:none;--c:#1ed760}
#bar:active{cursor:grabbing}
#bplate{position:absolute;inset:-6px;border-radius:18px;z-index:0;pointer-events:none;transition:background .2s,backdrop-filter .2s}
#bar.bg-dark #bplate{background:rgba(15,15,18,.74);backdrop-filter:blur(10px)}
#bar.bg-light #bplate{background:rgba(255,255,255,.9);backdrop-filter:blur(10px)}
#bar.bg-none #bplate{background:transparent}
#bin{position:relative;z-index:1;display:flex;align-items:center;gap:6px;padding:6px 8px;zoom:var(--s,1);width:560px}
#bart{width:42px;height:42px;border-radius:10px;object-fit:cover;flex:none;background:#000;box-shadow:0 0 0 2px var(--c)}
#bmeta{width:96px;flex:none;min-width:0}
#btitle{color:var(--c);font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bartist{color:var(--c);opacity:.72;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bwave{width:76px;height:34px;flex:none;pointer-events:none}
#bmid{flex:1;min-width:96px}
#bprog{position:relative;height:6px;border-radius:3px;background:color-mix(in srgb,var(--c) 24%,transparent);cursor:pointer;touch-action:none}
#bpf{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:3px;background:var(--c)}
#bph{position:absolute;top:50%;left:0;width:12px;height:12px;border-radius:50%;background:var(--c);transform:translate(-50%,-50%)}
#btime{color:var(--c);opacity:.8;font-size:10px;margin-top:3px;font-variant-numeric:tabular-nums}
#bctrl{display:flex;gap:3px;flex:none}
#bctrl button{position:relative;width:28px;height:28px;display:grid;place-items:center;color:var(--c);transition:transform .12s}
#bctrl button:hover{transform:scale(1.12)}
#bctrl svg{width:21px;height:21px;fill:currentColor}
#bctrl small{position:absolute;bottom:-3px;font-size:9px;font-weight:700}
/* The three background looks live behind a small palette button, so they no longer stretch
   the row — hover (or tap) it and they pop up above the bar. */
#bpop{flex:none;display:flex;align-items:center}
#bbtn{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;color:var(--c);opacity:.7;
  transition:opacity .15s,background .15s}
#bbtn:hover{opacity:1;background:color-mix(in srgb,var(--c) 24%,transparent)}
#bpop.on #bbtn{opacity:1;background:color-mix(in srgb,var(--c) 26%,transparent);box-shadow:0 0 0 1.5px var(--c)}
#bbtn svg{width:16px;height:16px;fill:currentColor}
#bbgr{position:absolute;right:0;bottom:calc(100% + 8px);z-index:9;display:none;gap:4px;padding:7px 8px;border-radius:16px;
  background:rgba(16,16,20,.93);backdrop-filter:blur(10px);box-shadow:0 8px 22px rgba(0,0,0,.4)}
#bpop.on #bbgr{display:flex}
#bar.bg-light #bbgr{background:rgba(255,255,255,.97);box-shadow:0 8px 22px rgba(0,0,0,.22)}
#bbgr svg{width:15px;height:15px;fill:currentColor}
#bclose,#bmode{flex:none;color:var(--c);line-height:1;padding:2px 5px;border-radius:8px;opacity:.85;transition:opacity .15s,background .15s}
#bclose{font-size:17px}
#bmode{font-size:15px}
#bclose:hover,#bmode:hover{opacity:1;background:color-mix(in srgb,var(--c) 24%,transparent)}`;

  const SHELL_HTML = `
<div id="launcher">
  <button data-a="mini" title="Alt+1">Mini</button>
  <button data-a="crop" title="Alt+2">Crop</button>
  <button data-a="disc" title="Alt+3">Disc</button>
  <button data-a="bar" title="Alt+4">Bar</button>
</div>
<div id="toast"></div>`;

  const HEAVY_HTML = `
<div id="crop"><div id="sel"></div><button id="open">Open mini player</button><div id="hint">Drag to select the part you want · Esc to cancel</div></div>
<div id="panel">
  <div id="pbar"><span>Floaty</span><button id="pplay" title="Play / pause the video">⏸</button><button id="pclose" title="Close">✕</button></div>
  <div id="pbody"></div>
  <div id="pgrip"></div>
</div>
<div id="disc" class="bg-none">
  <div id="plate"></div>
  <div id="in">
    <button id="dmode" title="Switch to the music bar (Alt+4)">▤</button>
    <button id="x" title="Hide (Alt+3 shows it again)">×</button>
    <div id="stage"><canvas id="viz"></canvas><div id="vinyl"><img id="art" alt=""></div></div>
    <div id="ctrl">
      <button data-a="back" title="Back 5s"><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6zM21 18V6l-8.5 6z"/></svg><small>5s</small></button>
      <button data-a="play" id="pp" title="Play / pause (Alt+P)"></button>
      <button data-a="fwd" title="Forward 5s"><svg viewBox="0 0 24 24"><path d="M13 6v12l8.5-6zM3 6v12l8.5-6z"/></svg><small>5s</small></button>
    </div>
    <div id="prog"><div id="ptrack"><div id="pfill"></div><div id="phandle"></div></div><div id="ptime">0:00 / 0:00</div></div>
    <div id="bgr"></div>
  </div>
</div>
<div id="bar" class="bg-none">
  <div id="bplate"></div>
  <div id="bin">
    <img id="bart" alt="">
    <div id="bmeta"><div id="btitle">Nothing playing</div><div id="bartist"></div></div>
    <canvas id="bwave"></canvas>
    <div id="bmid"><div id="bprog"><div id="bpf"></div><div id="bph"></div></div><div id="btime">0:00 / 0:00</div></div>
    <div id="bctrl">
      <button data-a="back" title="Back 5s"><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6zM21 18V6l-8.5 6z"/></svg><small>5s</small></button>
      <button data-a="play" id="bpp" title="Play / pause (Alt+P)"></button>
      <button data-a="fwd" title="Forward 5s"><svg viewBox="0 0 24 24"><path d="M13 6v12l8.5-6zM3 6v12l8.5-6z"/></svg><small>5s</small></button>
    </div>
    <div id="bpop">
      <button id="bbtn" title="Background: dark · transparent · white"><svg viewBox="0 0 24 24"><path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5C21 6.53 17.03 3 12 3zM6.5 12c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></button>
      <div id="bbgr"></div>
    </div>
    <button id="bmode" title="Switch to the disc (Alt+3)">◉</button>
    <button id="bclose" title="Hide (Alt+4 shows it again)">×</button>
  </div>
</div>`;

  const BG_ICONS = {
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>',
    none: '<svg viewBox="0 0 24 24"><path d="M6.5 18a4.5 4.5 0 0 1 0-9 5.6 5.6 0 0 1 10.7-1.2A4 4 0 0 1 17 18z"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></g></svg>'
  };
  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

  /* ───────── mount the tiny shell (only this is created eagerly) ───────── */
  hostEl = document.createElement('div');
  try { hostEl.setAttribute('data-floaty-host', '1'); } catch (e) {}
  const root = hostEl.attachShadow({ mode: 'open' });
  root.innerHTML = SHELL_HTML;
  let shellSheet = null;
  try { shellSheet = new CSSStyleSheet(); shellSheet.replaceSync(SHELL_CSS); root.adoptedStyleSheets = [shellSheet]; }
  catch (e) { const s = document.createElement('style'); s.textContent = SHELL_CSS; root.appendChild(s); }
  document.documentElement.appendChild(hostEl);
  const $ = (id) => root.getElementById(id);

  // Expose the teardown handle the instant the shell exists — before any heavy work — so a
  // re-injected copy can always clean this instance up (no duplicated/ghost UI after a reload).
  try { window.__floaty = { version: VERSION, destroy }; } catch (e) {}

  const launcher = $('launcher');
  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2800);
  }

  /* ───────── state ───────── */
  const el = {};                 // filled by ensureUI()
  let uiBuilt = false;
  let musicSheet = null;
  let lastProg = 0;
  const st = {
    track: null, hsl: { h: 140, s: 0.8, l: 0.68 }, ink: '#1ed760', playing: false,
    mode: 'disc', armed: false, bg: 'none', scale: 1,
    x: null, y: null, bx: null, by: null, pos: 0, dur: 0,
    levels: new Array(BANDS).fill(0), disp: new Array(BANDS).fill(0)
  };
  const hslStr = (h, s, l) => 'hsl(' + Math.round(h) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%)';

  /* ───────── lazy UI construction ───────── */
  function fitCanvas(cv, w, h) {
    const dpr = LITE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function ensureUI() {
    if (uiBuilt) return;
    uiBuilt = true;

    const box = document.createElement('div');
    box.innerHTML = HEAVY_HTML;
    while (box.firstChild) root.appendChild(box.firstChild);

    try { musicSheet = new CSSStyleSheet(); musicSheet.replaceSync(MUSIC_CSS); root.adoptedStyleSheets = [...root.adoptedStyleSheets, musicSheet]; }
    catch (e) { const s = document.createElement('style'); s.textContent = MUSIC_CSS; root.appendChild(s); }

    for (const id of ['crop', 'sel', 'open', 'hint', 'panel', 'pbar', 'pplay', 'pclose', 'pbody', 'pgrip',
      'disc', 'plate', 'in', 'stage', 'viz', 'vinyl', 'art', 'ctrl', 'pp', 'prog', 'ptrack', 'pfill', 'phandle', 'ptime',
      'bgr', 'dmode', 'x', 'bar', 'bplate', 'bin', 'bart', 'bmeta', 'btitle', 'bartist', 'bwave', 'bmid', 'bprog',
      'bpf', 'bph', 'btime', 'bctrl', 'bpp', 'bpop', 'bbtn', 'bbgr', 'bmode', 'bclose']) el[id] = $(id);

    el.cx = fitCanvas(el.viz, 200, 200);
    el.bcx = fitCanvas(el.bwave, 76, 34);
    el.pp.innerHTML = ICON_PLAY;
    el.bpp.innerHTML = ICON_PLAY;

    // background buttons: sun = white, cloud = transparent, moon = dark
    for (const row of [el.bgr, el.bbgr]) {
      row.textContent = '';
      for (const k of ['dark', 'none', 'light']) {
        const b = document.createElement('button');
        b.dataset.bg = k;
        b.title = k === 'dark' ? 'Dark background' : k === 'none' ? 'Transparent background' : 'White background';
        b.innerHTML = BG_ICONS[k];
        row.appendChild(b);
      }
    }

    wireMusic();
    wirePanel();
    applyBg();
    applyMode();
    if (st.track) applyTrack();
    renderProgress(true);
    refresh();
  }

  /* ───────── port (lazily connected; dropped when nothing needs it) ───────── */
  function send(m) { try { if (port) port.postMessage(m); } catch (e) {} }
  function ensurePort() {
    if (port) return port;
    if (!chrome.runtime || !chrome.runtime.id) { watchdog(); return null; }
    try {
      port = chrome.runtime.connect({ name: 'floaty' });
      port.onMessage.addListener(onMsg);
      port.onDisconnect.addListener(() => { port = null; watchdog(); });
      if (IS_SOURCE && curTrack) send(curTrack);
    } catch (e) { port = null; watchdog(); }
    return port;
  }
  // Keeps the disc/bar alive through service-worker restarts (MV3 kills the worker when idle),
  // and tears the page down if the extension itself was reloaded/disabled — so you never have to
  // refresh a tab by hand and a dead context can't leave a frozen disc/bar behind.
  function watchdog() {
    if (watchT || !ok()) return;
    watchT = setTimeout(() => {
      watchT = 0;
      if (!ok()) return;
      if (!chrome.runtime || !chrome.runtime.id) { destroy(); return; }
      const need = st.armed || srcPlaying || (IS_SOURCE && st.track);
      if (need && !port) { ensurePort(); if (!port) watchdog(); }
      else if (!need) maybeDropPort();
    }, 1500);
  }
  function maybeDropPort() {
    if (!port || dropT) return;
    dropT = setTimeout(() => {
      dropT = 0;
      // Keep the port while a music tab still has a track loaded (even if paused), so the
      // disc/bar in other tabs don't lose the song just because playback was paused.
      const keepForSource = IS_SOURCE && st.track;
      if (ok() && port && !st.armed && !srcPlaying && !keepForSource) { try { port.disconnect(); } catch (e) {} port = null; }
    }, 8000);
  }

  /* ───────── background buttons / mode ───────── */
  function applyAccent() {
    const a = st.hsl;
    st.ink = st.bg === 'light' ? hslStr(a.h, Math.min(1, a.s * 1.05), 0.30) : hslStr(a.h, a.s, a.l);
    if (el.disc) el.disc.style.setProperty('--c', st.ink);
    if (el.bar) el.bar.style.setProperty('--c', st.ink);
  }
  function applyBg() {
    if (!el.disc) return;
    el.disc.className = 'bg-' + st.bg;
    el.bar.className = 'bg-' + st.bg;
    for (const b of root.querySelectorAll('#bgr button,#bbgr button')) b.classList.toggle('on', b.dataset.bg === st.bg);
    applyAccent();
  }
  function applyMode() {
    if (!el.disc) return;
    el.disc.style.display = st.armed && st.mode === 'disc' ? 'block' : 'none';
    el.bar.style.display = st.armed && st.mode === 'bar' ? 'block' : 'none';
  }
  function place() {
    if (!el.disc) return;
    const w = el.disc.offsetWidth || 200, h = el.disc.offsetHeight || 270;
    if (st.x == null) { st.x = innerWidth - w - 40; st.y = innerHeight - h - 40; }
    setCss(el.disc, { left: clamp(st.x, -w + 60, innerWidth - 60) + 'px', top: clamp(st.y, -h + 60, innerHeight - 60) + 'px' });
    el.disc.style.setProperty('--s', st.scale);
  }
  function placeBar() {
    if (!el.bar) return;
    const w = el.bar.offsetWidth || 600, h = el.bar.offsetHeight || 60;
    if (st.bx == null) { st.bx = Math.max(16, (innerWidth - w) / 2); st.by = innerHeight - h - 30; }
    setCss(el.bar, { left: clamp(st.bx, -w + 80, innerWidth - 80) + 'px', top: clamp(st.by, -h + 40, innerHeight - 40) + 'px' });
    el.bar.style.setProperty('--s', st.scale);
  }
  function refresh() {
    if (!uiBuilt) return;
    applyMode();
    if (st.armed) {
      if (st.mode === 'disc') place(); else placeBar();
      kick();
    }
  }
  function setMusicVisible(v, mode, silent) {
    if (mode) st.mode = mode;
    st.armed = !!v;
    // Remember the choice so the disc/bar follow you to every other page and tab, and reappear
    // automatically. Closing it with × turns it off everywhere again.
    try { chrome.storage.local.set({ fl_on: st.armed, fl_mode: st.mode }); } catch (e) {}
    if (st.armed) { ensureUI(); ensurePort(); }
    refresh();
    if (!st.armed) maybeDropPort();
    if (st.armed && !st.track && !silent) toast('Play something on Spotify or YouTube Music to fill the ' + (st.mode === 'bar' ? 'bar' : 'disc'));
  }
  function toggleDisc() { setMusicVisible(!(st.armed && st.mode === 'disc'), 'disc'); }
  function toggleBar() { setMusicVisible(!(st.armed && st.mode === 'bar'), 'bar'); }

  function applyTrack() {
    if (!el.art) return;
    const t = st.track;
    if (!t) return;
    if (t.art) { el.art.src = t.art; el.art.style.visibility = 'visible'; el.bart.src = t.art; }
    else { el.art.style.visibility = 'hidden'; }
    if (t.hsl) st.hsl = t.hsl;
    applyAccent();
    el.disc.title = [t.title, t.artist].filter(Boolean).join(' - ');
    el.btitle.textContent = t.title || 'Unknown title';
    el.bartist.textContent = t.artist || '';
  }
  function setPlaying(p) {
    if (p === st.playing) return;
    st.playing = p;
    if (!el.vinyl) return;
    el.vinyl.classList.toggle('on', p);
    const ic = p ? ICON_PAUSE : ICON_PLAY;
    el.pp.innerHTML = ic; el.bpp.innerHTML = ic;
  }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function renderProgress(force) {
    if (!el.pfill || !st.armed) return;
    const now = performance.now();
    if (!force && now - lastProg < PROG_MS) return;
    lastProg = now;
    const f = st.dur ? clamp(st.pos / st.dur, 0, 1) : 0;
    const pct = (f * 100) + '%';
    el.pfill.style.width = pct; el.phandle.style.left = pct;
    el.bpf.style.width = pct; el.bph.style.left = pct;
    const txt = fmt(st.pos) + ' / ' + fmt(st.dur);
    el.ptime.textContent = txt; el.btime.textContent = txt;
  }

  /* ───────── visualiser (draws only while it is actually moving) ───────── */
  function drawRing() {
    const cx = el.cx, N = BANDS * 2, R0 = 58, L = 36;
    cx.clearRect(0, 0, 200, 200);
    cx.save(); cx.translate(100, 100);
    cx.strokeStyle = st.ink; cx.lineCap = 'round'; cx.lineWidth = 3;
    if (!LITE) { cx.shadowColor = st.ink; cx.shadowBlur = 6; }
    for (let i = 0; i < N; i++) {
      const k = i < BANDS ? i : N - 1 - i;
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const len = 3 + Math.pow(st.disp[k], 0.9) * L;
      cx.beginPath();
      cx.moveTo(Math.cos(a) * R0, Math.sin(a) * R0);
      cx.lineTo(Math.cos(a) * (R0 + len), Math.sin(a) * (R0 + len));
      cx.stroke();
    }
    cx.restore();
  }
  function drawBars() {
    const cx = el.bcx, W = 76, H = 34, n = LITE ? 12 : 16, gap = 2;
    const bw = (W - gap * (n - 1)) / n;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = st.ink;
    if (!LITE) { cx.shadowColor = st.ink; cx.shadowBlur = 5; }
    for (let i = 0; i < n; i++) {
      const src = st.disp[Math.floor(i * BANDS / n)] || 0;
      const h = Math.max(3, Math.pow(src, 0.9) * (H - 6));
      const x = i * (bw + gap), y = (H - h) / 2, r = Math.min(bw / 2, 3);
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.arcTo(x + bw, y, x + bw, y + h, r);
      cx.arcTo(x + bw, y + h, x, y + h, r);
      cx.arcTo(x, y + h, x, y, r);
      cx.arcTo(x, y, x + bw, y, r);
      cx.closePath(); cx.fill();
    }
  }
  function drawLoop() {
    if (!ok() || !st.armed) { running = false; return; }
    const d = st.disp;
    for (let i = 0; i < BANDS; i++) d[i] += ((st.levels[i] || 0) - d[i]) * 0.4;
    if (st.mode === 'disc') drawRing(); else drawBars();
    let moving = st.playing;
    if (!moving) { for (let i = 0; i < BANDS; i++) if (d[i] > 0.03) { moving = true; break; } }
    if (moving) requestAnimationFrame(drawLoop); else running = false;  // stop when idle: no CPU burn on a paused player
  }
  function kick() { if (ok() && st.armed && !running && uiBuilt) { running = true; requestAnimationFrame(drawLoop); } }

  /* ───────── wiring for the music UI ───────── */
  function wireSeek(trackEl) {
    let on = false;
    trackEl.addEventListener('pointerdown', (e) => {
      on = true; e.stopPropagation();
      try { trackEl.setPointerCapture(e.pointerId); } catch (err) {}
      seekAt(trackEl, e.clientX);
    });
    trackEl.addEventListener('pointermove', (e) => { if (on) seekAt(trackEl, e.clientX); });
    trackEl.addEventListener('pointerup', (e) => { on = false; e.stopPropagation(); });
  }
  function seekAt(trackEl, clientX) {
    if (!st.dur) return;
    const r = trackEl.getBoundingClientRect();
    if (!r.width) return;
    st.pos = clamp((clientX - r.left) / r.width, 0, 1) * st.dur;
    renderProgress(true);
    send({ type: 'cmd', a: 'seek', p: st.pos });
  }
  function wireMusic() {
    wireSeek(el.ptrack);
    wireSeek(el.bprog);

    let dDisc = null;
    el.disc.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button,#ptrack')) return;
      dDisc = { dx: e.clientX - el.disc.offsetLeft, dy: e.clientY - el.disc.offsetTop };
      try { el.disc.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.disc.addEventListener('pointermove', (e) => { if (!dDisc) return; st.x = e.clientX - dDisc.dx; st.y = e.clientY - dDisc.dy; place(); });
    el.disc.addEventListener('pointerup', () => { if (!dDisc) return; dDisc = null; chrome.storage.local.set({ fl_x: st.x, fl_y: st.y }); });
    el.disc.addEventListener('wheel', (e) => {
      e.preventDefault();
      st.scale = clamp(st.scale * (e.deltaY < 0 ? 1.08 : 0.92), 0.5, 2.5);
      place(); chrome.storage.local.set({ fl_scale: st.scale });
    }, { passive: false });

    let dBar = null;
    el.bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button,#bprog,#bbgr')) return;
      dBar = { dx: e.clientX - el.bar.offsetLeft, dy: e.clientY - el.bar.offsetTop };
      try { el.bar.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.bar.addEventListener('pointermove', (e) => { if (!dBar) return; st.bx = e.clientX - dBar.dx; st.by = e.clientY - dBar.dy; placeBar(); });
    el.bar.addEventListener('pointerup', () => { if (!dBar) return; dBar = null; chrome.storage.local.set({ fl_bx: st.bx, fl_by: st.by }); });
    el.bar.addEventListener('wheel', (e) => {
      e.preventDefault();
      st.scale = clamp(st.scale * (e.deltaY < 0 ? 1.08 : 0.92), 0.5, 2.5);
      placeBar(); chrome.storage.local.set({ fl_scale: st.scale });
    }, { passive: false });

    el.x.addEventListener('click', (e) => { e.stopPropagation(); setMusicVisible(false); });
    el.bclose.addEventListener('click', (e) => { e.stopPropagation(); setMusicVisible(false); });
    el.dmode.addEventListener('click', (e) => { e.stopPropagation(); st.mode = 'bar'; chrome.storage.local.set({ fl_mode: 'bar' }); refresh(); });
    el.bmode.addEventListener('click', (e) => { e.stopPropagation(); st.mode = 'disc'; chrome.storage.local.set({ fl_mode: 'disc' }); refresh(); });
    el.ctrl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mediaButton(b.dataset.a); });
    el.bctrl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mediaButton(b.dataset.a); });
    const onBg = (e) => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.bg) return;
      st.bg = b.dataset.bg; chrome.storage.local.set({ fl_bg: st.bg }); applyBg();
    };
    el.bgr.addEventListener('click', onBg);
    el.bbgr.addEventListener('click', onBg);

    // Bar background picker: hidden behind a palette button so the row stays short. Hover (mouse)
    // or tap opens it, and it flips above / below whichever side has room.
    //
    // Closing is deliberately lazy: the picker sits *outside* the button's box, so travelling the
    // few pixels between them briefly leaves the button — an instant close would shut the options
    // in the user's face before the mouse could reach them. So we wait a beat, cancel as soon as
    // the pointer reaches either element, and re-check :hover before actually closing (and if the
    // pointer does arrive after a close, entering the picker simply reopens it).
    let closeT = 0;
    function setPop(on) {
      if (!el.bpop) return;
      el.bpop.classList.toggle('on', on);
      if (!on) return;
      const ph = el.bbgr.getBoundingClientRect().height;
      const br = el.bin.getBoundingClientRect();
      const roomAbove = br.top - ph - 10 > 0;
      const roomBelow = br.bottom + ph + 10 < innerHeight;
      const below = !roomAbove && roomBelow;
      // Set the unused edge to `auto` explicitly — an empty string would fall back to the
      // stylesheet's `bottom` and over-constrain the box (the picker would collapse to its padding).
      el.bbgr.style.bottom = below ? 'auto' : 'calc(100% + 8px)';
      el.bbgr.style.top = below ? 'calc(100% + 8px)' : 'auto';
    }
    function cancelClose() { if (closeT) { clearTimeout(closeT); closeT = 0; } }
    function scheduleClose() {
      cancelClose();
      closeT = setTimeout(() => {
        closeT = 0;
        if (!ok()) return;
        try { if (el.bpop.matches(':hover') || el.bbgr.matches(':hover')) return; } catch (e) {}
        setPop(false);
      }, 250);
    }
    const inPicker = (n) => !!n && (el.bpop.contains(n) || el.bbgr.contains(n));
    el.bpop.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      cancelClose(); setPop(true);
    });
    el.bbgr.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') cancelClose(); });
    el.bpop.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || inPicker(e.relatedTarget)) return;
      scheduleClose();
    });
    el.bbgr.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || inPicker(e.relatedTarget)) return;
      scheduleClose();
    });
    el.bbtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelClose();
      // Clicking/tapping the icon only ever *opens*. With a mouse, hover usually beat you to it
      // and the options are already there (snapping them shut on that click felt broken); a tap
      // opens them, and either way they go away when you move off or tap anywhere else.
      setPop(true);
    });
  }

  // Taps/clicks outside the bar's palette button dismiss its background picker (module scope so
  // destroy() can take it back off — a hot-swapped instance must not leave listeners behind).
  function onDocPointer(e) {
    if (!el.bpop || !el.bpop.classList.contains('on')) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(el.bpop) !== -1) return;
    el.bpop.classList.remove('on');
  }

  // The disc/bar buttons control the music source; if there is none, they control a video on the page.
  function mediaButton(a) {
    if (st.track || IS_SOURCE) { send({ type: 'cmd', a }); return; }
    if (a === 'play' && mainVideo()) { togglePageVideo(); return; }
    if ((a === 'fwd' || a === 'back') && mainVideo()) { nudgeVideo(a === 'fwd' ? 5 : -5); return; }
    send({ type: 'cmd', a });
  }

  /* ───────── mini-window (panel) chrome ───────── */
  function wirePanel() {
    el.pclose.addEventListener('click', () => { el.pbody.textContent = ''; el.panel.style.display = 'none'; freeAllow(); });
    el.pplay.addEventListener('click', panelPlay);
    const panel = el.panel, pbarEl = el.pbar, grip = el.pgrip;
    let mv = null, rz = null;
    pbarEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      mv = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
      try { pbarEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    pbarEl.addEventListener('pointermove', (e) => {
      if (!mv) return;
      panel.style.left = clamp(e.clientX - mv.dx, 0, innerWidth - 60) + 'px';
      panel.style.top = clamp(e.clientY - mv.dy, 0, innerHeight - 30) + 'px';
    });
    pbarEl.addEventListener('pointerup', () => { mv = null; });
    grip.addEventListener('pointerdown', (e) => {
      rz = { x: e.clientX, y: e.clientY, w: panel.offsetWidth, h: panel.offsetHeight };
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      e.stopPropagation();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!rz) return;
      setCss(panel, { width: Math.max(200, rz.w + e.clientX - rz.x) + 'px', height: Math.max(140, rz.h + e.clientY - rz.y) + 'px' });
    });
    grip.addEventListener('pointerup', () => { rz = null; });
  }
  function frameVideo() {
    const fr = el.pbody && el.pbody.querySelector('iframe');
    try { const d = fr && fr.contentDocument; if (d) return biggestVideo(d); } catch (e) {}
    return null;
  }
  function panelPlay() {
    const v = frameVideo() || mainVideo();
    if (!v) { toast('No video to control here'); return; }
    try { if (v.paused) v.play(); else v.pause(); } catch (e) {}
  }

  /* ───────── video helpers (fixes YouTube pause from the mini player) ───────── */
  function biggestVideo(doc) {
    const vs = [...doc.querySelectorAll('video')].filter((v) => v.readyState > 0 || (isFinite(v.duration) && v.duration > 0));
    if (!vs.length) return null;
    vs.sort((a, b) => (a.paused === b.paused ? 0 : a.paused ? 1 : -1) || (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
    return vs[0];
  }
  function mainVideo() { return biggestVideo(document); }
  function togglePageVideo() {
    const v = mainVideo();
    if (!v) return false;
    try {
      if (v.paused) { v.play(); toast('Playing'); } else { v.pause(); toast('Paused'); }
    } catch (e) { return false; }
    return true;
  }
  function nudgeVideo(d) {
    const v = mainVideo();
    if (!v) return false;
    try { v.currentTime = clamp(v.currentTime + d, 0, v.duration || 1e9); } catch (e) {}
    return true;
  }
  function pageVolume(delta) {
    const v = mainVideo();
    if (!v) return false;
    try {
      v.volume = clamp(Math.round((v.volume + delta) * 100) / 100, 0, 1);
      if (v.muted && delta > 0) v.muted = false;
      toast('Volume ' + Math.round(v.volume * 100) + '%');
    } catch (e) { return false; }
    return true;
  }

  /* ───────── crop + mini window ───────── */
  function requestAllow() {
    return new Promise((res) => {
      try { chrome.runtime.sendMessage({ type: 'allowFrame', host: location.hostname }, (r) => { if (r && r.id) allowId = r.id; res(); }); }
      catch (e) { res(); }
    });
  }
  let allowId = 0;
  function freeAllow() { if (!allowId) return; try { chrome.runtime.sendMessage({ type: 'freeFrame', id: allowId }); } catch (e) {} allowId = 0; }

  function pickFromRect(r) {
    const el0 = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2);
    let e = el0 && el0 !== hostEl ? el0 : document.body;
    const tol = 6;
    while (e.parentElement && e !== document.body) {
      const b = e.getBoundingClientRect();
      if (b.left <= r.x + tol && b.top <= r.y + tol && b.right >= r.x + r.w - tol && b.bottom >= r.y + r.h - tol) break;
      e = e.parentElement;
    }
    return e;
  }
  function pickMain() {
    const m = q('main,[role=main],article');
    if (m && m.getBoundingClientRect().height > 100) return m;
    let e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    if (!e || e === hostEl) return document.body;
    while (e.parentElement && e.parentElement !== document.body && e.getBoundingClientRect().width < innerWidth * 0.5) e = e.parentElement;
    return e;
  }
  function copyStyles(d) {
    for (const sheet of document.styleSheets) {
      if (sheet.disabled || (sheet.media && sheet.media.mediaText === 'print')) continue;
      try {
        if (sheet.href) { const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = sheet.href; d.head.append(l); }
        else { const s = d.createElement('style'); s.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n'); d.head.append(s); }
      } catch (e) {}
    }
    for (const sheet of document.adoptedStyleSheets || []) {
      try { const s = d.createElement('style'); s.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n'); d.head.append(s); } catch (e) {}
    }
  }
  function makeFrame(d, rect) {
    const bg = pageBg();
    const wrap = d.createElement('div');
    setCss(wrap, { position: 'absolute', inset: '0', overflow: 'hidden', background: bg });
    const fr = d.createElement('iframe');
    fr.setAttribute('allow', 'autoplay; clipboard-read; clipboard-write; fullscreen; encrypted-media');
    if (rect) {
      const ox = Math.max(0, Math.round(rect.x + scrollX));
      const oy = Math.max(0, Math.round(rect.y + scrollY));
      const tw = Math.max(document.documentElement.scrollWidth, innerWidth);
      const th = Math.max(document.documentElement.scrollHeight, innerHeight);
      setCss(fr, { position: 'absolute', left: '0', top: '0', width: tw + 'px', height: th + 'px',
        marginLeft: (-ox) + 'px', marginTop: (-oy) + 'px', border: '0', display: 'block', background: bg });
    } else {
      setCss(fr, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', display: 'block', background: bg });
    }
    fr.src = location.href;
    wrap.appendChild(fr);
    return { wrap, fr };
  }
  function frameLoads(fr, within) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; res(v); } };
      const tm = setTimeout(() => fin(true), within || 3500);
      fr.addEventListener('load', () => {
        clearTimeout(tm);
        try { const doc = fr.contentDocument; if (doc && doc.body && doc.body.childElementCount > 0) return fin(true); } catch (e) {}
        fin(false);
      }, { once: true });
      fr.addEventListener('error', () => { clearTimeout(tm); fin(false); }, { once: true });
    });
  }
  function buildMove(d, rect) {
    let target = rect ? pickFromRect(rect) : pickMain();
    if (target === document.documentElement) target = document.body;
    const tb = target.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (rect) { dx = rect.x - tb.left; dy = rect.y - tb.top; }
    copyStyles(d);
    for (const a of document.documentElement.attributes) { try { d.documentElement.setAttribute(a.name, a.value); } catch (e) {} }
    const cs = getComputedStyle(document.body);
    const wrap = d.createElement('div');
    setCss(wrap, { position: 'fixed', inset: '0', overflow: 'auto', background: pageBg(),
      color: cs.color, fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight });
    const inner = d.createElement('div');
    setCss(inner, rect ? { width: Math.ceil(tb.width) + 'px' } : { width: '100%' });
    wrap.appendChild(inner);
    let restore = () => {};
    if (target === document.body) {
      const copy = document.body.cloneNode(true);
      copy.querySelectorAll('script,noscript').forEach((n) => n.remove());
      inner.appendChild(copy);
    } else {
      const playing = [...target.querySelectorAll('video')].filter((v) => !v.paused);
      const ph = document.createComment('floaty');
      target.before(ph);
      inner.appendChild(target);
      restore = () => { if (ph.isConnected) ph.replaceWith(target); };
      playing.forEach((v) => { try { v.play().catch(() => {}); } catch (e) {} });
    }
    d.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (a) { e.preventDefault(); try { chrome.runtime.sendMessage({ type: 'openTab', url: a.href }); } catch (err) {} }
    }, true);
    const align = () => { wrap.scrollLeft = dx; wrap.scrollTop = dy; };
    try { d.defaultView.requestAnimationFrame(align); } catch (e) {}
    setTimeout(align, 150); setTimeout(align, 600);
    return { wrap, restore };
  }

  async function openPip(rect) {
    if (!window.documentPictureInPicture) return 'nodpip';
    const w = rect ? clamp(Math.round(rect.w), 220, 960) : clamp(Math.round(innerWidth * 0.42), 320, 560);
    const h = rect ? clamp(Math.round(rect.h), 140, 820) : Math.min(760, Math.round(innerHeight * 0.82));
    let pip;
    try { pip = await documentPictureInPicture.requestWindow({ width: w, height: h }); }
    catch (e) { return 'activation'; }
    if (!pip || pip.closed) return 'closed';
    activePip = pip;
    let restore = () => {};
    pip.addEventListener('pagehide', () => {
      try { restore(); } catch (e) {}
      activeRestore = null; activePip = null; freeAllow();
    });
    try {
      const d = pip.document;
      d.title = document.title;
      const base = d.createElement('base'); base.href = location.href; d.head.appendChild(base);
      setCss(d.documentElement, { margin: '0', width: '100%', height: '100%', overflow: 'hidden', background: pageBg() });
      setCss(d.body, { margin: '0', width: '100%', height: '100%', overflow: 'hidden' });
      // Add a working play/pause so popped-out videos are always controllable.
      const bar = d.createElement('div');
      setCss(bar, { position: 'absolute', right: '10px', bottom: '10px', zIndex: '2147483647', display: 'flex', gap: '6px' });
      const mk = (label, fn) => { const b = d.createElement('button'); b.textContent = label; setCss(b, { background: 'rgba(20,20,24,.82)', color: '#fff', border: '0', borderRadius: '8px', padding: '6px 12px', font: '600 13px system-ui,sans-serif', cursor: 'pointer' }); b.onclick = fn; bar.appendChild(b); return b; };
      const pv = () => biggestVideoIn(pip.document);
      mk('⏯', () => { const v = pv(); if (v) { try { v.paused ? v.play() : v.pause(); } catch (e) {} } });
      await requestAllow();
      const built = makeFrame(d, rect);
      d.body.appendChild(built.wrap);
      d.body.appendChild(bar);
      const ok = await frameLoads(built.fr, 3500);
      if (pip.closed) { freeAllow(); return 'closed'; }
      if (!ok) {
        built.wrap.remove();
        const mv = buildMove(d, rect);
        restore = mv.restore;
        activeRestore = mv.restore;
        d.body.appendChild(mv.wrap);
        freeAllow();
      } else if (!rect) {
        try { built.fr.contentWindow.scrollTo(scrollX, scrollY); } catch (e) {}
      }
    } catch (e) {
      if (pip.closed) { freeAllow(); return 'closed'; }
      console.error('[Floaty]', e);
      activeRestore = null; activePip = null;
      try { restore(); pip.close(); } catch (e2) {}
      freeAllow();
      toast('Mini window failed: ' + (e && e.message ? e.message : 'unknown error'));
      return 'error';
    }
    return 'ok';
  }
  function biggestVideoIn(d) { try { return biggestVideo(d); } catch (e) { return null; } }

  async function openPanel(rect) {
    ensureUI();
    const panel = el.panel, pbody = el.pbody;
    pbody.textContent = '';
    await requestAllow();
    const built = makeFrame(document, rect);
    setCss(built.wrap, { position: 'absolute', inset: '0', overflow: 'hidden' });
    pbody.appendChild(built.wrap);
    const ok = await frameLoads(built.fr, 2600);
    if (!ok) {
      pbody.textContent = '';
      freeAllow();
      toast('This site blocks the mini window. Chrome/Edge 116+ usually works — try again.');
      return false;
    }
    const w = rect ? clamp(Math.round(rect.w), 220, 960) : clamp(Math.round(innerWidth * 0.42), 320, 560);
    const h = rect ? clamp(Math.round(rect.h), 140, 820) : clamp(Math.round(innerHeight * 0.72), 260, 720);
    setCss(panel, { display: 'flex', width: w + 'px', height: h + 'px' });
    panel.style.left = clamp(parseFloat(panel.style.left) || 70, 8, Math.max(8, innerWidth - w - 8)) + 'px';
    panel.style.top = clamp(parseFloat(panel.style.top) || 70, 8, Math.max(8, innerHeight - h - 8)) + 'px';
    return true;
  }

  async function openMini(rect) {
    if (IS_YT) return await toggleVideo();
    if (IS_SOURCE) { setMusicVisible(true); return true; }
    const s = await openPip(rect);
    if (s === 'ok') return true;
    if (s === 'activation' && rect) { toast('Press Enter or click “Open mini player”'); return false; }
    return await openPanel(rect);
  }

  /* ───────── YouTube: native video mini player (pause works via Alt+P and the pop-out button) ───────── */
  async function toggleVideo() {
    if (document.pictureInPictureElement) { try { await document.exitPictureInPicture(); } catch (e) {} return true; }
    const v = mainVideo();
    if (!v) { toast('No video found on this page'); return false; }
    v.disablePictureInPicture = false;
    try { await v.requestPictureInPicture(); }
    catch (e) { toast('Could not open the video mini player'); return false; }
    toast('Mini player: press Alt+P to pause');
    return true;
  }
  function smartMini() {
    if (IS_YT) { toggleVideo(); return; }
    if (IS_SOURCE) { setMusicVisible(true); return; }
    openMini();
  }

  /* ───────── crop selector ───────── */
  let cropping = false;
  function startCrop() {
    if (cropping) return;
    ensureUI();
    cropping = true;
    const ov = el.crop, sel = el.sel, hint = el.hint, openB = el.open;
    ov.style.display = 'block';
    sel.style.display = 'none';
    openB.style.display = 'none';
    hint.textContent = 'Drag to select the part you want  ·  Esc to cancel';
    let x0 = 0, y0 = 0, rect = null, dragging = false;
    const end = () => {
      cropping = false;
      cancelCrop = null;
      ov.style.display = 'none'; openB.style.display = 'none'; sel.style.display = 'none';
      ov.onpointerdown = ov.onpointermove = ov.onpointerup = null;
      window.removeEventListener('keydown', onKey, true);
    };
    cancelCrop = end;
    const showOpen = () => {
      if (!rect) return;
      openB.style.display = 'block';
      openB.style.left = clamp(rect.x + rect.w - 150, 8, Math.max(8, innerWidth - 165)) + 'px';
      openB.style.top = clamp(rect.y + rect.h + 8, 8, Math.max(8, innerHeight - 44)) + 'px';
    };
    const tryOpen = async () => {
      if (!rect) return;
      const r = rect;
      ov.style.display = 'none'; openB.style.display = 'none';
      if (await openMini(r)) end();
      else { ov.style.display = 'block'; hint.textContent = 'Click “Open mini player” (or press Enter)  ·  Esc to cancel'; showOpen(); }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
      else if (e.key === 'Enter' && rect) { e.preventDefault(); e.stopPropagation(); tryOpen(); }
    };
    window.addEventListener('keydown', onKey, true);
    ov.onpointerdown = (e) => {
      if (e.target === openB) return;
      dragging = true; x0 = e.clientX; y0 = e.clientY; rect = null;
      openB.style.display = 'none';
      try { ov.setPointerCapture(e.pointerId); } catch (err) {}
      sel.style.display = 'block';
    };
    ov.onpointermove = (e) => {
      if (!dragging) return;
      const x = Math.min(x0, e.clientX), y = Math.min(y0, e.clientY);
      const w = Math.abs(e.clientX - x0), h = Math.abs(e.clientY - y0);
      rect = { x, y, w, h };
      setCss(sel, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    };
    ov.onpointerup = () => {
      if (!dragging) return;
      dragging = false;
      if (!rect || rect.w < 30 || rect.h < 30) { sel.style.display = 'none'; rect = null; return; }
      hint.textContent = 'Opening…';
      tryOpen();
    };
    openB.onpointerdown = (e) => e.stopPropagation();
    openB.onclick = (e) => { e.stopPropagation(); tryOpen(); };
  }

  /* ───────── launcher (eager, but tiny) ───────── */
  launcher.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'mini') smartMini();
    else if (a === 'crop') startCrop();
    else if (a === 'disc') toggleDisc();
    else if (a === 'bar') toggleBar();
  });
  (() => {
    let ld = null;
    launcher.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = launcher.getBoundingClientRect();
      ld = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { launcher.setPointerCapture(e.pointerId); } catch (err) {}
    });
    launcher.addEventListener('pointermove', (e) => {
      if (!ld) return;
      launcher.classList.add('show', 'moved');
      setCss(launcher, { left: clamp(e.clientX - ld.dx, 4, innerWidth - 70) + 'px',
        top: clamp(e.clientY - ld.dy, 4, innerHeight - 50) + 'px', right: 'auto' });
      chrome.storage.local.set({ fl_lx: launcher.offsetLeft, fl_ly: launcher.offsetTop });
    });
    launcher.addEventListener('pointerup', () => { ld = null; });
  })();

  /* ───────── keyboard: Alt+1/2/3/4, Alt+P, Alt+V, Alt+B ───────── */
  function onGlobalKey(e) {
    if (!ok()) return;
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const code = e.code || '';
    let n = 0;
    if (/^Digit[1-4]$/.test(code) || /^Numpad[1-4]$/.test(code)) n = +code.slice(-1);
    else if (e.keyCode >= 49 && e.keyCode <= 52) n = e.keyCode - 48;
    else if (e.keyCode >= 97 && e.keyCode <= 100) n = e.keyCode - 96;
    if (n) {
      e.preventDefault(); e.stopPropagation();
      if (n === 1) smartMini();
      else if (n === 2) startCrop();
      else if (n === 3) toggleDisc();
      else toggleBar();
      return;
    }
    const k = /^Key[A-Z]$/.test(code) ? code : 'Key' + String(e.key || '').toUpperCase();
    if (k === 'KeyP') {
      e.preventDefault(); e.stopPropagation();
      if (IS_SOURCE) { ensurePort(); send({ type: 'cmd', a: 'play' }); }
      else if (mainVideo()) togglePageVideo();               // ← YouTube / any video on the page
      else { ensurePort(); send({ type: 'cmd', a: 'play' }); } // ← remote music
    } else if (k === 'KeyV' || k === 'KeyB') {
      e.preventDefault(); e.stopPropagation();
      const d = k === 'KeyV' ? 0.05 : -0.05;
      if (IS_SOURCE) { ensurePort(); send({ type: 'cmd', a: k === 'KeyV' ? 'vol+' : 'vol-' }); }
      else if (!pageVolume(d)) { ensurePort(); send({ type: 'cmd', a: k === 'KeyV' ? 'vol+' : 'vol-' }); }
    }
  }
  window.addEventListener('keydown', onGlobalKey, true);
  document.addEventListener('pointerdown', onDocPointer, true);

  chrome.runtime.onMessage.addListener((m) => {
    if (!ok()) return;
    if (m.type === 'showLauncher') {
      launcher.classList.add('show');
      toast('Floaty is active. Alt+1 Mini · Alt+2 Crop · Alt+3 Disc · Alt+4 Bar · Alt+P pause · Alt+V/B volume');
      setTimeout(() => launcher.classList.remove('show'), 5000);
    }
  });

  /* ───────── message handling ───────── */
  let curTrack = null;
  function onMsg(m) {
    if (m.type === 'track') { st.track = m; if (uiBuilt) { applyTrack(); refresh(); } }
    else if (m.type === 'tick') {
      if (m.levels) st.levels = m.levels;
      if (typeof m.pos === 'number') st.pos = m.pos;
      if (typeof m.dur === 'number') st.dur = m.dur;
      if (uiBuilt) { setPlaying(m.playing); renderProgress(); kick(); }
    }
    else if (m.type === 'gone') { st.track = null; if (uiBuilt) { setPlaying(false); st.pos = 0; st.dur = 0; renderProgress(true); refresh(); } }
    else if (m.type === 'fx') { if (m.text) toast(m.text); }
    else if (m.type === 'cmd' && IS_SOURCE) doCmd(m.a, m.p);
  }

  /* ───────── music source (Spotify / YouTube Music tab) ───────── */
  let srcPlaying = false, srcVol = 1, srcIdle = 0, lastTrackCheck = 0, capOn = false, capRetry = 0;
  const refCache = { t: 0, video: null, pos: null, dur: null, play: null, bar: null };

  const parseT = (t) => { const p = (t || '').trim().split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
  const bigArt = (u) => (u ? u.replace(/ab67616d0000(4851|1e02)/, 'ab67616d0000b273') : u);

  function readMeta() {
    let title, artist, art;
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    if (md && md.title) {
      title = md.title; artist = md.artist;
      const a = md.artwork ? [...md.artwork] : [];
      if (a.length) art = a.reduce((b, x) => ((parseInt(x.sizes) || 0) >= (parseInt(b.sizes) || 0) ? x : b)).src;
    }
    if (IS_SPOTIFY) {
      title = title || (q('[data-testid="context-item-link"]') || {}).textContent;
      artist = artist || (q('[data-testid="context-item-info-artist"]') || {}).textContent;
      art = bigArt(art || (q('[data-testid="cover-art-image"]') || {}).src);
    } else {
      const barEl = q('ytmusic-player-bar');
      title = title || (barEl && barEl.querySelector('.title') || {}).textContent;
      artist = artist || (barEl && barEl.querySelector('.byline') || {}).textContent;
      art = art || (barEl && barEl.querySelector('img.image') || q('#song-image img') || {}).src;
    }
    return { title: (title || '').trim(), artist: (artist || '').trim(), art };
  }
  function readState() {
    const now = performance.now();
    if (IS_YTM) {
      if (!refCache.video || !refCache.video.isConnected || now - refCache.t > 2000) { refCache.t = now; refCache.video = q('video'); }
      const v = refCache.video;
      return v ? { playing: !v.paused && !v.ended, pos: v.currentTime, dur: v.duration || 0 } : { playing: false, pos: 0, dur: 0 };
    }
    if (!refCache.play || !refCache.play.isConnected || now - refCache.t > 2000) {
      refCache.t = now;
      refCache.pos = q('[data-testid="playback-position"]');
      refCache.dur = q('[data-testid="playback-duration"]');
      refCache.play = q('[data-testid="control-button-playpause"]');
      refCache.bar = q('[data-testid="playback-progressbar"]');
    }
    const ms = navigator.mediaSession && navigator.mediaSession.playbackState;
    const playing = ms ? ms === 'playing' : !!refCache.play && refCache.play.getAttribute('aria-label') === 'Pause';
    return { playing, pos: parseT(refCache.pos && refCache.pos.textContent), dur: parseT(refCache.dur && refCache.dur.textContent) };
  }

  let analyser = null, data = null, lastTry = 0, zero = 0, useSim = IS_SPOTIFY, simT = 0;
  function ensureAnalyser() {
    if (useSim || analyser || Date.now() - lastTry < 1500) return;
    lastTry = Date.now();
    const v = refCache.video || q('video');
    if (!v) return;
    try {
      const s = (v.captureStream || v.mozCaptureStream).call(v);
      const tr = s.getAudioTracks();
      if (!tr.length) return;
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(new MediaStream([tr[0]]));
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { analyser = null; useSim = true; }
  }
  function realLevels() {
    analyser.getByteFrequencyData(data);
    const out = [];
    for (let i = 0; i < BANDS; i++) {
      const a = Math.floor(Math.pow(i / BANDS, 1.6) * 100) + 1;
      const b = Math.floor(Math.pow((i + 1) / BANDS, 1.6) * 100) + 2;
      let s = 0, n = 0;
      for (let k = a; k < Math.min(b, data.length); k++) { s += data[k]; n++; }
      out.push(Math.min(1, Math.pow(n ? s / n / 255 : 0, 0.8) * 1.3));
    }
    return out;
  }
  function simLevels(playing) {
    simT += 0.07;
    const beat = (Math.sin(simT * 3.1) + 1) / 2, out = [];
    for (let i = 0; i < BANDS; i++) {
      const v = 0.35 + 0.3 * Math.sin(simT * 1.7 + i * 0.55) + 0.2 * Math.sin(simT * 2.9 + i * 1.3) + 0.25 * beat * (1 - i / 30);
      out.push(playing ? clamp(v * (1.1 - i / 60), 0.05, 1) : 0.03);
    }
    return out;
  }
  function maybeCapture(playing) {
    if (!IS_SOURCE) return;
    if (playing && !capOn && Date.now() > capRetry) {
      capRetry = Date.now() + 8000;
      try { chrome.runtime.sendMessage({ type: 'cap', on: true }, (r) => { capOn = !!(r && r.ok); }); } catch (e) {}
    } else if (!playing && capOn) {
      capOn = false;
      try { chrome.runtime.sendMessage({ type: 'cap', on: false }); } catch (e) {}
    }
  }
  async function checkTrack() {
    const m = readMeta();
    const key = m.title + '|' + m.artist + '|' + m.art;
    if (!m.title || key === refCache.key) return;
    refCache.key = key;
    let img = null;
    if (m.art) { try { const r = await chrome.runtime.sendMessage({ type: 'img', url: m.art }); img = r && r.data; } catch (e) {} }
    const hsl = img ? await dominant(img) : { h: 140, s: 0.8, l: 0.68 };
    curTrack = { type: 'track', title: m.title, artist: m.artist, art: img, hsl, color: hslStr(hsl.h, hsl.s, hsl.l) };
    send(curTrack);
  }
  function dominant(url) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const wt = ((mx - mn) / 255) * (0.3 + mx / 255) + 0.02;
          r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
        }
        res(toHsl(r / w, g / w, b / w));
      };
      im.onerror = () => res({ h: 140, s: 0.8, l: 0.68 });
      im.src = url;
    });
  }
  function toHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0, s = 0, l = (mx + mn) / 2;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    if (s > 0.12) s = Math.min(1, Math.max(s, 0.6));
    l = clamp(l, 0.6, 0.74);
    return { h: h || 0, s, l };
  }

  function sourceLoop() {
    if (!ok() || !srcLoop) return;
    const now = performance.now();
    const s = readState();
    srcPlaying = s.playing;
    if (now - lastTrackCheck > 1000) { lastTrackCheck = now; checkTrack(); }
    ensureAnalyser();
    maybeCapture(s.playing && (IS_SPOTIFY || useSim));
    let lv;
    if (analyser && !useSim) {
      lv = realLevels();
      if (s.playing) { zero = lv.reduce((a, b) => a + b, 0) < 0.02 ? zero + 1 : 0; if (zero > 60) useSim = true; }
    } else lv = simLevels(s.playing);
    send({ type: 'tick', playing: s.playing, pos: s.pos, dur: s.dur, levels: lv.map((v) => +v.toFixed(2)) });
    if (s.playing) { srcIdle = 0; setTimeout(sourceLoop, TICK_MS); }
    else if (++srcIdle > 8) { srcLoop = false; maybeDropPort(); }        // paused/stopped: stop polling → ~0 CPU
    else setTimeout(sourceLoop, 500);
  }
  function startSource() { if (srcLoop) return; srcLoop = true; srcIdle = 0; sourceLoop(); }

  /* ───────── control commands for the music tab ───────── */
  function spotifySeekTo(target) {
    const dur = parseT(refCache.dur && refCache.dur.textContent);
    const barEl = refCache.bar || q('[data-testid="playback-progressbar"]');
    if (!dur || !barEl) return;
    const frac = clamp(target / dur, 0, 1);
    const input = barEl.querySelector('input[type=range]');
    if (input) {
      const max = parseFloat(input.max) || dur;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(frac * max));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const r = (barEl.querySelector('[data-testid="progress-bar"]') || barEl).getBoundingClientRect();
    const x = r.left + r.width * frac, y = r.top + r.height / 2;
    const e = document.elementFromPoint(x, y) || barEl;
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const C = t.startsWith('pointer') ? PointerEvent : MouseEvent;
      e.dispatchEvent(new C(t, { bubbles: true, clientX: x, clientY: y, button: 0, view: window }));
    }
  }
  function spotifySeek(delta) { spotifySeekTo(parseT(refCache.pos && refCache.pos.textContent) + delta); }
  function spotifyVol(delta) {
    const barEl = q('[data-testid="volume-bar"]');
    const input = barEl && barEl.querySelector('input[type=range]');
    if (input) {
      const max = parseFloat(input.max) || 1, min = parseFloat(input.min) || 0;
      let cur = parseFloat(input.value); if (isNaN(cur)) cur = (min + max) / 2;
      const next = clamp(cur + delta * max, min, max);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      srcVol = max ? (next - min) / (max - min) : 0;
      toast('Volume ' + Math.round(srcVol * 100) + '%');
      return;
    }
    const au = q('audio') || q('video');
    if (au) { au.volume = clamp(au.volume + delta, 0, 1); toast('Volume ' + Math.round(au.volume * 100) + '%'); }
  }
  function doCmd(a, p) {
    if (IS_YTM) {
      const v = refCache.video && refCache.video.isConnected ? refCache.video : q('video');
      if (!v) return;
      if (a === 'play') {
        const willPlay = !srcPlaying;
        const b = q('ytmusic-player-bar #play-pause-button');
        if (b) b.click(); else (v.paused ? v.play() : v.pause());
        toast(willPlay ? 'Playing' : 'Paused');
      } else if (a === 'fwd' || a === 'back') v.currentTime = clamp(v.currentTime + (a === 'fwd' ? 5 : -5), 0, v.duration || 1e9);
      else if (a === 'seek' && typeof p === 'number') v.currentTime = clamp(p, 0, v.duration || 1e9);
      else if (a === 'vol+' || a === 'vol-') {
        v.volume = clamp(Math.round((v.volume + (a === 'vol+' ? 0.05 : -0.05)) * 100) / 100, 0, 1);
        if (a === 'vol+' && v.muted) v.muted = false;
        toast('Volume ' + Math.round(v.volume * 100) + '%');
      }
    } else if (IS_SPOTIFY) {
      if (a === 'play') {
        const willPlay = !srcPlaying;
        const b = refCache.play || q('[data-testid="control-button-playpause"]');
        if (b) b.click();
        toast(willPlay ? 'Playing' : 'Paused');
      } else if (a === 'fwd' || a === 'back') spotifySeek(a === 'fwd' ? 5 : -5);
      else if (a === 'seek' && typeof p === 'number') spotifySeekTo(p);
      else if (a === 'vol+' || a === 'vol-') spotifyVol(a === 'vol+' ? 0.05 : -0.05);
    }
  }

  /* ───────── auto ad-skip (YouTube + YouTube Music) ───────── */
  function startAdSkip() {
    if (!(IS_YT || IS_YTM)) return;
    let muted = false;
    const skipSel = '.ytp-ad-skip-button-modern,.ytp-ad-skip-button,.ytp-skip-ad-button,.ytp-ad-skip-button-slot button,.ytmusic-player-bar .ytp-ad-skip-button,button[class*="skip-ad"]';
    const tickAd = () => {
      if (!ok()) return;
      try {
        const ad = q('.ad-showing') || q('.ytp-ad-player-overlay') || q('ytmusic-player-bar .ad-showing');
        if (ad) {
          const v = refCache.video && refCache.video.isConnected ? refCache.video : q('video');
          const skip = q(skipSel);
          if (skip) { skip.click(); if (v && muted) { v.muted = false; muted = false; } }
          else if (v) {
            if (!v.muted) { v.muted = true; muted = true; }
            if (isFinite(v.duration) && v.duration > 0) { try { v.currentTime = v.duration; } catch (e) {} }
          }
        } else if (muted) { const v = q('video'); if (v) { v.muted = false; } muted = false; }
      } catch (e) {}
      adTimer = setTimeout(tickAd, LITE ? 1200 : 900);
    };
    tickAd();
  }

  /* ───────── teardown ───────── */
  function destroy() {
    alive = false;
    st.armed = false;
    running = false;
    srcLoop = false;
    try { window.removeEventListener('keydown', onGlobalKey, true); } catch (e) {}
    try { document.removeEventListener('pointerdown', onDocPointer, true); } catch (e) {}
    try { if (toastT) clearTimeout(toastT); } catch (e) {}
    try { if (dropT) clearTimeout(dropT); } catch (e) {}
    try { if (watchT) clearTimeout(watchT); } catch (e) {}
    try { if (adTimer) clearTimeout(adTimer); } catch (e) {}
    try { if (cancelCrop) cancelCrop(); } catch (e) {}
    try { if (mediaPlayFn) { document.removeEventListener('play', mediaPlayFn, true); document.removeEventListener('playing', mediaPlayFn, true); } } catch (e) {}
    // Put any moved-DOM mini window back where it came from, and close windows we opened —
    // without this the page could be left looking broken after the extension reloads.
    try { if (activeRestore) activeRestore(); } catch (e) {}
    activeRestore = null;
    try { if (activePip && !activePip.closed) activePip.close(); } catch (e) {}
    activePip = null;
    try { if (port) port.disconnect(); } catch (e) {}
    port = null;
    try { chrome.runtime.sendMessage({ type: 'cap', on: false }); } catch (e) {}
    try { freeAllow(); } catch (e) {}
    try { if (el.panel) el.panel.style.display = 'none'; } catch (e) {}
    try { if (el.pbody) el.pbody.textContent = ''; } catch (e) {}
    try { hostEl.remove(); } catch (e) {}
  }

  /* ───────── boot (cheap) ───────── */
  chrome.storage.local.get(['fl_x', 'fl_y', 'fl_scale', 'fl_bg', 'fl_mode', 'fl_on', 'fl_bx', 'fl_by', 'fl_lx', 'fl_ly'], (v) => {
    if (!ok()) return;
    if (v.fl_x != null) { st.x = v.fl_x; st.y = v.fl_y; }
    if (v.fl_bx != null) { st.bx = v.fl_bx; st.by = v.fl_by; }
    if (v.fl_scale) st.scale = v.fl_scale;
    if (v.fl_bg) st.bg = v.fl_bg;
    if (v.fl_mode) st.mode = v.fl_mode;
    if (v.fl_lx != null) {
      launcher.classList.add('show', 'moved');
      setCss(launcher, { left: v.fl_lx + 'px', top: v.fl_ly + 'px', right: 'auto' });
    }
    if (uiBuilt) { applyBg(); refresh(); }
    // Follow the user: if the disc/bar were left on, bring them back on this page too.
    if (v.fl_on) setMusicVisible(true, v.fl_mode || 'disc', true);
  });
  chrome.storage.onChanged.addListener((c) => {
    if (!ok()) return;
    if (c.fl_x) st.x = c.fl_x.newValue;
    if (c.fl_y) st.y = c.fl_y.newValue;
    if (c.fl_bx) st.bx = c.fl_bx.newValue;
    if (c.fl_by) st.by = c.fl_by.newValue;
    if (c.fl_scale) st.scale = c.fl_scale.newValue;
    if (c.fl_bg) { st.bg = c.fl_bg.newValue; if (uiBuilt) applyBg(); }
    if (c.fl_mode) st.mode = c.fl_mode.newValue;
    // Show/hide on every page the instant it is toggled in any single tab.
    if (c.fl_on && (!!c.fl_on.newValue) !== st.armed) {
      st.armed = !!c.fl_on.newValue;
      if (st.armed) { ensureUI(); ensurePort(); }
      refresh();
      if (!st.armed) maybeDropPort();
    }
    if (uiBuilt && st.armed) refresh();
  });
  window.addEventListener('resize', () => { if (ok() && uiBuilt && st.armed) { place(); placeBar(); } });
  window.addEventListener('pagehide', () => { if (capOn) { try { chrome.runtime.sendMessage({ type: 'cap', on: false }); } catch (e) {} } });

  if (IS_SOURCE) {
    // Only music tabs poll, and only while something is actually playing.
    mediaPlayFn = (ev) => { const t = ev.target; if (t && (t.tagName === 'VIDEO' || t.tagName === 'AUDIO')) { ensurePort(); startSource(); } };
    document.addEventListener('play', mediaPlayFn, true);
    document.addEventListener('playing', mediaPlayFn, true);
    setTimeout(() => { if (ok()) { ensurePort(); startSource(); } }, 0);
  }

  console.log('[Floaty] ready on', location.href, LITE ? '(lite mode)' : '');
  window.__floaty = { version: VERSION, destroy };
})();
