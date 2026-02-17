# Webflow/Xano Application Scripts

Modular, optimized scripts for Webflow/Xano web application with full Safari and mobile support.

## 📁 Project Structure

```
src/
├── core/                 # Core utilities and services
│   ├── api.js           # API client configuration
│   ├── auth.js          # Authentication manager
│   ├── storage.js       # LocalStorage utilities
│   └── constants.js     # Global constants
├── modules/             # Feature modules
│   ├── notifications/   # Notification system
│   ├── feed/           # Feed page functionality
│   └── avatar/         # Avatar upload
├── utils/              # Utility functions
│   ├── dom.js          # DOM manipulation helpers
│   ├── video.js        # Video player utilities
│   └── format.js       # Data formatting helpers
└── app.js              # Main application entry point
```

## 🚀 Features

- ✅ ES6 Module Architecture
- ✅ Safari & iOS Compatibility
- ✅ Mobile-First Design
- ✅ Memory Leak Prevention
- ✅ Performance Optimized
- ✅ Type-Safe with JSDoc
- ✅ Error Handling & Recovery

## 📱 Browser Support

- Safari 14+
- iOS Safari 14+
- Chrome 90+
- Firefox 88+
- Edge 90+

## 🔧 Installation

### For Webflow Integration

1. Copy the importmap from `dist/importmap.html` to your Webflow site settings (before `</head>`)
2. Copy the main script from `dist/site-wide.html` to site settings (before `</body>`)
3. For page-specific scripts, embed them in the respective page settings

### For Development

```bash
# No build step required - uses native ES6 modules
# Simply serve the files with a static server
npx serve .
```

## 🔐 Environment Configuration

Update API endpoints in `src/core/constants.js`:

```javascript
export const API_ENDPOINTS = {
  auth: 'https://your-api.xano.io/api:xxx',
  feed: 'https://your-api.xano.io/api:xxx',
  // ... other endpoints
};
```

## 📝 Usage Examples

### Feed Page

```html
<script type="module">
  import { initFeedPage } from './src/modules/feed/index.js';
  
  // Initialize when DOM is ready
  initFeedPage();
</script>
```

### Notifications

```html
<script type="module">
  import { NotificationManager } from './src/modules/notifications/index.js';
  
  const notifications = new NotificationManager();
  await notifications.init();
</script>
```

## 🐛 Debugging

Enable debug mode by setting in localStorage:

```javascript
localStorage.setItem('DEBUG_MODE', 'true');
```

## 📄 License

MIT License - See LICENSE file for details
