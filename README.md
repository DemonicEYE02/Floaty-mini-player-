<div align="center">

# 🎈 Floaty Mini Player

**Turn any web page into a movable mini window, crop just the part you need, and keep a transparent music disc — or a compact music bar — floating over your browsing.**

A lightweight Manifest V3 extension for **Google Chrome** and **Microsoft Edge**.

![version](https://img.shields.io/badge/version-1.3.0-2f6df6?style=flat-square)
![platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-1ed760?style=flat-square)
![manifest](https://img.shields.io/badge/manifest-v3-ff8a3d?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![size](https://img.shields.io/badge/size-%7E79%20KB-8a8a99?style=flat-square)

</div>

---

## ✨ What is Floaty?

Floaty is a small, fast browser extension that gives you three things no built-in browser feature does well:

1. **A mini window for *any* page** — pop a page into an always-on-top window you can scroll, click, copy and navigate, or **crop** just one section (a chat panel, a table, a paragraph, a PDF region) into its own little window.
2. **A music disc & music bar** for **Spotify Web** and **YouTube Music** — a draggable, thumbnail-coloured disc (or a slim horizontal bar) with playback controls, a seek bar and a visualiser who waves follow the **real audio**.
3. **Hands-off quality-of-life** — video-only mini player on YouTube, **automatic ad-skipping**, and one-button setup with no permission hunting.

It is designed to be **extremely light**: the interface is only created in a tab **when you actually use it**, so idle tabs cost almost nothing. On low-end machines it automatically switches to a **lite mode** (fewer visualiser bars, smaller drawing surface, no glow) — same features, less CPU.

---

## 📸 Highlights

| | |
|---|---|
| **Mini window** | Always-on-top, draggable, resizable, fully interactive. Links open in a normal tab. |
| **Crop** | Drag a box over any part of a page → only that part becomes the mini window. |
| **Music disc** | Spinning thumbnail, colour-matched wave ring, −5s / play / +5s, progress + seek, drag & wheel-resize. |
| **Music bar** | Slim horizontal player: thumbnail, title/artist, wave, progress + seek, controls, background toggles. |
| **Real audio waves** | YouTube Music is analysed directly; Spotify's tab audio is captured in the background for the visualiser only (sound keeps playing). |
| **Auto ad-skip** | YouTube & YouTube Music ads are skipped, or muted-and-run-past, automatically. |
| **Backgrounds** | 🌙 Dark · ☁ Transparent · ☀ White — applied to the disc *and* the bar. |
| **Lightweight** | Lazy UI, lite mode on low-end PCs, drawing stops when paused. |

---

## 🚀 Install

> Requires **Chrome or Edge 116+** (Manifest V3, Document Picture-in-Picture).

### Option A — Load the source (recommended)

1. Download this repository (or just **`files.zip`** above) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the **`floaty-mini`** folder.
4. That's it — a one-time welcome page opens with a single **Allow everything** button. Permissions are granted automatically at install; you never hand-pick anything.

*Already installed?* Open `chrome://extensions`, click **Reload** on Floaty, then click the toolbar icon once on any tab you already had open (or refresh the page).

### Option B — From `files.zip`

`files.zip` mirrors the previous release layout:

```
files.zip
├─ floaty-mini.zip          ← unzip this, then "Load unpacked" the floaty-mini folder
├─ Floaty-Mini-Player-Guide.md
├─ Floaty-Mini-Player-Guide.html   ← printable (Print / Save as PDF)
└─ README.md
```

---

## ⌨️ Shortcuts

| Keys | Action |
|:--:|---|
| **Alt + 1** | **Mini** — any page opens in a small always-on-top window. On **YouTube**: pops out **only the video**. On **Spotify / YT Music**: shows the disc. |
| **Alt + 2** | **Crop** — drag a box over any part of the page. Only that part becomes the mini window. |
| **Alt + 3** | Show / hide the music **disc**. |
| **Alt + 4** | Show / hide the music **bar**. |
| **Alt + P** | Pause / resume the music — *or the YouTube video mini player*. |
| **Alt + V** | Volume up (5% steps). |
| **Alt + B** | Volume down (5% steps). |

**1 = Mini · 2 = Crop · 3 = Disc · 4 = Bar** — the same order as the buttons, easy to remember.

No keyboard? **Hover the right edge** of any page for the **Mini / Crop / Disc / Bar** buttons, or click the extension icon in the toolbar. The launcher itself can be **dragged** anywhere.

---

## 📖 Full guide

A complete, friendly walkthrough lives in [`docs/`](docs):

- [`Floaty-Mini-Player-Guide.md`](docs/Floaty-Mini-Player-Guide.md) — Markdown
- [`Floaty-Mini-Player-Guide.html`](docs/Floaty-Mini-Player-Guide.html) — standalone, with a **Print / Save as PDF** button

---

## 🔐 Permissions — and why each one is needed

Floaty asks for exactly what it uses. Nothing is sent to any server; there is no analytics, no tracking, no account.

| Permission | Why |
|---|---|
| `storage` | Remembers where you dragged the disc / bar / launcher and your background choice. |
| `scripting` | Attaches Floaty to tabs that were already open (so you don't have to refresh). |
| `declarativeNetRequestWithHostAccess` | Lets the mini window embed sites that normally block embedding (via `X-Frame-Options` / CSP). The rule is added only while a mini window is open and removed the moment it closes. |
| `tabCapture` | Captures a music tab's audio **for the visualiser only** (Spotify, etc.). Sound keeps playing normally; the capture is released the moment you pause or hide the player. |
| `offscreen` | Runs the small audio analyser that turns captured audio into wave levels. |
| `host_permissions: <all_urls>` | Necessary so the mini window and crop can work on any site you choose. Nothing is read or transmitted. |

---

## 🏗️ How it works

- **Mini window / crop** — prefers the browser's **Document Picture-in-Picture** API to create a real always-on-top window holding an `<iframe>` of the page (or a cropped, negatively-offset view of it). If that isn't available, it falls back to a live in-page panel, then to a move-the-DOM copy — so you always get a mini view.
- **YouTube** — never rearranged. Alt+1 / Alt+2 use the browser's **native video Picture-in-Picture**, so YouTube can't be slowed down.
- **Music** — a tiny content-script "source" on the Spotify / YouTube Music tab reports the current track, colour (extracted from the artwork) and playback state over a long-lived message port; any other tab can render the disc/bar. Control commands are relayed back to the source tab.
- **Visualiser** — YouTube Music is analysed directly with the Web Audio API. Spotify's protected audio is captured via `tabCapture` → an offscreen document → an `AnalyserNode`, and routed back to the speakers so **you never lose sound**.
- **Lightweight by design** — the shadow-DOM UI, canvases, timers and message port are created **lazily**, only when you first use Floaty in a tab. Idle tabs keep just a tiny launcher.

---

## 📁 Repository layout

```
.
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
├─ files.zip                     ← ready-to-share bundle (source zip + guides)
├─ docs/
│  ├─ Floaty-Mini-Player-Guide.md
│  └─ Floaty-Mini-Player-Guide.html
└─ floaty-mini/                  ← the extension (Load unpacked this folder)
   ├─ manifest.json
   ├─ background.js
   ├─ content.js
   ├─ offscreen.html
   ├─ offscreen.js
   ├─ onboard.html
   └─ onboard.js
```

---

## 🧾 Changelog

See [CHANGELOG.md](CHANGELOG.md). Latest:

**1.3.0**
- ⚡ **Much lighter** — UI/canvases/timers/port are now created lazily, only when used in a tab.
- 🪶 **Automatic lite mode** on low-end machines.
- 🛑 **YouTube pause fixed** — pop-out gains a play/pause button; **Alt + P** now pauses/resumes the video.
- 🌊 Visualiser stops drawing when paused; gentler staggered startup injection.

**1.2.0** — music bar (Alt+4), progress/seek, real-audio waves, auto ad-skip, draggable launcher, Alt+P/V/B.

---

## 🩹 Troubleshooting

- **Shortcuts do nothing?** Click the extension icon once on the tab (or refresh). Floaty attaches to already-open tabs too.
- **Updated but it looks the same?** Chrome keeps old script copies in open tabs — click the toolbar icon once, or refresh.
- **Music UI missing?** Make sure Spotify / YouTube Music is **playing**, then press **Alt + 3** (disc) or **Alt + 4** (bar). It's hidden by default on purpose.
- **Wave not moving?** On Spotify the browser must allow tab-audio sharing; if blocked, Floaty falls back to a gentle animation.
- **Red badge on the icon?** The page blocks extensions (`chrome://`, `edge://`, the Web Store, the built-in PDF viewer). Use a normal website.
- **Nothing floats above other apps?** Browsers can't draw over other applications — the disc, bar and windows stay inside Chrome / Edge.

---

## 📄 License

Released under the [MIT License](LICENSE).

<div align="center"><sub>Built for multitasking, productivity and distraction-free browsing.</sub></div>
