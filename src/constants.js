/**
 * @fileoverview Global constants and configuration
 * @module core/constants
 */

// ==========================================
// API ENDPOINTS
// ==========================================
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:U1zap5sg',
    getMe: 'auth/get/me',
  },
  
  // Feed & Content
  feed: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:R_M-MhbI',
    premium: 'get_content_feed_premium',
    unsubscribed: 'get_content_feed_unsubbed',
    creatorProfile: 'get_creator_profile',
  },
  
  // Comments
  comment: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:mb7M6Yk1',
    getComments: 'comment/get_content_comments',
    getComment: 'comment/get_comment',
    postComment: 'comment/post_comment',
    likeContent: 'user_like_content',
    likeComment: 'user_like_comment',
    bookmark: 'user_bookmark_content',
  },
  
  // Notifications
  notification: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:mb7M6Yk1',
    get: 'notification/get_notifications',
    markRead: 'notification/read_notification',
  },
  
  // Avatar Upload
  avatar: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:vbehYAzI',
    upload: 'photo_avatar',
  },
  
  // Checkout
  checkout: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:GFtJFKgV',
    createSession: 'stripe/create_checkout_session',
  },
  
  // Admin
  admin: {
    base: 'https://xlt3-xgt9-0s5c.n7e.xano.io/api:8M6P_cld',
    checkAdmin: 'creator_profile/get_admin_check',
  },
};

// ==========================================
// ROUTES
// ==========================================
export const ROUTES = {
  login: '/auth/login',
  feed: '/membership/feed',
  messages: '/messages',
  settings: '/setting',
  unauthorized: '/auth/login',
};

// ==========================================
// LOCAL STORAGE KEYS
// ==========================================
export const STORAGE_KEYS = {
  authToken: 'authToken',
  userData: 'userData',
  creatorData: 'creatorData',
  loginEvent: 'login_event',
  debugMode: 'DEBUG_MODE',
};

// ==========================================
// UI CONFIGURATION
// ==========================================
export const UI_CONFIG = {
  // Breakpoints
  breakpoints: {
    mobile: 767,
    tablet: 991,
    desktop: 1200,
  },
  
  // Animation timings (ms)
  animation: {
    fast: 150,
    normal: 300,
    slow: 600,
    cardStagger: 60,
    cardExit: 40,
  },
  
  // Feed pagination
  feed: {
    perPage: 10,
    initialPage: 1,
  },
  
  // Video player
  video: {
    intersectionThreshold: 0.5,
    autoplayMuted: true,
  },
};

// ==========================================
// NOTIFICATION TYPES
// ==========================================
export const NOTIFICATION_TYPES = {
  CREATOR_NEW_TIP: 'creator_new_tip',
  CREATOR_NEW_FOLLOWER: 'creator_new_follower',
  POST_LIKE: 'post_like',
  COMMENT_LIKE: 'comment_like',
  CREATOR_COMMENT_REPLY: 'creator_comment_reply',
  CREATOR_NEW_COMMENT: 'creator_new_comment',
  NEW_MESSAGE: 'new_message',
  COMMENT_REPLY: 'comment_reply',
  NEW_POST: 'new_post',
};

// ==========================================
// PLACEHOLDERS & DEFAULTS
// ==========================================
export const DEFAULTS = {
  transparentPixel: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  placeholder: 'https://d3e54v103j8qbb.cloudfront.net/plugins/Basic/assets/placeholder.60f9b1840c.svg',
};

// ==========================================
// ERROR MESSAGES
// ==========================================
export const ERROR_MESSAGES = {
  auth: {
    noToken: 'No authentication token found',
    invalidToken: 'Invalid or expired authentication token',
    loginRequired: 'Please log in to continue',
  },
  api: {
    networkError: 'Network error. Please check your connection.',
    serverError: 'Server error. Please try again later.',
    rateLimited: 'Too many requests. Please wait a moment.',
  },
  subscription: {
    required: 'Subscription required to access this content',
  },
  content: {
    notFound: 'Content not found or no longer available',
    loadFailed: 'Failed to load content',
  },
};

// ==========================================
// SAFARI COMPATIBILITY FLAGS
// ==========================================
export const BROWSER_SUPPORT = {
  // Check for Safari/iOS
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  
  // Feature detection
  hasIntersectionObserver: 'IntersectionObserver' in window,
  hasResizeObserver: 'ResizeObserver' in window,
  hasWebGL: (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  })(),
};

// ==========================================
// DEBUG MODE
// ==========================================
export const DEBUG = localStorage.getItem(STORAGE_KEYS.debugMode) === 'true';

/**
 * Debug logger that only logs when DEBUG mode is enabled
 * @param {string} label - Log label/category
 * @param  {...any} args - Arguments to log
 */
export function debugLog(label, ...args) {
  if (DEBUG) {
    console.log(`[${label}]`, ...args);
  }
}
