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
var _demoInterval = null;
var _demoFrame   = 0;

// Simulated BTC price data with realistic movement
var DEMO_DATA = (function() {
  var prices = [68200, 67800, 68100, 68900, 69200, 68700, 68300, 67900, 67400, 67800,
                68200, 69100, 70300, 71200, 70800, 71500, 72100, 71800, 70900, 70200,
                69800, 70100, 71300, 72800, 73200, 72600, 71900, 71200, 70600, 71400,
                72500, 73800, 74200, 73500, 72900, 73400, 74600, 75200, 74800, 75500];
  var candles = [];
  for (var i = 0; i < prices.length; i++) {
    var base = prices[i];
    var range = base * 0.012;
    var open  = i > 0 ? prices[i-1] : base;
    var close = base;
    var high  = Math.max(open, close) + Math.random() * range;
    var low   = Math.min(open, close) - Math.random() * range;
    candles.push({open, close, high, low});
  }
  return candles;
})();

// Signal definitions — where BUY/SELL appear
var SIGNALS = [
  {idx: 8,  type: 'BUY',  entry: 67400, exit: 71200, label: '▲ BUY — Entry', exitLabel: '✓ Exit +5.6%'},
  {idx: 22, type: 'BUY',  entry: 71300, exit: 74200, label: '▲ BUY — Entry', exitLabel: '✓ Exit +4.1%'},
  {idx: 18, type: 'SELL', entry: 70900, exit: 69800, label: '▼ SELL — Entry', exitLabel: '✓ Exit +1.6%'},
];

// Support/Resistance levels
var SR_LEVELS = [
  {price: 67500, label: 'S1 Support',    color: 'rgba(0,232,122,.5)'},
  {price: 72000, label: 'R1 Resistance', color: 'rgba(255,107,53,.5)'},
  {price: 75000, label: 'R2 Target',     color: 'rgba(0,180,216,.5)'},
];

function startIndicatorDemo() {
  var canvas = document.getElementById('indicatorDemoCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var feed = document.getElementById('indicatorSignalFeed');

  // Set canvas resolution
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var W = rect.width, H = rect.height;

  var visibleCount = 20; // candles visible at once
  var offset = 0;       // scrolling offset

  function priceToY(price, minP, maxP) {
    var pad = 20;
    return H - pad - ((price - minP) / (maxP - minP)) * (H - pad*2);
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);

    // Scrolling: show window of candles
    var start = Math.min(offset, DEMO_DATA.length - visibleCount);
    var slice = DEMO_DATA.slice(start, start + visibleCount);

    // Price range for this window
    var minP = Math.min.apply(null, slice.map(function(c){return c.low;}))  * 0.998;
    var maxP = Math.max.apply(null, slice.map(function(c){return c.high;})) * 1.002;

    var cw = (W - 40) / visibleCount; // candle width
    var xOff = 20;

    // Draw S/R lines
    SR_LEVELS.forEach(function(sr) {
      if (sr.price < minP || sr.price > maxP) return;
      var y = priceToY(sr.price, minP, maxP);
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 1;
      ctx.moveTo(xOff, y);
      ctx.lineTo(W - 10, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.fillStyle = sr.color.replace('.5)', '1)');
      ctx.textAlign = 'right';
      ctx.fillText(sr.label + ' $' + (sr.price/1000).toFixed(1)+'K', W-12, y-3);
      ctx.textAlign = 'left';
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(28,45,56,.6)';
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 4; g++) {
      var gy = 20 + g * (H-40)/4;
      ctx.beginPath(); ctx.moveTo(xOff, gy); ctx.lineTo(W-10, gy); ctx.stroke();
      var gPrice = maxP - g * (maxP-minP)/4;
      ctx.font = '8px "Space Mono", monospace';
      ctx.fillStyle = '#4d6475';
      ctx.textAlign = 'left';
      ctx.fillText('$' + Math.round(gPrice/100)*100, 2, gy+3);
    }

    // Draw candles
    slice.forEach(function(c, i) {
      var x = xOff + i * cw + cw * 0.1;
      var w = cw * 0.8;
      var openY  = priceToY(c.open,  minP, maxP);
      var closeY = priceToY(c.close, minP, maxP);
      var highY  = priceToY(c.high,  minP, maxP);
      var lowY   = priceToY(c.low,   minP, maxP);
      var bull   = c.close >= c.open;
      var col    = bull ? '#00e87a' : '#ff4560';

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.moveTo(x + w/2, highY);
      ctx.lineTo(x + w/2, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = bull ? 'rgba(0,232,122,.8)' : 'rgba(255,69,96,.8)';
      var bodyY = Math.min(openY, closeY);
      var bodyH = Math.max(Math.abs(closeY - openY), 1);
      ctx.fillRect(x, bodyY, w, bodyH);
    });

    // Draw signals on visible candles
    SIGNALS.forEach(function(sig) {
      var localIdx = sig.idx - start;
      if (localIdx < 0 || localIdx >= visibleCount) return;

      var x = xOff + localIdx * cw + cw/2;
      var c = slice[localIdx];
      var isBuy = sig.type === 'BUY';

      if (isBuy) {
        var y = priceToY(c.low, minP, maxP) + 18;
        // Triangle up
        ctx.beginPath();
        ctx.fillStyle = '#00e87a';
        ctx.moveTo(x, y-12); ctx.lineTo(x-8, y+4); ctx.lineTo(x+8, y+4);
        ctx.closePath(); ctx.fill();
        // Label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BUY', x, y+14);
        // Entry line
        var entryY = priceToY(sig.entry, minP, maxP);
        ctx.beginPath();
        ctx.setLineDash([3,3]);
        ctx.strokeStyle = 'rgba(0,232,122,.4)';
        ctx.lineWidth = 1;
        ctx.moveTo(x, entryY);
        ctx.lineTo(W-10, entryY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 8px "Space Mono", monospace';
        ctx.fillStyle = '#00e87a';
        ctx.textAlign = 'right';
        ctx.fillText('ENTRY $' + sig.entry.toLocaleString(), W-12, entryY-3);
      } else {
        var y2 = priceToY(c.high, minP, maxP) - 18;
        // Triangle down
        ctx.beginPath();
        ctx.fillStyle = '#ff4560';
        ctx.moveTo(x, y2+12); ctx.lineTo(x-8, y2-4); ctx.lineTo(x+8, y2-4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELL', x, y2-10);
      }
      ctx.textAlign = 'left';
    });

    // Current price line
    var lastC = slice[slice.length-1];
    var lastY = priceToY(lastC.close, minP, maxP);
    ctx.beginPath();
    ctx.setLineDash([2,2]);
    ctx.strokeStyle = lastC.close >= lastC.open ? '#00e87a' : '#ff4560';
    ctx.lineWidth = 1;
    ctx.moveTo(xOff, lastY); ctx.lineTo(W-10, lastY); ctx.stroke();
    ctx.setLineDash([]);
    // Price label
    ctx.fillStyle = lastC.close >= lastC.open ? '#00e87a' : '#ff4560';
    ctx.fillStyle = '#0c1014';
    ctx.fillRect(W-62, lastY-9, 60, 16);
    ctx.fillStyle = lastC.close >= lastC.open ? '#00e87a' : '#ff4560';
    ctx.font = 'bold 9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$' + Math.round(lastC.close/100)*100, W-32, lastY+3);
    ctx.textAlign = 'left';
  }

  // Signal feed updates
  var feedSignals = [
    {pair:'BTC/USDT', tf:'4H', type:'BUY',  price:'$71,200', time:'2мин өмнө',  pct:'+4.1%'},
    {pair:'ETH/USDT', tf:'1H', type:'SELL', price:'$3,842',  time:'18мин өмнө', pct:'+2.3%'},
    {pair:'SOL/USDT', tf:'4H', type:'BUY',  price:'$148.2',  time:'1ц өмнө',    pct:'+5.8%'},
    {pair:'AAPL',     tf:'1D', type:'BUY',  price:'$223.4',  time:'3ц өмнө',    pct:'+2.1%'},
  ];
  var feedIdx = 0;

  function updateFeed() {
    if (!feed) return;
    var sig = feedSignals[feedIdx % feedSignals.length];
    var isBuy = sig.type === 'BUY';
    var col = isBuy ? '#00e87a' : '#ff4560';
    var newRow = document.createElement('div');
    newRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:4px 8px;background:'+(isBuy?'rgba(0,232,122,.06)':'rgba(255,69,96,.06)')+';border-left:2px solid '+col+';border-radius:0 4px 4px 0;animation:fadeIn .3s ease;font-family:Space Mono,monospace;font-size:10px';
    newRow.innerHTML = '<span style="color:'+col+';font-weight:700;min-width:36px">'+(isBuy?'▲ BUY':'▼ SELL')+'</span>'
      + '<span style="color:#ccd8df;min-width:80px">'+sig.pair+'</span>'
      + '<span style="color:#4d6475;min-width:24px">'+sig.tf+'</span>'
      + '<span style="color:'+col+'">'+sig.price+'</span>'
      + '<span style="color:#4d6475;margin-left:auto">'+sig.time+'</span>'
      + '<span style="color:'+col+';font-weight:700">'+sig.pct+'</span>';
    feed.insertBefore(newRow, feed.firstChild);
    while (feed.children.length > 3) feed.removeChild(feed.lastChild);
    feedIdx++;
  }

  updateFeed();
  drawFrame();

  // Animate: slowly scroll through candles
  var scrollTimer = 0;
  _demoInterval = setInterval(function() {
    scrollTimer++;
    if (scrollTimer % 80 === 0 && offset < DEMO_DATA.length - visibleCount) {
      offset++;
    }
    if (scrollTimer % 120 === 0) updateFeed();
    drawFrame();
    _demoFrame++;
  }, 50);
}

function stopIndicatorDemo() {
  if (_demoInterval) { clearInterval(_demoInterval); _demoInterval = null; }
}

window.openTrainingPage  = openTrainingPage;
window.closeTrainingPage = closeTrainingPage;

// ── CRYPTO PAYMENT ───────────────────────────────────────
// ⚠️ REPLACE THESE WITH YOUR REAL WALLET ADDRESSES
var WALLETS = {
  usdt: 'TCdHDhEDxbkybnz93gzQpJfSDYiT2HHrRV',          // USDT TRC20 (Tron)
  sol:  '3zVyQWuKLtY6By49M2ovup2CsgBjnE47GB8sAHsGWQ2m'  // Solana SOL
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
    btn.style.color = '#00e87a';
    setTimeout(function(){ btn.textContent='Хуулах'; btn.style.color='#00e87a'; }, 2000);
  }).catch(function(){
    var btn = document.getElementById('copyAddrBtn');
    btn.textContent = 'Copy failed';
  });
}

// Close modal on outside click
document.addEventListener('click', function(e) {
  var modal = document.getElementById('cryptoPayModal');
  if (modal && e.target === modal) closeCryptoPayment();
});

window.openCryptoPayment  = openCryptoPayment;
window.closeCryptoPayment = closeCryptoPayment;
window.selectToken        = selectToken;
window.copyCryptoAddr     = copyCryptoAddr;
