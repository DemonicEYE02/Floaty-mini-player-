# Changelog

All notable changes to **Floaty Mini Player** are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [1.3.0] — 2026-10-17

### ⚡ Performance & memory
- **Lazy UI construction.** Only a tiny launcher and toast are created when a page loads.
  The heavy interface (crop overlay, panel, music disc, music bar) is built the **first time
  you use Floaty in a tab**, and only in that tab. Idle tabs no longer carry a hidden canvas
  or their own copy of the full UI — a large drop in per-tab memory.
- **Automatic lite mode** on low-end machines (`deviceMemory ≤ 4 GB` or `≤ 4` CPU threads):
  fewer visualiser bars, 1× drawing surface (no HiDPI upscaling), no glow, and a gentler
  update rate — identical features, lower CPU.
- **Drawing stops when paused.** The animation loop now halts once the visualiser has fully
  settled and resumes on demand.
- **Idle message port.** The connection to the background service worker is opened only when
  it's actually needed and closed after a short idle period, shrinking background overhead.
- **Staggered startup.** Auto-injection into already-open tabs is spread out so a browser full
  of tabs no longer spikes at once.

### ✨ Fixes
- **YouTube pause works from the mini player.** The pop-out window now shows a **play/pause**
  button, and **Alt + P** pauses/resumes the YouTube video even when no music source is active.
  The in-page panel gained the same control, and the disc/bar play button falls back to the
  page video when no music tab is playing.
- **Alt + V / Alt + B** now adjust the page video's volume when YouTube is the focus.
- Visualiser bars and the seek bar are correctly measured (no more zero-width collapse).
- The music disc/bar now shows the current track even if it was already known before the UI
  was first built.

---

## [1.2.0] — 2026-10-16

### ✨ Added
- **Compact music bar (Alt + 4)** — a slim horizontal alternative to the disc with thumbnail,
  title/artist, visualiser, progress + seek and playback controls.
- **Progress and seek bar** on the music disc, with drag-to-seek.
- **Real-audio visualiser** — YouTube Music is analysed directly; Spotify's tab audio is
  captured (visualiser only, sound preserved) so the waves follow the music.
- **Automatic ad skipping** on YouTube and YouTube Music.
- **Background toggles** — dark, white and transparent, applied to both the disc and the bar.
- **Draggable launcher** and a unified press → move → release drag on all floating surfaces.
- **Alt + P / Alt + V / Alt + B** — pause, volume up, volume down.

---

## [1.1.0] — 2026-10-14

### ✨ Added
- **Crop mode (Alt + 2)** — drag a box over any page region and turn just that region into an
  interactive mini window.
- **YouTube video-only mini player (Alt + 1)** — pops out only the video using the browser's
  native Picture-in-Picture, so YouTube is never re-laid-out or slowed down.

---

## [1.0.0] — 2026-10-12

### 🎉 Initial release
- **Mini window (Alt + 1)** — pop any page into a movable, interactive always-on-top window.
- **Music disc (Alt + 3)** — a transparent, draggable, thumbnail-coloured disc for
  Spotify Web and YouTube Music, with previous / play / next and wheel-to-resize.
- Right-edge launcher with Mini / Crop / Disc / Bar buttons.
- One-button setup page and automatic permission handling.
