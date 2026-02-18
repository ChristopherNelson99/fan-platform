/**
 * signup-component.js — Magic Link Signup Form
 * Alpine `signupForm` data component.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: Honeypot field silently rejects bots.
 *           Terms acceptance enforced client-side (server should
 *           also validate).
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';

export function registerSignupForm() {
  Alpine.data('signupForm', () => ({
    // ── State ────────────────────────────────────────────
    name: '',
    email: '',
    acceptTerms: false,
    company: '',            // Honeypot — hidden from real users
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
      // 1. Honeypot — silent rejection
      if (this.company.length > 0) {
        this.status = 'success';
        this.successMessage = 'Welcome! Check your email to verify your account.';
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
      if (!this.acceptTerms) {
        this._setError('You must accept the Terms & Conditions to join.');
        return;
      }

      this.loading = true;
      this.status = 'idle';
      this.errorMessage = '';

      try {
        // 3. Signup via Xano (unauthenticated endpoint)
        await API.auth
          .post('auth/signup', { json: { name: this.name, email: this.email } })
          .json();

        this.status = 'success';
        this.successMessage = `Account created! We've sent a magic link to ${this.email} to verify your account.`;
      } catch (error) {
        this.status = 'error';

        if (error.response) {
          try {
            const data = await error.response.json();
            this.errorMessage = data.message || 'Signup failed. Please try again.';
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
