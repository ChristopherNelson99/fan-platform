# 🚀 Quick Start Guide

## Step 1: Choose Hosting (Pick One)

### Option A: GitHub Pages (Recommended - Free & Fast)
```bash
# 1. Create new repo on GitHub
# 2. Upload entire 'src' folder
# 3. Go to Settings → Pages → Enable
# 4. Your URL: https://USERNAME.github.io/REPO/src/modules/feed/index.js
```

### Option B: jsDelivr CDN (Free & Global)
```bash
# After uploading to GitHub:
# https://cdn.jsdelivr.net/gh/USERNAME/REPO@main/src/modules/feed/index.js
```

## Step 2: Update Webflow

### Site Settings → Custom Code → Before </head>
```html
<script type="importmap">
{
  "imports": {
    "ky": "https://esm.sh/ky@1.7.2",
    "dayjs": "https://esm.sh/dayjs@1.11.10",
    "dayjs/plugin/relativeTime": "https://esm.sh/dayjs@1.11.10/plugin/relativeTime",
    "dayjs/plugin/updateLocale": "https://esm.sh/dayjs@1.11.10/plugin/updateLocale",
    "alpinejs": "https://esm.sh/alpinejs@3.13.3",
    "plyr": "https://esm.sh/plyr@3.7.8",
    "hls": "https://esm.sh/hls.js@1.4.10"
  }
}
</script>
```

### Feed Page Settings → Before </body>
```html
<script type="module">
  import { initFeedPage } from 'YOUR_CDN_URL/src/modules/feed/index.js';
  initFeedPage();
</script>
```

## Step 3: Test

1. Chrome Desktop → Should load feed
2. Safari Desktop → Videos should work
3. iPhone Safari → Smooth scrolling

Enable debug:
```javascript
localStorage.setItem('DEBUG_MODE', 'true');
```

## ✅ Success!

You should see:
- ✅ Feed loads
- ✅ Videos autoplay (muted)
- ✅ No console errors

## Need Help?

Read the full guides:
- IMPLEMENTATION_SUMMARY.md → Overview & features
- MIGRATION_GUIDE.md → Detailed migration steps
- README.md → Project structure

Enable debug mode and check browser console for detailed logs.
