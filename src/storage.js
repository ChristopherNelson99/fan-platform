/**
 * @fileoverview LocalStorage utilities with Safari compatibility
 * @module core/storage
 */

import { STORAGE_KEYS, debugLog } from './constants.js';

/**
 * Storage Manager with Safari-compatible error handling
 * Handles quota exceeded errors and private browsing mode
 */
class StorageManager {
  constructor() {
    this.isAvailable = this.checkAvailability();
    this.quotaExceeded = false;
  }

  /**
   * Check if localStorage is available (Safari private mode check)
   * @returns {boolean}
   */
  checkAvailability() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      debugLog('Storage', 'localStorage not available:', e.message);
      return false;
    }
  }

  /**
   * Safely set item in localStorage
   * @param {string} key 
   * @param {string} value 
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    if (!this.isAvailable) {
      debugLog('Storage', 'Storage not available, using memory fallback');
      this._memoryStorage = this._memoryStorage || {};
      this._memoryStorage[key] = value;
      return false;
    }

    try {
      localStorage.setItem(key, value);
      this.quotaExceeded = false;
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        debugLog('Storage', 'Quota exceeded, clearing old data');
        this.quotaExceeded = true;
        this.clearNonEssential();
        
        // Try again after clearing
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          debugLog('Storage', 'Failed after clearing:', retryError);
          return false;
        }
      }
      debugLog('Storage', 'Set error:', e);
      return false;
    }
  }

  /**
   * Safely get item from localStorage
   * @param {string} key 
   * @returns {string|null}
   */
  getItem(key) {
    if (!this.isAvailable && this._memoryStorage) {
      return this._memoryStorage[key] || null;
    }

    try {
      return localStorage.getItem(key);
    } catch (e) {
      debugLog('Storage', 'Get error:', e);
      return null;
    }
  }

  /**
   * Safely remove item from localStorage
   * @param {string} key 
   */
  removeItem(key) {
    if (!this.isAvailable && this._memoryStorage) {
      delete this._memoryStorage[key];
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (e) {
      debugLog('Storage', 'Remove error:', e);
    }
  }

  /**
   * Clear all non-essential data
   */
  clearNonEssential() {
    const essentialKeys = [
      STORAGE_KEYS.authToken,
      STORAGE_KEYS.userData,
      STORAGE_KEYS.creatorData,
    ];

    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!essentialKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      debugLog('Storage', 'Cleared non-essential data');
    } catch (e) {
      debugLog('Storage', 'Clear error:', e);
    }
  }

  /**
   * Set JSON data
   * @param {string} key 
   * @param {any} data 
   * @returns {boolean}
   */
  setJSON(key, data) {
    try {
      const jsonString = JSON.stringify(data);
      return this.setItem(key, jsonString);
    } catch (e) {
      debugLog('Storage', 'JSON stringify error:', e);
      return false;
    }
  }

  /**
   * Get JSON data
   * @param {string} key 
   * @param {any} defaultValue 
   * @returns {any}
   */
  getJSON(key, defaultValue = null) {
    try {
      const item = this.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      debugLog('Storage', 'JSON parse error:', e);
      return defaultValue;
    }
  }
}

// Create singleton instance
export const storage = new StorageManager();

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Get auth token
 * @returns {string|null}
 */
export function getAuthToken() {
  return storage.getItem(STORAGE_KEYS.authToken);
}

/**
 * Set auth token
 * @param {string} token 
 */
export function setAuthToken(token) {
  storage.setItem(STORAGE_KEYS.authToken, token);
}

/**
 * Remove auth token
 */
export function removeAuthToken() {
  storage.removeItem(STORAGE_KEYS.authToken);
}

/**
 * Get user data
 * @returns {Object|null}
 */
export function getUserData() {
  return storage.getJSON(STORAGE_KEYS.userData);
}

/**
 * Set user data
 * @param {Object} userData 
 */
export function setUserData(userData) {
  storage.setJSON(STORAGE_KEYS.userData, userData);
}

/**
 * Get creator data
 * @returns {Object|null}
 */
export function getCreatorData() {
  return storage.getJSON(STORAGE_KEYS.creatorData);
}

/**
 * Set creator data
 * @param {Object} creatorData 
 */
export function setCreatorData(creatorData) {
  storage.setJSON(STORAGE_KEYS.creatorData, creatorData);
}

/**
 * Clear all auth-related data
 */
export function clearAuthData() {
  removeAuthToken();
  storage.removeItem(STORAGE_KEYS.userData);
  storage.removeItem(STORAGE_KEYS.creatorData);
}

/**
 * Trigger login event for cross-tab communication
 */
export function triggerLoginEvent() {
  storage.setItem(STORAGE_KEYS.loginEvent, Date.now().toString());
}

export default storage;
