/**
 * signup-password-component.js — Email + Password Signup Form
 * Alpine `signupForm` data component (password variant).
 * ──────────────────────────────────────────────────────────────
 * ALTERNATIVE to signup-component.js (magic link).
 * Use this when the Xano auth is configured for email + password.
 *
 * FLOW: 1. User enters name, email, password, confirms password
 *       2. POST to /auth/signup with { name, email, password }
 *       3. Receives auth_token + user data
 *       4. Stores in localStorage
 *       5. Fires cross-tab login event
 *       6. Redirects to /membership/feed
 *
 * SECURITY: Honeypot field silently rejects bots.
 *           Terms acceptance enforced client-side (server should also validate).
 *           Password confirmation checked before sending to API.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import { AUTH_CONFIG } from './config.js';

export function registerSignupPasswordForm() {
  Alpine.data('signupForm', () => ({
    // ── State ────────────────────────────────────────────
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
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
      if (!this.name.trim()) {
        this._setError('Please enter your name.');
        return;
      }
      if (!this.email || !this.email.includes('@')) {
        this._setError('Please enter a valid email address.');
        return;
      }
      if (!this.password || this.password.length < 6) {
        this._setError('Password must be at least 6 characters.');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this._setError('Passwords do not match.');
        return;
      }
      if (!this.acceptTerms) {
        this._setError('You must accept the Terms & Conditions to join.');
        return;
      }

      this.loading = true;
      this.status = 'idle';
      this.errorMessage = '';

      try {
        // 3. Signup via Xano
        const response = await API.auth
          .post('auth/signup', {
            json: {
              name: this.name,
              email: this.email,
              password: this.password,
            },
          })
          .json();

        // 4. Store auth data
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

        // 5. Fetch + cache creator profile so feed page loads instantly
        try {
          const creatorData = await API.public
            .get('get_creator_profile')
            .json();
          localStorage.setItem(
            AUTH_CONFIG.storage.creatorData,
            JSON.stringify(creatorData),
          );
        } catch {
          // Non-fatal — feed page tier 3 will retry
        }

        // 6. Cross-tab login event
        localStorage.setItem('login_event', Date.now());

        // 7. Redirect to feed
        this.status = 'success';
        window.location.href = AUTH_CONFIG.routes.feed;
      } catch (error) {
        this.status = 'error';

        if (error.response) {
          try {
            const data = await error.response.json();
            this.errorMessage =
              data.message || data.payload || 'Signup failed. Please try again.';
          } catch {
            this.errorMessage = 'An unexpected error occurred.';
          }
        } else {
          this.errorMessage = 'Network error. Please check your connection.';
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
