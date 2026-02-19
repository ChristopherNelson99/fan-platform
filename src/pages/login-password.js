/**
 * pages/login-password.js — Password Login Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initLoginPasswordPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/login-password.js';
 *     initLoginPasswordPage();
 *   </script>
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerLoginPasswordForm } from '../login-password-component.js';

export function initLoginPasswordPage() {
  document.addEventListener('alpine:init', () => {
    registerLoginPasswordForm();
  });

  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
