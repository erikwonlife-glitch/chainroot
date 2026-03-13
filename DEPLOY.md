# ChainRoot — Deployment Guide

## Option 1: GitHub Pages (FREE — Recommended)

This is the fastest way to get your site live for free.

### Steps

**1. Create GitHub account**
Go to [github.com](https://github.com) and sign up if you haven't.

**2. Create new repository**
- Click the **+** button → **New repository**
- Name it: `chainroot` (or `chainroot-dashboard`)
- Set to **Public**
- Click **Create repository**

**3. Upload your file**
- On the repo page, click **Add file → Upload files**
- Drag `index.html` into the upload area
- Write commit message: `Initial deploy`
- Click **Commit changes**

**4. Enable GitHub Pages**
- Go to your repo → **Settings** tab
- Scroll down to **Pages** in the left sidebar
- Under **Source**, select `Deploy from a branch`
- Branch: `main`, Folder: `/ (root)`
- Click **Save**

**5. Wait 2-3 minutes**
Your site will be live at:
```
https://YOUR_GITHUB_USERNAME.github.io/chainroot
```

---

## Option 2: Custom Domain (e.g. chainroot.mn)

Once you have GitHub Pages working, add your own domain:

**1. Buy domain**
- [nic.mn](https://nic.mn) — for `.mn` domains (Mongolian registry)
- [Namecheap](https://namecheap.com) — for `.com` / `.io` domains

**2. Add domain to GitHub Pages**
- Repo → Settings → Pages → Custom domain
- Enter: `chainroot.mn` (or your domain)
- Click Save

**3. Set DNS records at your domain registrar**
Add these records:
```
Type: A      Name: @    Value: 185.199.108.153
Type: A      Name: @    Value: 185.199.109.153
Type: A      Name: @    Value: 185.199.110.153
Type: A      Name: @    Value: 185.199.111.153
Type: CNAME  Name: www  Value: YOUR_USERNAME.github.io
```

**4. Enable HTTPS**
Back in GitHub Pages settings, check **Enforce HTTPS** (appears after DNS propagates, ~24 hours).

---

## Option 3: Netlify (FREE — Even Easier)

1. Go to [netlify.com](https://netlify.com) and sign up
2. Drag and drop your `index.html` file onto the Netlify dashboard
3. Site is live instantly at a random URL like `amazing-tesla-123.netlify.app`
4. Connect custom domain in Netlify settings

---

## Updating Your Site

After the initial deploy, to update:

**GitHub Pages:**
1. Go to your repo on GitHub
2. Click on `index.html`
3. Click the pencil icon (Edit)
4. Paste your new code
5. Commit — site updates in ~1 minute

Or use the GitHub Desktop app for easier drag-and-drop updates.

---

## SEO Setup (Get Found on Google)

Add these tags inside the `<head>` of `index.html`:

```html
<meta name="description" content="ChainRoot — Монголын хөрөнгө оруулагчдад зориулсан крипто болон хувьцааны зах зээлийн шинжилгээний платформ">
<meta name="keywords" content="крипто, bitcoin, хувьцаа, TradingView, индикатор, Монгол">
<meta property="og:title" content="ChainRoot — Market Intelligence">
<meta property="og:description" content="Crypto & Stock signals for Mongolian investors">
<meta property="og:image" content="https://YOUR_SITE_URL/og-image.png">
<link rel="canonical" href="https://YOUR_SITE_URL">
```

---

*Last updated: 2025*
