/**
 * @fileoverview Complete Feed Page Module with all managers
 * @module modules/feed/complete
 */

import Alpine from 'alpinejs';
import { FeedState } from './state.js';
import { CommentsManager } from './comments.js';
import { InteractionsManager } from './interactions.js';
import { AuthAPI, FeedAPI, PublicAPI, CheckoutAPI } from '../../core/api.js';
import { API_ENDPOINTS, ROUTES, debugLog } from '../../core/constants.js';
import { wrapInAlpineTemplate } from '../../utils/dom.js';
import { VideoPlayer, VideoObserver, pauseAllPlayers } from '../../utils/video.js';
import { formatNumber } from '../../utils/format.js';

/**
 * Initialize Complete Feed Page with all features
 */
export async function initFeedPageComplete() {
  debugLog('Feed', 'Initializing complete feed page module...');

  // Create state and managers
  const feedState = new FeedState();
  const videoObserver = new VideoObserver();
  const commentsManager = new CommentsManager(feedState);
  const interactionsManager = new InteractionsManager(feedState, commentsManager);

  // Expose globally for debugging
  window.feedState = feedState;
  window.commentsManager = commentsManager;
  window.interactionsManager = interactionsManager;

  // Configure Alpine.js
  configureAlpineComplete(feedState, videoObserver, commentsManager, interactionsManager);

  // Wrap templates
  wrapTemplates();

  // Start Alpine.js
  Alpine.start();

  debugLog('Feed', 'Complete feed page initialized successfully');
}

/**
 * Configure Alpine.js with all features
 */
function configureAlpineComplete(state, videoObserver, commentsManager, interactionsManager) {
  // Input store
  Alpine.store('input', {
    text: '',
    replyingTo: null,
    reset() {
      this.text = '';
      this.replyingTo = null;
    }
  });

  // App store for lightbox
  Alpine.store('app', {
    lightbox: { show: false, url: '', type: '', post: null, player: null },

    async openLightbox(post, playersMap, appRef) {
      if (post.paid && !appRef.user.subscribed) {
        return appRef.triggerError('subscription');
      }

      pauseAllPlayers(playersMap);

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
    // Spread state
    ...state,

    // Managers
    commentsManager,
    interactionsManager,

    // Init
    async init() {
      this.bindEvents();

      try {
        // Load user data
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
          this.setUser({ ...rawUser, subscribed: !!rawUser.subscribed });
          if (creatorData) this.setCreator(creatorData);
        }

        // Load feed
        await this.loadFeed();

        // Handle deep links
        await interactionsManager.handleDeepLink();

      } catch (e) {
        this.handleApiError(e);
      } finally {
        this.isLoading = false;
      }
    },

    // Feed management
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

    // Video players
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

        player.on('play', () => {
          this.pauseAllPlayers(post.id);
          post.isPlaying = true;
        });
        player.on('pause', () => post.isPlaying = false);
        player.on('volumechange', () => post.isMuted = player.player.muted);

        this.players.set(post.id, player);
        videoObserver.observe(el, player);
      });
    },

    initLightboxPlayer() {
      this.$nextTick(() => {
        const el = document.querySelector('#video-lightbox');
        if (!el) return;

        const player = new VideoPlayer(el, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
          autoplay: true,
          muted: false
        });

        player.init(Alpine.store('app').lightbox.url);
        player.on('play', () => this.pauseAllPlayers('lightbox'));
        player.on('ready', () => {
          player.player.muted = false;
          player.player.volume = 1;
        });

        Alpine.store('app').lightbox.player = player;
      });
    },

    pauseAllPlayers(exceptId = null) {
      pauseAllPlayers(this.players, exceptId);
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

    // Interactions
    toggleLike(post) {
      interactionsManager.toggleLike(post).catch(e => this.handleApiError(e));
    },

    toggleBookmark(post) {
      interactionsManager.toggleBookmark(post).catch(e => this.handleApiError(e));
    },

    shareContent(post) {
      interactionsManager.shareContent(post);
    },

    // Comments
    async openComments(post, force = true) {
      this.activePost = post;
      Alpine.store('input').reset();

      if (force) {
        this.isDrawerOpen = true;
        this.handleLayoutComment();
      }

      if (!post.commentsLoaded) {
        try {
          await commentsManager.loadComments(post);
        } catch (e) {
          this.handleApiError(e);
        }
      }
    },

    async postComment() {
      const store = Alpine.store('input');
      if (!this.activePost || !store.text.trim()) return;

      try {
        await commentsManager.postComment(
          this.activePost,
          store.text,
          store.replyingTo?.id
        );
        store.reset();
        this.showEmojiPicker = false;
        this.showLightboxEmojiPicker = false;
      } catch (e) {
        this.handleApiError(e);
      }
    },

    toggleCommentLike(comment) {
      commentsManager.toggleCommentLike(comment).catch(e => this.handleApiError(e));
    },

    toggleReplies(comment) {
      commentsManager.toggleReplies(comment);
    },

    startReply(post, comment) {
      const targetUser = commentsManager.getCommentUser(post, comment.user_id);
      Alpine.store('input').replyingTo = { id: comment.id, name: targetUser.name };
    },

    getCommentUser(post, userId) {
      return commentsManager.getCommentUser(post, userId);
    },

    renderMergedContent(post, userId, text) {
      return commentsManager.renderMergedContent(post, userId, text);
    },

    // Emoji picker
    async toggleEmojiPicker(isLightbox = false) {
      await commentsManager.toggleEmojiPicker(isLightbox);
      commentsManager.setupEmojiPickerListener(isLightbox);
    },

    insertEmojiAtCursor(emoji, isLightbox = false) {
      commentsManager.insertEmoji(emoji, isLightbox);
    },

    // Checkout
    async handleStripeCheckout(priceId, mode) {
      this.showPopup({
        header: 'Processing',
        message: 'Redirecting to checkout...',
        isLocked: true,
        showCloseIcon: false,
        btnText: 'Loading...'
      });

      try {
        const response = await CheckoutAPI.post(API_ENDPOINTS.checkout.createSession, {
          json: { price_id: priceId, mode: mode }
        });

        if (response.url) {
          window.location.href = response.url;
        }
      } catch (e) {
        this.handleApiError(e);
      }
    },

    // UI helpers
    handleMediaClick(post) {
      Alpine.store('app').openLightbox(post, this.players, this);
    },

    closeDrawer() {
      this.isDrawerOpen = false;
      this.handleLayoutComment();
    },

    handleLayoutComment() {
      const el = document.querySelector('[data-element="layout-comment"]');
      if (!el) return;
      
      const shouldShow = window.innerWidth >= 992 || this.isDrawerOpen;
      if (shouldShow) {
        el.classList.remove('visibility-hidden');
      } else {
        el.classList.add('visibility-hidden');
      }
    },

    formatNumber(n) {
      return formatNumber(n);
    },

    // Error handling
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

    // Lifecycle
    logout() {
      this.cleanup();
      if (window.authManager) {
        window.authManager.logout();
      } else {
        window.location.href = ROUTES.login;
      }
    },

    bindEvents() {
      window.addEventListener('resize', () => {
        this.updateTimeDisplays();
        this.handleLayoutComment();
      });

      ['all', 'free', 'paid'].forEach(filter => {
        const btn = document.querySelector(`[data-element="filter-${filter}"]`);
        if (btn) {
          btn.addEventListener('click', () => {
            this.setFilter(filter);
            document.querySelectorAll('.filter_button').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
          });
        }
      });

      const logoutBtn = document.querySelector('[data-element="log-out"]');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.logout();
        });
      }

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-checkout="trigger"]');
        if (btn) {
          this.handleStripeCheckout(btn.dataset.price, btn.dataset.mode);
        }
      });
    }
  }));
}

/**
 * Wrap Webflow elements in Alpine templates
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

export default initFeedPageComplete;
