# Feed Page — ES6 Module Refactor

## Architecture Overview

```
src/
├── config.js            # All endpoints, routes, constants (single source of truth)
├── api.js               # ky-based API client factory with auth injection
├── utils.js             # dayjs setup, formatters, debounce/throttle, DOM helpers
├── auth.js              # AuthManager class + cross-tab sync
├── notifications.js     # NotificationManager class
├── avatar.js            # AvatarUploadManager class
├── protection.js        # Screenshot/print/save deterrent
├── player.js            # Plyr + HLS.js video manager (Safari-aware)
├── stores.js            # Alpine global stores (input, app/lightbox)
├── feed-component.js    # Alpine `app` data component (the big one)
├── main-site.js         # ENTRY: Site-wide script (auth + notif + avatar + protection)
└── pages/
    └── feed.js          # ENTRY: Feed page script (Alpine setup + start)
```

---

## What Changed & Why

### 1. Safari Fixes

| Issue | Before | After |
|---|---|---|
| **Import Maps** | `<script type="importmap">` (Safari <16.4 fails) | Direct ESM URLs everywhere: `import ky from 'https://esm.sh/ky@1.7.2'` |
| **Top-Level Await** | `await authManager.init()` at module top | Wrapped in async IIFE `(async () => { ... })()` |
| **HLS Playback** | Always used HLS.js even on Safari | `canPlayHLSNatively()` detection — Safari uses native `<video src="...m3u8">`, HLS.js only for Chrome/Firefox |
| **Clipboard API** | `navigator.clipboard.writeText()` without gesture | Wrapped in try/catch (Safari blocks outside user gesture) |
| **Width Detection** | `window.innerWidth > 991` | `window.matchMedia('(min-width: 992px)')` (handles orientation changes) |

### 2. Mobile Fixes

| Issue | Before | After |
|---|---|---|
| **Resize thrashing** | Bare `window.addEventListener('resize', ...)` | `debounce(fn, 250)` wrapper |
| **IntersectionObserver** | `threshold: 0.5` (too strict on small screens) | `threshold: 0.3` for better autoplay trigger |
| **Player cleanup** | Players/observers not destroyed on logout | `player.destroy()`, `hls.destroy()`, `observer.disconnect()` on cleanup |
| **Emoji picker z-index** | Conflicting z-index layers | Consistent stacking: backdrop=2000, picker=2001 |

### 3. Code Quality

| Issue | Before | After |
|---|---|---|
| **Monolith** | 2 giant inline `<script>` blocks (~600 lines each) | 12 focused modules, single responsibility |
| **Duplicate CSS** | Comment input CSS copied twice (drawer + lightbox) | Still in HTML embeds (Webflow limitation), but identical |
| **Variable naming** | `uM`, `cR`, `uR`, `s`, `c`, `t` | `userMap`, `creatorResponse`, `status`, `countdown`, `type` |
| **Error handling** | Generic catch-all | Typed error handling with status-specific responses |
| **HLS memory leaks** | HLS instances never destroyed | Tracked in `_hlsInstances` Map, destroyed on logout |

---

## Webflow Integration

### Option A: GitHub + CDN (Recommended for Production)

1. Push this `src/` folder to a GitHub repo
2. Use a CDN that serves ES modules (e.g., jsDelivr, Cloudflare Pages, or your own)
3. In Webflow:

**Site Settings → Before `</body>` tag:**
```html
<script type="module" src="https://your-cdn.com/src/main-site.js"></script>
```

**Feed Page → Before `</body>` tag:**
```html
<script type="module" src="https://your-cdn.com/src/pages/feed.js"></script>
```

### Option B: Inline (Current Webflow approach, during transition)

Copy the contents of `main-site.js` into `<script type="module">...</script>` in Site Settings, and `pages/feed.js` into the feed page's custom code block. The `import` paths need to point to your hosted CDN or bundled output.

### Option C: Build Step (Most Robust)

Use Vite or esbuild to bundle the modules into two files:
```bash
# Install
npm init -y && npm install vite

# Bundle
npx vite build --config vite.config.js
```

This produces `main-site.bundle.js` and `feed.bundle.js` with all imports resolved — no import map needed, works everywhere.

---

## Security Checklist

- [x] No admin API keys in client-side code
- [x] All sensitive endpoints use `Authorization: Bearer {token}` via `addAuth` hook
- [x] Invalid tokens cleared immediately on 401
- [x] Subscription status checked before media URL delivery (server-side in Xano)
- [x] Content protection (blur on tab switch, right-click disabled) — deterrent only
- [x] CORS: Ensure Xano allows your Webflow domain (`*.webflow.io` and production domain)

---

## Adding New Pages

When you build the next page (e.g., Profile, Settings, Messages):

1. Create `src/pages/profile.js` as a new entry point
2. Import only the modules that page needs (e.g., `api.js`, `utils.js`)
3. Register any page-specific Alpine components
4. The site-wide script (`main-site.js`) handles auth/notifications/protection automatically

---

## CORS Reminder

In your Xano workspace → Settings → CORS, ensure these origins are allowed:
- `https://your-site.webflow.io`
- `https://www.katiesigmond.co`
- `http://localhost:*` (for local development only)
