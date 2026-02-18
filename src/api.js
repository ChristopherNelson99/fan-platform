/**
 * api.js — API Client Factory
 * Creates authenticated ky instances for each Xano API group.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: Auth tokens are injected via beforeRequest hooks.
 *           Never expose admin keys in client-side code.
 * SAFARI:   ky@1.7.2 works in Safari 14+ (uses native fetch).
 */

import ky from 'https://esm.sh/ky@1.7.2';
import { API_PREFIXES, AUTH_CONFIG } from './config.js';

// ─── Auth Header Injection ───────────────────────────────────
const addAuth = (request) => {
  const token = localStorage.getItem(AUTH_CONFIG.storage.authToken);
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
};

// ─── API Instances ───────────────────────────────────────────
// Each instance is scoped to its Xano API group with auth where needed.

export const API = {
  auth: ky.create({
    prefixUrl: API_PREFIXES.auth,
    hooks: { beforeRequest: [addAuth] },
  }),

  feed: ky.create({
    prefixUrl: API_PREFIXES.feed,
    hooks: { beforeRequest: [addAuth] },
  }),

  comment: ky.create({
    prefixUrl: API_PREFIXES.comment,
    hooks: { beforeRequest: [addAuth] },
  }),

  public: ky.create({
    prefixUrl: API_PREFIXES.public,
  }),

  checkout: ky.create({
    prefixUrl: API_PREFIXES.checkout,
    hooks: { beforeRequest: [addAuth] },
  }),

  admin: ky.create({
    prefixUrl: API_PREFIXES.admin,
    hooks: { beforeRequest: [addAuth] },
  }),
};

// ─── Standalone authenticated fetch (for notification system, etc.) ──
export const authenticatedKy = ky.create({
  hooks: { beforeRequest: [addAuth] },
});

export default API;
