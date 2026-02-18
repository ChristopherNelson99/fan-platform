/**
 * feed-component.js — Alpine `app` Data Component
 * The core feed page logic: loading posts, comments, likes,
 * bookmarks, video playback, and deep-linking.
 * ──────────────────────────────────────────────────────────────
 * SAFARI FIX: Native HLS via player.js, no top-level await.
 * MOBILE FIX: Debounced resize, throttled scroll for infinite load.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import {
  PLACEHOLDER,
  TRANSPARENT_PIXEL,
  FEED_CONFIG,
  PROFILE_CONFIG,
  SETTINGS_CONFIG,
} from './config.js';
import {
  dayjs,
  formatAvatar,
  formatNumber,
  timeAgoDisplay,
  timeAgoShort,
  debounce,
  isDesktop,
} from './utils.js';
import { initFeedPlayer, initLightboxPlayer } from './player.js';

// ─── Private Module State ────────────────────────────────────
// Stored outside Alpine to avoid Proxy-wrapping Picmo instances.
let drawerPickerInstance = null;
let lightboxPickerInstance = null;

// ─── Component Registration ─────────────────────────────────

/**
 * Factory: creates the Alpine `app` data component with page-specific config.
 * @param {object} pageConfig - FEED_CONFIG or PROFILE_CONFIG from config.js
 */
function createFeedComponent(pageConfig) {
  return () => ({
    // ── Page Config (used by loadFeed, deepLink, filters) ──
    _pageConfig: pageConfig,

    // ── Reactive State ───────────────────────────────────
    user: {
      id: null,
      name: '',
      avatar_url: TRANSPARENT_PIXEL,
      subscribed: false,
    },
    creator: {
      avatar_url: TRANSPARENT_PIXEL,
      banner_url: TRANSPARENT_PIXEL,
      caption: '',
      post_count: 0,
      follower_count: 0,
    },
    feed: [],
    activePost: null,
    isDrawerOpen: false,
    currentFilter: 'all',
    isLoading: true,
    isAuthenticated: true,
    popup: {
      show: false,
      header: '',
      message: '',
      btnText: '',
      btnAction: null,
      isLocked: false,
      showCloseIcon: true,
    },
    page: 1,
    hasMore: true,
    showPicker: false,
    showLightboxPicker: false,

    // ── Bio Editing (Creator Only) ────────────────────────
    isEditingBio: false,
    editBioText: '',
    isBioSaving: false,
    bioError: '',

    players: new Map(),
    observers: new Map(),
    _hlsInstances: new Map(),

    // ── Lifecycle ────────────────────────────────────────
    async init() {
      this._bindEvents();

      try {
        await this._loadUserData();
        await this.loadFeed();
        await this._handleDeepLink();
      } catch (e) {
        this._handleApiError(e);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Loads user + creator data from globals, localStorage, or API.
     * Priority: window globals > localStorage > fresh fetch.
     */
    async _loadUserData() {
      // Priority 1: From site-wide AuthManager globals (fastest)
      if (window.currentUser && window.creatorProfile) {
        this.user = {
          ...window.currentUser,
          avatar_url: formatAvatar(window.currentUser.avatar_url),
        };
        this.creator = {
          ...window.creatorProfile,
          avatar_url: formatAvatar(window.creatorProfile.avatar_url),
          banner_url: window.creatorProfile.banner_url || PLACEHOLDER,
        };
        return;
      }

      // Priority 2: From localStorage (both must exist)
      const storedUser = localStorage.getItem('userData');
      const storedCreator = localStorage.getItem('creatorData');

      if (storedUser && storedCreator) {
        const u = JSON.parse(storedUser);
        const c = JSON.parse(storedCreator);
        this.user = { ...u, avatar_url: formatAvatar(u.avatar_url) };
        this.creator = {
          ...c,
          avatar_url: formatAvatar(c.avatar_url),
          banner_url: c.banner_url || PLACEHOLDER,
        };
        return;
      }

      // Priority 3: Fresh fetch from API (first load after login)
      // This handles the case where verify page stored authToken +
      // userData but NOT creatorData, and AuthManager hasn't finished.
      try {
        const [userRes, creatorRes] = await Promise.all([
          API.auth.get('auth/get/me').json(),
          API.public.get('get_creator_profile').json(),
        ]);

        const raw = userRes.user_information || userRes;
        this.user = {
          ...raw,
          avatar_url: formatAvatar(raw.avatar_url),
          subscribed: !!raw.subscribed,
        };

        if (creatorRes) {
          this.creator = {
            ...creatorRes,
            avatar_url: formatAvatar(creatorRes.avatar_url),
            banner_url: creatorRes.banner_url || PLACEHOLDER,
          };
          // Cache for next load so Priority 2 works
          localStorage.setItem('creatorData', JSON.stringify(creatorRes));
        }

        // Also cache user data if not already stored
        if (!storedUser) {
          localStorage.setItem('userData', JSON.stringify(raw));
        }
      } catch (e) {
        console.error('[Feed] Failed to fetch user data:', e);
        throw e; // Let init() handle via _handleApiError
      }
    },

    // ── Keep for backward-compat with HTML bindings ──────
    formatAvatar,
    formatNumber,

    // ── Feed Loading ─────────────────────────────────────
    async loadFeed() {
      if (!this.hasMore) return;

      const ep = this.user.subscribed
        ? this._pageConfig.endpoints.premium
        : this._pageConfig.endpoints.unsubbed;

      try {
        const res = await API.feed
          .get(ep, { searchParams: { page: this.page, per_page: this._pageConfig.perPage } })
          .json();

        if (res.length > 0) {
          const mapped = res.map((item) => ({
            ...item,
            isPlaying: false,
            isMuted: true,
            timeAgoDisplay: timeAgoDisplay(item.created_at),
            commentsLoaded: false,
            comments: [],
            commentUsers: {},
          }));
          this.feed = [...this.feed, ...mapped];
          this.page++;
        } else {
          this.hasMore = false;
        }
      } catch (e) {
        console.error('[Feed] Load failed:', e);
      }
    },

    // ── Deep Linking (?content_id=&comment_id=) ──────────
    async _handleDeepLink() {
      const params = new URLSearchParams(window.location.search);
      const contentId = params.get('content_id');
      const commentId = params.get('comment_id');
      if (!contentId) return;

      let post = this.feed.find((p) => p.id === parseInt(contentId, 10));

      if (!post) {
        try {
          const ep = this.user.subscribed
            ? this._pageConfig.endpoints.premium
            : this._pageConfig.endpoints.unsubbed;
          const response = await API.feed
            .get(ep, { searchParams: { page: 1, per_page: 50 } })
            .json();
          const fetched = response.find((p) => p.id === parseInt(contentId, 10));

          if (fetched) {
            post = {
              ...fetched,
              isPlaying: false,
              isMuted: true,
              timeAgoDisplay: timeAgoDisplay(fetched.created_at),
              commentsLoaded: false,
              comments: [],
              commentUsers: {},
            };
            this.feed.unshift(post);
          } else {
            this.popup = {
              show: true,
              header: 'Content Not Found',
              message: 'This post may have been deleted or is no longer available.',
              btnText: 'OK',
              isLocked: false,
              showCloseIcon: true,
              btnAction: () => (this.popup.show = false),
            };
            return;
          }
        } catch {
          return;
        }
      }

      if (post) {
        await Alpine.store('app').openLightbox(post, this.players, this);

        if (commentId) {
          await this.$nextTick();
          setTimeout(() => {
            const el = document.querySelector(`[data-comment-id="${commentId}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.backgroundColor = 'rgba(77, 101, 255, 0.2)';
              setTimeout(() => (el.style.backgroundColor = ''), 2000);
            }
          }, 600);
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }
    },

    // ── Video Player Management ──────────────────────────
    pauseAllPlayers(exceptId = null) {
      this.players.forEach((p, id) => {
        if (id !== exceptId) p.pause();
      });
      const lb = Alpine.store('app').lightbox.player;
      if (lb && exceptId !== 'lightbox') lb.pause();
    },

    initPlayer(post) {
      if (post.content_type !== 'video') return;
      if (post.paid && !this.user.subscribed) return;

      this.$nextTick(() => {
        const el = document.querySelector(`#video-${post.id}`);
        if (!el || el.dataset.plyrInitialized) return;

        const result = initFeedPlayer(
          el,
          post.display_url,
          post,
          (exceptId) => this.pauseAllPlayers(exceptId),
        );

        if (result) {
          this.players.set(post.id, result.player);
          this.observers.set(post.id, result.observer);
          if (result.hls) this._hlsInstances.set(post.id, result.hls);
        }
      });
    },

    initLightboxPlayer() {
      this.$nextTick(() => {
        const el = document.querySelector('#video-lightbox');
        if (!el) return;

        const player = initLightboxPlayer(
          el,
          Alpine.store('app').lightbox.url,
          (exceptId) => this.pauseAllPlayers(exceptId),
        );

        Alpine.store('app').lightbox.player = player;
      });
    },

    // ── Media Interactions ───────────────────────────────
    handleMediaClick(post) {
      Alpine.store('app').openLightbox(post, this.players, this);
    },

    toggleMute(post) {
      const p = this.players.get(post.id);
      if (p) {
        p.muted = !p.muted;
        p.volume = p.muted ? 0 : 1;
        post.isMuted = p.muted;
      }
    },

    // ── Creator Bio Editing ──────────────────────────────
    /**
     * Returns true if the current user is the content creator.
     * Used in Webflow: x-show="isCreator"
     */
    get isCreator() {
      return this.user.id === SETTINGS_CONFIG.creatorUserId;
    },

    /**
     * Enters bio edit mode. Copies current caption into the
     * edit field. Only callable by the creator.
     */
    startEditBio() {
      if (!this.isCreator) return;
      // Strip HTML tags for plain-text editing
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.creator.caption || '';
      this.editBioText = tempDiv.textContent || '';
      this.bioError = '';
      this.isEditingBio = true;
    },

    /** Cancels bio edit and reverts to the current saved caption. */
    cancelEditBio() {
      this.isEditingBio = false;
      this.editBioText = '';
      this.bioError = '';
    },

    /**
     * Saves the edited bio to Xano and updates the local state.
     * Endpoint: POST /creator_profile/edit_bio  { bio: "..." }
     */
    async saveBio() {
      if (!this.isCreator || this.isBioSaving) return;

      const text = this.editBioText.trim();
      if (!text) {
        this.bioError = 'Bio cannot be empty.';
        return;
      }

      this.isBioSaving = true;
      this.bioError = '';

      try {
        await API.admin
          .post('creator_profile/edit_bio', { json: { bio: text } })
          .json();

        // Update local + global state
        this.creator.caption = text;
        if (window.creatorProfile) {
          window.creatorProfile.caption = text;
        }
        const stored = JSON.parse(localStorage.getItem('creatorData') || '{}');
        stored.caption = text;
        localStorage.setItem('creatorData', JSON.stringify(stored));

        this.isEditingBio = false;
        this.editBioText = '';
      } catch (error) {
        console.error('[Bio] Save failed:', error);
        if (error.response) {
          try {
            const data = await error.response.json();
            this.bioError = data.message || 'Failed to update bio.';
          } catch {
            this.bioError = 'Failed to update bio.';
          }
        } else {
          this.bioError = 'Network error. Please try again.';
        }
      } finally {
        this.isBioSaving = false;
      }
    },

    // ── Likes & Bookmarks (Optimistic Updates) ───────────
    toggleLike(post) {
      const prev = post.is_liked;
      const prevCount = post.likes_count;
      post.is_liked = !prev;
      post.likes_count += post.is_liked ? 1 : -1;

      API.comment
        .post('user_like_content', { json: { content_list_id: post.id, like: post.is_liked } })
        .catch(() => {
          post.is_liked = prev;
          post.likes_count = prevCount;
        });
    },

    toggleBookmark(post) {
      const prev = post.is_bookmarked;
      post.is_bookmarked = !prev;

      API.comment
        .post('user_bookmark_content', {
          json: { content_list_id: post.id, bookmark: post.is_bookmarked },
        })
        .catch(() => (post.is_bookmarked = prev));
    },

    toggleCommentLike(comment) {
      const prev = comment.is_liked;
      const prevCount = comment.likes_count;
      comment.is_liked = !prev;
      comment.likes_count = (prevCount || 0) + (comment.is_liked ? 1 : -1);

      API.comment
        .post('user_like_comment', { json: { comment_id: comment.id, like: comment.is_liked } })
        .catch(() => {
          comment.is_liked = prev;
          comment.likes_count = prevCount;
        });
    },

    // ── Comments ─────────────────────────────────────────
    startReply(post, comment) {
      const user = this.getCommentUser(post, comment.user_id);
      Alpine.store('input').replyingTo = { id: comment.id, name: user.name };
    },

    async postComment() {
      const store = Alpine.store('input');
      if (!this.activePost || !store.text.trim()) return;

      const payload = {
        content_id: this.activePost.id,
        comment_text: store.text,
      };
      if (store.replyingTo) payload.parent_comment_id = store.replyingTo.id;

      try {
        await API.comment.post('comment/post_comment', { json: payload });
        store.reset();
        this.showPicker = false;
        this.showLightboxPicker = false;
        this.activePost.commentsLoaded = false;
        if (this.activePost.comments_count < 999) this.activePost.comments_count++;
        await this.openComments(this.activePost, this.isDrawerOpen);
      } catch (e) {
        this._handleApiError(e);
      }
    },

    async openComments(post, force = true) {
      this.activePost = post;
      Alpine.store('input').reset();
      if (force) {
        this.isDrawerOpen = true;
        this.handleLayoutComment();
      }
      if (post.commentsLoaded) return;

      try {
        const res = await API.comment
          .get('comment/get_content_comments', { searchParams: { content_id: post.id } })
          .json();

        const userMap = {};
        (res.user_list || []).forEach((u) => {
          userMap[u.id] = { ...u, avatar_url: formatAvatar(u.avatar_url) };
        });

        post.comments = (res.structured_comments || []).map((c) => ({
          ...c,
          timeAgo: timeAgoShort(c.created_at),
          areRepliesOpen: false,
          is_liked: !!c.is_liked,
          replies: (c.replies || []).map((r) => ({
            ...r,
            timeAgo: timeAgoShort(r.created_at),
            is_liked: !!r.is_liked,
          })),
        }));

        post.commentUsers = userMap;
        post.commentsLoaded = true;
      } catch (e) {
        this._handleApiError(e);
      }
    },

    renderMergedContent(post, userId, text) {
      const user = this.getCommentUser(post, userId);
      const nameHtml = `<span style="font-weight:500;margin-right:4px;color:#FFFFFF">${user.name}</span>`;
      return nameHtml + (text || '').replace(/@(\w+)/g, '<span style="color:#4D65FF">@$1</span>');
    },

    // ── Emoji Picker (Lazy-Loaded) ───────────────────────
    insertEmojiAtCursor(emoji, isLightbox = false) {
      const id = isLightbox ? 'comment-input-lightbox' : 'comment-input-drawer';
      const el = document.getElementById(id);

      if (!el) {
        Alpine.store('input').text += emoji;
        return;
      }

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = Alpine.store('input').text || '';
      const newText = current.substring(0, start) + emoji + current.substring(end);
      Alpine.store('input').text = newText;
      el.value = newText;

      this.$nextTick(() => {
        const pos = start + emoji.length;
        el.focus();
        el.setSelectionRange(pos, pos);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },

    async toggleEmojiPicker(isLightbox = false) {
      if (isLightbox) {
        this.showLightboxPicker = !this.showLightboxPicker;
        if (this.showLightboxPicker && !lightboxPickerInstance) {
          await this.$nextTick();
          const { createPicker } = await import('https://esm.sh/picmo@5.8.5');
          const container = document.getElementById('emoji-picker-container-lightbox');
          if (container) {
            lightboxPickerInstance = createPicker({
              rootElement: container,
              theme: 'dark',
              className: 'custom-picmo',
            });
            lightboxPickerInstance.addEventListener('emoji:select', (sel) => {
              this.insertEmojiAtCursor(sel.emoji, true);
              this.showLightboxPicker = false;
            });
          }
        }
      } else {
        this.showPicker = !this.showPicker;
        if (this.showPicker && !drawerPickerInstance) {
          await this.$nextTick();
          const { createPicker } = await import('https://esm.sh/picmo@5.8.5');
          const container = document.getElementById('emoji-picker-container');
          if (container) {
            drawerPickerInstance = createPicker({
              rootElement: container,
              theme: 'dark',
              className: 'custom-picmo',
            });
            drawerPickerInstance.addEventListener('emoji:select', (sel) => {
              this.insertEmojiAtCursor(sel.emoji, false);
              this.showPicker = false;
            });
          }
        }
      }
    },

    // ── Error Handling ───────────────────────────────────
    triggerError(type) {
      if (type === 'subscription') {
        this.popup = {
          show: true,
          header: 'Subscription Required',
          message: 'Unlock premium content and private messages.',
          btnText: 'Subscribe',
          isLocked: false,
          showCloseIcon: true,
          btnAction: () => (window.location.href = '/setting?tab=plan'),
        };
      } else {
        let countdown = 20;
        this.popup = {
          show: true,
          header: 'Rate Limited',
          message: 'Please wait a moment.',
          isLocked: true,
          showCloseIcon: false,
          btnText: `Wait ${countdown}s`,
          btnAction: null,
        };
        const interval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            this.popup.btnText = `Wait ${countdown}s`;
          } else {
            clearInterval(interval);
            this.popup.isLocked = false;
            this.popup.btnText = 'Return Home';
            this.popup.btnAction = () => this.logout();
          }
        }, 1000);
      }
    },

    _handleApiError(e) {
      const status = e?.response?.status;
      if (status === 401) this.logout();
      else if (status === 403) this.triggerError('subscription');
      else if (status === 429) this.triggerError('rate_limit');
      else this.triggerError('rate_limit');
    },

    // ── Stripe Checkout ──────────────────────────────────
    async handleStripeCheckout(priceId, mode) {
      this.popup = {
        ...this.popup,
        show: true,
        header: 'Processing',
        message: 'Redirecting...',
        isLocked: true,
        showCloseIcon: false,
        btnText: 'Loading...',
      };

      try {
        const res = await API.checkout
          .post('stripe/create_checkout_session', { json: { price_id: priceId, mode } })
          .json();
        if (res.url) window.location.href = res.url;
      } catch (e) {
        this._handleApiError(e);
      }
    },

    // ── Cleanup & Logout ─────────────────────────────────
    logout() {
      // Destroy all observers and players
      this.observers.forEach((obs) => obs.disconnect());
      this.observers.clear();
      this.players.forEach((p) => { try { p.destroy(); } catch {} });
      this.players.clear();
      this._hlsInstances.forEach((h) => { try { h.destroy(); } catch {} });
      this._hlsInstances.clear();

      if (window.authManager) {
        window.authManager.logout();
      } else {
        localStorage.removeItem('authToken');
        window.location.href = '/auth/login';
      }
    },

    // ── Layout Helpers ───────────────────────────────────
    closeDrawer() {
      this.isDrawerOpen = false;
      this.handleLayoutComment();
    },

    handleLayoutComment() {
      const el = document.querySelector('[data-element="layout-comment"]');
      if (!el) return;
      isDesktop() || this.isDrawerOpen
        ? el.classList.remove('visibility-hidden')
        : el.classList.add('visibility-hidden');
    },

    getCommentUser(post, userId) {
      return post?.commentUsers?.[userId] || { name: 'User', avatar_url: PLACEHOLDER };
    },

    renderMedia(post) {
      if (post.content_type === 'video') {
        return `<div x-init="initPlayer(post)" class="video-wrapper">
                  <video id="video-${post.id}" playsinline muted loop poster="${post.display_url}"></video>
                </div>`;
      }
      return `<div style="cursor:zoom-in">
                <img src="${post.display_url}?width=700" class="feed_media-item" style="object-fit:cover;width:100%;border-radius:12px" loading="lazy">
              </div>`;
    },

    // ── Event Binding ────────────────────────────────────
    _bindEvents() {
      // Debounced resize handler
      const onResize = debounce(() => {
        this.handleLayoutComment();
        this.feed.forEach((p) => {
          p.timeAgoDisplay = timeAgoDisplay(p.created_at);
        });
      }, 250);
      window.addEventListener('resize', onResize);

      // Logout button
      document.querySelector('[data-element="log-out"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });

      // Feed/Profile filters (driven by _pageConfig.filters)
      // Toggle mode: clicking active filter resets to 'all'
      // This works for both feed (all/free/paid) and profile (liked/bookmarked)
      this._pageConfig.filters.forEach((type) => {
        const btn = document.querySelector(`[data-element="filter-${type}"]`);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.currentFilter === type && type !== 'all') {
              // Toggle off → back to 'all'
              this.currentFilter = 'all';
              btn.classList.remove('is-active');
            } else {
              this.currentFilter = type;
              document.querySelectorAll('.filter_button').forEach((b) => b.classList.remove('is-active'));
              btn.classList.add('is-active');
            }
          });
        }
      });

      // Stripe checkout delegation
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-checkout="trigger"]');
        if (btn) this.handleStripeCheckout(btn.dataset.price, btn.dataset.mode);
      });
    },
  });
}

// ─── Page-Specific Registration ──────────────────────────────

/** Registers the Alpine `app` component for the FEED page. */
export function registerFeedComponent() {
  Alpine.data('app', createFeedComponent(FEED_CONFIG));
}

/** Registers the Alpine `app` component for the PROFILE page. */
export function registerProfileComponent() {
  Alpine.data('app', createFeedComponent(PROFILE_CONFIG));
}
