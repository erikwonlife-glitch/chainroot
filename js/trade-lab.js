// ════════════════════════════════════════════════════════════════════════════
// DEFIMONGO — TRADE LAB
// ════════════════════════════════════════════════════════════════════════════

const TL = (function(){

  // ── HELPERS ──────────────────────────────────────────────────────────────

  function tier(){ return typeof getTier === 'function' ? getTier() : 0; }
  function tierName(){ return typeof getTierName === 'function' ? getTierName() : 'FREE'; }
  function tierColor(){ return typeof getTierColor === 'function' ? getTierColor() : '#4a6070'; }

  // ── JOURNAL STATE ─────────────────────────────────────────────────────────

  const JOURNAL_KEY = 'dfm_journal_v1';
  let _jDir = 'BUY';

  // ── LOCKED CARD ──────────────────────────────────────────────────────────

  function lockedCard(title, desc, btnLabel){
    return `
      <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px;text-align:center">
        <div style="font-size:32px;margin-bottom:16px">🔒</div>
        <div style="font-family:'Space Mono',monospace;font-size:16px;color:#fff;margin-bottom:12px">${title}</div>
        <div style="font-size:13px;color:#4a6070;line-height:1.6;max-width:360px;margin:0 auto 24px">${desc}</div>
        <button style="background:#9945FF;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer">${btnLabel}</button>
      </div>`;
  }

  // ── PLACEHOLDER CARD ─────────────────────────────────────────────────────

  function placeholderCard(icon, title, text, extra){
    return `
      <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:12px;padding:24px">
        <div style="font-size:32px;margin-bottom:12px">${icon}</div>
        <div style="font-family:'Space Mono',monospace;font-size:16px;color:#ccd8df;margin-bottom:8px">${title}</div>
        ${text ? `<div style="font-size:13px;color:#4a6070;line-height:1.6">${text}</div>` : ''}
        ${extra || ''}
      </div>`;
  }

  // ── TAB CONTENT BUILDERS ─────────────────────────────────────────────────

  function signalsContent(){
    const t = tier();
    const badge = t >= 2
      ? `<span style="background:rgba(0,232,122,0.15);color:#00e87a;border:1px solid rgba(0,232,122,0.3);border-radius:4px;padding:3px 10px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px">LIVE</span>`
      : `<span style="background:rgba(255,107,53,0.15);color:#ff6b35;border:1px solid rgba(255,107,53,0.3);border-radius:4px;padding:3px 10px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px">48H DELAY</span>`;
    return placeholderCard(
      '📡',
      'Signal Feed',
      'Live buy/sell signals from the DeFiMongo TradingView indicator. Free tier sees signals with 48-hour delay.',
      `<div style="margin-top:16px;display:flex;align-items:center;gap:8px">
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070">Your tier:</span>
        ${badge}
      </div>`
    );
  }

  // ── JOURNAL: STORAGE ─────────────────────────────────────────────────────

  function jLoadTrades(){
    try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch(e){ return []; }
  }
  function jSaveTrades(trades){
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(trades)); } catch(e){}
  }

  // ── JOURNAL: CONTENT HTML ─────────────────────────────────────────────────

  function journalContent(){
    const t      = tier();
    const trades = jLoadTrades();
    const count  = trades.length;
    const today  = new Date().toISOString().slice(0, 10);

    const tierInfo = t < 2
      ? `<span style="color:#ff6b35;font-family:'Space Mono',monospace;font-size:10px">Free tier: ${count}/10 trades used</span>`
      : `<span style="color:#00e87a;font-family:'Space Mono',monospace;font-size:10px">Pro · Unlimited trades</span>`;

    const inp  = `width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:13px;font-family:'Space Mono',monospace;outline:none`;
    const lbl  = `display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px`;
    const grid = `display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:16px`;

    const tagId = t => 'tl-jrn-tag-' + t.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const TAGS  = ['Scalp', 'Swing', 'Position', 'Signal-Based'];

    return `
      <!-- ── FORM CARD ── -->
      <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:12px;padding:24px;margin-bottom:20px">

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          <div>
            <div style="font-family:'Space Mono',monospace;font-size:16px;color:#ccd8df;margin-bottom:4px">📓 TRADE JOURNAL</div>
            <div id="tl-jrn-tier">${tierInfo}</div>
          </div>
        </div>

        <!-- Row 1: Date | Symbol | Direction -->
        <div style="${grid}">
          <div>
            <label style="${lbl}">Date</label>
            <input id="tl-jrn-date" type="date" value="${today}"
              style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
          <div>
            <label style="${lbl}">Symbol</label>
            <input id="tl-jrn-sym" type="text" placeholder="BTC, ETH, SOL..."
              oninput="TL.calcPnl()" style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
          <div>
            <label style="${lbl}">Direction</label>
            <div style="display:flex;gap:8px">
              <button id="tl-jrn-buy" onclick="TL.setDirection('BUY')"
                style="flex:1;padding:10px 0;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:#00e87a;color:#000;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">BUY</button>
              <button id="tl-jrn-sell" onclick="TL.setDirection('SELL')"
                style="flex:1;padding:10px 0;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:#060d12;color:#4a6070;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">SELL</button>
            </div>
          </div>
        </div>

        <!-- Row 2: Entry | Exit | Position Size -->
        <div style="${grid}">
          <div>
            <label style="${lbl}">Entry Price ($)</label>
            <input id="tl-jrn-entry" type="number" min="0" step="any"
              oninput="TL.calcPnl()" style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
          <div>
            <label style="${lbl}">Exit Price ($)</label>
            <input id="tl-jrn-exit" type="number" min="0" step="any"
              oninput="TL.calcPnl()" style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
          <div>
            <label style="${lbl}">Position Size ($)</label>
            <input id="tl-jrn-size" type="number" min="0" step="any"
              oninput="TL.calcPnl()" style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
        </div>

        <!-- Row 3: Fees | Tags | Notes -->
        <div style="${grid};margin-bottom:20px">
          <div>
            <label style="${lbl}">Fees ($)</label>
            <input id="tl-jrn-fees" type="number" value="0" min="0" step="any"
              oninput="TL.calcPnl()" style="${inp}"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>
          <div>
            <label style="${lbl}">Tags</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:4px">
              ${TAGS.map(tag => `
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
                  <input type="checkbox" id="${tagId(tag)}" value="${tag}"
                    style="accent-color:#00b4d8;cursor:pointer;width:13px;height:13px"/>
                  <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070">${tag}</span>
                </label>`).join('')}
            </div>
          </div>
          <div>
            <label style="${lbl}">Notes</label>
            <textarea id="tl-jrn-notes" rows="2" placeholder="Optional notes..."
              style="${inp};resize:vertical;line-height:1.5"></textarea>
          </div>
        </div>

        <!-- Live P&L preview -->
        <div id="tl-jrn-pnl" style="font-family:'Space Mono',monospace;font-size:13px;color:#4a6070;margin-bottom:14px;text-align:center">
          Estimated P&amp;L: —
        </div>

        <!-- Free tier gate message -->
        <div id="tl-jrn-limit" style="display:none;font-family:'Space Mono',monospace;font-size:11px;color:#ff6b35;text-align:center;margin-bottom:10px">
          🔒 Free tier limit reached (10/10). Upgrade to Pro for unlimited trades.
        </div>

        <!-- Save button -->
        <button id="tl-jrn-save-btn" onclick="TL.saveTrade()"
          style="background:#00e87a;color:#000;border:none;border-radius:8px;padding:14px;width:100%;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;cursor:pointer;transition:opacity .15s">
          SAVE TRADE
        </button>
      </div>

      <!-- ── TRADE LIST CARD ── -->
      <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:12px;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-family:'Space Mono',monospace;font-size:13px;color:#ccd8df">Trade History</div>
          <button onclick="TL._exportCsv()"
            style="background:transparent;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:6px 14px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;cursor:pointer;transition:border-color .15s"
            onmouseover="this.style.borderColor='#00b4d8'" onmouseout="this.style.borderColor='rgba(0,180,216,0.2)'">
            📥 EXPORT CSV
          </button>
        </div>
        <div id="tl-jrn-list"></div>
      </div>`;
  }

  // ── JOURNAL: DIRECTION TOGGLE ─────────────────────────────────────────────

  function jSetDirection(dir){
    _jDir = dir;
    const buyBtn  = document.getElementById('tl-jrn-buy');
    const sellBtn = document.getElementById('tl-jrn-sell');
    if(buyBtn && sellBtn){
      if(dir === 'BUY'){
        buyBtn.style.background  = '#00e87a'; buyBtn.style.color  = '#000';
        sellBtn.style.background = '#060d12'; sellBtn.style.color = '#4a6070';
      } else {
        sellBtn.style.background = '#ff4444'; sellBtn.style.color = '#fff';
        buyBtn.style.background  = '#060d12'; buyBtn.style.color  = '#4a6070';
      }
    }
    jCalcPnl();
  }

  // ── JOURNAL: LIVE P&L PREVIEW ─────────────────────────────────────────────

  function jCalcPnl(){
    const entry = parseFloat(document.getElementById('tl-jrn-entry')?.value) || 0;
    const exit  = parseFloat(document.getElementById('tl-jrn-exit')?.value)  || 0;
    const size  = parseFloat(document.getElementById('tl-jrn-size')?.value)  || 0;
    const fees  = parseFloat(document.getElementById('tl-jrn-fees')?.value)  || 0;
    const el    = document.getElementById('tl-jrn-pnl');
    if(!el) return;

    if(!entry || !exit || !size){
      el.innerHTML = 'Estimated P&amp;L: —';
      el.style.color = '#4a6070';
      return;
    }

    const pnl    = _jDir === 'BUY'
      ? (exit - entry) / entry * size - fees
      : (entry - exit) / entry * size - fees;
    const pct    = ((exit - entry) / entry * 100) * (_jDir === 'BUY' ? 1 : -1);
    const sign   = pnl >= 0 ? '+' : '';
    const color  = pnl > 0 ? '#00e87a' : pnl < 0 ? '#ff4444' : '#4a6070';

    el.innerHTML = `Estimated P&amp;L: <strong style="color:${color}">${sign}$${Math.abs(pnl).toFixed(2)} (${sign}${pct.toFixed(2)}%)</strong>`;
    el.style.color = color;
  }

  // ── JOURNAL: SAVE TRADE ───────────────────────────────────────────────────

  function jSaveTrade(){
    const t      = tier();
    const trades = jLoadTrades();
    if(t < 2 && trades.length >= 10) return;

    const entry  = parseFloat(document.getElementById('tl-jrn-entry')?.value) || 0;
    const exit   = parseFloat(document.getElementById('tl-jrn-exit')?.value)  || 0;
    const size   = parseFloat(document.getElementById('tl-jrn-size')?.value)  || 0;
    const fees   = parseFloat(document.getElementById('tl-jrn-fees')?.value)  || 0;
    const date   = document.getElementById('tl-jrn-date')?.value  || new Date().toISOString().slice(0,10);
    const sym    = (document.getElementById('tl-jrn-sym')?.value  || '').trim().toUpperCase();
    const notes  = document.getElementById('tl-jrn-notes')?.value || '';

    if(!sym || !entry || !exit || !size){
      if(typeof toast === 'function') toast('Fill in Symbol, Entry, Exit, and Position Size', '#f4c542');
      return;
    }

    const pnl    = _jDir === 'BUY'
      ? (exit - entry) / entry * size - fees
      : (entry - exit) / entry * size - fees;
    const pnlPct = ((exit - entry) / entry * 100) * (_jDir === 'BUY' ? 1 : -1);

    const TAGS = ['Scalp', 'Swing', 'Position', 'Signal-Based'];
    const tags = TAGS.filter(tag =>
      document.getElementById('tl-jrn-tag-' + tag.toLowerCase().replace(/[^a-z0-9]/g, '-'))?.checked
    );

    trades.push({
      id: 'trd_' + Date.now(),
      date, symbol: sym, direction: _jDir,
      entryPrice: entry, exitPrice: exit,
      positionSize: size, fees, tags, notes,
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(pnlPct.toFixed(2)),
      savedAt: Date.now()
    });
    jSaveTrades(trades);

    // Reset form
    ['tl-jrn-sym','tl-jrn-entry','tl-jrn-exit','tl-jrn-size','tl-jrn-notes'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    const feesEl = document.getElementById('tl-jrn-fees'); if(feesEl) feesEl.value = '0';
    TAGS.forEach(tag => {
      const cb = document.getElementById('tl-jrn-tag-' + tag.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      if(cb) cb.checked = false;
    });
    const pnlEl = document.getElementById('tl-jrn-pnl');
    if(pnlEl){ pnlEl.innerHTML = 'Estimated P&amp;L: —'; pnlEl.style.color = '#4a6070'; }

    if(typeof toast === 'function') toast('Trade saved!', '#00e87a');
    jRenderList();
  }

  // ── JOURNAL: DELETE TRADE ─────────────────────────────────────────────────

  function jDeleteTrade(id){
    jSaveTrades(jLoadTrades().filter(tr => tr.id !== id));
    jRenderList();
  }

  // ── JOURNAL: RENDER LIST ──────────────────────────────────────────────────

  function jRenderList(){
    const listEl = document.getElementById('tl-jrn-list');
    if(!listEl) return;

    const t      = tier();
    const trades = jLoadTrades();
    const count  = trades.length;

    // Refresh tier badge
    const tierEl = document.getElementById('tl-jrn-tier');
    if(tierEl){
      tierEl.innerHTML = t < 2
        ? `<span style="color:#ff6b35;font-family:'Space Mono',monospace;font-size:10px">Free tier: ${count}/10 trades used</span>`
        : `<span style="color:#00e87a;font-family:'Space Mono',monospace;font-size:10px">Pro · Unlimited trades</span>`;
    }

    // Gate: disable save btn when free tier full
    const saveBtn  = document.getElementById('tl-jrn-save-btn');
    const limitMsg = document.getElementById('tl-jrn-limit');
    const atLimit  = t < 2 && count >= 10;
    if(saveBtn){
      saveBtn.disabled     = atLimit;
      saveBtn.style.opacity  = atLimit ? '0.4' : '1';
      saveBtn.style.cursor   = atLimit ? 'not-allowed' : 'pointer';
    }
    if(limitMsg) limitMsg.style.display = atLimit ? 'block' : 'none';

    // Empty state
    if(!count){
      listEl.innerHTML = `<div style="text-align:center;padding:32px;font-family:'Space Mono',monospace;font-size:11px;color:#4a6070">No trades yet. Add your first trade above.</div>`;
      return;
    }

    const th = s => `<th style="padding:10px 12px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-align:left;text-transform:uppercase;white-space:nowrap">${s}</th>`;

    const rows = [...trades].reverse().map((tr, i) => {
      const rowBg    = i % 2 === 1 ? 'rgba(0,180,216,0.02)' : 'transparent';
      const pnlColor = tr.pnl > 0 ? '#00e87a' : tr.pnl < 0 ? '#ff4444' : '#4a6070';
      const sign     = tr.pnl >= 0 ? '+' : '';
      const dirColor = tr.direction === 'BUY' ? '#00e87a' : '#ff4444';
      const dirBg    = tr.direction === 'BUY' ? 'rgba(0,232,122,0.1)' : 'rgba(255,68,68,0.1)';
      const td       = (content, extra='') => `<td style="padding:10px 12px;${extra}">${content}</td>`;

      return `<tr style="background:${rowBg};border-bottom:1px solid rgba(255,255,255,0.03)">
        ${td(`<span style="font-family:'Space Mono',monospace;font-size:11px;color:#ccd8df">${tr.date}</span>`)}
        ${td(`<span style="font-family:'Space Mono',monospace;font-size:13px;color:#ccd8df;font-weight:700">${tr.symbol||'—'}</span>`)}
        ${td(`<span style="background:${dirBg};color:${dirColor};border-radius:4px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700">${tr.direction}</span>`)}
        ${td(`<span style="font-family:'Space Mono',monospace;font-size:12px;color:#ccd8df">$${(+tr.entryPrice).toLocaleString()}</span>`)}
        ${td(`<span style="font-family:'Space Mono',monospace;font-size:12px;color:#ccd8df">$${(+tr.exitPrice).toLocaleString()}</span>`)}
        ${td(`<span style="font-family:'Space Mono',monospace;font-size:13px;color:${pnlColor};font-weight:700">${sign}$${Math.abs(tr.pnl||0).toFixed(2)}</span>`)}
        ${td(`<span style="font-size:11px;color:#4a6070">${(tr.tags||[]).join(', ')||'—'}</span>`)}
        ${td(`<button onclick="TL.deleteTrade('${tr.id}')" style="background:transparent;border:none;color:#ff4444;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px">×</button>`)}
      </tr>`;
    }).join('');

    listEl.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid rgba(0,180,216,0.1)">
              ${th('Date')}${th('Symbol')}${th('Dir')}${th('Entry')}${th('Exit')}${th('P&amp;L')}${th('Tags')}<th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── JOURNAL: EXPORT CSV ───────────────────────────────────────────────────

  function jExportCsv(){
    const trades = jLoadTrades();
    if(!trades.length){ if(typeof toast==='function') toast('No trades to export','#f4c542'); return; }
    const headers = ['Date','Symbol','Direction','Entry Price','Exit Price','Position Size','Fees','P&L','P&L %','Tags','Notes'];
    const rows    = trades.map(tr => [
      tr.date, tr.symbol, tr.direction,
      tr.entryPrice, tr.exitPrice, tr.positionSize, tr.fees,
      tr.pnl, tr.pnlPct,
      (tr.tags||[]).join(';'),
      '"' + (tr.notes||'').replace(/"/g,'""') + '"'
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const url  = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    const a    = document.createElement('a');
    a.href = url; a.download = 'dfm_trades.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function riskContent(){
    return `
      <div>
        <!-- Header -->
        <div style="margin-bottom:20px">
          <div style="font-family:'Space Mono',monospace;font-size:16px;color:#ccd8df;margin-bottom:4px">🧮 RISK CALCULATOR</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;letter-spacing:1px">Always free · All tiers</div>
        </div>

        <!-- Inputs grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Account Size ($)</label>
            <input id="tl-rc-account" type="number" value="10000" min="0" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Risk Per Trade (%)</label>
            <input id="tl-rc-risk-pct" type="number" value="2" min="0.01" max="100" step="0.1" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Entry Price ($)</label>
            <input id="tl-rc-entry" type="number" min="0" step="any" placeholder="e.g. 65000" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Stop Loss Price ($)</label>
            <input id="tl-rc-sl" type="number" min="0" step="any" placeholder="e.g. 63000" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Take Profit Price ($)</label>
            <input id="tl-rc-tp" type="number" min="0" step="any" placeholder="Optional" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

          <div>
            <label style="display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Asset Ticker</label>
            <input id="tl-rc-ticker" type="text" placeholder="e.g. BTC, ETH, SOL" oninput="TL._calcRisk()"
              style="width:100%;box-sizing:border-box;background:#060d12;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:10px 14px;color:#ccd8df;font-size:14px;font-family:'Space Mono',monospace;outline:none"
              onfocus="this.style.borderColor='#00b4d8'" onblur="this.style.borderColor='rgba(0,180,216,0.2)'"/>
          </div>

        </div>

        <!-- Warning -->
        <div id="tl-rc-warn" style="display:none;color:#f4c542;font-family:'Space Mono',monospace;font-size:12px;margin-bottom:16px"></div>

        <!-- Outputs -->
        <div id="tl-rc-outputs" style="display:none">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">

            <div style="background:#060d12;border:1px solid rgba(0,232,122,0.15);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;text-transform:uppercase;letter-spacing:1px">Dollar Risk</span>
              <span id="tl-rc-out-risk" style="font-family:'Space Mono',monospace;font-size:16px;color:#00e87a;font-weight:700">—</span>
            </div>

            <div style="background:#060d12;border:1px solid rgba(0,232,122,0.15);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;text-transform:uppercase;letter-spacing:1px">Position Size</span>
              <span id="tl-rc-out-units" style="font-family:'Space Mono',monospace;font-size:16px;color:#00e87a;font-weight:700">—</span>
            </div>

            <div style="background:#060d12;border:1px solid rgba(0,232,122,0.15);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;text-transform:uppercase;letter-spacing:1px">Position (USD)</span>
              <span id="tl-rc-out-usd" style="font-family:'Space Mono',monospace;font-size:16px;color:#00e87a;font-weight:700">—</span>
            </div>

            <div id="tl-rc-rr-card" style="background:#060d12;border:1px solid rgba(0,232,122,0.15);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;text-transform:uppercase;letter-spacing:1px">R:R Ratio</span>
              <span id="tl-rc-out-rr" style="font-family:'Space Mono',monospace;font-size:16px;color:#4a6070;font-weight:700">—</span>
            </div>

            <div id="tl-rc-profit-card" style="background:#060d12;border:1px solid rgba(0,232,122,0.15);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;text-transform:uppercase;letter-spacing:1px">Potential Profit</span>
              <span id="tl-rc-out-profit" style="font-family:'Space Mono',monospace;font-size:16px;color:#4a6070;font-weight:700">—</span>
            </div>

          </div>

          <!-- R:R bar -->
          <div>
            <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;letter-spacing:1px;margin-bottom:6px">
              <span>RISK</span><span>REWARD</span>
            </div>
            <div style="height:12px;border-radius:6px;overflow:hidden;display:flex;background:rgba(255,255,255,0.04)">
              <div id="tl-rc-bar-risk" style="height:100%;background:#ff4444;transition:width .3s"></div>
              <div id="tl-rc-bar-reward" style="height:100%;background:#00e87a;transition:width .3s"></div>
            </div>
            <div id="tl-rc-bar-hint" style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;margin-top:6px;text-align:center"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div id="tl-rc-empty" style="font-family:'Space Mono',monospace;font-size:11px;color:#4a6070;text-align:center;padding:20px 0">
          Enter entry price and stop loss to see position sizing
        </div>

      </div>`;
  }

  function calcRisk(){
    const account  = parseFloat(document.getElementById('tl-rc-account')?.value)  || 0;
    const riskPct  = parseFloat(document.getElementById('tl-rc-risk-pct')?.value) || 0;
    const entry    = parseFloat(document.getElementById('tl-rc-entry')?.value)    || 0;
    const sl       = parseFloat(document.getElementById('tl-rc-sl')?.value)       || 0;
    const tp       = parseFloat(document.getElementById('tl-rc-tp')?.value)       || 0;
    const ticker   = (document.getElementById('tl-rc-ticker')?.value || '').trim().toUpperCase() || 'UNITS';

    const warn    = document.getElementById('tl-rc-warn');
    const outputs = document.getElementById('tl-rc-outputs');
    const empty   = document.getElementById('tl-rc-empty');

    // Need at least entry and SL to compute anything
    if(!entry || !sl){
      if(warn)  { warn.style.display='none'; warn.textContent=''; }
      if(outputs){ outputs.style.display='none'; }
      if(empty)  { empty.style.display='block'; }
      return;
    }

    // Validation
    if(entry <= sl){
      if(warn)  { warn.style.display='block'; warn.textContent='⚠️ Stop loss must be below entry price'; }
      if(outputs){ outputs.style.display='none'; }
      if(empty)  { empty.style.display='none'; }
      return;
    }

    if(warn)  { warn.style.display='none'; warn.textContent=''; }
    if(empty)  { empty.style.display='none'; }
    if(outputs){ outputs.style.display='block'; }

    // Core calculations
    const dollarRisk     = account * (riskPct / 100);
    const slDistance     = Math.abs(entry - sl);
    const positionUnits  = dollarRisk / slDistance;
    const positionUSD    = positionUnits * entry;
    const hasTp          = tp > 0;
    const rrRatio        = hasTp ? Math.abs(tp - entry) / slDistance : null;
    const potentialProfit= hasTp ? positionUnits * Math.abs(tp - entry) : null;

    // Format helpers
    const usd = n => '$' + n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    const dec = (n, d=5) => parseFloat(n.toPrecision(d)).toString();

    // Outputs
    const elRisk   = document.getElementById('tl-rc-out-risk');
    const elUnits  = document.getElementById('tl-rc-out-units');
    const elUSD    = document.getElementById('tl-rc-out-usd');
    const elRR     = document.getElementById('tl-rc-out-rr');
    const elProfit = document.getElementById('tl-rc-out-profit');
    const barRisk  = document.getElementById('tl-rc-bar-risk');
    const barReward= document.getElementById('tl-rc-bar-reward');
    const barHint  = document.getElementById('tl-rc-bar-hint');

    if(elRisk)  elRisk.textContent  = usd(dollarRisk);
    if(elUnits) elUnits.textContent = dec(positionUnits) + ' ' + ticker;
    if(elUSD)   elUSD.textContent   = usd(positionUSD);

    if(elRR){
      if(hasTp && rrRatio !== null){
        elRR.textContent  = rrRatio.toFixed(2) + ' : 1';
        elRR.style.color  = rrRatio >= 2 ? '#00e87a' : rrRatio >= 1 ? '#f4c542' : '#ff4560';
      } else {
        elRR.textContent  = '—';
        elRR.style.color  = '#4a6070';
      }
    }

    if(elProfit){
      if(hasTp && potentialProfit !== null){
        elProfit.textContent = usd(potentialProfit);
        elProfit.style.color = '#00e87a';
      } else {
        elProfit.textContent = '—';
        elProfit.style.color = '#4a6070';
      }
    }

    // R:R bar
    if(barRisk && barReward && barHint){
      if(hasTp && rrRatio !== null){
        const total     = 1 + rrRatio;
        const riskPct2  = (1 / total * 100).toFixed(1);
        const rewardPct = (rrRatio / total * 100).toFixed(1);
        barRisk.style.width   = riskPct2 + '%';
        barReward.style.width = rewardPct + '%';
        barHint.textContent   = '';
      } else {
        barRisk.style.width   = '100%';
        barReward.style.width = '0%';
        barHint.textContent   = 'Enter Take Profit to see R:R ratio';
        barRisk.style.background = '#333';
      }
      if(hasTp) barRisk.style.background = '#ff4444';
    }
  }

  // ── STATS: CALCULATIONS ───────────────────────────────────────────────────

  function sCalc(trades){
    const total   = trades.length;
    if(!total) return null;
    const wins    = trades.filter(t => t.pnl > 0);
    const losses  = trades.filter(t => t.pnl < 0);
    const totalPnl   = trades.reduce((s, t) => s + (t.pnl||0), 0);
    const sumWins    = wins.reduce((s, t) => s + t.pnl, 0);
    const sumLosses  = losses.reduce((s, t) => s + t.pnl, 0);
    const pf         = sumLosses === 0 ? Infinity : sumWins / Math.abs(sumLosses);
    const best       = Math.max(...trades.map(t => t.pnl));
    const worst      = Math.min(...trades.map(t => t.pnl));

    // Streak analysis
    let curStreak = 0, curType = null;
    let bestWin = 0, bestLoss = 0, tmpWin = 0, tmpLoss = 0;
    trades.forEach(t => {
      const w = t.pnl > 0;
      if(w){ tmpWin++; tmpLoss=0; } else { tmpLoss++; tmpWin=0; }
      if(tmpWin  > bestWin)  bestWin  = tmpWin;
      if(tmpLoss > bestLoss) bestLoss = tmpLoss;
    });
    // Current streak from the end
    for(let i = trades.length - 1; i >= 0; i--){
      const w = trades[i].pnl > 0;
      if(curType === null) curType = w;
      if(w === curType) curStreak++;
      else break;
    }

    return {
      total, wins: wins.length, losses: losses.length,
      winRate: (wins.length / total * 100),
      totalPnl, avgPnl: totalPnl / total,
      pf, best, worst,
      avgWinner: wins.length  ? sumWins   / wins.length   : 0,
      avgLoser:  losses.length? sumLosses / losses.length : 0,
      curStreak, curType, bestWin, bestLoss,
    };
  }

  // ── STATS: RENDER ─────────────────────────────────────────────────────────

  function sRenderStats(){
    const wrap = document.getElementById('tl-stats-body');
    if(!wrap) return;
    const trades = jLoadTrades();
    const s      = sCalc(trades);

    if(!s){
      wrap.innerHTML = `<div style="text-align:center;padding:40px;font-family:'Space Mono',monospace;font-size:11px;color:#4a6070">No trades yet — add trades in the Journal tab.</div>`;
      return;
    }

    const usd  = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    const col  = (n, pos='#00e87a', neg='#ff4444', neu='#ccd8df') => n > 0 ? pos : n < 0 ? neg : neu;
    const card = (label, value, color='#ccd8df') =>
      `<div style="background:#060d12;border:1px solid rgba(0,180,216,0.12);border-radius:10px;padding:16px 20px">
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">${label}</div>
        <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${color}">${value}</div>
      </div>`;

    const pfVal   = s.pf === Infinity ? '∞' : s.pf.toFixed(2);
    const pfColor = s.pf > 1 ? '#00e87a' : '#ff4444';
    const wrColor = s.winRate >= 50 ? '#00e87a' : '#ff4444';

    // Win/loss bar
    const winPct  = (s.wins / s.total * 100).toFixed(1);
    const lossPct = (s.losses / s.total * 100).toFixed(1);

    // Streak display
    const streakIcon  = s.curType ? '🔥' : '❄️';
    const streakLabel = s.curType ? 'Win Streak' : 'Loss Streak';
    const streakColor = s.curType ? '#00e87a' : '#ff4444';

    wrap.innerHTML = `
      <!-- Summary cards grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${card('Total Trades',  s.total,                       '#ccd8df')}
        ${card('Win Rate',      s.winRate.toFixed(1)+'%',      wrColor)}
        ${card('Total P&L',     usd(s.totalPnl),               col(s.totalPnl))}
        ${card('Profit Factor', pfVal,                          pfColor)}
        ${card('Avg Trade P&L', usd(s.avgPnl),                 col(s.avgPnl))}
        ${card('Best Trade',    usd(s.best),                    '#00e87a')}
        ${card('Worst Trade',   usd(s.worst),                   '#ff4444')}
        ${card('Avg Winner',    usd(s.avgWinner),               '#00e87a')}
        ${card('Avg Loser',     usd(s.avgLoser),                '#ff4444')}
      </div>

      <!-- Win/Loss bar -->
      <div style="background:#0a1520;border-radius:12px;padding:20px;margin-top:4px">
        <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;margin-bottom:8px">
          <span style="color:#00e87a">${s.wins} wins</span>
          <span style="color:#ff4444">${s.losses} losses</span>
        </div>
        <div style="height:24px;border-radius:12px;overflow:hidden;display:flex;background:rgba(255,255,255,0.04)">
          <div style="width:${winPct}%;background:linear-gradient(90deg,#00e87a,#00b85e);transition:width .4s"></div>
          <div style="width:${lossPct}%;background:linear-gradient(90deg,#e84040,#ff4444);transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;margin-top:6px">
          <span>${winPct}%</span><span>${lossPct}%</span>
        </div>
      </div>

      <!-- Streaks -->
      <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
        <div style="background:#060d12;border-radius:8px;padding:14px 18px;flex:1;min-width:140px">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Current Streak</div>
          <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${streakColor}">${streakIcon} ${s.curStreak} ${streakLabel}</div>
        </div>
        <div style="background:#060d12;border-radius:8px;padding:14px 18px;flex:1;min-width:140px">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Best Win Streak</div>
          <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#00e87a">🔥 ${s.bestWin}</div>
        </div>
        <div style="background:#060d12;border-radius:8px;padding:14px 18px;flex:1;min-width:140px">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:6px">Best Loss Streak</div>
          <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#4a6070">❄️ ${s.bestLoss}</div>
        </div>
      </div>

      <!-- P&L bar chart -->
      <div style="margin-top:16px">
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:#4a6070;text-transform:uppercase;margin-bottom:8px">P&amp;L Per Trade</div>
        <canvas id="tl-stats-chart" height="200" style="background:#060d12;border-radius:8px;display:block;width:100%;cursor:crosshair"></canvas>
      </div>`;

    // Draw chart after DOM is updated
    requestAnimationFrame(() => sDrawChart(trades));
  }

  // ── STATS: CANVAS CHART ───────────────────────────────────────────────────

  function sDrawChart(trades){
    const canvas = document.getElementById('tl-stats-chart');
    if(!canvas) return;
    const recent = trades.slice(-50);
    if(!recent.length) return;

    canvas.width  = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 600;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const PAD   = { top:20, right:16, bottom:28, left:56 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top  - PAD.bottom;

    const vals   = recent.map(t => t.pnl);
    const maxVal = Math.max(...vals.map(Math.abs), 1);
    const barW   = Math.max(2, Math.floor(chartW / recent.length) - 2);
    const zeroY  = PAD.top + chartH / 2;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = PAD.top + chartH * f;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    });

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(W - PAD.right, zeroY); ctx.stroke();

    // Y axis labels
    ctx.fillStyle = '#4a6070';
    ctx.font      = '10px "Space Mono", monospace';
    ctx.textAlign = 'right';
    const topVal  = maxVal.toFixed(0);
    ctx.fillText('+$'+topVal, PAD.left - 4, PAD.top + 4);
    ctx.fillText('-$'+topVal, PAD.left - 4, PAD.top + chartH + 4);
    ctx.fillText('$0',        PAD.left - 4, zeroY + 4);

    // Bars
    const step = chartW / recent.length;
    recent.forEach((tr, i) => {
      const x     = PAD.left + i * step + (step - barW) / 2;
      const ratio = tr.pnl / maxVal;
      const barH  = Math.abs(ratio) * (chartH / 2);
      const y     = tr.pnl >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = tr.pnl >= 0 ? '#00e87a' : '#ff4444';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH || 1, 2) : ctx.rect(x, y, barW, barH || 1);
      ctx.fill();
    });

    // X axis labels (every ~10 trades)
    ctx.fillStyle = '#4a6070';
    ctx.font      = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    recent.forEach((_, i) => {
      if(i === 0 || (i+1) % 10 === 0 || i === recent.length - 1){
        const x = PAD.left + i * step + step / 2;
        ctx.fillText(i+1, x, H - 6);
      }
    });

    // Tooltip on hover
    canvas._trades = recent;
    canvas._step   = step;
    canvas._PAD    = PAD;
    canvas._chartH = chartH;
    canvas._zeroY  = zeroY;
    canvas._maxVal = maxVal;
    canvas._barW   = barW;
    canvas.onmousemove = function(e){
      const rect = canvas.getBoundingClientRect();
      const mx   = (e.clientX - rect.left) * (canvas.width / rect.width);
      const idx  = Math.floor((mx - PAD.left) / step);
      if(idx < 0 || idx >= recent.length){ canvas._tip = null; sTipDraw(canvas, ctx, recent); return; }
      canvas._tip = idx;
      sTipDraw(canvas, ctx, recent);
    };
    canvas.onmouseleave = function(){ canvas._tip = null; sTipDraw(canvas, ctx, recent); };
  }

  function sTipDraw(canvas, ctx, trades){
    const W = canvas.width, H = canvas.height;
    const { _step:step, _PAD:PAD, _zeroY:zeroY, _maxVal:maxVal, _barW:barW, _chartH:chartH } = canvas;
    ctx.clearRect(0, 0, W, H);

    // Redraw grid + zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    [0.25,0.5,0.75,1].forEach(f => {
      const y = PAD.top + chartH * f;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W-PAD.right, y); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(W-PAD.right, zeroY); ctx.stroke();

    // Y labels
    ctx.fillStyle = '#4a6070'; ctx.font = '10px "Space Mono",monospace'; ctx.textAlign = 'right';
    ctx.fillText('+$'+maxVal.toFixed(0), PAD.left-4, PAD.top+4);
    ctx.fillText('-$'+maxVal.toFixed(0), PAD.left-4, PAD.top+chartH+4);
    ctx.fillText('$0', PAD.left-4, zeroY+4);

    // Bars
    trades.forEach((tr, i) => {
      const x    = PAD.left + i * step + (step - barW) / 2;
      const bH   = Math.abs(tr.pnl / maxVal) * (chartH / 2);
      const y    = tr.pnl >= 0 ? zeroY - bH : zeroY;
      const hot  = i === canvas._tip;
      ctx.fillStyle = tr.pnl >= 0 ? (hot ? '#33ffaa' : '#00e87a') : (hot ? '#ff7777' : '#ff4444');
      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, bH||1, 2) : ctx.rect(x, y, barW, bH||1);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // X labels
    ctx.fillStyle = '#4a6070'; ctx.font = '9px "Space Mono",monospace'; ctx.textAlign = 'center';
    trades.forEach((_, i) => {
      if(i===0 || (i+1)%10===0 || i===trades.length-1){
        ctx.fillText(i+1, PAD.left + i*step + step/2, H-6);
      }
    });

    // Tooltip bubble
    const tip = canvas._tip;
    if(tip == null) return;
    const tr   = trades[tip];
    const sign = tr.pnl >= 0 ? '+' : '';
    const label= `Trade ${tip+1}: ${tr.symbol||'?'}  ${sign}$${Math.abs(tr.pnl).toFixed(2)}`;
    ctx.font = '11px "Space Mono",monospace';
    const tw   = ctx.measureText(label).width + 20;
    const th   = 26;
    let tx     = PAD.left + tip * step + step / 2 - tw / 2;
    tx         = Math.max(4, Math.min(W - tw - 4, tx));
    const bH2  = Math.abs(tr.pnl / maxVal) * (chartH / 2);
    let ty     = tr.pnl >= 0 ? zeroY - bH2 - th - 6 : zeroY + bH2 + 6;
    ty         = Math.max(4, Math.min(H - th - 4, ty));
    ctx.fillStyle = 'rgba(10,21,32,0.95)';
    ctx.strokeStyle= tr.pnl >= 0 ? '#00e87a' : '#ff4444';
    ctx.lineWidth  = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(tx, ty, tw, th, 6) : ctx.rect(tx, ty, tw, th);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = tr.pnl >= 0 ? '#00e87a' : '#ff4444';
    ctx.textAlign = 'left';
    ctx.fillText(label, tx+10, ty+17);
  }

  // ── STATS: CONTENT SHELL ──────────────────────────────────────────────────

  function statsContent(){
    const t = tier();
    if(t < 2){
      return lockedCard(
        'Performance Stats',
        'Upgrade to PRO to unlock advanced performance analytics — win rate, expectancy, drawdown, Sharpe ratio, and more.',
        'UPGRADE TO PRO'
      );
    }
    return `
      <div>
        <div style="margin-bottom:20px">
          <div style="font-family:'Space Mono',monospace;font-size:16px;color:#ccd8df;margin-bottom:4px">📊 PERFORMANCE STATS</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;letter-spacing:1px">Calculated from your trade journal · Updates automatically</div>
        </div>
        <div id="tl-stats-body"></div>
      </div>`;
  }

  function calendarContent(){
    const t = tier();
    if(t < 2){
      return lockedCard(
        'Trade Calendar',
        'Upgrade to PRO to unlock your trading calendar — visualize your performance by day, week, and month.',
        'UPGRADE TO PRO'
      );
    }
    return placeholderCard('📅', 'Trade Calendar', 'Calendar view coming soon.');
  }

  function aiReviewContent(){
    const t = tier();
    if(t < 3){
      return lockedCard(
        'AI Trade Review',
        'Elite tier exclusive. Get AI-powered analysis of every trade — what went right, what went wrong, risk scoring.',
        'UPGRADE TO ELITE'
      );
    }
    return placeholderCard('🤖', 'AI Trade Review', 'AI analysis coming soon.');
  }

  // ── TAB CONFIG ────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'signals',   label: 'SIGNALS',   build: signalsContent  },
    { id: 'journal',   label: 'JOURNAL',   build: journalContent  },
    { id: 'risk',      label: 'RISK CALC', build: riskContent     },
    { id: 'stats',     label: 'STATS',     build: statsContent    },
    { id: 'calendar',  label: 'CALENDAR',  build: calendarContent },
    { id: 'ai-review', label: 'AI REVIEW', build: aiReviewContent },
  ];

  // ── TAB SWITCHER ─────────────────────────────────────────────────────────

  function switchTab(id){
    TABS.forEach(function(tab){
      const btn = document.getElementById('tl-tab-'+tab.id);
      const pane = document.getElementById('tl-pane-'+tab.id);
      if(!btn || !pane) return;
      const active = tab.id === id;
      btn.style.color = active ? '#00e87a' : '#4a6070';
      btn.style.borderBottom = active ? '2px solid #00e87a' : '2px solid transparent';
      pane.style.display = active ? 'block' : 'none';
    });
    if(id === 'journal') jRenderList();
    if(id === 'stats')   sRenderStats();
  }

  // ── INIT ─────────────────────────────────────────────────────────────────

  function init(){
    const wrap = document.getElementById('P-trade-lab');
    if(!wrap) return;

    const tc = tierColor();
    const tn = tierName();

    // Build tab bar HTML
    const tabBarItems = TABS.map(function(tab){
      return `<button id="tl-tab-${tab.id}"
        onclick="TL._switchTab('${tab.id}')"
        style="padding:12px 20px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;color:#4a6070;cursor:pointer;border:none;border-bottom:2px solid transparent;background:transparent;white-space:nowrap;transition:color .15s,border-color .15s"
      >${tab.label}</button>`;
    }).join('');

    // Build panes HTML
    const panesHTML = TABS.map(function(tab){
      return `<div id="tl-pane-${tab.id}" style="display:none">${tab.build()}</div>`;
    }).join('');

    wrap.innerHTML = `
      <!-- Page header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">⚗️ TRADE LAB</div>
          <div style="font-family:'Space Mono',monospace;font-size:11px;color:#4a6070;letter-spacing:.5px">Your personal trading intelligence center</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:'Space Mono',monospace;font-size:9px;color:#4a6070;letter-spacing:1px;text-transform:uppercase">Tier</span>
          <span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${tc};background:${tc}18;border:1px solid ${tc}44;border-radius:4px;padding:4px 12px;letter-spacing:1px">${tn}</span>
        </div>
      </div>

      <!-- Tab bar -->
      <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:12px 12px 0 0;border-bottom:1px solid rgba(0,180,216,0.12);display:flex;overflow-x:auto;margin-bottom:0">
        ${tabBarItems}
      </div>

      <!-- Tab content -->
      <div style="background:#060d12;border:1px solid rgba(0,180,216,0.12);border-top:none;border-radius:0 0 12px 12px;padding:24px;min-height:240px">
        ${panesHTML}
      </div>
    `;

    // Activate first tab
    switchTab('signals');
  }

  // Expose all functions called from inline event handlers
  return {
    init,
    _switchTab:   switchTab,
    _calcRisk:    calcRisk,
    setDirection: jSetDirection,
    calcPnl:      jCalcPnl,
    saveTrade:    jSaveTrade,
    deleteTrade:  jDeleteTrade,
    _exportCsv:   jExportCsv,
    sRenderStats: sRenderStats,
  };

})();
