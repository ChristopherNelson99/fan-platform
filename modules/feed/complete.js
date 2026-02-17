/**
 * @fileoverview Complete Feed Page Module
 * @module modules/feed/complete
 */

import Alpine from 'alpinejs';
import { FeedState } from './state.js';
import { CommentsManager } from './comments.js';
import { InteractionsManager } from './interactions.js';
import { AuthAPI, FeedAPI, PublicAPI, CheckoutAPI } from '../../core/api.js';
import { API_ENDPOINTS, ROUTES, DEFAULTS, debugLog } from '../../core/constants.js';
import { wrapInAlpineTemplate } from '../../utils/dom.js';
import { VideoPlayer, VideoObserver } from '../../utils/video.js';
import { formatNumber } from '../../utils/format.js';

export function initFeedPageComplete() {
  debugLog('Feed', 'Initializing...');

  // ── Instantiate managers ───────────────────────────────────────────────────
  const feedState          = new FeedState();
  const videoObserver      = new VideoObserver();
  const commentsManager    = new CommentsManager(feedState);
  const interactionsManager = new InteractionsManager(feedState, commentsManager);

  window.feedState          = feedState;
  window.commentsManager    = commentsManager;
  window.interactionsManager = interactionsManager;

  // ── Private Picmo instances (must live outside Alpine proxy) ───────────────
  let drawerPickerInstance   = null;
  let lightboxPickerInstance = null;

  // ── Alpine Stores ──────────────────────────────────────────────────────────
  Alpine.store('input', {
    text: '',
    replyingTo: null,
    reset() { this.text = ''; this.replyingTo = null; }
  });

  Alpine.store('app', {
    lightbox: { show: false, url: '', type: '', post: null, player: null },

    async openLightbox(post, playersMap, appRef) {
      if (post.paid && !appRef.user.subscribed) return appRef.triggerError('subscription');
      appRef.pauseAllPlayers();
      Object.assign(this.lightbox, { type: post.content_type, url: post.display_url, post, show: true });
      document.body.style.overflow = 'hidden';
      await appRef.openComments(post, true);
      if (post.content_type === 'video') appRef.initLightboxPlayer();
    },

    async closeLightbox(appRef) {
      if (appRef?.isDrawerOpen) {
        appRef.isDrawerOpen = false;
        appRef.handleLayoutComment();
        await new Promise(r => setTimeout(r, 350));
      }
      if (this.lightbox.player) { this.lightbox.player.destroy(); this.lightbox.player = null; }
      this.lightbox.show = false;
      document.body.style.overflow = '';
    }
  });

  // ── Alpine Data ────────────────────────────────────────────────────────────
  Alpine.data('app', () => ({

    // ── State (copied from FeedState, NOT spread — class methods don't spread) ──
    user:          feedState.user,
    creator:       feedState.creator,
    feed:          feedState.feed,
    activePost:    feedState.activePost,
    isDrawerOpen:  feedState.isDrawerOpen,
    currentFilter: feedState.currentFilter,
    isLoading:     feedState.isLoading,
    hasMore:       feedState.hasMore,
    page:          feedState.page,
    players:       feedState.players,
    observers:     feedState.observers,
    popup:         feedState.popup,

    // ── Picker state — names MUST match Webflow HTML x-show attributes ─────────
    // Webflow uses: x-show="showPicker" and x-show="showLightboxPicker"
    showPicker:        false,
    showLightboxPicker: false,

    // ── Init ───────────────────────────────────────────────────────────────────
    async init() {
      this.bindEvents();
      try {
        if (window.currentUser && window.creatorProfile) {
          debugLog('Feed', 'Using site-wide auth data');
          feedState.setUser(window.currentUser);
          feedState.setCreator(window.creatorProfile);
          this.user    = feedState.user;
          this.creator = feedState.creator;
        } else {
          const stored  = localStorage.getItem('userData');
          const storedC = localStorage.getItem('creatorData');
          if (stored && storedC) {
            feedState.setUser(JSON.parse(stored));
            feedState.setCreator(JSON.parse(storedC));
            this.user    = feedState.user;
            this.creator = feedState.creator;
          } else {
            const [uR, cR] = await Promise.allSettled([
              AuthAPI.get(API_ENDPOINTS.auth.getMe),
              PublicAPI.get(API_ENDPOINTS.feed.creatorProfile)
            ]);
            if (uR.status === 'rejected') throw uR.reason;
            const raw = uR.value.user_information || uR.value;
            feedState.setUser({ ...raw, subscribed: !!raw.subscribed });
            this.user = feedState.user;
            if (cR.status === 'fulfilled') {
              feedState.setCreator(cR.value);
              this.creator = feedState.creator;
            }
          }
        }

        await this.loadFeed();
        await this.handleDeepLink();

      } catch (e) {
        this.handleApiError(e);
      } finally {
        this.isLoading = false;
      }
    },

    // ── Feed ───────────────────────────────────────────────────────────────────
    async loadFeed() {
      if (!this.hasMore) return;
      const ep = this.user.subscribed
        ? API_ENDPOINTS.feed.premium
        : API_ENDPOINTS.feed.unsubscribed;
      try {
        const res = await FeedAPI.get(ep, { searchParams: { page: this.page, per_page: 10 } });
        if (res && res.length > 0) {
          feedState.addPosts(res);
          this.feed = feedState.feed;
          this.page++;
        } else {
          this.hasMore = false;
        }
      } catch (e) { debugLog('Feed', 'Load error:', e); }
    },

    // ── Deep Link ──────────────────────────────────────────────────────────────
    async handleDeepLink() {
      const params    = new URLSearchParams(window.location.search);
      const contentId = params.get('content_id');
      const commentId = params.get('comment_id');
      if (!contentId) return;

      let post = this.feed.find(p => p.id === parseInt(contentId));
      if (!post) {
        try {
          const ep  = this.user.subscribed ? API_ENDPOINTS.feed.premium : API_ENDPOINTS.feed.unsubscribed;
          const res = await FeedAPI.get(ep, { searchParams: { page: 1, per_page: 50 } });
          const found = res?.find(p => p.id === parseInt(contentId));
          if (found) {
            feedState.addPosts([found]);
            this.feed = feedState.feed;
            post = this.feed[0];
          } else {
            feedState.showPopup({ header: 'Content Not Found', message: 'This post may have been deleted.', btnText: 'OK', btnAction: () => feedState.hidePopup() });
            this.popup = feedState.popup;
            return;
          }
        } catch (e) { return; }
      }
      if (post) {
        await Alpine.store('app').openLightbox(post, this.players, this);
        if (commentId) {
          await this.$nextTick();
          setTimeout(() => {
            const el = document.querySelector(`[data-comment-id="${commentId}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.backgroundColor = 'rgba(77,101,255,0.2)';
              setTimeout(() => el.style.backgroundColor = '', 2000);
            }
          }, 600);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    },

    // ── Video Players ──────────────────────────────────────────────────────────
    pauseAllPlayers(exceptId = null) {
      this.players.forEach((p, id) => { if (id !== exceptId) p.pause(); });
      const lb = Alpine.store('app').lightbox.player;
      if (lb && exceptId !== 'lightbox') lb.pause();
    },

    initPlayer(post) {
      if (post.content_type !== 'video' || (post.paid && !this.user.subscribed)) return;
      this.$nextTick(() => {
        const el = document.querySelector(`#video-${post.id}`);
        if (!el || el.dataset.plyrInitialized) return;
        const player = new VideoPlayer(el, { controls: [], autoplay: false, muted: true });
        player.init(post.display_url);
        player.on('play',         () => { this.pauseAllPlayers(post.id); post.isPlaying = true; });
        player.on('playing',      () => post.isPlaying = true);
        player.on('pause',        () => post.isPlaying = false);
        player.on('volumechange', () => { post.isMuted = player.player?.muted; });
        this.players.set(post.id, player);
        videoObserver.observe(el, player);
      });
    },

    initLightboxPlayer() {
      this.$nextTick(() => {
        const el = document.querySelector('#video-lightbox');
        if (!el) return;
        const player = new VideoPlayer(el, {
          controls: ['play-large','play','progress','current-time','mute','volume','fullscreen'],
          autoplay: true, muted: false
        });
        player.init(Alpine.store('app').lightbox.url);
        player.on('play',  () => this.pauseAllPlayers('lightbox'));
        player.on('ready', () => { player.player.muted = false; player.player.volume = 1; });
        Alpine.store('app').lightbox.player = player;
      });
    },

    handleMediaClick(post) { Alpine.store('app').openLightbox(post, this.players, this); },

    toggleMute(post) {
      const p = this.players.get(post.id);
      if (p) { p.toggleMute?.(); post.isMuted = p.player?.muted; }
    },

    renderMedia(post) {
      if (post.content_type === 'video') {
        return `<div x-init="initPlayer(post)" class="video-wrapper">
          <video id="video-${post.id}" playsinline webkit-playsinline muted loop
                 poster="${post.display_url}?width=20&quality=10"></video>
        </div>`;
      }
      return `<div style="cursor:zoom-in">
        <img src="${post.display_url}?width=700"
             class="feed_media-item"
             style="object-fit:cover;width:100%;border-radius:12px;"
             loading="lazy" decoding="async" fetchpriority="low" alt="">
      </div>`;
    },

    // ── Interactions ───────────────────────────────────────────────────────────
    toggleLike(post) {
      interactionsManager.toggleLike(post).catch(e => this.handleApiError(e));
    },

    toggleBookmark(post) {
      interactionsManager.toggleBookmark(post).catch(e => this.handleApiError(e));
    },

    // ── Comments ───────────────────────────────────────────────────────────────
    async openComments(post, force = true) {
      this.activePost = post;
      Alpine.store('input').reset();
      if (force) { this.isDrawerOpen = true; this.handleLayoutComment(); }
      if (!post.commentsLoaded) {
        try {
          await commentsManager.loadComments(post);
        } catch (e) { this.handleApiError(e); }
      }
    },

    async postComment() {
      const store = Alpine.store('input');
      if (!this.activePost || !store.text.trim()) return;
      try {
        await commentsManager.postComment(this.activePost, store.text, store.replyingTo?.id);
        store.reset();
        this.showPicker        = false;
        this.showLightboxPicker = false;
      } catch (e) { this.handleApiError(e); }
    },

    toggleCommentLike(comment) {
      commentsManager.toggleCommentLike(comment).catch(e => this.handleApiError(e));
    },

    toggleReplies(comment) { commentsManager.toggleReplies(comment); },

    startReply(post, comment) {
      const user = commentsManager.getCommentUser(post, comment.user_id);
      Alpine.store('input').replyingTo = { id: comment.id, name: user.name };
    },

    getCommentUser(post, userId) { return commentsManager.getCommentUser(post, userId); },

    renderMergedContent(post, userId, text) {
      return commentsManager.renderMergedContent(post, userId, text);
    },

    // ── Emoji Picker ───────────────────────────────────────────────────────────
    async toggleEmojiPicker(isLightbox = false) {
      if (isLightbox) {
        this.showLightboxPicker = !this.showLightboxPicker;
        if (this.showLightboxPicker && !lightboxPickerInstance) {
          await this.$nextTick();
          const { createPicker } = await import('picmo');
          const container = document.getElementById('emoji-picker-container-lightbox');
          if (container) {
            lightboxPickerInstance = createPicker({ rootElement: container, theme: 'dark', className: 'custom-picmo' });
            lightboxPickerInstance.addEventListener('emoji:select', sel => {
              this.insertEmojiAtCursor(sel.emoji, true);
              this.showLightboxPicker = false;
            });
          }
        }
      } else {
        this.showPicker = !this.showPicker;
        if (this.showPicker && !drawerPickerInstance) {
          await this.$nextTick();
          const { createPicker } = await import('picmo');
          const container = document.getElementById('emoji-picker-container');
          if (container) {
            drawerPickerInstance = createPicker({ rootElement: container, theme: 'dark', className: 'custom-picmo' });
            drawerPickerInstance.addEventListener('emoji:select', sel => {
              this.insertEmojiAtCursor(sel.emoji, false);
              this.showPicker = false;
            });
          }
        }
      }
    },

    insertEmojiAtCursor(emoji, isLightbox = false) {
      const el = document.getElementById(isLightbox ? 'comment-input-lightbox' : 'comment-input-drawer');
      if (!el) { Alpine.store('input').text += emoji; return; }
      const start = el.selectionStart, end = el.selectionEnd;
      const current = Alpine.store('input').text || '';
      const next = current.slice(0, start) + emoji + current.slice(end);
      Alpine.store('input').text = next;
      el.value = next;
      this.$nextTick(() => {
        const pos = start + emoji.length;
        el.focus(); el.setSelectionRange(pos, pos);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },

    // ── Checkout ───────────────────────────────────────────────────────────────
    async handleStripeCheckout(id, mode) {
      this.popup = { show: true, header: 'Processing', message: 'Redirecting…', isLocked: true, showCloseIcon: false, btnText: 'Loading…' };
      try {
        const res = await CheckoutAPI.post(API_ENDPOINTS.checkout.createSession, { json: { price_id: id, mode } });
        if (res.url) window.location.href = res.url;
      } catch (e) { this.handleApiError(e); }
    },

    // ── Error Handling ─────────────────────────────────────────────────────────
    triggerError(type) {
      if (type === 'subscription') {
        this.popup = { show: true, header: 'Subscription Required', message: 'Unlock premium content and private messages.', btnText: 'Subscribe', isLocked: false, showCloseIcon: true, btnAction: () => window.location.href = '/setting?tab=plan' };
      } else if (type === 'rate_limit') {
        let c = 20;
        this.popup = { show: true, header: 'Rate Limited', message: 'Please wait a moment.', isLocked: true, showCloseIcon: false, btnText: `Wait ${c}s` };
        const itv = setInterval(() => {
          c--;
          if (c > 0) this.popup.btnText = `Wait ${c}s`;
          else { clearInterval(itv); this.popup.isLocked = false; this.popup.btnText = 'Return Home'; this.popup.btnAction = () => this.logout(); }
        }, 1000);
      }
    },

    handleApiError(e) {
      const s = e?.response?.status;
      if (s === 401) this.logout();
      else if (s === 403) this.triggerError('subscription');
      else if (s === 429) this.triggerError('rate_limit');
      else console.error('API error:', e);
    },

    // ── UI ─────────────────────────────────────────────────────────────────────
    logout() {
      feedState.cleanup();
      if (window.authManager) window.authManager.logout();
      else { localStorage.removeItem('authToken'); window.location.href = '/auth/login'; }
    },

    closeDrawer() { this.isDrawerOpen = false; this.handleLayoutComment(); },

    handleLayoutComment() {
      const el = document.querySelector('[data-element="layout-comment"]');
      if (!el) return;
      (window.innerWidth >= 992 || this.isDrawerOpen)
        ? el.classList.remove('visibility-hidden')
        : el.classList.add('visibility-hidden');
    },

    formatNumber(n) { return formatNumber(n); },

    bindEvents() {
      window.addEventListener('resize', () => {
        feedState.updateTimeDisplays();
        this.feed = feedState.feed;
        this.handleLayoutComment();
      });
      document.querySelector('[data-element="log-out"]')?.addEventListener('click', e => { e.preventDefault(); this.logout(); });
      ['all','free','paid'].forEach(t => {
        const b = document.querySelector(`[data-element="filter-${t}"]`);
        if (b) b.addEventListener('click', () => {
          this.currentFilter = t;
          document.querySelectorAll('.filter_button').forEach(btn => btn.classList.remove('is-active'));
          b.classList.add('is-active');
        });
      });
      document.addEventListener('click', e => {
        const b = e.target.closest('[data-checkout="trigger"]');
        if (b) this.handleStripeCheckout(b.dataset.price, b.dataset.mode);
      });
    }
  }));

  // ── Wrap Webflow templates ─────────────────────────────────────────────────
  wrapInAlpineTemplate('[x-template="reply-item"]',   '(reply, index) in comment.replies', 'reply.id');
  wrapInAlpineTemplate('[x-template="comment-item"]', 'comment in (activePost ? activePost.comments : [])', 'comment.id');
  wrapInAlpineTemplate('[x-template="feed-item"]',    'post in (currentFilter === "all" ? feed : feed.filter(p => currentFilter === "paid" ? p.paid : !p.paid))', 'post.id');

  Alpine.start();
  debugLog('Feed', 'Alpine started');
}

export default initFeedPageComplete;
