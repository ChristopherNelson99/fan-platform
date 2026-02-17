/**
 * @fileoverview Feed Page Module Entry Point
 * @module modules/feed/index
 */

import Alpine from 'alpinejs';
import { FeedState } from './state.js';
import { AuthAPI, FeedAPI, PublicAPI } from '../../core/api.js';
import { API_ENDPOINTS, ROUTES, debugLog } from '../../core/constants.js';
import { getUserData, getCreatorData } from '../../core/storage.js';
import { wrapInAlpineTemplate } from '../../utils/dom.js';
import { VideoPlayer, VideoObserver } from '../../utils/video.js';

/**
 * Initialize Feed Page
 * Integrates with Alpine.js and existing Webflow structure
 */
export async function initFeedPage() {
  debugLog('Feed', 'Initializing feed page module...');

  // Create feed state
  const feedState = new FeedState();
  const videoObserver = new VideoObserver();

  // Expose state globally for debugging
  window.feedState = feedState;

  // Configure Alpine.js components
  configureAlpine(feedState, videoObserver);

  // Wrap Webflow static elements in Alpine templates
  wrapTemplates();

  // Start Alpine.js
  Alpine.start();

  debugLog('Feed', 'Feed page initialized successfully');
}

/**
 * Configure Alpine.js stores and data
 * @param {FeedState} state 
 * @param {VideoObserver} videoObserver 
 */
function configureAlpine(state, videoObserver) {
  // Alpine Store for input management
  Alpine.store('input', {
    text: '',
    replyingTo: null,
    reset() {
      this.text = '';
      this.replyingTo = null;
    }
  });

  // Alpine Store for lightbox
  Alpine.store('app', {
    lightbox: { show: false, url: '', type: '', post: null, player: null },

    async openLightbox(post, playersMap, appRef) {
      if (post.paid && !appRef.user.subscribed) {
        return appRef.triggerError('subscription');
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

    async closeLightbox(appRef) {
      if (appRef && appRef.isDrawerOpen) {
        appRef.isDrawerOpen = false;
        appRef.handleLayoutComment();
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      if (this.lightbox.player) {
        this.lightbox.player.destroy();
        this.lightbox.player = null;
      }
      this.lightbox.show = false;
      document.body.style.overflow = '';
    }
  });

  // Main Alpine Data Component
  Alpine.data('app', () => ({
    // Initialize with state
    ...state,

    // Lifecycle
    async init() {
      this.bindEvents();

      try {
        // Load user data (from site-wide or fetch directly)
        if (window.currentUser && window.creatorProfile) {
          debugLog('Feed', 'Using data from site-wide auth');
          this.setUser(window.currentUser);
          this.setCreator(window.creatorProfile);
        } else {
          debugLog('Feed', 'Fetching user data...');
          const [userData, creatorData] = await Promise.all([
            AuthAPI.get(API_ENDPOINTS.auth.getMe),
            PublicAPI.get(API_ENDPOINTS.feed.creatorProfile)
          ]);

          const rawUser = userData.user_information || userData;
          this.setUser({
            ...rawUser,
            subscribed: !!rawUser.subscribed
          });

          if (creatorData) {
            this.setCreator(creatorData);
          }
        }

        // Load initial feed
        await this.loadFeed();

        // Handle deep links
        await this.handleDeepLink();

      } catch (e) {
        this.handleApiError(e);
      } finally {
        this.isLoading = false;
      }
    },

    // Feed Loading
    async loadFeed() {
      if (!this.hasMore || this.isLoadingMore) return;

      this.isLoadingMore = true;
      const endpoint = this.user.subscribed
        ? API_ENDPOINTS.feed.premium
        : API_ENDPOINTS.feed.unsubscribed;

      try {
        const posts = await FeedAPI.get(endpoint, {
          searchParams: { page: this.page, per_page: 10 }
        });

        if (posts && posts.length > 0) {
          this.addPosts(posts);
          this.page++;
        } else {
          this.hasMore = false;
        }
      } catch (e) {
        debugLog('Feed', 'Load feed error:', e);
      } finally {
        this.isLoadingMore = false;
      }
    },

    // Video Player Management
    initPlayer(post) {
      if (post.content_type !== 'video' || (post.paid && !this.user.subscribed)) return;

      this.$nextTick(() => {
        const el = document.querySelector(`#video-${post.id}`);
        if (!el || el.dataset.plyrInitialized) return;

        const player = new VideoPlayer(el, {
          controls: [],
          autoplay: false,
          muted: true
        });

        player.init(post.display_url);

        // Setup event listeners
        player.on('play', () => {
          this.pauseAllPlayers(post.id);
          post.isPlaying = true;
        });

        player.on('pause', () => {
          post.isPlaying = false;
        });

        player.on('volumechange', () => {
          post.isMuted = player.player.muted;
        });

        // Store player
        this.players.set(post.id, player);

        // Observe for autoplay
        videoObserver.observe(el, player);
      });
    },

    // Player Control
    pauseAllPlayers(exceptId = null) {
      this.players.forEach((player, id) => {
        if (id !== exceptId && player) player.pause();
      });

      const lbPlayer = Alpine.store('app').lightbox.player;
      if (lbPlayer && exceptId !== 'lightbox') lbPlayer.pause();
    },

    toggleMute(post) {
      const player = this.players.get(post.id);
      if (player) {
        player.toggleMute();
        post.isMuted = player.player.muted;
      }
    },

    // UI Methods (placeholder - implement based on existing HTML structure)
    bindEvents() {
      window.addEventListener('resize', () => {
        this.updateTimeDisplays();
        this.handleLayoutComment();
      });

      // Filter buttons
      ['all', 'free', 'paid'].forEach(filter => {
        const btn = document.querySelector(`[data-element="filter-${filter}"]`);
        if (btn) {
          btn.addEventListener('click', () => this.setFilter(filter));
        }
      });
    },

    handleLayoutComment() {
      const el = document.querySelector('[data-element="layout-comment"]');
      if (!el) return;

      const { innerWidth } = window;
      const shouldShow = innerWidth >= 992 || this.isDrawerOpen;
      
      if (shouldShow) {
        el.classList.remove('visibility-hidden');
      } else {
        el.classList.add('visibility-hidden');
      }
    },

    // Error Handling
    handleApiError(error) {
      debugLog('Feed', 'API Error:', error);

      if (error.status === 401) {
        this.logout();
      } else if (error.status === 403) {
        this.triggerError('subscription');
      } else if (error.status === 429) {
        this.triggerError('rate_limit');
      } else {
        this.showPopup({
          header: 'Error',
          message: error.message || 'An error occurred. Please try again.',
          btnText: 'OK',
          btnAction: () => this.hidePopup()
        });
      }
    },

    triggerError(type) {
      if (type === 'subscription') {
        this.showPopup({
          header: 'Subscription Required',
          message: 'Unlock premium content and private messages.',
          btnText: 'Subscribe',
          btnAction: () => window.location.href = ROUTES.settings + '?tab=plan'
        });
      } else if (type === 'rate_limit') {
        let countdown = 20;
        this.showPopup({
          header: 'Rate Limited',
          message: 'Please wait a moment.',
          btnText: `Wait ${countdown}s`,
          isLocked: true,
          showCloseIcon: false
        });

        const interval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            this.popup.btnText = `Wait ${countdown}s`;
          } else {
            clearInterval(interval);
            this.popup.isLocked = false;
            this.popup.btnText = 'OK';
            this.popup.btnAction = () => this.hidePopup();
          }
        }, 1000);
      }
    },

    // Cleanup
    logout() {
      this.cleanup();
      if (window.authManager) {
        window.authManager.logout();
      } else {
        window.location.href = ROUTES.login;
      }
    },

    // Note: Additional methods for comments, likes, deep linking, etc.
    // should be implemented based on your existing HTML structure
    // This is a minimal working example

    async handleDeepLink() {
      // Placeholder - implement based on URL parameters
      debugLog('Feed', 'Deep link handling not yet implemented in this minimal version');
    },

    async openComments(post, force = true) {
      // Placeholder - implement based on your comment system
      debugLog('Feed', 'Comments system not yet implemented in this minimal version');
    },

    initLightboxPlayer() {
      // Placeholder - implement based on your lightbox structure
      debugLog('Feed', 'Lightbox player not yet implemented in this minimal version');
    }
  }));
}

/**
 * Wrap Webflow static elements in Alpine templates
 */
function wrapTemplates() {
  wrapInAlpineTemplate(
    '[x-template="feed-item"]',
    'post in (currentFilter === "all" ? feed : feed.filter(p => currentFilter === "paid" ? p.paid : !p.paid))',
    'post.id'
  );

  wrapInAlpineTemplate(
    '[x-template="comment-item"]',
    'comment in (activePost ? activePost.comments : [])',
    'comment.id'
  );

  wrapInAlpineTemplate(
    '[x-template="reply-item"]',
    '(reply, index) in comment.replies',
    'reply.id'
  );
}

export default initFeedPage;
