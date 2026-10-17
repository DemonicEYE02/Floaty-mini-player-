// Floaty offscreen audio analyser.
//
// Spotify audio is DRM-protected, so an in-page `captureStream()` yields silence. To make the
// wave actually follow the music (and the voice), we capture the whole tab's output here and
// analyse it. Crucially the captured audio is ALSO routed back to the speakers, otherwise
// capturing a tab would mute it.

let ctx = null;
let srcNode = null;
let analyser = null;
let data = null;
let stream = null;
let timer = null;
const BANDS = 24;

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === 'cap-start') { start(m.streamId); reply({ ok: true }); return true; }
  if (m.type === 'cap-stop') { stop(); reply({ ok: true }); return true; }
});

async function start(streamId) {
  stop();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false
    });
    ctx = new AudioContext();
    srcNode = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    srcNode.connect(analyser);
    // Keep the tab audible (capturing a tab removes it from the normal output).
    srcNode.connect(ctx.destination);
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    if (ctx.state !== 'running') { stop(); report(false); return; }
    data = new Uint8Array(analyser.frequencyBinCount);
    timer = setInterval(emit, 66);
    report(true);
  } catch (e) {
    stop();
    report(false);
  }
}

function emit() {
  if (!analyser || !data) return;
  try {
    analyser.getByteFrequencyData(data);
    const out = [];
    for (let i = 0; i < BANDS; i++) {
      const a = Math.floor(Math.pow(i / BANDS, 1.6) * 100) + 1;
      const b = Math.floor(Math.pow((i + 1) / BANDS, 1.6) * 100) + 2;
      let s = 0, n = 0;
      for (let k = a; k < Math.min(b, data.length); k++) { s += data[k]; n++; }
      out.push(+Math.min(1, Math.pow(n ? s / n / 255 : 0, 0.8) * 1.35).toFixed(2));
    }
    chrome.runtime.sendMessage({ type: 'levels', levels: out });
  } catch (e) {}
}

function report(ok) { try { chrome.runtime.sendMessage({ type: 'cap-result', ok }); } catch (e) {} }

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  stream = null;
  try { if (ctx) ctx.close(); } catch (e) {}
  ctx = null; srcNode = null; analyser = null; data = null;
}
