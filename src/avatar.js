/**
 * avatar.js — Avatar Upload Manager
 * Handles profile picture selection, upload to Xano, and UI sync.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: Uploads use the user's JWE token, never an admin key.
 * SAFARI:   Uses FormData (supported since Safari 5).
 */

import ky from 'https://esm.sh/ky@1.7.2';
import { API_PREFIXES, AUTH_CONFIG } from './config.js';

const AVATAR_SELECTOR = '[data-element="user-avatar"]';

export class AvatarUploadManager {
  constructor() {
    this._fileInput = null;
  }

  init() {
    // Create hidden file input
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = 'image/*';
    this._fileInput.style.display = 'none';
    document.body.appendChild(this._fileInput);

    // Delegate click on avatar elements
    document.addEventListener('click', (e) => {
      if (e.target.closest(AVATAR_SELECTOR)) {
        this._fileInput.click();
      }
    });

    // Handle file selection
    this._fileInput.addEventListener('change', () => this._upload());
  }

  async _upload() {
    const file = this._fileInput.files[0];
    if (!file) return;

    const token = localStorage.getItem(AUTH_CONFIG.storage.authToken);
    if (!token) {
      alert('Please log in to change your photo.');
      return;
    }

    const avatars = document.querySelectorAll(AVATAR_SELECTOR);
    avatars.forEach((img) => (img.style.opacity = '0.5'));

    try {
      const formData = new FormData();
      formData.append('content_file', file);

      const response = await ky
        .post(`${API_PREFIXES.avatar}/photo_avatar`, {
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        })
        .json();

      const newUrl = response.result.avatar_url;
      this._syncLocal(newUrl);
      this._syncUI(newUrl);
    } catch (err) {
      console.error('[Avatar] Upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      avatars.forEach((img) => (img.style.opacity = '1'));
      this._fileInput.value = '';
    }
  }

  _syncLocal(newUrl) {
    if (window.currentUser) window.currentUser.avatar_url = newUrl;
    const stored = JSON.parse(localStorage.getItem(AUTH_CONFIG.storage.userData) || '{}');
    stored.avatar_url = newUrl;
    localStorage.setItem(AUTH_CONFIG.storage.userData, JSON.stringify(stored));
  }

  _syncUI(newUrl) {
    document.querySelectorAll(AVATAR_SELECTOR).forEach((el) => {
      if (el.tagName === 'IMG') {
        el.src = newUrl;
      } else {
        el.style.backgroundImage = `url('${newUrl}')`;
      }
    });
  }
}
