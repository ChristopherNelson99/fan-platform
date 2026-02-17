/**
 * @fileoverview Site-wide initialization script
 * Place in: Webflow Site Settings → Before </body> tag
 * @module site-wide
 */

import { initAuthManager } from './core/auth.js';
import { initNotifications } from './modules/notifications/index.js';
import { initAvatarUpload } from './modules/avatar/index.js';
import { initScreenshotProtection } from './modules/protection/index.js';
import { debugLog } from './core/constants.js';

/**
 * Initialize all site-wide functionality
 * @param {Object} options 
 */
export async function initSiteWide(options = {}) {
  const config = {
    enableProtection: true,
    enableNotifications: true,
    enableAvatarUpload: true,
    protectionOptions: {
      showMessages: false,
      enableOnLoad: true
    },
    ...options
  };

  debugLog('SiteWide', 'Initializing site-wide features...');

  try {
    // 1. Initialize authentication (REQUIRED - runs first)
    const authManager = await initAuthManager();
    debugLog('SiteWide', '✅ Authentication initialized');

    // Only initialize other features if user is authenticated
    if (authManager.isAuthenticated) {
      // 2. Initialize notifications
      if (config.enableNotifications) {
        initNotifications();
        debugLog('SiteWide', '✅ Notifications initialized');
      }

      // 3. Initialize avatar upload
      if (config.enableAvatarUpload) {
        initAvatarUpload();
        debugLog('SiteWide', '✅ Avatar upload initialized');
      }

      // 4. Initialize screenshot protection
      if (config.enableProtection) {
        initScreenshotProtection(config.protectionOptions);
        debugLog('SiteWide', '✅ Screenshot protection initialized');
      }
    }

    debugLog('SiteWide', '🎉 All site-wide features initialized successfully');

  } catch (error) {
    debugLog('SiteWide', '❌ Initialization failed:', error);
    console.error('Site-wide initialization error:', error);
  }
}

/**
 * Auto-initialize when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initSiteWide());
} else {
  initSiteWide();
}

// Export for manual initialization if needed
export default initSiteWide;
