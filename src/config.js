/**
 * config.js — Central Configuration
 * All endpoints, routes, selectors, and constants in one place.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: No admin API keys. Only public endpoints + user JWE tokens.
 */

// ─── Xano Base URLs ──────────────────────────────────────────
const XANO_BASE = 'https://xlt3-xgt9-0s5c.n7e.xano.io';

export const API_PREFIXES = {
  auth:     `${XANO_BASE}/api:U1zap5sg`,
  feed:     `${XANO_BASE}/api:R_M-MhbI`,
  comment:  `${XANO_BASE}/api:mb7M6Yk1`,
  public:   `${XANO_BASE}/api:R_M-MhbI`,
  checkout: `${XANO_BASE}/api:GFtJFKgV`,
  avatar:   `${XANO_BASE}/api:vbehYAzI`,
  admin:    `${XANO_BASE}/api:8M6P_cld`,
};

// ─── Auth Config ─────────────────────────────────────────────
export const AUTH_CONFIG = {
  endpoints: {
    getMe:             `${API_PREFIXES.auth}/auth/get/me`,
    getCreatorProfile: `${API_PREFIXES.public}/get_creator_profile`,
    getAdminCheck:     `${API_PREFIXES.admin}/creator_profile/get_admin_check`,
  },
  routes: {
    login:        '/auth/login',
    feed:         '/membership/feed',
    unauthorized: '/auth/login',
  },
  storage: {
    authToken:   'authToken',
    userData:    'userData',
    creatorData: 'creatorData',
  },
};

// ─── Notification Config ─────────────────────────────────────
export const NOTIFICATION_CONFIG = {
  endpoints: {
    get:         `${API_PREFIXES.comment}/notification/get_notifications`,
    markRead:    `${API_PREFIXES.comment}/notification/read_notification`,
    getComment:  `${API_PREFIXES.comment}/comment/get_comment`,
    getComments: `${API_PREFIXES.comment}/comment/get_content_comments`,
  },
  selectors: {
    trigger:     '[data-notification="trigger"]',
    drawer:      '.notification-list',
    template:    '.notification-card.is-active',
    closeButton: '[data-notification="close"]',
    unreadBadge: '[data-notification="badge"]',
  },
  routes: {
    feed:     '/membership/feed',
    messages: '/messages',
  },
  classes: {
    drawerOpen: 'isopen',
    cardActive: 'is-active',
    cardUnread: 'is-unread',
  },
  desktopBreakpoint: 991,
};

// ─── Asset Constants ─────────────────────────────────────────
export const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const PLACEHOLDER =
  'https://d3e54v103j8qbb.cloudfront.net/plugins/Basic/assets/placeholder.60f9b1840c.svg';

// ─── Feed Config ─────────────────────────────────────────────
export const FEED_CONFIG = {
  perPage: 10,
  commentMaxLength: 150,
  commentWarnAt: 130,
};

// ─── Admin / Content Manager Config ──────────────────────────
export const ADMIN_CONFIG = {
  endpoints: {
    create: `${API_PREFIXES.admin}/photo_content`,
    edit:   `${API_PREFIXES.admin}/edit_photo_content`,
    feed:   `${API_PREFIXES.feed}/get_content_feed_premium`,
  },
  teaserBlur:    60,        // CSS blur() pixels for teaser generation
  teaserQuality: 0.8,       // JPEG quality for teaser blob
  maxTitleLength: 30,
  selectors: {
    editor:      '#rich-editor',
    previewImg:  '#preview-img',
    placeholder: '#upload-placeholder',
    mediaInput:  '#media-input',
    canvas:      '#teaser-canvas',
    emojiTrigger:'#emoji-trigger',
    emojiPicker: '#emoji-picker-container',
  },
};
