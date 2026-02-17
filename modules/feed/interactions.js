/**
 * @fileoverview Content interactions (likes, bookmarks) and deep linking
 * @module modules/feed/interactions
 */

import { CommentAPI } from '../../core/api.js';
import { API_ENDPOINTS, ROUTES, debugLog } from '../../core/constants.js';
import { parseQueryParams } from '../../utils/format.js';

/**
 * Content Interactions Manager
 */
export class InteractionsManager {
  constructor(state, commentsManager) {
    this.state = state;
    this.commentsManager = commentsManager;
  }

  /**
   * Toggle post like
   * @param {Object} post 
   * @returns {Promise}
   */
  async toggleLike(post) {
    const originalState = post.is_liked;
    const originalCount = post.likes_count;

    // Optimistic update
    post.is_liked = !originalState;
    post.likes_count += post.is_liked ? 1 : -1;

    try {
      await CommentAPI.post(API_ENDPOINTS.comment.likeContent, {
        json: {
          content_list_id: post.id,
          like: post.is_liked
        }
      });

      debugLog('Interactions', `Post ${post.id} like toggled`);
    } catch (error) {
      // Revert on error
      post.is_liked = originalState;
      post.likes_count = originalCount;
      debugLog('Interactions', 'Failed to toggle like:', error);
      throw error;
    }
  }

  /**
   * Toggle post bookmark
   * @param {Object} post 
   * @returns {Promise}
   */
  async toggleBookmark(post) {
    const originalState = post.is_bookmarked;

    // Optimistic update
    post.is_bookmarked = !originalState;

    try {
      await CommentAPI.post(API_ENDPOINTS.comment.bookmark, {
        json: {
          content_list_id: post.id,
          bookmark: post.is_bookmarked
        }
      });

      debugLog('Interactions', `Post ${post.id} bookmark toggled`);
    } catch (error) {
      // Revert on error
      post.is_bookmarked = originalState;
      debugLog('Interactions', 'Failed to toggle bookmark:', error);
      throw error;
    }
  }

  /**
   * Handle deep linking from URL parameters
   * Opens lightbox for specific content and scrolls to comment
   * @returns {Promise}
   */
  async handleDeepLink() {
    const params = parseQueryParams();
    const contentId = params.content_id;
    const commentId = params.comment_id;

    if (!contentId) {
      debugLog('DeepLink', 'No content_id in URL');
      return;
    }

    debugLog('DeepLink', 'Processing deep link', { contentId, commentId });

    try {
      // Find post in feed
      let post = this.state.feed.find(p => p.id === parseInt(contentId));

      // If not in feed, fetch it
      if (!post) {
        post = await this.fetchPost(contentId);
        if (post) {
          this.state.feed.unshift(post);
        }
      }

      if (!post) {
        this.showContentNotFound();
        return;
      }

      // Open lightbox
      await this.openLightboxForDeepLink(post, commentId);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
      debugLog('DeepLink', 'Failed to handle deep link:', error);
      this.showContentNotFound();
    }
  }

  /**
   * Fetch a specific post
   * @param {number} contentId 
   * @returns {Promise<Object|null>}
   */
  async fetchPost(contentId) {
    try {
      const endpoint = this.state.user.subscribed
        ? API_ENDPOINTS.feed.premium
        : API_ENDPOINTS.feed.unsubscribed;

      const response = await CommentAPI.get(endpoint, {
        searchParams: { page: 1, per_page: 50 }
      });

      const post = response.find(p => p.id === parseInt(contentId));

      if (post) {
        return {
          ...post,
          isPlaying: false,
          isMuted: true,
          commentsLoaded: false,
          comments: [],
          commentUsers: {}
        };
      }

      return null;
    } catch (error) {
      debugLog('DeepLink', 'Failed to fetch post:', error);
      return null;
    }
  }

  /**
   * Open lightbox for deep linked content
   * @param {Object} post 
   * @param {string|null} commentId 
   */
  async openLightboxForDeepLink(post, commentId) {
    // Check if Alpine store is available
    if (!window.Alpine || !window.Alpine.store('app')) {
      // Fallback: redirect to feed with params
      window.location.href = `${ROUTES.feed}?content_id=${post.id}${commentId ? '&comment_id=' + commentId : ''}`;
      return;
    }

    const appStore = window.Alpine.store('app');
    
    // Open lightbox
    appStore.lightbox.type = post.content_type;
    appStore.lightbox.url = post.display_url;
    appStore.lightbox.post = post;
    appStore.lightbox.show = true;
    this.state.activePost = post;

    document.body.style.overflow = 'hidden';

    // Load comments
    await this.commentsManager.loadComments(post);

    // If specific comment, expand parent and scroll to it
    if (commentId) {
      await this.scrollToDeepLinkedComment(post, commentId);
    }
  }

  /**
   * Scroll to deep linked comment
   * @param {Object} post 
   * @param {string} commentId 
   */
  async scrollToDeepLinkedComment(post, commentId) {
    try {
      // Load the specific comment to find its parent
      const commentData = await this.commentsManager.loadComment(commentId);

      if (commentData.comment_parent) {
        // Find parent comment and open replies
        const parentComment = post.comments.find(
          c => c.id === commentData.comment_parent.id
        );
        
        if (parentComment) {
          parentComment.areRepliesOpen = true;
        }
      }

      // Scroll to comment
      this.commentsManager.scrollToComment(commentId);

    } catch (error) {
      debugLog('DeepLink', 'Failed to scroll to comment:', error);
    }
  }

  /**
   * Show content not found popup
   */
  showContentNotFound() {
    this.state.showPopup({
      header: 'Content Not Found',
      message: 'This post may have been deleted or is no longer available.',
      btnText: 'OK',
      isLocked: false,
      showCloseIcon: true,
      btnAction: () => this.state.hidePopup()
    });
  }

  /**
   * Share content (native share API)
   * @param {Object} post 
   */
  async shareContent(post) {
    const shareData = {
      title: 'Check out this post',
      text: `Check out this content!`,
      url: `${window.location.origin}${ROUTES.feed}?content_id=${post.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        debugLog('Interactions', 'Content shared successfully');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url);
        this.state.showPopup({
          header: 'Link Copied',
          message: 'Link copied to clipboard',
          btnText: 'OK',
          btnAction: () => this.state.hidePopup()
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugLog('Interactions', 'Share failed:', error);
      }
    }
  }

  /**
   * Report content
   * @param {Object} post 
   */
  reportContent(post) {
    this.state.showPopup({
      header: 'Report Content',
      message: 'Are you sure you want to report this content?',
      btnText: 'Report',
      btnAction: async () => {
        try {
          // Implement report API call here
          debugLog('Interactions', 'Content reported:', post.id);
          this.state.showPopup({
            header: 'Reported',
            message: 'Thank you for your report.',
            btnText: 'OK',
            btnAction: () => this.state.hidePopup()
          });
        } catch (error) {
          debugLog('Interactions', 'Report failed:', error);
        }
      }
    });
  }
}

export default InteractionsManager;
