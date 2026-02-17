/**
 * @fileoverview Data formatting utilities
 * @module utils/format
 */

import { DEFAULTS } from '../core/constants.js';

/**
 * Format avatar URL
 * @param {string} url 
 * @returns {string}
 */
export function formatAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return DEFAULTS.placeholder;
  }
  
  // Don't modify data URLs
  if (url.startsWith('data:image')) {
    return url;
  }
  
  // Return URL as-is (Xano handles tokens)
  return url;
}

/**
 * Format image URL with width parameter
 * @param {string} url 
 * @param {number} width 
 * @returns {string}
 */
export function formatImageUrl(url, width = null) {
  if (!url) return DEFAULTS.placeholder;
  
  if (width && !url.includes('?')) {
    return `${url}?width=${width}`;
  }
  
  return url;
}

/**
 * Format number with compact notation
 * @param {number} num 
 * @returns {string}
 */
export function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hours > 0) parts.push(hours);
  parts.push(minutes.toString().padStart(hours > 0 ? 2 : 1, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
}

/**
 * Truncate text with ellipsis
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string}
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} html 
 * @returns {string}
 */
export function sanitizeHTML(html) {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

/**
 * Parse and format comment text with mentions
 * @param {string} text 
 * @returns {string}
 */
export function formatCommentText(text) {
  if (!text) return '';
  
  // Sanitize first
  const sanitized = sanitizeHTML(text);
  
  // Format mentions
  return sanitized.replace(/@(\w+)/g, '<span style="color: #4D65FF;">@$1</span>');
}

/**
 * Format bytes to human readable size
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create initials from name
 * @param {string} name 
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return '?';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Parse URL query parameters
 * @param {string} url 
 * @returns {Object}
 */
export function parseQueryParams(url = window.location.search) {
  const params = new URLSearchParams(url);
  const result = {};
  
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  
  return result;
}

/**
 * Build URL with query parameters
 * @param {string} baseUrl 
 * @param {Object} params 
 * @returns {string}
 */
export function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl, window.location.origin);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param {string} url 
 * @returns {boolean}
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate random ID
 * @param {string} prefix 
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone object (Safari compatible)
 * @param {any} obj 
 * @returns {any}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Use structured clone if available (modern browsers)
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // Fall through to JSON method
    }
  }
  
  // Fallback to JSON method
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // Last resort: manual clone
    if (Array.isArray(obj)) {
      return obj.map(item => deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

export default {
  formatAvatarUrl,
  formatImageUrl,
  formatNumber,
  formatDuration,
  truncateText,
  sanitizeHTML,
  formatCommentText,
  formatFileSize,
  getInitials,
  parseQueryParams,
  buildUrl,
  isValidEmail,
  isValidUrl,
  generateId,
  deepClone,
};
