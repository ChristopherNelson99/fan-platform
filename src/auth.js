/**
 * auth.js — Authentication Manager
 * Handles JWE token validation, user/creator data, folder-based routing.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: Token validated server-side via Xano /auth/get/me.
 *           Invalid tokens are cleared immediately.
 * SAFARI:   Avoids top-level await; uses .init() pattern instead.
 */

import { API } from './api.js';
import { AUTH_CONFIG } from './config.js';

// ─── Folder Detection ────────────────────────────────────────
function getCurrentFolder() {
  const path = window.location.pathname;
  const segments = path.replace(/^\/|\/$/g, '').split('/');
  return segments[0] || null;
}

// ─── Auth Manager Class ──────────────────────────────────────
export class AuthManager {
  constructor() {
    this.user = null;
    this.creator = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.currentFolder = getCurrentFolder();
  }

  /**
   * Validates the stored token and fetches user + creator data.
   * Call this once on page load.
   */
  async init() {
    const token = localStorage.getItem(AUTH_CONFIG.storage.authToken);

    if (!token) {
      this._handleUnauthenticated();
      return;
    }

    try {
      const [userResponse, creatorResponse] = await Promise.all([
        API.auth.get('auth/get/me').json(),
        API.public.get('get_creator_profile').json(),
      ]);

      const userData = userResponse.user_information || userResponse;

      this.user = {
        id:         userData.id,
        name:       userData.name,
        email:      userData.email,
        avatar_url: userData.avatar_url,
        subscribed: !!userData.subscribed,
        created_at: userData.created_at,
      };

      this.creator = creatorResponse;
      this.isAuthenticated = true;

      // Persist for other scripts / tabs
      localStorage.setItem(AUTH_CONFIG.storage.userData, JSON.stringify(this.user));
      localStorage.setItem(AUTH_CONFIG.storage.creatorData, JSON.stringify(this.creator));

      // Expose globally (consumed by Alpine components)
      window.currentUser = this.user;
      window.creatorProfile = this.creator;

      await this._handleAuthenticated();
    } catch (error) {
      console.error('[Auth] Validation failed:', error);
      this._clearStorage();
      this._handleUnauthenticated();
    }
  }

  // ── Routing Logic ────────────────────────────────────────
  async _handleAuthenticated() {
    // Authenticated user on /auth/* → redirect to feed
    if (this.currentFolder === 'auth') {
      window.location.href = AUTH_CONFIG.routes.feed;
      return;
    }

    // Admin folder → verify admin status
    if (this.currentFolder === 'admin') {
      try {
        const adminCheck = await API.admin.get('creator_profile/get_admin_check').json();
        this.isAdmin = adminCheck === true || adminCheck?.is_admin === true;

        if (!this.isAdmin) {
          window.location.href = AUTH_CONFIG.routes.feed;
          return;
        }
        window.isAdmin = true;
      } catch {
        window.location.href = AUTH_CONFIG.routes.feed;
        return;
      }
    }

    // /membership/* or other protected pages — access granted
  }

  _handleUnauthenticated() {
    if (this.currentFolder === 'auth') return; // Already on login page
    if (this.currentFolder === 'membership' || this.currentFolder === 'admin') {
      window.location.href = AUTH_CONFIG.routes.login;
      return;
    }
    // Public pages — do nothing
  }

  // ── Public Methods ───────────────────────────────────────
  async refresh() {
    await this.init();
  }

  logout() {
    this._clearStorage();
    this.user = null;
    this.creator = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    window.currentUser = null;
    window.creatorProfile = null;
    window.isAdmin = false;
    window.location.href = AUTH_CONFIG.routes.login;
  }

  _clearStorage() {
    localStorage.removeItem(AUTH_CONFIG.storage.authToken);
    localStorage.removeItem(AUTH_CONFIG.storage.userData);
    localStorage.removeItem(AUTH_CONFIG.storage.creatorData);
  }
}

// ─── Cross-Tab Sync ──────────────────────────────────────────
export function initCrossTabSync() {
  window.addEventListener('storage', (event) => {
    if (event.key === 'login_event') {
      const token = localStorage.getItem(AUTH_CONFIG.storage.authToken);
      if (token) window.location.href = AUTH_CONFIG.routes.feed;
    }
    if (event.key === AUTH_CONFIG.storage.authToken && !event.newValue) {
      window.location.href = AUTH_CONFIG.routes.login;
    }
  });
}
