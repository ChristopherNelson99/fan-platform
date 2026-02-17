/**
 * @fileoverview Screenshot and screen recording protection
 * @module modules/protection/index
 */

import { debugLog, BROWSER_SUPPORT } from '../../core/constants.js';

/**
 * Screenshot Protection Manager
 */
export class ScreenshotProtection {
  constructor(options = {}) {
    this.options = {
      enableOnLoad: true,
      protectClass: 'is-protected',
      ...options
    };

    this.isProtected = false;
    this.protectionTimeout = null;
  }

  /**
   * Initialize protection
   */
  init() {
    if (this.options.enableOnLoad) {
      this.setupProtection();
      debugLog('Protection', 'Screenshot protection initialized');
    }
  }

  /**
   * Setup all protection mechanisms
   */
  setupProtection() {
    // Window blur/focus (desktop screenshot, mobile app switcher)
    this.setupWindowBlurProtection();

    // Visibility change (mobile screenshot, app switcher)
    this.setupVisibilityProtection();

    // Print screen key (desktop)
    this.setupPrintScreenProtection();

    // Context menu (right-click)
    this.setupContextMenuProtection();

    // Keyboard shortcuts (save, print, etc.)
    this.setupKeyboardProtection();

    debugLog('Protection', 'All protection mechanisms active');
  }

  /**
   * Setup window blur/focus protection
   */
  setupWindowBlurProtection() {
    window.addEventListener('blur', () => {
      this.applyProtection();
      debugLog('Protection', 'Window blur - protection applied');
    });

    window.addEventListener('focus', () => {
      this.removeProtection();
      debugLog('Protection', 'Window focus - protection removed');
    });
  }

  /**
   * Setup visibility change protection
   */
  setupVisibilityProtection() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        this.applyProtection();
        debugLog('Protection', 'Visibility hidden - protection applied');
      } else {
        this.removeProtection();
        debugLog('Protection', 'Visibility visible - protection removed');
      }
    });
  }

  /**
   * Setup print screen key protection
   */
  setupPrintScreenProtection() {
    document.addEventListener('keyup', (e) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        this.applyProtection();
        
        // Attempt to clear clipboard (works in some browsers)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Content Protected')
            .catch(() => {
              debugLog('Protection', 'Could not clear clipboard');
            });
        }

        // Remove protection after 1 second
        setTimeout(() => this.removeProtection(), 1000);
        
        debugLog('Protection', 'PrintScreen detected - protection applied');
      }
    });
  }

  /**
   * Setup context menu (right-click) protection
   */
  setupContextMenuProtection() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      debugLog('Protection', 'Context menu prevented');
      
      // Optional: Show custom message
      if (this.options.showContextMenuMessage) {
        this.showProtectionMessage('Right-click is disabled for content protection.');
      }
    });
  }

  /**
   * Setup keyboard shortcut protection
   */
  setupKeyboardProtection() {
    document.addEventListener('keydown', (e) => {
      const isMac = BROWSER_SUPPORT.isSafari && navigator.platform.includes('Mac');
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Prevent Ctrl/Cmd + P (Print)
      if (ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.showProtectionMessage('Print is disabled for content protection.');
        debugLog('Protection', 'Print prevented');
      }

      // Prevent Ctrl/Cmd + S (Save)
      if (ctrlKey && e.key === 's') {
        e.preventDefault();
        this.showProtectionMessage('Save is disabled for content protection.');
        debugLog('Protection', 'Save prevented');
      }

      // Prevent Ctrl/Cmd + U (View Source)
      if (ctrlKey && e.key === 'u') {
        e.preventDefault();
        debugLog('Protection', 'View source prevented');
      }

      // Prevent Ctrl + Shift + I (DevTools)
      if (ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        debugLog('Protection', 'DevTools shortcut prevented');
      }

      // Prevent F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        debugLog('Protection', 'F12 prevented');
      }
    });
  }

  /**
   * Apply protection (blur content)
   */
  applyProtection() {
    if (this.isProtected) return;

    document.body.classList.add(this.options.protectClass);
    this.isProtected = true;
  }

  /**
   * Remove protection (restore content)
   */
  removeProtection() {
    if (!this.isProtected) return;

    document.body.classList.remove(this.options.protectClass);
    this.isProtected = false;
  }

  /**
   * Show protection message
   * @param {string} message 
   */
  showProtectionMessage(message) {
    if (!this.options.showMessages) return;

    // Try to use existing popup system
    if (window.Alpine && window.Alpine.store('app')) {
      const feedApp = document.querySelector('[x-data]').__x?.$data;
      if (feedApp && feedApp.showPopup) {
        feedApp.showPopup({
          header: 'Content Protected',
          message: message,
          btnText: 'OK',
          btnAction: () => feedApp.hidePopup()
        });
        return;
      }
    }

    // Fallback to console
    debugLog('Protection', message);
  }

  /**
   * Disable protection
   */
  disable() {
    this.removeProtection();
    // Note: Event listeners remain, but protection won't be applied
    this.options.enableOnLoad = false;
    debugLog('Protection', 'Protection disabled');
  }

  /**
   * Enable protection
   */
  enable() {
    this.options.enableOnLoad = true;
    debugLog('Protection', 'Protection enabled');
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.removeProtection();
    // Note: For complete cleanup, would need to track and remove all event listeners
    debugLog('Protection', 'Cleaned up');
  }
}

/**
 * CSS for protection (add to your stylesheet)
 * 
 * .is-protected {
 *   filter: blur(10px);
 *   pointer-events: none;
 *   user-select: none;
 * }
 * 
 * .is-protected * {
 *   filter: blur(10px);
 *   pointer-events: none;
 *   user-select: none;
 * }
 */

/**
 * Initialize screenshot protection
 * @param {Object} options 
 * @returns {ScreenshotProtection}
 */
export function initScreenshotProtection(options = {}) {
  const protection = new ScreenshotProtection(options);
  protection.init();

  // Expose globally
  window.screenshotProtection = protection;

  return protection;
}

/**
 * Advanced: Watermark protection
 * Add dynamic watermarks to content
 */
export class WatermarkProtection {
  constructor(options = {}) {
    this.options = {
      text: 'Protected Content',
      opacity: 0.1,
      fontSize: '20px',
      color: '#ffffff',
      ...options
    };
  }

  /**
   * Add watermark overlay
   */
  addWatermark() {
    const watermark = document.createElement('div');
    watermark.className = 'content-watermark';
    watermark.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      opacity: ${this.options.opacity};
      font-size: ${this.options.fontSize};
      color: ${this.options.color};
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-45deg);
      user-select: none;
    `;
    watermark.textContent = this.options.text;
    
    document.body.appendChild(watermark);
    
    debugLog('Protection', 'Watermark added');
  }

  /**
   * Remove watermark
   */
  removeWatermark() {
    const watermark = document.querySelector('.content-watermark');
    if (watermark) {
      watermark.remove();
      debugLog('Protection', 'Watermark removed');
    }
  }
}

export default ScreenshotProtection;
