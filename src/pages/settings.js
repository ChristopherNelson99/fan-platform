/**
 * pages/settings.js — Settings Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initSettingsPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/settings.js';
 *     initSettingsPage();
 *   </script>
 *
 * PREREQUISITES: main-site.js must load first (provides
 *                window.currentUser via AuthManager).
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerSettingsPage } from '../settings-component.js';

export function initSettingsPage() {
  document.addEventListener('alpine:init', () => {
    registerSettingsPage();
  });

  if (!window.Alpine?.initialized) {
    Alpine.start();
    window.Alpine = Alpine;
    window.Alpine.initialized = true;
  }
}
