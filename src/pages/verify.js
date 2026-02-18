/**
 * pages/verify.js — Verify Email Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initVerifyPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/verify.js';
 *     initVerifyPage();
 *   </script>
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerVerifyHandler } from '../verify-component.js';

export function initVerifyPage() {
  document.addEventListener('alpine:init', () => {
    registerVerifyHandler();
  });

  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
