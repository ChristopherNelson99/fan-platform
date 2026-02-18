/**
 * player.js — Video Player Manager
 * Wraps Plyr + HLS.js for feed and lightbox video playback.
 * ──────────────────────────────────────────────────────────────
 * SAFARI FIX: Safari has NATIVE HLS support via <video src="...m3u8">.
 *             We only load HLS.js when the browser doesn't support
 *             native HLS (i.e. Chrome, Firefox). This avoids the
 *             double-decode bug on Safari and improves performance.
 *
 * MOBILE FIX: IntersectionObserver threshold lowered to 0.3 for
 *             better autoplay on small viewports. Autoplay always
 *             starts muted (required by Safari & Chrome policies).
 */

import Plyr from 'https://esm.sh/plyr@3.7.8';
import Hls from 'https://esm.sh/hls.js@1.4.10';

// ─── Safari HLS Detection ───────────────────────────────────
function canPlayHLSNatively() {
  const video = document.createElement('video');
  return !!video.canPlayType('application/vnd.apple.mpegurl');
}

const USE_NATIVE_HLS = canPlayHLSNatively();

// ─── Feed Player (inline autoplay, no controls) ─────────────
/**
 * Initialises a Plyr instance for a feed card video.
 *
 * @param {HTMLVideoElement} el       - The <video> element.
 * @param {string}           url      - HLS or MP4 URL.
 * @param {object}           post     - Alpine reactive post object.
 * @param {Function}         pauseAll - Callback to pause other players.
 * @returns {{ player: Plyr, observer: IntersectionObserver, hls: Hls|null }}
 */
export function initFeedPlayer(el, url, post, pauseAll) {
  if (el.dataset.plyrInitialized) return null;

  const player = new Plyr(el, {
    controls:    [],
    autoplay:    false,
    muted:       true,
    volume:      0,
    clickToPlay: false,
    settings:    [],
  });

  post.isMuted = true;
  post.isPlaying = false;

  player.on('play', () => { pauseAll(post.id); post.isPlaying = true; });
  player.on('playing', () => { post.isPlaying = true; });
  player.on('pause', () => { post.isPlaying = false; });
  player.on('volumechange', () => { post.isMuted = player.muted; });

  const hlsInstance = _attachSource(el, url);

  // Autoplay when ≥30% visible, pause when offscreen
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Only autoplay if the lightbox is NOT open
        const lightboxOpen = window.Alpine?.store('app')?.lightbox?.show;
        if (entry.isIntersecting && !lightboxOpen) {
          player.muted = true;
          player.volume = 0;
          player.play().catch(() => {});
        } else {
          player.pause();
        }
      });
    },
    { threshold: 0.3 },
  );

  observer.observe(el);
  el.dataset.plyrInitialized = 'true';

  return { player, observer, hls: hlsInstance };
}

// ─── Lightbox Player (full controls) ────────────────────────
/**
 * Initialises a Plyr instance for the lightbox overlay.
 *
 * @param {HTMLVideoElement} el       - The <video id="video-lightbox"> element.
 * @param {string}           url      - HLS or MP4 URL.
 * @param {Function}         pauseAll - Callback to pause other players.
 * @returns {Plyr}
 */
export function initLightboxPlayer(el, url, pauseAll) {
  const player = new Plyr(el, {
    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
    autoplay: true,
    muted:    false,
  });

  _attachSource(el, url);

  player.on('play', () => pauseAll('lightbox'));
  player.on('ready', () => {
    player.muted = false;
    player.volume = 1;
  });

  return player;
}

// ─── Source Attachment (Safari-aware) ────────────────────────
function _attachSource(el, url) {
  const isHLS = url.includes('.m3u8');

  if (isHLS && !USE_NATIVE_HLS && Hls.isSupported()) {
    // Chrome / Firefox: use HLS.js
    const hls = new Hls({ capLevelToPlayerSize: true });
    hls.loadSource(url);
    hls.attachMedia(el);
    return hls;
  }

  // Safari native HLS OR plain MP4
  el.src = url;
  return null;
}
