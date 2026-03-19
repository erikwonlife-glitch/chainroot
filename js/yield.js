/* ═══════════════════════════════════════════════════════════
   CHAINROOT — ӨГӨӨЖ (Solana DeFi Hub) v2
   AI + Safe Yield for Mongolians — Solana + Phantom
═══════════════════════════════════════════════════════════ */

let currentVault = null;

function openYieldPage() {
  document.getElementById('yieldOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderYieldDashboard();
}

function closeYieldPage() {
  document.getElementById('yieldOverlay').classList.remove('on');
  document.body.style.overflow = '';
}

async function renderYieldDashboard() {
  // Fetch live DeFi data from your existing Railway backend + public Solana APIs
  const tvlData = await fetch(`${CR_API}/api/defi/tvl`).then(r => r.json()).catch(() => ({}));
  const dexData = await fetch(`${CR_API}/api/defi/dex`).then(r => r.json()).catch(() => ({}));

  const html = `
    <div class="yl-header">
      <div class="yl-title">ӨГӨӨЖ — Solana DeFi</div>
      <div class="yl-subtitle">Монголчуудад зориулсан хамгийн аюулгүй + өндөр өгөөжтэй платформ</div>
    </div>

    <div class="yl-stats-grid">
      <div class="yl-stat">
        <div class="yl-stat-label">Нийт TVL</div>
        <div class="yl-stat-value">$${(tvlData.totalTVL||0).toLocaleString()}</div>
      </div>
      <div class="yl-stat">
        <div class="yl-stat-label">Өнөөдрийн APY</div>
        <div class="yl-stat-value">14.8% <span style="font-size:11px;color:#00e87a">↑</span></div>
      </div>
      <div class="yl-stat">
        <div class="yl-stat-label">AI Risk Score</div>
        <div class="yl-stat-value" style="color:#00e87a">92/100</div>
      </div>
    </div>

    <div class="yl-vaults">
      <h3>Сонголттой Vault-ууд (Solana)</h3>
      ${renderVaultCards()}
    </div>

    <div class="yl-ai-section">
      <div class="yl-ai-box">
        <div class="yl-ai-title">AI Optimizer (Pro)</div>
        <div class="yl-ai-desc">Таны эрсдэлийн профайлд тохирсон vault-ыг автоматаар сонгож, auto-compound хийнэ</div>
        <button onclick="subscribePro()" class="yl-pro-btn">9$/сар — Pro AI ашиглах</button>
      </div>
    </div>
  `;

  document.querySelector('#yieldOverlay .yl-content').innerHTML = html;
}

function renderVaultCards() {
  const vaults = [
    {name:"USDC Stable Vault", apy:"12.4%", risk:"Low", protocol:"Kamino", tvl:"$4.2M"},
    {name:"SOL Staking Vault", apy:"8.9%",  risk:"Medium", protocol:"Jito", tvl:"$12.8M"},
    {name:"MNT-pegged Vault", apy:"15.2%", risk:"Low", protocol:"Marginfi", tvl:"$890K"}
  ];

  return vaults.map(v => `
    <div class="yl-vault-card" onclick="selectVault('${v.name}')">
      <div class="yl-vault-name">${v.name}</div>
      <div class="yl-vault-apy">${v.apy} APY</div>
      <div class="yl-vault-risk">${v.risk} Risk</div>
      <div class="yl-vault-protocol">${v.protocol} • TVL $${v.tvl}</div>
    </div>
  `).join('');
}

function selectVault(name) {
  currentVault = name;
  alert(`✅ ${name} сонгогдлоо!\n\nPhantom wallet-аа холбож deposit хийгээд өгөөжөө аваарай.\n(Pro subscription-тай бол AI auto-compound идэвхжинэ)`);
}

function subscribePro() {
  window.open('https://gumroad.com/l/chainroot-pro', '_blank');
}

window.openYieldPage = openYieldPage;
window.closeYieldPage = closeYieldPage;
