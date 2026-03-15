(function(){
'use strict';

// ── FINNHUB KEY (free tier — quote only, no candles needed now) ─────────────
// ── COLOURS ─────────────────────────────────────────────────────────────────
const C_FX  = '#f4c542';
const C_CMD = '#ff7c3a';
const C_EQ  = '#a78bfa';
const C_GRN = '#00e87a';
const C_RED = '#ff4560';
const C_MUT = '#4d6475';
const PROXY = 'https://api.allorigins.win/get?url=';

// ── INSTRUMENT TABLE ─────────────────────────────────────────────────────────
// stooq = Stooq symbol | yf = Yahoo Finance symbol | fhq = Finnhub quote (EQ)
const FX_PAIRS = [
  {id:'eurusd',sym:'EUR/USD',name:'Euro / Dollar',   stooq:'eurusd',  yf:'EURUSD=X', dec:5},
  {id:'gbpusd',sym:'GBP/USD',name:'Pound / Dollar',  stooq:'gbpusd',  yf:'GBPUSD=X', dec:5},
  {id:'usdjpy',sym:'USD/JPY',name:'Dollar / Yen',    stooq:'usdjpy',  yf:'USDJPY=X', dec:3},
  {id:'usdchf',sym:'USD/CHF',name:'Dollar / Franc',  stooq:'usdchf',  yf:'USDCHF=X', dec:5},
  {id:'audusd',sym:'AUD/USD',name:'Aussie / Dollar', stooq:'audusd',  yf:'AUDUSD=X', dec:5},
];
const CMD_ASSETS = [
  {id:'gold',  sym:'XAU/USD',name:'Gold',       stooq:'xauusd',  yf:'GC=F',  dec:2},
  {id:'silver',sym:'XAG/USD',name:'Silver',     stooq:'xagusd',  yf:'SI=F',  dec:3},
  {id:'oil',   sym:'WTI Oil',name:'Crude Oil',  stooq:'cl.f',    yf:'CL=F',  dec:2},
  {id:'natgas',sym:'Nat Gas', name:'Nat Gas',   stooq:'ng.f',    yf:'NG=F',  dec:3},
];
const EQ_STOCKS = [
  {id:'aapl',sym:'AAPL',name:'Apple',     stooq:'aapl.us', yf:'AAPL',  fhq:'AAPL', dec:2},
  {id:'msft',sym:'MSFT',name:'Microsoft', stooq:'msft.us', yf:'MSFT',  fhq:'MSFT', dec:2},
  {id:'nvda',sym:'NVDA',name:'NVIDIA',    stooq:'nvda.us', yf:'NVDA',  fhq:'NVDA', dec:2},
  {id:'tsla',sym:'TSLA',name:'Tesla',     stooq:'tsla.us', yf:'TSLA',  fhq:'TSLA', dec:2},
  {id:'spx', sym:'SPY', name:'S&P 500',   stooq:'spy.us',  yf:'SPY',   fhq:'SPY',  dec:2},
];
const ALL_INST = [...FX_PAIRS,...CMD_ASSETS,...EQ_STOCKS];

// ── CACHE ────────────────────────────────────────────────────────────────────
const HIST   = {};
const QUOTE  = {};
const LOADED = {};
const CHARTS = {};
const PRECOMP= {}; // pre-computed data from Railway API
const API_BASE = 'https://chainroot-production-b7d1.up.railway.app';

// ── STOOQ FETCH (fallback only) ──────────────────────────────────────────────
async function fetchStooq(sym, rows=400){
  try{
    const url   = `https://stooq.com/q/d/l/?s=${sym.toLowerCase()}&i=d`;
    const proxy = PROXY + encodeURIComponent(url);
    const r = await fetch(proxy, {signal:AbortSignal.timeout(14000)});
    if(!r.ok) return null;
    const j = await r.json();
    const csv = (j.contents||'').trim();
    if(!csv||csv.includes('Przekroczon')||csv.includes('No data')||csv.length<30) return null;
    const lines = csv.split('\n').slice(1).filter(Boolean);
    const out = [];
    for(const ln of lines){
      const p = ln.split(',');
      const c = parseFloat(p[4]);
      if(!isNaN(c)&&c>0) out.push({date:p[0],open:parseFloat(p[1])||c,high:parseFloat(p[2])||c,low:parseFloat(p[3])||c,close:c,volume:parseFloat(p[5])||0});
    }
    return out.length>=20 ? out.slice(-rows) : null;
  }catch(e){ return null; }
}

// ── YAHOO FINANCE FALLBACK ───────────────────────────────────────────────────
async function fetchYahoo(yfSym, rows=400){
  try{
    const now  = Math.floor(Date.now()/1000);
    const from = now - rows * 86400 * 2;
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&period1=${from}&period2=${now}`;
    const proxy= PROXY + encodeURIComponent(url);
    const r = await fetch(proxy, {signal:AbortSignal.timeout(14000)});
    if(!r.ok) return null;
    const j = await r.json();
    const raw = JSON.parse(j.contents||'{}');
    const res = raw?.chart?.result?.[0];
    if(!res) return null;
    const ts = res.timestamp||[];
    const q  = res.indicators?.quote?.[0]||{};
    const out = [];
    ts.forEach((t,i)=>{
      const c=q.close?.[i];
      if(c!=null&&!isNaN(c)&&c>0)
        out.push({date:new Date(t*1000).toISOString().slice(0,10),open:q.open?.[i]||c,high:q.high?.[i]||c,low:q.low?.[i]||c,close:c,volume:q.volume?.[i]||0});
    });
    return out.length>=20 ? out.slice(-rows) : null;
  }catch(e){ return null; }
}

// ── FINNHUB QUOTE (equities only) ────────────────────────────────────────────
async function fetchFHQuote(sym){
  try{
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FH_KEY}`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok) return null;
    const d = await r.json();
    return (d.c&&d.c>0) ? d : null;
  }catch(e){ return null; }
}

// ── LOAD ONE INSTRUMENT ───────────────────────────────────────────────────────
async function loadInst(inst, force=false){
  if(LOADED[inst.id]&&!force) return;
  LOADED[inst.id]=true;

  // ── PRIMARY: Call your own Railway API server ────────────────────────────
  try{
    const type = FX_PAIRS.find(p=>p.id===inst.id)?'fx':CMD_ASSETS.find(p=>p.id===inst.id)?'cmd':'eq';
    const r = await fetch(`${API_BASE}/api/${type}/${inst.id}`, {signal:AbortSignal.timeout(20000)});
    if(!r.ok) throw new Error('API '+r.status);
    const d = await r.json();
    if(!d||!d.chart||!d.chart.labels||!d.chart.labels.length) throw new Error('Empty data');

    // Store pre-computed indicators so renderDetail can use them directly
    PRECOMP[inst.id] = d;

    // Build HIST array from chart data (needed for indicator recalc fallback)
    HIST[inst.id] = d.chart.labels.map((date,i)=>({
      date,
      open:  d.chart.closes[i]||0,
      high:  d.chart.closes[i]||0,
      low:   d.chart.closes[i]||0,
      close: d.chart.closes[i]||0,
      volume:0
    }));

    // Store live quote
    QUOTE[inst.id] = {c:d.price, pc:d.prev, h:d.high, l:d.low, o:d.open};
    return; // success — skip fallback
  }catch(e){
    console.warn('Railway API failed for', inst.id, '— trying direct fetch fallback:', e.message);
  }

  // ── FALLBACK: Direct Stooq/Yahoo (may fail due to CORS on some browsers) ──
  let rows = await fetchStooq(inst.stooq);
  if(!rows||rows.length<20) rows = await fetchYahoo(inst.yf);
  HIST[inst.id] = rows||[];
  if(inst.fhq&&HIST[inst.id].length){
    const q = await fetchFHQuote(inst.fhq);
    if(q) QUOTE[inst.id]=q;
  }
}

async function loadGroup(group){
  // Fire all in parallel since Railway API is fast
  await Promise.all(group.map(inst => loadInst(inst)));
}

// ── INDICATORS ───────────────────────────────────────────────────────────────
function calcRSI(closes, p=14){
  if(!closes||closes.length<p+1) return null;
  let g=0,l=0;
  for(let i=1;i<=p;i++){const d=closes[i]-closes[i-1];d>0?g+=d:l-=d;}
  let ag=g/p,al=l/p;
  for(let i=p+1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    ag=(ag*(p-1)+(d>0?d:0))/p; al=(al*(p-1)+(d<0?-d:0))/p;
  }
  return al===0?100:+(100-(100/(1+ag/al))).toFixed(2);
}

function calcEMA(closes, p){
  if(!closes||closes.length<p) return [];
  const k=2/(p+1);
  let ema=closes.slice(0,p).reduce((a,b)=>a+b,0)/p;
  const out=new Array(p-1).fill(null);
  out.push(+ema.toFixed(8));
  for(let i=p;i<closes.length;i++){ema=closes[i]*k+ema*(1-k);out.push(+ema.toFixed(8));}
  return out;
}

function calcMACD(closes, fast=12, slow=26, sig=9){
  const ef=calcEMA(closes,fast), es=calcEMA(closes,slow);
  const ml=closes.map((_,i)=>ef[i]!=null&&es[i]!=null?+(ef[i]-es[i]).toFixed(8):null);
  const valid=ml.filter(v=>v!=null);
  const se=calcEMA(valid,sig);
  let sf=new Array(ml.length).fill(null),vi=0;
  for(let i=0;i<ml.length;i++){if(ml[i]!=null)sf[i]=se[vi++];}
  const hist=ml.map((v,i)=>v!=null&&sf[i]!=null?+(v-sf[i]).toFixed(8):null);
  return {macdLine:ml,sigFull:sf,histogram:hist};
}

function calcMA(closes, p){ if(!closes||closes.length<p)return null; return closes.slice(-p).reduce((a,b)=>a+b,0)/p; }

function calcRSISeries(closes, p=14){
  const out=new Array(p).fill(null);
  for(let i=p;i<closes.length;i++) out.push(calcRSI(closes.slice(0,i+1),p));
  return out;
}

function maSig(price,ma){ return !ma?'neut':price>ma?'bull':'bear'; }
function overallSig(rsi,price,ma20,ma50,ma200,macdVal){
  let s=0;
  if(rsi!=null){if(rsi<35)s+=2;else if(rsi>65)s-=2;}
  if(ma20)price>ma20?s++:s--;
  if(ma50)price>ma50?s++:s--;
  if(ma200)price>ma200?s++:s--;
  if(macdVal!=null){macdVal>0?s++:s--;}
  return s>=2?'bull':s<=-2?'bear':'neut';
}

// ── FORMATTING ───────────────────────────────────────────────────────────────
function fmtP(v,dec=4){
  if(v==null||isNaN(v))return'—';
  if(Math.abs(v)>=1000)return v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return Number(v).toFixed(dec);
}
function fmtPct(v){if(v==null||isNaN(v))return'—';return(v>=0?'+':'')+Number(v).toFixed(2)+'%';}
function chgCol(v){return v>=0?C_GRN:C_RED;}

// ── CHART HELPERS ─────────────────────────────────────────────────────────────
function killChart(id){if(CHARTS[id]){try{CHARTS[id].destroy();}catch(_){}delete CHARTS[id];}}
const MONO={family:'Space Mono',size:9};
const MONO11={family:'Space Mono',size:11};

function drawPrice(canvasId, labels, prices, color, ma20s, ma50s, ma200s){
  // Use TradingView Lightweight Charts for professional candlestick-style display
  killChart(canvasId);
  const container = document.getElementById(canvasId);
  if (!container) return;

  // Clear container and set up for TV chart
  container.innerHTML = '';
  container.style.position = 'relative';

  if (typeof LightweightCharts === 'undefined') {
    // Fallback to Chart.js line chart if LW not loaded
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    CHARTS[canvasId] = new Chart(canvas, {
      type:'line',
      data:{labels, datasets:[
        {label:'Price', data:prices, borderColor:color, backgroundColor:color+'18', fill:true, tension:0.25, pointRadius:0, borderWidth:2},
        {label:'MA20',  data:ma20s,  borderColor:'#00e87a', backgroundColor:'transparent', fill:false, tension:0.25, pointRadius:0, borderWidth:1.3, borderDash:[4,3]},
        {label:'MA50',  data:ma50s,  borderColor:'#00b4d8', backgroundColor:'transparent', fill:false, tension:0.25, pointRadius:0, borderWidth:1.3, borderDash:[6,4]},
        {label:'MA200', data:ma200s, borderColor:'#ff4560', backgroundColor:'transparent', fill:false, tension:0.25, pointRadius:0, borderWidth:1.6, borderDash:[8,4]},
      ]},
      options:{responsive:true, maintainAspectRatio:false, animation:{duration:0},
        plugins:{legend:{display:true, labels:{color:'#4d6475', font:{family:'Space Mono',size:9}, boxWidth:12}}},
        scales:{x:{grid:{color:'rgba(28,45,56,.4)'}, ticks:{color:'#4d6475', font:{family:'Space Mono',size:9}, maxTicksLimit:9}},
                y:{grid:{color:'rgba(28,45,56,.4)'}, ticks:{color:'#4d6475', font:{family:'Space Mono',size:9}}}}}
    });
    return;
  }

  // TradingView Lightweight Charts
  const chart = LightweightCharts.createChart(container, {
    width:  container.offsetWidth || 800,
    height: 268,
    layout: { background:{color:'transparent'}, textColor:'#4d6475' },
    grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor:'#1c2d38', textColor:'#4d6475' },
    timeScale: { borderColor:'#1c2d38', timeVisible:true, fixLeftEdge:true, fixRightEdge:true },
    handleScroll:  { mouseWheel:true, pressedMouseMove:true },
    handleScale:   { mouseWheel:true, pinch:true },
  });

  // Area series for price
  const areaSeries = chart.addAreaSeries({
    lineColor:     color,
    topColor:      color + '30',
    bottomColor:   color + '00',
    lineWidth:     2,
    priceLineVisible: true,
    lastValueVisible: true,
    crosshairMarkerVisible: true,
  });

  // Convert labels+prices to TV format {time, value}
  const tvData = labels.map((lbl, i) => ({
    time:  lbl.replace(/\//g,'-'),
    value: prices[i]
  })).filter(d => d.value != null);
  areaSeries.setData(tvData);

  // MA20 line
  if (ma20s && ma20s.some(v=>v!=null)) {
    const ma20Series = chart.addLineSeries({ color:'#00e87a', lineWidth:1, lineStyle:LightweightCharts.LineStyle.Dashed, lastValueVisible:false, priceLineVisible:false });
    ma20Series.setData(labels.map((lbl,i)=>({time:lbl.replace(/\//g,'-'),value:ma20s[i]})).filter(d=>d.value!=null));
  }
  // MA50 line
  if (ma50s && ma50s.some(v=>v!=null)) {
    const ma50Series = chart.addLineSeries({ color:'#00b4d8', lineWidth:1, lineStyle:LightweightCharts.LineStyle.Dashed, lastValueVisible:false, priceLineVisible:false });
    ma50Series.setData(labels.map((lbl,i)=>({time:lbl.replace(/\//g,'-'),value:ma50s[i]})).filter(d=>d.value!=null));
  }
  // MA200 line
  if (ma200s && ma200s.some(v=>v!=null)) {
    const ma200Series = chart.addLineSeries({ color:'#ff4560', lineWidth:1.5, lineStyle:LightweightCharts.LineStyle.Dashed, lastValueVisible:false, priceLineVisible:false });
    ma200Series.setData(labels.map((lbl,i)=>({time:lbl.replace(/\//g,'-'),value:ma200s[i]})).filter(d=>d.value!=null));
  }

  chart.timeScale().fitContent();

  // Legend overlay
  const legend = document.createElement('div');
  legend.style.cssText = 'position:absolute;top:8px;left:10px;display:flex;gap:12px;font-family:"Space Mono",monospace;font-size:9px;color:#4d6475;pointer-events:none;z-index:10;flex-wrap:wrap';
  legend.innerHTML = `
    <span style="color:${color}">── Price</span>
    <span style="color:#00e87a">- - MA20</span>
    <span style="color:#00b4d8">- - MA50</span>
    <span style="color:#ff4560">- - MA200</span>
  `;
  container.appendChild(legend);

  // Store reference for cleanup
  CHARTS[canvasId] = { destroy: () => { chart.remove(); container.innerHTML=''; } };

  // Resize observer
  const ro = new ResizeObserver(() => { chart.applyOptions({ width: container.offsetWidth }); });
  ro.observe(container);
}

function drawRSI(canvasId,labels,rsiArr){
  killChart(canvasId);
  const ctx=document.getElementById(canvasId);if(!ctx)return;
  CHARTS[canvasId]=new Chart(ctx,{type:'line',data:{labels,datasets:[
    {label:'RSI-14',data:rsiArr,borderColor:'#00b4d8',backgroundColor:'rgba(0,180,216,.07)',fill:true,tension:0.3,pointRadius:0,borderWidth:1.8},
    {label:'OB 70', data:rsiArr.map(()=>70),borderColor:'rgba(255,69,96,.3)',backgroundColor:'transparent',fill:false,tension:0,pointRadius:0,borderWidth:1,borderDash:[4,3]},
    {label:'OS 30', data:rsiArr.map(()=>30),borderColor:'rgba(0,232,122,.3)',backgroundColor:'transparent',fill:false,tension:0,pointRadius:0,borderWidth:1,borderDash:[4,3]},
  ]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#162028',borderColor:'#243844',borderWidth:1,titleFont:MONO,bodyFont:MONO11}},
    scales:{x:{grid:{color:'rgba(28,45,56,.3)'},ticks:{color:C_MUT,font:MONO,maxTicksLimit:7}},y:{min:0,max:100,grid:{color:'rgba(28,45,56,.3)'},ticks:{color:C_MUT,font:MONO,stepSize:25}}}}});
}

function drawMACD(canvasId,labels,ml,sf,hist){
  killChart(canvasId);
  const ctx=document.getElementById(canvasId);if(!ctx)return;
  const bc=hist.map(v=>v==null?'transparent':v>=0?'rgba(0,232,122,.55)':'rgba(255,69,96,.55)');
  CHARTS[canvasId]=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'MACD',    type:'line',data:ml,  borderColor:'#00b4d8',backgroundColor:'transparent',fill:false,tension:0.3,pointRadius:0,borderWidth:1.6},
    {label:'Signal',  type:'line',data:sf,  borderColor:'#f4c542',backgroundColor:'transparent',fill:false,tension:0.3,pointRadius:0,borderWidth:1.3,borderDash:[4,3]},
    {label:'Hist',    type:'bar', data:hist,backgroundColor:bc},
  ]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:true,labels:{color:C_MUT,font:MONO,boxWidth:12,padding:10}},tooltip:{backgroundColor:'#162028',borderColor:'#243844',borderWidth:1,titleFont:MONO,bodyFont:MONO11}},
    scales:{x:{grid:{color:'rgba(28,45,56,.3)'},ticks:{color:C_MUT,font:MONO,maxTicksLimit:8}},y:{grid:{color:'rgba(28,45,56,.3)'},ticks:{color:C_MUT,font:MONO}}}}});
}

// ── RSI GAUGE HTML ───────────────────────────────────────────────────────────
function rsiHTML(rsi){
  if(rsi==null)return`<div style="color:${C_MUT};font-family:'Space Mono',monospace;font-size:11px;padding:10px">Need 15+ bars for RSI</div>`;
  const col=rsi>70?C_RED:rsi<30?C_GRN:'#f4c542';
  const lbl=rsi>70?'OVERBOUGHT':rsi<30?'OVERSOLD':'NEUTRAL';
  const pct=Math.max(0,Math.min(100,rsi));
  return`<div class="rsi-gauge-row">
    <div><div class="rsi-big" style="color:${col}">${rsi.toFixed(1)}</div><div class="rsi-label" style="color:${col}">${lbl}</div><div style="font-family:'Space Mono',monospace;font-size:8px;color:${C_MUT};margin-top:4px">RSI · 14-period</div></div>
    <div class="rsi-slider-wrap">
      <div class="rsi-zone-list">
        <div class="rsi-zone-row"><span style="color:${C_MUT}">Overbought</span><span style="color:${C_RED}">&gt;70</span></div>
        <div class="rsi-zone-row"><span style="color:${C_MUT}">Neutral</span><span style="color:#f4c542">30–70</span></div>
        <div class="rsi-zone-row"><span style="color:${C_MUT}">Oversold</span><span style="color:${C_GRN}">&lt;30</span></div>
      </div>
      <div class="rsi-slider-track"><div class="rsi-slider-dot" style="left:${pct}%;color:${col}"></div></div>
      <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:9px;color:${C_MUT}"><span>0</span><span>30</span><span>50</span><span>70</span><span>100</span></div>
    </div>
  </div>`;
}

// ── MACD SUMMARY HTML ────────────────────────────────────────────────────────
function macdSummaryHTML(macd){
  if(!macd)return'';
  // Accepts both flat {line,signal,histogram} from API and array format {macdLine,sigFull,histogram}
  let line, sig, hist;
  if(macd.macdLine){
    const n=macd.macdLine.length-1;
    line=macd.macdLine[n]; sig=macd.sigFull?.[n]; hist=macd.histogram?.[n];
  } else {
    line=macd.line; sig=macd.signal; hist=macd.histogram;
  }
  if(line==null)return'';
  const bull=sig!=null?line>sig:line>0, col=bull?C_GRN:C_RED;
  return`<div style="display:flex;align-items:center;gap:16px;background:var(--bg3);border-radius:6px;padding:14px 16px;flex-wrap:wrap;margin-bottom:12px">
    <div><div style="font-family:'Space Mono',monospace;font-size:8px;color:${C_MUT};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">MACD</div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${col}">${line.toFixed(5)}</div></div>
    <div><div style="font-family:'Space Mono',monospace;font-size:8px;color:${C_MUT};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Signal</div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#f4c542">${sig!=null?sig.toFixed(5):'—'}</div></div>
    <div><div style="font-family:'Space Mono',monospace;font-size:8px;color:${C_MUT};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Histogram</div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${hist!=null?hist>=0?C_GRN:C_RED:C_MUT}">${hist!=null?hist.toFixed(5):'—'}</div></div>
    <div style="margin-left:auto"><div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${col};background:${col}18;border:1px solid ${col}44;padding:5px 12px;border-radius:4px">${bull?'▲ BULLISH':'▼ BEARISH'} MOMENTUM</div></div>
  </div>`;
}

function maBadge(sig){return`<span class="ma-badge ma-${sig}">${sig==='bull'?'↑ BULL':sig==='bear'?'↓ BEAR':'— NEUT'}</span>`;}

// ── DETAIL PANEL ─────────────────────────────────────────────────────────────
function renderDetail(bodyId,inst,color){
  const el=document.getElementById(bodyId);if(!el)return;
  const data=HIST[inst.id]||[], quote=QUOTE[inst.id];
  const pre=PRECOMP[inst.id]; // pre-computed from Railway API

  if(!data.length && !pre){
    el.innerHTML=`<div class="mkt-loading" style="flex-direction:column;gap:14px;padding:60px 20px">
      <div style="color:${C_RED};font-family:'Space Mono',monospace;font-size:12px;text-align:center">⚠ Could not load ${inst.sym}</div>
      <div style="font-family:'Space Mono',monospace;font-size:10px;color:${C_MUT};text-align:center;line-height:1.9">API server returned empty data.<br>Try refreshing — data is cached for 1 hour.</div>
      <button onclick="mktRefresh('${inst.id}')" style="background:rgba(0,232,122,.1);border:1px solid rgba(0,232,122,.3);color:var(--accent);padding:9px 24px;border-radius:5px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;margin:0 auto">↻ Retry</button>
    </div>`;return;
  }

  // Use pre-computed values from Railway API if available, otherwise calculate locally
  const price  = pre ? pre.price  : (quote?.c||data[data.length-1]?.close||0);
  const prev   = pre ? pre.prev   : (data[data.length-2]?.close||price);
  const chg    = pre ? pre.change : ((price-prev)/prev)*100;
  const rsi    = pre ? pre.rsi    : calcRSI(data.map(d=>d.close),14);
  const ma20   = pre ? pre.ma20   : calcMA(data.map(d=>d.close),20);
  const ma50   = pre ? pre.ma50   : calcMA(data.map(d=>d.close),50);
  const ma200  = pre ? pre.ma200  : calcMA(data.map(d=>d.close),200);
  const lMacd  = pre ? pre.macd?.line : null;
  const sig    = pre ? pre.signal : overallSig(rsi,price,ma20,ma50,ma200,lMacd);
  const sigCol = sig==='bull'?C_GRN:sig==='bear'?C_RED:'#f4c542';
  const dec    = inst.dec||4;
  const h24    = pre ? pre.high   : (quote?.h||price);
  const l24    = pre ? pre.low    : (quote?.l||price);
  const o24    = pre ? pre.open   : (quote?.o||prev);

  // Chart series — use from API if available, otherwise calculate
  const cLabels  = pre ? pre.chart.labels   : data.map(d=>d.date).slice(-252);
  const cCloses  = pre ? pre.chart.closes   : data.map(d=>d.close).slice(-252);
  const ma20s    = pre ? pre.chart.ma20s    : cCloses.map((_,i)=>{const s=cCloses.slice(0,i+1);return s.length>=20?+calcMA(s,20).toFixed(dec+1):null;});
  const ma50s    = pre ? pre.chart.ma50s    : cCloses.map((_,i)=>{const s=cCloses.slice(0,i+1);return s.length>=50?+calcMA(s,50).toFixed(dec+1):null;});
  const ma200s   = pre ? pre.chart.ma200s   : cCloses.map((_,i)=>{const s=cCloses.slice(0,i+1);return s.length>=200?+calcMA(s,200).toFixed(dec+1):null;});
  const rsiSeries= pre ? pre.chart.rsiSeries: calcRSISeries(cCloses,14);
  const macdLine = pre ? pre.chart.macdLine  : calcMACD(cCloses).macdLine;
  const sigLine  = pre ? pre.chart.signalLine: calcMACD(cCloses).sigFull;
  const histogram= pre ? pre.chart.histogram : calcMACD(cCloses).histogram;
  const macdLast = pre ? pre.macd : {line:lMacd, signal:null, histogram:null};

  const pC=bodyId+'-pc',rC=bodyId+'-rc',mC=bodyId+'-mc';
  const srcLabel = pre ? `DeFiMongo API · ${pre.candles} days` : `Stooq · ${data.length} days`;

  el.innerHTML=`
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap">
    <span class="data-badge" style="background:rgba(0,232,122,.08);color:var(--accent);border:1px solid rgba(0,232,122,.2);font-family:'Space Mono',monospace;font-size:8px;padding:3px 8px;border-radius:3px">● ${srcLabel}</span>
    <span style="font-family:'Space Mono',monospace;font-size:9px;color:${C_MUT}">Stooq + Yahoo Finance · Daily OHLC · Cached 1hr</span>
    <button onclick="mktRefresh('${inst.id}')" style="margin-left:auto;background:var(--bg3);border:1px solid var(--border2);color:${C_MUT};padding:5px 13px;border-radius:4px;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;letter-spacing:1px" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='${C_MUT}'">↻ REFRESH</button>
  </div>
  <div class="mkt-cards" style="margin-bottom:22px">
    <div class="mkt-card" style="border-color:${chg>=0?'rgba(0,232,122,.2)':'rgba(255,69,96,.2)'}">
      <div class="mkt-card-sym" style="color:${color}">${inst.sym}</div>
      <div class="mkt-card-price">${fmtP(price,dec)}</div>
      <div class="mkt-card-chg" style="color:${chgCol(chg)}">${fmtPct(chg)} <span style="color:${C_MUT};font-size:9px">vs prev</span></div>
    </div>
    <div class="mkt-card">
      <div class="mkt-card-sym" style="color:${color}">Range</div>
      <div class="mkt-card-price" style="font-size:13px">${fmtP(l24,dec)} – ${fmtP(h24,dec)}</div>
      <div class="mkt-card-sub">Open: ${fmtP(o24,dec)}</div>
    </div>
    <div class="mkt-card">
      <div class="mkt-card-sym" style="color:${color}">RSI-14</div>
      <div class="mkt-card-price" style="color:${rsi>70?C_RED:rsi<30?C_GRN:'#f4c542'}">${rsi!=null?rsi.toFixed(1):'—'}</div>
      <div class="mkt-card-chg" style="color:${C_MUT}">${rsi>70?'OVERBOUGHT':rsi<30?'OVERSOLD':'NEUTRAL'}</div>
    </div>
    <div class="mkt-card">
      <div class="mkt-card-sym" style="color:${color}">MACD</div>
      <div class="mkt-card-price" style="font-size:13px;color:${lMacd!=null?lMacd>0?C_GRN:C_RED:C_MUT}">${lMacd!=null?lMacd.toFixed(4):'—'}</div>
      <div class="mkt-card-chg" style="color:${C_MUT}">${lMacd!=null?lMacd>0?'▲ Bull':'▼ Bear':'—'} momentum</div>
    </div>
    <div class="mkt-card">
      <div class="mkt-card-sym" style="color:${color}">MA 20/50</div>
      <div class="mkt-card-price" style="font-size:12px">${ma20?fmtP(ma20,dec):'—'} / ${ma50?fmtP(ma50,dec):'—'}</div>
      <div class="mkt-card-chg" style="color:${chgCol(price-(ma20||price))}">${ma20?(price>ma20?'↑ Above MA20':'↓ Below MA20'):'—'}</div>
    </div>
    <div class="mkt-card" style="border-color:${sigCol}">
      <div class="mkt-card-sym" style="color:${color}">Signal</div>
      <div class="mkt-card-price" style="color:${sigCol}">${sig==='bull'?'BULLISH':sig==='bear'?'BEARISH':'NEUTRAL'}</div>
      <div class="mkt-card-chg" style="color:${C_MUT}">RSI + MA + MACD</div>
    </div>
  </div>
  <div class="mkt-box">
    <div class="mkt-box-title">${inst.name} — ${cLabels.length} Days · Price + MA Overlay · <span style="color:var(--accent);font-size:9px">TradingView Charts</span></div>
    <div class="mkt-chart-wrap" style="height:268px"><div id="${pC}" style="width:100%;height:100%"></div></div>
  </div>
  <div class="mkt-box">
    <div class="mkt-box-title">RSI-14 — Relative Strength Index</div>
    ${rsiHTML(rsi)}
    <div class="mkt-chart-wrap" style="height:150px;margin-top:12px"><canvas id="${rC}"></canvas></div>
  </div>
  <div class="mkt-box">
    <div class="mkt-box-title">MACD (12, 26, 9) — Momentum Oscillator</div>
    ${macdSummaryHTML(macdLast)}
    <div class="mkt-chart-wrap" style="height:160px"><canvas id="${mC}"></canvas></div>
  </div>
  <div class="mkt-box">
    <div class="mkt-box-title">Moving Average Table</div>
    <table class="ma-table"><thead><tr><th>Period</th><th>Value</th><th>% vs Price</th><th>Signal</th></tr></thead>
    <tbody>
      <tr><td>MA 20</td><td>${ma20?fmtP(ma20,dec):'—'}</td><td style="color:${chgCol(price-(ma20||price))}">${ma20?fmtPct(((price-ma20)/ma20)*100):'—'}</td><td>${maBadge(maSig(price,ma20))}</td></tr>
      <tr><td>MA 50</td><td>${ma50?fmtP(ma50,dec):'—'}</td><td style="color:${chgCol(price-(ma50||price))}">${ma50?fmtPct(((price-ma50)/ma50)*100):'—'}</td><td>${maBadge(maSig(price,ma50))}</td></tr>
      <tr><td>MA 200</td><td>${ma200?fmtP(ma200,dec):'—'}</td><td style="color:${chgCol(price-(ma200||price))}">${ma200?fmtPct(((price-ma200)/ma200)*100):'—'}</td><td>${maBadge(maSig(price,ma200))}</td></tr>
    </tbody></table>
  </div>`;
  requestAnimationFrame(()=>{
    drawPrice(pC,cLabels,cCloses,color,ma20s,ma50s,ma200s);
    drawRSI(rC,cLabels,rsiSeries);
    drawMACD(mC,cLabels,macdLine,sigLine,histogram);
  });
}

// ── OVERVIEW PANEL ───────────────────────────────────────────────────────────
function renderOverview(cardsId,rsiId,maId,sigId,group,color){
  const cEl=document.getElementById(cardsId),rEl=document.getElementById(rsiId),mEl=document.getElementById(maId),sEl=document.getElementById(sigId);
  if(!cEl||!rEl||!mEl||!sEl)return;
  let cH='',rH='',mH='',sH='';
  group.forEach(inst=>{
    const pre=PRECOMP[inst.id];
    const data=HIST[inst.id]||[],q=QUOTE[inst.id];
    if(!pre&&!data.length){
      cH+=`<div class="mkt-card"><div class="mkt-card-sym" style="color:${color}">${inst.sym}</div><div style="font-family:'Space Mono',monospace;font-size:10px;color:${C_MUT};margin-top:8px">No data</div></div>`;return;
    }
    // Use pre-computed from API or calculate locally
    const price = pre?pre.price:(q?.c||data[data.length-1]?.close||0);
    const prev  = pre?pre.prev:(data[data.length-2]?.close||price);
    const chg   = pre?pre.change:((price-prev)/prev)*100;
    const rsi   = pre?pre.rsi:calcRSI(data.map(d=>d.close),14);
    const ma20  = pre?pre.ma20:calcMA(data.map(d=>d.close),20);
    const ma50  = pre?pre.ma50:calcMA(data.map(d=>d.close),50);
    const ma200 = pre?pre.ma200:calcMA(data.map(d=>d.close),200);
    const lm    = pre?pre.macd?.line:null;
    const sig   = pre?pre.signal:overallSig(rsi,price,ma20,ma50,ma200,lm);
    const dec   = inst.dec||4;
    cH+=`<div class="mkt-card"><div class="mkt-card-sym" style="color:${color}">${inst.sym}</div><div class="mkt-card-price">${fmtP(price,dec)}</div><div class="mkt-card-chg" style="color:${chgCol(chg)}">${fmtPct(chg)}</div></div>`;
    sH+=`<div class="sig-pill sig-${sig}">${sig==='bull'?'↑':sig==='bear'?'↓':'→'} ${inst.sym}</div>`;
    rH+=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <span style="font-family:'Space Mono',monospace;font-size:11px;width:74px;color:${color};flex-shrink:0">${inst.sym}</span>
      <div style="flex:1;height:4px;border-radius:2px;background:var(--bg3)"><div style="height:100%;border-radius:2px;width:${Math.max(0,Math.min(100,rsi||50))}%;background:${rsi>70?C_RED:rsi<30?C_GRN:'#f4c542'};transition:width .4s"></div></div>
      <span style="font-family:'Space Mono',monospace;font-size:11px;width:44px;text-align:right;color:${rsi>70?C_RED:rsi<30?C_GRN:'#f4c542'}">${rsi!=null?rsi.toFixed(1):'—'}</span>
    </div>`;
    mH+=`<tr><td>${inst.sym}</td><td style="color:${chgCol(price-(ma20||price))}">${ma20?fmtP(ma20,dec):'—'}</td><td style="color:${chgCol(price-(ma50||price))}">${ma50?fmtP(ma50,dec):'—'}</td><td style="color:${chgCol(price-(ma200||price))}">${ma200?fmtP(ma200,dec):'—'}</td><td>${maBadge(sig)}</td></tr>`;
  });
  cEl.innerHTML=cH||`<div style="color:${C_RED};font-family:'Space Mono',monospace;font-size:11px;padding:20px">No data — check connection</div>`;
  rEl.innerHTML=rH; mEl.innerHTML=mH; sEl.innerHTML=sH;
}

// ── REFRESH ───────────────────────────────────────────────────────────────────
async function mktRefresh(id){
  const inst=ALL_INST.find(i=>i.id===id);if(!inst)return;
  delete LOADED[id];delete HIST[id];delete QUOTE[id];delete PRECOMP[id];
  const g=FX_PAIRS.find(p=>p.id===id)?'fx':CMD_ASSETS.find(p=>p.id===id)?'cmd':'eq';
  const bId=`${g}-${id}-body`,el=document.getElementById(bId);
  if(el)el.innerHTML=`<div class="mkt-loading"><div class="mkt-spinner"></div>Refreshing ${inst.sym}…</div>`;
  await loadInst(inst,true);
  renderDetail(bId,inst,g==='fx'?C_FX:g==='cmd'?C_CMD:C_EQ);
}
window.mktRefresh=mktRefresh;
window.setCoinFilter=setCoinFilter;
window.loadMoreCoins=loadMoreCoins;
window.filterCoins=filterCoins;

// ── PANEL OPEN HANDLER ───────────────────────────────────────────────────────
async function openMkt(type,id){
  const group=type==='fx'?FX_PAIRS:type==='cmd'?CMD_ASSETS:EQ_STOCKS;
  const color=type==='fx'?C_FX:type==='cmd'?C_CMD:C_EQ;
  if(id==='overview'){
    const cEl=document.getElementById(`${type}-ov-cards`);
    if(cEl&&!group.some(i=>PRECOMP[i.id]||HIST[i.id]?.length))
      cEl.innerHTML=`<div class="mkt-loading"><div class="mkt-spinner"></div>Fetching from DeFiMongo API…</div>`;
    await loadGroup(group);
    renderOverview(`${type}-ov-cards`,`${type}-ov-rsi`,`${type}-ov-ma`,`${type}-ov-sigs`,group,color);
  } else {
    const inst=group.find(p=>p.id===id);if(!inst)return;
    const bId=`${type}-${id}-body`,el=document.getElementById(bId);

    // ── If we already have data cached, render INSTANTLY — no loading wait ──
    if(PRECOMP[inst.id]||HIST[inst.id]?.length){
      renderDetail(bId,inst,color);
      return; // done — instant render from cache
    }

    // ── First time loading this instrument ──
    if(el) el.innerHTML=`<div class="mkt-loading"><div class="mkt-spinner"></div>
      <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);margin-top:12px;letter-spacing:1.5px">
        Fetching ${inst.sym} from DeFiMongo API…
      </div>
    </div>`;
    await loadInst(inst);
    renderDetail(bId,inst,color);
  }
}

// ── HOOK INTO go() ───────────────────────────────────────────────────────────
(function(){
  const _o=window.go;
  window.go=function(id,el){
    if(_o)_o(id,el);
    if(id.startsWith('fx-'))       openMkt('fx', id.slice(3));
    else if(id.startsWith('cmd-')) openMkt('cmd',id.slice(4));
    else if(id.startsWith('eq-'))  openMkt('eq', id.slice(3));
  };
})();

// ── BACKGROUND PREFETCH — silently loads all instruments after page load ─────
// This means by the time user clicks any pair, data is already cached → instant
(function prefetchAll(){
  // Wait 3 seconds after page load so crypto data loads first
  setTimeout(async ()=>{
    const groups = [
      {type:'fx',  list:FX_PAIRS},
      {type:'cmd', list:CMD_ASSETS},
      {type:'eq',  list:EQ_STOCKS},
    ];
    for(const {list} of groups){
      for(const inst of list){
        if(!PRECOMP[inst.id]&&!LOADED[inst.id]){
          loadInst(inst).catch(()=>{}); // fire and forget
          await new Promise(r=>setTimeout(r,400)); // stagger 400ms each
        }
      }
    }
  }, 3000);
})();

})(); // end IIFE
