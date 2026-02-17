# Migration Guide: From Monolithic to Modular

## 🎯 Overview

This guide explains how your application was restructured from a monolithic script into a modular, maintainable codebase.

## 📊 Before vs After

### Before (Monolithic)
```
- One large 2000+ line script
- All code in global scope
- Difficult to debug
- No code reusability
- Safari issues due to lack of polyfills
```

### After (Modular)
```
src/
├── core/           # Shared utilities
├── modules/        # Feature modules
├── utils/          # Helper functions
└── Each file is < 300 lines
```

## 🔄 Key Changes

### 1. **State Management**
**Before:**
```javascript
// Everything in Alpine.data
Alpine.data('app', () => ({
  user: {},
  feed: [],
  // ... 50+ properties
}))
```

**After:**
```javascript
// Dedicated state class
import { FeedState } from './modules/feed/state.js';
const state = new FeedState();
```

### 2. **API Calls**
**Before:**
```javascript
const API = { /* inline ky instances */ };
// Used directly everywhere
```

**After:**
```javascript
// Centralized API client
import { FeedAPI, CommentAPI } from './core/api.js';
// With error handling and retry logic
```

### 3. **Safari Compatibility**
**Added:**
- iOS scroll lock fixes
- Safari localStorage error handling
- Video player fallbacks for iOS
- Touch event optimizations

## 🚀 Usage Examples

### Loading the Feed Page

**Old Way (Webflow):**
```html
<script type="module">
  // 2000 lines of code here
</script>
```

**New Way:**
```html
<!-- In Webflow: Site Settings → Custom Code → Before </head> -->
<script type="importmap">
{
  "imports": {
    "ky": "https://esm.sh/ky@1.7.2",
    "dayjs": "https://esm.sh/dayjs@1.11.10",
    "alpinejs": "https://esm.sh/alpinejs@3.13.3",
    "plyr": "https://esm.sh/plyr@3.7.8",
    "hls": "https://esm.sh/hls.js@1.4.10"
  }
}
</script>

<!-- In Webflow: Page Settings → Before </body> -->
<script type="module">
  import { initFeedPage } from 'https://YOUR_CDN/src/modules/feed/index.js';
  initFeedPage();
</script>
```

## 📦 Deployment Options

### Option 1: GitHub Pages (Recommended)
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Modular refactor"
git push origin main

# 2. Enable GitHub Pages
# Settings → Pages → Source: main branch

# 3. Use in Webflow
<script type="module">
  import { initFeedPage } from 
    'https://YOUR_USERNAME.github.io/YOUR_REPO/src/modules/feed/index.js';
  initFeedPage();
</script>
```

### Option 2: CDN (jsDelivr)
```javascript
// After pushing to GitHub, use jsDelivr:
import { initFeedPage } from 
  'https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/src/modules/feed/index.js';
```

### Option 3: Self-Hosted
```bash
# Upload src/ folder to your server
# Use absolute URLs
import { initFeedPage } from 'https://yourdomain.com/scripts/src/modules/feed/index.js';
```

## 🐛 Debugging

### Enable Debug Mode
```javascript
// In browser console
localStorage.setItem('DEBUG_MODE', 'true');
// Reload page to see detailed logs
```

### Common Issues

**Issue: Modules not loading**
```
Solution: Check CORS headers on your CDN
Add to .htaccess or server config:
Header set Access-Control-Allow-Origin "*"
```

**Issue: Safari videos not playing**
```javascript
// Already handled in VideoPlayer class
// But ensure videos have playsinline attribute
<video playsinline muted></video>
```

**Issue: LocalStorage quota exceeded**
```javascript
// Already handled in storage.js
// Automatically clears non-essential data
```

## 🎨 Customization

### Change API Endpoints
Edit `src/core/constants.js`:
```javascript
export const API_ENDPOINTS = {
  feed: {
    base: 'https://YOUR_NEW_API.com',
    // ...
  }
};
```

### Add New Features
```javascript
// 1. Create new module
src/modules/yourfeature/
├── index.js
├── state.js
└── api.js

// 2. Export from index.js
export function initYourFeature() {
  // ...
}

// 3. Use in Webflow
import { initYourFeature } from './modules/yourfeature/index.js';
```

## ⚡ Performance Improvements

### Lazy Loading
```javascript
// Videos only load when in viewport
// Managed by VideoObserver class

// Import only what you need
import { FeedAPI } from './core/api.js'; // ✅
// Instead of
import API from './core/api.js'; // ❌
```

### Memory Management
```javascript
// Automatic cleanup on page unload
window.addEventListener('beforeunload', () => {
  feedState.cleanup();
});
```

## 🔐 Security Improvements

### XSS Protection
```javascript
// All user input is sanitized
import { sanitizeHTML } from './utils/format.js';
const safe = sanitizeHTML(userInput);
```

### API Error Handling
```javascript
// Centralized error handling
try {
  await FeedAPI.get('endpoint');
} catch (error) {
  if (error.status === 401) {
    // Redirect to login
  }
}
```

## 📱 Mobile Optimizations

### Touch Events
```javascript
// iOS-specific scroll locking
import { lockScroll, unlockScroll } from './utils/dom.js';

// When opening lightbox
lockScroll(); // Prevents body scroll on iOS

// When closing
unlockScroll(); // Restores scroll position
```

### Video Auto-play
```javascript
// iOS requires muted autoplay
const player = new VideoPlayer(element, {
  autoplay: true,
  muted: true, // Required for iOS
});
```

## 🧪 Testing Checklist

- [ ] Desktop Chrome: Feed loads and scrolls
- [ ] Desktop Safari: Videos play correctly
- [ ] iPhone Safari: Videos autoplay muted
- [ ] iPhone Safari: Touch scrolling smooth
- [ ] iPad Safari: Lightbox works
- [ ] Android Chrome: All features work
- [ ] Slow 3G: Loading states show
- [ ] Offline: Error messages display

## 📚 Further Reading

- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Import Maps](https://github.com/WICG/import-maps)
- [Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/Introduction/Introduction.html)
- [Webflow Custom Code](https://university.webflow.com/lesson/custom-code-in-the-head-and-body-tags)

## ❓ FAQ

**Q: Can I still use this with Webflow?**
A: Yes! Just host the src/ folder somewhere and import via CDN.

**Q: Do I need a build step?**
A: No! This uses native ES6 modules. No webpack/vite needed.

**Q: What about IE11?**
A: Not supported. Use a transpiler like Babel if needed.

**Q: Can I mix old and new code?**
A: Yes, but gradually migrate to avoid conflicts.
