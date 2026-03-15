// ════════════════════════════════════════════════════════════════════════════
// DEFIMONGO DASHBOARD — ALL DATA LIVE FROM APIS
// Prices: CoinGecko free API  |  DeFi: DeFiLlama  |  Sentiment: alternative.me
// ════════════════════════════════════════════════════════════════════════════

const CG = 'https://api.coingecko.com/api/v3';
let ALL_COINS = [];
let BTC_CURRENT = 0;
let BTC_30D = { prices: [], labels: [] };
let BTC_365D = { prices: [], labels: [] };
let BTC_12M  = { prices: [], labels: [] };
let BTC_RAW_CHART = null; // raw API response for year perf calc

// ── COLOR CONSTANTS ──────────────────────────────────────────────────────────
const ACCENT='#00e87a', BLUE='#00b4d8', GOLD='#f4c542';
const RED='#ff4560', ORANGE='#ff6b35', PURPLE='#aa88ff';
const MUTED='#4d6475', BG2='#111820', BG3='#162028';

// ── CHART.JS GLOBAL DEFAULTS ─────────────────────────────────────────────────
if(typeof Chart !== 'undefined'){
  Chart.defaults.font.family = "'Space Mono', monospace";
  Chart.defaults.font.size   = 11;
  Chart.defaults.color       = MUTED;
  Chart.defaults.plugins.legend.labels.font = {family:"'Space Mono', monospace", size:10};
  Chart.defaults.plugins.tooltip.bodyFont   = {family:"'Space Mono', monospace", size:11};
  Chart.defaults.plugins.tooltip.titleFont  = {family:"'Space Grotesk', sans-serif", size:12, weight:'600'};
  Chart.defaults.plugins.tooltip.backgroundColor = '#0c1014';
  Chart.defaults.plugins.tooltip.borderColor      = '#1c2d38';
  Chart.defaults.plugins.tooltip.borderWidth      = 1;
  Chart.defaults.plugins.tooltip.padding          = 10;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n){
  if(n==null)return '—';
  if(Math.abs(n)>=1e12)return '$'+(n/1e12).toFixed(2)+'T';
  if(Math.abs(n)>=1e9) return '$'+(n/1e9).toFixed(2)+'B';
  if(Math.abs(n)>=1e6) return '$'+(n/1e6).toFixed(2)+'M';
  if(Math.abs(n)>=1e3) return '$'+n.toLocaleString(undefined,{maximumFractionDigits:2});
  return '$'+n.toFixed(4);
}
function fmtPct(n){return n==null?'—':(n>=0?'+':'')+n.toFixed(2)+'%';}
function pctClass(n){return n>=0?'up':'dn';}
function hexGrad(canvas,hex){
  const ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,canvas.height||200);
  g.addColorStop(0,hex+'40'); g.addColorStop(1,hex+'00');
  return g;
}
function calcMA(prices,period){
  return prices.map((_,i)=>{
    if(i<period-1)return null;
    return +(prices.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period).toFixed(0);
  });
}
function calcRSI(prices,period=14){
  const rsi=[];
  for(let i=0;i<prices.length;i++){
    if(i<period){rsi.push(null);continue;}
    let g=0,l=0;
    for(let j=i-period+1;j<=i;j++){const d=prices[j]-prices[j-1];d>0?g+=d:l+=Math.abs(d);}
    const ag=g/period,al=l/period;
    rsi.push(al===0?100:+(100-(100/(1+ag/al))).toFixed(1));
  }
  return rsi;
}

// ── FETCH HELPERS ─────────────────────────────────────────────────────────────
async function fetchJSON(url){
  try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);return await r.json();}
  catch(e){console.warn('fetch failed:',url,e);return null;}
}

// ── MAIN INITIALISER — runs on load and every 60s ────────────────────────────
const CR_API = 'https://defimongo-production.up.railway.app';


// ── SHARED BTC DAILY HISTORY — used by ALL overlay charts ────────────────────
// Format: [{ts:unix, date:'2013-01-01', price:13.5}, ...]
window.BTC_DAILY_HISTORY  = [];
window.BTC_MONTHLY_HISTORY= []; // kept for backward compat
window._btcDailyLoaded    = false;

async function loadBtcDailyHistory() {
  if (window._btcDailyLoaded) return;
  try {
    const r = await fetch(`${CR_API}/api/crypto/btc-daily`, {signal:AbortSignal.timeout(30000)});
    if (!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    if (!d || !d.daily || !d.daily.length) throw new Error('No data');

    window.BTC_DAILY_HISTORY = d.daily; // [{ts, date, price}]
    window._btcDailyLoaded   = true;

    // Also populate monthly for backward compat with older chart code
    const seen = {};
    window.BTC_MONTHLY_HISTORY = d.daily.filter(function(p) {
      const ym = p.date.slice(0,7);
      if (!seen[ym]) { seen[ym] = true; return true; }
      return false;
    }).map(function(p) {
      return { ym: p.date.slice(0,7), ts: p.ts, price: p.price };
    });

    // Refresh all overlay charts with real daily data
    ['_fedRefresh','_dxyRefresh','_liqRefresh','_ismRefresh','_socialRefresh',
     '_halvingRefresh','_epochRefresh'].forEach(function(fn) {
      if (typeof window[fn] === 'function') {
        try { window[fn](); } catch(e){ console.warn('[DeFiMongo] '+fn+' error:', e.message); }
      }
    });

    console.log('[DeFiMongo] BTC daily history loaded:', d.daily.length, 'days from', d.daily[0].date, 'to', d.daily[d.daily.length-1].date);
  } catch(e) {
    console.warn('[DeFiMongo] BTC daily history failed, using fallback:', e.message);
    // Fallback: try monthly endpoint
    try {
      const r2 = await fetch(`${CR_API}/api/crypto/btc-monthly`, {signal:AbortSignal.timeout(20000)});
      if (r2.ok) {
        const d2 = await r2.json();
        if (d2 && d2.prices && d2.prices.length) {
          const seen2 = {};
          window.BTC_MONTHLY_HISTORY = d2.prices.map(function(p) {
            return { ym: new Date(p[0]).toISOString().slice(0,7), ts: Math.floor(p[0]/1000), price: +p[1].toFixed(2) };
          }).filter(function(p) {
            if (seen2[p.ym]) return false;
            seen2[p.ym] = true; return true;
          });
          console.log('[DeFiMongo] BTC monthly fallback loaded:', window.BTC_MONTHLY_HISTORY.length, 'months');
        }
      }
    } catch(e2) { console.warn('[DeFiMongo] Monthly fallback also failed'); }
  }
}

// ── HALVING CYCLE DAILY DATA ──────────────────────────────────────────────────
// Returns daily prices for a specific halving cycle from Railway
// Falls back to slicing BTC_DAILY_HISTORY if available
window.BTC_HALVING_CYCLES = {}; // {1: [{day,ts,price}], 2: ..., 3: ..., 4: ...}

async function loadHalvingCycle(cycle) {
  if (window.BTC_HALVING_CYCLES[cycle]) return window.BTC_HALVING_CYCLES[cycle];
  try {
    const r = await fetch(`${CR_API}/api/crypto/btc-halving/${cycle}`, {signal:AbortSignal.timeout(25000)});
    if (!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    if (!d || !d.prices || !d.prices.length) throw new Error('No data');
    window.BTC_HALVING_CYCLES[cycle] = d.prices; // [{day, ts, price}]
    console.log('[DeFiMongo] Halving cycle', cycle, 'loaded:', d.prices.length, 'days');
    return d.prices;
  } catch(e) {
    console.warn('[DeFiMongo] Halving cycle', cycle, 'failed:', e.message);
    return null;
  }
}

// ── HELPER: get BTC data for TradingView overlay charts ──────────────────────
// Priority: daily history → monthly history → hardcoded fallback
// Always injects live BTC_CURRENT as final point
function getBtcOverlayData(fallbackArr) {
  var src;

  if (window.BTC_DAILY_HISTORY && window.BTC_DAILY_HISTORY.length > 100) {
    // Use real daily data
    src = window.BTC_DAILY_HISTORY.map(function(d) {
      return { time: d.ts, value: d.price };
    });
  } else if (window.BTC_MONTHLY_HISTORY && window.BTC_MONTHLY_HISTORY.length > 10) {
    // Use monthly
    src = window.BTC_MONTHLY_HISTORY.map(function(m) {
      return { time: m.ts, value: m.price };
    });
  } else {
    // Hardcoded fallback
    src = (fallbackArr || []).map(function(d) {
      return { time: new Date(d[0]+'-01').getTime()/1000, value: d[1] };
    });
  }

  // Always inject live price as final point
  if (window.BTC_CURRENT && src.length) {
    var nowTs = Math.floor(Date.now()/1000);
    var last  = src[src.length-1];
    // Replace last point if within 35 days (covers monthly data gaps)
    if (nowTs - last.time < 35*86400) {
      src[src.length-1] = { time: nowTs, value: Math.round(window.BTC_CURRENT) };
    } else {
      src.push({ time: nowTs, value: Math.round(window.BTC_CURRENT) });
    }
  }
  return src;
}

// Backward compat alias
function loadBtcMonthlyHistory() { return loadBtcDailyHistory(); }



async function init(){
  // 1. Fetch all live data — route CoinGecko through Railway to avoid CORS
  const [markets, global, fg, btcChart] = await Promise.all([
    fetchJSON(`${CR_API}/api/crypto/markets`),
    fetchJSON(`${CR_API}/api/crypto/global`),
    fetchJSON(`${CR_API}/api/crypto/feargreed`),
    fetchJSON(`${CR_API}/api/crypto/btcchart`)
  ]);

  // 2. Process BTC price history — everything else reads from these shared arrays
  if(btcChart?.prices?.length){
    BTC_RAW_CHART = btcChart;
    BTC_365D.prices = btcChart.prices.map(p=>p[1]);
    BTC_365D.labels = btcChart.prices.map(p=>new Date(p[0]).toLocaleDateString('en',{month:'short',day:'numeric'}));
    BTC_CURRENT     = BTC_365D.prices[BTC_365D.prices.length-1];
    BTC_30D.prices  = BTC_365D.prices.slice(-30);
    BTC_30D.labels  = BTC_365D.labels.slice(-30);
    // 12 monthly samples
    const step=Math.floor(BTC_365D.prices.length/12);
    for(let i=0;i<12;i++){
      const idx=Math.min(i*step,BTC_365D.prices.length-1);
      BTC_12M.prices.push(BTC_365D.prices[idx]);
      BTC_12M.labels.push(BTC_365D.labels[idx]);
    }
    BTC_12M.prices[11]=BTC_CURRENT; BTC_12M.labels[11]='Now';
  }

  // 3. Use market data for current price if chart data not available
  if(!BTC_CURRENT&&markets?.length){
    const b=markets.find(c=>c.id==='bitcoin');
    if(b)BTC_CURRENT=b.current_price;
  }

  // 4. Render UI components
  if(markets?.length){
    ALL_COINS=markets;
    renderTicker(markets);
    renderCoins(markets);
    renderTrending(markets);
  }
  if(global) renderGlobal(global);
  if(fg)     renderFearGreed(fg);

  // 5. Update ALL price stat cards with live BTC price
  updateAllPriceCards();

  // 6. Draw all charts (only on first load — charts don't redraw on refresh)
  if(!window._chartsDrawn){
    window._chartsDrawn=true;
    drawAllCharts();
    // After charts draw, immediately fire all refresh hooks so live BTC price
    // replaces any hardcoded fallback values used during initial render
    setTimeout(function() {
      if (window['_halvingRefresh'])  window['_halvingRefresh']();
      if (window['_epochRefresh'])    window['_epochRefresh']();
      if (window['_fedRefresh'])      window['_fedRefresh']();
      if (window['_dxyRefresh'])      window['_dxyRefresh']();
      if (window['_liqRefresh'])      window['_liqRefresh']();
      if (window['_ismRefresh'])      window['_ismRefresh']();
      if (window['_socialRefresh'])   window['_socialRefresh']();
    }, 100); // small delay to let chart series initialize first
    // Load full BTC daily history for accurate overlay charts
    loadBtcDailyHistory();
    // Pre-load halving cycle data for halving chart
    setTimeout(function() {
      [1,2,3,4].forEach(function(c) { loadHalvingCycle(c); });
    }, 2000);
  }

  // Refresh yearly performance charts with latest BTC price data
  if (window._ypRefresh)    window._ypRefresh();
  if (window._btcdRefresh)  window._btcdRefresh();
  if (window['_sp500Refresh']) window['_sp500Refresh']();
  if (window['_goldRefresh'])     window['_goldRefresh']();
  if (window['_dxyperfRefresh'])  window['_dxyperfRefresh']();
  if (window['_igvRefresh'])      window['_igvRefresh']();
  if (window['_gsciRefresh'])     window['_gsciRefresh']();
  if (window['_halvingRefresh'])  window['_halvingRefresh']();
  if (window['_epochRefresh'])    window['_epochRefresh']();
  if (window['_ismRefresh'])      window['_ismRefresh']();
  if (window['_fedRefresh'])      window['_fedRefresh']();
  if (window['_dxyRefresh'])      window['_dxyRefresh']();
  if (window['_liqRefresh'])      window['_liqRefresh']();
  if (window['_socialRefresh'])   window['_socialRefresh']();

  setTimeout(init, 60000);
}

// ── UPDATE EVERY PRICE STAT CARD ─────────────────────────────────────────────
function updateAllPriceCards(){
  if(!BTC_CURRENT)return;
  const p=BTC_CURRENT;
  const fmtPrice='$'+p.toLocaleString(undefined,{maximumFractionDigits:0});

  // All elements that should show live BTC price
  ['dxyBtc','smaCurrentPrice'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.textContent=fmtPrice;
  });

  // BTC % change from live markets
  const btc=ALL_COINS.find(c=>c.id==='bitcoin');
  if(btc){
    const chgEl=document.getElementById('btcDayChg');
    if(chgEl){
      const chg=btc.price_change_percentage_24h||0;
      chgEl.textContent=fmtPct(chg);
      chgEl.className='cc '+pctClass(chg);
    }
  }
}

// ── RENDER TICKER ─────────────────────────────────────────────────────────────
function renderTicker(coins){
  const wrap=document.getElementById('ticker');
  if(!wrap)return;
  const html=coins.map(c=>{
    const chg=c.price_change_percentage_24h||0;
    return `<div class="ti"><span class="ts">${c.symbol.toUpperCase()}</span><span>${fmt(c.current_price)}</span><span class="${pctClass(chg)}">${fmtPct(chg)}</span></div>`;
  }).join('');
  wrap.innerHTML=html+html; // duplicate for seamless scroll
}

// ── COIN TABLE ENGINE ─────────────────────────────────────────────────────────
let COIN_FILTER  = 'top200';
let COIN_STORE   = { top200:[], defi:[], layer1:[], binance:[], hyperliquid:[] };
let COIN_LOADED  = {};
let COIN_FETCHING= {};

async function fetchCoinFilter(filter) {
  if (COIN_FETCHING[filter]) return; // already in flight
  if (COIN_LOADED[filter] && COIN_STORE[filter].length) return; // already loaded
  COIN_FETCHING[filter] = true;
  try {
    const urlMap = {
      top200:      `${CR_API}/api/crypto/markets`,
      defi:        `${CR_API}/api/crypto/category/defi`,
      layer1:      `${CR_API}/api/crypto/category/layer1`,
      binance:     `${CR_API}/api/crypto/binance`,
      hyperliquid: `${CR_API}/api/crypto/hyperliquid`
    };
    const url = urlMap[filter];
    if (!url) return;
    const r = await fetch(url, {signal: AbortSignal.timeout(25000)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (Array.isArray(data) && data.length) {
      COIN_STORE[filter] = data;
      COIN_LOADED[filter] = true;
      if (COIN_FILTER === filter) renderCoinTable();
    }
  } catch(e) {
    console.warn('fetchCoinFilter failed:', filter, e.message);
  }
  COIN_FETCHING[filter] = false;
}

function setCoinFilter(filter, el) {
  COIN_FILTER = filter;
  document.querySelectorAll('.coin-tab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  else document.querySelector(`.coin-tab[data-filter="${filter}"]`)?.classList.add('on');
  renderCoinTable();
  if (!COIN_LOADED[filter]) fetchCoinFilter(filter);
}

function loadMoreCoins() {
  const lmb = document.getElementById('coin-load-more-btn');
  if (lmb) lmb.style.display = 'none';
  // Switch to 201-400 tab immediately and fetch
  COIN_FILTER = 'top400';
  document.querySelectorAll('.coin-tab').forEach(t => t.classList.remove('on'));
  document.querySelector('[data-filter="top400"]')?.classList.add('on');
  renderCoinTable(); // shows loading spinner
  fetchCoinFilter('top400');
}

function renderCoinTable() {
  const tb     = document.getElementById('coinBody');
  const srcLbl = document.getElementById('coin-source-label');
  if (!tb) return;

  let list = [...(COIN_STORE[COIN_FILTER] || [])];
  const q = (document.getElementById('coinSearch')?.value || '').toLowerCase();
  if (q) list = list.filter(c =>
    (c.name||'').toLowerCase().includes(q) ||
    (c.symbol||'').toLowerCase().includes(q)
  );

  const srcMap = {
    top200:      'CoinGecko · Top 50 by Market Cap',
    defi:        'CoinGecko · DeFi Tokens',
    layer1:      'CoinGecko · Layer 1 Blockchains',
    binance:     'Binance · Top 100 USDT Pairs by Volume',
    hyperliquid: 'Hyperliquid · Perpetual Contracts'
  };
  if (srcLbl) srcLbl.textContent = (srcMap[COIN_FILTER]||'') + ' · ' + list.length + ' coins';

  // Update header stats
  const ctEl = document.getElementById('coinCount');
  if (ctEl) ctEl.textContent = list.length;

  if (!list.length) {
    tb.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:48px;font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:2px">
      <div style="width:18px;height:18px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 14px"></div>
      FETCHING ${COIN_FILTER.toUpperCase()} DATA…
    </td></tr>`;
    return;
  }

  const isBinance = COIN_FILTER === 'binance';
  const isHL      = COIN_FILTER === 'hyperliquid';

  tb.innerHTML = list.map((c, i) => {
    const chg24 = c.price_change_percentage_24h || 0;
    const chg1h = c.price_change_percentage_1h_in_currency || 0;
    const chg7d = c.price_change_percentage_7d_in_currency || 0;
    const spark = c.sparkline_in_7d?.price || [];
    let sparkSVG = '';
    if (spark.length > 1) {
      const mn = Math.min(...spark), mx = Math.max(...spark), rng = mx - mn || 1;
      const pts = spark.filter((_,j) => j % Math.ceil(spark.length/30) === 0)
        .map((v,j,a) => `${j/(a.length-1)*80},${20-(v-mn)/rng*18}`).join(' ');
      const sc = spark[spark.length-1] >= spark[0] ? ACCENT : RED;
      sparkSVG = `<svg viewBox="0 0 80 20" style="width:80px;height:20px"><polyline points="${pts}" fill="none" stroke="${sc}" stroke-width="1.5"/></svg>`;
    }
    let srcBadge = '';
    if (isBinance) srcBadge = `<span style="font-family:'Space Mono',monospace;font-size:7px;padding:1px 5px;border-radius:2px;background:rgba(243,186,47,.12);color:#F3BA2F;border:1px solid rgba(243,186,47,.2)">BNB</span>`;
    else if (isHL) srcBadge = `<span style="font-family:'Space Mono',monospace;font-size:7px;padding:1px 5px;border-radius:2px;background:rgba(0,232,122,.1);color:var(--accent);border:1px solid rgba(0,232,122,.2)">HL</span>`;

    const imgHtml = c.image
      ? `<img src="${c.image}" style="width:22px;height:22px;border-radius:50%;flex-shrink:0" loading="lazy" onerror="this.style.display='none'"/>`
      : `<div style="width:22px;height:22px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);flex-shrink:0">${(c.symbol||'?')[0].toUpperCase()}</div>`;

    const clickable = !isBinance && !isHL;
    const rowClick  = clickable ? `onclick="openCoinModal('${c.id}')"` : '';
    const rowCursor = clickable ? 'cursor:pointer' : '';
    const oiHtml    = isHL && c.open_interest ? `<br><span style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted)">OI: ${fmt(c.open_interest*c.current_price)}</span>` : '';

    return `<tr ${rowClick} style="${rowCursor}" onmouseover="this.querySelectorAll('td').forEach(t=>t.style.background='rgba(0,232,122,.022)')" onmouseout="this.querySelectorAll('td').forEach(t=>t.style.background='')">
      <td style="color:var(--muted);font-family:'Space Mono',monospace;font-size:11px">${c.market_cap_rank||i+1}</td>
      <td><div style="display:flex;align-items:center;gap:9px">
        ${imgHtml}
        <div>
          <div style="font-weight:600;font-size:13px">${c.name}</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">${(c.symbol||'').toUpperCase()} ${srcBadge}</div>
        </div>
      </div></td>
      <td style="font-family:'Space Mono',monospace;font-size:12px;font-weight:600">${fmt(c.current_price)}</td>
      <td class="${pctClass(chg24)}" style="font-family:'Space Mono',monospace;font-size:11px">${fmtPct(chg24)}</td>
      <td class="${pctClass(chg1h)}" style="font-family:'Space Mono',monospace;font-size:11px">${chg1h?fmtPct(chg1h):'—'}</td>
      <td class="${pctClass(chg7d)}" style="font-family:'Space Mono',monospace;font-size:11px">${chg7d?fmtPct(chg7d):'—'}</td>
      <td>${sparkSVG}</td>
      <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">${fmt(c.market_cap||0)}${oiHtml}</td>
      <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">${fmt(c.total_volume)}</td>
      <td style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted)">${c.source||'CG'}</td>
    </tr>`;
  }).join('');

  // Update gainers from current list
  const gainersEl = document.getElementById('gainersRow');
  if (gainersEl) {
    const top3 = [...list].filter(c=>c.price_change_percentage_24h>0)
      .sort((a,b)=>b.price_change_percentage_24h-a.price_change_percentage_24h).slice(0,3);
    if (top3.length) {
      gainersEl.innerHTML = top3.map((c,i) => {
        const sym = (c.symbol||'').toUpperCase();
        const col = '#'+Math.abs((c.id||sym).split('').reduce((h,ch)=>((h<<5)-h)+ch.charCodeAt(0),0)).toString(16).slice(0,6).padEnd(6,'0');
        return `<div class="tri"><span class="trn">${i+1}</span><div class="tric" style="background:${col}22;color:${col}">${sym[0]||'?'}</div><span class="trnm">${c.name} <span class="trsy">${sym}</span></span><span class="trc up">${fmtPct(c.price_change_percentage_24h)}</span></div>`;
      }).join('');
    }
  }
}

// Called by init() when CoinGecko markets data arrives
function renderCoins(list) {
  COIN_STORE.top200 = list;
  COIN_LOADED.top200 = true;
  ALL_COINS = list;
  COIN_FILTER = 'top200';
  document.querySelectorAll('.coin-tab').forEach(t => t.classList.remove('on'));
  document.querySelector('[data-filter="top200"]')?.classList.add('on');
  renderCoinTable();
}

function filterCoins(q) { renderCoinTable(); }



// ── RENDER GLOBAL STATS ───────────────────────────────────────────────────────
function renderGlobal(g){
  const d=g.data;
  if(!d)return;
  const mcEl=document.getElementById('cgTotalCap');
  const volEl=document.getElementById('cgVolume');
  const btcDomEl=document.getElementById('btcDom');
  const ethDomEl=document.getElementById('ethDom');
  if(mcEl)mcEl.textContent=fmt(d.total_market_cap?.usd);
  if(volEl)volEl.textContent=fmt(d.total_volume?.usd);
  if(btcDomEl)btcDomEl.textContent=(d.market_cap_percentage?.btc||0).toFixed(1)+'%';
  if(ethDomEl)ethDomEl.textContent=(d.market_cap_percentage?.eth||0).toFixed(1)+'%';
  const mcChgEl=document.getElementById('cgCapChg');
  if(mcChgEl){const c=d.market_cap_change_percentage_24h_usd||0;mcChgEl.textContent=fmtPct(c);mcChgEl.className='cc '+pctClass(c);}
  // Update crypto prices panel header
  const cgCap=document.getElementById('cgTotalCap');
  const cgVol=document.getElementById('cgVolume');
  const cgChg=document.getElementById('cgCapChg');
  const altDom=document.getElementById('altDom');
  if(cgCap)cgCap.textContent=fmt(d.total_market_cap?.usd);
  if(cgVol)cgVol.textContent=fmt(d.total_volume?.usd);
  if(cgChg){const c=d.market_cap_change_percentage_24h_usd||0;cgChg.textContent=fmtPct(c);cgChg.className='phsc '+(c>=0?'up':'dn');}
  if(altDom){
    const btc=d.market_cap_percentage?.btc||0;
    const eth=d.market_cap_percentage?.eth||0;
    altDom.textContent=(100-btc-eth).toFixed(1)+'%';
  }
}

// ── RENDER TRENDING ───────────────────────────────────────────────────────────
function renderTrending(coins){
  const boxes=document.querySelectorAll('.trbox');
  const top3=coins.slice(0,3);
  top3.forEach((c,i)=>{
    if(!boxes[i])return;
    const chg=c.price_change_percentage_24h||0;
    const nmEl=boxes[i].querySelector('.trnm');
    const cEl=boxes[i].querySelector('.trc');
    if(nmEl)nmEl.innerHTML=`${c.name} <span class="trsy">${c.symbol.toUpperCase()}</span>`;
    if(cEl){cEl.textContent=fmtPct(chg);cEl.className='trc '+pctClass(chg);}
  });
}

// ── RENDER FEAR & GREED ───────────────────────────────────────────────────────
function renderFearGreed(data){
  if(!data?.data?.length)return;
  const latest=data.data[0];
  const val=parseInt(latest.value);
  const label=latest.value_classification;
  const col=val>=75?ACCENT:val>=56?ACCENT:val>=45?GOLD:val>=25?ORANGE:RED;

  const fgNum=document.querySelector('.fgn');
  const fgLbl=document.querySelector('.fgl');
  if(fgNum){fgNum.textContent=val;fgNum.style.color=col;}
  if(fgLbl){fgLbl.textContent=label.toUpperCase();fgLbl.style.color=col;}

  // Needle
  const needle=document.querySelector('.fgc line');
  const dot=document.querySelector('.fgc circle');
  if(needle){
    const angle=(val/100)*180-180;
    const rad=angle*Math.PI/180;
    needle.setAttribute('x2',(80+56*Math.cos(rad)).toFixed(1));
    needle.setAttribute('y2',(80+56*Math.sin(rad)).toFixed(1));
    needle.setAttribute('stroke',col);
    if(dot)dot.setAttribute('fill',col);
  }

  // Yesterday/week sub-line
  const subEl=document.querySelector('.fgc .fgsub');
  if(subEl&&data.data[1]&&data.data[6]){
    subEl.textContent=`Yesterday: ${data.data[1].value} · Last Week: ${data.data[6].value}`;
  }

  // History rows
  const rowMap=[{lbl:'Today',idx:0},{lbl:'Yesterday',idx:1},{lbl:'Last Week',idx:6},{lbl:'Last Month',idx:29},{lbl:'3 Months',idx:89}];
  const rows=document.querySelectorAll('.fghr');
  rowMap.forEach(({lbl,idx},i)=>{
    if(!rows[i])return;
    const entry=data.data[Math.min(idx,data.data.length-1)];
    if(!entry)return;
    const v=parseInt(entry.value);
    const c=v>=60?ACCENT:v>=40?GOLD:RED;
    const dEl=rows[i].querySelector('.fghd');
    const fEl=rows[i].querySelector('.fghf');
    const vEl=rows[i].querySelector('.fghv');
    if(dEl)dEl.textContent=lbl;
    if(fEl){fEl.style.width=v+'%';fEl.style.background=c;}
    if(vEl){vEl.textContent=v;vEl.style.color=c;}
  });

  // 30-day chart — redraws when data changes
  const fngEl=document.getElementById('fngChart');
  if(fngEl){
    const h30=data.data.slice(0,30).reverse();
    const fngL=h30.map(d=>new Date(d.timestamp*1000).toLocaleDateString('en',{month:'short',day:'numeric'}));
    const fngV=h30.map(d=>parseInt(d.value));
    const fngC=fngV.map(v=>v>=60?ACCENT:v>=40?GOLD:RED);
    // Check if today's value changed before redrawing
    const todayVal = fngV[fngV.length-1];
    if(fngEl._lastVal !== todayVal){
      fngEl._lastVal = todayVal;
      if(fngEl._chart){ try{fngEl._chart.destroy();}catch(e){} }
      fngEl._chart = new Chart(fngEl,{type:'bar',data:{labels:fngL,datasets:[{label:'Fear & Greed',data:fngV,backgroundColor:fngC,borderRadius:3}]},
        options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{min:0,max:100,grid:{color:'#1c2d38'},ticks:{color:MUTED}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,maxTicksLimit:8,font:{size:8}}}}}});
    }
  }
}
