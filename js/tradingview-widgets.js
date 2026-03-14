// ── TRADINGVIEW WIDGETS — Real TradingView charts embedded in ChainRoot ───────
// Replaces LightweightCharts overlays with full TradingView Advanced Chart widgets
// Uses TradingView's free embed API — no approval needed, real data from TV servers

// Common config shared by all widgets
var TV_THEME    = 'dark';
var TV_LOCALE   = 'en';
var TV_TIMEZONE = 'Etc/UTC';

// ── HELPER: inject a TradingView widget into a container div ──────────────────
function injectTVWidget(containerId, scriptSrc, options) {
  var container = document.getElementById(containerId);
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';
  container.style.position = 'relative';

  // Outer widget div
  var outer = document.createElement('div');
  outer.className = 'tradingview-widget-container';
  outer.style.cssText = 'width:100%;height:100%;';

  var inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  inner.style.cssText = 'width:100%;height:calc(100% - 22px);';

  // Copyright bar — required by TradingView ToS
  var copy = document.createElement('div');
  copy.className = 'tradingview-widget-copyright';
  copy.style.cssText = 'font-family:Space Mono,monospace;font-size:9px;color:#4d6475;padding:4px 8px;';
  copy.innerHTML = '<a href="https://www.tradingview.com" target="_blank" rel="noopener" style="color:#4d6475;text-decoration:none;">Data by TradingView</a>';

  outer.appendChild(inner);
  outer.appendChild(copy);
  container.appendChild(outer);

  // Script tag with JSON options
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = scriptSrc;
  script.async = true;
  script.innerHTML = JSON.stringify(options);
  outer.appendChild(script);
}

// ── HELPER: create an Advanced Chart (full TV chart with drawing tools) ───────
function createAdvancedChart(containerId, symbol, options) {
  var defaults = {
    autosize:         true,
    symbol:           symbol,
    interval:         'W',
    timezone:         TV_TIMEZONE,
    theme:            TV_THEME,
    style:            '1',
    locale:           TV_LOCALE,
    backgroundColor:  'rgba(14,26,32,0)',
    gridColor:        'rgba(28,45,56,0.4)',
    hide_top_toolbar: false,
    hide_legend:      false,
    save_image:        false,
    withdateranges:   true,
    allow_symbol_change: false,
    support_host:     'https://www.tradingview.com'
  };
  var merged = Object.assign({}, defaults, options || {});
  injectTVWidget(containerId,
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    merged
  );
}

// ── HELPER: create a Symbol Overview (multi-symbol % comparison) ──────────────
function createSymbolOverview(containerId, symbols, options) {
  var defaults = {
    symbols:          symbols,
    chartOnly:        true,
    width:            '100%',
    height:           '100%',
    locale:           TV_LOCALE,
    colorTheme:       TV_THEME,
    autosize:         true,
    showVolume:       false,
    showMA:           false,
    hideDateRanges:   false,
    hideMarketStatus: true,
    hideSymbolLogo:   true,
    scalePosition:    'right',
    scaleMode:        'Percentage',
    backgroundColor:  'rgba(14,26,32,0)',
    lineWidth:        2,
    dateRanges:       ['1d|1','1m|30','3m|60','12m|1D','60m|1W','all|1M'],
    fontFamily:       'Space Mono, monospace',
    fontColor:        '#4d6475',
    gridLineColor:    'rgba(28,45,56,0.4)',
    noTimeScale:      false,
    chartType:        'area',
    lineType:         0,
    isTransparent:    true
  };
  var merged = Object.assign({}, defaults, options || {});
  injectTVWidget(containerId,
    'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js',
    merged
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL CHART REPLACEMENTS — called when panels open (lazy init)
// ══════════════════════════════════════════════════════════════════════════════

// ── HALVING CYCLES — BTC full history on Advanced Chart ──────────────────────
window._tvHalvingReady = false;
function initTVHalving() {
  if (window._tvHalvingReady) return;
  window._tvHalvingReady = true;
  createAdvancedChart('halvingChart', 'BITSTAMP:BTCUSD', {
    interval:        'W',
    style:           '1',
    hide_top_toolbar: false,
    studies: [
      { id: 'MASimple@tv-basicstudies', inputs: { length: 200 } }
    ],
    // Mark halving dates with vertical lines via drawings not possible in widget
    // but user can use TV's built-in drawing tools
    withdateranges: true,
    range:          'ALL'
  });
}

// ── FED BALANCE SHEET vs BTC — dual chart ────────────────────────────────────
window._tvFedReady = false;
function initTVFed() {
  if (window._tvFedReady) return;
  window._tvFedReady = true;
  createSymbolOverview('fedBtcChart', [
    ['Bitcoin', 'BITSTAMP:BTCUSD|1W'],
    ['Fed Balance Sheet', 'FRED:WALCL|1W']
  ], {
    scaleMode:      'Percentage',
    chartType:      'line',
    dateRanges:     ['5y|1W','all|1M'],
    showVolume:     false
  });
}

// ── DOLLAR INDEX vs BTC ───────────────────────────────────────────────────────
window._tvDxyReady = false;
function initTVDxy() {
  if (window._tvDxyReady) return;
  window._tvDxyReady = true;
  createSymbolOverview('dxyBtcChart', [
    ['Bitcoin', 'BITSTAMP:BTCUSD|1W'],
    ['DXY', 'TVC:DXY|1W']
  ], {
    scaleMode:  'Percentage',
    chartType:  'line',
    dateRanges: ['5y|1W','all|1M']
  });
}

// ── GLOBAL LIQUIDITY vs BTC ───────────────────────────────────────────────────
window._tvLiqReady = false;
function initTVLiq() {
  if (window._tvLiqReady) return;
  window._tvLiqReady = true;
  createSymbolOverview('liqBtcChart', [
    ['Bitcoin',        'BITSTAMP:BTCUSD|1W'],
    ['Fed Balance',    'FRED:WALCL|1W'],
    ['ECB Balance',    'ECBBS:ECBASSETSW|1W'],
    ['Total Liquidity','GLASSNODE:BTC_SOPR|1W'] // placeholder — use M2 proxy
  ], {
    scaleMode:  'Percentage',
    chartType:  'line',
    dateRanges: ['5y|1W','all|1M']
  });
}

// ── BITCOIN ISM CHART — BTC + ISM Manufacturing ───────────────────────────────
window._tvIsmReady = false;
function initTVIsm() {
  if (window._tvIsmReady) return;
  window._tvIsmReady = true;
  createSymbolOverview('ismBtcChart', [
    ['Bitcoin',             'BITSTAMP:BTCUSD|1M'],
    ['ISM Manufacturing',   'ECONOMICS:USISR|1M']
  ], {
    scaleMode:  'Percentage',
    chartType:  'line',
    dateRanges: ['5y|1M','all|1M'],
    showVolume: false
  });
}

// ── BITCOIN SOCIAL RISK — BTC + Google Trends proxy ──────────────────────────
window._tvSocialReady = false;
function initTVSocial() {
  if (window._tvSocialReady) return;
  window._tvSocialReady = true;
  // Use BTC dominance as social risk proxy since GT not on TV
  createSymbolOverview('socialRiskChart', [
    ['Bitcoin',      'BITSTAMP:BTCUSD|1W'],
    ['BTC Dominance','CRYPTOCAP:BTC.D|1W']
  ], {
    scaleMode:  'Percentage',
    chartType:  'area',
    dateRanges: ['3y|1W','all|1M']
  });
}

// ── EPOCH CYCLES — BTC full history ──────────────────────────────────────────
window._tvEpochReady = false;
function initTVEpoch() {
  if (window._tvEpochReady) return;
  window._tvEpochReady = true;
  createAdvancedChart('epochChart', 'BITSTAMP:BTCUSD', {
    interval: 'W',
    style:    '1',
    range:    'ALL'
  });
}

// ── BITCOIN YEARLY PERFORMANCE — BTC % change comparison ─────────────────────
// The Symbol Overview widget with scaleMode=Percentage and dateRanges=1y
// gives year-to-date % performance per year
window._tvYearlyReady = false;
function initTVYearly() {
  if (window._tvYearlyReady) return;
  window._tvYearlyReady = true;
  createAdvancedChart('ypChart', 'BITSTAMP:BTCUSD', {
    interval:        'D',
    style:           '2', // line style
    range:           '12M',
    hide_top_toolbar: false
  });
}

// ── Charts are now initialized via go() in auth.js ───────────────────────────
// initTVHalving(), initTVFed(), initTVDxy(), initTVLiq(),
// initTVIsm(), initTVSocial(), initTVEpoch(), initTVYearly()
// are all called directly from go() when the panel opens
