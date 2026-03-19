/* ═══════════════════════════════════════════════════════════
   CHAINROOT — ӨГӨӨЖ (Solana DeFi Hub) v5
   Full implementation for the existing overlay HTML
   Functions exposed: openYieldPage · closeYieldPage
                      openVaultDeposit · openYieldDeposit
                      handleVaultDeploy · updateVaultPreview
                      openYieldDocs · subscribePro
═══════════════════════════════════════════════════════════ */

/* ── open / close ──────────────────────────────────────── */

function openYieldPage() {
  const el = document.getElementById('yieldOverlay');
  if (!el) return;
  el.classList.add('on');
  document.body.style.overflow = 'hidden';
  const body = el.querySelector('.yl-body');
  if (body) body.scrollTop = 0;
}

function closeYieldPage() {
  const el = document.getElementById('yieldOverlay');
  if (!el) return;
  el.classList.remove('on');
  document.body.style.overflow = '';
}

/* ── vault deposit flow ────────────────────────────────── */

function openVaultDeposit(mintAddress) {
  const VAULT_MAP = {
    'So11111111111111111111111111111111111111112': {
      name: 'SOL / USDC Vault', apy: '24.7%', fee: '15%', risk: 'Low IL', protocol: 'Orca CLMM',
    },
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': {
      name: 'SOL / JTO Vault', apy: '38.2%', fee: '20%', risk: 'Med IL', protocol: 'Raydium CLMM',
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      name: 'USDC / USDT Vault', apy: '8.4%', fee: '10%', risk: 'No IL', protocol: 'Stable Pool',
    },
  };

  const vault = VAULT_MAP[mintAddress] || { name: 'DeFiMongo Vault', apy: '—', fee: '15%', risk: '—', protocol: '—' };

  const existing = document.getElementById('yl-deposit-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'yl-deposit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(4,8,12,.85);backdrop-filter:blur(6px);';
  modal.innerHTML = `
    <div style="background:#07090b;border:1px solid #1c2d38;border-radius:14px;padding:32px;max-width:420px;width:90%;font-family:'Space Grotesk',sans-serif;box-shadow:0 0 60px rgba(20,241,149,.08);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
        <div>
          <div style="font-size:17px;font-weight:700;color:#fff">${vault.name}</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#4d6475;margin-top:3px">${vault.protocol} · DeFiMongo</div>
        </div>
        <button onclick="document.getElementById('yl-deposit-modal').remove()" style="background:transparent;border:1px solid #1c2d38;color:#4d6475;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px">
        <div style="background:#111820;border:1px solid #1c2d38;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4d6475;margin-bottom:4px">APY</div>
          <div style="font-size:18px;font-weight:700;color:#14F195">${vault.apy}</div>
        </div>
        <div style="background:#111820;border:1px solid #1c2d38;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4d6475;margin-bottom:4px">PERF FEE</div>
          <div style="font-size:18px;font-weight:700;color:#ccd8df">${vault.fee}</div>
        </div>
        <div style="background:#111820;border:1px solid #1c2d38;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4d6475;margin-bottom:4px">IL RISK</div>
          <div style="font-size:18px;font-weight:700;color:#ccd8df">${vault.risk}</div>
        </div>
      </div>
      <div style="background:#0c1014;border:1px solid #1c2d38;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4d6475;margin-bottom:10px;letter-spacing:1.5px">HOW TO DEPOSIT</div>
        <div style="font-size:13px;color:#ccd8df;line-height:1.7">
          1. Connect your <strong style="color:#9945FF">Phantom</strong> wallet<br>
          2. Make sure you have SOL for gas (~0.01 SOL)<br>
          3. Vault deposits launching soon — join the waitlist below
        </div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(153,69,255,.08),rgba(20,241,149,.05));border:1px solid rgba(153,69,255,.2);border-radius:8px;padding:14px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#ccd8df;margin-bottom:10px">🚀 Be first when this vault opens</div>
        <input id="yl-waitlist-email" type="email" placeholder="your@email.com"
          style="background:#0c1014;border:1px solid #1c2d38;border-radius:6px;padding:9px 14px;width:100%;box-sizing:border-box;color:#fff;font-family:'Space Mono',monospace;font-size:12px;margin-bottom:10px;outline:none">
        <button onclick="submitYieldWaitlist('${vault.name}')"
          style="background:linear-gradient(135deg,#9945FF,#14F195);border:none;border-radius:6px;padding:10px 24px;width:100%;color:#000;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:.5px">
          Join Waitlist →
        </button>
      </div>
      <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4d6475;text-align:center;line-height:1.6">
        Non-custodial · Funds stay in your wallet until deposit · Withdraw anytime
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function openYieldDeposit() {
  const overlay = document.getElementById('yieldOverlay');
  const vaultSection = overlay ? overlay.querySelector('.yl-vaults') : null;
  if (vaultSection) vaultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── waitlist ──────────────────────────────────────────── */

function submitYieldWaitlist(vaultName) {
  const input = document.getElementById('yl-waitlist-email');
  const email = input ? input.value.trim() : '';

  if (!email || !email.includes('@')) {
    if (input) { input.style.borderColor = '#ff4d4d'; input.placeholder = 'Enter a valid email'; }
    return;
  }

  fetch(CR_API + '/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'yield-vault', vault: vaultName }),
  }).catch(function() {});

  const modal = document.getElementById('yl-deposit-modal');
  if (modal) {
    const inner = modal.querySelector('div');
    if (inner) inner.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:40px;margin-bottom:16px">🎉</div>
        <div style="font-size:18px;font-weight:700;color:#14F195;margin-bottom:8px">You're on the list!</div>
        <div style="font-family:'Space Mono',monospace;font-size:11px;color:#4d6475;margin-bottom:20px">We'll notify you when ${vaultName} deposits open.</div>
        <button onclick="document.getElementById('yl-deposit-modal').remove()"
          style="background:#14F195;border:none;border-radius:6px;padding:10px 28px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Done</button>
      </div>
    `;
  }
}

/* ── vault config panel ────────────────────────────────── */

function updateVaultPreview() {
  var name = document.getElementById('vaultName');
  var pair = document.getElementById('vaultPair');
  var perf = document.getElementById('perfFee');
  var mgmt = document.getElementById('mgmtFee');
  var addr = document.getElementById('vaultAddr');

  var pvName = document.getElementById('pvName');
  var pvPair = document.getElementById('pvPair');
  var pvPerf = document.getElementById('pvPerf');
  var pvMgmt = document.getElementById('pvMgmt');
  var pvAddr = document.getElementById('pvAddr');

  if (pvName) pvName.textContent = (name && name.value) ? name.value : 'DeFiMongo SOL/USDC Vault';
  if (pvPair) pvPair.textContent = (pair && pair.value) ? pair.value.replace('/', ' / ') : 'SOL / USDC';
  if (pvPerf) pvPerf.textContent = (perf && perf.value) ? perf.value + '%' : '15%';
  if (pvMgmt) pvMgmt.textContent = (mgmt && mgmt.value) ? mgmt.value + '%/yr' : '0%/yr';
  if (pvAddr) {
    var raw = addr && addr.value.trim();
    pvAddr.textContent = raw ? raw.slice(0,8) + '...' + raw.slice(-6) : 'Not yet deployed';
    pvAddr.style.color = raw ? '#14F195' : '#4d6475';
  }
}

function handleVaultDeploy() {
  var name = document.getElementById('vaultName');
  var addr = document.getElementById('vaultAddr');
  var vaultName = name ? name.value.trim() : '';
  var vaultAddr = addr ? addr.value.trim() : '';

  if (!vaultName) {
    if (name) { name.style.borderColor = '#ff4d4d'; name.focus(); }
    return;
  }
  if (!vaultAddr) {
    showYieldToast('Paste your vault address from the TypeScript SDK output first', 'warn');
    if (addr) { addr.style.borderColor = '#f4c542'; addr.focus(); }
    return;
  }
  showYieldToast('✅ Vault "' + vaultName + '" saved! ' + vaultAddr.slice(0,8) + '...', 'success');
}

/* ── docs link ─────────────────────────────────────────── */

function openYieldDocs() {
  var docsOverlay = document.getElementById('docsOverlay');
  if (docsOverlay && typeof openDocsPage === 'function') {
    closeYieldPage();
    openDocsPage();
  } else {
    var disclaimer = document.querySelector('.yl-disclaimer');
    if (disclaimer) disclaimer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ── pro subscription ──────────────────────────────────── */

function subscribePro() {
  showYieldToast('Pro AI Auto-Compound coming soon — join the waitlist!', 'info');
}

/* ── toast helper ──────────────────────────────────────── */

function showYieldToast(msg, type) {
  type = type || 'info';
  var COLOR = { success: '#14F195', warn: '#f4c542', info: '#9945FF', error: '#ff4d4d' };
  var existing = document.getElementById('yl-toast');
  if (existing) existing.remove();

  if (!document.getElementById('yl-toast-style')) {
    var s = document.createElement('style');
    s.id = 'yl-toast-style';
    s.textContent = '@keyframes yl-toast-in{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }

  var toast = document.createElement('div');
  toast.id = 'yl-toast';
  toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#111820;border:1px solid ' + (COLOR[type]||COLOR.info) + ';color:#fff;padding:12px 22px;border-radius:8px;font-family:\'Space Mono\',monospace;font-size:12px;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.6);animation:yl-toast-in .25s ease;pointer-events:none;white-space:nowrap;max-width:90vw;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, 3500);
}

/* ── expose globals ────────────────────────────────────── */

window.openYieldPage       = openYieldPage;
window.closeYieldPage      = closeYieldPage;
window.openVaultDeposit    = openVaultDeposit;
window.openYieldDeposit    = openYieldDeposit;
window.submitYieldWaitlist = submitYieldWaitlist;
window.updateVaultPreview  = updateVaultPreview;
window.handleVaultDeploy   = handleVaultDeploy;
window.openYieldDocs       = openYieldDocs;
window.subscribePro        = subscribePro;
