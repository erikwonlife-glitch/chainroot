'use strict';
const express  = require('express');
const fetch    = require('node-fetch');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const FH_KEY = process.env.FINNHUB_KEY || '';

// ── CORS — allow your GitHub Pages site ──────────────────────────────────────
app.use(cors({
  origin: [
    'https://erikwonlife-glitch.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ]
}));
app.use(express.json());

// ── IN-MEMORY CACHE ───────────────────────────────────────────────────────────
const CACHE = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCache(key) {
  const entry = CACHE[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { delete CACHE[key]; return null; }
  return entry.data;
}
function setCache(key, data) {
  CACHE[key] = { ts: Date.now(), data };
}

// ── STOOQ FETCH ───────────────────────────────────────────────────────────────
async function fetchStooq(symbol, rows = 400) {
  try {
    const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}&i=d`;
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) return null;
    const csv = (await res.text()).trim();
    if (!csv || csv.includes('No data') || csv.includes('Przekroczon') || csv.length < 30) return null;
    const lines = csv.split('\n').slice(1).filter(Boolean);
    const out = [];
    for (const ln of lines) {
      const p = ln.split(',');
      const c = parseFloat(p[4]);
      if (!isNaN(c) && c > 0) {
        out.push({
          date:   p[0],
          open:   parseFloat(p[1]) || c,
          high:   parseFloat(p[2]) || c,
          low:    parseFloat(p[3]) || c,
          close:  c,
          volume: parseFloat(p[5]) || 0
        });
      }
    }
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch (e) { return null; }
}

// ── YAHOO FINANCE FALLBACK ────────────────────────────────────────────────────
async function fetchYahoo(symbol, rows = 400) {
  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - rows * 86400 * 2;
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${from}&period2=${now}`;
    const res  = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const ts = result.timestamp || [];
    const q  = result.indicators?.quote?.[0] || {};
    const out = [];
    ts.forEach((t, i) => {
      const c = q.close?.[i];
      if (c != null && !isNaN(c) && c > 0) {
        out.push({
          date:   new Date(t * 1000).toISOString().slice(0, 10),
          open:   q.open?.[i]   || c,
          high:   q.high?.[i]   || c,
          low:    q.low?.[i]    || c,
          close:  c,
          volume: q.volume?.[i] || 0
        });
      }
    });
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch (e) { return null; }
}

// ── FINNHUB LIVE QUOTE ────────────────────────────────────────────────────────
async function fetchFinnhubQuote(symbol) {
  if (!FH_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FH_KEY}`;
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) return null;
    const d = await res.json();
    return (d.c && d.c > 0) ? d : null;
  } catch (e) { return null; }
}

// ── INDICATOR CALCULATIONS ────────────────────────────────────────────────────
function calcRSI(closes, p = 14) {
  if (!closes || closes.length < p + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    d > 0 ? g += d : l -= d;
  }
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
  let ema = closes.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const out = new Array(p - 1).fill(null);
  out.push(+ema.toFixed(8));
  for (let i = p; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out.push(+ema.toFixed(8));
  }
  return out;
}

function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const ef = calcEMA(closes, fast);
  const es = calcEMA(closes, slow);
  const ml = closes.map((_, i) =>
    ef[i] != null && es[i] != null ? +(ef[i] - es[i]).toFixed(8) : null
  );
  const valid = ml.filter(v => v != null);
  const se    = calcEMA(valid, sig);
  let sf = new Array(ml.length).fill(null), vi = 0;
  for (let i = 0; i < ml.length; i++) { if (ml[i] != null) sf[i] = se[vi++]; }
  const hist = ml.map((v, i) =>
    v != null && sf[i] != null ? +(v - sf[i]).toFixed(8) : null
  );
  return { macdLine: ml, signalLine: sf, histogram: hist };
}

function calcMA(closes, p) {
  if (!closes || closes.length < p) return null;
  return closes.slice(-p).reduce((a, b) => a + b, 0) / p;
}

function calcRSISeries(closes, p = 14) {
  const out = new Array(p).fill(null);
  for (let i = p; i < closes.length; i++) {
    out.push(calcRSI(closes.slice(0, i + 1), p));
  }
  return out;
}

function overallSignal(rsi, price, ma20, ma50, ma200, macdVal) {
  let s = 0;
  if (rsi != null)    { rsi < 35 ? s += 2 : rsi > 65 ? s -= 2 : null; }
  if (ma20)           price > ma20  ? s++ : s--;
  if (ma50)           price > ma50  ? s++ : s--;
  if (ma200)          price > ma200 ? s++ : s--;
  if (macdVal != null) macdVal > 0  ? s++ : s--;
  return s >= 2 ? 'bull' : s <= -2 ? 'bear' : 'neut';
}

// ── BUILD RESPONSE OBJECT ─────────────────────────────────────────────────────
function buildResponse(candles, quote, dec) {
  if (!candles || !candles.length) return null;
  let closes = candles.map(d => d.close);
  if (quote?.c && quote.c > 0) closes = [...closes.slice(0, -1), quote.c];

  const price  = closes[closes.length - 1];
  const prev   = closes[closes.length - 2] || price;
  const change = ((price - prev) / prev) * 100;
  const rsi    = calcRSI(closes, 14);
  const ma20   = calcMA(closes, 20);
  const ma50   = calcMA(closes, 50);
  const ma200  = calcMA(closes, 200);
  const macd   = calcMACD(closes);
  const lastMacd = macd.macdLine[macd.macdLine.length - 1];
  const signal = overallSignal(rsi, price, ma20, ma50, ma200, lastMacd);

  // Chart series — last 252 trading days
  const W       = Math.min(closes.length, 252);
  const cLabels = candles.map(d => d.date).slice(-W);
  const cCloses = closes.slice(-W);
  const rsiSeries  = calcRSISeries(cCloses, 14);
  const macdSeries = calcMACD(cCloses);

  // MA series aligned to chart window
  const ma20s  = cCloses.map((_, i) => { const s = cCloses.slice(0, i + 1); return s.length >= 20  ? +calcMA(s, 20).toFixed(dec + 1)  : null; });
  const ma50s  = cCloses.map((_, i) => { const s = cCloses.slice(0, i + 1); return s.length >= 50  ? +calcMA(s, 50).toFixed(dec + 1)  : null; });
  const ma200s = cCloses.map((_, i) => { const s = cCloses.slice(0, i + 1); return s.length >= 200 ? +calcMA(s, 200).toFixed(dec + 1) : null; });

  return {
    symbol: null, // filled in by caller
    price, prev, change,
    high:   quote?.h || Math.max(...cCloses.slice(-1)),
    low:    quote?.l || Math.min(...cCloses.slice(-1)),
    open:   quote?.o || prev,
    rsi, ma20, ma50, ma200,
    macd: { line: lastMacd, signal: macd.signalLine[macd.signalLine.length - 1], histogram: macd.histogram[macd.histogram.length - 1] },
    signal,
    candles: candles.length,
    chart: {
      labels:  cLabels,
      closes:  cCloses,
      ma20s, ma50s, ma200s,
      rsiSeries,
      macdLine:   macdSeries.macdLine,
      signalLine: macdSeries.signalLine,
      histogram:  macdSeries.histogram
    }
  };
}

// ── INSTRUMENT REGISTRY ───────────────────────────────────────────────────────
const INSTRUMENTS = {
  // FX
  'fx/eurusd': { stooq: 'eurusd',  yf: 'EURUSD=X', dec: 5 },
  'fx/gbpusd': { stooq: 'gbpusd',  yf: 'GBPUSD=X', dec: 5 },
  'fx/usdjpy': { stooq: 'usdjpy',  yf: 'USDJPY=X', dec: 3 },
  'fx/usdchf': { stooq: 'usdchf',  yf: 'USDCHF=X', dec: 5 },
  'fx/audusd': { stooq: 'audusd',  yf: 'AUDUSD=X', dec: 5 },
  // Commodities
  'cmd/gold':   { stooq: 'xauusd', yf: 'GC=F',  dec: 2 },
  'cmd/silver': { stooq: 'xagusd', yf: 'SI=F',  dec: 3 },
  'cmd/oil':    { stooq: 'cl.f',   yf: 'CL=F',  dec: 2 },
  'cmd/natgas': { stooq: 'ng.f',   yf: 'NG=F',  dec: 3 },
  // Equities
  'eq/aapl': { stooq: 'aapl.us', yf: 'AAPL', fhq: 'AAPL', dec: 2 },
  'eq/msft': { stooq: 'msft.us', yf: 'MSFT', fhq: 'MSFT', dec: 2 },
  'eq/nvda': { stooq: 'nvda.us', yf: 'NVDA', fhq: 'NVDA', dec: 2 },
  'eq/tsla': { stooq: 'tsla.us', yf: 'TSLA', fhq: 'TSLA', dec: 2 },
  'eq/spx':  { stooq: 'spy.us',  yf: 'SPY',  fhq: 'SPY',  dec: 2 },
};

// ── SINGLE INSTRUMENT ENDPOINT ────────────────────────────────────────────────
// GET /api/fx/eurusd
// GET /api/cmd/gold
// GET /api/eq/aapl
app.get('/api/:type/:id', async (req, res) => {
  const key  = `${req.params.type}/${req.params.id}`;
  const inst = INSTRUMENTS[key];
  if (!inst) return res.status(404).json({ error: 'Unknown instrument: ' + key });

  // Return cached data if fresh
  const cached = getCache(key);
  if (cached) return res.json(cached);

  // Fetch candles — Stooq first, Yahoo fallback
  let candles = await fetchStooq(inst.stooq);
  if (!candles || candles.length < 20) candles = await fetchYahoo(inst.yf);

  // Live quote for equities
  let quote = null;
  if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);

  const data = buildResponse(candles, quote, inst.dec);
  if (!data) return res.status(502).json({ error: 'Data unavailable for ' + key });

  data.symbol = key.split('/')[1].toUpperCase();
  setCache(key, data);
  res.json(data);
});

// ── OVERVIEW ENDPOINT — all instruments in one group ─────────────────────────
// GET /api/overview/fx
// GET /api/overview/cmd
// GET /api/overview/eq
app.get('/api/overview/:type', async (req, res) => {
  const type = req.params.type;
  const keys = Object.keys(INSTRUMENTS).filter(k => k.startsWith(type + '/'));
  if (!keys.length) return res.status(404).json({ error: 'Unknown type: ' + type });

  const cacheKey = 'overview/' + type;
  const cached   = getCache(cacheKey);
  if (cached) return res.json(cached);

  const results = await Promise.all(keys.map(async key => {
    const inst    = INSTRUMENTS[key];
    let candles   = await fetchStooq(inst.stooq);
    if (!candles || candles.length < 20) candles = await fetchYahoo(inst.yf);
    let quote = null;
    if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);
    const data = buildResponse(candles, quote, inst.dec);
    if (!data) return null;
    data.symbol = key.split('/')[1].toUpperCase();
    return { key, data };
  }));

  const out = {};
  results.forEach(r => { if (r) out[r.key] = r.data; });
  setCache(cacheKey, out);
  res.json(out);
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:      'ok',
    server:      'ChainRoot API',
    version:     '1.0.0',
    cached:      Object.keys(CACHE).length,
    instruments: Object.keys(INSTRUMENTS).length,
    uptime:      Math.floor(process.uptime()) + 's'
  });
});

app.get('/', (req, res) => {
  res.json({
    name:      'ChainRoot Market Data API',
    endpoints: [
      'GET /api/fx/eurusd',
      'GET /api/fx/gbpusd',
      'GET /api/fx/usdjpy',
      'GET /api/fx/usdchf',
      'GET /api/fx/audusd',
      'GET /api/cmd/gold',
      'GET /api/cmd/silver',
      'GET /api/cmd/oil',
      'GET /api/cmd/natgas',
      'GET /api/eq/aapl',
      'GET /api/eq/msft',
      'GET /api/eq/nvda',
      'GET /api/eq/tsla',
      'GET /api/eq/spx',
      'GET /api/overview/fx',
      'GET /api/overview/cmd',
      'GET /api/overview/eq',
      'GET /health'
    ]
  });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ChainRoot API running on port ${PORT}`);
  console.log(`Finnhub key: ${FH_KEY ? 'configured' : 'NOT SET — equity live quotes disabled'}`);
});
