'use strict';
const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');

const app    = express();
const PORT   = process.env.PORT || 8080;
const FH_KEY = process.env.FINNHUB_KEY || '';

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://erikwonlife-glitch.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ]
}));
app.use(express.json());

// ── IN-MEMORY CACHE ───────────────────────────────────────────────────────────
const CACHE     = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCache(key) {
  const e = CACHE[key];
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { delete CACHE[key]; return null; }
  return e.data;
}
function setCache(key, data) {
  CACHE[key] = { ts: Date.now(), data };
}

// ── STOOQ FETCH ───────────────────────────────────────────────────────────────
async function fetchStooq(symbol, rows) {
  rows = rows || 400;
  try {
    const url = 'https://stooq.com/q/d/l/?s=' + symbol.toLowerCase() + '&i=d';
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) return null;
    const csv = (await res.text()).trim();
    if (!csv || csv.includes('No data') || csv.includes('Przekroczon') || csv.length < 30) return null;
    const lines = csv.split('\n').slice(1).filter(Boolean);
    const out = [];
    for (const ln of lines) {
      const p = ln.split(',');
      const c = parseFloat(p[4]);
      if (!isNaN(c) && c > 0)
        out.push({ date: p[0], open: parseFloat(p[1]) || c, high: parseFloat(p[2]) || c, low: parseFloat(p[3]) || c, close: c, volume: parseFloat(p[5]) || 0 });
    }
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch (e) { return null; }
}

// ── YAHOO FINANCE FALLBACK ────────────────────────────────────────────────────
async function fetchYahoo(symbol, rows) {
  rows = rows || 400;
  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - rows * 86400 * 2;
    const url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&period1=' + from + '&period2=' + now;
    const res  = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json   = await res.json();
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result) return null;
    const ts  = result.timestamp || [];
    const q   = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const out = [];
    ts.forEach(function(t, i) {
      const c = q.close && q.close[i];
      if (c != null && !isNaN(c) && c > 0)
        out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), open: (q.open && q.open[i]) || c, high: (q.high && q.high[i]) || c, low: (q.low && q.low[i]) || c, close: c, volume: (q.volume && q.volume[i]) || 0 });
    });
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch (e) { return null; }
}

// ── FINNHUB LIVE QUOTE ────────────────────────────────────────────────────────
async function fetchFinnhubQuote(symbol) {
  if (!FH_KEY) return null;
  try {
    const res = await fetch('https://finnhub.io/api/v1/quote?symbol=' + symbol + '&token=' + FH_KEY, { timeout: 8000 });
    if (!res.ok) return null;
    const d = await res.json();
    return (d.c && d.c > 0) ? d : null;
  } catch (e) { return null; }
}

// ── INDICATORS ────────────────────────────────────────────────────────────────
function calcRSI(closes, p) {
  p = p || 14;
  if (!closes || closes.length < p + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = closes[i] - closes[i - 1]; d > 0 ? g += d : l -= d; }
  let ag = g / p, al = l / p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
  }
  return al === 0 ? 100 : +(100 - (100 / (1 + ag / al))).toFixed(2);
}

function calcEMA(closes, p) {
  if (!closes || closes.length < p) return [];
  const k = 2 / (p + 1);
  let ema = closes.slice(0, p).reduce(function(a, b) { return a + b; }, 0) / p;
  const out = new Array(p - 1).fill(null);
  out.push(+ema.toFixed(8));
  for (let i = p; i < closes.length; i++) { ema = closes[i] * k + ema * (1 - k); out.push(+ema.toFixed(8)); }
  return out;
}

function calcMACD(closes, fast, slow, sig) {
  fast = fast || 12; slow = slow || 26; sig = sig || 9;
  const ef  = calcEMA(closes, fast);
  const es  = calcEMA(closes, slow);
  const ml  = closes.map(function(_, i) { return ef[i] != null && es[i] != null ? +(ef[i] - es[i]).toFixed(8) : null; });
  const se  = calcEMA(ml.filter(function(v) { return v != null; }), sig);
  const sf  = new Array(ml.length).fill(null);
  let vi = 0;
  for (let i = 0; i < ml.length; i++) { if (ml[i] != null) sf[i] = se[vi++]; }
  const hist = ml.map(function(v, i) { return v != null && sf[i] != null ? +(v - sf[i]).toFixed(8) : null; });
  return { macdLine: ml, signalLine: sf, histogram: hist };
}

function calcMA(closes, p) {
  if (!closes || closes.length < p) return null;
  return closes.slice(-p).reduce(function(a, b) { return a + b; }, 0) / p;
}

function calcRSISeries(closes, p) {
  p = p || 14;
  const out = new Array(p).fill(null);
  for (let i = p; i < closes.length; i++) out.push(calcRSI(closes.slice(0, i + 1), p));
  return out;
}

function overallSignal(rsi, price, ma20, ma50, ma200, macdVal) {
  let s = 0;
  if (rsi != null)    { if (rsi < 35) s += 2; else if (rsi > 65) s -= 2; }
  if (ma20)           price > ma20  ? s++ : s--;
  if (ma50)           price > ma50  ? s++ : s--;
  if (ma200)          price > ma200 ? s++ : s--;
  if (macdVal != null) macdVal > 0  ? s++ : s--;
  return s >= 2 ? 'bull' : s <= -2 ? 'bear' : 'neut';
}

// ── BUILD FULL RESPONSE ───────────────────────────────────────────────────────
function buildResponse(candles, quote, dec) {
  if (!candles || !candles.length) return null;
  let closes = candles.map(function(d) { return d.close; });
  if (quote && quote.c && quote.c > 0) closes = closes.slice(0, -1).concat([quote.c]);

  const price    = closes[closes.length - 1];
  const prev     = closes[closes.length - 2] || price;
  const change   = ((price - prev) / prev) * 100;
  const rsi      = calcRSI(closes, 14);
  const ma20     = calcMA(closes, 20);
  const ma50     = calcMA(closes, 50);
  const ma200    = calcMA(closes, 200);
  const macd     = calcMACD(closes);
  const lastMacd = macd.macdLine[macd.macdLine.length - 1];
  const signal   = overallSignal(rsi, price, ma20, ma50, ma200, lastMacd);

  const W        = Math.min(closes.length, 252);
  const cLabels  = candles.map(function(d) { return d.date; }).slice(-W);
  const cCloses  = closes.slice(-W);
  const rsiSeries  = calcRSISeries(cCloses, 14);
  const macdSeries = calcMACD(cCloses);
  const ma20s  = cCloses.map(function(_, i) { const s = cCloses.slice(0, i + 1); return s.length >= 20  ? +calcMA(s, 20).toFixed(dec + 1)  : null; });
  const ma50s  = cCloses.map(function(_, i) { const s = cCloses.slice(0, i + 1); return s.length >= 50  ? +calcMA(s, 50).toFixed(dec + 1)  : null; });
  const ma200s = cCloses.map(function(_, i) { const s = cCloses.slice(0, i + 1); return s.length >= 200 ? +calcMA(s, 200).toFixed(dec + 1) : null; });

  return {
    symbol: null,
    price: price, prev: prev, change: change,
    high:  (quote && quote.h) ? quote.h : price,
    low:   (quote && quote.l) ? quote.l : price,
    open:  (quote && quote.o) ? quote.o : prev,
    rsi: rsi, ma20: ma20, ma50: ma50, ma200: ma200,
    macd: {
      line:      lastMacd,
      signal:    macd.signalLine[macd.signalLine.length - 1],
      histogram: macd.histogram[macd.histogram.length - 1]
    },
    signal: signal,
    candles: candles.length,
    chart: {
      labels: cLabels, closes: cCloses,
      ma20s: ma20s, ma50s: ma50s, ma200s: ma200s,
      rsiSeries: rsiSeries,
      macdLine:   macdSeries.macdLine,
      signalLine: macdSeries.signalLine,
      histogram:  macdSeries.histogram
    }
  };
}

// ── INSTRUMENT REGISTRY ───────────────────────────────────────────────────────
const INSTRUMENTS = {
  'fx/eurusd':  { stooq: 'eurusd',  yf: 'EURUSD=X', dec: 5 },
  'fx/gbpusd':  { stooq: 'gbpusd',  yf: 'GBPUSD=X', dec: 5 },
  'fx/usdjpy':  { stooq: 'usdjpy',  yf: 'USDJPY=X', dec: 3 },
  'fx/usdchf':  { stooq: 'usdchf',  yf: 'USDCHF=X', dec: 5 },
  'fx/audusd':  { stooq: 'audusd',  yf: 'AUDUSD=X', dec: 5 },
  'cmd/gold':   { stooq: 'xauusd',  yf: 'GC=F',     dec: 2 },
  'cmd/silver': { stooq: 'xagusd',  yf: 'SI=F',     dec: 3 },
  'cmd/oil':    { stooq: 'cl.f',    yf: 'CL=F',     dec: 2 },
  'cmd/natgas': { stooq: 'ng.f',    yf: 'NG=F',     dec: 3 },
  'eq/aapl':    { stooq: 'aapl.us', yf: 'AAPL', fhq: 'AAPL', dec: 2 },
  'eq/msft':    { stooq: 'msft.us', yf: 'MSFT', fhq: 'MSFT', dec: 2 },
  'eq/nvda':    { stooq: 'nvda.us', yf: 'NVDA', fhq: 'NVDA', dec: 2 },
  'eq/tsla':    { stooq: 'tsla.us', yf: 'TSLA', fhq: 'TSLA', dec: 2 },
  'eq/spx':     { stooq: 'spy.us',  yf: 'SPY',  fhq: 'SPY',  dec: 2 },
};

// ── COINGECKO PROXY ROUTES ────────────────────────────────────────────────────

// Main markets data (coin table, ticker, sparklines)
app.get('/api/crypto/markets', async function(req, res) {
  const cached = getCache('crypto/markets');
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd' +
      '&ids=bitcoin,ethereum,tether,binancecoin,ripple,usd-coin,solana,tron,avalanche-2,' +
      'chainlink,polkadot,dogecoin,shiba-inu,matic-network,litecoin,uniswap,cardano,stellar,monero,cosmos' +
      '&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d';
    const r = await fetch(url, { timeout: 14000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    const data = await r.json();
    setCache('crypto/markets', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Global market stats
app.get('/api/crypto/global', async function(req, res) {
  const cached = getCache('crypto/global');
  if (cached) return res.json(cached);
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/global', { timeout: 12000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    const data = await r.json();
    setCache('crypto/global', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// BTC 365-day chart
app.get('/api/crypto/btcchart', async function(req, res) {
  const cached = getCache('crypto/btcchart');
  if (cached) return res.json(cached);
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily', { timeout: 14000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    const data = await r.json();
    setCache('crypto/btcchart', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Any coin chart (e.g. /api/crypto/coin/ethereum/chart?days=60)
app.get('/api/crypto/coin/:id/chart', async function(req, res) {
  const id       = req.params.id;
  const days     = req.query.days || 365;
  const cacheKey = 'crypto/coin/' + id + '/chart/' + days;
  const cached   = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/' + id + '/market_chart?vs_currency=usd&days=' + days + '&interval=daily';
    const r   = await fetch(url, { timeout: 14000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    const data = await r.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Pre-computed RSI for crypto RSI dashboard
app.get('/api/crypto/rsi/:id', async function(req, res) {
  const id       = req.params.id;
  const cacheKey = 'crypto/rsi/' + id;
  const cached   = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/' + id + '/market_chart?vs_currency=usd&days=60&interval=daily';
    const r   = await fetch(url, { timeout: 14000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    const d = await r.json();
    if (!d || !d.prices || !d.prices.length) return res.status(502).json({ error: 'No price data' });

    const prices = d.prices.map(function(p) { return p[1]; });
    const dates  = d.prices.map(function(p) { return new Date(p[0]).toLocaleDateString('en', { month: 'short', day: 'numeric' }); });

    // RSI series calculation
    const rsiArr = [];
    const p = 14;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const diff = prices[i] - prices[i-1]; diff > 0 ? g += diff : l -= diff; }
    let ag = g / p, al = l / p;
    for (let i = 0; i < prices.length; i++) {
      if (i < p) { rsiArr.push(null); continue; }
      if (i === p) { rsiArr.push(al === 0 ? 100 : +(100 - (100 / (1 + ag / al))).toFixed(2)); continue; }
      const diff = prices[i] - prices[i-1];
      ag = (ag * (p-1) + (diff > 0 ? diff : 0)) / p;
      al = (al * (p-1) + (diff < 0 ? -diff : 0)) / p;
      rsiArr.push(al === 0 ? 100 : +(100 - (100 / (1 + ag / al))).toFixed(2));
    }

    const valid  = rsiArr.map(function(v, i) { return { v: v, d: dates[i] }; }).filter(function(x) { return x.v !== null; });
    const last30 = valid.slice(-30);
    const vals30 = last30.map(function(x) { return x.v; });
    const rsi7   = valid.slice(-7).map(function(x) { return x.v; });

    const data = {
      current:  valid.length ? valid[valid.length - 1].v : null,
      rsi7d:    rsi7.length  ? rsi7[rsi7.length - 1]    : null,
      vals30:   vals30,
      labels30: last30.map(function(x) { return x.d; }),
      high30:   vals30.length ? +Math.max.apply(null, vals30).toFixed(1) : null,
      low30:    vals30.length ? +Math.min.apply(null, vals30).toFixed(1) : null
    };
    setCache(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Fear & Greed proxy
app.get('/api/crypto/feargreed', async function(req, res) {
  const cached = getCache('crypto/feargreed');
  if (cached) return res.json(cached);
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=90', { timeout: 10000 });
    if (!r.ok) return res.status(502).json({ error: 'FNG ' + r.status });
    const data = await r.json();
    setCache('crypto/feargreed', data);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── SINGLE INSTRUMENT ENDPOINT ────────────────────────────────────────────────
app.get('/api/:type/:id', async function(req, res) {
  const key  = req.params.type + '/' + req.params.id;
  const inst = INSTRUMENTS[key];
  if (!inst) return res.status(404).json({ error: 'Unknown instrument: ' + key });

  const cached = getCache(key);
  if (cached) return res.json(cached);

  let candles = await fetchStooq(inst.stooq);
  if (!candles || candles.length < 20) candles = await fetchYahoo(inst.yf);
  if (!candles || candles.length < 20) return res.status(502).json({ error: 'Data unavailable for ' + key });

  let quote = null;
  if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);

  const data = buildResponse(candles, quote, inst.dec);
  if (!data) return res.status(502).json({ error: 'Build failed for ' + key });

  data.symbol = key.split('/')[1].toUpperCase();
  setCache(key, data);
  res.json(data);
});

// ── OVERVIEW ENDPOINT ─────────────────────────────────────────────────────────
app.get('/api/overview/:type', async function(req, res) {
  const type     = req.params.type;
  const keys     = Object.keys(INSTRUMENTS).filter(function(k) { return k.indexOf(type + '/') === 0; });
  if (!keys.length) return res.status(404).json({ error: 'Unknown type: ' + type });

  const cacheKey = 'overview/' + type;
  const cached   = getCache(cacheKey);
  if (cached) return res.json(cached);

  const results = await Promise.all(keys.map(async function(key) {
    const inst  = INSTRUMENTS[key];
    let candles = await fetchStooq(inst.stooq);
    if (!candles || candles.length < 20) candles = await fetchYahoo(inst.yf);
    let quote = null;
    if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);
    const data = buildResponse(candles, quote, inst.dec);
    if (!data) return null;
    data.symbol = key.split('/')[1].toUpperCase();
    return { key: key, data: data };
  }));

  const out = {};
  results.forEach(function(r) { if (r) out[r.key] = r.data; });
  setCache(cacheKey, out);
  res.json(out);
});

// ── COIN TABLE ENDPOINTS ──────────────────────────────────────────────────────
// These power the main crypto price table with filter tabs

// Top 400 coins — fetches 2 pages of 200 from CoinGecko
// GET /api/crypto/coins?page=1  (coins 1-200)
// GET /api/crypto/coins?page=2  (coins 201-400)
app.get('/api/crypto/coins', async function(req, res) {
  var page = parseInt(req.query.page) || 1;
  if (page < 1 || page > 2) page = 1;
  var cacheKey = 'crypto/coins/page' + page;
  var cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    var url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd' +
      '&order=market_cap_desc&per_page=200&page=' + page +
      '&sparkline=true&price_change_percentage=1h,24h,7d,30d';
    var r = await fetch(url, { timeout: 15000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    var data = await r.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// DeFi tokens category
// GET /api/crypto/category/defi
app.get('/api/crypto/category/defi', async function(req, res) {
  var cached = getCache('crypto/category/defi');
  if (cached) return res.json(cached);
  try {
    var url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd' +
      '&category=decentralized-finance-defi&order=market_cap_desc&per_page=100&page=1' +
      '&sparkline=true&price_change_percentage=1h,24h,7d';
    var r = await fetch(url, { timeout: 15000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    var data = await r.json();
    setCache('crypto/category/defi', data);
    res.json(data);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// Layer 1 blockchains category
// GET /api/crypto/category/layer1
app.get('/api/crypto/category/layer1', async function(req, res) {
  var cached = getCache('crypto/category/layer1');
  if (cached) return res.json(cached);
  try {
    var url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd' +
      '&category=layer-1&order=market_cap_desc&per_page=100&page=1' +
      '&sparkline=true&price_change_percentage=1h,24h,7d';
    var r = await fetch(url, { timeout: 15000 });
    if (!r.ok) return res.status(502).json({ error: 'CoinGecko ' + r.status });
    var data = await r.json();
    setCache('crypto/category/layer1', data);
    res.json(data);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// Binance exchange tokens — from Binance public API (no key required)
// Returns top 200 USDT pairs sorted by volume
// GET /api/crypto/binance
app.get('/api/crypto/binance', async function(req, res) {
  var cached = getCache('crypto/binance');
  if (cached) return res.json(cached);
  try {
    // Fetch 24hr ticker data for all USDT pairs from Binance
    var r = await fetch('https://api.binance.com/api/v3/ticker/24hr', { timeout: 15000 });
    if (!r.ok) return res.status(502).json({ error: 'Binance ' + r.status });
    var tickers = await r.json();
    // Filter USDT pairs only, sort by quote volume descending
    var usdtPairs = tickers
      .filter(function(t) { return t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 0; })
      .sort(function(a, b) { return parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume) })
      .slice(0, 200)
      .map(function(t) {
        var sym = t.symbol.replace('USDT', '');
        var price = parseFloat(t.lastPrice);
        var chg24 = parseFloat(t.priceChangePercent);
        var vol   = parseFloat(t.quoteVolume);
        return {
          id:                    sym.toLowerCase() + '-binance',
          symbol:                sym.toLowerCase(),
          name:                  sym,
          current_price:         price,
          price_change_percentage_24h: chg24,
          total_volume:          vol,
          market_cap:            0,
          image:                 '',
          source:                'binance',
          high_24h:              parseFloat(t.highPrice),
          low_24h:               parseFloat(t.lowPrice),
          sparkline_in_7d:       { price: [] }
        };
      });
    setCache('crypto/binance', usdtPairs);
    res.json(usdtPairs);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// Hyperliquid perps — from Hyperliquid public API (no key required)
// GET /api/crypto/hyperliquid
app.get('/api/crypto/hyperliquid', async function(req, res) {
  var cached = getCache('crypto/hyperliquid');
  if (cached) return res.json(cached);
  try {
    // Hyperliquid public meta + asset ctx endpoint
    var r = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      timeout: 15000
    });
    if (!r.ok) return res.status(502).json({ error: 'Hyperliquid ' + r.status });
    var data = await r.json();
    // data[0] = meta (universe array), data[1] = asset contexts (prices, volumes, etc.)
    var universe = data[0] && data[0].universe ? data[0].universe : [];
    var ctxs     = data[1] ? data[1] : [];
    var coins = universe.map(function(asset, i) {
      var ctx   = ctxs[i] || {};
      var price = parseFloat(ctx.markPx) || 0;
      var oi    = parseFloat(ctx.openInterest) || 0;
      var vol   = parseFloat(ctx.dayNtlVlm) || 0;
      var chg   = parseFloat(ctx.prevDayPx) > 0
        ? ((price - parseFloat(ctx.prevDayPx)) / parseFloat(ctx.prevDayPx)) * 100
        : 0;
      return {
        id:                    asset.name.toLowerCase() + '-hl',
        symbol:                asset.name.toLowerCase(),
        name:                  asset.name,
        current_price:         price,
        price_change_percentage_24h: +chg.toFixed(2),
        total_volume:          vol,
        market_cap:            oi * price,
        open_interest:         oi,
        image:                 '',
        source:                'hyperliquid',
        sparkline_in_7d:       { price: [] }
      };
    }).filter(function(c) { return c.current_price > 0; })
      .sort(function(a, b) { return b.total_volume - a.total_volume });
    setCache('crypto/hyperliquid', coins);
    res.json(coins);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', function(req, res) {
  res.json({
    status:      'ok',
    server:      'ChainRoot API',
    version:     '3.0.0',
    cached:      Object.keys(CACHE).length,
    instruments: Object.keys(INSTRUMENTS).length,
    uptime:      Math.floor(process.uptime()) + 's',
    endpoints: {
      crypto: [
        '/api/crypto/markets',
        '/api/crypto/global',
        '/api/crypto/btcchart',
        '/api/crypto/coins?page=1 (200 coins)',
        '/api/crypto/coins?page=2 (coins 201-400)',
        '/api/crypto/category/defi',
        '/api/crypto/category/layer1',
        '/api/crypto/binance (top 200 USDT pairs)',
        '/api/crypto/hyperliquid (perps)',
        '/api/crypto/rsi/:id',
        '/api/crypto/feargreed'
      ],
      fx:          ['eurusd','gbpusd','usdjpy','usdchf','audusd'].map(function(s){return '/api/fx/'+s;}),
      commodities: ['gold','silver','oil','natgas'].map(function(s){return '/api/cmd/'+s;}),
      equities:    ['aapl','msft','nvda','tsla','spx'].map(function(s){return '/api/eq/'+s;})
    }
  });
});

app.get('/', function(req, res) {
  res.json({ name: 'ChainRoot Market Data API v2.0', health: '/health' });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, function() {
  console.log('ChainRoot API v2.0 running on port ' + PORT);
  console.log('Finnhub key: ' + (FH_KEY ? 'configured' : 'NOT SET'));
  console.log('Instruments: ' + Object.keys(INSTRUMENTS).length + ' | CoinGecko proxy: enabled');
});
