/* ── TRAINING PAGE ──────────────────────────────────────── */
function openTrainingPage() {
  document.getElementById('trainingOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  setTimeout(startIndicatorDemo, 300);
}
function closeTrainingPage() {
  document.getElementById('trainingOverlay').classList.remove('on');
  document.body.style.overflow = '';
  stopIndicatorDemo();
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeTrainingPage();
});

// ── ANIMATED INDICATOR DEMO ───────────────────────────────
// Matches real indicator: Precision v6
// Blue MA (fast) + Red MA (slow) + green/red fill + STRONG BUY/SELL labels
// Pink dots (top warnings) + Yellow dots (bottom warnings) + small green/red dots

var _demoInterval = null;

// Generate realistic BTC-like price data
var DEMO_DATA = (function() {
  var seed = 42;
  function rand() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
  var prices = [
    67200,66800,66400,65800,64900,64200,63800,64500,65200,65800,
    66400,67100,68200,69400,70800,72100,73500,73800,73200,72400,
    71600,70800,70100,69600,68900,68400,68100,68600,69200,69800,
    70400,71200,72000,72600,73100,72800,72200,71500,70800,70200,
    69800,70100,70600,71200,71800,72400,73000,73500,74000,74500
  ];
  var candles = [];
  for (var i = 0; i < prices.length; i++) {
    var base = prices[i];
    var range = base * 0.008;
    var open  = i > 0 ? prices[i-1] : base * (1 + (rand()-0.5)*0.003);
    var close = base * (1 + (rand()-0.5)*0.003);
    var high  = Math.max(open, close) + rand() * range;
    var low   = Math.min(open, close) - rand() * range * 0.8;
    candles.push({o:open, c:close, h:high, l:low});
  }
  return candles;
})();

// Compute simple MA
function computeMA(candles, period) {
  var result = [];
  for (var i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) sum += candles[j].c;
    result.push(sum / period);
  }
  return result;
}

var MA_FAST = computeMA(DEMO_DATA, 8);   // Blue — fast
var MA_SLOW = computeMA(DEMO_DATA, 18);  // Red — slow

// Signal definitions matching real indicator
// type: 'STRONG_BUY' | 'STRONG_SELL' | 'dot_pink' | 'dot_yellow' | 'dot_green' | 'dot_red'
var INDICATOR_SIGNALS = [
  {idx:4,  type:'dot_yellow'},
  {idx:6,  type:'STRONG_BUY'},
  {idx:7,  type:'dot_green'},
  {idx:8,  type:'dot_green'},
  {idx:10, type:'dot_pink'},
  {idx:13, type:'dot_pink'},
  {idx:16, type:'dot_pink'},
  {idx:19, type:'STRONG_SELL'},
  {idx:22, type:'dot_yellow'},
  {idx:25, type:'dot_yellow'},
  {idx:28, type:'dot_green'},
  {idx:30, type:'STRONG_BUY'},
  {idx:33, type:'dot_pink'},
  {idx:36, type:'STRONG_SELL'},
  {idx:39, type:'dot_yellow'},
  {idx:42, type:'STRONG_BUY'},
  {idx:45, type:'dot_green'},
  {idx:47, type:'dot_yellow'},
];

function startIndicatorDemo() {
  var canvas = document.getElementById('indicatorDemoCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var feed = document.getElementById('indicatorSignalFeed');

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var W = rect.width, H = rect.height;

  var visibleCount = 22;
  var offset = 0;

  // Color constants matching real indicator
  var C_BG      = '#0a0e13';
  var C_BLUE_MA = '#3b82f6';
  var C_RED_MA  = '#ef4444';
  var C_GREEN   = '#00e87a';
  var C_RED     = '#ff4560';
  var C_BULL    = 'rgba(0,232,122,0.18)';
  var C_BEAR    = 'rgba(180,0,40,0.22)';
  var C_MUTED   = '#4d6475';
  var C_TEXT    = '#ccd8df';

  function priceToY(price, minP, maxP) {
    var pad = 28;
    return H - pad - ((price - minP) / (maxP - minP)) * (H - pad * 2);
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    var start = Math.min(offset, DEMO_DATA.length - visibleCount);
    var end   = start + visibleCount;
    var slice = DEMO_DATA.slice(start, end);
    var maFastSlice = MA_FAST.slice(start, end);
    var maSlowSlice = MA_SLOW.slice(start, end);

    // Price range
    var minP = Math.min.apply(null, slice.map(function(c){return c.l;})) * 0.997;
    var maxP = Math.max.apply(null, slice.map(function(c){return c.h;})) * 1.003;

    var cw   = (W - 48) / visibleCount;
    var xOff = 24;

    // Grid
    ctx.strokeStyle = 'rgba(28,45,56,0.5)';
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 4; g++) {
      var gy = 24 + g * (H - 48) / 4;
      ctx.beginPath(); ctx.moveTo(xOff, gy); ctx.lineTo(W - xOff, gy); ctx.stroke();
      var gPrice = maxP - g * (maxP - minP) / 4;
      ctx.font = '9px "Space Mono", monospace';
      ctx.fillStyle = C_MUTED;
      ctx.textAlign = 'right';
      ctx.fillText('$' + Math.round(gPrice / 100) * 100, W - 2, gy + 3);
    }
    ctx.textAlign = 'left';

    // Build MA point arrays for drawing
    var fastPts = [], slowPts = [];
    for (var i = 0; i < slice.length; i++) {
      var px = xOff + i * cw + cw / 2;
      if (maFastSlice[i] !== null) fastPts.push({x: px, y: priceToY(maFastSlice[i], minP, maxP)});
      else fastPts.push(null);
      if (maSlowSlice[i] !== null) slowPts.push({x: px, y: priceToY(maSlowSlice[i], minP, maxP)});
      else slowPts.push(null);
    }

    // Fill between MAs (green when fast > slow, red when fast < slow)
    // Draw filled region
    for (var i = 0; i < slice.length - 1; i++) {
      if (!fastPts[i] || !slowPts[i] || !fastPts[i+1] || !slowPts[i+1]) continue;
      var bullish = maFastSlice[i] >= maSlowSlice[i];
      ctx.beginPath();
      ctx.moveTo(fastPts[i].x, fastPts[i].y);
      ctx.lineTo(fastPts[i+1].x, fastPts[i+1].y);
      ctx.lineTo(slowPts[i+1].x, slowPts[i+1].y);
      ctx.lineTo(slowPts[i].x, slowPts[i].y);
      ctx.closePath();
      ctx.fillStyle = bullish ? C_BULL : C_BEAR;
      ctx.fill();
    }

    // Draw slow MA (red)
    ctx.beginPath();
    ctx.strokeStyle = C_RED_MA;
    ctx.lineWidth = 1.5;
    var started = false;
    for (var i = 0; i < slowPts.length; i++) {
      if (!slowPts[i]) { started = false; continue; }
      if (!started) { ctx.moveTo(slowPts[i].x, slowPts[i].y); started = true; }
      else ctx.lineTo(slowPts[i].x, slowPts[i].y);
    }
    ctx.stroke();

    // Draw fast MA (blue)
    ctx.beginPath();
    ctx.strokeStyle = C_BLUE_MA;
    ctx.lineWidth = 1.8;
    started = false;
    for (var i = 0; i < fastPts.length; i++) {
      if (!fastPts[i]) { started = false; continue; }
      if (!started) { ctx.moveTo(fastPts[i].x, fastPts[i].y); started = true; }
      else ctx.lineTo(fastPts[i].x, fastPts[i].y);
    }
    ctx.stroke();

    // Draw candles
    for (var i = 0; i < slice.length; i++) {
      var c  = slice[i];
      var cx = xOff + i * cw + cw * 0.15;
      var bw = cw * 0.7;
      var ox = xOff + i * cw + cw / 2;
      var oy = priceToY(c.o, minP, maxP);
      var cy2= priceToY(c.c, minP, maxP);
      var hy = priceToY(c.h, minP, maxP);
      var ly = priceToY(c.l, minP, maxP);
      var bull = c.c >= c.o;
      var col  = bull ? C_GREEN : C_RED;

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.moveTo(ox, hy); ctx.lineTo(ox, ly);
      ctx.stroke();

      // Body
      ctx.fillStyle = bull ? 'rgba(0,232,122,0.75)' : 'rgba(255,69,96,0.75)';
      var bodyY = Math.min(oy, cy2);
      var bodyH = Math.max(Math.abs(cy2 - oy), 1.5);
      ctx.fillRect(cx, bodyY, bw, bodyH);
    }

    // Draw signals
    INDICATOR_SIGNALS.forEach(function(sig) {
      var localIdx = sig.idx - start;
      if (localIdx < 1 || localIdx >= visibleCount - 1) return;
      var c   = slice[localIdx];
      var px  = xOff + localIdx * cw + cw / 2;
      var highY = priceToY(c.h, minP, maxP);
      var lowY  = priceToY(c.l, minP, maxP);

      if (sig.type === 'STRONG_BUY') {
        // Green label below candle
        var ly2 = lowY + 6;
        ctx.fillStyle = '#00e87a';
        roundRect(ctx, px - 36, ly2, 72, 18, 3);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STRONG BUY', px, ly2 + 12);

      } else if (sig.type === 'STRONG_SELL') {
        // Red label above candle
        var hy2 = highY - 24;
        ctx.fillStyle = '#ff4560';
        roundRect(ctx, px - 38, hy2, 76, 18, 3);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STRONG SELL', px, hy2 + 12);

      } else if (sig.type === 'dot_pink') {
        // Magenta dot above candle (top warning)
        ctx.beginPath();
        ctx.arc(px, highY - 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#f0abfc';
        ctx.fill();

      } else if (sig.type === 'dot_yellow') {
        // Yellow dot below candle (bottom warning)
        ctx.beginPath();
        ctx.arc(px, lowY + 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

      } else if (sig.type === 'dot_green') {
        // Small green dot below candle (minor buy)
        ctx.beginPath();
        ctx.arc(px, lowY + 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00e87a';
        ctx.fill();

      } else if (sig.type === 'dot_red') {
        // Small red dot above candle (minor sell)
        ctx.beginPath();
        ctx.arc(px, highY - 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4560';
        ctx.fill();
      }
      ctx.textAlign = 'left';
    });

    // Current price line
    var lastC  = slice[slice.length - 1];
    var priceY = priceToY(lastC.c, minP, maxP);
    var lineCol = lastC.c >= lastC.o ? C_GREEN : C_RED;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(xOff, priceY); ctx.lineTo(W - 56, priceY); ctx.stroke();
    ctx.setLineDash([]);
    // Price tag
    ctx.fillStyle = lineCol;
    ctx.fillRect(W - 54, priceY - 9, 52, 16);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$' + Math.round(lastC.c).toLocaleString(), W - 28, priceY + 4);
    ctx.textAlign = 'left';

    // Indicator name watermark
    ctx.font = '9px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(77,100,117,0.5)';
    ctx.fillText('Precision v6  (50, 200, 14, 40, 85, 18, 60, 10)', xOff + 2, 20);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // Signal feed — matches real indicator outputs
  var feedSignals = [
    {pair:'BTC/USDT', tf:'45', type:'STRONG_BUY',  price:'$70,400', pct:'+3.2%', time:'12мин өмнө'},
    {pair:'ETH/USDT', tf:'1H', type:'STRONG_SELL', price:'$3,920',  pct:'+2.8%', time:'28мин өмнө'},
    {pair:'SOL/USDT', tf:'4H', type:'STRONG_BUY',  price:'$148.2',  pct:'+5.1%', time:'1ц өмнө'},
    {pair:'BTC/USDT', tf:'1H', type:'dot_pink',    price:'$74,200',  pct:'top',  time:'2ц өмнө'},
    {pair:'ETH/USDT', tf:'4H', type:'STRONG_BUY',  price:'$3,680',  pct:'+4.4%', time:'3ц өмнө'},
    {pair:'BNB/USDT', tf:'45', type:'STRONG_SELL', price:'$612',    pct:'+1.9%', time:'4ц өмнө'},
    {pair:'SOL/USDT', tf:'1H', type:'dot_yellow',  price:'$138.5',  pct:'bot',   time:'5ц өмнө'},
  ];
  var feedIdx = 0;

  function updateFeed() {
    if (!feed) return;
    var sig = feedSignals[feedIdx % feedSignals.length];
    var isBuy  = sig.type === 'STRONG_BUY' || sig.type === 'dot_yellow' || sig.type === 'dot_green';
    var isPink = sig.type === 'dot_pink';
    var isYellow = sig.type === 'dot_yellow';
    var col = isPink ? '#f0abfc' : isYellow ? '#fbbf24' : isBuy ? '#00e87a' : '#ff4560';
    var label = sig.type === 'STRONG_BUY' ? '▲ STRONG BUY'
              : sig.type === 'STRONG_SELL' ? '▼ STRONG SELL'
              : sig.type === 'dot_pink' ? '● TOP WARNING'
              : sig.type === 'dot_yellow' ? '● BOT WARNING'
              : sig.type === 'dot_green' ? '▲ BUY'
              : '▼ SELL';
    var bg = isBuy && !isYellow ? 'rgba(0,232,122,.06)' : isPink ? 'rgba(240,171,252,.06)' : isYellow ? 'rgba(251,191,36,.06)' : 'rgba(255,69,96,.06)';
    var newRow = document.createElement('div');
    newRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;background:'+bg+';border-left:2px solid '+col+';border-radius:0 4px 4px 0;font-family:Space Mono,monospace;font-size:10px';
    newRow.innerHTML = '<span style="color:'+col+';font-weight:700;min-width:90px">'+label+'</span>'
      + '<span style="color:#ccd8df;min-width:72px">'+sig.pair+'</span>'
      + '<span style="color:#4d6475;min-width:24px">'+sig.tf+'</span>'
      + '<span style="color:'+col+'">'+sig.price+'</span>'
      + '<span style="margin-left:auto;color:#4d6475">'+sig.time+'</span>'
      + '<span style="color:'+col+';font-weight:700">'+sig.pct+'</span>';
    feed.insertBefore(newRow, feed.firstChild);
    while (feed.children.length > 3) feed.removeChild(feed.lastChild);
    feedIdx++;
  }

  updateFeed();
  drawFrame();

  var scrollTimer = 0;
  _demoInterval = setInterval(function() {
    scrollTimer++;
    if (scrollTimer % 100 === 0 && offset < DEMO_DATA.length - visibleCount) offset++;
    if (scrollTimer % 140 === 0) updateFeed();
    drawFrame();
  }, 50);
}

function stopIndicatorDemo() {
  if (_demoInterval) { clearInterval(_demoInterval); _demoInterval = null; }
}

window.openTrainingPage  = openTrainingPage;
window.closeTrainingPage = closeTrainingPage;

// ── CRYPTO PAYMENT ───────────────────────────────────────
var WALLETS = {
  usdt: 'TCdHDhEDxbkybnz93gzQpJfSDYiT2HHrRV',
  sol:  '3zVyQWuKLtY6By49M2ovup2CsgBjnE47GB8sAHsGWQ2m'
};

var _currentToken = 'usdt';
var _currentPlan  = 'monthly';
var PRICES = {
  monthly:  {usdt: '40 USDT',  sol: '0.57 SOL',  label: 'Сарын захиалга · $40/сар'},
  biannual: {usdt: '150 USDT', sol: '2.13 SOL',   label: '6 Сарын захиалга · $150'},
  annual:   {usdt: '250 USDT', sol: '3.54 SOL',   label: 'Жилийн захиалга · $250/жил'}
};

function openCryptoPayment(plan) {
  _currentPlan = plan || 'monthly';
  _currentToken = 'usdt';
  document.getElementById('cryptoPayModal').style.display = 'flex';
  updateCryptoPayModal();
}
function closeCryptoPayment() {
  document.getElementById('cryptoPayModal').style.display = 'none';
}
function selectToken(token) {
  _currentToken = token;
  document.getElementById('btnUsdt').style.cssText = token==='usdt'
    ? 'flex:1;padding:10px;border-radius:8px;border:2px solid #00e87a;background:rgba(0,232,122,.1);font-family:Space Mono,monospace;font-size:11px;color:#00e87a;cursor:pointer;font-weight:700'
    : 'flex:1;padding:10px;border-radius:8px;border:1px solid #1c2d38;background:transparent;font-family:Space Mono,monospace;font-size:11px;color:#4d6475;cursor:pointer';
  document.getElementById('btnSol').style.cssText = token==='sol'
    ? 'flex:1;padding:10px;border-radius:8px;border:2px solid #9945FF;background:rgba(153,69,255,.1);font-family:Space Mono,monospace;font-size:11px;color:#9945FF;cursor:pointer;font-weight:700'
    : 'flex:1;padding:10px;border-radius:8px;border:1px solid #1c2d38;background:transparent;font-family:Space Mono,monospace;font-size:11px;color:#4d6475;cursor:pointer';
  updateCryptoPayModal();
}
function updateCryptoPayModal() {
  var plan = PRICES[_currentPlan];
  document.getElementById('cryptoPayTitle').textContent = plan.label;
  document.getElementById('cryptoPayAmount').textContent = plan[_currentToken].split(' ')[0];
  document.getElementById('cryptoPayToken').textContent = plan[_currentToken].split(' ')[1] + (_currentToken==='usdt' ? ' (TRC20)' : ' (Solana)');
  document.getElementById('cryptoPayAddr').textContent = WALLETS[_currentToken];
}
function copyCryptoAddr() {
  var addr = WALLETS[_currentToken];
  navigator.clipboard.writeText(addr).then(function() {
    var btn = document.getElementById('copyAddrBtn');
    btn.textContent = '✓ Хуулагдлаа';
    setTimeout(function(){ btn.textContent = 'Хуулах'; }, 2000);
  });
}
document.addEventListener('click', function(e) {
  var modal = document.getElementById('cryptoPayModal');
  if (modal && e.target === modal) closeCryptoPayment();
});

window.openCryptoPayment  = openCryptoPayment;
window.closeCryptoPayment = closeCryptoPayment;
window.selectToken        = selectToken;
window.copyCryptoAddr     = copyCryptoAddr;
