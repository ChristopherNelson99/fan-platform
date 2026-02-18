/**
 * stores.js — Alpine Global Stores
 * Shared state for comment input and lightbox.
 * ──────────────────────────────────────────────────────────────
 * Registered during `alpine:init` event, before Alpine.start().
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';

export function registerStores() {
  // ── Comment Input Store ────────────────────────────────
  Alpine.store('input', {
    text: '',
    replyingTo: null,

    reset() {
      this.text = '';
      this.replyingTo = null;
    },
  });

  // ── App / Lightbox Store ───────────────────────────────
  Alpine.store('app', {
    lightbox: {
      show:   false,
      url:    '',
      type:   '',
      post:   null,
      player: null,
    },

    /**
     * Opens the lightbox for a given post.
     *
     * @param {object}  post       - The post object.
     * @param {Map}     playersMap - Map of feed player instances.
     * @param {object}  appRef     - The Alpine `app` component data.
     */
    async openLightbox(post, playersMap, appRef) {
      if (post.paid && !appRef.user.subscribed) {
        appRef.triggerError('subscription');
        return;
      }

      appRef.pauseAllPlayers();

      this.lightbox.type = post.content_type;
      this.lightbox.url = post.display_url;
      this.lightbox.post = post;
      this.lightbox.show = true;
      document.body.style.overflow = 'hidden';

      await appRef.openComments(post, true);
      if (post.content_type === 'video') appRef.initLightboxPlayer();
    },

    /**
     * Closes the lightbox and cleans up the player.
     *
     * @param {object} appRef - The Alpine `app` component data.
     */
    async closeLightbox(appRef) {
      // Close drawer first if open
      if (appRef?.isDrawerOpen) {
        appRef.isDrawerOpen = false;
        appRef.handleLayoutComment();
        await new Promise((r) => setTimeout(r, 350));
      }

      if (this.lightbox.player) {
        this.lightbox.player.destroy();
        this.lightbox.player = null;
      }

      this.lightbox.show = false;
      document.body.style.overflow = '';
    },
  });
}
