/**
 * main-site.js — Site-Wide Entry Point
 * Place in: Site Settings → Custom Code → Before </body> tag
 * ──────────────────────────────────────────────────────────────
 * Initialises: Auth → Notifications → Avatar Upload → Content Protection
 *
 * SAFARI FIX: No top-level await. Uses async IIFE instead,
 *             which is supported in Safari 14+ with <script type="module">.
 */

import { AuthManager, initCrossTabSync } from './auth.js';
import { NotificationManager } from './notifications.js';
import { AvatarUploadManager } from './avatar.js';
import { initContentProtection } from './protection.js';
import { AUTH_CONFIG } from './config.js';

(async () => {
  // 1. Authentication (must complete before anything else)
  const authManager = new AuthManager();
  await authManager.init();
  window.authManager = authManager;

  // 2. Cross-tab login/logout sync
  initCrossTabSync();

  // 3. Notifications (only for authenticated users)
  if (localStorage.getItem(AUTH_CONFIG.storage.authToken)) {
    const notifManager = new NotificationManager();
    await notifManager.init();
    window.notificationManager = notifManager;
  }

  // 4. Avatar Upload
  const avatarManager = new AvatarUploadManager();
  avatarManager.init();

  // 5. Content Protection (screenshot/print deterrent)
  initContentProtection();
})();
