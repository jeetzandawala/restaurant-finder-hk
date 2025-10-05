# 🌐 Frontend Hosting Options

The frontend is **pure static files** (HTML, CSS, JavaScript) - you can host it anywhere! Here are all your options:

## 📊 Quick Comparison

| Option | Cost | Setup Time | SSL | CDN | Best For |
|--------|------|------------|-----|-----|----------|
| Your Personal Website | $0 | 5 min | ✅ | Depends | Already have hosting |
| Google Cloud Storage | $0.01/GB | 10 min | ✅ | ✅ | Google ecosystem |
| Vercel | Free | 2 min | ✅ | ✅ | Easiest, auto-deploy |
| Netlify | Free | 2 min | ✅ | ✅ | Drag & drop |
| GitHub Pages | Free | 5 min | ✅ | ✅ | Already on GitHub |
| Cloudflare Pages | Free | 5 min | ✅ | ✅ | Fast global CDN |
| AWS S3 + CloudFront | ~$0.50/mo | 15 min | ✅ | ✅ | AWS ecosystem |

---

## 🏠 Option 1: Your Personal Website

**Perfect if:** You already have web hosting (GoDaddy, Bluehost, HostGator, etc.)

### Steps:
```bash
# 1. Update config to point to Railway
# Edit frontend/config.js - change baseUrl to:
baseUrl: 'https://restaurant-checker-production.up.railway.app'

# 2. Upload these files to your website:
frontend/
  ├── index.html
  ├── styles.css
  ├── script-streaming.js
  ├── config.js
  ├── manifest.json
  └── .htaccess (optional, for cleaner URLs)

# 3. Access at:
# https://yourwebsite.com/index.html
# or https://yourwebsite.com/restaurants/
```

### Via FTP (FileZilla, etc.):
1. Connect to your hosting
2. Navigate to `public_html/` or `www/`
3. Create folder: `restaurant-finder/`
4. Upload all files from `frontend/` folder
5. Access: `https://yourwebsite.com/restaurant-finder/`

### Via cPanel:
1. Login to cPanel
2. File Manager → public_html
3. Upload → Select all frontend files
4. Done!

**Pros:**
- ✅ Use existing hosting (no extra cost)
- ✅ Your own domain
- ✅ Full control

**Cons:**
- ❌ No auto-deploy from git
- ❌ Manual uploads for updates

---

## ☁️ Option 2: Google Cloud Storage (Static Website)

**Perfect if:** You use Google Cloud, want cheap hosting with CDN

### Setup:
```bash
# 1. Create a GCS bucket
gsutil mb gs://hk-restaurant-finder

# 2. Make it public
gsutil iam ch allUsers:objectViewer gs://hk-restaurant-finder

# 3. Configure as website
gsutil web set -m index.html gs://hk-restaurant-finder

# 4. Update config.js to point to Railway API
# Then upload:
gsutil -m cp -r frontend/* gs://hk-restaurant-finder/

# 5. Access at:
# https://storage.googleapis.com/hk-restaurant-finder/index.html

# Optional: Add custom domain via Cloud CDN
```

### Cost:
- **Storage**: $0.020 per GB per month
- **Network**: $0.12 per GB (first 1TB)
- **Example**: 10MB site + 1000 visits = **~$0.15/month**

### With Cloud CDN (Optional):
```bash
# Add CDN for faster global access
gcloud compute backend-buckets create hk-restaurant-backend \
    --gcs-bucket-name=hk-restaurant-finder \
    --enable-cdn
```

**Pros:**
- ✅ Extremely cheap (~$0.15/month)
- ✅ Google's infrastructure
- ✅ Can add Cloud CDN
- ✅ Custom domain support

**Cons:**
- ❌ More setup than Vercel
- ❌ No auto-deploy
- ❌ Need gcloud CLI

---

## ⚡ Option 3: Vercel (Easiest)

**Perfect if:** Want zero-config deployment with auto-updates from git

### Setup:
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
cd frontend
vercel --prod

# Done! Live in 30 seconds
```

### Or via Web UI:
1. Go to vercel.com
2. Import Git repository
3. Set root directory: `frontend/`
4. Deploy

**Pros:**
- ✅ Easiest (2 minutes)
- ✅ Auto-deploy from git pushes
- ✅ Free SSL
- ✅ Global CDN
- ✅ Custom domain

**Cons:**
- ❌ Less control than your own hosting

---

## 🎨 Option 4: Netlify (Drag & Drop)

**Perfect if:** Want simple drag-and-drop deployment

### Setup:
1. Go to app.netlify.com
2. Drag `frontend/` folder onto page
3. Done! Live instantly

**Or via CLI:**
```bash
npm i -g netlify-cli
cd frontend
netlify deploy --prod
```

**Pros:**
- ✅ Drag and drop!
- ✅ Free tier generous
- ✅ Auto SSL + CDN
- ✅ Forms, functions available

**Cons:**
- ❌ Similar to Vercel (no real cons)

---

## 🐙 Option 5: GitHub Pages (Free)

**Perfect if:** Already using GitHub, want free hosting

### Setup:
```bash
# 1. Create gh-pages branch
git checkout -b gh-pages

# 2. Copy frontend to root
cp -r frontend/* .

# 3. Update config.js to point to Railway
# Then commit and push
git add .
git commit -m "Deploy frontend"
git push origin gh-pages

# 4. Enable in GitHub:
# Repo → Settings → Pages → Source: gh-pages branch

# Access at:
# https://yourusername.github.io/restaurant-finder-hk/
```

**Pros:**
- ✅ Free forever
- ✅ Already on GitHub
- ✅ Custom domain support
- ✅ Auto SSL

**Cons:**
- ❌ Public repo required (or pay for private)
- ❌ Need separate gh-pages branch

---

## 🟠 Option 6: Cloudflare Pages

**Perfect if:** Want fastest CDN, zero-config

### Setup:
1. Go to pages.cloudflare.com
2. Connect GitHub repo
3. Build settings:
   - Framework: None
   - Build command: (leave empty)
   - Build output: `frontend`
4. Deploy

**Pros:**
- ✅ Cloudflare's global CDN (fastest)
- ✅ Free tier generous
- ✅ DDoS protection included
- ✅ Auto-deploy from git

**Cons:**
- ❌ Need Cloudflare account

---

## 🔶 Option 7: AWS S3 + CloudFront

**Perfect if:** Use AWS, want enterprise-grade hosting

### Setup:
```bash
# 1. Create S3 bucket
aws s3 mb s3://hk-restaurant-finder

# 2. Upload files
aws s3 sync frontend/ s3://hk-restaurant-finder/ --acl public-read

# 3. Enable static website hosting
aws s3 website s3://hk-restaurant-finder/ \
    --index-document index.html

# 4. Create CloudFront distribution (CDN)
# (via AWS Console - takes 15 min)

# Access at:
# https://xxxxx.cloudfront.net/
```

**Cost:**
- **S3**: $0.023 per GB
- **CloudFront**: $0.085 per GB (first 10TB)
- **Example**: **~$0.50/month** for small site

**Pros:**
- ✅ AWS infrastructure
- ✅ Scales to millions of users
- ✅ Fine-grained control

**Cons:**
- ❌ More complex setup
- ❌ More expensive than others

---

## 🎯 My Recommendation

### For Quick Testing:
**Netlify** - Drag & drop the `frontend/` folder, done in 1 minute

### For Your Use Case:
**Your Personal Website** - Since you mentioned you have one!
- Zero additional cost
- Full control
- Just upload via FTP/cPanel

### For Production:
**Vercel or Cloudflare Pages** - Auto-deploy, global CDN, free SSL

---

## 📝 Before Deploying Anywhere

**CRITICAL**: Update `frontend/config.js`:

```javascript
const CONFIG = {
    API: {
        baseUrl: 'https://restaurant-checker-production.up.railway.app', // Railway API
        endpoint: '/api/check-stream',
        timeout: 120000,
    },
    // ... rest of config
};
```

Change `baseUrl` from `http://localhost:8080` to your Railway URL!

---

## 🧪 Testing Before Deploy

1. Test locally first (already set up)
2. Verify accuracy improvements
3. Check console for errors
4. Test on mobile (responsive design)
5. Then deploy!

---

## 💰 Cost Comparison (Monthly)

| Option | Small Traffic | Medium Traffic | Large Traffic |
|--------|---------------|----------------|---------------|
| Your Website | $0 (included) | $0 (included) | $0 (included) |
| GCS | $0.15 | $0.50 | $2.00 |
| Vercel | Free | Free | Free* |
| Netlify | Free | Free | Free* |
| GitHub Pages | Free | Free | Free |
| Cloudflare Pages | Free | Free | Free |
| AWS S3+CF | $0.50 | $2.00 | $5.00 |

*Free tiers are very generous (100GB bandwidth/month)

---

## 🚀 Quick Deploy Commands

### Personal Website (FTP):
```bash
# Just upload these 5 files:
frontend/index.html
frontend/styles.css
frontend/script-streaming.js
frontend/config.js
frontend/manifest.json
```

### Google Cloud:
```bash
gsutil -m cp -r frontend/* gs://your-bucket/
```

### Vercel:
```bash
cd frontend && vercel --prod
```

### Netlify:
```bash
cd frontend && netlify deploy --prod
```

### GitHub Pages:
```bash
git subtree push --prefix frontend origin gh-pages
```

---

## ❓ Which Should You Choose?

**Ask yourself:**

1. **Do you already have web hosting?**
   → Use your personal website (free!)

2. **Want absolute easiest?**
   → Netlify (drag & drop)

3. **Want auto-deploy from git?**
   → Vercel or Cloudflare Pages

4. **Use Google Cloud for API?**
   → Google Cloud Storage

5. **Need enterprise features?**
   → AWS S3 + CloudFront

**Can't decide?** Start with Netlify (1 minute drag-and-drop), migrate later if needed!

---

## 🔗 Useful Links

- Vercel: https://vercel.com
- Netlify: https://netlify.com
- Cloudflare Pages: https://pages.cloudflare.com
- Google Cloud Storage: https://cloud.google.com/storage
- GitHub Pages: https://pages.github.com
- AWS S3: https://aws.amazon.com/s3/

---

**Questions?** Let me know which option you prefer and I'll guide you through the specific steps!
