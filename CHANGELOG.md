# Changelog

All notable changes to this project are documented in this file.

## [1.3.3] — 2026-10-18

- **The background picker can be clicked now.** It no longer shuts the instant the mouse leaves the palette button en route to the three looks — it waits, so they don't vanish before you can pick one.
- **Clicking the palette icon no longer fights with hovering it** — the click keeps the options open instead of snapping them shut.
- It still closes by itself when you move away or tap elsewhere, flips below the bar near the top of the screen, and paints both the bar and the disc. Nothing else changed.

## [1.3.2] — 2026-10-18

- **Music bar is shorter and cleaner:** background looks moved behind a small **palette button** so the row stopped being so long.
- **More room for the seek bar:** bar ~10% shorter, yet the seek bar itself grew wider.
- **Smarter picker:** opens above, flips below when the bar sits near the top of the screen, and stays open while you try all three looks.

## [1.3.1] — 2026-10-17

- **Follow-across-tabs:** the disc and bar now return automatically on every new page/tab and keep their look until you close with ×.
- **Hot-swap / no manual refresh:** reloading the extension at `chrome://extensions` tears down old instances and replaces them in open tabs with no leftover, duplicated or frozen player.
- **Self-cleanup:** closing with × turns it off everywhere; a glitchy state can no longer linger after reloads.
- **Reconnect & resilience:** survives the browser parking the extension, reconnects on wake, and tidies up if the extension is removed.
- **Instant fill-in:** new tabs show the current song, progress and waves straight away.

## [1.3.0] — 2026-10-17

- **Lazy UI (big win for low-end PCs):** builds the window/waves/music UI only when actually used. Idle tabs cost next to nothing.
- **Automatic lite mode:** fewer wave bars, smaller draws and lighter timers on machines with low memory/cores.
- **Idle-stop rAF:** stops animation when nothing is changing; wakes back up instantly.
- **Less memory churn:** fewer DOM re-creations and tighter caching.
- **No behaviour loss:** all existing features remain, just much lighter.

## [1.2.0] — 2026-10-16

- **Waves follow the real audio:** offscreen analyser for Spotify / YouTube Music; sim-wave fallback keeps it smooth.
- **Auto ad-skip:** YouTube & YouTube Music ad-skipping improved.
- **Picker never drags the bar:** hover/tap palette button; picker doesn't start a bar drag.
- **Background looks cover disc and bar:** dark/white/transparent apply to disc and bar; bar's picker stays reachable.
- **Cleaner bar:** shorter geometry, roomier seek bar.
- **Stability:** improved lifecycle, fewer edge cases.

## [1.1.0] — 2026-10-14

- **Music bar UI:** a compact, draggable music bar alternative to the disc.
- **Alt+3 / Alt+4:** toggle disc/bar from anywhere.
- **Palette for bg looks:** sun/cloud/moon toggles (white/transparent/dark).
- **YouTube volume/keys:** Alt+P/V/B behave sensibly on video mini player.
- **Draggable launcher:** right-edge launcher can be moved.
- **Permission-on-install / post-install single button** flow refined.

## [1.0.0] — 2026-10-12

- **Mini window for any page** (scroll/copy/click), with fallback panel.
- **Crop any region** (Alt+2).
- **YouTube video-only mini player** (Alt+1 on YouTube).
- **Disc for Spotify / YouTube Music**, colour from thumbnail, draggable, wheel-resize.
- **Follows across pages/tabs** once on (stays on until closed).
- **Shortcuts:** Alt+1/2/3/4, Alt+P, Alt+V, Alt+B.
- **Auto ad-skip** where applicable.
- **Lightweight, Manifest V3.**
