// ═══════════════════════════════════════════════════════════════
// AUTH PATCH — Add this at the BOTTOM of your auth.js file
// Fixes: mobile sidebar close + TV chart init on panel open
// ═══════════════════════════════════════════════════════════════

(function(){
  const _origGo = window.go;
  window.go = function(id, el) {
    // Close mobile sidebar on navigation
    const sb = document.querySelector('.sb');
    const overlay = document.getElementById('sbOverlay');
    if (sb) sb.classList.remove('mob-open');
    if (overlay) overlay.classList.remove('on');
    document.body.style.overflow = '';

    // Call original go()
    if (_origGo) _origGo(id, el);

    // Trigger TradingView chart inits for macro panels (lazy load)
    const tvMap = {
      'halving':    'initTVHalving',
      'low-cycles': 'initTVEpoch',
      'fed':        'initTVFed',
      'dxy':        'initTVDxy',
      'liquidity':  'initTVLiq',
      'ism':        'initTVIsm',
      'social-risk':'initTVSocial',
      'perf-year':  'initTVYearly',
    };
    if (tvMap[id] && typeof window[tvMap[id]] === 'function') {
      setTimeout(function(){ window[tvMap[id]](); }, 100);
    }
  };
})();
