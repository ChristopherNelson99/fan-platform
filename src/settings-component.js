/**
 * settings-component.js — User Settings Page
 * Alpine `settingsPage` data component.
 * ──────────────────────────────────────────────────────────────
 * Handles: Profile editing (name, email), Stripe billing portal.
 *
 * SECURITY: All requests use JWE token. Stripe portal session is
 *           created server-side — no Stripe keys exposed.
 *
 * SAFARI FIX: Polling for window.currentUser instead of relying
 *             on script execution order (AuthManager is async and
 *             may not have populated globals when this runs).
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import { AUTH_CONFIG, SETTINGS_CONFIG } from './config.js';

export function registerSettingsPage() {
  Alpine.data('settingsPage', () => ({
    // ── State ────────────────────────────────────────────
    user: null,
    name: '',
    email: '',

    // Loading
    isPortalLoading: false,
    isNameLoading: false,
    isEmailLoading: false,

    // Success feedback
    nameSuccess: false,
    emailSuccess: false,

    // Errors
    nameError: '',
    emailError: '',
    portalError: '',

    // ── Lifecycle ────────────────────────────────────────
    init() {
      this._pollForUser();
    },

    /**
     * Polls for window.currentUser which is set asynchronously
     * by AuthManager in main-site.js. Retries every 100ms for
     * up to 5 seconds.
     */
    _pollForUser() {
      const MAX_ATTEMPTS = 50;
      let attempts = 0;

      const check = () => {
        if (window.currentUser) {
          this.user = window.currentUser;
          this.name = this.user.name || '';
          this.email = this.user.email || '';
        } else if (attempts < MAX_ATTEMPTS) {
          attempts++;
          setTimeout(check, 100);
        } else {
          console.error('[Settings] User data not available after 5s');
        }
      };

      check();
    },

    // ── Computed Getters ─────────────────────────────────
    get shouldShowPortalButton() {
      return (
        this.user &&
        this.user.subscribed &&
        this.user.id !== SETTINGS_CONFIG.creatorUserId
      );
    },

    get isNameButtonDisabled() {
      return (
        this.isNameLoading ||
        !this.name ||
        this.name === (this.user?.name || '')
      );
    },

    get isEmailButtonDisabled() {
      return (
        this.isEmailLoading ||
        !this.email ||
        this.email === (this.user?.email || '')
      );
    },

    // ── Stripe Billing Portal ────────────────────────────
    async openBillingPortal() {
      if (this.isPortalLoading) return;

      this.isPortalLoading = true;
      this.portalError = '';

      try {
        const url = await API.checkout
          .post('create_portal_session', {
            timeout: SETTINGS_CONFIG.requestTimeout,
          })
          .json();

        if (url) {
          window.location.href = url;
        } else {
          throw new Error('No portal URL returned');
        }
      } catch (error) {
        console.error('[Settings] Portal creation failed:', error);
        this.portalError = 'Failed to open billing portal. Please try again.';
        this.isPortalLoading = false;
      }
    },

    // ── Profile: Update Name ─────────────────────────────
    async updateName() {
      if (this.isNameButtonDisabled) return;

      this.isNameLoading = true;
      this.nameError = '';
      this.nameSuccess = false;

      try {
        await API.profile
          .post('user/edit_profile', {
            json: { name: this.name },
            timeout: SETTINGS_CONFIG.requestTimeout,
          })
          .json();

        this._syncGlobalUser({ name: this.name });

        this.nameSuccess = true;
        setTimeout(() => {
          this.nameSuccess = false;
        }, SETTINGS_CONFIG.successFeedbackDuration);
      } catch (error) {
        this.nameError = await this._parseError(error, 'Failed to update name');
      } finally {
        this.isNameLoading = false;
      }
    },

    // ── Profile: Update Email ────────────────────────────
    async updateEmail() {
      if (this.isEmailButtonDisabled) return;

      this.isEmailLoading = true;
      this.emailError = '';
      this.emailSuccess = false;

      try {
        await API.profile
          .post('user/edit_profile', {
            json: { email: this.email },
            timeout: SETTINGS_CONFIG.requestTimeout,
          })
          .json();

        this._syncGlobalUser({ email: this.email });

        this.emailSuccess = true;
        setTimeout(() => {
          this.emailSuccess = false;
        }, SETTINGS_CONFIG.successFeedbackDuration);
      } catch (error) {
        this.emailError = await this._parseError(error, 'Failed to update email');
      } finally {
        this.isEmailLoading = false;
      }
    },

    // ── Helpers ───────────────────────────────────────────

    /**
     * Syncs updated fields to window.currentUser and localStorage.
     * Keeps AuthManager, navbar, and other components in sync.
     */
    _syncGlobalUser(updates) {
      // Global object
      if (window.currentUser) {
        Object.assign(window.currentUser, updates);
      }

      // localStorage
      const stored = JSON.parse(
        localStorage.getItem(AUTH_CONFIG.storage.userData) || '{}',
      );
      Object.assign(stored, updates);
      localStorage.setItem(AUTH_CONFIG.storage.userData, JSON.stringify(stored));

      // Local component state
      if (this.user) {
        Object.assign(this.user, updates);
      }
    },

    /**
     * Extracts a user-friendly error message from a ky error.
     * Wraps JSON parsing in try/catch for non-JSON responses.
     */
    async _parseError(error, fallback) {
      if (error.response) {
        try {
          const data = await error.response.json();
          return data.message || fallback;
        } catch {
          return fallback;
        }
      }
      return 'Network error. Please try again.';
    },
  }));
}
