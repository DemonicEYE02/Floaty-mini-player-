# Floaty Mini Player — quick guide

Pop any page into a small floating window, crop just the part you need, and keep a
transparent music disc — or a compact music bar — on screen while you browse. Works in **Chrome and Edge 116 or newer**.

Version **1.3.0**

---

## 1. Install (one minute)

1. Unzip `floaty-mini.zip` to a folder you will keep.
2. Open `chrome://extensions` (or `edge://extensions`) and switch on **Developer mode**.
3. Click **Load unpacked** and choose the `floaty-mini` folder. Done.

On first install a small **welcome page** opens with a single **Allow everything** button.
Everything is granted automatically at install, so the button usually just confirms with
*“All set”*. You never have to hand-pick permissions in the extension settings.

Already had it installed? Open `chrome://extensions` and click **Reload** on Floaty, then
refresh any tabs you already had open.

---

## 2. Shortcuts

| Keys (left hand) | What happens |
|---|---|
| **Alt + 1** | Any website: opens the page in a small always-on-top window.<br>YouTube: pops out **only the video**.<br>Spotify / YouTube Music: shows the music disc. |
| **Alt + 2** | **Crop**: drag a box over any part of the page. Only that part becomes the mini window. |
| **Alt + 3** | Show / hide the music **disc** from any tab. |
| **Alt + 4** | Show / hide the compact music **bar** from any tab. |
| **Alt + P** | Pause / unpause the music. On a YouTube page it pauses / resumes the **video mini player**, too. |
| **Alt + V** | Volume up (5% steps). |
| **Alt + B** | Volume down (5% steps). |

Easy to remember: **1 = Mini, 2 = Crop, 3 = Disc, 4 = Bar**, the same order as the buttons.
Hold Alt with your thumb and tap the key.

No keyboard? Hover the **right edge** of any page for the **Mini / Crop / Disc / Bar** buttons, or
click the extension icon in the toolbar to reveal them. The launcher can also be **dragged**
anywhere with press-and-hold.

---

## 3. Mini window for any page

- The window floats **always-on-top** and keeps the page fully **interactive** — scroll,
  select, copy, and click inside it. **Links open in a normal tab.**
- **Drag it** by its title bar anywhere on your screen, even outside the browser, and resize
  it freely.
- Works for **Facebook, Instagram, PDFs, and text-only / solution sites**. Sites that normally
  forbid being embedded (those that send *X-Frame-Options* or *Content-Security-Policy*) are
  handled automatically — Floaty lifts that restriction for the mini window only, and puts it
  back the moment you close the window.
- The page itself is left **untouched** (the window shows its own copy), so **nothing crashes**
  or lags, even on heavy sites.
- If a browser refuses to open the always-on-top window, Floaty falls back to an **in-page
  panel** with the same content, so you always get a mini view.

### Crop

- Press **Alt + 2**, then **drag a box** over the part you want (a chat panel, a paragraph, a
  table, a feed). Release and it opens.
- Press **Enter** to open the current selection, or **Esc** to cancel.
- If the always-on-top window can’t open instantly (the browser only allows it right after a
  click), the crop stays on screen with an **“Open mini player”** button — click it (or press
  **Enter**) and it opens. You never lose your selection.

---

## 4. Music: the disc and the music bar (Spotify and YouTube Music)

Open **Spotify Web** or **YouTube Music** in one tab and press play. The music UI is **available
on every tab**, but it stays hidden until you ask for it:

- Press **Alt + 3** (or the **Disc** button) to show the **disc**.
- Press **Alt + 4** (or the **Bar** button) to show the **music bar**.
- Press the same key again, or the little **×**, to hide it.

The music UI does **not** auto-open on its own.

### The disc

| Part | What it does |
|---|---|
| Spinning disc | Shows the song’s thumbnail and spins while music plays. **Drag it** anywhere on the page. |
| Wave ring | Bars pulse around the disc with the music. Gaps between bars are fully see-through. |
| −5s / Play / +5s | Jump back, pause or resume, jump forward. Controls the music tab even if you are on another tab. |
| Progress bar | Shows how far into the song you are, with the time. **Click or drag** it to seek. |
| Colour | Disc, wave and buttons take the colour of the current thumbnail. Tuned to stay readable on any background. |
| Background buttons | Three looks for the backdrop:<br>🌙 **Dark** &nbsp;·&nbsp; ☁ **Transparent** &nbsp;·&nbsp; ☀ **White** |
| Mouse wheel | Scroll over the disc to make it bigger or smaller. |
| ▤ button | Switches to the music **bar**. |
| × button | Hides it. Press **Alt + 3** to bring it back. |

### The music bar

A slim, horizontal player — handy when you want the controls without covering the page:

- Thumbnail, song title and artist on the left.
- A **progress bar** with the current / total time; **click or drag** it to seek.
- **−5s / Play / +5s** buttons, the same **dark / transparent / white** background buttons,
  a **◉** button to switch back to the disc, and an **×** to hide it.
- Its own little **wave** bars that dance with the music.
- **Drag it** anywhere and use the **mouse wheel** to resize.

Both the disc and the bar share the same colour and the same background choice.

### Real, song-driven waves

The waves move with the **actual music and voices**, not a random animation:

- **YouTube Music** — analysed directly from the audio.
- **Spotify** (and any other protected player) — Floaty captures the tab’s **real audio** in the
  background just for the visualiser (the sound keeps playing normally), then releases it the
  moment you pause or hide the player. If the browser won’t allow the capture, Floaty quietly
  falls back to a gentle animation.

### Auto ad-skip

On **YouTube** and **YouTube Music**, ads are skipped automatically: Floaty clicks the *Skip*
button as soon as it appears, and for un-skippable ads it silently mutes and runs past them, then
restores your sound. Listen without interruption.

---

## 5. YouTube

On a normal YouTube page, **Alt + 1** and **Alt + 2** both pop out **only the video** (the
browser’s native mini player) — never the whole page. Floaty deliberately does **not** rearrange
YouTube’s page, so it can’t crash or lag it.

The popped-out video also gets its own small **play/pause button** in the corner, and you can
always press **Alt + P** on the YouTube tab to pause / resume it. (Alt + V / Alt + B change its
volume too.)

---

## 6. What’s new in 1.3.0

- **Much lighter on your computer.** Floaty now builds its window, waves and music UI **only when
  you actually use them** in a tab. Tabs where you never open Floaty cost almost nothing — no
  canvases, no timers, no background chatter. This is the big one for low-end PCs and many open tabs.
- **Automatic “lite mode”** on low-memory / low-core machines: fewer wave bars, a smaller drawing
  surface and no glow — the same features, just gentler on the CPU.
- **The player stops drawing when it is paused** (no wasted frames when nothing is moving).
- **YouTube pause fixed** — the video mini player now has its own **play/pause** button, and
  **Alt + P** pauses / resumes the popped-out video.
- **Gentler startup** — when the extension updates, it attaches to your open tabs in small steps
  instead of all at once.

## 7. What’s new in 1.2.0

- **New music bar** (**Alt + 4**): a slim horizontal player with thumbnail, title/artist, a
  progress bar, the −5s / play / +5s buttons, background buttons, its own wave, and a close
  button. Drag it anywhere, wheel-resize it.
- **Progress + seek** on both the disc and the bar — click or drag the bar to jump around the song.
- **The waves follow the real music** now, even on Spotify: Floaty captures the tab’s real audio
  (sound keeps playing) so the bars move with the music and voices, not a random animation.
- **Auto ad-skip** on YouTube and YouTube Music — ads are skipped and un-skippable ads are muted
  and run past, then your sound returns.
- **The × close button is fixed and always visible** — it can no longer be covered by the wave.
- **Background buttons on the music bar too** — dark / transparent / white, shared with the disc.
- **Draggable launcher** — move the Mini / Crop / Disc / Bar buttons anywhere.
- **Alt + 4** added alongside Alt + 1 / 2 / 3, and **Alt + P / V / B** (pause, volume up/down).
- **Reloading the extension now updates open tabs instantly** — no more “it looks the same as
  before”; the new version replaces the old one in place.
- Everything from 1.1.0 remains: cropping on any site, video-only YouTube, no auto-opening disc,
  drag-everywhere mini windows, and one-button permissions.

---

## 8. Good to know

- The transparent disc lives **inside the browser**. Browsers cannot draw transparent windows
  over other apps, so it will **not** float above your desktop.
- **Floaty stays light.** It only creates its UI in a tab once you use it there, and it stops
  animating when the music is paused. On low-end machines it switches to **lite mode** by itself —
  same features, smaller waves, less CPU. Nothing to configure.
- The always-on-top mini window is a real browser window, so it is dragged by its **title bar**
  (the browser does not let a page move it). The disc, the music bar, the launcher and the in-page
  panel drag by clicking and holding anywhere on them.
- The waves follow the **real audio**. For Spotify, Floaty asks the browser to share the tab’s
  audio with the visualiser; Chrome may show a small *“sharing this tab”* indicator while it is
  listening. It stops as soon as you pause or hide the player, and your sound is never muted.
- Spotify’s **−5s / +5s** is best effort and may need an update if Spotify changes its website.
- Crop **one specific area** (a post, a panel, a table) for best results. Very large areas may
  look different in a narrow window.

---

## 9. Troubleshooting

- **Shortcuts do nothing?** Reload the tab, then **click the extension icon** in the toolbar:
  you should see *Floaty is active*. Floaty now attaches itself to tabs you already had open, so
  a reload is rarely needed. Reloading the extension also swaps the new version into open tabs
  automatically.
- **Updated the extension but it looks the same?** Chrome keeps older copies of the script in
  tabs that were already open. Just **click the extension icon** once on that tab (or refresh the
  page) and the new version takes over — no full browser restart.
- **Mini window looks blank or won’t embed?** Give it a second — Floaty tries three ways in
  turn (always-on-top window → live view → in-page panel). On very unusual sites only the panel
  is available.
- **Music UI is missing?** Make sure Spotify / YouTube Music is actually **playing**, then press
  **Alt + 3** (disc) or **Alt + 4** (bar). It is hidden by default on purpose.
- **The wave isn’t moving with the music?** For Spotify the browser has to allow tab-audio
  sharing. If it was blocked, Floaty falls back to a gentle animation. Showing the player right
  after the music starts usually fixes it.
- **A red badge on the icon** means the page blocks all extensions — browser pages like
  `chrome://`, `edge://`, the Web Store, or the built-in PDF viewer. Use a normal website, or the
  hover buttons on the right edge.
- **Nothing floats above other apps** (games, Explorer, etc.) — that’s a browser limitation, not
  a bug. The disc, bar and windows stay inside Chrome / Edge.
