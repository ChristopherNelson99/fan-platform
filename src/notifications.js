/**
 * notifications.js — Notification Manager
 * Fetches, renders, and handles notification interactions.
 * ──────────────────────────────────────────────────────────────
 * SAFARI FIX: Uses `matchMedia` instead of `window.innerWidth` for
 *             thumbnail visibility (handles orientation changes).
 * MOBILE FIX: Staggered card animations use requestAnimationFrame.
 */

import { authenticatedKy } from './api.js';
import { NOTIFICATION_CONFIG, PLACEHOLDER } from './config.js';
import { dayjs, isDesktop } from './utils.js';

// ─── Notification Type Handlers ──────────────────────────────
const HANDLERS = {
  creator_new_tip:      () => ({ hasContent: false }),
  creator_new_follower: () => ({ hasContent: false }),
  post_like:            () => ({ hasContent: true }),
  comment_like:         () => ({ hasContent: true }),
  creator_comment_reply:() => ({ hasContent: true }),
  creator_new_comment:  () => ({ hasContent: true }),
  new_message:          () => ({ hasContent: false, redirectTo: NOTIFICATION_CONFIG.routes.messages }),
  comment_reply:        () => ({ hasContent: true }),
  new_post:             () => ({ hasContent: true }),
};

// ─── Notification Manager ────────────────────────────────────
export class NotificationManager {
  constructor() {
    this.notifications = [];
    this.isDrawerOpen = false;
    this.elements = {};
    this.templateCard = null;
    this._animTimers = [];
  }

  async init() {
    this._cacheElements();
    if (this.elements.triggers.length === 0 || !this.elements.drawer) return;

    this._saveTemplate();
    this._bindEvents();
    await this.fetchNotifications();
    this._updateBadge();
  }

  // ── DOM Setup ────────────────────────────────────────────
  _cacheElements() {
    const S = NOTIFICATION_CONFIG.selectors;
    this.elements = {
      triggers:     document.querySelectorAll(S.trigger),
      drawer:       document.querySelector(S.drawer),
      closeButton:  document.querySelector(S.closeButton),
      unreadBadges: document.querySelectorAll(S.unreadBadge),
    };
  }

  _saveTemplate() {
    const tpl = document.querySelector(NOTIFICATION_CONFIG.selectors.template);
    if (tpl) {
      this.templateCard = tpl.cloneNode(true);
      this.templateCard.classList.remove(NOTIFICATION_CONFIG.classes.cardActive);
      tpl.remove();
    }
  }

  _bindEvents() {
    const C = NOTIFICATION_CONFIG.classes;

    this.elements.triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleDrawer();
      });
    });

    this.elements.closeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._closeDrawer();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDrawerOpen) this._closeDrawer();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      const clickedTrigger = Array.from(this.elements.triggers).some((t) => t.contains(e.target));
      if (this.isDrawerOpen && !this.elements.drawer.contains(e.target) && !clickedTrigger) {
        this._closeDrawer();
      }
    });
  }

  // ── Drawer Animation ─────────────────────────────────────
  _toggleDrawer() {
    this.isDrawerOpen ? this._closeDrawer() : this._openDrawer();
  }

  _openDrawer() {
    this.isDrawerOpen = true;
    this._clearTimers();
    this.elements.drawer.classList.add(NOTIFICATION_CONFIG.classes.drawerOpen);

    const cards = this.elements.drawer.querySelectorAll('.notification-card');
    cards.forEach((card, i) => {
      const id = setTimeout(() => {
        if (this.isDrawerOpen) card.classList.add(NOTIFICATION_CONFIG.classes.cardActive);
      }, i * 60);
      this._animTimers.push(id);
    });
  }

  _closeDrawer() {
    this.isDrawerOpen = false;
    this._clearTimers();

    const cards = Array.from(this.elements.drawer.querySelectorAll('.notification-card')).reverse();
    cards.forEach((card, i) => {
      const id = setTimeout(() => card.classList.remove(NOTIFICATION_CONFIG.classes.cardActive), i * 40);
      this._animTimers.push(id);
    });

    const finalId = setTimeout(() => {
      if (!this.isDrawerOpen) {
        this.elements.drawer.classList.remove(NOTIFICATION_CONFIG.classes.drawerOpen);
      }
    }, cards.length * 25 + 250);
    this._animTimers.push(finalId);
  }

  _clearTimers() {
    this._animTimers.forEach(clearTimeout);
    this._animTimers = [];
  }

  // ── Data Fetching ────────────────────────────────────────
  async fetchNotifications() {
    try {
      this.notifications = await authenticatedKy.get(NOTIFICATION_CONFIG.endpoints.get).json();
      this._render();
    } catch (err) {
      console.error('[Notifications] Fetch failed:', err);
      this._renderError();
    }
  }

  // ── Rendering ────────────────────────────────────────────
  _render() {
    if (!this.elements.drawer || !this.templateCard) return;

    // Clear existing
    this.elements.drawer.querySelectorAll('.notification-card').forEach((c) => c.remove());

    if (this.notifications.length === 0) {
      this._renderEmpty();
      return;
    }

    this.notifications.forEach((n) => {
      const card = this._createCard(n);
      this.elements.drawer.appendChild(card);
      if (this.isDrawerOpen) card.classList.add(NOTIFICATION_CONFIG.classes.cardActive);
    });
  }

  _createCard(notification) {
    const card = this.templateCard.cloneNode(true);
    card.dataset.notificationId = notification.id;
    card.classList.remove(NOTIFICATION_CONFIG.classes.cardActive);

    if (!notification.is_read) {
      card.classList.add(NOTIFICATION_CONFIG.classes.cardUnread);
    }

    // Avatar
    const avatarImg = card.querySelector('.navbar-avatar');
    if (avatarImg) {
      avatarImg.src = notification._user?.avatar_url || PLACEHOLDER;
      avatarImg.alt = notification._user?.name || 'User';
    }

    // Text content
    const userName = notification._user?.name || 'Someone';
    const timeAgo = dayjs(notification.created_at).fromNow();
    const textContent = `
      <strong>${userName}</strong> ${notification.notification_text}
      <br><span style="font-size:0.875rem;opacity:0.7">${timeAgo}</span>
    `;

    const textEl = card.querySelector('.notification-text');
    if (textEl) {
      textEl.innerHTML = textContent;
    } else {
      const div = document.createElement('div');
      div.className = 'notification-text';
      div.innerHTML = textContent;
      div.style.cssText = 'flex:1;margin-left:12px';
      card.appendChild(div);
    }

    // Thumbnail (desktop only — uses matchMedia for Safari reliability)
    if (notification.display_url && notification._content_list && isDesktop()) {
      this._addThumbnail(card, notification);
    }

    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleClick(notification, card);
    });

    return card;
  }

  _addThumbnail(card, notification) {
    const isVideo = notification._content_list.content_type === 'video';
    const url = isVideo ? notification.display_url : `${notification.display_url}?width=80`;

    const thumb = document.createElement('div');
    thumb.className = 'notification-thumbnail';
    thumb.style.cssText = 'width:48px;height:48px;border-radius:8px;overflow:hidden;margin-left:auto;flex-shrink:0';

    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    img.loading = 'lazy';

    thumb.appendChild(img);
    card.appendChild(thumb);
  }

  _renderEmpty() {
    const card = this.templateCard.cloneNode(true);
    card.innerHTML = '<div style="text-align:center;padding:24px;opacity:0.6;width:100%"><p>No notifications yet</p></div>';
    this.elements.drawer.appendChild(card);
    setTimeout(() => card.classList.add(NOTIFICATION_CONFIG.classes.cardActive), 50);
  }

  _renderError() {
    const card = this.templateCard.cloneNode(true);
    card.innerHTML = '<div style="text-align:center;padding:24px;color:#ff4444;width:100%"><p>Unable to load notifications.</p></div>';
    this.elements.drawer.appendChild(card);
    setTimeout(() => card.classList.add(NOTIFICATION_CONFIG.classes.cardActive), 50);
  }

  // ── Click Handling ───────────────────────────────────────
  async _handleClick(notification, cardElement) {
    // Mark as read
    if (!notification.is_read) {
      try {
        await authenticatedKy.post(NOTIFICATION_CONFIG.endpoints.markRead, {
          json: { notification_id: notification.id },
        });
        notification.is_read = true;
        cardElement.classList.remove(NOTIFICATION_CONFIG.classes.cardUnread);
        this._updateBadge();
      } catch (err) {
        console.error('[Notifications] Mark-read failed:', err);
      }
    }

    const handler = HANDLERS[notification.notification_type];
    if (!handler) return;
    const { hasContent, redirectTo } = handler(notification);

    // Content-based notification → open lightbox or deep-link
    if (hasContent && notification._content_list) {
      await this._openFromNotification(notification);
      this._closeDrawer();
      return;
    }

    // Redirect-based (e.g. new_message)
    if (redirectTo) {
      this._closeDrawer();
      setTimeout(() => { window.location.href = redirectTo; }, 400);
      return;
    }

    this._closeDrawer();
  }

  async _openFromNotification(notification) {
    // If Alpine feed app is available, open lightbox in-page
    if (window.Alpine?.store('app')) {
      const store = window.Alpine.store('app');
      const post = {
        id:             notification._content_list.id,
        created_at:     notification._content_list.created_at,
        content_type:   notification._content_list.content_type,
        display_url:    notification.display_url,
        likes_count:    notification._content_list.likes_count,
        comments_count: notification._content_list.comments_count,
        commentsLoaded: false,
        comments:       [],
        commentUsers:   {},
      };

      const feedEl = document.querySelector('[x-data]');
      const feedApp = feedEl?.__x?.$data;
      if (!feedApp) {
        this._deepLinkFallback(notification);
        return;
      }

      store.openLightbox(post, feedApp.players, feedApp);

      // If targeting a specific comment, scroll to it
      if (notification.related_comment_id) {
        try {
          await new Promise((r) => setTimeout(r, 400));

          const [commentsRes] = await Promise.all([
            authenticatedKy.get(NOTIFICATION_CONFIG.endpoints.getComments, {
              searchParams: { content_id: notification.related_content_list_id },
            }).json(),
          ]);

          const userMap = {};
          (commentsRes.user_list || []).forEach((u) => {
            userMap[u.id] = { ...u, avatar_url: feedApp.formatAvatar(u.avatar_url) };
          });

          post.comments = (commentsRes.structured_comments || []).map((c) => ({
            ...c,
            timeAgo: dayjs(c.created_at).fromNow(),
            areRepliesOpen: false,
            replies: (c.replies || []).map((r) => ({ ...r, timeAgo: dayjs(r.created_at).fromNow() })),
          }));
          post.commentUsers = userMap;
          post.commentsLoaded = true;
          feedApp.activePost = post;

          setTimeout(() => {
            const el = document.querySelector(`[data-comment-id="${notification.related_comment_id}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.backgroundColor = 'rgba(77, 101, 255, 0.2)';
              setTimeout(() => (el.style.backgroundColor = ''), 2000);
            }
          }, 600);
        } catch (e) {
          console.error('[Notifications] Comment scroll failed:', e);
        }
      }
    } else {
      this._deepLinkFallback(notification);
    }
  }

  _deepLinkFallback(notification) {
    let url = `${NOTIFICATION_CONFIG.routes.feed}?content_id=${notification.related_content_list_id}`;
    if (notification.related_comment_id) url += `&comment_id=${notification.related_comment_id}`;
    window.location.href = url;
  }

  // ── Badge ────────────────────────────────────────────────
  _updateBadge() {
    const count = this.notifications.filter((n) => !n.is_read).length;
    this.elements.unreadBadges?.forEach((badge) => {
      badge.style.display = count > 0 ? 'flex' : 'none';
      badge.textContent = count > 99 ? '99+' : String(count);
    });
  }

  // ── Public Refresh ───────────────────────────────────────
  async refresh() {
    await this.fetchNotifications();
    this._updateBadge();
  }
}
