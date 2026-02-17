/**
 * @fileoverview Video player utilities with Safari/iOS compatibility
 * @module utils/video
 */

import Plyr from 'plyr';
import Hls from 'hls';
import { debugLog, BROWSER_SUPPORT, UI_CONFIG } from '../core/constants.js';

/**
 * Check if Plyr CSS is loaded, if not inject it
 */
function ensurePlyrCSS() {
  if (document.getElementById('plyr-css')) return;
  
  const link = document.createElement('link');
  link.id = 'plyr-css';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.plyr.io/3.7.8/plyr.css';
  document.head.appendChild(link);
}

/**
 * Video Player Manager with Safari/iOS compatibility
 */
export class VideoPlayer {
  /**
   * @param {HTMLVideoElement} videoElement 
   * @param {Object} options 
   */
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.options = {
      controls: [],
      autoplay: false,
      muted: true,
      volume: 0,
      clickToPlay: false,
      settings: [],
      ...options
    };
    
    this.player = null;
    this.hls = null;
    this.isIOS = BROWSER_SUPPORT.isIOS;
    this.isSafari = BROWSER_SUPPORT.isSafari;
    
    ensurePlyrCSS();
  }

  /**
   * Initialize the player
   * @param {string} videoUrl 
   */
  init(videoUrl) {
    if (!this.videoElement) {
      debugLog('Video', 'Video element not found');
      return;
    }

    // Prevent double initialization
    if (this.videoElement.dataset.plyrInitialized === 'true') {
      debugLog('Video', 'Player already initialized');
      return;
    }

    try {
      // Create Plyr instance
      this.player = new Plyr(this.videoElement, this.options);

      // Setup HLS or native playback
      if (this.shouldUseHLS(videoUrl)) {
        this.setupHLS(videoUrl);
      } else {
        this.setupNative(videoUrl);
      }

      // Mark as initialized
      this.videoElement.dataset.plyrInitialized = 'true';
      
      debugLog('Video', 'Player initialized successfully');
    } catch (error) {
      debugLog('Video', 'Failed to initialize player:', error);
      // Fallback to native video
      this.setupNative(videoUrl);
    }
  }

  /**
   * Determine if HLS should be used
   * @param {string} url 
   * @returns {boolean}
   */
  shouldUseHLS(url) {
    // iOS has native HLS support
    if (this.isIOS) return false;
    
    // Check if URL is HLS and if HLS.js is supported
    return url.includes('.m3u8') && Hls.isSupported();
  }

  /**
   * Setup HLS playback
   * @param {string} url 
   */
  setupHLS(url) {
    try {
      this.hls = new Hls({
        capLevelToPlayerSize: true,
        maxMaxBufferLength: 30, // Safari likes shorter buffers
        maxBufferLength: 20,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
      });
      
      this.hls.loadSource(url);
      this.hls.attachMedia(this.videoElement);
      
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          debugLog('Video', 'Fatal HLS error:', data);
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover from network error
              this.hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              this.hls.recoverMediaError();
              break;
            default:
              // Fallback to native
              this.setupNative(url);
              break;
          }
        }
      });
      
      debugLog('Video', 'HLS setup complete');
    } catch (error) {
      debugLog('Video', 'HLS setup failed:', error);
      this.setupNative(url);
    }
  }

  /**
   * Setup native video playback
   * @param {string} url 
   */
  setupNative(url) {
    this.videoElement.src = url;
    
    // Safari-specific attributes
    if (this.isSafari || this.isIOS) {
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.setAttribute('webkit-playsinline', '');
    }
    
    debugLog('Video', 'Native playback setup complete');
  }

  /**
   * Play video (with Safari/iOS workarounds)
   * @returns {Promise}
   */
  async play() {
    if (!this.player) return;
    
    try {
      // iOS requires user interaction for unmuted playback
      if (this.isIOS && !this.player.muted) {
        this.player.muted = true;
      }
      
      await this.player.play();
      debugLog('Video', 'Playback started');
    } catch (error) {
      debugLog('Video', 'Play failed:', error);
      
      // Retry with muted if failed
      if (!this.player.muted) {
        this.player.muted = true;
        try {
          await this.player.play();
        } catch (retryError) {
          debugLog('Video', 'Muted play also failed:', retryError);
        }
      }
    }
  }

  /**
   * Pause video
   */
  pause() {
    if (this.player) {
      this.player.pause();
    }
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    if (this.player) {
      this.player.muted = !this.player.muted;
      this.player.volume = this.player.muted ? 0 : 1;
    }
  }

  /**
   * Set volume (0-1)
   * @param {number} volume 
   */
  setVolume(volume) {
    if (this.player) {
      this.player.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Add event listener
   * @param {string} event 
   * @param {Function} handler 
   */
  on(event, handler) {
    if (this.player) {
      this.player.on(event, handler);
    }
  }

  /**
   * Destroy player and cleanup
   */
  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    
    if (this.videoElement) {
      this.videoElement.dataset.plyrInitialized = 'false';
    }
    
    debugLog('Video', 'Player destroyed');
  }
}

/**
 * Video Observer Manager for auto-play on scroll
 */
export class VideoObserver {
  constructor() {
    this.observers = new Map();
    this.players = new Map();
    
    // Check if IntersectionObserver is supported
    if (!BROWSER_SUPPORT.hasIntersectionObserver) {
      debugLog('Video', 'IntersectionObserver not supported');
    }
  }

  /**
   * Observe video element
   * @param {HTMLVideoElement} element 
   * @param {VideoPlayer} player 
   * @param {Function} onIntersect 
   */
  observe(element, player, onIntersect = null) {
    if (!BROWSER_SUPPORT.hasIntersectionObserver) {
      debugLog('Video', 'Cannot observe without IntersectionObserver');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video is in viewport
            if (onIntersect) {
              onIntersect(true, entry);
            } else {
              // Default behavior: auto-play muted
              player.play();
            }
          } else {
            // Video is out of viewport
            if (onIntersect) {
              onIntersect(false, entry);
            } else {
              // Default behavior: pause
              player.pause();
            }
          }
        });
      },
      {
        threshold: UI_CONFIG.video.intersectionThreshold,
        // Root margin for better UX (start playing before fully visible)
        rootMargin: '50px'
      }
    );

    observer.observe(element);
    this.observers.set(element, observer);
    this.players.set(element, player);
    
    debugLog('Video', 'Started observing element');
  }

  /**
   * Stop observing element
   * @param {HTMLVideoElement} element 
   */
  unobserve(element) {
    const observer = this.observers.get(element);
    if (observer) {
      observer.disconnect();
      this.observers.delete(element);
    }
    
    const player = this.players.get(element);
    if (player) {
      this.players.delete(element);
    }
    
    debugLog('Video', 'Stopped observing element');
  }

  /**
   * Cleanup all observers
   */
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.players.clear();
    
    debugLog('Video', 'All observers cleaned up');
  }
}

/**
 * Pause all players except one
 * @param {Map} playersMap 
 * @param {string} exceptId 
 */
export function pauseAllPlayers(playersMap, exceptId = null) {
  playersMap.forEach((player, id) => {
    if (id !== exceptId && player && player.pause) {
      player.pause();
    }
  });
}

/**
 * Create video thumbnail URL
 * @param {string} videoUrl 
 * @returns {string}
 */
export function getVideoThumbnail(videoUrl) {
  // For HLS streams, this would be the poster image
  // For regular videos, you might extract a frame
  // This is a placeholder implementation
  return videoUrl.replace('.m3u8', '.jpg').replace('/video/', '/thumbnails/');
}

export default {
  VideoPlayer,
  VideoObserver,
  pauseAllPlayers,
  getVideoThumbnail,
};
