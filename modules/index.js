/**
 * @fileoverview Avatar upload manager
 * @module modules/avatar/index
 */

import { uploadFile } from '../../core/api.js';
import { API_ENDPOINTS, debugLog } from '../../core/constants.js';
import { getAuthToken } from '../../core/storage.js';
import { $$ } from '../../utils/dom.js';
import { formatAvatarUrl } from '../../utils/format.js';

/**
 * Avatar Upload Manager
 */
export class AvatarUploadManager {
  constructor() {
    this.endpoint = `${API_ENDPOINTS.avatar.base}/${API_ENDPOINTS.avatar.upload}`;
    this.selector = '[data-element="user-avatar"]';
    this.fileInput = null;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  }

  /**
   * Initialize avatar upload
   */
  init() {
    // Create hidden file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    // Listen for clicks on avatar
    document.addEventListener('click', (e) => {
      const avatarEl = e.target.closest(this.selector);
      if (avatarEl) {
        debugLog('Avatar', 'Avatar click detected, opening file picker...');
        this.fileInput.click();
      }
    });

    // Handle file selection
    this.fileInput.addEventListener('change', () => this.handleUpload());

    debugLog('Avatar', 'Avatar upload manager initialized');
  }

  /**
   * Validate file
   * @param {File} file 
   * @returns {Object}
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }

    if (!this.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please select a JPG, PNG, WEBP, or GIF image.'
      };
    }

    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        error: 'File is too large. Maximum size is 5MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Handle file upload
   * @returns {Promise}
   */
  async handleUpload() {
    const file = this.fileInput.files[0];
    if (!file) return;

    const token = getAuthToken();
    if (!token) {
      this.showError('Please log in to change your photo.');
      return;
    }

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      this.showError(validation.error);
      this.fileInput.value = '';
      return;
    }

    debugLog('Avatar', 'Uploading image to Xano...');

    // Show loading state
    const avatars = $$(this.selector);
    avatars.forEach(img => {
      img.style.opacity = '0.5';
      img.style.cursor = 'wait';
    });

    try {
      const formData = new FormData();
      formData.append('content_file', file);

      // Upload with progress tracking
      const response = await uploadFile(
        this.endpoint,
        formData,
        (progress) => {
          debugLog('Avatar', `Upload progress: ${progress.toFixed(0)}%`);
        }
      );

      const newAvatarUrl = response.result.avatar_url;
      debugLog('Avatar', 'Upload successful:', newAvatarUrl);

      // Update local data
      this.updateLocalData(newAvatarUrl);

      // Update UI
      this.updateUI(newAvatarUrl);

      // Show success message
      this.showSuccess('Profile photo updated successfully!');

    } catch (error) {
      debugLog('Avatar', 'Upload failed:', error);
      this.showError('Failed to upload image. Please try again.');
    } finally {
      // Reset loading state
      avatars.forEach(img => {
        img.style.opacity = '1';
        img.style.cursor = 'pointer';
      });
      this.fileInput.value = '';
    }
  }

  /**
   * Update local data storage
   * @param {string} newUrl 
   */
  updateLocalData(newUrl) {
    // Update global currentUser
    if (window.currentUser) {
      window.currentUser.avatar_url = newUrl;
    }

    // Update localStorage
    const storedData = JSON.parse(localStorage.getItem('userData') || '{}');
    storedData.avatar_url = newUrl;
    localStorage.setItem('userData', JSON.stringify(storedData));

    // Update authManager if available
    if (window.authManager) {
      window.authManager.updateUser({ avatar_url: newUrl });
    }

    debugLog('Avatar', 'Local storage updated with new avatar URL');
  }

  /**
   * Update UI with new avatar
   * @param {string} newUrl 
   */
  updateUI(newUrl) {
    const formattedUrl = formatAvatarUrl(newUrl);
    const avatars = $$(this.selector);

    avatars.forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = formattedUrl;
      } else {
        el.style.backgroundImage = `url('${formattedUrl}')`;
      }
    });

    debugLog('Avatar', `Updated ${avatars.length} avatar elements`);
  }

  /**
   * Show error message
   * @param {string} message 
   */
  showError(message) {
    // Try to use existing popup system
    if (window.Alpine && window.Alpine.store('app')) {
      const feedApp = document.querySelector('[x-data]').__x?.$data;
      if (feedApp && feedApp.showPopup) {
        feedApp.showPopup({
          header: 'Error',
          message: message,
          btnText: 'OK',
          btnAction: () => feedApp.hidePopup()
        });
        return;
      }
    }

    // Fallback to alert
    alert(message);
  }

  /**
   * Show success message
   * @param {string} message 
   */
  showSuccess(message) {
    // Try to use existing popup system
    if (window.Alpine && window.Alpine.store('app')) {
      const feedApp = document.querySelector('[x-data]').__x?.$data;
      if (feedApp && feedApp.showPopup) {
        feedApp.showPopup({
          header: 'Success',
          message: message,
          btnText: 'OK',
          btnAction: () => feedApp.hidePopup()
        });
        return;
      }
    }

    // Fallback to console
    debugLog('Avatar', message);
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.fileInput && this.fileInput.parentNode) {
      this.fileInput.parentNode.removeChild(this.fileInput);
    }
    debugLog('Avatar', 'Cleaned up');
  }
}

/**
 * Initialize avatar upload manager
 * @returns {AvatarUploadManager}
 */
export function initAvatarUpload() {
  const manager = new AvatarUploadManager();
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => manager.init());
  } else {
    manager.init();
  }

  // Expose globally
  window.avatarUploadManager = manager;

  return manager;
}

export default AvatarUploadManager;
