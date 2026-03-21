'use strict';
require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');

const app    = express();
const PORT   = process.env.PORT || 8080;
const FH_KEY = process.env.FINNHUB_KEY || '';

// ── TV ACCESS — DATABASE ──────────────────────────────────────────────────────
const TV_REGISTRATIONS = []; // in-memory fallback when MONGODB_URI not set
let _tvClient = null;
let _tvCol    = null;

async function getTvCol() {
  if (!process.env.MONGODB_URI) return null;
  if (_tvCol) return _tvCol;
  try {
    const { MongoClient } = require('mongodb');
    _tvClient = new MongoClient(process.env.MONGODB_URI);
    await _tvClient.connect();
    _tvCol = _tvClient.db('defimongo').collection('tv_access');
    await _tvCol.createIndex({ email: 1 }, { unique: true });
    console.log('[MongoDB] Connected — tv_access collection ready');
    return _tvCol;
  } catch(e) {
    console.warn('[MongoDB] Connection failed:', e.message);
    return null;
  }
}

function tvCalcStatus(reg) {
  if (!reg) return null;
  if (reg.status === 'active' && reg.membershipEnd && new Date(reg.membershipEnd) < new Date()) {
    return 'expired';
  }
  return reg.status || 'pending';
}

function tvDaysLeft(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

async function tvFind(email) {
  const col = await getTvCol();
  if (col) return col.findOne({ email });
  return TV_REGISTRATIONS.find(function(r){ return r.email === email; }) || null;
}

async function tvUpsert(email, fields) {
  const col = await getTvCol();
  if (col) {
    await col.updateOne({ email }, { $set: fields }, { upsert: true });
    return col.findOne({ email });
  }
  const idx = TV_REGISTRATIONS.findIndex(function(r){ return r.email === email; });
  if (idx >= 0) {
    TV_REGISTRATIONS[idx] = Object.assign({}, TV_REGISTRATIONS[idx], fields);
    return TV_REGISTRATIONS[idx];
  }
  const doc = Object.assign({ email }, fields);
  TV_REGISTRATIONS.push(doc);
  return doc;
}

async function tvAll() {
  const col = await getTvCol();
  if (col) return col.find({}).sort({ submittedAt: -1 }).toArray();
  return TV_REGISTRATIONS.slice().reverse();
}

// ── TIMEOUT-SAFE FETCH — node-fetch v2 ignores {timeout}, use AbortController ─
function fetchT(url, options, ms) {
  ms = ms || 12000;
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, ms);
  const opts = Object.assign({}, options || {}, { signal: controller.signal });
  return fetch(url, opts).finally(function() { clearTimeout(timer); });
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any GitHub Pages subdomain + localhost for dev
    if (
      origin.includes('github.io') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
}));
app.use(express.json());

// ── CACHE ─────────────────────────────────────────────────────────────────────
const CACHE     = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCache(key) {
  const e = CACHE[key];
  if (!e) return null;
  const ttl = e.ttl || CACHE_TTL;
  if (Date.now() - e.ts > ttl) { delete CACHE[key]; return null; }
  return e.data;
}
function setCache(key, data, ttl) {
  CACHE[key] = { ts: Date.now(), data: data, ttl: ttl || CACHE_TTL };
}

// Periodically evict expired cache entries to prevent unbounded memory growth
setInterval(function() {
  const now = Date.now();
  Object.keys(CACHE).forEach(function(key) {
    const e = CACHE[key];
    if (e && now - e.ts > (e.ttl || CACHE_TTL)) delete CACHE[key];
  });
}, 30 * 60 * 1000); // run every 30 minutes

// ── DATA FETCHERS ─────────────────────────────────────────────────────────────
async function fetchStooq(symbol, rows) {
  rows = rows || 400;
  try {
    const res = await fetchT('https://stooq.com/q/d/l/?s=' + symbol.toLowerCase() + '&i=d', {}, 15000);
    if (!res.ok) return null;
    const csv = (await res.text()).trim();
    if (!csv || csv.includes('No data') || csv.includes('Przekroczon') || csv.length < 30) return null;
    const out = [];
    csv.split('\n').slice(1).filter(Boolean).forEach(function(ln) {
      const p = ln.split(','), c = parseFloat(p[4]);
      if (!isNaN(c) && c > 0)
        out.push({ date: p[0], open: parseFloat(p[1])||c, high: parseFloat(p[2])||c, low: parseFloat(p[3])||c, close: c, volume: parseFloat(p[5])||0 });
    });
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch(e) { return null; }
}

async function fetchYahoo(symbol, rows) {
  rows = rows || 400;
  try {
    const now = Math.floor(Date.now()/1000), from = now - rows*86400*2;
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&period1='+from+'&period2='+now,
      { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result) return null;
    const ts = result.timestamp||[], q = (result.indicators&&result.indicators.quote&&result.indicators.quote[0])||{};
    const out = [];
    ts.forEach(function(t,i) {
      const c = q.close&&q.close[i];
      if (c!=null&&!isNaN(c)&&c>0)
        out.push({ date: new Date(t*1000).toISOString().slice(0,10), open: (q.open&&q.open[i])||c, high: (q.high&&q.high[i])||c, low: (q.low&&q.low[i])||c, close: c, volume: (q.volume&&q.volume[i])||0 });
    });
    return out.length >= 20 ? out.slice(-rows) : null;
  } catch(e) { return null; }
}

async function fetchFinnhubQuote(symbol) {
  if (!FH_KEY) return null;
  try {
    const res = await fetchT('https://finnhub.io/api/v1/quote?symbol='+symbol+'&token='+FH_KEY, {}, 8000);
    if (!res.ok) return null;
    const d = await res.json();
    return (d.c && d.c > 0) ? d : null;
  } catch(e) { return null; }
}

// ── INDICATORS ────────────────────────────────────────────────────────────────
function calcRSI(closes, p) {
  p = p||14; if (!closes||closes.length<p+1) return null;
  let g=0,l=0;
  for (let i=1;i<=p;i++){const d=closes[i]-closes[i-1];d>0?g+=d:l-=d;}
  let ag=g/p,al=l/p;
  for (let i=p+1;i<closes.length;i++){const d=closes[i]-closes[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;}
  return al===0?100:+(100-(100/(1+ag/al))).toFixed(2);
}
function calcEMA(closes, p) {
  if (!closes||closes.length<p) return [];
  const k=2/(p+1); let ema=closes.slice(0,p).reduce(function(a,b){return a+b;},0)/p;
  const out=new Array(p-1).fill(null); out.push(+ema.toFixed(8));
  for (let i=p;i<closes.length;i++){ema=closes[i]*k+ema*(1-k);out.push(+ema.toFixed(8));}
  return out;
}
function calcMACD(closes, fast, slow, sig) {
  fast=fast||12;slow=slow||26;sig=sig||9;
  const ef=calcEMA(closes,fast),es=calcEMA(closes,slow);
  const ml=closes.map(function(_,i){return ef[i]!=null&&es[i]!=null?+(ef[i]-es[i]).toFixed(8):null;});
  const se=calcEMA(ml.filter(function(v){return v!=null;}),sig);
  const sf=new Array(ml.length).fill(null); let vi=0;
  for (let i=0;i<ml.length;i++){if(ml[i]!=null)sf[i]=se[vi++];}
  return { macdLine:ml, signalLine:sf, histogram:ml.map(function(v,i){return v!=null&&sf[i]!=null?+(v-sf[i]).toFixed(8):null;}) };
}
function calcMA(closes, p) {
  if (!closes||closes.length<p) return null;
  return closes.slice(-p).reduce(function(a,b){return a+b;},0)/p;
}
function calcRSISeries(closes, p) {
  p=p||14; const out=new Array(p).fill(null);
  for (let i=p;i<closes.length;i++) out.push(calcRSI(closes.slice(0,i+1),p));
  return out;
}
function overallSignal(rsi, price, ma20, ma50, ma200, macdVal) {
  let s=0;
  if(rsi!=null){if(rsi<35)s+=2;else if(rsi>65)s-=2;}
  if(ma20) price>ma20?s++:s--;
  if(ma50) price>ma50?s++:s--;
  if(ma200)price>ma200?s++:s--;
  if(macdVal!=null)macdVal>0?s++:s--;
  return s>=2?'bull':s<=-2?'bear':'neut';
}
function buildResponse(candles, quote, dec) {
  if (!candles||!candles.length) return null;
  let closes=candles.map(function(d){return d.close;});
  if (quote&&quote.c&&quote.c>0) closes=closes.slice(0,-1).concat([quote.c]);
  const price=closes[closes.length-1], prev=closes[closes.length-2]||price;
  const rsi=calcRSI(closes,14), ma20=calcMA(closes,20), ma50=calcMA(closes,50), ma200=calcMA(closes,200);
  const macd=calcMACD(closes), lastMacd=macd.macdLine[macd.macdLine.length-1];
  const W=Math.min(closes.length,252), cLabels=candles.map(function(d){return d.date;}).slice(-W), cCloses=closes.slice(-W);
  const rsiSeries=calcRSISeries(cCloses,14), macdSeries=calcMACD(cCloses);
  const ma20s=cCloses.map(function(_,i){const s=cCloses.slice(0,i+1);return s.length>=20?+calcMA(s,20).toFixed(dec+1):null;});
  const ma50s=cCloses.map(function(_,i){const s=cCloses.slice(0,i+1);return s.length>=50?+calcMA(s,50).toFixed(dec+1):null;});
  const ma200s=cCloses.map(function(_,i){const s=cCloses.slice(0,i+1);return s.length>=200?+calcMA(s,200).toFixed(dec+1):null;});
  return {
    symbol:null, price:price, prev:prev, change:((price-prev)/prev)*100,
    high:(quote&&quote.h)?quote.h:price, low:(quote&&quote.l)?quote.l:price, open:(quote&&quote.o)?quote.o:prev,
    rsi:rsi, ma20:ma20, ma50:ma50, ma200:ma200,
    macd:{line:lastMacd, signal:macd.signalLine[macd.signalLine.length-1], histogram:macd.histogram[macd.histogram.length-1]},
    signal:overallSignal(rsi,price,ma20,ma50,ma200,lastMacd), candles:candles.length,
    chart:{labels:cLabels, closes:cCloses, ma20s:ma20s, ma50s:ma50s, ma200s:ma200s,
      rsiSeries:rsiSeries, macdLine:macdSeries.macdLine, signalLine:macdSeries.signalLine, histogram:macdSeries.histogram}
  };
}

// ── INSTRUMENTS ───────────────────────────────────────────────────────────────
const INSTRUMENTS = {
  'fx/eurusd':  {stooq:'eurusd',  yf:'EURUSD=X', dec:5},
  'fx/gbpusd':  {stooq:'gbpusd',  yf:'GBPUSD=X', dec:5},
  'fx/usdjpy':  {stooq:'usdjpy',  yf:'USDJPY=X', dec:3},
  'fx/usdchf':  {stooq:'usdchf',  yf:'USDCHF=X', dec:5},
  'fx/audusd':  {stooq:'audusd',  yf:'AUDUSD=X', dec:5},
  'cmd/gold':   {stooq:'xauusd',  yf:'GC=F',     dec:2},
  'cmd/silver': {stooq:'xagusd',  yf:'SI=F',     dec:3},
  'cmd/oil':    {stooq:'cl.f',    yf:'CL=F',     dec:2},
  'cmd/natgas': {stooq:'ng.f',    yf:'NG=F',     dec:3},
  'eq/aapl':    {stooq:'aapl.us', yf:'AAPL', fhq:'AAPL', dec:2},
  'eq/msft':    {stooq:'msft.us', yf:'MSFT', fhq:'MSFT', dec:2},
  'eq/nvda':    {stooq:'nvda.us', yf:'NVDA', fhq:'NVDA', dec:2},
  'eq/tsla':    {stooq:'tsla.us', yf:'TSLA', fhq:'TSLA', dec:2},
  'eq/spx':     {stooq:'spy.us',  yf:'SPY',  fhq:'SPY',  dec:2},
};

// ══════════════════════════════════════════════════════════════════
// ALL SPECIFIC /api/crypto/* ROUTES MUST COME BEFORE /api/:type/:id
// ══════════════════════════════════════════════════════════════════

// Top 50 coins (markets)
app.get('/api/crypto/markets', async function(req, res) {
  const cached = getCache('crypto/markets');
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd' +
      '&order=market_cap_desc&per_page=50&page=1' +
      '&sparkline=true&price_change_percentage=1h,24h,7d,30d';
    const r = await fetchT(url, {}, 14000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache('crypto/markets', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// Global stats
app.get('/api/crypto/global', async function(req, res) {
  const cached = getCache('crypto/global');
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.coingecko.com/api/v3/global', {}, 12000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache('crypto/global', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// BTC 365-day chart
app.get('/api/crypto/btcchart', async function(req, res) {
  const cached = getCache('crypto/btcchart');
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily', {}, 14000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache('crypto/btcchart', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// BTC full price history — monthly data since 2013 for overlay charts
// Uses CoinGecko max history endpoint, returns monthly sampled prices
app.get('/api/crypto/btc-monthly', async function(req, res) {
  const cached = getCache('crypto/btc-monthly');
  if (cached) return res.json(cached);
  try {
    // CoinGecko free tier: max days = 'max' gives daily data since 2013
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=monthly',
      {timeout:30000, headers:{'User-Agent':'Mozilla/5.0'}}
    );
    if (!r.ok) {
      // Fallback: try 1825 days (5 years) with weekly interval
      const r2 = await fetch(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1825&interval=weekly',
        {timeout:20000, headers:{'User-Agent':'Mozilla/5.0'}}
      );
      if (!r2.ok) return res.status(502).json({error:'CoinGecko '+r.status});
      const d2 = await r2.json();
      setCache('crypto/btc-monthly', d2);
      return res.json(d2);
    }
    const data = await r.json();
    // Sample to monthly — take one price point per 30-day window
    if (data && data.prices && data.prices.length > 0) {
      const monthly = [];
      let lastTs = 0;
      data.prices.forEach(function(p) {
        const ts = p[0];
        if (ts - lastTs >= 28 * 86400000) {
          monthly.push(p);
          lastTs = ts;
        }
      });
      const result = { prices: monthly, source: 'coingecko-monthly' };
      setCache('crypto/btc-monthly', result);
      return res.json(result);
    }
    setCache('crypto/btc-monthly', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// Any coin chart
app.get('/api/crypto/coin/:id/chart', async function(req, res) {
  const id = req.params.id, days = req.query.days||365;
  const cacheKey = 'crypto/coin/'+id+'/chart/'+days;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days='+days+'&interval=daily', {}, 14000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// RSI pre-computed for dashboard
app.get('/api/crypto/rsi/:id', async function(req, res) {
  const id = req.params.id, cacheKey = 'crypto/rsi/'+id;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days=60&interval=daily', {}, 14000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const d = await r.json();
    if (!d||!d.prices||!d.prices.length) return res.status(502).json({error:'No data'});
    const prices=d.prices.map(function(p){return p[1];});
    const dates=d.prices.map(function(p){return new Date(p[0]).toLocaleDateString('en',{month:'short',day:'numeric'});});
    const rsiArr=[]; const p=14; let g=0,l=0;
    for(let i=1;i<=p;i++){const diff=prices[i]-prices[i-1];diff>0?g+=diff:l-=diff;}
    let ag=g/p,al=l/p;
    for(let i=0;i<prices.length;i++){
      if(i<p){rsiArr.push(null);continue;}
      if(i===p){rsiArr.push(al===0?100:+(100-(100/(1+ag/al))).toFixed(2));continue;}
      const diff=prices[i]-prices[i-1];ag=(ag*(p-1)+(diff>0?diff:0))/p;al=(al*(p-1)+(diff<0?-diff:0))/p;
      rsiArr.push(al===0?100:+(100-(100/(1+ag/al))).toFixed(2));
    }
    const valid=rsiArr.map(function(v,i){return{v:v,d:dates[i]};}).filter(function(x){return x.v!==null;});
    const last30=valid.slice(-30), vals30=last30.map(function(x){return x.v;}), rsi7=valid.slice(-7).map(function(x){return x.v;});
    const data={current:valid.length?valid[valid.length-1].v:null, rsi7d:rsi7.length?rsi7[rsi7.length-1]:null,
      vals30:vals30, labels30:last30.map(function(x){return x.d;}),
      high30:vals30.length?+Math.max.apply(null,vals30).toFixed(1):null, low30:vals30.length?+Math.min.apply(null,vals30).toFixed(1):null};
    setCache(cacheKey, data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// Fear & Greed
app.get('/api/crypto/feargreed', async function(req, res) {
  const cached = getCache('crypto/feargreed');
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.alternative.me/fng/?limit=90', {}, 10000);
    if (!r.ok) return res.status(502).json({error:'FNG '+r.status});
    const data = await r.json();
    // Cache 4 hours — Fear & Greed only updates once per day at midnight UTC
    setCache('crypto/feargreed', data, 4 * 60 * 60 * 1000);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// DeFi category
app.get('/api/crypto/category/defi', async function(req, res) {
  const cached = getCache('crypto/category/defi');
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=decentralized-finance-defi&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d';
    const r = await fetchT(url, {}, 15000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache('crypto/category/defi', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// Layer 1 category
app.get('/api/crypto/category/layer1', async function(req, res) {
  const cached = getCache('crypto/category/layer1');
  if (cached) return res.json(cached);
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=layer-1&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d';
    const r = await fetchT(url, {}, 15000);
    if (!r.ok) return res.status(502).json({error:'CoinGecko '+r.status});
    const data = await r.json();
    setCache('crypto/category/layer1', data);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// ── BINANCE — top 100 USDT pairs by volume ───────────────────────────────────
app.get('/api/crypto/binance', async function(req, res) {
  const cached = getCache('crypto/binance');
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://api.binance.com/api/v3/ticker/24hr', {}, 15000);
    if (!r.ok) return res.status(502).json({error:'Binance '+r.status});
    const tickers = await r.json();
    const pairs = tickers
      .filter(function(t){return t.symbol.endsWith('USDT')&&parseFloat(t.quoteVolume)>0;})
      .sort(function(a,b){return parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume);})
      .slice(0,100)
      .map(function(t,i){
        const sym=t.symbol.replace('USDT','');
        const price=parseFloat(t.lastPrice), chg24=parseFloat(t.priceChangePercent), vol=parseFloat(t.quoteVolume);
        return {
          id:sym.toLowerCase()+'-bnb', symbol:sym.toLowerCase(), name:sym,
          current_price:price, price_change_percentage_24h:chg24, total_volume:vol,
          market_cap:0, market_cap_rank:i+1, image:'',
          high_24h:parseFloat(t.highPrice), low_24h:parseFloat(t.lowPrice),
          source:'binance', sparkline_in_7d:{price:[]}
        };
      });
    setCache('crypto/binance', pairs);
    res.json(pairs);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// ── HYPERLIQUID — all perp contracts ─────────────────────────────────────────
app.get('/api/crypto/hyperliquid', async function(req, res) {
  const cached = getCache('crypto/hyperliquid');
  if (cached) return res.json(cached);
  try {
    const r = await fetch('https://api.hyperliquid.xyz/info', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'metaAndAssetCtxs'}),
      timeout:15000
    });
    if (!r.ok) return res.status(502).json({error:'Hyperliquid '+r.status});
    const data = await r.json();
    const universe = (data[0]&&data[0].universe)||[];
    const ctxs     = data[1]||[];
    const coins = universe.map(function(asset,i){
      const ctx=ctxs[i]||{};
      const price=parseFloat(ctx.markPx)||0;
      const oi=parseFloat(ctx.openInterest)||0;
      const vol=parseFloat(ctx.dayNtlVlm)||0;
      const prevPx=parseFloat(ctx.prevDayPx)||0;
      const chg=prevPx>0?((price-prevPx)/prevPx)*100:0;
      return {
        id:asset.name.toLowerCase()+'-hl', symbol:asset.name.toLowerCase(), name:asset.name,
        current_price:price, price_change_percentage_24h:+chg.toFixed(2),
        total_volume:vol, market_cap:oi*price, open_interest:oi,
        market_cap_rank:i+1, image:'', source:'hyperliquid', sparkline_in_7d:{price:[]}
      };
    }).filter(function(c){return c.current_price>0;})
      .sort(function(a,b){return b.total_volume-a.total_volume;});
    setCache('crypto/hyperliquid', coins);
    res.json(coins);
  } catch(e) { res.status(502).json({error:e.message}); }
});

// ══════════════════════════════════════════════════════════════════
// ── GLOBAL ASSET PRICES — stocks via Yahoo Finance, commodities via Stooq ─────
// GET /api/global/prices
app.get('/api/global/prices', async function(req, res) {
  const cached = getCache('global/prices');
  if (cached) return res.json(cached);

  const STOCKS = [
    {id:'nvda', yf:'NVDA',  name:'NVIDIA',            mcapT:3.3},
    {id:'aapl', yf:'AAPL',  name:'Apple',             mcapT:3.7},
    {id:'msft', yf:'MSFT',  name:'Microsoft',         mcapT:3.1},
    {id:'amzn', yf:'AMZN',  name:'Amazon',            mcapT:2.3},
    {id:'goog', yf:'GOOGL', name:'Alphabet (Google)', mcapT:2.0},
    {id:'meta', yf:'META',  name:'Meta',              mcapT:1.7},
    {id:'tsla', yf:'TSLA',  name:'Tesla',             mcapT:0.9},
    {id:'brk',  yf:'BRK-B', name:'Berkshire Hath.',   mcapT:1.1},
    {id:'tsm',  yf:'TSM',   name:'TSMC',              mcapT:0.9},
    {id:'eli',  yf:'LLY',   name:'Eli Lilly',         mcapT:0.8},
    {id:'jpm',  yf:'JPM',   name:'JPMorgan Chase',    mcapT:0.7},
    {id:'v',    yf:'V',     name:'Visa',              mcapT:0.6},
    {id:'wmt',  yf:'WMT',   name:'Walmart',           mcapT:0.8},
    {id:'xom',  yf:'XOM',   name:'ExxonMobil',        mcapT:0.5},
    {id:'nflx', yf:'NFLX',  name:'Netflix',           mcapT:0.4},
    {id:'unh',  yf:'UNH',   name:'UnitedHealth',      mcapT:0.5},
    {id:'cost', yf:'COST',  name:'Costco',            mcapT:0.5},
  ];
  const COMMODITIES = [
    {id:'gold',      stooq:'xauusd', name:'Gold',      ticker:'XAU/USD', mcapT:34.9},
    {id:'silver',    stooq:'xagusd', name:'Silver',    ticker:'XAG/USD', mcapT:4.5},
    {id:'crude-oil', stooq:'cl.f',   name:'Crude Oil', ticker:'WTI',     mcapT:2.1},
  ];

  async function yahooQuote(sym) {
    try {
      const now = Math.floor(Date.now()/1000), from = now - 7*86400;
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+
                  '?interval=1d&period1='+from+'&period2='+now;
      const r = await fetchT(url, {headers:{'User-Agent':'Mozilla/5.0'}}, 10000);
      if (!r.ok) return null;
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) return null;
      const q = res.indicators && res.indicators.quote && res.indicators.quote[0];
      if (!q || !q.close) return null;
      const closes = q.close.filter(function(v){return v!=null;});
      if (closes.length < 2) return null;
      const price = closes[closes.length-1];
      const prev  = closes[closes.length-2];
      const chg24 = prev > 0 ? +((price-prev)/prev*100).toFixed(2) : null;
      // Try to get market cap from summaryDetail
      const mcapRaw = res.summaryDetail && res.summaryDetail.marketCap;
      return {price:+price.toFixed(2), chg24:chg24, mcapRaw: mcapRaw||null};
    } catch(e) {return null;}
  }

  async function stooqQuote(sym) {
    try {
      const r = await fetchT('https://stooq.com/q/d/l/?s='+sym+'&i=d', {}, 10000);
      if (!r.ok) return null;
      const csv = (await r.text()).trim();
      if (!csv||csv.length<30) return null;
      const lines = csv.split('\n').slice(1).filter(Boolean);
      if (lines.length < 2) return null;
      const last = lines[lines.length-1].split(',');
      const prev = lines[lines.length-2].split(',');
      const price = parseFloat(last[4]), prevC = parseFloat(prev[4]);
      if (isNaN(price)||price<=0) return null;
      return {price:+price.toFixed(4), chg24: prevC>0?+((price-prevC)/prevC*100).toFixed(2):null};
    } catch(e) {return null;}
  }

  const out = {stocks:{}, commodities:{}, ts:Date.now()};

  await Promise.allSettled([
    ...STOCKS.map(async function(s) {
      const q = await yahooQuote(s.yf);
      out.stocks[s.id] = {name:s.name, mcapT:s.mcapT, price:q?q.price:null, chg24:q?q.chg24:null};
    }),
    ...COMMODITIES.map(async function(c) {
      const q = await stooqQuote(c.stooq);
      out.commodities[c.id] = {name:c.name, ticker:c.ticker, mcapT:c.mcapT, price:q?q.price:null, chg24:q?q.chg24:null};
    })
  ]);

  setCache('global/prices', out);
  res.json(out);
});

// ── DAILY BTC PRICE HISTORY — full history since 2012 for all overlay charts ──
// Fetches from CoinGecko, returns daily [{date,price}] array
// Cached 6 hours — data only changes once per day
app.get('/api/crypto/btc-daily', async function(req, res) {
  const cacheKey = 'crypto/btc-daily';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    // Try max history first, fall back to 365 days if rate limited
    var url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily';
    var r = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, 30000);

    // If rate limited, try 365 days instead
    if (!r.ok) {
      url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily';
      r = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 20000);
      if (!r.ok) throw new Error('CoinGecko ' + r.status);
    }

    const data = await r.json();
    if (!data || !data.prices || !data.prices.length) throw new Error('No data');

    const daily = data.prices.map(function(p) {
      const d = new Date(p[0]);
      return { ts: Math.floor(p[0]/1000), date: d.toISOString().slice(0,10), price: +p[1].toFixed(2) };
    });

    const result = { daily: daily, count: daily.length, updated: Date.now() };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) {
    res.status(502).json({ error: e.message });
  }
});

// ── BTC HALVING CYCLE DATA — daily prices per cycle ───────────────────────────
// Returns daily BTC prices for a specific halving cycle
// cycle=1: Nov 28 2012 → Jul 9 2016
// cycle=2: Jul 9 2016  → May 11 2020
// cycle=3: May 11 2020 → Apr 20 2024
// cycle=4: Apr 20 2024 → present (live)
app.get('/api/crypto/btc-halving/:cycle', async function(req, res) {
  const cycle = parseInt(req.params.cycle);
  if (cycle < 1 || cycle > 4) return res.status(400).json({ error: 'Cycle must be 1-4' });

  const cacheKey = 'crypto/btc-halving/' + cycle;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  // Halving dates in ms
  const HALVINGS = [
    new Date('2012-11-28').getTime(),
    new Date('2016-07-09').getTime(),
    new Date('2020-05-11').getTime(),
    new Date('2024-04-20').getTime(),
    Date.now()
  ];
  const startMs = HALVINGS[cycle - 1];
  const endMs   = HALVINGS[cycle];

  try {
    // First try: slice from btc-daily cache (avoids extra CoinGecko call)
    const dailyCached = getCache('crypto/btc-daily');
    if (dailyCached && dailyCached.daily && dailyCached.daily.length > 100) {
      const cycleData = dailyCached.daily
        .filter(function(p) { return p.ts * 1000 >= startMs && p.ts * 1000 <= endMs; })
        .map(function(p) {
          return { day: Math.floor((p.ts * 1000 - startMs) / 86400000), ts: p.ts, price: p.price };
        });
      if (cycleData.length > 30) {
        const result = { cycle, start: new Date(startMs).toISOString().slice(0,10), end: new Date(endMs).toISOString().slice(0,10), days: cycleData.length, prices: cycleData, updated: Date.now() };
        setCache(cacheKey, result, 6 * 60 * 60 * 1000);
        return res.json(result);
      }
    }

    // Fallback: fetch from CoinGecko range endpoint with delay to avoid rate limit
    await new Promise(function(r){ setTimeout(r, cycle * 500); }); // stagger requests
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from='
      + Math.floor(startMs/1000) + '&to=' + Math.floor(endMs/1000);
    const r = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, 30000);
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    const data = await r.json();
    if (!data || !data.prices || !data.prices.length) throw new Error('No data');

    const cycleData = data.prices.map(function(p) {
      return { day: Math.floor((p[0] - startMs) / 86400000), ts: Math.floor(p[0]/1000), price: +p[1].toFixed(2) };
    });

    const result = { cycle, start: new Date(startMs).toISOString().slice(0,10), end: new Date(endMs).toISOString().slice(0,10), days: cycleData.length, prices: cycleData, updated: Date.now() };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) {
    // Return empty but valid response so frontend uses hardcoded fallback
    res.json({ cycle, prices: [], days: 0, error: e.message });
  }
});

// ── DXY DAILY — Trade Weighted USD Index from Stooq ──────────────────────────
// Returns daily DXY values going back as far as Stooq provides
app.get('/api/market/dxy', async function(req, res) {
  const cacheKey = 'market/dxy';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    // DTWEXBGS = Broad Trade Weighted Dollar Index from Stooq
    const r = await fetchT('https://stooq.com/q/d/l/?s=dxy&i=d&d1=20100101', {}, 15000);
    if (!r.ok) throw new Error('Stooq ' + r.status);
    const csv = (await r.text()).trim();
    if (!csv || csv.length < 50) throw new Error('No data');

    const rows = csv.split('\n').slice(1).filter(Boolean).map(function(ln) {
      const p = ln.split(',');
      const c = parseFloat(p[4]);
      if (!isNaN(c) && c > 0) return { date: p[0], price: +c.toFixed(4) };
      return null;
    }).filter(Boolean);

    const result = { daily: rows, count: rows.length, updated: Date.now() };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) {
    res.status(502).json({ error: e.message });
  }
});

// ── GOLD DAILY — XAU/USD daily prices from Stooq ─────────────────────────────
app.get('/api/market/gold', async function(req, res) {
  const cacheKey = 'market/gold';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const r = await fetchT('https://stooq.com/q/d/l/?s=xauusd&i=d&d1=20100101', {}, 15000);
    if (!r.ok) throw new Error('Stooq ' + r.status);
    const csv = (await r.text()).trim();
    if (!csv || csv.length < 50) throw new Error('No data');

    const rows = csv.split('\n').slice(1).filter(Boolean).map(function(ln) {
      const p = ln.split(',');
      const c = parseFloat(p[4]);
      if (!isNaN(c) && c > 0) return { date: p[0], price: +c.toFixed(2) };
      return null;
    }).filter(Boolean);

    const result = { daily: rows, count: rows.length, updated: Date.now() };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) {
    res.status(502).json({ error: e.message });
  }
});

// ── RSS PROXY — fetches RSS feeds server-side to bypass browser CORS ──────────
app.get('/api/news/rss', async function(req, res) {
  var feedUrl = req.query.url;
  if (!feedUrl) return res.status(400).json({error:'Missing url'});
  var cacheKey = 'rss/' + Buffer.from(feedUrl).toString('base64').slice(0,40);
  var cached = getCache(cacheKey);
  if (cached) return res.set('Content-Type','application/json').json(cached);
  try {
    var r = await fetch(feedUrl, {
      timeout: 14000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeFiMongo/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var xml = await r.text();
    if (!xml || xml.length < 50) throw new Error('Empty response');
    var result = { contents: xml, url: feedUrl };
    setCache(cacheKey, result, 10 * 60 * 1000); // cache 10 min
    res.json(result);
  } catch(e) {
    res.status(502).json({ error: e.message, contents: '' });
  }
});

// ── CRYPTO COMPARE NEWS — server-side to avoid CORS ──────────────────────────
app.get('/api/news/crypto', async function(req, res) {
  var cacheKey = 'news/crypto';
  var cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    var r = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest', {
      timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) throw new Error('CryptoCompare ' + r.status);
    var d = await r.json();
    setCache(cacheKey, d, 10 * 60 * 1000);
    res.json(d);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// ── LIVE TWEET FEEDS — via Nitter RSS proxy ───────────────────────────────────
// Nitter is an open-source Twitter frontend that provides RSS feeds
// We use multiple Nitter instances as fallbacks since they go up/down
const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
  'https://nitter.cz',
  'https://nitter.net',
  'https://xcancel.com'
];

// Accounts to follow
const TWEET_ACCOUNTS = {
  crypto:  'WatcherGuru',   // Fast-breaking crypto news
  tradfi:  'zerohedge'      // Macro/TradFi news
};

async function fetchNitterRSS(username) {
  for (var i = 0; i < NITTER_INSTANCES.length; i++) {
    try {
      var url = NITTER_INSTANCES[i] + '/' + username + '/rss';
      var r = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 10000);
      if (!r.ok) continue;
      var xml = await r.text();
      if (!xml || xml.length < 100) continue;
      // Parse RSS items
      var items = [];
      var itemRe = /<item>([\s\S]*?)<\/item>/g;
      var match;
      while ((match = itemRe.exec(xml)) !== null && items.length < 15) {
        var block = match[1];
        var title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/)|| [])[1] || '';
        var link  = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
        var pubDate= (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
        var desc  = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
        // Clean HTML from description
        desc = desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 280);
        title = title.replace(/<[^>]+>/g, '').trim();
        if (title && title !== username) {
          items.push({
            id:      'tw_' + username + '_' + i + '_' + items.length,
            user:    '@' + username,
            text:    title.length > 30 ? title : (desc || title),
            url:     link.replace('nitter.poast.org', 'twitter.com').replace(/nitter\.[^/]+/, 'twitter.com'),
            time:    pubDate ? new Date(pubDate).getTime() : Date.now() - items.length * 600000,
            source:  NITTER_INSTANCES[i].split('/')[2]
          });
        }
      }
      if (items.length > 0) return items;
    } catch(e) { continue; }
  }
  return [];
}

// GET /api/tweets/crypto — latest tweets from crypto account
app.get('/api/tweets/crypto', async function(req, res) {
  var cacheKey = 'tweets/crypto';
  var cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    var tweets = await fetchNitterRSS(TWEET_ACCOUNTS.crypto);
    var result = { account: TWEET_ACCOUNTS.crypto, tweets: tweets, updated: Date.now() };
    setCache(cacheKey, result, 15 * 60 * 1000); // cache 15 min
    res.json(result);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// GET /api/tweets/tradfi — latest tweets from tradfi account
app.get('/api/tweets/tradfi', async function(req, res) {
  var cacheKey = 'tweets/tradfi';
  var cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    var tweets = await fetchNitterRSS(TWEET_ACCOUNTS.tradfi);
    var result = { account: TWEET_ACCOUNTS.tradfi, tweets: tweets, updated: Date.now() };
    setCache(cacheKey, result, 15 * 60 * 1000);
    res.json(result);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// GET /api/translate — translate text to Mongolian using MyMemory (free, no key needed)
// MyMemory: 5000 chars/day free, no API key required
app.get('/api/translate', async function(req, res) {
  var text = (req.query.text || '').slice(0, 500);
  if (!text) return res.json({ translation: '' });
  var cacheKey = 'translate/' + Buffer.from(text).toString('base64').slice(0, 40);
  var cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|mn';
    var r = await fetchT(url, {}, 10000);
    if (!r.ok) throw new Error('MyMemory ' + r.status);
    var d = await r.json();
    var translation = (d.responseData && d.responseData.translatedText) || text;
    // MyMemory sometimes returns the original if quality is low
    if (translation === text || d.responseStatus !== 200) {
      translation = null; // signal: no translation available
    }
    var result = { original: text, translation: translation, quality: d.responseData?.match || 0 };
    setCache(cacheKey, result, 24 * 60 * 60 * 1000); // cache 24 hours
    res.json(result);
  } catch(e) { res.status(502).json({ error: e.message, translation: null }); }
});

// ── DEFI TVL — from DeFiLlama (proxy to avoid CORS) ─────────────────────────
app.get('/api/defi/tvl', async function(req, res) {
  const cached = getCache('defi/tvl');
  if (cached) return res.json(cached);
  try {
    const [protocols, chains] = await Promise.all([
      fetchT('https://api.llama.fi/protocols', {}, 15000).then(function(r){return r.json();}),
      fetchT('https://api.llama.fi/v2/chains', {}, 15000).then(function(r){return r.json();})
    ]);
    // Total TVL from top chains
    const totalTVL = (chains||[]).reduce(function(s,c){return s+(c.tvl||0);},0);
    // Top 7 protocols
    const top7 = (protocols||[]).filter(function(p){return p.tvl>0;}).sort(function(a,b){return b.tvl-a.tvl;}).slice(0,7)
      .map(function(p){return {name:p.name, tvl:p.tvl, change24h:p.change_1d||0, category:p.category};});
    const result = {totalTVL, top7, updated: Date.now()};
    setCache('defi/tvl', result, 30*60*1000);
    res.json(result);
  } catch(e){res.status(502).json({error:e.message});}
});

// ── DEX VOLUME — from DeFiLlama ───────────────────────────────────────────────
app.get('/api/defi/dex', async function(req, res) {
  const cached = getCache('defi/dex');
  if (cached) return res.json(cached);
  try {
    const data = await fetchT('https://api.llama.fi/overview/dexs?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=false&dataType=dailyVolume', {}, 15000).then(function(r){return r.json();});
    const top5 = (data?.protocols||[]).filter(function(p){return p.total24h>0;}).sort(function(a,b){return b.total24h-a.total24h;}).slice(0,5)
      .map(function(p){return {name:p.name, vol24h:p.total24h, change24h:p.change_1d||0};});
    const totalVol = top5.reduce(function(s,p){return s+p.vol24h;},0) + (data?.protocols||[]).slice(5).reduce(function(s,p){return s+(p.total24h||0);},0);
    const chart14 = (data?.totalDataChart||[]).slice(-14).map(function(p){return {date:new Date(p[0]*1000).toLocaleDateString('en',{month:'short',day:'numeric'}),vol:+(p[1]/1e9).toFixed(2)};});
    const result = {totalVol, top5, chart14, updated: Date.now()};
    setCache('defi/dex', result, 30*60*1000);
    res.json(result);
  } catch(e){res.status(502).json({error:e.message});}
});

// ── PUMPFUN STATS — from DeFiLlama dexs (Pump.fun is tracked) ────────────────
app.get('/api/defi/pumpfun', async function(req, res) {
  const cached = getCache('defi/pumpfun');
  if (cached) return res.json(cached);
  try {
    // PumpFun volume from DeFiLlama
    const data = await fetchT('https://api.llama.fi/summary/dexs/pump-fun?excludeTotalDataChart=false&dataType=dailyVolume', {}, 15000).then(function(r){return r.json();});
    const vol24h = data?.total24h || 0;
    const vol7d  = data?.total7d  || 0;
    const chart14 = (data?.totalDataChart||[]).slice(-14).map(function(p){
      return {date: new Date(p[0]*1000).toLocaleDateString('en',{month:'short',day:'numeric'}), vol: +(p[1]/1e6).toFixed(1)};
    });
    const result = {vol24h, vol7d, chart14, updated: Date.now()};
    setCache('defi/pumpfun', result, 30*60*1000);
    res.json(result);
  } catch(e){res.status(502).json({error:e.message});}
});

// ── ON-CHAIN BTC STATS — from public APIs ─────────────────────────────────────
app.get('/api/onchain/btc', async function(req, res) {
  const cached = getCache('onchain/btc');
  if (cached) return res.json(cached);
  try {
    // Blockchain.info for basic on-chain metrics
    const [stats, addrs] = await Promise.allSettled([
      fetchT('https://api.blockchain.info/stats', {}, 12000).then(function(r){return r.json();}),
      fetchT('https://api.blockchain.info/charts/n-unique-addresses?timespan=30days&format=json&sampled=true', {}, 12000).then(function(r){return r.json();})
    ]);
    const s = stats.status==='fulfilled' ? stats.value : {};
    const a = addrs.status==='fulfilled' ? addrs.value : {};
    const addrData = (a.values||[]).slice(-30).map(function(p){return {date:new Date(p.x*1000).toLocaleDateString('en',{month:'short',day:'numeric'}),val:p.y};});
    const result = {
      activeAddr:     s.n_unique_addresses || null,
      hashRate:       s.hash_rate ? +(s.hash_rate/1e18).toFixed(2) : null, // EH/s
      difficulty:     s.difficulty || null,
      blockHeight:    s.n_blocks_total || null,
      mempoolSize:    s.mempool_size || null,
      addrChart:      addrData,
      updated:        Date.now()
    };
    setCache('onchain/btc', result, 30*60*1000);
    res.json(result);
  } catch(e){res.status(502).json({error:e.message});}
});

// GENERIC ROUTES — MUST COME AFTER ALL SPECIFIC /api/crypto/* ROUTES
// ══════════════════════════════════════════════════════════════════

// Single instrument: /api/fx/eurusd, /api/cmd/gold, /api/eq/aapl
app.get('/api/:type/:id', async function(req, res) {
  const key = req.params.type+'/'+req.params.id;
  const inst = INSTRUMENTS[key];
  if (!inst) return res.status(404).json({error:'Unknown: '+key});
  const cached = getCache(key);
  if (cached) return res.json(cached);
  let candles = await fetchStooq(inst.stooq);
  if (!candles||candles.length<20) candles = await fetchYahoo(inst.yf);
  if (!candles||candles.length<20) return res.status(502).json({error:'No data for '+key});
  let quote = null;
  if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);
  const data = buildResponse(candles, quote, inst.dec);
  if (!data) return res.status(502).json({error:'Build failed: '+key});
  data.symbol = key.split('/')[1].toUpperCase();
  setCache(key, data);
  res.json(data);
});

// Overview: /api/overview/fx, /api/overview/cmd, /api/overview/eq
app.get('/api/overview/:type', async function(req, res) {
  const type = req.params.type;
  const keys = Object.keys(INSTRUMENTS).filter(function(k){return k.indexOf(type+'/')===0;});
  if (!keys.length) return res.status(404).json({error:'Unknown type: '+type});
  const cacheKey = 'overview/'+type;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  const results = await Promise.all(keys.map(async function(key){
    const inst = INSTRUMENTS[key];
    let candles = await fetchStooq(inst.stooq);
    if (!candles||candles.length<20) candles = await fetchYahoo(inst.yf);
    let quote = null;
    if (inst.fhq) quote = await fetchFinnhubQuote(inst.fhq);
    const data = buildResponse(candles, quote, inst.dec);
    if (!data) return null;
    data.symbol = key.split('/')[1].toUpperCase();
    return {key:key, data:data};
  }));
  const out = {};
  results.forEach(function(r){if(r)out[r.key]=r.data;});
  setCache(cacheKey, out);
  res.json(out);
});

// ── FRED: WALCL — Federal Reserve Total Assets (weekly → monthly) ─────────────
// Returns {series:[{date:'YYYY-MM',value:$T}], latest:{date,value}, updated:ms}
app.get('/api/fred/walcl', async function(req, res) {
  const cacheKey = 'fred/walcl';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const r = await fetchT(
      'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL',
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*' } },
      20000
    );
    if (!r.ok) throw new Error('FRED ' + r.status);
    const csv = await r.text();
    const monthly = {};
    csv.trim().split('\n').slice(1).forEach(function(ln) {
      const p = ln.split(',');
      if (p.length < 2) return;
      const v = p[1].trim();
      if (!v || v === '.') return;
      const val = parseFloat(v);
      if (isNaN(val) || val <= 0) return;
      // Keep last reading per month; value in millions USD → convert to $T
      monthly[p[0].slice(0, 7)] = +(val / 1e6).toFixed(3);
    });
    const series = Object.entries(monthly)
      .sort(function(a, b) { return a[0] < b[0] ? -1 : 1; })
      .map(function(e) { return { date: e[0], value: e[1] }; });
    if (!series.length) throw new Error('No valid WALCL data');
    const result = { series: series, latest: series[series.length - 1], updated: Date.now() };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// ── FRED: Liquidity — Fed (WALCL) + ECB (ECBASSETSW in EUR→USD) ───────────────
// Returns {fed:[{date,value}], ecb:[{date,value}], eurusd, latestFed, latestEcb, updated}
// BOJ is kept as hardcoded fallback in charts.js (no clean FRED USD series)
app.get('/api/fred/liquidity', async function(req, res) {
  const cacheKey = 'fred/liquidity';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  function parseFredMonthly(csv, divisor) {
    const monthly = {};
    csv.trim().split('\n').slice(1).forEach(function(ln) {
      const p = ln.split(',');
      if (p.length < 2) return;
      const v = p[1].trim();
      if (!v || v === '.') return;
      const val = parseFloat(v);
      if (isNaN(val) || val <= 0) return;
      monthly[p[0].slice(0, 7)] = val / divisor;
    });
    return monthly;
  }

  try {
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*' } };
    const [walclRes, ecbRes, eurusdRes] = await Promise.allSettled([
      fetchT('https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL', opts, 20000).then(function(r) { return r.text(); }),
      fetchT('https://fred.stlouisfed.org/graph/fredgraph.csv?id=ECBASSETSW', opts, 20000).then(function(r) { return r.text(); }),
      fetchT('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSEU', opts, 15000).then(function(r) { return r.text(); })
    ]);

    // Get latest EUR/USD spot rate
    let eurusd = 1.08;
    if (eurusdRes.status === 'fulfilled') {
      const lines = eurusdRes.value.trim().split('\n').slice(1).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const p = lines[i].split(',');
        const v = parseFloat(p[1]);
        if (!isNaN(v) && v > 0) { eurusd = v; break; }
      }
    }

    // Fed: millions USD → $T
    const fedMonthly = walclRes.status === 'fulfilled' ? parseFredMonthly(walclRes.value, 1e6) : {};

    // ECB: millions EUR → $T (convert with EUR/USD rate)
    const ecbMonthly = {};
    if (ecbRes.status === 'fulfilled') {
      const rawEcb = parseFredMonthly(ecbRes.value, 1e6); // millions EUR → $T EUR
      Object.entries(rawEcb).forEach(function(e) {
        ecbMonthly[e[0]] = +(e[1] * eurusd).toFixed(3);
      });
    }

    const toSeries = function(map) {
      return Object.entries(map)
        .sort(function(a, b) { return a[0] < b[0] ? -1 : 1; })
        .map(function(e) { return { date: e[0], value: +e[1].toFixed(3) }; });
    };

    const fedSeries = toSeries(fedMonthly);
    const ecbSeries = toSeries(ecbMonthly);
    const result = {
      fed: fedSeries, ecb: ecbSeries, eurusd: eurusd,
      latestFed: fedSeries.length ? fedSeries[fedSeries.length - 1] : null,
      latestEcb: ecbSeries.length ? ecbSeries[ecbSeries.length - 1] : null,
      updated: Date.now()
    };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    res.json(result);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// ── TV ACCESS — ROUTES ────────────────────────────────────────────────────────

function tvAdminAuth(req, res) {
  const secret   = req.query.secret || req.headers['x-admin-secret'];
  const expected = process.env.WEBHOOK_SECRET || 'defimongo_webhook_2026';
  if (!secret || secret !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// POST /api/tv-access — submit or update registration
app.post('/api/tv-access', async function(req, res) {
  const { email, tvUsername, tier, tierName } = req.body || {};
  if (!email || !tvUsername) return res.status(400).json({ error: 'email and tvUsername required' });
  const clean = email.toLowerCase().trim();
  const existing = await tvFind(clean);
  const fields = {
    tvUsername: tvUsername.trim(),
    tier:       tier     || 1,
    tierName:   tierName || 'FREE',
    submittedAt: existing ? existing.submittedAt : new Date(),
    updatedAt:   new Date(),
    status:      existing ? existing.status : 'pending',
    membershipStart: existing ? existing.membershipStart : null,
    membershipEnd:   existing ? existing.membershipEnd   : null,
  };
  const saved = await tvUpsert(clean, fields);
  res.json({ ok: true, status: tvCalcStatus(saved) });
});

// GET /api/tv-access/status?email=
app.get('/api/tv-access/status', async function(req, res) {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  const reg = await tvFind(email);
  if (!reg) return res.json({ found: false });
  const status = tvCalcStatus(reg);
  // Auto-persist expired status
  if (status !== reg.status) {
    await tvUpsert(email, { status });
  }
  res.json({
    found: true, status,
    tvUsername:      reg.tvUsername,
    tier:            reg.tier,
    tierName:        reg.tierName,
    submittedAt:     reg.submittedAt,
    membershipStart: reg.membershipStart,
    membershipEnd:   reg.membershipEnd,
    daysLeft:        tvDaysLeft(reg.membershipEnd),
  });
});

// POST /api/tv-access/admin/activate?secret=&email=  (30 days from today)
app.post('/api/tv-access/admin/activate', async function(req, res) {
  if (!tvAdminAuth(req, res)) return;
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  const start = new Date();
  const end   = new Date(start.getTime() + 30 * 86400000);
  await tvUpsert(email, { status: 'active', membershipStart: start, membershipEnd: end });
  res.json({ ok: true, membershipStart: start, membershipEnd: end });
});

// POST /api/tv-access/admin/extend?secret=&email=  (+30 days from current end or today)
app.post('/api/tv-access/admin/extend', async function(req, res) {
  if (!tvAdminAuth(req, res)) return;
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  const reg  = await tvFind(email);
  const base = (reg && reg.membershipEnd && new Date(reg.membershipEnd) > new Date())
    ? new Date(reg.membershipEnd) : new Date();
  const end  = new Date(base.getTime() + 30 * 86400000);
  const start = (reg && reg.membershipStart) ? reg.membershipStart : new Date();
  await tvUpsert(email, { status: 'active', membershipStart: start, membershipEnd: end });
  res.json({ ok: true, membershipEnd: end });
});

// POST /api/tv-access/admin/revoke?secret=&email=
app.post('/api/tv-access/admin/revoke', async function(req, res) {
  if (!tvAdminAuth(req, res)) return;
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  await tvUpsert(email, { status: 'revoked', membershipEnd: new Date() });
  res.json({ ok: true });
});

// GET /api/tv-access/admin/data?secret=  (JSON data for admin page)
app.get('/api/tv-access/admin/data', async function(req, res) {
  if (!tvAdminAuth(req, res)) return;
  const all = await tvAll();
  const rows = all.map(function(r) {
    const status = tvCalcStatus(r);
    return {
      email:           r.email,
      tvUsername:      r.tvUsername,
      tier:            r.tier,
      tierName:        r.tierName,
      status,
      submittedAt:     r.submittedAt,
      membershipStart: r.membershipStart,
      membershipEnd:   r.membershipEnd,
      daysLeft:        tvDaysLeft(r.membershipEnd),
    };
  });
  const summary = {
    total:    rows.length,
    active:   rows.filter(function(r){ return r.status === 'active'; }).length,
    expiring: rows.filter(function(r){ return r.status === 'active' && r.daysLeft !== null && r.daysLeft <= 7; }).length,
    pending:  rows.filter(function(r){ return r.status === 'pending'; }).length,
    expired:  rows.filter(function(r){ return r.status === 'expired' || r.status === 'revoked'; }).length,
  };
  res.json({ summary, rows });
});

// GET /admin/access?secret=  (HTML admin dashboard)
app.get('/admin/access', function(req, res) {
  const secret = req.query.secret || '';
  const expected = process.env.WEBHOOK_SECRET || 'defimongo_webhook_2026';
  if (!secret || secret !== expected) {
    return res.status(401).send('<h2 style="font-family:monospace;color:red">401 Unauthorized</h2>');
  }
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DeFiMongo — Mongo Pulse Access Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#030a0f;color:#ccd8df;font-family:'Space Mono',monospace;padding:24px;min-height:100vh}
  h1{font-size:20px;color:#fff;margin-bottom:4px}
  .sub{font-size:10px;color:#4a6070;letter-spacing:1px;margin-bottom:24px}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px}
  .card{background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:10px;padding:16px 20px;flex:1;min-width:100px;text-align:center}
  .card .val{font-size:26px;font-weight:700;margin-bottom:4px}
  .card .lbl{font-size:9px;color:#4a6070;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{font-size:9px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
  tr:hover td{background:rgba(255,255,255,0.02)}
  .badge{display:inline-block;border-radius:4px;padding:3px 8px;font-size:9px;letter-spacing:1px;font-weight:700}
  .s-active{background:rgba(0,232,122,0.15);color:#00e87a;border:1px solid rgba(0,232,122,0.3)}
  .s-expiring{background:rgba(244,197,66,0.15);color:#f4c542;border:1px solid rgba(244,197,66,0.3)}
  .s-pending{background:rgba(0,180,216,0.12);color:#00b4d8;border:1px solid rgba(0,180,216,0.25)}
  .s-expired{background:rgba(255,68,68,0.12);color:#ff4444;border:1px solid rgba(255,68,68,0.25)}
  .s-revoked{background:rgba(100,100,100,0.15);color:#4a6070;border:1px solid rgba(255,255,255,0.08)}
  .btn{border:none;border-radius:5px;padding:5px 10px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:opacity .15s}
  .btn:hover{opacity:.8}
  .btn-activate{background:#00e87a;color:#000}
  .btn-extend{background:#00b4d8;color:#000}
  .btn-revoke{background:#ff4444;color:#fff}
  .wrap{background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:12px;overflow:auto}
  .empty{text-align:center;padding:48px;color:#4a6070;font-size:13px}
  .refresh{background:transparent;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:6px 14px;color:#ccd8df;cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;float:right}
  .refresh:hover{border-color:#00b4d8}
  .toast{position:fixed;bottom:24px;right:24px;background:#0a1520;border:1px solid rgba(0,232,122,0.4);border-radius:8px;padding:12px 20px;font-size:11px;color:#00e87a;opacity:0;transition:opacity .3s;pointer-events:none}
  .tv{color:#00b4d8;font-weight:700}
  .days-bar{height:4px;border-radius:2px;background:rgba(255,255,255,0.06);margin-top:4px;width:120px}
  .days-fill{height:100%;border-radius:2px}
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:8px">
  <div>
    <h1>📺 MONGO PULSE ACCESS ADMIN</h1>
    <div class="sub">DEFIMONGO · MONGO PULSE INDICATOR MANAGEMENT</div>
  </div>
  <button class="refresh" onclick="load()">↻ REFRESH</button>
</div>

<div class="cards" id="summary-cards">
  <div class="card"><div class="val" id="s-total">—</div><div class="lbl">TOTAL</div></div>
  <div class="card"><div class="val" style="color:#00e87a" id="s-active">—</div><div class="lbl">ACTIVE</div></div>
  <div class="card"><div class="val" style="color:#f4c542" id="s-expiring">—</div><div class="lbl">EXPIRING ≤7D</div></div>
  <div class="card"><div class="val" style="color:#00b4d8" id="s-pending">—</div><div class="lbl">PENDING</div></div>
  <div class="card"><div class="val" style="color:#ff4444" id="s-expired">—</div><div class="lbl">EXPIRED</div></div>
</div>

<div class="wrap">
  <table id="members-table">
    <thead>
      <tr>
        <th>TRADINGVIEW</th>
        <th>EMAIL</th>
        <th>TIER</th>
        <th>STATUS</th>
        <th>START</th>
        <th>END</th>
        <th>DAYS LEFT</th>
        <th>ACTIONS</th>
      </tr>
    </thead>
    <tbody id="members-body">
      <tr><td colspan="8" class="empty">Loading...</td></tr>
    </tbody>
  </table>
</div>

<div class="toast" id="toast"></div>

<script>
const SECRET = ${JSON.stringify(secret)};
const BASE   = '';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function statusBadge(row) {
  if (row.status === 'active' && row.daysLeft !== null && row.daysLeft <= 7) {
    return '<span class="badge s-expiring">⚠ EXPIRING</span>';
  }
  const map = { active:'s-active', pending:'s-pending', expired:'s-expired', revoked:'s-revoked' };
  const labels = { active:'✓ ACTIVE', pending:'⏳ PENDING', expired:'✗ EXPIRED', revoked:'— REVOKED' };
  const cls = map[row.status] || 's-pending';
  return '<span class="badge '+cls+'">'+(labels[row.status]||row.status.toUpperCase())+'</span>';
}

function daysBar(row) {
  if (!row.membershipStart || !row.membershipEnd) return '';
  const total = new Date(row.membershipEnd) - new Date(row.membershipStart);
  const used  = Date.now() - new Date(row.membershipStart);
  const pct   = Math.max(0, Math.min(100, (used / total) * 100));
  const color = pct > 85 ? '#ff4444' : pct > 60 ? '#f4c542' : '#00e87a';
  return '<div class="days-bar"><div class="days-fill" style="width:'+pct+'%;background:'+color+'"></div></div>';
}

async function action(endpoint, email) {
  const r = await fetch('/api/tv-access/admin/'+endpoint+'?secret='+SECRET+'&email='+encodeURIComponent(email), { method:'POST' });
  const d = await r.json();
  if (d.ok) { showToast('Done'); load(); } else { showToast('Error: '+(d.error||'unknown'), true); }
}

function showToast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = err ? 'rgba(255,68,68,0.4)' : 'rgba(0,232,122,0.4)';
  t.style.color = err ? '#ff4444' : '#00e87a';
  t.style.opacity = 1;
  setTimeout(function(){ t.style.opacity = 0; }, 2500);
}

async function load() {
  const r = await fetch('/api/tv-access/admin/data?secret='+SECRET);
  const d = await r.json();
  document.getElementById('s-total').textContent    = d.summary.total;
  document.getElementById('s-active').textContent   = d.summary.active;
  document.getElementById('s-expiring').textContent = d.summary.expiring;
  document.getElementById('s-pending').textContent  = d.summary.pending;
  document.getElementById('s-expired').textContent  = d.summary.expired;
  const tbody = document.getElementById('members-body');
  if (!d.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">No registrations yet.</td></tr>';
    return;
  }
  tbody.innerHTML = d.rows.map(function(row) {
    const dl = row.daysLeft !== null ? (row.daysLeft <= 0 ? '<span style="color:#ff4444">Expired</span>' : row.daysLeft + ' days') : '—';
    return '<tr>' +
      '<td><span class="tv">@'+row.tvUsername+'</span></td>' +
      '<td>'+row.email+'</td>' +
      '<td>'+( row.tierName || 'FREE' )+'</td>' +
      '<td>'+statusBadge(row)+'</td>' +
      '<td>'+fmt(row.membershipStart)+'</td>' +
      '<td>'+fmt(row.membershipEnd)+'</td>' +
      '<td>'+dl+daysBar(row)+'</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-activate" onclick="action(\'activate\',\''+row.email+'\')">ACTIVATE</button> ' +
        '<button class="btn btn-extend"   onclick="action(\'extend\',\''+row.email+'\')">+30D</button> ' +
        '<button class="btn btn-revoke"   onclick="action(\'revoke\',\''+row.email+'\')">REVOKE</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

load();
</script>
</body>
</html>`);
});

// ── HEALTH & ROOT ─────────────────────────────────────────────────────────────
app.get('/health', function(req, res) {
  res.json({status:'ok', server:'DeFiMongo API', version:'3.0.0',
    cached:Object.keys(CACHE).length, instruments:Object.keys(INSTRUMENTS).length,
    uptime:Math.floor(process.uptime())+'s'});
});
app.get('/', function(req, res) {
  res.json({name:'DeFiMongo Market Data API v3.0', health:'/health'});
});

app.listen(PORT, function() {
  console.log('DeFiMongo API v3.0 on port '+PORT);
  console.log('Finnhub: '+(FH_KEY?'configured':'NOT SET'));

  // ── KEEP-ALIVE — ping self every 14 min to prevent Railway from sleeping ──
  setInterval(function() {
    fetch('http://localhost:' + PORT + '/health')
      .then(function(r){ if(r.ok) console.log('[KeepAlive] OK'); })
      .catch(function(e){ console.warn('[KeepAlive] Failed:', e.message); });
  }, 14 * 60 * 1000);
});

// ── GRACEFUL ERROR HANDLING — prevent crashes from unhandled errors ──────────
process.on('uncaughtException', function(err) {
  console.error('[DeFiMongo] Uncaught Exception:', err.message);
  // Don't exit — keep server running
});

process.on('unhandledRejection', function(reason) {
  console.warn('[DeFiMongo] Unhandled Rejection:', reason);
  // Don't exit — keep server running
});
