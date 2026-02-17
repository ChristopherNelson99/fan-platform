/**
 * @fileoverview Notifications system
 * @module modules/notifications/index
 */

import { NotificationAPI, CommentAPI } from '../../core/api.js';
import { API_ENDPOINTS, NOTIFICATION_TYPES, ROUTES, debugLog, UI_CONFIG } from '../../core/constants.js';
import { formatAvatarUrl } from '../../utils/format.js';
import { $, $$, on, animateCSS } from '../../utils/dom.js';
import dayjs from 'dayjs';

/**
 * Notification Manager
 */
export class NotificationManager {
  constructor() {
    this.notifications = [];
    this.isDrawerOpen = false;
    this.elements = {};
    this.templateCard = null;
    this.animationTimeouts = [];
    this.unreadCount = 0;
  }

  /**
   * Initialize notification system
   * @returns {Promise}
   */
  async init() {
    this.cacheElements();

    if (!this.elements.triggers.length || !this.elements.drawer) {
      debugLog('Notifications', 'Elements not found, skipping init');
      return;
    }

    this.saveTemplate();
    this.bindEvents();
    await this.fetchNotifications();
    this.updateBadge();

    debugLog('Notifications', 'Initialized successfully');
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements.triggers = $$('[data-notification="trigger"]');
    this.elements.drawer = $('[data-notification="drawer"]') || $('.notification-list');
    this.elements.closeButton = $('[data-notification="close"]');
    this.elements.unreadBadges = $$('[data-notification="badge"]');
  }

  /**
   * Save notification card template
   */
  saveTemplate() {
    const template = $('.notification-card.is-active');
    
    if (template) {
      this.templateCard = template.cloneNode(true);
      this.templateCard.classList.remove('is-active');
      template.remove();
      debugLog('Notifications', 'Template saved');
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Trigger buttons
    this.elements.triggers.forEach(trigger => {
      on(trigger, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDrawer();
      });
    });

    // Close button
    if (this.elements.closeButton) {
      on(this.elements.closeButton, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeDrawer();
      });
    }

    // ESC key
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this.isDrawerOpen) {
        this.closeDrawer();
      }
    });

    // Click outside
    on(document, 'click', (e) => {
      const clickedTrigger = this.elements.triggers.some(t => t.contains(e.target));

      if (this.isDrawerOpen && 
          this.elements.drawer && 
          !this.elements.drawer.contains(e.target) && 
          !clickedTrigger) {
        this.closeDrawer();
      }
    });
  }

  /**
   * Toggle drawer open/close
   */
  toggleDrawer() {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  /**
   * Open notification drawer
   */
  openDrawer() {
    this.isDrawerOpen = true;
    this.clearAnimationTimeouts();

    if (this.elements.drawer) {
      this.elements.drawer.classList.add('isopen');

      const cards = $$('.notification-card', this.elements.drawer);
      cards.forEach((card, index) => {
        const timeout = setTimeout(() => {
          if (this.isDrawerOpen) {
            card.classList.add('is-active');
          }
        }, index * UI_CONFIG.animation.cardStagger);
        
        this.animationTimeouts.push(timeout);
      });
    }

    debugLog('Notifications', 'Drawer opened');
  }

  /**
   * Close notification drawer
   */
  closeDrawer() {
    this.isDrawerOpen = false;
    this.clearAnimationTimeouts();

    if (this.elements.drawer) {
      const cards = Array.from($$('.notification-card', this.elements.drawer)).reverse();

      cards.forEach((card, index) => {
        const timeout = setTimeout(() => {
          card.classList.remove('is-active');
        }, index * UI_CONFIG.animation.cardExit);
        
        this.animationTimeouts.push(timeout);
      });

      const finalTimeout = setTimeout(() => {
        if (!this.isDrawerOpen) {
          this.elements.drawer.classList.remove('isopen');
        }
      }, (cards.length * UI_CONFIG.animation.cardExit) + 250);
      
      this.animationTimeouts.push(finalTimeout);
    }

    debugLog('Notifications', 'Drawer closed');
  }

  /**
   * Clear animation timeouts
   */
  clearAnimationTimeouts() {
    this.animationTimeouts.forEach(t => clearTimeout(t));
    this.animationTimeouts = [];
  }

  /**
   * Fetch notifications from API
   * @returns {Promise}
   */
  async fetchNotifications() {
    try {
      this.notifications = await NotificationAPI.get(API_ENDPOINTS.notification.get);
      this.renderNotifications();
      debugLog('Notifications', `Fetched ${this.notifications.length} notifications`);
    } catch (error) {
      debugLog('Notifications', 'Failed to fetch notifications:', error);
      this.renderError();
    }
  }

  /**
   * Render notifications in drawer
   */
  renderNotifications() {
    if (!this.elements.drawer || !this.templateCard) return;

    // Clear existing cards
    $$('.notification-card', this.elements.drawer).forEach(card => card.remove());

    if (this.notifications.length === 0) {
      this.renderEmpty();
      return;
    }

    this.notifications.forEach((notification) => {
      const card = this.createNotificationCard(notification);
      this.elements.drawer.appendChild(card);

      if (this.isDrawerOpen) {
        card.classList.add('is-active');
      }
    });
  }

  /**
   * Create notification card element
   * @param {Object} notification 
   * @returns {HTMLElement}
   */
  createNotificationCard(notification) {
    const card = this.templateCard.cloneNode(true);
    card.dataset.notificationId = notification.id;
    card.classList.remove('is-active');

    if (!notification.is_read) {
      card.classList.add('is-unread');
    }

    // Avatar
    const avatarImg = $('.navbar-avatar', card) || $('img', card);
    if (avatarImg) {
      avatarImg.src = formatAvatarUrl(notification._user?.avatar_url);
      avatarImg.alt = notification._user?.name || 'User';
    }

    // Text content
    const userName = notification._user?.name || 'Someone';
    const timeAgo = dayjs(notification.created_at).fromNow();

    const textContent = `
      <strong>${userName}</strong> ${notification.notification_text}
      <br><span style="font-size: 0.875rem; opacity: 0.7;">${timeAgo}</span>
    `;

    const textElement = $('.notification-text', card);
    if (textElement) {
      textElement.innerHTML = textContent;
    } else {
      const textDiv = document.createElement('div');
      textDiv.className = 'notification-text';
      textDiv.innerHTML = textContent;
      textDiv.style.flex = '1';
      textDiv.style.marginLeft = '12px';
      card.appendChild(textDiv);
    }

    // Thumbnail (desktop only)
    if (notification.display_url && 
        notification._content_list && 
        window.innerWidth > UI_CONFIG.breakpoints.tablet) {
      this.addThumbnail(card, notification);
    }

    // Click handler
    on(card, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleNotificationClick(notification, card);
    });

    card.style.cursor = 'pointer';
    return card;
  }

  /**
   * Add thumbnail to notification card
   * @param {HTMLElement} card 
   * @param {Object} notification 
   */
  addThumbnail(card, notification) {
    const isVideo = notification._content_list.content_type === 'video';
    const thumbnailUrl = isVideo
      ? notification.display_url
      : notification.display_url + '?width=80';

    const thumbnail = document.createElement('div');
    thumbnail.className = 'notification-thumbnail';
    thumbnail.style.cssText = 'width: 48px; height: 48px; border-radius: 8px; overflow: hidden; margin-left: auto; flex-shrink: 0;';

    const img = document.createElement('img');
    img.src = thumbnailUrl;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

    thumbnail.appendChild(img);
    card.appendChild(thumbnail);
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    const emptyCard = this.templateCard.cloneNode(true);
    const textDiv = document.createElement('div');
    textDiv.style.cssText = 'text-align: center; padding: 24px; opacity: 0.6; width: 100%';
    textDiv.innerHTML = '<p>No notifications yet</p>';
    
    emptyCard.innerHTML = '';
    emptyCard.appendChild(textDiv);
    this.elements.drawer.appendChild(emptyCard);

    setTimeout(() => emptyCard.classList.add('is-active'), 50);
  }

  /**
   * Render error state
   */
  renderError() {
    const errorCard = this.templateCard.cloneNode(true);
    const textDiv = document.createElement('div');
    textDiv.style.cssText = 'text-align: center; padding: 24px; color: #ff4444; width: 100%';
    textDiv.innerHTML = '<p>Unable to load notifications.</p>';
    
    errorCard.innerHTML = '';
    errorCard.appendChild(textDiv);
    this.elements.drawer.appendChild(errorCard);

    setTimeout(() => errorCard.classList.add('is-active'), 50);
  }

  /**
   * Handle notification click
   * @param {Object} notification 
   * @param {HTMLElement} cardElement 
   */
  async handleNotificationClick(notification, cardElement) {
    // Mark as read
    if (!notification.is_read) {
      try {
        await this.markAsRead(notification.id);
        notification.is_read = true;
        cardElement.classList.remove('is-unread');
        this.updateBadge();
      } catch (error) {
        debugLog('Notifications', 'Failed to mark as read:', error);
      }
    }

    // Handle notification type
    const hasContent = [
      NOTIFICATION_TYPES.POST_LIKE,
      NOTIFICATION_TYPES.COMMENT_LIKE,
      NOTIFICATION_TYPES.CREATOR_COMMENT_REPLY,
      NOTIFICATION_TYPES.CREATOR_NEW_COMMENT,
      NOTIFICATION_TYPES.COMMENT_REPLY,
      NOTIFICATION_TYPES.NEW_POST
    ].includes(notification.notification_type);

    if (hasContent && notification._content_list) {
      await this.openLightboxFromNotification(notification);
      this.closeDrawer();
      return;
    }

    if (notification.notification_type === NOTIFICATION_TYPES.NEW_MESSAGE) {
      this.closeDrawer();
      setTimeout(() => {
        window.location.href = ROUTES.messages;
      }, 400);
      return;
    }

    this.closeDrawer();
  }

  /**
   * Open lightbox from notification
   * @param {Object} notification 
   */
  async openLightboxFromNotification(notification) {
    // Check if Alpine is available
    if (!window.Alpine || !window.Alpine.store('app')) {
      window.location.href = `${ROUTES.feed}?content_id=${notification.related_content_list_id}${notification.related_comment_id ? '&comment_id=' + notification.related_comment_id : ''}`;
      return;
    }

    const feedApp = document.querySelector('[x-data]').__x?.$data;
    if (!feedApp) return;

    const post = {
      id: notification._content_list.id,
      created_at: notification._content_list.created_at,
      content_type: notification._content_list.content_type,
      display_url: notification.display_url,
      likes_count: notification._content_list.likes_count,
      comments_count: notification._content_list.comments_count,
      commentsLoaded: false,
      comments: [],
      commentUsers: {}
    };

    window.Alpine.store('app').openLightbox(post, feedApp.players, feedApp);

    // Handle comment deep linking
    if (notification.related_comment_id) {
      await this.scrollToComment(notification, feedApp, post);
    }
  }

  /**
   * Scroll to comment in lightbox
   * @param {Object} notification 
   * @param {Object} feedApp 
   * @param {Object} post 
   */
  async scrollToComment(notification, feedApp, post) {
    try {
      await new Promise(r => setTimeout(r, 400));

      const [commentsRes, commentRes] = await Promise.all([
        CommentAPI.get(API_ENDPOINTS.comment.getComments, {
          searchParams: { content_id: notification.related_content_list_id }
        }),
        CommentAPI.get(API_ENDPOINTS.comment.getComment, {
          searchParams: { comment_id: notification.related_comment_id }
        })
      ]);

      const userMap = {};
      (commentsRes.user_list || []).forEach(u => {
        userMap[u.id] = { ...u, avatar_url: formatAvatarUrl(u.avatar_url) };
      });

      let comments = (commentsRes.structured_comments || []).map(c => ({
        ...c,
        timeAgo: dayjs(c.created_at).fromNow(),
        replies: (c.replies || []).map(r => ({ ...r, timeAgo: dayjs(r.created_at).fromNow() }))
      }));

      if (commentRes.comment_parent) {
        let parent = comments.find(c => c.id === commentRes.comment_parent.id);
        if (parent) parent.areRepliesOpen = true;
      }

      post.comments = comments;
      post.commentUsers = userMap;
      post.commentsLoaded = true;
      feedApp.activePost = post;

      setTimeout(() => {
        const el = document.querySelector(`[data-comment-id="${notification.related_comment_id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.backgroundColor = 'rgba(77, 101, 255, 0.2)';
          setTimeout(() => el.style.backgroundColor = '', 2000);
        }
      }, 600);
    } catch (e) {
      debugLog('Notifications', 'Failed to scroll to comment:', e);
    }
  }

  /**
   * Mark notification as read
   * @param {number} notificationId 
   * @returns {Promise}
   */
  async markAsRead(notificationId) {
    await NotificationAPI.post(API_ENDPOINTS.notification.markRead, {
      json: { notification_id: notificationId }
    });
  }

  /**
   * Update unread badge
   */
  updateBadge() {
    this.unreadCount = this.notifications.filter(n => !n.is_read).length;

    this.elements.unreadBadges.forEach(badge => {
      badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
    });

    debugLog('Notifications', `Unread count: ${this.unreadCount}`);
  }

  /**
   * Refresh notifications
   * @returns {Promise}
   */
  async refresh() {
    await this.fetchNotifications();
    this.updateBadge();
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.clearAnimationTimeouts();
    debugLog('Notifications', 'Cleaned up');
  }
}

/**
 * Initialize notification manager
 * @returns {NotificationManager|null}
 */
export function initNotifications() {
  // Only initialize if user is authenticated
  if (!localStorage.getItem('authToken')) {
    debugLog('Notifications', 'Not authenticated, skipping init');
    return null;
  }

  const manager = new NotificationManager();
  manager.init();

  // Expose globally
  window.notificationManager = manager;

  return manager;
}

export default NotificationManager;
