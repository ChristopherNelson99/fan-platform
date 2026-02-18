/**
 * protection.js — Content Protection
 * Blurs media on tab switch / Print Screen / app switcher.
 * ──────────────────────────────────────────────────────────────
 * NOTE: This is a deterrent, not foolproof DRM.
 * SAFARI FIX: Uses `visibilitychange` (Safari 14.1+).
 *             `navigator.clipboard.writeText` requires user gesture
 *             on Safari — wrapped in try/catch.
 */

const BLUR_CLASS = 'is-protected';

function protect() {
  document.body.classList.add(BLUR_CLASS);
}

function unprotect() {
  document.body.classList.remove(BLUR_CLASS);
}

export function initContentProtection() {
  // ── Tab / App Switcher ─────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    document.visibilityState === 'hidden' ? protect() : unprotect();
  });

  // Fallback for some browsers
  window.addEventListener('blur', protect);
  window.addEventListener('focus', unprotect);

  // ── Print Screen Key (Desktop) ─────────────────────────
  document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      protect();
      try {
        navigator.clipboard.writeText('Content Protected');
      } catch {
        // Safari blocks clipboard outside user gesture — ignore
      }
      setTimeout(unprotect, 1000);
    }
  });

  // ── Right Click / Save / Print Shortcuts ───────────────
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey; // metaKey = ⌘ on Mac
    if (ctrl && ['p', 's', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
}
