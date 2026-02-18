/**
 * login-component.js — Magic Link Login Form
 * Alpine `loginForm` data component.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: Honeypot field silently rejects bots without revealing
 *           detection. No auth tokens are sent — this is a
 *           pre-authentication page.
 *
 * SAFARI FIX: Uses ky's `.json()` which handles Safari's stricter
 *             CORS pre-flight for JSON POST requests.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';

// ═══════════════════════════════════════════════════════════════
// ALPINE DATA: loginForm
// ═══════════════════════════════════════════════════════════════
export function registerLoginForm() {
  Alpine.data('loginForm', () => ({
    // ── State ────────────────────────────────────────────
    email: '',
    company: '',            // Honeypot — hidden from real users
    rememberMe: true,
    loading: false,
    status: 'idle',         // 'idle' | 'success' | 'error'
    errorMessage: '',
    successMessage: '',

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
      // 1. Honeypot check — silent rejection
      if (this.company.length > 0) {
        this.status = 'success';
        this.successMessage = `Check your inbox! We've sent a login link to ${this.email}.`;
        return;
      }

      // 2. Basic validation
      if (!this.email || !this.email.includes('@')) {
        this.status = 'error';
        this.errorMessage = 'Please enter a valid email address.';
        return;
      }

      this.loading = true;
      this.status = 'idle';
      this.errorMessage = '';

      try {
        // 3. Send magic link via Xano (unauthenticated endpoint)
        await API.auth
          .post('auth/send_magic_link', { json: { email: this.email } })
          .json();

        this.status = 'success';
        this.successMessage = `Check your inbox! We've sent a login link to ${this.email}.`;
        localStorage.setItem('remember_me_preference', this.rememberMe);
      } catch (error) {
        this.status = 'error';

        if (error.response) {
          try {
            const data = await error.response.json();
            this.errorMessage = data.message || 'Error sending link.';
          } catch {
            this.errorMessage = 'Error sending link.';
          }
        } else {
          this.errorMessage = 'Network error. Please try again.';
        }
      } finally {
        this.loading = false;
      }
    },
  }));
}
