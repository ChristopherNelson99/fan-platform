/**
 * @fileoverview Feed state management
 * @module modules/feed/state
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
import { debugLog, DEFAULTS, UI_CONFIG } from '../../core/constants.js';
import { formatAvatarUrl } from '../../utils/format.js';
import { getWindowSize } from '../../utils/dom.js';

// Configure dayjs
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.updateLocale('en', {
  relativeTime: {
    future: "in %s",
    past: "%s",
    s: 'now',
    m: "1min",
    mm: "%dmin",
    h: "1h",
    hh: "%dh",
    d: "1d",
    dd: "%dd",
    M: "1m",
    MM: "%dm",
    y: "1y",
    yy: "%dy"
  }
});

/**
 * Feed State Manager
 */
export class FeedState {
  constructor() {
    this.user = {
      id: null,
      name: '',
      email: '',
      avatar_url: DEFAULTS.transparentPixel,
      subscribed: false,
      created_at: null,
    };

    this.creator = {
      avatar_url: DEFAULTS.transparentPixel,
      banner_url: DEFAULTS.placeholder,
      caption: '',
      post_count: 0,
      follower_count: 0,
    };

    this.feed = [];
    this.page = UI_CONFIG.feed.initialPage;
    this.hasMore = true;
    this.currentFilter = 'all'; // 'all', 'free', 'paid'
    this.isLoading = true;
    this.isLoadingMore = false;

    // Active post (for comments/lightbox)
    this.activePost = null;

    // Players and observers
    this.players = new Map();
    this.observers = new Map();

    // UI state
    this.isDrawerOpen = false;
    this.showEmojiPicker = false;
    this.showLightboxEmojiPicker = false;

    // Lightbox state
    this.lightbox = {
      show: false,
      url: '',
      type: '',
      post: null,
      player: null,
    };

    // Comment input state
    this.commentInput = {
      text: '',
      replyingTo: null, // { id, name }
    };

    // Popup/modal state
    this.popup = {
      show: false,
      header: '',
      message: '',
      btnText: '',
      btnAction: null,
      isLocked: false,
      showCloseIcon: true,
    };

    debugLog('FeedState', 'State initialized');
  }

  /**
   * Set user data
   * @param {Object} userData 
   */
  setUser(userData) {
    this.user = {
      ...userData,
      avatar_url: formatAvatarUrl(userData.avatar_url),
      subscribed: !!userData.subscribed,
    };
    debugLog('FeedState', 'User set:', this.user.name);
  }

  /**
   * Set creator data
   * @param {Object} creatorData 
   */
  setCreator(creatorData) {
    this.creator = {
      ...creatorData,
      avatar_url: formatAvatarUrl(creatorData.avatar_url),
      banner_url: creatorData.banner_url || DEFAULTS.placeholder,
    };
    debugLog('FeedState', 'Creator set');
  }

  /**
   * Add posts to feed
   * @param {Array} posts 
   */
  addPosts(posts) {
    const { width } = getWindowSize();
    const isDesktop = width >= UI_CONFIG.breakpoints.tablet;

    const formattedPosts = posts.map(post => ({
      ...post,
      isPlaying: false,
      isMuted: true,
      timeAgoDisplay: isDesktop 
        ? dayjs(post.created_at).fromNow() 
        : dayjs(post.created_at).fromNow(true),
      commentsLoaded: false,
      comments: [],
      commentUsers: {},
    }));

    this.feed = [...this.feed, ...formattedPosts];
    debugLog('FeedState', `Added ${posts.length} posts, total: ${this.feed.length}`);
  }

  /**
   * Get filtered feed
   * @returns {Array}
   */
  getFilteredFeed() {
    if (this.currentFilter === 'all') {
      return this.feed;
    }
    return this.feed.filter(post => {
      return this.currentFilter === 'paid' ? post.paid : !post.paid;
    });
  }

  /**
   * Set filter
   * @param {string} filter 
   */
  setFilter(filter) {
    this.currentFilter = filter;
    debugLog('FeedState', `Filter set to: ${filter}`);
  }

  /**
   * Update post in feed
   * @param {number} postId 
   * @param {Object} updates 
   */
  updatePost(postId, updates) {
    const index = this.feed.findIndex(p => p.id === postId);
    if (index !== -1) {
      this.feed[index] = { ...this.feed[index], ...updates };
      
      // Update active post if it's the same
      if (this.activePost && this.activePost.id === postId) {
        this.activePost = { ...this.activePost, ...updates };
      }
    }
  }

  /**
   * Get post by ID
   * @param {number} postId 
   * @returns {Object|null}
   */
  getPost(postId) {
    return this.feed.find(p => p.id === postId) || null;
  }

  /**
   * Reset comment input
   */
  resetCommentInput() {
    this.commentInput.text = '';
    this.commentInput.replyingTo = null;
    this.showEmojiPicker = false;
    this.showLightboxEmojiPicker = false;
  }

  /**
   * Set replying to
   * @param {Object} comment 
   * @param {string} userName 
   */
  setReplyingTo(comment, userName) {
    this.commentInput.replyingTo = {
      id: comment.id,
      name: userName,
    };
  }

  /**
   * Open lightbox
   * @param {Object} post 
   */
  openLightbox(post) {
    this.lightbox = {
      show: true,
      url: post.display_url,
      type: post.content_type,
      post: post,
      player: null,
    };
    this.activePost = post;
    document.body.style.overflow = 'hidden';
    debugLog('FeedState', 'Lightbox opened for post:', post.id);
  }

  /**
   * Close lightbox
   */
  closeLightbox() {
    if (this.lightbox.player) {
      this.lightbox.player.destroy();
    }

    this.lightbox = {
      show: false,
      url: '',
      type: '',
      post: null,
      player: null,
    };

    document.body.style.overflow = '';
    debugLog('FeedState', 'Lightbox closed');
  }

  /**
   * Show popup
   * @param {Object} options 
   */
  showPopup(options) {
    this.popup = {
      show: true,
      ...options,
    };
  }

  /**
   * Hide popup
   */
  hidePopup() {
    this.popup.show = false;
  }

  /**
   * Update time displays (call on window resize)
   */
  updateTimeDisplays() {
    const { width } = getWindowSize();
    const isDesktop = width >= UI_CONFIG.breakpoints.tablet;

    this.feed.forEach(post => {
      post.timeAgoDisplay = isDesktop
        ? dayjs(post.created_at).fromNow()
        : dayjs(post.created_at).fromNow(true);
    });
  }

  /**
   * Cleanup (destroy players and observers)
   */
  cleanup() {
    // Destroy all players
    this.players.forEach(player => {
      if (player && player.destroy) {
        player.destroy();
      }
    });
    this.players.clear();

    // Disconnect all observers
    this.observers.forEach(observer => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers.clear();

    // Close lightbox
    this.closeLightbox();

    debugLog('FeedState', 'Cleanup complete');
  }
}

export default FeedState;
