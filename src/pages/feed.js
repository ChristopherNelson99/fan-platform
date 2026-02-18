/**
 * pages/feed.js — Feed Page Entry Point
 * Place in: Feed page → Custom Code → Before </body> tag
 * ──────────────────────────────────────────────────────────────
 * Registers Alpine stores, the feed component, wraps Webflow
 * templates, then starts Alpine.
 *
 * SAFARI FIX: Alpine 3.13.x is Safari 12+ compatible.
 *             Import map is NOT used — direct ESM URLs instead.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerStores } from '../stores.js';
import { registerFeedComponent } from '../feed-component.js';
import { wrapInTemplate, ensurePlyrCSS } from '../utils.js';

// ── Plyr CSS (idempotent) ────────────────────────────────────
ensurePlyrCSS();

// ── Alpine Setup ─────────────────────────────────────────────
document.addEventListener('alpine:init', () => {
  // 1. Register global stores (input, app/lightbox)
  registerStores();

  // 2. Register the `app` data component
  registerFeedComponent();
});

// ── Webflow → Alpine Template Wrapping ───────────────────────
// Must happen BEFORE Alpine.start() and AFTER DOM is ready.
wrapInTemplate(
  '[x-template="reply-item"]',
  '(reply, index) in comment.replies',
  'reply.id',
);

wrapInTemplate(
  '[x-template="comment-item"]',
  'comment in (activePost ? activePost.comments : [])',
  'comment.id',
);

wrapInTemplate(
  '[x-template="feed-item"]',
  'post in (currentFilter === "all" ? feed : feed.filter(p => currentFilter === "paid" ? p.paid : !p.paid))',
  'post.id',
);

// ── Start Alpine ─────────────────────────────────────────────
Alpine.start();
