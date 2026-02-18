/**
 * pages/signup.js — Signup Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initSignupPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/signup.js';
 *     initSignupPage();
 *   </script>
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerSignupForm } from '../signup-component.js';

export function initSignupPage() {
  document.addEventListener('alpine:init', () => {
    registerSignupForm();
  });

  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
