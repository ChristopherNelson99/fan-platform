/**
 * pages/signup-password.js — Password Signup Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initSignupPasswordPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/signup-password.js';
 *     initSignupPasswordPage();
 *   </script>
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerSignupPasswordForm } from '../signup-password-component.js';

export function initSignupPasswordPage() {
  document.addEventListener('alpine:init', () => {
    registerSignupPasswordForm();
  });

  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
