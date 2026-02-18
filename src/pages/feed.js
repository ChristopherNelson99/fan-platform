/**
 * pages/feed.js — Feed Page Entry Point
 * Place in: Feed page → Custom Code → Before </body> tag
 * ──────────────────────────────────────────────────────────────
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initFeedPageComplete } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/feed.js';
 *     initFeedPageComplete();
 *   </script>
 *
 * SAFARI FIX: Alpine 3.13.x is Safari 12+ compatible.
 *             No import map used — direct ESM URLs.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerStores } from '../stores.js';
import { registerFeedComponent } from '../feed-component.js';
import { wrapInTemplate, ensurePlyrCSS } from '../utils.js';

/**
 * Initialises everything needed for the feed page:
 * Plyr CSS, Alpine stores, the `app` component,
 * Webflow → Alpine template wrapping, and Alpine.start().
 */
export function initFeedPageComplete() {
  // 1. Inject Plyr CSS (idempotent)
  ensurePlyrCSS();

  // 2. Register Alpine stores + feed component on alpine:init
  document.addEventListener('alpine:init', () => {
    registerStores();
    registerFeedComponent();
  });

  // 3. Wrap Webflow static elements into Alpine <template x-for> loops
  //    Must happen BEFORE Alpine.start() and AFTER DOM is ready.
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

  // 4. Start Alpine
  Alpine.start();
}
