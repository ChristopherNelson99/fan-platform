/**
 * utils.js — Shared Utilities
 * DayJS setup, formatting, debounce, DOM helpers.
 * ──────────────────────────────────────────────────────────────
 * SAFARI FIX: dayjs locale set up once, not per-call.
 * MOBILE FIX: Debounce/throttle for scroll & resize events.
 */

import dayjs from 'https://esm.sh/dayjs@1.11.10';
import relativeTime from 'https://esm.sh/dayjs@1.11.10/plugin/relativeTime';
import updateLocale from 'https://esm.sh/dayjs@1.11.10/plugin/updateLocale';
import { PLACEHOLDER } from './config.js';

// ─── DayJS One-Time Setup ────────────────────────────────────
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.locale('en-short', {
  relativeTime: {
    future: 'in %s',
    past:   '%s',
    s:      'now',
    m:      '1min',
    mm:     '%dmin',
    h:      '1h',
    hh:     '%dh',
    d:      '1d',
    dd:     '%dd',
    M:      '1m',
    MM:     '%dm',
    y:      '1y',
    yy:     '%dy',
  },
});

export { dayjs };

// ─── Time Display ────────────────────────────────────────────
/** Returns short or long relative time based on viewport width. */
export function timeAgoDisplay(dateStr) {
  return window.innerWidth >= 992
    ? dayjs(dateStr).locale('en').fromNow()
    : dayjs(dateStr).locale('en-short').fromNow(true);
}

/** Short relative time (always compact). */
export function timeAgoShort(dateStr) {
  return dayjs(dateStr).locale('en-short').fromNow(true);
}

// ─── Avatar / URL Formatting ─────────────────────────────────
/**
 * Sanitises an avatar URL.
 * Handles null, data-URIs, and normal Xano/CDN URLs.
 */
export function formatAvatar(url) {
  if (!url || typeof url !== 'string') return PLACEHOLDER;
  if (url.startsWith('data:image')) return url;
  return url;
}

/** Compact number formatting (1.2K, 3.4M, etc.) */
export function formatNumber(n) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
}

// ─── Performance Helpers ─────────────────────────────────────
/**
 * Debounce: delays execution until after `ms` of inactivity.
 * Used for resize handlers.
 */
export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), ms);
  };
}

/**
 * Throttle: executes at most once per `ms`.
 * Used for scroll / intersection handlers.
 */
export function throttle(fn, ms = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(null, args);
    }
  };
}

// ─── DOM Helpers ─────────────────────────────────────────────
/**
 * Checks if the current viewport is desktop width.
 * Uses matchMedia for reliability across Safari / Chrome / Firefox.
 */
export function isDesktop() {
  return window.matchMedia('(min-width: 992px)').matches;
}

/**
 * Wraps a Webflow static element in an Alpine <template x-for> loop.
 * Must be called BEFORE Alpine.start().
 *
 * SAFARI FIX: Uses `document.createElement('template')` which is
 * supported in all modern Safari versions (5.1+).
 */
export function wrapInTemplate(selector, loopExp, keyExp) {
  document.querySelectorAll(selector).forEach((target) => {
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

/**
 * Injects Plyr CSS if not already present.
 * Idempotent — safe to call multiple times.
 */
export function ensurePlyrCSS() {
  if (!document.getElementById('plyr-css')) {
    const link = document.createElement('link');
    link.id = 'plyr-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.plyr.io/3.7.8/plyr.css';
    document.head.appendChild(link);
  }
}
