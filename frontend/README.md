# Hong Kong Table Finder - Frontend

A beautiful, modern web interface for checking restaurant availability across Hong Kong's premium dining establishments.

## 🌟 Features

- **Modern UI/UX**: Glass morphism design with smooth animations
- **Dark Mode**: Automatic system preference detection with manual toggle
- **Mobile Responsive**: Optimized for all screen sizes
- **Real-time Search**: Instant availability checking across 70+ restaurants
- **Performance Optimized**: Efficient loading states and error handling
- **Accessibility**: WCAG 2.1 compliant with keyboard navigation
- **PWA Ready**: Service worker support for offline capabilities

## 🚀 Quick Setup

### 1. Update Configuration

Edit `config.js` and update the Railway URL:

```javascript
const CONFIG = {
    API: {
        baseUrl: 'https://your-railway-app.railway.app', // Replace with your Railway URL
        endpoint: '/api/check',
        timeout: 120000,
    },
    // ... other config
};
```

### 2. Upload to Bluehost

1. **Via File Manager:**
   - Login to your Bluehost cPanel
   - Navigate to File Manager
   - Go to `public_html` directory
   - Upload all files from the `frontend` folder

2. **Via FTP:**
   ```bash
   # Using FTP client (like FileZilla)
   Host: ftp.yourdomain.com
   Username: Your Bluehost username
   Password: Your Bluehost password
   
   # Upload all files to /public_html/
   ```

### 3. File Structure on Server

```
public_html/
├── index.html          # Main application
├── script.js           # Application logic
├── styles.css          # Custom styles
├── config.js           # Configuration
└── README.md           # This file
```

## 🔧 Configuration Options

### API Configuration

```javascript
CONFIG.API = {
    baseUrl: 'https://your-railway-app.railway.app',
    endpoint: '/api/check',
    timeout: 120000, // 2 minutes
};
```

### Feature Flags

```javascript
CONFIG.FEATURES = {
    darkMode: true,         // Enable dark mode toggle
    searchHistory: true,    // Save search history (future feature)
    analytics: false,       // Google Analytics integration
    serviceWorker: false,   // PWA capabilities
};
```

### SEO Settings

```javascript
CONFIG.SEO = {
    siteName: 'Hong Kong Table Finder',
    description: 'Find available restaurant tables in Hong Kong instantly...',
    keywords: 'Hong Kong restaurants, table reservations...',
    author: 'JZ Ventures',
    url: 'https://jz-ventures.com',
};
```

## 🎨 Customization

### Colors and Themes

The application uses CSS custom properties for easy theming:

```css
:root {
    --primary-500: #3b82f6;
    --primary-600: #2563eb;
    --primary-700: #1d4ed8;
    --glass-bg: rgba(255, 255, 255, 0.9);
    --glass-border: rgba(255, 255, 255, 0.2);
}
```

### Animations

Control animation behavior:

```css
:root {
    --animation-duration: 0.3s;
    --animation-ease: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 📱 Browser Support

- **Chrome**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

## 🔍 SEO Optimization

### Meta Tags

The application includes comprehensive meta tags for SEO:

```html
<meta name="description" content="Find available restaurant tables in Hong Kong instantly...">
<meta name="keywords" content="Hong Kong restaurants, table reservations...">
<meta property="og:title" content="Hong Kong Table Finder">
<meta property="og:description" content="...">
<meta property="og:image" content="...">
```

### Schema.org Markup

Consider adding structured data for better search engine understanding:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Hong Kong Table Finder",
  "description": "...",
  "url": "https://jz-ventures.com"
}
</script>
```

## 🚀 Performance Optimization

### Loading Performance

- **Preconnect**: DNS resolution for external resources
- **Font Display**: `swap` for better loading experience
- **Image Optimization**: SVG icons for scalability

### Runtime Performance

- **Debounced Inputs**: Prevents excessive API calls
- **Efficient DOM Updates**: Minimal reflows and repaints
- **Memory Management**: Proper cleanup of event listeners

## 🔒 Security Considerations

### CSP Headers

Add these Content Security Policy headers in your `.htaccess`:

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://your-railway-app.railway.app;"
```

### Environment Variables

Never expose sensitive data in frontend code. Use server-side environment variables for:
- API keys
- Database credentials
- Third-party service tokens

## 📊 Analytics (Optional)

### Google Analytics 4

1. Update `config.js`:
```javascript
CONFIG.ANALYTICS.googleAnalyticsId = 'G-XXXXXXXXXX';
```

2. Add GA4 script to `index.html`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure your Railway API allows requests from your domain
   - Check Railway environment variables

2. **Slow Loading**
   - Verify Railway deployment is running
   - Check network connectivity
   - Monitor API response times

3. **Mobile Issues**
   - Test on actual devices
   - Use browser dev tools mobile emulation
   - Check touch interactions

### Debug Mode

Enable debug logging by adding to console:

```javascript
localStorage.setItem('debug', 'true');
```

## 🚀 Deployment Checklist

- [ ] Update `config.js` with correct Railway URL
- [ ] Test API connectivity
- [ ] Verify all files uploaded to `public_html`
- [ ] Check mobile responsiveness
- [ ] Test dark mode functionality
- [ ] Validate HTML/CSS
- [ ] Test across different browsers
- [ ] Check loading performance
- [ ] Verify error handling
- [ ] Test accessibility features

## 📞 Support

For technical support or customization requests:
- Email: support@jz-ventures.com
- Website: https://jz-ventures.com

## 📄 License

This project is proprietary software created for JZ Ventures.

---

Built with ❤️ for Hong Kong food lovers
