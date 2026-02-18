/**
 * pages/profile.js — Profile Page Entry Point
 * ──────────────────────────────────────────────────────────────
 * Reuses the same Alpine `app` component as the feed page,
 * configured with PROFILE_CONFIG (different endpoints + filters).
 *
 * Differences from feed:
 *   - Endpoints: get_profile_feed_premium / get_profile_feed_unsubbed
 *   - Filters:   liked / bookmarked (toggle) instead of paid / free
 *
 * Usage in Webflow HTML Embed:
 *
 *   <script type="module">
 *     import { initProfilePage } from
 *       'https://cdn.jsdelivr.net/gh/ChristopherNelson99/fan-platform@main/src/pages/profile.js';
 *     initProfilePage();
 *   </script>
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { registerStores } from '../stores.js';
import { registerProfileComponent } from '../feed-component.js';
import { wrapInTemplate, ensurePlyrCSS } from '../utils.js';

export function initProfilePage() {
  // 1. Inject Plyr CSS
  ensurePlyrCSS();

  // 2. Register Alpine stores + profile component
  document.addEventListener('alpine:init', () => {
    registerStores();
    registerProfileComponent();
  });

  // 3. Wrap Webflow static elements into Alpine loops
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

  // Profile-specific filter: liked / bookmarked / all
  wrapInTemplate(
    '[x-template="feed-item"]',
    `post in (
      currentFilter === 'liked'      ? feed.filter(p => p.is_liked) :
      currentFilter === 'bookmarked' ? feed.filter(p => p.is_bookmarked) :
      feed
    )`,
    'post.id',
  );

  // 4. Start Alpine
  Alpine.start();
}
