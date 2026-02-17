/**
 * @fileoverview Comments system with emoji picker
 * @module modules/feed/comments
 */

import { CommentAPI } from '../../core/api.js';
import { API_ENDPOINTS, debugLog } from '../../core/constants.js';
import { formatCommentText, formatAvatarUrl } from '../../utils/format.js';
import { scrollToElement } from '../../utils/dom.js';
import dayjs from 'dayjs';

/**
 * Comments Manager
 */
export class CommentsManager {
  constructor(state) {
    this.state = state;
    this.emojiPickers = {
      drawer: null,
      lightbox: null
    };
  }

  /**
   * Load comments for a post
   * @param {Object} post 
   * @returns {Promise}
   */
  async loadComments(post) {
    if (post.commentsLoaded) {
      debugLog('Comments', 'Comments already loaded');
      return;
    }

    try {
      const response = await CommentAPI.get(API_ENDPOINTS.comment.getComments, {
        searchParams: { content_id: post.id }
      });

      // Build user map
      const userMap = {};
      (response.user_list || []).forEach(user => {
        userMap[user.id] = {
          ...user,
          avatar_url: formatAvatarUrl(user.avatar_url)
        };
      });

      // Format comments with time
      const comments = (response.structured_comments || []).map(comment => ({
        ...comment,
        timeAgo: dayjs(comment.created_at).fromNow(true),
        areRepliesOpen: false,
        is_liked: !!comment.is_liked,
        replies: (comment.replies || []).map(reply => ({
          ...reply,
          timeAgo: dayjs(reply.created_at).fromNow(true),
          is_liked: !!reply.is_liked
        }))
      }));

      post.comments = comments;
      post.commentUsers = userMap;
      post.commentsLoaded = true;

      debugLog('Comments', `Loaded ${comments.length} comments for post ${post.id}`);
    } catch (error) {
      debugLog('Comments', 'Failed to load comments:', error);
      throw error;
    }
  }

  /**
   * Post a new comment
   * @param {Object} post 
   * @param {string} text 
   * @param {number|null} parentId 
   * @returns {Promise}
   */
  async postComment(post, text, parentId = null) {
    if (!text || !text.trim()) {
      throw new Error('Comment text is required');
    }

    const payload = {
      content_id: post.id,
      comment_text: text.trim()
    };

    if (parentId) {
      payload.parent_comment_id = parentId;
    }

    try {
      await CommentAPI.post(API_ENDPOINTS.comment.postComment, {
        json: payload
      });

      debugLog('Comments', 'Comment posted successfully');

      // Increment comment count
      if (post.comments_count < 999) {
        post.comments_count++;
      }

      // Reload comments
      post.commentsLoaded = false;
      await this.loadComments(post);
    } catch (error) {
      debugLog('Comments', 'Failed to post comment:', error);
      throw error;
    }
  }

  /**
   * Toggle comment like
   * @param {Object} comment 
   * @returns {Promise}
   */
  async toggleCommentLike(comment) {
    const originalState = comment.is_liked;
    const originalCount = comment.likes_count || 0;

    // Optimistic update
    comment.is_liked = !originalState;
    comment.likes_count = originalCount + (comment.is_liked ? 1 : -1);

    try {
      await CommentAPI.post(API_ENDPOINTS.comment.likeComment, {
        json: {
          comment_id: comment.id,
          like: comment.is_liked
        }
      });

      debugLog('Comments', `Comment ${comment.id} like toggled`);
    } catch (error) {
      // Revert on error
      comment.is_liked = originalState;
      comment.likes_count = originalCount;
      debugLog('Comments', 'Failed to toggle like:', error);
      throw error;
    }
  }

  /**
   * Toggle replies visibility
   * @param {Object} comment 
   */
  toggleReplies(comment) {
    comment.areRepliesOpen = !comment.areRepliesOpen;
    debugLog('Comments', `Replies ${comment.areRepliesOpen ? 'opened' : 'closed'} for comment ${comment.id}`);
  }

  /**
   * Get comment user data
   * @param {Object} post 
   * @param {number} userId 
   * @returns {Object}
   */
  getCommentUser(post, userId) {
    return post?.commentUsers?.[userId] || {
      name: 'User',
      avatar_url: formatAvatarUrl(null)
    };
  }

  /**
   * Render merged content (username + comment text)
   * @param {Object} post 
   * @param {number} userId 
   * @param {string} text 
   * @returns {string}
   */
  renderMergedContent(post, userId, text) {
    const user = this.getCommentUser(post, userId);
    const nameHtml = `<span style="font-weight: 500; margin-right: 4px; color: #FFFFFF;">${user.name}</span>`;
    const formattedText = formatCommentText(text || '');
    return nameHtml + formattedText;
  }

  /**
   * Scroll to specific comment (for deep linking)
   * @param {string} commentId 
   */
  scrollToComment(commentId) {
    setTimeout(() => {
      const element = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (element) {
        scrollToElement(element, { behavior: 'smooth', block: 'center' });
        
        // Highlight effect
        element.style.backgroundColor = 'rgba(77, 101, 255, 0.2)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 600);
  }

  /**
   * Load specific comment by ID (for deep linking)
   * @param {number} commentId 
   * @returns {Promise<Object>}
   */
  async loadComment(commentId) {
    try {
      const response = await CommentAPI.get(API_ENDPOINTS.comment.getComment, {
        searchParams: { comment_id: commentId }
      });

      return response;
    } catch (error) {
      debugLog('Comments', 'Failed to load comment:', error);
      throw error;
    }
  }

  /**
   * Initialize emoji picker
   * @param {boolean} isLightbox 
   * @returns {Promise}
   */
  async initEmojiPicker(isLightbox = false) {
    const key = isLightbox ? 'lightbox' : 'drawer';
    
    if (this.emojiPickers[key]) {
      debugLog('Comments', 'Emoji picker already initialized');
      return;
    }

    try {
      const { createPicker } = await import('picmo');
      const containerId = isLightbox ? 'emoji-picker-container-lightbox' : 'emoji-picker-container';
      const container = document.getElementById(containerId);

      if (!container) {
        debugLog('Comments', 'Emoji picker container not found');
        return;
      }

      const picker = createPicker({
        rootElement: container,
        theme: 'dark',
        className: 'custom-picmo'
      });

      this.emojiPickers[key] = picker;

      debugLog('Comments', `Emoji picker initialized for ${key}`);
    } catch (error) {
      debugLog('Comments', 'Failed to initialize emoji picker:', error);
    }
  }

  /**
   * Toggle emoji picker visibility
   * @param {boolean} isLightbox 
   */
  async toggleEmojiPicker(isLightbox = false) {
    const key = isLightbox ? 'lightbox' : 'drawer';
    const stateKey = isLightbox ? 'showLightboxEmojiPicker' : 'showEmojiPicker';

    this.state[stateKey] = !this.state[stateKey];

    if (this.state[stateKey] && !this.emojiPickers[key]) {
      await this.initEmojiPicker(isLightbox);
    }
  }

  /**
   * Insert emoji at cursor position
   * @param {string} emoji 
   * @param {boolean} isLightbox 
   */
  insertEmoji(emoji, isLightbox = false) {
    const textareaId = isLightbox ? 'comment-input-lightbox' : 'comment-input-drawer';
    const textarea = document.getElementById(textareaId);

    if (!textarea) {
      // Fallback: append to end
      this.state.commentInput.text += emoji;
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = this.state.commentInput.text || '';

    // Insert emoji at cursor position
    const newText = currentText.substring(0, start) + emoji + currentText.substring(end);
    this.state.commentInput.text = newText;

    // Update textarea and restore cursor position
    textarea.value = newText;
    const newCursorPos = start + emoji.length;
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      
      // Trigger input event for Alpine reactivity
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);

    debugLog('Comments', 'Emoji inserted at position', start);
  }

  /**
   * Setup emoji picker event listeners
   * @param {boolean} isLightbox 
   */
  setupEmojiPickerListener(isLightbox = false) {
    const key = isLightbox ? 'lightbox' : 'drawer';
    const picker = this.emojiPickers[key];

    if (!picker) return;

    picker.addEventListener('emoji:select', (selection) => {
      this.insertEmoji(selection.emoji, isLightbox);
      
      // Close picker after selection
      if (isLightbox) {
        this.state.showLightboxEmojiPicker = false;
      } else {
        this.state.showEmojiPicker = false;
      }
    });
  }

  /**
   * Cleanup emoji pickers
   */
  cleanup() {
    Object.values(this.emojiPickers).forEach(picker => {
      if (picker && picker.destroy) {
        picker.destroy();
      }
    });
    this.emojiPickers = { drawer: null, lightbox: null };
  }
}

export default CommentsManager;
