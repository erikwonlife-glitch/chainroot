# ChainRoot — Roadmap & Next Steps

## 🎯 Phase 1 — Launch (Now)

- [x] Dashboard with live crypto prices
- [x] Forex, Commodities, Stocks panels with Finnhub data
- [x] TradingView live charts
- [x] Free Training landing page
- [x] Mongolian language default + English toggle
- [x] Auth system (email + Web3 wallet)
- [ ] **Upload training video to YouTube → embed in site**
- [ ] **Deploy to GitHub Pages**
- [ ] **Set up custom domain (chainroot.mn)**

---

## 💰 Phase 2 — Monetization (Next 30 days)

### Set Up Payments

**Option A — Gumroad (Easiest)**
1. Create account at [gumroad.com](https://gumroad.com)
2. Create a product: "ChainRoot Indicator — Monthly Access" at $9
3. Create a second product: "ChainRoot Indicator — Annual Access" at $69
4. Copy the product URLs
5. Replace `alert('Захиалгын холбоос удахгүй!')` in index.html with:
   ```javascript
   window.open('YOUR_GUMROAD_MONTHLY_LINK', '_blank')
   ```

**Option B — Stripe (More professional)**
- Requires a small backend (Cloudflare Workers or Vercel free tier)
- We can build this when you're ready

**Option C — Direct bank transfer (Mongolian banks)**
- For MNT payments: add your QPay or MonPay QR code
- Simple, no fees for domestic Mongolian customers

### Traffic Plan

**Week 1-2: TikTok / YouTube Shorts**
- Record 60-second clips showing the indicator catching BTC moves
- Post daily with hashtags: #крипто #bitcoin #монгол #trading
- End every video: "Үнэгүй сургалт → chainroot.mn дээр"

**Week 3-4: Mongolian Facebook Groups**
- Join groups like "Монголын Трейдерүүд", "Крипто Монгол"
- Share value (analysis, predictions) — NOT just ads
- After establishing trust, share your free training link

**Month 2+: Telegram Channel**
- Create "ChainRoot Signals" Telegram channel
- Post daily BUY/SELL signals from your indicator
- Free signals build trust → paid subscribers convert

---

## 🔧 Phase 3 — Technical Improvements (Month 2-3)

### Real Payment Backend
```
User clicks Subscribe
→ Cloudflare Worker creates Stripe checkout session
→ User pays
→ Webhook marks user as "pro" in database
→ User gets TradingView indicator access
```

**Cost: $0** — Cloudflare Workers free tier handles 100k requests/day

### TradingView Indicator Access Control
- Publish indicator on TradingView Pine Script
- Use TradingView's "Invite-Only" script feature
- After payment, manually (or via API) add user to access list

### Email Newsletter
- Integrate [Brevo](https://brevo.com) (free up to 300 emails/day)
- Capture email on training page registration
- Weekly newsletter: market analysis in Mongolian

### Analytics
Add to `<head>` of index.html:
```html
<!-- Google Analytics 4 — free -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 📊 Phase 4 — Scale (Month 3-6)

- [ ] Binance/Bybit affiliate links (earn 20-40% commission on trading fees)
- [ ] Paid Telegram community tier ($15/month)
- [ ] Live trading webinars (Zoom + ticket sales)
- [ ] Mobile app (PWA — wrap existing site, no App Store needed)
- [ ] Multi-currency pricing (MNT + USD)

---

## 📈 Revenue Projections (Conservative)

| Month | Subscribers | Monthly Revenue |
|---|---|---|
| 1 | 5 | $45 |
| 2 | 20 | $180 |
| 3 | 50 | $450 |
| 6 | 150 | $1,350 |
| 12 | 400 | $3,600 |

The Mongolian market is underserved — you have first-mover advantage.

---

## 🆘 Questions for Next Session

Replace these with your actual questions:

1. How do I set up TradingView invite-only indicator?
2. How do I connect Gumroad payments to user accounts?
3. How do I add QPay for Mongolian bank payments?
4. How do I build a Telegram bot that posts signals automatically?

---

*Update this file after each session with what was completed and what's next.*
