/**
 * @fileoverview Site-wide authentication manager
 * @module core/auth
 */

import { AuthAPI, AdminAPI, PublicAPI } from './api.js';
import { API_ENDPOINTS, ROUTES, STORAGE_KEYS, debugLog } from './constants.js';
import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getUserData,
  setUserData,
  getCreatorData,
  setCreatorData,
  clearAuthData,
  triggerLoginEvent
} from './storage.js';
import { formatAvatarUrl } from '../utils/format.js';

/**
 * Get current folder from URL path
 * @returns {string|null}
 */
function getCurrentFolder() {
  const path = window.location.pathname;
  const segments = path.replace(/^\/|\/$/g, '').split('/');
  const folder = segments[0] || null;
  
  debugLog('Auth', 'Current path:', path);
  debugLog('Auth', 'Detected folder:', folder || '(root/homepage)');
  
  return folder;
}

/**
 * Authentication Manager
 * Handles authentication, routing, and user session
 */
export class AuthManager {
  constructor() {
    this.user = null;
    this.creator = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.currentFolder = getCurrentFolder();
    this.initialized = false;
  }

  /**
   * Initialize authentication
   * @returns {Promise}
   */
  async init() {
    if (this.initialized) {
      debugLog('Auth', 'Already initialized');
      return;
    }

    debugLog('Auth', 'Initializing Auth Manager...');

    const token = getAuthToken();

    if (!token) {
      debugLog('Auth', 'No auth token found');
      this.handleUnauthenticated();
      this.initialized = true;
      return;
    }

    debugLog('Auth', 'Auth token found, validating...');

    try {
      // Fetch user data and creator profile in parallel
      const [userResponse, creatorResponse] = await Promise.all([
        AuthAPI.get(API_ENDPOINTS.auth.getMe),
        PublicAPI.get(API_ENDPOINTS.feed.creatorProfile)
      ]);

      // Extract user data (handle both formats)
      const userData = userResponse.user_information || userResponse;

      this.user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar_url: formatAvatarUrl(userData.avatar_url),
        subscribed: !!userData.subscribed,
        created_at: userData.created_at
      };

      this.creator = {
        ...creatorResponse,
        avatar_url: formatAvatarUrl(creatorResponse.avatar_url),
        banner_url: creatorResponse.banner_url || ''
      };

      this.isAuthenticated = true;

      // Store in localStorage for other scripts
      setUserData(this.user);
      setCreatorData(this.creator);

      debugLog('Auth', 'User authenticated:', this.user.name);
      debugLog('Auth', 'Creator profile loaded');

      // Expose globally
      window.currentUser = this.user;
      window.creatorProfile = this.creator;

      // Handle folder-based routing
      await this.handleAuthenticated();

    } catch (error) {
      debugLog('Auth', 'Authentication failed:', error);

      // Clear invalid token
      clearAuthData();

      this.handleUnauthenticated();
    }

    this.initialized = true;
  }

  /**
   * Handle authenticated user routing
   * @returns {Promise}
   */
  async handleAuthenticated() {
    debugLog('Auth', 'Checking folder-based routing...');

    // CASE 1: User is on /auth/* pages (login, signup, etc.)
    if (this.currentFolder === 'auth') {
      debugLog('Auth', 'Authenticated user on auth page, redirecting to feed...');
      window.location.href = ROUTES.feed;
      return;
    }

    // CASE 2: User is on /admin/* pages
    if (this.currentFolder === 'admin') {
      debugLog('Auth', 'Admin folder detected, checking admin status...');

      try {
        const adminCheck = await AdminAPI.get(API_ENDPOINTS.admin.checkAdmin);
        this.isAdmin = adminCheck === true || adminCheck.is_admin === true;

        debugLog('Auth', 'Admin check result:', this.isAdmin);

        if (!this.isAdmin) {
          debugLog('Auth', 'User is not admin, redirecting to feed...');
          window.location.href = ROUTES.feed;
          return;
        }

        debugLog('Auth', 'Admin access granted');
        window.isAdmin = true;

      } catch (error) {
        debugLog('Auth', 'Admin check failed:', error);
        window.location.href = ROUTES.feed;
        return;
      }
    }

    // CASE 3: User is on /membership/* or other protected pages
    debugLog('Auth', 'User has access to current page');
  }

  /**
   * Handle unauthenticated user routing
   */
  handleUnauthenticated() {
    debugLog('Auth', 'Handling unauthenticated state...');

    // CASE 1: Already on auth pages - do nothing
    if (this.currentFolder === 'auth') {
      debugLog('Auth', 'On auth page, no redirect needed');
      return;
    }

    // CASE 2: On membership or admin pages - redirect to login
    if (this.currentFolder === 'membership' || this.currentFolder === 'admin') {
      debugLog('Auth', 'Protected page without auth, redirecting to login...');
      window.location.href = ROUTES.login;
      return;
    }

    // CASE 3: On public pages - do nothing
    debugLog('Auth', 'Public page, no redirect needed');
  }

  /**
   * Refresh user data
   * @returns {Promise}
   */
  async refresh() {
    debugLog('Auth', 'Refreshing user data...');
    this.initialized = false;
    await this.init();
  }

  /**
   * Update user data locally
   * @param {Object} updates 
   */
  updateUser(updates) {
    if (this.user) {
      this.user = { ...this.user, ...updates };
      setUserData(this.user);
      window.currentUser = this.user;
      debugLog('Auth', 'User data updated locally');
    }
  }

  /**
   * Update creator data locally
   * @param {Object} updates 
   */
  updateCreator(updates) {
    if (this.creator) {
      this.creator = { ...this.creator, ...updates };
      setCreatorData(this.creator);
      window.creatorProfile = this.creator;
      debugLog('Auth', 'Creator data updated locally');
    }
  }

  /**
   * Login (called after successful authentication)
   * @param {string} token 
   */
  login(token) {
    setAuthToken(token);
    triggerLoginEvent();
    
    debugLog('Auth', 'Login successful, redirecting...');
    window.location.href = ROUTES.feed;
  }

  /**
   * Logout
   */
  logout() {
    debugLog('Auth', 'Logging out...');

    clearAuthData();

    this.user = null;
    this.creator = null;
    this.isAuthenticated = false;
    this.isAdmin = false;

    window.currentUser = null;
    window.creatorProfile = null;
    window.isAdmin = false;

    window.location.href = ROUTES.login;
  }

  /**
   * Check if user has subscription
   * @returns {boolean}
   */
  hasSubscription() {
    return this.isAuthenticated && this.user?.subscribed === true;
  }

  /**
   * Check if user is admin
   * @returns {boolean}
   */
  isAdminUser() {
    return this.isAuthenticated && this.isAdmin === true;
  }
}

/**
 * Setup cross-tab authentication listeners
 * @param {AuthManager} authManager 
 */
export function setupAuthListeners(authManager) {
  // Listen for login events from other tabs
  window.addEventListener('storage', async (event) => {
    // Handle login from another tab
    if (event.key === STORAGE_KEYS.loginEvent) {
      debugLog('Auth', 'Login event detected from another tab');
      const token = getAuthToken();

      if (token) {
        debugLog('Auth', 'Redirecting to feed...');
        window.location.href = ROUTES.feed;
      }
    }

    // Handle logout from another tab
    if (event.key === STORAGE_KEYS.authToken && !event.newValue) {
      debugLog('Auth', 'Logout detected from another tab');
      window.location.href = ROUTES.login;
    }
  });
}

/**
 * Initialize global auth manager
 * @returns {Promise<AuthManager>}
 */
export async function initAuthManager() {
  const authManager = new AuthManager();
  await authManager.init();

  // Expose globally
  window.authManager = authManager;

  // Setup listeners
  setupAuthListeners(authManager);

  debugLog('Auth', 'Auth Manager initialized successfully');

  return authManager;
}

export default AuthManager;
