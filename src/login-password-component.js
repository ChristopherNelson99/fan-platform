/**
 * login-password-component.js — Email + Password Login Form
 * Alpine `loginForm` data component (password variant).
 * ──────────────────────────────────────────────────────────────
 * ALTERNATIVE to login-component.js (magic link).
 * Use this when the Xano auth is configured for email + password.
 *
 * FLOW: 1. User enters email + password
 *       2. POST to /auth/login with { email, password }
 *       3. Receives auth_token + user data
 *       4. Stores in localStorage
 *       5. Fires cross-tab login event
 *       6. Redirects to /membership/feed
 *
 * SECURITY: Honeypot field silently rejects bots.
 *           Password is sent over HTTPS to Xano (never stored client-side).
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import { AUTH_CONFIG } from './config.js';

export function registerLoginPasswordForm() {
  Alpine.data('loginForm', () => ({
    // ── State ────────────────────────────────────────────
    email: '',
    password: '',
    company: '',            // Honeypot — hidden from real users
    showPassword: false,
    loading: false,
    status: 'idle',         // 'idle' | 'success' | 'error'
    errorMessage: '',

    // ── Lifecycle ────────────────────────────────────────
    init() {
      if (this.$refs.submitButton) {
        this.$refs.submitButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.submit();
        });
      }
    },

    // ── Submit Handler ───────────────────────────────────
    async submit() {
      // 1. Honeypot — silent rejection
      if (this.company.length > 0) {
        this.status = 'success';
        return;
      }

      // 2. Validation
      if (!this.email || !this.email.includes('@')) {
        this._setError('Please enter a valid email address.');
        return;
      }
      if (!this.password || this.password.length < 6) {
        this._setError('Password must be at least 6 characters.');
        return;
      }

      this.loading = true;
      this.status = 'idle';
      this.errorMessage = '';

      try {
        // 3. Authenticate via Xano
        const response = await API.auth
          .post('auth/login', {
            json: { email: this.email, password: this.password },
          })
          .json();

        // 4. Store auth data
        // Xano typically returns { authToken, ... } or { auth_token, ... }
        const token = response.authToken || response.auth_token;
        const userData = response.user_information || response.user || response;

        if (!token) {
          throw new Error('No auth token in response');
        }

        localStorage.setItem(AUTH_CONFIG.storage.authToken, token);
        localStorage.setItem(
          AUTH_CONFIG.storage.userData,
          JSON.stringify(userData),
        );

        // 5. Cross-tab login event
        localStorage.setItem('login_event', Date.now());

        // 6. Redirect to feed
        this.status = 'success';
        window.location.href = AUTH_CONFIG.routes.feed;
      } catch (error) {
        this.status = 'error';

        if (error.response) {
          try {
            const data = await error.response.json();
            this.errorMessage =
              data.message || data.payload || 'Invalid email or password.';
          } catch {
            this.errorMessage = 'Invalid email or password.';
          }
        } else {
          this.errorMessage = 'Network error. Please try again.';
        }
      } finally {
        this.loading = false;
      }
    },

    // ── Helper ───────────────────────────────────────────
    _setError(msg) {
      this.status = 'error';
      this.errorMessage = msg;
    },
  }));
}
