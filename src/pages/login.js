/**
 * pages/login.js — Login Page Entry Point
 * Place in: Login page → Custom Code → Before </body> tag
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initLoginPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/login.js';
 *     initLoginPage();
 *   </script>
 *
 * NOTE: This page does NOT need main-site.js to run first.
 *       AuthManager in main-site.js will redirect authenticated
 *       users away from /auth/* pages automatically, but the
 *       login form itself is fully standalone.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerLoginForm } from '../login-component.js';

/**
 * Registers the loginForm Alpine component and starts Alpine.
 * Guards against double-initialisation if main-site.js has
 * already called Alpine.start().
 */
export function initLoginPage() {
  document.addEventListener('alpine:init', () => {
    registerLoginForm();
  });

  // Prevent double-start if another script already started Alpine
  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
