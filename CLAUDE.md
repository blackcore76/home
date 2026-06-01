# CLAUDE.md — BlackCore Personal Web

## Project Overview

**BlackCore's Personal Web** is a Korean-language PWA (Progressive Web App) hosted on GitHub Pages at `https://blackcore76.github.io/home/`. It is a personal dashboard and toolset for stock market analysis, health tracking, and utilities. There is no build system — all pages are single-file HTML with CSS and JavaScript fully inline.

## Architecture

- **No framework, no bundler.** All pages are standalone `.html` files with embedded `<style>` and `<script>` blocks.
- **GitHub Pages** hosts the static files directly from the `main` branch.
- **Firebase** (`my-bp-tracker-3d595`) provides Auth (Google Sign-In), Firestore (structured data), and Realtime Database (blood pressure tracker).
- **Cloudflare Worker** (`lotto-proxy.blackcore-ff6.workers.dev`) acts as both a CORS proxy for external APIs and a Naver Finance data API. Its source is `worker.js`.
- **Service Workers**: `sw.js` (Stale-While-Revalidate PWA cache) and `firebase-messaging-sw.js` (push notifications).

## File Map

| File | Purpose |
|------|---------|
| `index.html` | Landing page / home hub (dark editorial style, Playfair Display) |
| `market-scanner.html` | AI stock screener — KR 50 + US 70 tickers → technical filter → Claude Haiku TOP 5 |
| `market-aibriefing.html` | AI chart analysis reports using Gemini 3 Flash Preview, saves to Firestore |
| `market-dashboard.html` | Live market dashboard (KOSPI/KOSDAQ/US indices), push-alert configuration |
| `market-picker.html` | Watchlist with fundamental scoring (Firestore-backed) |
| `market-virtual.html` | Paper trading / virtual portfolio (Firestore-backed) |
| `stocklens.html` | Stock portfolio tracker (Firestore-backed) |
| `daily-feed.html` | Daily journal / feed (Firestore-backed, no auth overlay) |
| `daily-pick.html` | Daily stock pick notes (Firestore-backed) |
| `news.html` | Korean finance news via Naver (Worker-backed) |
| `blood_fb_auth.html` | Blood pressure tracker (Firebase Realtime Database) |
| `lotto.html` | Lotto 6/45 + pension lottery picker |
| `bookmarks.html` | Personal bookmarks manager (Firestore-backed) |
| `dashboard.html` | 4-panel global market chart dashboard |
| `home-bar.js` | Shared top navigation bar injected by all sub-pages |
| `auth.js` | Shared Firebase Google Sign-In overlay/logout module |
| `worker.js` | **Cloudflare Worker** source — Naver Finance API proxy + CORS proxy |
| `sw.js` | PWA service worker (Stale-While-Revalidate, cache key `home-v3`) |
| `firebase-messaging-sw.js` | Firebase Cloud Messaging service worker for background push alerts |
| `site.webmanifest` | PWA manifest (`scope: /home/`, `display: standalone`) |
| `market-picker-GICS.txt` | GICS sector reference data |
| `유망주발굴프롬프트.txt` | AI stock discovery prompt template (Korean) |
| `유틸리티 체크리스트.txt` | Utility checklist (Korean) |

## Shared Components

### `home-bar.js`
Injected via `<script src="home-bar.js">` in every sub-page (not on `index.html`). Self-invoking IIFE that injects a fixed top navigation bar with:
- BlackCore logo link back to `index.html`
- Current page breadcrumb (from `FILE_LABELS` map)
- Live ET and KST clock (updated every second)
- HOME button
- Slot for logout button (`#bc-right-group`)

`body` receives `padding-top: 36px` and `header` gets `top: 36px` automatically.

### `auth.js`
Shared Google Sign-In module. Loaded after Firebase SDK. Creates a fullscreen overlay for unauthenticated users, then removes it on login. Injects a logout button into `#bc-right-group`. **Exception:** `daily-feed.html` is in `NO_OVERLAY_PAGES` and skips the overlay.

Pages that embed their own Firebase init inline (most Firestore pages) handle auth directly without `auth.js`.

## Design System

### Dark App Theme (most pages)
```css
--bg:    #080c14   /* page background */
--sf:    #0e1422   /* surface */
--sf2:   #131b2d
--sf3:   #181f30
--bd:    #1e2d45   /* border */
--bd2:   #263548
--text:  #c8d6e8
--text2: #7a91a8
--text3: #4a5f74
--accent:#00d4ff   /* cyan accent */
--green: #00e676
--red:   #ff5252
--yellow:#ffca28
```
Fonts: `'JetBrains Mono'` (monospace, numbers/code) + `'Noto Sans KR'` (body text).

### Index Page Theme (editorial)
```css
--ink:   #0d0f12
--cream: #f0ebe3
--steel: #3d6fa8
--gold:  #c9a84c
```
Fonts: `'Playfair Display'` (headings/hero) + `'JetBrains Mono'` (body).

### Header Layout Convention
Sub-pages have a sticky header at `top: 36px` (below the 36px home-bar). Logo uses an animated `.logo-dot` (cyan, pulsing blink animation).

## Firebase Configuration

**Project:** `my-bp-tracker-3d595`  
**API Key:** `AIzaSyCIQKMbhnQY2sIdDthFrm-dznnVMs5pb30` (public browser key, safe to commit)  
**SDK Version:** `10.12.0` (compat mode, CDN)

Services used per page:
- **Firestore** — market-picker, market-virtual, stocklens, daily-feed, daily-pick, bookmarks, market-scanner, market-aibriefing
- **Auth** — all pages via auth.js or inline
- **Realtime Database** — blood_fb_auth.html only (`databaseURL: https://my-bp-tracker-3d595-default-rtdb.firebaseio.com`)
- **Messaging (FCM)** — market-dashboard.html (push price alerts), firebase-messaging-sw.js

VAPID key for FCM: stored in `market-dashboard.html`.

Firebase is always initialized via `firebase.initializeApp({...})` inline at the top of each page's `<script>` block. `market-scanner.html` uses the Firebase REST API directly (not the SDK) for Firestore writes.

## External APIs

| Service | Used by | Notes |
|---------|---------|-------|
| **Naver Finance** (via Cloudflare Worker) | market-scanner, market-dashboard, market-virtual, news | `WORKER = 'https://lotto-proxy.blackcore-ff6.workers.dev'` |
| **Naver Finance** (CORS proxy) | market-dashboard, market-aibriefing, market-scanner | `/?url=<encoded-url>` passthrough |
| **Yahoo Finance** | market-scanner, market-dashboard, market-aibriefing, market-virtual | `query2.finance.yahoo.com` / `query1.finance.yahoo.com`, no key |
| **Anthropic Claude API** | market-scanner | `claude-haiku-4-5-20251001`, key stored in `localStorage('claude_scanner_key')`, user-supplied |
| **Google Gemini** | market-aibriefing | `gemini-3-flash-preview` via `generativelanguage.googleapis.com`, user-supplied key |
| **Google Fonts** | all pages | Preconnect pattern |
| **Firebase CDN** | all pages | gstatic.com |

### Cloudflare Worker (`worker.js`) Routes
Deployed at `lotto-proxy.blackcore-ff6.workers.dev`:
- `/?url=<url>` — generic CORS proxy
- `/naver/candles?code=&days=` — OHLCV candle data with Naver fallback chain
- `/naver/quote?code=` — single stock quote
- `/naver/index` — KOSPI + KOSDAQ index
- `/naver/news?tab=&count=` — parsed Naver Finance news (EUC-KR decoded)
- `/naver/debug?tab=` — HTML snippet debug endpoint

Cache TTLs (seconds): `quote=120, candles=600, index=60, news=300`

## Authentication Model

All pages (except `daily-feed.html`) require Google Sign-In before showing content. Auth state is managed by Firebase Auth. The pattern:
1. Load Firebase Auth SDK
2. Load `auth.js` (or handle inline)
3. `firebase.auth().onAuthStateChanged()` controls visibility

`daily-feed.html` has its own inline auth that shows a soft login prompt instead of blocking the page.

## PWA Details

- **Cache name:** `home-v3` (bump version in `sw.js` to force refresh)
- **Shell cache:** `['/', '/home/', '/home/index.html', '/home/icon-192.png', '/home/icon-512.png', '/home/favicon.png']`
- **Strategy:** Stale-While-Revalidate for same-origin requests; external API requests bypass the SW
- **Install:** Manifest at `site.webmanifest`, icons at `icon-192.png` / `icon-512.png`
- `firebase-messaging-sw.js` must be at the root of the scope (`/home/`) for FCM to work

## Development Conventions

### Editing Pages
- All CSS lives in a `<style>` block in `<head>`. No external stylesheets.
- All JS lives in `<script>` blocks before `</body>` (or occasionally inline in `<head>` for Firebase init).
- Korean is used for UI labels, comments, and variable names throughout.

### Adding a New Page
1. Copy the head boilerplate from an existing page (meta tags, manifest, Google Fonts, Firebase init).
2. Add `<script src="home-bar.js">` before the closing `</head>` or at start of body.
3. Add the new filename and label to `FILE_LABELS` in `home-bar.js`.
4. Make `header` sticky at `top: 36px` to account for the home bar.
5. Add the page link to `index.html`'s navigation grid.

### CSS Variable Naming
Use the dark app theme variables (`--bg`, `--sf`, `--bd`, `--text`, `--accent`, etc.) consistently. The index page uses its own separate variable set (`--ink`, `--cream`, `--gold`).

### No Build Step
There is no `npm install`, no `package.json`, no Webpack/Vite. Edit files directly and push to `main`. GitHub Pages deploys automatically.

### SW Cache Version
When changing `sw.js` shell resources, increment the `CACHE` constant (e.g., `home-v3` → `home-v4`) to force existing installs to update.

### Cloudflare Worker Deployment
`worker.js` is the source for the deployed Cloudflare Worker. Changes to `worker.js` in this repo do **not** auto-deploy — the worker must be manually deployed via the Cloudflare dashboard or `wrangler`.

## Deployment

- **Branch:** `main`
- **Host:** GitHub Pages (automatic on push to `main`)
- **URL:** `https://blackcore76.github.io/home/`
- Push changes with `git push origin main`
