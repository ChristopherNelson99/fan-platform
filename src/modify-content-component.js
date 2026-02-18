/**
 * modify-content-component.js — Admin Content Manager
 * Alpine store `dash` + `uploadLogic` data component.
 * ──────────────────────────────────────────────────────────────
 * SECURITY: All uploads use the creator's JWE token via admin API.
 *           Admin access is gated by AuthManager in main-site.js.
 *
 * SAFARI FIX: `document.execCommand` is deprecated everywhere but
 *             remains the ONLY reliable way to format contentEditable.
 *             Safari 14+ still supports it. No alternative exists
 *             without adopting a full editor like Tiptap/ProseMirror.
 *
 *             `canvas.toBlob` requires a short delay on Safari to
 *             ensure the blur filter has been rasterised — kept the
 *             200ms setTimeout from the original.
 *
 *             Picmo instance stored in module-level variable (outside
 *             Alpine) to avoid the Proxy-wrapping crash — same fix
 *             as the feed page emoji picker.
 *
 * MOBILE FIX: Rich editor caret position saved on focusout so that
 *             tapping the emoji button (which blurs the editor)
 *             inserts at the correct position.
 */

import Alpine from 'https://esm.sh/alpinejs@3.13.3';
import { API } from './api.js';
import { ADMIN_CONFIG, AUTH_CONFIG } from './config.js';

// ─── Module-Level State (avoids Alpine Proxy issues) ─────────
let emojiPickerInstance = null;

// ─── Selectors Shorthand ─────────────────────────────────────
const S = ADMIN_CONFIG.selectors;

// ─── Helper: get auth header for raw fetch ───────────────────
function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem(AUTH_CONFIG.storage.authToken)}` };
}

// ═══════════════════════════════════════════════════════════════
// ALPINE STORE: dash
// Manages view state, post list, and editing context.
// ═══════════════════════════════════════════════════════════════
function registerDashStore() {
  Alpine.store('dash', {
    // ── State ────────────────────────────────────────────
    view: 'create',       // 'create' | 'edit' | 'grid'
    posts: [],
    editingPost: null,
    isUploading: false,
    selectedFile: null,
    currentCategory: 'Paid',
    categoryModalOpen: false,
    lastRange: null,       // Saved caret position for emoji insertion

    // ── Lifecycle ────────────────────────────────────────
    async init() {
      const token = localStorage.getItem(AUTH_CONFIG.storage.authToken);
      if (!token) return;

      try {
        this.posts = await API.feed
          .get('get_content_feed_premium')
          .json();
      } catch (e) {
        console.error('[Admin] Feed load failed:', e);
      }

      // Deep-link: ?post_id=123 → open that post for editing
      const postId = new URLSearchParams(window.location.search).get('post_id');
      if (postId) {
        const match = this.posts.find((p) => p.id == postId);
        if (match) this.selectPost(match);
      }
    },

    // ── View Navigation ──────────────────────────────────
    setView(view) {
      this.view = view;

      if (view === 'create') {
        this.editingPost = null;
        this.selectedFile = null;
        this.currentCategory = 'Paid';
        _resetEditorUI();
        _pushCleanUrl();
      }

      if (view === 'grid') {
        this.editingPost = null;
        _pushCleanUrl();
      }
    },

    // ── Select Post for Editing ──────────────────────────
    selectPost(post) {
      this.editingPost = post;
      this.view = 'edit';
      this.currentCategory = post.paid ? 'Paid' : 'Free';

      // Populate editor after Alpine re-renders the DOM
      setTimeout(() => {
        const editor = document.querySelector(S.editor);
        if (editor) editor.innerHTML = post.description || '';

        const img = document.querySelector(S.previewImg);
        if (img) {
          img.src = post.display_url;
          img.style.display = 'block';
        }

        const placeholder = document.querySelector(S.placeholder);
        if (placeholder) placeholder.style.display = 'none';
      }, 150);

      window.history.pushState({}, '', `?post_id=${post.id}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// ALPINE DATA: uploadLogic
// Handles formatting, file selection, teaser blur, and upload.
// ═══════════════════════════════════════════════════════════════
function registerUploadLogic() {
  Alpine.data('uploadLogic', () => ({
    /**
     * Applies a formatting command to the rich editor.
     * Refocuses the editor first to prevent Safari from
     * losing the selection when the toolbar button is pressed.
     */
    format(cmd) {
      const editor = document.querySelector(S.editor);
      if (!editor) return;
      editor.focus();
      document.execCommand(cmd, false, null);
    },

    /**
     * Creates or edits a post. Builds FormData and sends
     * via raw fetch (FormData + auth header).
     */
    async handleAction() {
      const store = Alpine.store('dash');
      if (store.isUploading) return;

      const isNew = store.view === 'create';

      // Validation
      if (isNew && !store.selectedFile) {
        alert('Please select media!');
        return;
      }

      store.isUploading = true;

      const editor = document.querySelector(S.editor);
      const description = (editor?.innerHTML || '')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const fd = new FormData();
      fd.append('description', description);
      fd.append(
        'title',
        (editor?.textContent || 'Post').substring(0, ADMIN_CONFIG.maxTitleLength),
      );
      fd.append('paid', store.currentCategory === 'Paid');

      if (!isNew) {
        fd.append('content_id', store.editingPost.id);
      }

      // Attach media + generated teaser if a file was selected
      if (store.selectedFile) {
        try {
          const teaser = await this._generateTeaser(store.selectedFile);
          fd.append('content_file', store.selectedFile);
          fd.append('teaser_file', teaser);
        } catch (err) {
          console.error('[Admin] Teaser generation failed:', err);
          store.isUploading = false;
          alert('Failed to process image. Please try a different file.');
          return;
        }
      }

      // Upload
      const endpoint = isNew
        ? ADMIN_CONFIG.endpoints.create
        : ADMIN_CONFIG.endpoints.edit;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: authHeader(),
          body: fd,
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error');
          throw new Error(`Upload failed (${res.status}): ${errorText}`);
        }

        alert('Success!');
        location.reload();
      } catch (err) {
        console.error('[Admin] Upload failed:', err);
        alert('Upload failed. Please try again.');
        store.isUploading = false;
      }
    },

    /**
     * Generates a blurred JPEG teaser from an image file.
     * Used as the locked-content preview for non-subscribers.
     *
     * SAFARI FIX: 200ms delay before toBlob to ensure the
     * canvas blur filter has fully rasterised.
     *
     * @param {File} file - The original media file.
     * @returns {Promise<File>} - A blurred JPEG File.
     */
    _generateTeaser(file) {
      return new Promise((resolve, reject) => {
        const canvas = document.querySelector(S.canvas);
        if (!canvas) {
          reject(new Error('Teaser canvas not found'));
          return;
        }

        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.filter = `blur(${ADMIN_CONFIG.teaserBlur}px)`;
          ctx.drawImage(img, 0, 0, img.width, img.height);

          // Safari needs a tick for the blur to rasterise
          setTimeout(() => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(new File([blob], 'teaser.jpg', { type: 'image/jpeg' }));
                } else {
                  reject(new Error('Canvas toBlob returned null'));
                }
              },
              'image/jpeg',
              ADMIN_CONFIG.teaserQuality,
            );
          }, 200);
        };

        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = URL.createObjectURL(file);
      });
    },
  }));
}

// ═══════════════════════════════════════════════════════════════
// DOM SETUP: Emoji Picker, Caret Tracking, Media Input
// Called AFTER Alpine.start() when the DOM is fully interactive.
// ═══════════════════════════════════════════════════════════════
async function initEditorDOM() {
  const editor = document.querySelector(S.editor);
  if (!editor) return;

  // ── Caret Tracking ───────────────────────────────────
  // Saves the cursor position so emoji insertion works after
  // focus leaves the editor (e.g. tapping the emoji button).
  const saveCaret = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      Alpine.store('dash').lastRange = sel.getRangeAt(0).cloneRange();
    }
  };

  editor.addEventListener('keyup', saveCaret);
  editor.addEventListener('mouseup', saveCaret);
  editor.addEventListener('focusout', saveCaret);

  // ── Emoji Picker (Lazy-Loaded Picmo) ─────────────────
  const trigger = document.querySelector(S.emojiTrigger);
  const container = document.querySelector(S.emojiPicker);

  if (trigger && container) {
    // Lazy-load Picmo only when first opened
    trigger.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isVisible = container.style.display === 'block';
      container.style.display = isVisible ? 'none' : 'block';

      // Initialise picker on first open
      if (!isVisible && !emojiPickerInstance) {
        const { createPicker } = await import('https://esm.sh/picmo@5.8.5');
        emojiPickerInstance = createPicker({
          rootElement: container,
          theme: 'dark',
          className: 'custom-picmo',
        });

        emojiPickerInstance.addEventListener('emoji:select', (ev) => {
          editor.focus();
          const sel = window.getSelection();
          const savedRange = Alpine.store('dash').lastRange;

          if (savedRange) {
            sel.removeAllRanges();
            sel.addRange(savedRange);
          }

          document.execCommand('insertText', false, ev.emoji);
          saveCaret();
          container.style.display = 'none';
        });
      }
    });
  }

  // ── Media File Input ─────────────────────────────────
  const mediaInput = document.querySelector(S.mediaInput);
  if (mediaInput) {
    mediaInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Alpine.store('dash').selectedFile = file;

      const url = URL.createObjectURL(file);
      const img = document.querySelector(S.previewImg);
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }

      const placeholder = document.querySelector(S.placeholder);
      if (placeholder) placeholder.style.display = 'none';
    });
  }
}

// ─── Helper: Reset Editor UI ─────────────────────────────────
function _resetEditorUI() {
  const editor = document.querySelector(S.editor);
  if (editor) editor.innerHTML = '';

  const img = document.querySelector(S.previewImg);
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }

  const placeholder = document.querySelector(S.placeholder);
  if (placeholder) placeholder.style.display = 'block';
}

function _pushCleanUrl() {
  window.history.pushState({}, '', window.location.pathname);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC EXPORTS
// ═══════════════════════════════════════════════════════════════
export { registerDashStore, registerUploadLogic, initEditorDOM };
