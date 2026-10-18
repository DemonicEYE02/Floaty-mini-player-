![version](https://img.shields.io/badge/version-1.3.3-2f6df6?style=flat-square)
![manifest](https://img.shields.io/badge/Manifest%20V3-green?style=flat-square)
![chrome](https://img.shields.io/badge/Chrome-%3E%3D116-4285f4?style=flat-square)
![edge](https://img.shields.io/badge/Edge-%3E%3D116-0078d4?style=flat-square)
![lightweight](https://img.shields.io/badge/lightweight-yes-success?style=flat-square)
![size](https://img.shields.io/badge/download-84%20KB-informational?style=flat-square)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square)

# Floaty Mini Player

Pop any web page into a small floating window, crop just the region you need, or keep a transparent
music disc — or a compact music bar — on screen for Spotify / YouTube Music. It also pops out
**video-only** for YouTube, follows you between tabs, auto-skips ads, and reacts to the real audio
for its wave bars. Lightweight by design for low-end PCs.

## What's included

- `floaty-mini/` — the ready-to-load unpacked extension (Manifest V3)
- `Floaty-Mini-Player-Guide.md` — full, human-readable guide
- `Floaty-Mini-Player-Guide.html` — same guide, print-friendly / easy to open
- `files.zip` — ZIP that mirrors the exact repo layout (`floaty-mini/`, the two guides, `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/`)

## Quick start

1. **Unzip** `files.zip` (or just grab `floaty-mini/`) to a folder you will keep.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select that `floaty-mini` folder — done.
4. On first install a single "Allow everything" page may show up (just confirm) and you're ready.

Already had it? **Reload** the extension at `chrome://extensions` — open tabs swap over by themselves.

## Key features

- **Any-page mini window** — scroll, select, click, copy. Works for Facebook, Instagram, PDFs and most sites.
- **Crop mode** — Alt+2 to draw a box and only that bit floats.
- **YouTube video-only** — Alt+1 pops out just the video (no page chrome). Pause with Alt+P.
- **Music disc & music bar** — for Spotify and YouTube Music. Coloured from the album art, draggable, wheel-resizes.
- **Follows you across tabs** — once the music player is on, it stays on the look you chose until you close it with ×.
- **Background looks moved to a palette button** — the music bar stays shorter; hover/tap the small palette icon to switch dark/white/transparent (applies to bar and disc).
- **Real-audio waves** — the wave bars react to the actual playing audio (falls back gracefully if unavailable).
- **Auto ad-skip** — on YouTube and YouTube Music where possible.
- **Shortcuts** — Alt+1/2/3/4, Alt+P, Alt+V, Alt+B.
- **Lightweight** — lazy UI, lite mode for low-end machines, minimal redraws, small footprint.

## Download

- **Source (this repo):** grab `floaty-mini.zip` or `files.zip` from the latest release / repo root.
- **Guide:** see `Floaty-Mini-Player-Guide.md` or `Floaty-Mini-Player-Guide.html`.

## Changelog

**1.3.3**

- **The background picker can be clicked now.** It no longer shuts the instant the mouse leaves the palette button en route to the three looks — it waits, so they don't vanish before you can pick one.
- **Clicking the palette icon no longer fights with hovering it** — the click keeps the options open instead of snapping them shut.
- It still closes by itself when you move away or tap elsewhere, flips below the bar near the top of the screen, and paints both the bar and the disc. Nothing else changed.

**1.3.2**

- 🪄 Music bar is shorter and cleaner: background looks moved behind a small **palette button**; the row stopped being so long.
- 📏 More room for the seek bar (bar ~10% shorter, yet the seek bar itself grew wider).
- ↕️ Picker flips above/below intelligently; stays open while you try all three looks.

**1.3.1**

- 🧷 Disc and bar now follow you across pages/tabs until you close with × — no re-opening per site.
- 🔄 Hot-swap on reload: open tabs swap to the new version automatically; no stuck/frozen UI.
- 🧼 Self-cleanup, reconnect on wake, tidies up if the extension disappears.
- ⚡ New tabs show song/progress/waves instantly.
