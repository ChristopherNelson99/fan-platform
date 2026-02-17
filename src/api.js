/**
 * @fileoverview API Client with authentication and error handling
 * @module core/api
 */

import ky from 'ky';
import { API_ENDPOINTS, ERROR_MESSAGES, debugLog, BROWSER_SUPPORT } from './constants.js';
import { getAuthToken } from './storage.js';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  /**
   * @param {string} message 
   * @param {number} status 
   * @param {any} data 
   */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Add authentication token to request
 * @param {Request} request 
 */
function addAuthHeader(request) {
  const token = getAuthToken();
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
}

/**
 * Handle API errors with retry logic
 * @param {Response} response 
 * @throws {APIError}
 */
async function handleError(response) {
  let errorMessage = ERROR_MESSAGES.api.serverError;
  let errorData = null;

  try {
    errorData = await response.json();
    errorMessage = errorData.message || errorMessage;
  } catch (e) {
    // Response is not JSON
    debugLog('API', 'Non-JSON error response');
  }

  const { status } = response;

  // Handle specific error codes
  if (status === 401) {
    errorMessage = ERROR_MESSAGES.auth.invalidToken;
  } else if (status === 403) {
    errorMessage = ERROR_MESSAGES.subscription.required;
  } else if (status === 429) {
    errorMessage = ERROR_MESSAGES.api.rateLimited;
  } else if (status === 404) {
    errorMessage = ERROR_MESSAGES.content.notFound;
  }

  throw new APIError(errorMessage, status, errorData);
}

/**
 * Safari-compatible timeout wrapper
 * @param {Promise} promise 
 * @param {number} ms 
 * @returns {Promise}
 */
function timeoutPromise(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}

/**
 * Create API client with configuration
 * @param {string} baseUrl 
 * @param {boolean} requiresAuth 
 * @returns {Object}
 */
function createAPIClient(baseUrl, requiresAuth = false) {
  const hooks = {};
  
  if (requiresAuth) {
    hooks.beforeRequest = [addAuthHeader];
  }

  // Safari-specific timeout handling
  const timeout = BROWSER_SUPPORT.isSafari || BROWSER_SUPPORT.isIOS ? 30000 : 20000;

  const client = ky.create({
    prefixUrl: baseUrl,
    timeout,
    retry: {
      limit: 2,
      methods: ['get'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
    },
    hooks: {
      ...hooks,
      afterResponse: [
        async (request, options, response) => {
          if (!response.ok) {
            await handleError(response);
          }
          return response;
        }
      ]
    }
  });

  return {
    /**
     * GET request
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise}
     */
    async get(endpoint, options = {}) {
      try {
        debugLog('API', `GET ${baseUrl}/${endpoint}`);
        const response = await timeoutPromise(client.get(endpoint, options).json());
        return response;
      } catch (error) {
        debugLog('API', 'GET error:', error);
        throw this.handleClientError(error);
      }
    },

    /**
     * POST request
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise}
     */
    async post(endpoint, options = {}) {
      try {
        debugLog('API', `POST ${baseUrl}/${endpoint}`);
        const response = await timeoutPromise(client.post(endpoint, options).json());
        return response;
      } catch (error) {
        debugLog('API', 'POST error:', error);
        throw this.handleClientError(error);
      }
    },

    /**
     * PUT request
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise}
     */
    async put(endpoint, options = {}) {
      try {
        debugLog('API', `PUT ${baseUrl}/${endpoint}`);
        const response = await timeoutPromise(client.put(endpoint, options).json());
        return response;
      } catch (error) {
        debugLog('API', 'PUT error:', error);
        throw this.handleClientError(error);
      }
    },

    /**
     * DELETE request
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise}
     */
    async delete(endpoint, options = {}) {
      try {
        debugLog('API', `DELETE ${baseUrl}/${endpoint}`);
        const response = await timeoutPromise(client.delete(endpoint, options).json());
        return response;
      } catch (error) {
        debugLog('API', 'DELETE error:', error);
        throw this.handleClientError(error);
      }
    },

    /**
     * Handle client-side errors
     * @param {Error} error 
     * @returns {APIError}
     */
    handleClientError(error) {
      if (error instanceof APIError) {
        return error;
      }

      // Network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return new APIError(ERROR_MESSAGES.api.networkError, 0, error);
      }

      // Timeout errors
      if (error.message === 'Request timeout') {
        return new APIError('Request timed out. Please try again.', 0, error);
      }

      // Generic error
      return new APIError(error.message || ERROR_MESSAGES.api.serverError, 0, error);
    }
  };
}

// ==========================================
// API CLIENT INSTANCES
// ==========================================

export const AuthAPI = createAPIClient(API_ENDPOINTS.auth.base, true);
export const FeedAPI = createAPIClient(API_ENDPOINTS.feed.base, true);
export const CommentAPI = createAPIClient(API_ENDPOINTS.comment.base, true);
export const NotificationAPI = createAPIClient(API_ENDPOINTS.notification.base, true);
export const AvatarAPI = createAPIClient(API_ENDPOINTS.avatar.base, true);
export const CheckoutAPI = createAPIClient(API_ENDPOINTS.checkout.base, true);
export const AdminAPI = createAPIClient(API_ENDPOINTS.admin.base, true);
export const PublicAPI = createAPIClient(API_ENDPOINTS.feed.base, false);

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Upload file with progress tracking (Safari compatible)
 * @param {string} url 
 * @param {FormData} formData 
 * @param {Function} onProgress 
 * @returns {Promise}
 */
export async function uploadFile(url, formData, onProgress = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Progress tracking (Safari compatible)
    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        reject(new APIError('Upload failed', xhr.status));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new APIError(ERROR_MESSAGES.api.networkError, 0));
    });

    xhr.addEventListener('timeout', () => {
      reject(new APIError('Upload timeout', 0));
    });

    // Add auth header
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.timeout = 60000; // 60s timeout for uploads
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

export default {
  AuthAPI,
  FeedAPI,
  CommentAPI,
  NotificationAPI,
  AvatarAPI,
  CheckoutAPI,
  AdminAPI,
  PublicAPI,
  uploadFile,
  APIError,
};
