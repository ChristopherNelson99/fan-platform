/**
 * @fileoverview DOM manipulation utilities with Safari compatibility
 * @module utils/dom
 */

import { debugLog, BROWSER_SUPPORT } from '../core/constants.js';

/**
 * Safely query selector with error handling
 * @param {string} selector 
 * @param {Element} parent 
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (e) {
    debugLog('DOM', `Invalid selector: ${selector}`, e);
    return null;
  }
}

/**
 * Safely query selector all
 * @param {string} selector 
 * @param {Element} parent 
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
  try {
    return Array.from(parent.querySelectorAll(selector));
  } catch (e) {
    debugLog('DOM', `Invalid selector: ${selector}`, e);
    return [];
  }
}

/**
 * Wait for element to exist in DOM
 * @param {string} selector 
 * @param {number} timeout 
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = $(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = $(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Add event listener with automatic cleanup
 * @param {Element|Window|Document} element 
 * @param {string} event 
 * @param {Function} handler 
 * @param {Object} options 
 * @returns {Function} Cleanup function
 */
export function on(element, event, handler, options = {}) {
  if (!element) return () => {};
  
  element.addEventListener(event, handler, options);
  
  return () => element.removeEventListener(event, handler, options);
}

/**
 * Debounce function (Safari compatible)
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function (Safari compatible)
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Create element with attributes
 * @param {string} tag 
 * @param {Object} attrs 
 * @param {Element[]} children 
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.substring(2).toLowerCase();
      element.addEventListener(event, value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Element) {
      element.appendChild(child);
    }
  });
  
  return element;
}

/**
 * Set element styles (Safari compatible)
 * @param {Element} element 
 * @param {Object} styles 
 */
export function setStyles(element, styles) {
  if (!element) return;
  
  Object.entries(styles).forEach(([property, value]) => {
    // Convert camelCase to kebab-case for CSS properties
    const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
    element.style.setProperty(cssProperty, value);
  });
}

/**
 * Animate element with CSS classes
 * @param {Element} element 
 * @param {string} animationClass 
 * @param {number} duration 
 * @returns {Promise}
 */
export function animateCSS(element, animationClass, duration = 300) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    element.classList.add(animationClass);
    
    const handleAnimationEnd = () => {
      element.classList.remove(animationClass);
      element.removeEventListener('animationend', handleAnimationEnd);
      resolve();
    };

    element.addEventListener('animationend', handleAnimationEnd);
    
    // Fallback timeout in case animationend doesn't fire
    setTimeout(() => {
      element.classList.remove(animationClass);
      resolve();
    }, duration + 100);
  });
}

/**
 * Safely scroll element into view (iOS Safari compatible)
 * @param {Element} element 
 * @param {Object} options 
 */
export function scrollToElement(element, options = {}) {
  if (!element) return;

  const defaultOptions = {
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest'
  };

  const scrollOptions = { ...defaultOptions, ...options };

  // iOS Safari sometimes has issues with smooth scrolling
  if (BROWSER_SUPPORT.isIOS) {
    // Use polyfill approach for iOS
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const middle = absoluteElementTop - (window.innerHeight / 2);
    
    window.scrollTo({
      top: middle,
      behavior: scrollOptions.behavior
    });
  } else {
    element.scrollIntoView(scrollOptions);
  }
}

/**
 * Lock body scroll (iOS compatible)
 */
let scrollPosition = 0;

export function lockScroll() {
  scrollPosition = window.pageYOffset;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = '100%';
}

/**
 * Unlock body scroll
 */
export function unlockScroll() {
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('width');
  window.scrollTo(0, scrollPosition);
}

/**
 * Check if element is in viewport
 * @param {Element} element 
 * @returns {boolean}
 */
export function isInViewport(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Get window dimensions (Safari compatible)
 * @returns {Object}
 */
export function getWindowSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight
  };
}

/**
 * Check if device is mobile
 * @returns {boolean}
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Wrap Webflow elements in Alpine templates (for existing code)
 * @param {string} selector 
 * @param {string} loopExp 
 * @param {string} keyExp 
 */
export function wrapInAlpineTemplate(selector, loopExp, keyExp) {
  $$(selector).forEach(target => {
    if (target && target.parentElement && target.tagName !== 'TEMPLATE') {
      const wrapper = target.parentElement;
      const template = document.createElement('template');
      template.setAttribute('x-for', loopExp);
      if (keyExp) template.setAttribute(':key', keyExp);
      wrapper.insertBefore(template, target);
      template.content.appendChild(target);
    }
  });
}

export default {
  $,
  $$,
  waitForElement,
  on,
  debounce,
  throttle,
  createElement,
  setStyles,
  animateCSS,
  scrollToElement,
  lockScroll,
  unlockScroll,
  isInViewport,
  getWindowSize,
  isMobileDevice,
  wrapInAlpineTemplate,
};
