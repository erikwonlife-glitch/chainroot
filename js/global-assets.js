/* ═══════════════════════════════════════════════════════════
   DEFIMONGO SITE-WIDE LANGUAGE SWITCHER
   Default: Mongolian (mn)
   All translatable elements use data-mn / data-en attributes.
   setSiteLang('en') switches everything to English instantly.
   setSiteLang('mn') switches back to Mongolian.
═══════════════════════════════════════════════════════════ */
let SITE_LANG = 'mn'; // Mongolian default

function setSiteLang(lang) {
  SITE_LANG = lang;

  // Swap all elements that have data-mn / data-en attributes
  document.querySelectorAll('[data-mn]').forEach(function(el) {
    const txt = el.getAttribute('data-' + lang);
    if (txt !== null) el.innerHTML = txt;
  });

  // Update topbar toggle button styles
  const mnBtn = document.getElementById('main-lang-mn');
  const enBtn = document.getElementById('main-lang-en');
  if (mnBtn && enBtn) {
    if (lang === 'mn') {
      mnBtn.style.background = '#00e87a';
      mnBtn.style.color = '#000';
      enBtn.style.background = 'transparent';
      enBtn.style.color = 'var(--muted)';
    } else {
      enBtn.style.background = '#00e87a';
      enBtn.style.color = '#000';
      mnBtn.style.background = 'transparent';
      mnBtn.style.color = 'var(--muted)';
    }
  }

  // Also sync the training page language toggle if it's open
  const trMn = document.getElementById('lang-mn');
  const trEn = document.getElementById('lang-en');
  if (trMn && trEn) {
    if (lang === 'mn') {
      trMn.style.background = '#f4c542'; trMn.style.color = '#000';
      trEn.style.background = 'transparent'; trEn.style.color = 'var(--muted)';
    } else {
      trEn.style.background = '#f4c542'; trEn.style.color = '#000';
      trMn.style.background = 'transparent'; trMn.style.color = 'var(--muted)';
    }
  }

  // Save preference so it persists across page refreshes
  try { localStorage.setItem('cr_lang', lang); } catch(e) {}
}

// On page load: apply saved preference or default to Mongolian
(function() {
  let saved = 'mn';
  try { saved = localStorage.getItem('cr_lang') || 'mn'; } catch(e) {}
  // Small delay so DOM is fully rendered before swapping
  setTimeout(function() { setSiteLang(saved); }, 50);
})();

// Expose globally
// ── GLOBAL ASSET RANKING ──────────────────────────────────────────────────────
(function(){

const CR_API_GA = 'https://chainroot-production-b7d1.up.railway.app';

// ── Inline SVG logos for major stocks (guaranteed to render) ──────────────────
// Convert SVG string to safe data URI for use as img src
function svgToImg(svg, r) {
  r = r || '8px';
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return '<img src="' + uri + '" style="width:36px;height:36px;border-radius:' + r + ';flex-shrink:0;display:block" loading="lazy"/>';
}

const STOCK_SVGS = {
  nvda: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#76b900"/><text x="10" y="54" fill="white" font-family="Arial" font-weight="900" font-size="30">NV</text></svg>',
  aapl: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#1c1c1e"/><path fill="white" d="M53 43c0-6 5-9 5-9-3-4-7-5-9-5-4 0-7 2-9 2s-5-2-8-2c-4 0-8 2-10 6-4 7-1 18 3 24 2 3 4 6 8 6s5-2 8-2 5 2 8 2 5-3 7-6c2-3 3-7 3-7s-6-2-6-9zm-6-18c2-2 3-5 2-8-2 0-5 2-7 4-2 2-3 5-2 7 3 1 5-1 7-3z"/></svg>',
  msft: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="white"/><rect x="8" y="8" width="29" height="29" fill="#F25022"/><rect x="43" y="8" width="29" height="29" fill="#7FBA00"/><rect x="8" y="43" width="29" height="29" fill="#00A4EF"/><rect x="43" y="43" width="29" height="29" fill="#FFB900"/></svg>',
  amzn: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#FF9900"/><text x="9" y="44" fill="white" font-family="Arial" font-weight="900" font-size="19">amzn</text><path d="M12 56 Q40 44 68 56" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  goog: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="white"/><text x="14" y="56" fill="#4285F4" font-family="Arial" font-weight="900" font-size="52">G</text></svg>',
  meta: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#0082fb"/><text x="13" y="54" fill="white" font-family="Arial" font-weight="900" font-size="42">f</text></svg>',
  tsla: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#CC0000"/><text x="22" y="56" fill="white" font-family="Arial" font-weight="900" font-size="46">T</text></svg>',
  brk:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#4d6475"/><text x="10" y="52" fill="white" font-family="Arial" font-weight="900" font-size="26">BRK</text></svg>',
  tsm:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#00b4d8"/><text x="10" y="52" fill="white" font-family="Arial" font-weight="900" font-size="26">TSM</text></svg>',
  eli:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#e3145d"/><text x="16" y="52" fill="white" font-family="Arial" font-weight="900" font-size="30">LLY</text></svg>',
  jpm:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#005eb8"/><text x="10" y="52" fill="white" font-family="Arial" font-weight="900" font-size="26">JPM</text></svg>',
  v:    '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#1a1f71"/><text x="16" y="60" fill="white" font-family="Arial" font-weight="900" font-size="54">V</text></svg>',
  wmt:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#0071ce"/><text x="8" y="52" fill="white" font-family="Arial" font-weight="900" font-size="26">WMT</text></svg>',
  xom:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#e31b23"/><text x="10" y="52" fill="white" font-family="Arial" font-weight="900" font-size="28">XOM</text></svg>',
  nflx: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#e50914"/><text x="18" y="58" fill="white" font-family="Arial" font-weight="900" font-size="48">N</text></svg>',
  unh:  '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#2375bb"/><text x="10" y="52" fill="white" font-family="Arial" font-weight="900" font-size="26">UNH</text></svg>',
  cost: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="12" fill="#e31837"/><text x="6" y="52" fill="white" font-family="Arial" font-weight="900" font-size="24">COST</text></svg>',
};

const COMMODITY_SVGS = {
  gold:        '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="gg" cx="35%" cy="35%"><stop offset="0%" stop-color="#ffe566"/><stop offset="60%" stop-color="#f4c542"/><stop offset="100%" stop-color="#b8860b"/></radialGradient></defs><circle cx="40" cy="40" r="40" fill="url(#gg)"/><text x="19" y="52" fill="#7a5c00" font-family="Arial" font-weight="900" font-size="28">Au</text></svg>',
  silver:      '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="sg" cx="35%" cy="35%"><stop offset="0%" stop-color="#f0f0f0"/><stop offset="60%" stop-color="#c0c0c0"/><stop offset="100%" stop-color="#808080"/></radialGradient></defs><circle cx="40" cy="40" r="40" fill="url(#sg)"/><text x="21" y="52" fill="#444" font-family="Arial" font-weight="900" font-size="28">Ag</text></svg>',
  'crude-oil': '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#1a1a2e"/><text x="14" y="48" fill="#ff7c3a" font-family="Arial" font-weight="900" font-size="22">OIL</text><path d="M20 60 Q40 50 60 60" stroke="#ff7c3a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
};

const TYPE_BADGE = {
  Commodity: '<span style="font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;background:rgba(244,197,66,.15);color:#f4c542;border:1px solid rgba(244,197,66,.3)">Commodity</span>',
  Stock:     '<span style="font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;background:rgba(77,100,117,.2);color:#8aa0b0;border:1px solid rgba(77,100,117,.3)">Stock</span>',
  Crypto:    '<span style="font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;background:rgba(0,232,122,.12);color:#00e87a;border:1px solid rgba(0,232,122,.25)">Crypto</span>',
};

// Base static data — prices + 24h fetched live from backend
const BASE_ASSETS = [
  {id:'gold',      name:'Gold',             ticker:'XAU/USD', type:'Commodity', mcapT:34.9},
  {id:'silver',    name:'Silver',           ticker:'XAG/USD', type:'Commodity', mcapT:4.5},
  {id:'crude-oil', name:'Crude Oil',        ticker:'WTI',     type:'Commodity', mcapT:2.1},
  {id:'nvda', name:'NVIDIA',           ticker:'NVDA',  type:'Stock', mcapT:3.3},
  {id:'aapl', name:'Apple',            ticker:'AAPL',  type:'Stock', mcapT:3.7},
  {id:'msft', name:'Microsoft',        ticker:'MSFT',  type:'Stock', mcapT:3.1},
  {id:'amzn', name:'Amazon',           ticker:'AMZN',  type:'Stock', mcapT:2.3},
  {id:'goog', name:'Alphabet (Google)',ticker:'GOOG',  type:'Stock', mcapT:2.0},
  {id:'meta', name:'Meta',             ticker:'META',  type:'Stock', mcapT:1.7},
  {id:'tsla', name:'Tesla',            ticker:'TSLA',  type:'Stock', mcapT:0.9},
  {id:'brk',  name:'Berkshire Hath.',  ticker:'BRK.B', type:'Stock', mcapT:1.1},
  {id:'tsm',  name:'TSMC',             ticker:'TSM',   type:'Stock', mcapT:0.9},
  {id:'eli',  name:'Eli Lilly',        ticker:'LLY',   type:'Stock', mcapT:0.8},
  {id:'jpm',  name:'JPMorgan Chase',   ticker:'JPM',   type:'Stock', mcapT:0.7},
  {id:'v',    name:'Visa',             ticker:'V',     type:'Stock', mcapT:0.6},
  {id:'wmt',  name:'Walmart',          ticker:'WMT',   type:'Stock', mcapT:0.8},
  {id:'xom',  name:'ExxonMobil',       ticker:'XOM',   type:'Stock', mcapT:0.5},
  {id:'nflx', name:'Netflix',          ticker:'NFLX',  type:'Stock', mcapT:0.4},
  {id:'unh',  name:'UnitedHealth',     ticker:'UNH',   type:'Stock', mcapT:0.5},
  {id:'cost', name:'Costco',           ticker:'COST',  type:'Stock', mcapT:0.5},
];

let GA_ALL = [], GA_FILTERED = [];

function fmtMcap(t) {
  if (!t && t!==0) return '&#8212;';
  if (t >= 1)   return '$'+t.toFixed(2)+'T';
  if (t >= 0.1) return '$'+(t*1000).toFixed(0)+'B';
  return '$'+(t*1000).toFixed(1)+'B';
}
function fmtGaPrice(p) {
  if (p==null) return '&#8212;';
  if (p >= 1000) return '$'+p.toLocaleString('en-US',{maximumFractionDigits:2});
  if (p >= 1)    return '$'+p.toFixed(2);
  if (p >= 0.01) return '$'+p.toFixed(4);
  return '$'+p.toFixed(6);
}

function getLogo(a) {
  if (a.type === 'Commodity' && COMMODITY_SVGS[a.id]) return svgToImg(COMMODITY_SVGS[a.id], '50%');
  if (a.type === 'Stock' && STOCK_SVGS[a.id])         return svgToImg(STOCK_SVGS[a.id], '8px');
  if (a.type === 'Crypto' && a.logo)
    return '<img src="' + a.logo + '" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;object-fit:cover" loading="lazy" onerror="this.style.opacity=.3"/>';
  // Fallback letter badge
  var col = a.type==='Crypto' ? '#F7931A' : a.type==='Stock' ? '#4d6475' : '#f4c542';
  return '<div style="width:36px;height:36px;border-radius:8px;flex-shrink:0;background:' + col + '22;border:1px solid ' + col + '44;display:flex;align-items:center;justify-content:center;font-family:Space Mono,monospace;font-size:10px;font-weight:700;color:' + col + '">' + (a.ticker||'?').slice(0,3) + '</div>';
}

function renderGA() {
  const tbody = document.getElementById('gaBody');
  if (!tbody) return;
  const list = GA_FILTERED.length ? GA_FILTERED : GA_ALL;
  if (!list.length) return;
  tbody.innerHTML = list.map(function(a, i) {
    const chgCol  = a.chg24==null ? '#4d6475' : a.chg24>=0 ? '#00e87a' : '#ff4560';
    const chgText = a.chg24==null ? '—' : (a.chg24>=0?'+':'')+a.chg24.toFixed(2)+'%';
    return `<tr style="border-bottom:1px solid rgba(28,45,56,.5);transition:background .12s" onmouseover="this.style.background='rgba(0,232,122,.025)'" onmouseout="this.style.background=''">
      <td style="padding:13px 16px;font-family:'Space Mono',monospace;font-size:11px;color:#4d6475;width:44px">${i+1}</td>
      <td style="padding:13px 16px">
        <div style="display:flex;align-items:center;gap:14px">
          ${getLogo(a)}
          <div>
            <div style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:#fff;line-height:1.2">${a.name}</div>
            <div style="font-family:'Space Mono',monospace;font-size:10px;color:#4d6475;margin-top:2px">${a.ticker}</div>
          </div>
        </div>
      </td>
      <td style="padding:13px 20px;font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#fff;text-align:right;white-space:nowrap">${fmtMcap(a.mcapT)}</td>
      <td style="padding:13px 20px;font-family:'Space Mono',monospace;font-size:12px;color:#ccd8df;text-align:right;white-space:nowrap">${fmtGaPrice(a.price)}</td>
      <td style="padding:13px 20px;font-family:'Space Mono',monospace;font-size:12px;font-weight:600;color:${chgCol};text-align:right;white-space:nowrap">${chgText}</td>
      <td style="padding:13px 16px;text-align:center;white-space:nowrap">${TYPE_BADGE[a.type]||''}</td>
    </tr>`;
  }).join('');
}

window.gaFilter = function(q) {
  const ql = (q||'').toLowerCase();
  GA_FILTERED = ql ? GA_ALL.filter(function(a){return a.name.toLowerCase().includes(ql)||a.ticker.toLowerCase().includes(ql);}) : [];
  renderGA();
};

async function loadGlobalAssets() {
  const tbody = document.getElementById('gaBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:60px;font-family:'Space Mono',monospace;font-size:11px;color:#4d6475;letter-spacing:2px">
    <div style="width:18px;height:18px;border:2px solid #243844;border-top-color:#00e87a;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 14px"></div>
    LOADING GLOBAL ASSETS…</td></tr>`;

  // Build asset map from base
  const assetMap = {};
  BASE_ASSETS.forEach(function(a){ assetMap[a.id] = Object.assign({price:null,chg24:null}, a); });

  // ── Fetch live prices from Railway backend ────────────────────────────────────
  try {
    const r = await fetch(CR_API_GA + '/api/global/prices', {signal:AbortSignal.timeout(20000)});
    if (r.ok) {
      const d = await r.json();
      // Stocks
      Object.keys(d.stocks||{}).forEach(function(id) {
        if (assetMap[id]) {
          assetMap[id].price = d.stocks[id].price;
          assetMap[id].chg24 = d.stocks[id].chg24;
        }
      });
      // Commodities
      Object.keys(d.commodities||{}).forEach(function(id) {
        if (assetMap[id]) {
          assetMap[id].price = d.commodities[id].price;
          assetMap[id].chg24 = d.commodities[id].chg24;
        }
      });
    }
  } catch(e) { console.warn('global/prices failed:', e.message); }

  // ── Get crypto from ALL_COINS (already in memory) ─────────────────────────────
  const cryptoSource = (typeof ALL_COINS !== 'undefined' && ALL_COINS.length) ? ALL_COINS : [];
  const cryptoAssets = cryptoSource
    .filter(function(c){ return c.market_cap && c.market_cap >= 1e9; })
    .map(function(c){ return {
      id:    c.id,
      name:  c.name,
      ticker:(c.symbol||'').toUpperCase(),
      type:  'Crypto',
      mcapT: +(c.market_cap/1e12).toFixed(6),
      price: c.current_price,
      chg24: c.price_change_percentage_24h!=null ? +c.price_change_percentage_24h.toFixed(2) : null,
      logo:  c.image||null,
    };});

  // ── Merge, sort, top 50 ───────────────────────────────────────────────────────
  const allAssets = Object.values(assetMap).concat(cryptoAssets);
  GA_ALL = allAssets
    .filter(function(a){ return a.mcapT && a.mcapT > 0; })
    .sort(function(a,b){ return (b.mcapT||0)-(a.mcapT||0); })
    .slice(0, 50);

  renderGA();

  const upd = document.getElementById('ga-updated');
  if (upd) upd.textContent = '↻ Updated '+new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
}

// Lazy-init on first panel open
(function(){
  const _prev = window.go;
  window.go = function(id, el) {
    if (_prev) _prev(id, el);
    if (id==='global-assets' && !window._gaInited) {
      window._gaInited = true;
      loadGlobalAssets();
    }
  };
})();

})(); // end IIFE

window.setSiteLang = setSiteLang;
