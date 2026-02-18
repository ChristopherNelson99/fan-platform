# Fan Platform — Module Reference

## Project Structure

```
src/
├── config.js                        ← Central configuration
├── api.js                           ← API client factory
├── utils.js                         ← Shared utilities
├── auth.js                          ← Authentication manager
├── avatar.js                        ← Avatar upload manager
├── notifications.js                 ← Notification system
├── protection.js                    ← Content protection (screenshot deterrent)
├── main-site.js                     ← Site-wide entry point
├── stores.js                        ← Alpine global stores (feed + profile)
├── player.js                        ← Video player (Plyr + HLS.js)
├── feed-component.js                ← Feed/Profile shared Alpine component (factory)
├── modify-content-component.js      ← Admin content manager component
├── login-component.js               ← Login form component
├── signup-component.js              ← Signup form component
├── verify-component.js              ← Email verification component
├── settings-component.js            ← Settings page component
└── pages/
    ├── feed.js                      ← Feed page entry point
    ├── profile.js                   ← Profile page entry point
    ├── modify-content.js            ← Admin page entry point
    ├── login.js                     ← Login page entry point
    ├── signup.js                    ← Signup page entry point
    ├── verify.js                    ← Verify page entry point
    └── settings.js                  ← Settings page entry point
```

---

## Site-Wide Files (Loaded on Every Page)

These files run on **all pages** via `main-site.js` in Webflow's Site Settings → Before `</body>` tag.

### config.js
**Purpose:** Single source of truth for all URLs, selectors, constants, and feature flags.

Contains:
- `API_PREFIXES` — Base URLs for every Xano API group (auth, feed, comment, checkout, avatar, profile, admin).
- `AUTH_CONFIG` — Auth endpoints, route paths, localStorage key names.
- `NOTIFICATION_CONFIG` — Notification endpoints, CSS selectors, class names, breakpoints.
- `FEED_CONFIG` — Pagination size, comment limits, feed-specific API endpoints (`get_content_feed_premium` / `get_content_feed_unsubbed`), and filter list (`all`, `free`, `paid`).
- `PROFILE_CONFIG` — Same structure as `FEED_CONFIG` but with profile-specific endpoints (`get_profile_feed_premium` / `get_profile_feed_unsubbed`) and filters (`all`, `liked`, `bookmarked`).
- `ADMIN_CONFIG` — Content creation/edit/bio-edit endpoints, teaser blur settings, editor selectors.
- `SETTINGS_CONFIG` — Request timeout, success feedback duration, creator user ID.
- `TRANSPARENT_PIXEL` / `PLACEHOLDER` — Fallback image constants.

**Why it matters:** When a Xano endpoint URL changes, you update it in one place. Every module imports from here. The `FEED_CONFIG` / `PROFILE_CONFIG` split is what allows the feed and profile pages to share 100% of their component logic.

---

### api.js
**Purpose:** Creates pre-configured HTTP clients for each Xano API group using the `ky` library.

Contains:
- `API.auth` — Authentication endpoints (login, signup, verify).
- `API.feed` — Content feed endpoints.
- `API.comment` — Comments and notifications.
- `API.public` — Unauthenticated public endpoints.
- `API.checkout` — Stripe checkout and billing portal.
- `API.admin` — Creator-only content management and bio editing.
- `API.profile` — User profile editing (name, email, avatar).
- `authenticatedKy` — Standalone authenticated client for one-off requests.

**Key feature:** Auth tokens are automatically injected into every request via a `beforeRequest` hook. No module ever manually reads `localStorage.getItem('authToken')` to set headers.

---

### auth.js
**Purpose:** `AuthManager` class that handles the entire authentication lifecycle.

Responsibilities:
- Validates the stored JWT on page load by calling `/auth/get/me`.
- Fetches the creator profile and stores it globally.
- Checks admin status for creator-only pages.
- Implements folder-based routing (redirects unauthenticated users away from `/membership/*` pages, redirects authenticated users away from `/auth/*` pages).
- Listens for cross-tab login/logout events via `localStorage` so all open tabs stay in sync.
- Clears tokens and redirects on 401 responses.

**Exposes:** `window.currentUser` and `window.creatorProfile` — used by feed, profile, and settings pages.

---

### avatar.js
**Purpose:** `AvatarUploadManager` for profile picture uploads.

Responsibilities:
- Listens for file input changes on the avatar upload element.
- Sends the image to the Xano avatar endpoint.
- Updates the avatar preview in the navbar after successful upload.

---

### notifications.js
**Purpose:** `NotificationManager` — full notification drawer system.

Responsibilities:
- Fetches notifications from Xano on page load.
- Renders notification cards with staggered CSS animations.
- Handles mark-as-read on click.
- Deep-links notifications to the correct feed post or message thread.
- Manages the drawer open/close state.
- Shows/hides the unread badge counter.

---

### protection.js
**Purpose:** Screenshot and content-save deterrent for paid content.

Responsibilities:
- Blurs the page content when the browser tab loses focus (deters screenshot tools).
- Disables right-click context menu on protected elements.
- Disables `Ctrl+S` / `Cmd+S` save shortcut.

**Note:** This is a deterrent only, not DRM. Determined users can bypass it.

---

### main-site.js
**Purpose:** Site-wide entry point that orchestrates all shared modules.

Execution order:
1. Creates `AuthManager` and runs authentication checks.
2. Initialises `NotificationManager`.
3. Initialises `AvatarUploadManager`.
4. Initialises content `Protection`.

**Webflow placement:** Site Settings → Custom Code → Before `</body>` tag.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/main-site.js"></script>
```

---

## Feed Page

**URL:** `/membership/feed`

### pages/feed.js
**Purpose:** Page entry point. Registers Alpine stores and the feed component (via `registerFeedComponent`), wraps Webflow elements into Alpine `x-for` templates with feed-specific filter expressions, and starts Alpine.

**Export:** `initFeedPageComplete()`

**Filter expression:** Posts are filtered by `currentFilter` — `all`, `free` (non-paid), or `paid`.

```html
<script type="module">
  import { initFeedPageComplete } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/feed.js';
  initFeedPageComplete();
</script>
```

### feed-component.js (Shared with Profile Page)
**Purpose:** Factory module that produces the Alpine `app` data component. The largest module in the project (~730 lines). Used by both the feed and profile pages.

**Architecture:** Exports a `createFeedComponent(pageConfig)` factory function. The two thin registration wrappers pass page-specific config:
- `registerFeedComponent()` → passes `FEED_CONFIG` (endpoints: `get_content_feed_*`, filters: `all/free/paid`)
- `registerProfileComponent()` → passes `PROFILE_CONFIG` (endpoints: `get_profile_feed_*`, filters: `all/liked/bookmarked`)

All internal methods read `this._pageConfig` for endpoints, pagination, and filters — zero code duplication.

Responsibilities:
- Fetches the paginated content feed from Xano (endpoint determined by `_pageConfig`).
- Renders posts with images (appends `?width=700` for BunnyCDN resizing), videos, descriptions, and timestamps.
- Handles the like/unlike toggle with optimistic UI updates.
- Manages the bookmark system.
- Implements the full comment system: loading, posting, deleting comments and replies.
- Handles the emoji picker for comments (Picmo, lazy-loaded, stored outside Alpine to avoid Proxy crash).
- Controls the lightbox for fullscreen media viewing.
- Manages infinite scroll via `IntersectionObserver`.
- Handles post filtering (driven by `_pageConfig.filters` — supports both exclusive and toggle modes).
- Implements share-to-clipboard functionality.
- Debounced resize handling for responsive layout adjustments.
- **Creator bio editing:** `startEditBio()`, `saveBio()`, `cancelEditBio()` — only available when `user.id === SETTINGS_CONFIG.creatorUserId`. Posts to `/creator_profile/edit_bio` and syncs to local state, `window.creatorProfile`, and localStorage.
- `isCreator` computed getter for conditional UI (edit buttons, admin links).

### stores.js
**Purpose:** Registers Alpine global stores used by both feed and profile pages.

Contains:
- `input` store — Tracks comment/reply input focus state.
- `app` store — Lightbox open/close state.

### player.js
**Purpose:** Video player wrapper combining Plyr.js and HLS.js.

Key Safari fix: Detects native HLS support and uses the browser's built-in player on Safari instead of HLS.js. This eliminates the double-decode stutter that occurred when HLS.js was forced on Safari.

Responsibilities:
- Creates Plyr instances for each video element.
- Attaches HLS.js for Chrome/Firefox (no native HLS support).
- Uses native `<video src="...m3u8">` on Safari/iOS.
- Tracks all player and HLS instances for proper cleanup on logout.

### utils.js
**Purpose:** Shared utility functions used across multiple modules.

Contains:
- `dayjs` setup with `relativeTime` plugin.
- `timeAgoDisplay()` — Formats timestamps as "2h ago", "3d ago", etc.
- `debounce()` / `throttle()` — Performance helpers.
- `wrapInTemplate()` — Converts Webflow static elements into Alpine `<template x-for>` loops.
- `ensurePlyrCSS()` — Injects the Plyr stylesheet (idempotent).
- DOM helper functions.

---

## Profile Page

**URL:** `/membership/profile`

### pages/profile.js
**Purpose:** Page entry point. Registers Alpine stores and the profile component (via `registerProfileComponent`), wraps Webflow elements into Alpine `x-for` templates with profile-specific filter expressions, and starts Alpine.

**Export:** `initProfilePage()`

**Filter expression:** Posts are filtered by `currentFilter` — `all`, `liked`, or `bookmarked` (toggle mode — clicking active filter reverts to `all`).

```html
<script type="module">
  import { initProfilePage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/profile.js';
  initProfilePage();
</script>
```

### Shared modules
The profile page reuses these modules identically with the feed page: `feed-component.js` (via `registerProfileComponent`), `stores.js`, `player.js`, `utils.js`. See Feed Page section above for full details.

---

## Admin: Modify Content Page

**URL:** `/admin/modify-content`

### pages/modify-content.js
**Purpose:** Page entry point. Registers the `dash` store, `uploadLogic` component, starts Alpine, and wires up the editor DOM.

**Export:** `initModifyContentPage()`

```html
<script type="module">
  import { initModifyContentPage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/modify-content.js';
  initModifyContentPage();
</script>
```

### modify-content-component.js
**Purpose:** The admin content creation and editing system.

Contains:
- **Alpine store `dash`** — Manages the view state (`create` / `edit` / `grid`), post list, editing context, and URL deep-linking via `?post_id=`.
- **Alpine data `uploadLogic`** — Rich text editor formatting (bold, italic, underline via `execCommand`), media file selection, blurred teaser image generation via Canvas, and post upload/edit via FormData.
- **`initEditorDOM()`** — Sets up the emoji picker (Picmo, lazy-loaded), caret position tracking for emoji insertion, and media file input listener. Called after Alpine starts.

---

## Login Page

**URL:** `/auth/login`

### pages/login.js
**Purpose:** Page entry point. Registers the `loginForm` component and starts Alpine.

**Export:** `initLoginPage()`

```html
<script type="module">
  import { initLoginPage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/login.js';
  initLoginPage();
</script>
```

### login-component.js
**Purpose:** Alpine `loginForm` data component for magic link authentication.

Responsibilities:
- Captures email input.
- Honeypot bot detection (hidden `company` field — bots fill it, real users don't).
- Basic email validation.
- Sends magic link request to Xano's `/auth/send_magic_link` endpoint.
- Stores the "remember me" preference in localStorage.
- Displays success/error feedback.

---

## Signup Page

**URL:** `/auth/signup`

### pages/signup.js
**Purpose:** Page entry point. Registers the `signupForm` component and starts Alpine.

**Export:** `initSignupPage()`

```html
<script type="module">
  import { initSignupPage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/signup.js';
  initSignupPage();
</script>
```

### signup-component.js
**Purpose:** Alpine `signupForm` data component for new user registration.

Responsibilities:
- Captures name, email, and terms acceptance.
- Honeypot bot detection (same pattern as login).
- Client-side validation: name required, valid email, terms checkbox.
- Sends signup request to Xano's `/auth/signup` endpoint.
- Displays success/error feedback.

---

## Verify Email Page

**URL:** `/auth/verify`

### pages/verify.js
**Purpose:** Page entry point. Registers the `verifyHandler` component and starts Alpine.

**Export:** `initVerifyPage()`

```html
<script type="module">
  import { initVerifyPage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/verify.js';
  initVerifyPage();
</script>
```

### verify-component.js
**Purpose:** Alpine `verifyHandler` data component for magic link token verification.

Responsibilities:
- On page load, reads `?token=` from the URL.
- If token exists: sends it to Xano's `/auth/verify_magic_link` endpoint for validation.
- On success: stores `authToken` and `userData` in localStorage, fires a cross-tab `login_event`, and redirects to `/membership/feed` after a 1-second transition.
- On failure: displays the error and shows a "Request new link" form.
- The resend form has the same honeypot + validation pattern as login/signup.

---

## Settings Page

**URL:** `/membership/settings`

### pages/settings.js
**Purpose:** Page entry point. Registers the `settingsPage` component and starts Alpine.

**Export:** `initSettingsPage()`

```html
<script type="module">
  import { initSettingsPage } from
    'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/settings.js';
  initSettingsPage();
</script>
```

### settings-component.js
**Purpose:** Alpine `settingsPage` data component for user account management.

Responsibilities:
- Polls for `window.currentUser` (set by AuthManager in main-site.js) with a 5-second timeout.
- **Profile editing:** Update name and email via Xano's `/user/edit_profile` endpoint. Changes are synced to `window.currentUser`, localStorage, and the local component state simultaneously.
- **Stripe billing portal:** Creates a portal session via Xano's `/create_portal_session` endpoint and redirects to Stripe. The portal button is hidden for the creator account (user ID defined in `SETTINGS_CONFIG.creatorUserId`).
- Computed getters disable save buttons when values haven't changed.
- 3-second success feedback after each save.

**Webflow note:** Any elements using `x-show="user.id === 3"` must use optional chaining: `x-show="user?.id === 3"` because `user` starts as `null` before polling completes.

---

## Dependency Map

Shows which shared modules each page imports (directly or transitively).

| Module | Feed | Profile | Modify Content | Login | Signup | Verify | Settings |
|--------|:----:|:-------:|:--------------:|:-----:|:------:|:------:|:--------:|
| config.js | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| api.js | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utils.js | ✓ | ✓ | ✓ | — | — | — | — |
| stores.js | ✓ | ✓ | — | — | — | — | — |
| player.js | ✓ | ✓ | — | — | — | — | — |
| feed-component.js | ✓ | ✓ | — | — | — | — | — |
| main-site.js | ✓ | ✓ | ✓ | — | — | — | ✓ |
| auth.js | ✓ | ✓ | ✓ | — | — | — | ✓ |
| avatar.js | ✓ | ✓ | ✓ | — | — | — | ✓ |
| notifications.js | ✓ | ✓ | ✓ | — | — | — | ✓ |
| protection.js | ✓ | ✓ | ✓ | — | — | — | ✓ |

**Legend:** `✓` = loaded on this page. `—` = not loaded.

---

## Webflow Integration Summary

### Site Settings → Before `</body>` (runs on ALL pages)
```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/main-site.js">
</script>
```

### Per-Page → Before `</body>` (one per page)

**IMPORTANT:** Each page must use an inline `<script type="module">` with `import` + function call — NOT a bare `src=` attribute. A bare `src=` loads the module but never calls the init function.

| Page | Embed Code |
|------|-----------|
| Feed | `import { initFeedPageComplete } from '.../src/pages/feed.js'; initFeedPageComplete();` |
| Profile | `import { initProfilePage } from '.../src/pages/profile.js'; initProfilePage();` |
| Modify Content | `import { initModifyContentPage } from '.../src/pages/modify-content.js'; initModifyContentPage();` |
| Login | `import { initLoginPage } from '.../src/pages/login.js'; initLoginPage();` |
| Signup | `import { initSignupPage } from '.../src/pages/signup.js'; initSignupPage();` |
| Verify | `import { initVerifyPage } from '.../src/pages/verify.js'; initVerifyPage();` |
| Settings | `import { initSettingsPage } from '.../src/pages/settings.js'; initSettingsPage();` |

---

## Cache Purging Reminder

After every push to GitHub, purge **all changed files** on jsDelivr:

```
https://purge.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/FILE_PATH
```

Or use a commit SHA in the import URL to bypass caching entirely during development:

```
https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@COMMIT_SHA/src/pages/feed.js
```

---

## Changelog

**v2 updates (since initial doc):**
- Added **Profile page** (`pages/profile.js`) — reuses feed component with different endpoints and filters.
- Refactored `feed-component.js` to **factory pattern** — `createFeedComponent(pageConfig)` produces the Alpine component. Both `registerFeedComponent()` and `registerProfileComponent()` are thin wrappers that pass page-specific config.
- Moved `endpoints` and `filters` into `FEED_CONFIG` and `PROFILE_CONFIG` in config.js.
- Added **creator bio editing** to the feed component — `startEditBio()`, `saveBio()`, `cancelEditBio()`, `isCreator` getter. Posts to `ADMIN_CONFIG.endpoints.editBio`.
- Added `editBio` endpoint to `ADMIN_CONFIG`.
- Added `PROFILE_CONFIG` to config.js.
- Added `API.profile` instance to api.js.
- Profile filter mode is **toggle** (clicking active filter reverts to `all`) vs feed filter mode which is **exclusive**.
- Documented the `src=` vs inline import gotcha for Webflow embeds.
- Documented the `user?.id` optional chaining fix for settings page.
