# ChainRoot — Market Intelligence Dashboard

> Mongolian-first crypto & TradFi market intelligence platform with live data, technical analysis, and a TradingView indicator subscription business.

![ChainRoot](https://img.shields.io/badge/ChainRoot-Market%20Intelligence-00e87a?style=flat-square)
![Language](https://img.shields.io/badge/Language-Mongolian%20%2B%20English-f4c542?style=flat-square)
![Data](https://img.shields.io/badge/Data-Finnhub%20%2B%20CoinGecko-00b4d8?style=flat-square)

---

## 🗂 Repository Structure

```
chainroot/
├── index.html          ← Main dashboard (single-file app, deploy this)
├── README.md           ← This file
├── DEPLOY.md           ← Step-by-step deployment guide
├── VIDEO_GUIDE.md      ← How to add your training video
└── ROADMAP.md          ← Next features to build
```

---

## 🚀 Quick Deploy (GitHub Pages — Free)

1. Create a new GitHub repository named `chainroot` (or your preferred name)
2. Upload `index.html` to the root of the repo
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. Your site will be live at `https://YOUR_USERNAME.github.io/chainroot`

> For a custom domain (e.g. `chainroot.mn`) see `DEPLOY.md`

---

## 📊 What's Inside the Dashboard

### Market Data
| Section | Data Source | Update Frequency |
|---|---|---|
| Crypto Prices (20 coins) | CoinGecko free API | On page load |
| Bitcoin MA Charts | CoinGecko | On page load |
| Fear & Greed Index | Alternative.me | On page load |
| Forex (5 pairs) | Finnhub + Stooq fallback | On panel open |
| Commodities (Gold, Silver, Oil, Gas) | Finnhub + Stooq fallback | On panel open |
| Stocks (AAPL, MSFT, NVDA, TSLA, SPY) | Finnhub WebSocket (live) | Real-time ticks |

### Features
- 🇲🇳 **Mongolian default** with English toggle on training page
- 📈 **TradingView live charts** — candlestick with MA + RSI overlays
- 🔴 **Live price WebSocket** — US stocks update in real-time
- 📊 **RSI-14 + MA 20/50/200** — computed from Finnhub history
- 🔐 **Auth system** — email registration + MetaMask / Phantom wallet connect
- 💼 **Portfolio tracker** — manually add holdings, see live value
- 🎓 **Free Training landing page** — embed your YouTube video + pricing plans

---

## 🔑 API Keys

The dashboard uses two free APIs. Both keys are already in `index.html`:

| API | Key Location | Free Tier Limits |
|---|---|---|
| **Finnhub** | `const FH_KEY = '...'` near bottom of file | 60 req/min |
| **CoinGecko** | No key needed (public endpoint) | ~30 req/min |

> ⚠️ The Finnhub key in this repo is for development only. For production, consider using environment variables via a small backend (e.g. Cloudflare Workers free tier).

---

## 🎬 Adding Your Training Video

See `VIDEO_GUIDE.md` for full instructions. Quick version:

1. Upload video to YouTube (can be unlisted)
2. Copy your video ID from the URL: `youtube.com/watch?v=`**`XXXXXXXXXXX`**
3. In `index.html`, find `YOUR_YOUTUBE_VIDEO_ID` and replace it with your ID
4. Delete the placeholder `div` above it
5. Uncomment the `<iframe>` block

---

## 💰 Monetization (The Plan)

1. **Free Training video** → drives traffic → builds trust
2. **TradingView Indicator subscription** → $9/mo or $69/yr
3. **Affiliate links** to exchanges (Binance, Bybit) → passive commission
4. **Telegram/Discord community** → paid membership tier

---

## 🛠 Tech Stack

- **Pure HTML/CSS/JS** — zero build tools, zero npm, works offline
- **Chart.js 4.4.1** — crypto sparklines and Bitcoin MA charts
- **TradingView Widget** — live candlestick charts for FX/CMD/EQ
- **Finnhub API** — real-time stock quotes + 1yr daily candles
- **CoinGecko API** — crypto market data
- **Finnhub WebSocket** — live price ticks for equities

---

## 📱 Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

*Built for the Mongolian crypto community 🇲🇳*
