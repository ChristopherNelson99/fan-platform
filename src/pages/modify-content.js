/**
 * pages/modify-content.js — Admin Content Manager Entry Point
 * Place in: modify-content page → Custom Code → Before </body> tag
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initModifyContentPage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/modify-content.js';
 *     initModifyContentPage();
 *   </script>
 *
 * PREREQUISITES:
 *   - main-site.js must load first (handles auth + admin gate).
 *   - User must pass admin check or they get redirected by AuthManager.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import {
  registerDashStore,
  registerUploadLogic,
  initEditorDOM,
} from '../modify-content-component.js';

/**
 * Registers the Alpine store + component, starts Alpine,
 * then wires up the editor DOM (emoji, caret, media input).
 */
export function initModifyContentPage() {
  // 1. Register store and data component before Alpine starts
  document.addEventListener('alpine:init', () => {
    registerDashStore();
    registerUploadLogic();
  });

  // 2. Start Alpine
  Alpine.start();

  // 3. Wire up editor DOM after Alpine has rendered
  //    (emoji picker, caret tracking, media input listener)
  initEditorDOM();
}
