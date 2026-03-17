/* ═══════════════════════════════════════════════════════════
   DEFIMONGO — PREDICT·MN  (v1)
   Mongolian Prediction Market — Phase 1 (Manual Oracle)
   Author: DeFiMongo
═══════════════════════════════════════════════════════════ */

/* ── MARKET DATA ─────────────────────────────────────────────
   Each market:
     id        — unique slug
     cat       — gov | sport | biz | social
     mn / en   — question text in both languages
     yes       — current YES probability 0–100
     vol       — total volume in USD
     closes    — ISO date string (deadline)
     status    — open | resolving | resolved_yes | resolved_no
     minBet    — minimum position in USD
     maxBet    — maximum position per user in USD
═══════════════════════════════════════════════════════════ */
const PM_MARKETS = [
  // ── POLITICS ───────────────────────────────────────────────
  {
    id: 'mgl-election-2024-mpr',
    cat: 'gov',
    mn: 'МАН 2024 оны Улсын Их Хурлын сонгуульд ялах уу?',
    en: 'Will the MPP win the 2024 Parliamentary election?',
    yes: 71,
    vol: 1240,
    closes: '2025-06-28',
    status: 'open',
    minBet: 5,
    maxBet: 100
  },
  {
    id: 'mgl-president-approval',
    cat: 'gov',
    mn: 'Ерөнхийлөгч Хүрэлсүхийн үнэлгэлт 2025 онд 50%-аас дээш байх уу?',
    en: "Will President Khurelsukh's approval rating stay above 50% in 2025?",
    yes: 44,
    vol: 580,
    closes: '2025-12-31',
    status: 'open',
    minBet: 5,
    maxBet: 100
  },
  {
    id: 'mgl-constitution-amendment',
    cat: 'gov',
    mn: 'Үндсэн хуульд 2025 онд нэмэлт өөрчлөлт орох уу?',
    en: 'Will Mongolia amend its constitution in 2025?',
    yes: 28,
    vol: 320,
    closes: '2025-11-30',
    status: 'open',
    minBet: 5,
    maxBet: 100
  },
  // ── SPORT ──────────────────────────────────────────────────
  {
    id: 'mgl-football-worldcup-2026',
    cat: 'sport',
    mn: 'Монголын хөлбөмбөгийн шигшээ баг 2026 дэлхийн аварга шалгаруулалтын бүсийн тойргоос гарах уу?',
    en: 'Will Mongolia national football team advance from their 2026 WC qualifying group?',
    yes: 18,
    vol: 890,
    closes: '2025-10-15',
    status: 'open',
    minBet: 5,
    maxBet: 150
  },
  {
    id: 'mgl-wrestling-title-2025',
    cat: 'sport',
    mn: 'Монголын бөхчүүд 2025 дэлхийн чемпионатад 3+ алтан медаль авах уу?',
    en: 'Will Mongolian wrestlers win 3+ gold medals at the 2025 World Championship?',
    yes: 67,
    vol: 1100,
    closes: '2025-09-20',
    status: 'open',
    minBet: 5,
    maxBet: 100
  },
  {
    id: 'mgl-naadam-archery',
    cat: 'sport',
    mn: '2025 Наадмын сурын харваанд Увс аймаг тэргүүлэх уу?',
    en: 'Will Uvs Province top the archery standings at 2025 Naadam?',
    yes: 35,
    vol: 210,
    closes: '2025-07-13',
    status: 'open',
    minBet: 2,
    maxBet: 50
  },
  // ── BUSINESS ───────────────────────────────────────────────
  {
    id: 'mgl-mse-top100-2025',
    cat: 'biz',
    mn: 'МХБ-ийн TOP-20 индекс 2025 оны эцэс гэхэд 10%+ өсөх үү?',
    en: 'Will the MSE Top-20 index grow 10%+ by end of 2025?',
    yes: 55,
    vol: 760,
    closes: '2025-12-31',
    status: 'open',
    minBet: 5,
    maxBet: 200
  },
  {
    id: 'mgl-erdenes-tavan-ipo',
    cat: 'biz',
    mn: 'Эрдэнэс Тавантолгой ХК 2025 онд гадаад зах зээлд IPO хийх үү?',
    en: 'Will Erdenes Tavan Tolgoi conduct a foreign IPO in 2025?',
    yes: 22,
    vol: 440,
    closes: '2025-12-31',
    status: 'open',
    minBet: 5,
    maxBet: 100
  },
  {
    id: 'mgl-tugrik-usd-2025',
    cat: 'biz',
    mn: '1 ам.доллар 2025 оны эцэст 3,700 төгрөгөөс дээш байх уу?',
    en: 'Will USD/MNT exceed 3,700 by end of 2025?',
    yes: 60,
    vol: 920,
    closes: '2025-12-31',
    status: 'open',
    minBet: 5,
    maxBet: 150
  },
  // ── SOCIAL ─────────────────────────────────────────────────
  {
    id: 'mgl-ulaanbaatar-air-2025',
    cat: 'social',
    mn: 'Улаанбаатарын агаарын бохирдол 2025 өвлийн улиралд 2024 оноос буурах уу?',
    en: 'Will Ulaanbaatar air pollution be lower this winter 2025 vs 2024?',
    yes: 31,
    vol: 390,
    closes: '2026-03-01',
    status: 'open',
    minBet: 2,
    maxBet: 50
  },
  {
    id: 'mgl-population-4m',
    cat: 'social',
    mn: 'Монголын хүн ам 2025 онд 4 саяд хүрэх үү?',
    en: 'Will Mongolia reach a population of 4 million in 2025?',
    yes: 82,
    vol: 270,
    closes: '2025-12-31',
    status: 'open',
    minBet: 2,
    maxBet: 50
  },
  {
    id: 'mgl-crypto-legal-2025',
    cat: 'social',
    mn: 'Монгол улс 2025 онд крипто хөрөнгийг хуулиар зохицуулах уу?',
    en: 'Will Mongolia pass crypto regulation legislation in 2025?',
    yes: 40,
    vol: 680,
    closes: '2025-12-31',
    status: 'open',
    minBet: 5,
    maxBet: 100
  }
];

/* ── CATEGORY LABELS ────────────────────────────────────── */
const PM_CAT = {
  gov:    { mn: '🏛️ Улс төр',  en: '🏛️ Politics',  cls: 'pm-cat-gov'    },
  sport:  { mn: '⚽ Спорт',    en: '⚽ Sport',      cls: 'pm-cat-sport'  },
  biz:    { mn: '💼 Бизнес',   en: '💼 Business',   cls: 'pm-cat-biz'    },
  social: { mn: '🔥 Нийгэм',  en: '🔥 Social',     cls: 'pm-cat-social' }
};

/* ── STATE ──────────────────────────────────────────────── */
let pmCurrentCat  = 'all';
let pmCurrentLang = (typeof SITE_LANG !== 'undefined') ? SITE_LANG : 'mn';

/* ── OPEN / CLOSE ────────────────────────────────────────── */
function openPredictPage() {
  document.getElementById('predictOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderPMMarkets(pmCurrentCat);
  animatePMStats();
}

function closePredictPage() {
  document.getElementById('predictOverlay').classList.remove('on');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePredictPage();
});

/* ── STAT COUNTER ANIMATION ──────────────────────────────── */
function animatePMStats() {
  animateCount('pm-stat-markets', 0, PM_MARKETS.length, 600, '');
  animateCount('pm-stat-vol', 0, 4820, 900, '$');
  animateCount('pm-stat-traders', 0, 340, 750, '');
}

function animateCount(id, from, to, dur, prefix) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * ease);
    el.textContent = prefix + val.toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── FILTER TABS ─────────────────────────────────────────── */
/* ── WAITLIST MODAL ──────────────────────────────────────── */
function pmOpenWaitlist(marketId) {
  var lang   = (typeof SITE_LANG !== 'undefined') ? SITE_LANG : 'mn';
  var market = PM_MARKETS.find(function(m) { return m.id === marketId; });
  if (!market) return;
  var question = lang === 'en' ? market.en : market.mn;

  var existing = document.getElementById('pmWaitlistModal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'pmWaitlistModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = buildWaitlistModal(market, question, lang);
  document.body.appendChild(overlay);

  setTimeout(function() {
    var inp = document.getElementById('pmWaitlistEmail');
    if (inp) inp.focus();
  }, 100);
}

function buildWaitlistModal(market, question, lang) {
  var yesW = market.yes;
  var noW  = 100 - market.yes;
  var perks = [
    '🎯 ' + (lang === 'en' ? 'Be first to trade when markets go live' : 'Зах зээл нээгдэхэд хамгийн түрүүнд арилжаа хийх'),
    '💰 ' + (lang === 'en' ? 'Bonus shares on your first position' : 'Эхний байрлалд урамшуулал хувьцаа'),
    '🔔 ' + (lang === 'en' ? 'Launch notification via email & X' : 'Имэйл болон X-ээр нээлтийн мэдэгдэл'),
    '⚡ ' + (lang === 'en' ? 'Phantom wallet — 1-click trading on Solana' : 'Phantom wallet — Solana дээр 1 товшилтоор арилжаа')
  ];

  return '<div style="background:#111820;border:1px solid #1c2d38;border-radius:16px;padding:28px;max-width:440px;width:100%;position:relative">'
    + '<button onclick="document.getElementById(\'pmWaitlistModal\').remove()" style="position:absolute;top:14px;right:14px;background:transparent;border:none;color:#4d6475;font-size:18px;cursor:pointer;line-height:1">✕</button>'

    // Header
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
    +   '<div style="width:36px;height:36px;border-radius:50%;background:rgba(232,64,64,.15);border:1px solid rgba(232,64,64,.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔔</div>'
    +   '<div>'
    +     '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:2px;color:#e84040;margin-bottom:3px">'
    +       (lang === 'en' ? 'COMING SOON' : 'УДАХГҮЙ НЭЭГДЭНЭ')
    +     '</div>'
    +     '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;font-weight:700;color:#ccd8df">'
    +       (lang === 'en' ? 'Get Early Access' : 'Эрт хандалт авах')
    +     '</div>'
    +   '</div>'
    + '</div>'

    // Market preview card
    + '<div style="background:#0c1014;border:1px solid #1c2d38;border-radius:8px;padding:14px;margin-bottom:16px">'
    +   '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;color:#ccd8df;line-height:1.5;margin-bottom:10px">' + question + '</div>'
    +   '<div style="display:flex;justify-content:space-between;margin-bottom:5px">'
    +     '<span style="font-family:\'Space Mono\',monospace;font-size:9px;color:#00e87a">' + (lang === 'en' ? 'YES' : 'ТИЙМ') + ' ' + yesW + '%</span>'
    +     '<span style="font-family:\'Space Mono\',monospace;font-size:9px;color:#e84040">' + noW + '% ' + (lang === 'en' ? 'NO' : 'ҮГҮЙ') + '</span>'
    +   '</div>'
    +   '<div style="display:flex;gap:2px;height:5px;border-radius:3px;overflow:hidden">'
    +     '<div style="width:' + yesW + '%;background:linear-gradient(90deg,#00e87a,#00b85e)"></div>'
    +     '<div style="width:' + noW + '%;background:linear-gradient(90deg,#e84040,#c02020)"></div>'
    +   '</div>'
    + '</div>'

    // Perks
    + '<div style="background:rgba(232,64,64,.05);border:1px solid rgba(232,64,64,.15);border-radius:8px;padding:14px;margin-bottom:16px">'
    +   '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:1.5px;color:#e84040;margin-bottom:10px">'
    +     (lang === 'en' ? 'EARLY ACCESS INCLUDES' : 'ЭРТ ХАНДАЛТАД БАГТАХ ЗҮЙ')
    +   '</div>'
    +   perks.map(function(p) {
        return '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:12px;color:var(--muted);padding:3px 0">' + p + '</div>';
      }).join('')
    + '</div>'

    // Email input
    + '<div style="margin-bottom:10px">'
    +   '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:var(--muted);letter-spacing:1.5px;margin-bottom:7px">'
    +     (lang === 'en' ? 'YOUR EMAIL' : 'ТАНЫ ИМЭЙЛ')
    +   '</div>'
    +   '<input id="pmWaitlistEmail" type="email" placeholder="' + (lang === 'en' ? 'you@email.com' : 'та@имэйл.ком') + '"'
    +   ' style="width:100%;padding:11px 14px;background:#0c1014;border:1px solid #1c2d38;border-radius:8px;color:#ccd8df;font-family:\'Space Grotesk\',sans-serif;font-size:13px;box-sizing:border-box;outline:none;transition:border .15s"'
    +   ' onfocus="this.style.borderColor=\'#e84040\'" onblur="this.style.borderColor=\'#1c2d38\'">'
    + '</div>'

    // X handle
    + '<div style="margin-bottom:16px">'
    +   '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:var(--muted);letter-spacing:1.5px;margin-bottom:7px">'
    +     (lang === 'en' ? 'YOUR X HANDLE (OPTIONAL)' : 'ТАНЫ X ХАЯГ (ЗААВАЛ БИШ)')
    +   '</div>'
    +   '<input id="pmWaitlistX" type="text" placeholder="@username"'
    +   ' style="width:100%;padding:11px 14px;background:#0c1014;border:1px solid #1c2d38;border-radius:8px;color:#ccd8df;font-family:\'Space Grotesk\',sans-serif;font-size:13px;box-sizing:border-box;outline:none;transition:border .15s"'
    +   ' onfocus="this.style.borderColor=\'#e84040\'" onblur="this.style.borderColor=\'#1c2d38\'">'
    + '</div>'

    // Submit button
    + '<button onclick="pmSubmitWaitlist(\'' + market.id + '\')"'
    +   ' style="width:100%;padding:13px;background:linear-gradient(135deg,#e84040,#f4c542);border:none;border-radius:8px;font-family:\'Space Mono\',monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#000;cursor:pointer;transition:opacity .2s;margin-bottom:10px"'
    +   ' onmouseover="this.style.opacity=\'.85\'" onmouseout="this.style.opacity=\'1\'">'
    +   '🔔 ' + (lang === 'en' ? 'JOIN WAITLIST →' : 'ЖАГСААЛТАД БҮРТГҮҮЛЭХ →')
    + '</button>'

    + '<div style="text-align:center;font-family:\'Space Mono\',monospace;font-size:8px;color:var(--muted);line-height:1.7">'
    +   (lang === 'en' ? 'We respect your privacy. No spam — launch notification only.' : 'Бид таны нууцлалыг хүндэтгэнэ. Зөвхөн нээлтийн мэдэгдэл илгээнэ.')
    + '</div>'
    + '</div>';
}

/* ── SUBMIT WAITLIST ─────────────────────────────────────── */
function pmSubmitWaitlist(marketId) {
  var lang    = (typeof SITE_LANG !== 'undefined') ? SITE_LANG : 'mn';
  var emailEl = document.getElementById('pmWaitlistEmail');
  var xEl     = document.getElementById('pmWaitlistX');
  var email   = emailEl ? emailEl.value.trim() : '';
  var xHandle = xEl     ? xEl.value.trim()     : '';

  if (!email || !email.includes('@')) {
    if (typeof toast === 'function') toast(lang === 'en' ? 'Please enter a valid email' : 'Зөв имэйл хаяг оруулна уу', '#e84040');
    return;
  }

  // Store in localStorage (Railway endpoint can be wired later)
  var key   = 'pm_waitlist';
  var list  = [];
  try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
  var exists = list.some(function(r) { return r.email === email && r.market === marketId; });
  if (!exists) {
    list.push({ email: email, x: xHandle, market: marketId, ts: Date.now() });
    try { localStorage.setItem(key, JSON.stringify(list)); } catch(e) {}
  }

  var modal = document.getElementById('pmWaitlistModal');
  if (modal) modal.remove();

  if (typeof toast === 'function') {
    toast(
      lang === 'en' ? "✅ You're on the waitlist! We'll notify you at launch." : '✅ Жагсаалтад бүртгэгдлээ! Нээлтэд мэдэгдэл авна.',
      '#00e87a'
    );
  }

  // Bump trader count display
  var statEl = document.getElementById('pm-stat-traders');
  if (statEl) {
    var cur = parseInt(statEl.textContent.replace(/\D/g,'')) || 340;
    statEl.textContent = (cur + 1).toLocaleString();
  }
}

/* ── LEGACY stub so no errors if called ─────────────────── */
function pmBuyShare(marketId, side) {
  pmOpenWaitlist(marketId);
}

/* ── LANGUAGE SYNC ───────────────────────────────────────── */
const _origSetSiteLang = window.setSiteLang;
window.setSiteLang = function(lang) {
  if (_origSetSiteLang) _origSetSiteLang(lang);
  var overlay = document.getElementById('predictOverlay');
  if (overlay && overlay.classList.contains('on')) {
    renderPMMarkets(pmCurrentCat);
  }
  var pmMn = document.getElementById('pm-lang-mn');
  var pmEn = document.getElementById('pm-lang-en');
  if (pmMn && pmEn) {
    if (lang === 'mn') {
      pmMn.style.background = '#e84040'; pmMn.style.color = '#fff';
      pmEn.style.background = 'transparent'; pmEn.style.color = 'var(--muted)';
    } else {
      pmEn.style.background = '#e84040'; pmEn.style.color = '#fff';
      pmMn.style.background = 'transparent'; pmMn.style.color = 'var(--muted)';
    }
  }
};

/* ── EXPORTS ─────────────────────────────────────────────── */
window.openPredictPage   = openPredictPage;
window.closePredictPage  = closePredictPage;
window.filterPMMarkets   = filterPMMarkets;
window.pmBuyShare        = pmBuyShare;
window.pmOpenWaitlist    = pmOpenWaitlist;
window.pmSubmitWaitlist  = pmSubmitWaitlist;
window.pmCardClick       = pmCardClick;
