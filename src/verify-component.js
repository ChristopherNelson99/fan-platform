/**
 * verify-component.js — Magic Link Verification Handler
 * Alpine `verifyHandler` data component.
 * ──────────────────────────────────────────────────────────────
 * FLOW: 1. Page loads with ?token=xxx in URL
 *       2. Auto-verifies token against Xano
 *       3. Saves authToken + userData to localStorage
 *       4. Fires cross-tab login event
 *       5. Redirects to /membership/feed
 *
 *       If no token in URL, shows a "request new link" form.
 *
 * SECURITY: Honeypot on the resend form. Token validated server-side.
 *           localStorage keys match AuthManager conventions.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import { AUTH_CONFIG } from './config.js';

export function registerVerifyHandler() {
  Alpine.data('verifyHandler', () => ({
    // ── UI States ────────────────────────────────────────
    isVerifying: false,
    isRedirecting: false,
    verificationSuccess: false,
    loading: false,           // For resend form
    status: 'idle',           // 'idle' | 'success' | 'error'

    // ── Data ─────────────────────────────────────────────
    email: '',
    company: '',              // Honeypot
    errorMessage: '',
    successMessage: '',

    // ── Lifecycle ────────────────────────────────────────
    async init() {
      // Bind fallback submit button
      if (this.$refs.submitButton) {
        this.$refs.submitButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.requestNewLink();
        });
      }

      // Auto-verify if token is in URL
      const token = new URLSearchParams(window.location.search).get('token');
      if (token) {
        await this._verifyToken(token);
      }
    },

    // ── Token Verification ───────────────────────────────
    async _verifyToken(token) {
      this.isVerifying = true;
      this.errorMessage = '';

      try {
        const response = await API.auth
          .post('auth/verify_magic_link', { json: { magic_token: token } })
          .json();

        // Success — store auth data
        this.isVerifying = false;
        this.isRedirecting = true;
        this.verificationSuccess = true;

        localStorage.setItem(AUTH_CONFIG.storage.authToken, response.auth_token);
        localStorage.setItem(
          AUTH_CONFIG.storage.userData,
          JSON.stringify(response.user_information),
        );

        // Cross-tab login event
        localStorage.setItem('login_event', Date.now());

        // Redirect after brief transition
        setTimeout(() => {
          window.location.href = AUTH_CONFIG.routes.feed;
        }, 1000);
      } catch (error) {
        this.isVerifying = false;
        this.isRedirecting = false;
        this.verificationSuccess = false;
        this.status = 'error';

        if (error.response) {
          try {
            const data = await error.response.json();
            this.errorMessage =
              data.payload || data.message || 'Verification link is invalid or expired.';
          } catch {
            this.errorMessage = 'An error occurred during verification.';
          }
        } else {
          this.errorMessage = 'Connection error. Please try again.';
        }
      }
    },

    // ── Resend Magic Link ────────────────────────────────
    async requestNewLink() {
      // Honeypot
      if (this.company.length > 0) {
        this.status = 'success';
        this.successMessage = 'If an account exists, a new link has been sent!';
        return;
      }

      // Validation
      if (!this.email || !this.email.includes('@')) {
        this.status = 'error';
        this.errorMessage = 'Please enter a valid email.';
        return;
      }

      this.loading = true;
      this.status = 'idle';
      this.errorMessage = '';

      try {
        await API.auth
          .post('auth/send_magic_link', { json: { email: this.email } })
          .json();

        this.status = 'success';
        this.successMessage = `A new magic link has been sent to ${this.email}.`;
      } catch {
        this.status = 'error';
        this.errorMessage = 'Failed to send new link. Please try again later.';
      } finally {
        this.loading = false;
      }
    },
  }));
}
