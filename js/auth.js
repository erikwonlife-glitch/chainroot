// ════════════════════════════════════════════════════════════════════════════
// DEFIMONGO — AUTH + NAVIGATION + CORE UI
// ════════════════════════════════════════════════════════════════════════════

// ── AUTH STATE ────────────────────────────────────────────────────────────────
let aTab = 'register';
let CR_USER = null; // { email, displayName, walletAddress, joinedAt, portfolio:[], tier:0 }

function getTier(){ return CR_USER?.tier ?? 0; }
function getTierName(){ return ['FREE','EXPLORER','PRO','ELITE'][getTier()]||'FREE'; }
function getTierColor(){ return ['#4a6070','#00b4d8','#9945FF','#f4c542'][getTier()]||'#4a6070'; }

// ── SIMPLE LOCAL STORAGE USER DB (frontend-only until backend is wired) ───────
const DB = {
  save(u){ try{localStorage.setItem('cr_user', JSON.stringify(u));}catch(e){} },
  load(){ try{const r=localStorage.getItem('cr_user');return r?JSON.parse(r):null;}catch(e){return null;} },
  clear(){ try{localStorage.removeItem('cr_user');}catch(e){} },
  getUsers(){ try{const r=localStorage.getItem('cr_users');return r?JSON.parse(r):{};} catch(e){return{};} },
  addUser(email,hash,display){ const u=this.getUsers(); u[email]={hash,display,joinedAt:Date.now(),portfolio:[]}; try{localStorage.setItem('cr_users',JSON.stringify(u));}catch(e){} },
  findUser(email){ return this.getUsers()[email]||null; }
};

// Simple password hash (NOT for production)
async function hashPw(pw){
  const b=new TextEncoder().encode(pw);
  const h=await crypto.subtle.digest('SHA-256',b);
  return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

// ── OPEN / CLOSE AUTH MODAL ───────────────────────────────────────────────────
function openAuth(tab){
  aTab=tab||'register';
  document.getElementById('authOv').classList.add('on');
  renderTabs(); renderBody();
}
function closeAuth(){ document.getElementById('authOv').classList.remove('on'); }
function ovClick(e){ if(e.target.id==='authOv') closeAuth(); }
function swTab(t){ aTab=t; renderTabs(); renderBody(); }

function renderTabs(){
  document.querySelectorAll('#authTabs .mtb').forEach(t=>{
    t.classList.toggle('on', t.dataset.t===aTab);
  });
  document.getElementById('mtitle').textContent = aTab==='login'?'Welcome Back':'Create Account';
}

// ── RENDER MODAL BODY ─────────────────────────────────────────────────────────
function renderBody(){
  const b = document.getElementById('mbd');
  if(!b) return;

  const walletSection = `
    <div style="margin-bottom:4px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Connect Web3 Wallet</div>
    <div class="w3-grid">
      <button class="w3-btn" onclick="connectWallet('metamask')" id="w3-metamask">
        <div class="w3-icon" style="background:#E8760020">🦊</div>
        <span class="w3-name">MetaMask</span>
        <span class="w3-badge" style="background:rgba(232,118,0,.15);color:#E87600">EVM</span>
      </button>
      <button class="w3-btn" onclick="connectWallet('walletconnect')" id="w3-walletconnect">
        <div class="w3-icon" style="background:#3B99FC20">🔗</div>
        <span class="w3-name">WalletConnect</span>
        <span class="w3-badge" style="background:rgba(59,153,252,.15);color:#3B99FC">Multi</span>
      </button>
      <button class="w3-btn" onclick="connectWallet('coinbase')" id="w3-coinbase">
        <div class="w3-icon" style="background:#0052FF20">🔵</div>
        <span class="w3-name">Coinbase</span>
        <span class="w3-badge" style="background:rgba(0,82,255,.15);color:#0052FF">EVM</span>
      </button>
      <button class="w3-btn" onclick="connectWallet('phantom')" id="w3-phantom">
        <div class="w3-icon" style="background:#AB9FF220">👻</div>
        <span class="w3-name">Phantom</span>
        <span class="w3-badge" style="background:rgba(171,159,242,.15);color:#AB9FF2">SOL</span>
      </button>
    </div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);text-align:center;margin-top:8px;line-height:1.7">
      Connecting a wallet creates your account automatically.<br/>Your keys, your assets — we never store private keys.
    </div>`;

  const orDiv = `<div class="or-div"><div class="or-line"></div><div class="or-txt">or continue with email</div><div class="or-line"></div></div>`;

  if(aTab === 'register'){
    b.innerHTML = `
      ${walletSection}
      ${orDiv}
      <div class="af"><label class="al2">Display Name</label>
        <input class="ai" id="reg-name" type="text" placeholder="Satoshi" autocomplete="name"/>
        <div class="aerr" id="err-name">Please enter your name</div>
      </div>
      <div class="af"><label class="al2">Email</label>
        <input class="ai" id="reg-email" type="email" placeholder="you@example.com" autocomplete="email"/>
        <div class="aerr" id="err-email">Enter a valid email</div>
      </div>
      <div class="af"><label class="al2">Password</label>
        <div class="pw-wrap">
          <input class="ai" id="reg-pw" type="password" placeholder="Min 8 characters" oninput="checkStrength(this.value)" autocomplete="new-password"/>
          <button class="pw-eye" onclick="togglePw('reg-pw',this)">👁</button>
        </div>
        <div class="str-wrap" id="str-wrap">
          <div class="str-bar"><div class="str-fill" id="str-fill" style="width:0%"></div></div>
          <div class="str-txt" id="str-txt"></div>
        </div>
        <div class="aerr" id="err-pw">Min 8 characters required</div>
      </div>
      <button class="asub" onclick="doRegister()">Create Account →</button>
      <div class="alink">Already have an account? <a onclick="swTab('login')">Sign in</a></div>
      <div style="font-family:'Space Mono',monospace;font-size:8px;color:var(--muted);text-align:center;margin-top:12px;line-height:1.8">
        By creating an account you agree to our Terms of Service.<br/>Your email is used only for account recovery — no spam.
      </div>`;
  } else {
    b.innerHTML = `
      ${walletSection}
      ${orDiv}
      <div class="af"><label class="al2">Email</label>
        <input class="ai" id="log-email" type="email" placeholder="you@example.com" autocomplete="email"/>
        <div class="aerr" id="err-log-email">Enter a valid email</div>
      </div>
      <div class="af"><label class="al2">Password</label>
        <div class="pw-wrap">
          <input class="ai" id="log-pw" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"/>
          <button class="pw-eye" onclick="togglePw('log-pw',this)">👁</button>
        </div>
        <div class="aerr" id="err-log-pw">Incorrect email or password</div>
      </div>
      <button class="asub" onclick="doLogin()">Sign In →</button>
      <div class="alink" style="display:flex;justify-content:space-between;margin-top:14px">
        <a onclick="swTab('register')">Create account</a>
        <a onclick="showForgot()">Forgot password?</a>
      </div>`;
  }
}

// ── PASSWORD HELPERS ──────────────────────────────────────────────────────────
function togglePw(id, btn){
  const el = document.getElementById(id);
  if(!el) return;
  el.type = el.type==='password' ? 'text' : 'password';
  btn.textContent = el.type==='password' ? '👁' : '🙈';
}
function checkStrength(pw){
  const wrap = document.getElementById('str-wrap');
  const fill = document.getElementById('str-fill');
  const txt  = document.getElementById('str-txt');
  if(!wrap||!fill||!txt) return;
  wrap.classList.toggle('on', pw.length>0);
  let score=0;
  if(pw.length>=8) score++;
  if(/[A-Z]/.test(pw)) score++;
  if(/[0-9]/.test(pw)) score++;
  if(/[^A-Za-z0-9]/.test(pw)) score++;
  const map=[
    {w:'25%',c:'#ff4560',t:'Weak'},
    {w:'50%',c:'#ff6b35',t:'Fair'},
    {w:'75%',c:'#f4c542',t:'Good'},
    {w:'100%',c:'#00e87a',t:'Strong'}
  ];
  const m=map[Math.max(0,score-1)];
  fill.style.width=m.w; fill.style.background=m.c;
  txt.textContent=m.t; txt.style.color=m.c;
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
async function doRegister(){
  const name  = document.getElementById('reg-name')?.value.trim()||'';
  const email = document.getElementById('reg-email')?.value.trim()||'';
  const pw    = document.getElementById('reg-pw')?.value||'';
  let ok=true;
  if(!name){
    document.getElementById('err-name').classList.add('on');
    document.getElementById('reg-name').classList.add('err');
    ok=false;
  } else {
    document.getElementById('err-name').classList.remove('on');
    document.getElementById('reg-name').classList.remove('err');
  }
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    document.getElementById('err-email').classList.add('on');
    document.getElementById('reg-email').classList.add('err');
    ok=false;
  } else {
    document.getElementById('err-email').classList.remove('on');
    document.getElementById('reg-email').classList.remove('err');
  }
  if(pw.length<8){
    document.getElementById('err-pw').classList.add('on');
    document.getElementById('reg-pw').classList.add('err');
    ok=false;
  } else {
    document.getElementById('err-pw').classList.remove('on');
    document.getElementById('reg-pw').classList.remove('err');
  }
  if(!ok) return;
  const btn=document.querySelector('#mbd .asub');
  if(btn){btn.disabled=true;btn.textContent='Creating…';}
  if(DB.findUser(email)){
    if(btn){btn.disabled=false;btn.textContent='Create Account →';}
    document.getElementById('err-email').textContent='Email already registered';
    document.getElementById('err-email').classList.add('on');
    return;
  }
  const hash = await hashPw(pw);
  DB.addUser(email, hash, name);
  const user = { email, displayName:name, walletAddress:null, joinedAt:Date.now(), portfolio:[], type:'email', tier:0 };
  DB.save(user);
  CR_USER = user;
  showAuthSuccess(name, email, null);
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function doLogin(){
  const email = document.getElementById('log-email')?.value.trim()||'';
  const pw    = document.getElementById('log-pw')?.value||'';
  let ok=true;
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    document.getElementById('err-log-email').classList.add('on'); ok=false;
  } else {
    document.getElementById('err-log-email').classList.remove('on');
  }
  if(!pw){
    document.getElementById('err-log-pw').classList.add('on'); ok=false;
  } else {
    document.getElementById('err-log-pw').classList.remove('on');
  }
  if(!ok) return;
  const btn=document.querySelector('#mbd .asub');
  if(btn){btn.disabled=true;btn.textContent='Signing in…';}
  const stored = DB.findUser(email);
  if(!stored){
    if(btn){btn.disabled=false;btn.textContent='Sign In →';}
    document.getElementById('err-log-pw').textContent='No account found for this email';
    document.getElementById('err-log-pw').classList.add('on');
    return;
  }
  const hash = await hashPw(pw);
  if(hash !== stored.hash){
    if(btn){btn.disabled=false;btn.textContent='Sign In →';}
    document.getElementById('err-log-pw').textContent='Incorrect password';
    document.getElementById('err-log-pw').classList.add('on');
    return;
  }
  const user = { email, displayName:stored.display, walletAddress:stored.walletAddress||null, joinedAt:stored.joinedAt, portfolio:stored.portfolio||[], type:'email', tier: stored.tier||0 };
  DB.save(user);
  CR_USER = user;
  showAuthSuccess(stored.display, email, null);
}

// ── WALLET CONNECT ────────────────────────────────────────────────────────────
async function connectWallet(type){
  const btn=document.getElementById('w3-'+type);
  if(btn){btn.classList.add('connecting');btn.querySelector('.w3-name').textContent='Connecting…';}

  if(type==='metamask'||type==='coinbase'){
    if(!window.ethereum){ showW3Error(type,'Not installed. <a href="https://metamask.io" target="_blank" style="color:var(--accent)">Install MetaMask →</a>'); return; }
    try{
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      finishWalletAuth(type, accounts[0], btn);
    } catch(e){
      showW3Error(type, e.code===4001?'Connection rejected':'Connection failed');
    }
    return;
  }
  if(type==='phantom'){
    if(!window.solana?.isPhantom){ showW3Error(type,'Not installed. <a href="https://phantom.app" target="_blank" style="color:var(--accent)">Install Phantom →</a>'); return; }
    try{
      const resp = await window.solana.connect();
      finishWalletAuth(type, resp.publicKey.toString(), btn);
    } catch(e){
      showW3Error(type,'Connection rejected');
    }
    return;
  }
  if(type==='walletconnect'){
    showW3Error(type,'WalletConnect requires the WC SDK. See setup guide.');
    return;
  }
}

function showW3Error(type, msg){
  const btn=document.getElementById('w3-'+type);
  if(btn){btn.classList.remove('connecting');const nm=btn.querySelector('.w3-name');if(nm)nm.innerHTML=msg||'Failed';}
  setTimeout(()=>{
    if(btn){
      btn.classList.remove('connecting');
      const nm=btn.querySelector('.w3-name');
      if(nm)nm.textContent={metamask:'MetaMask',walletconnect:'WalletConnect',coinbase:'Coinbase',phantom:'Phantom'}[type];
    }
  },3500);
}

function finishWalletAuth(type, addr, btn){
  if(btn){btn.classList.remove('connecting');btn.classList.add('connected');btn.querySelector('.w3-name').textContent=addr.slice(0,6)+'…'+addr.slice(-4);}
  const short = addr.slice(0,6)+'…'+addr.slice(-4);
  const existing = Object.values(DB.getUsers()).find(u=>u.walletAddress===addr);
  const user = { email: existing?.email||null, displayName: existing?.display||short, walletAddress:addr, joinedAt:existing?.joinedAt||Date.now(), portfolio:existing?.portfolio||[], type:'wallet', walletType:type, tier: existing?.tier||0 };
  if(!existing){
    const users=DB.getUsers();
    users['wallet_'+addr]={hash:'',display:short,joinedAt:Date.now(),portfolio:[],walletAddress:addr,tier:0};
    try{localStorage.setItem('cr_users',JSON.stringify(users));}catch(e){}
  }
  DB.save(user);
  CR_USER=user;
  showAuthSuccess(user.displayName, addr.slice(0,6)+'…'+addr.slice(-4), addr);
}

// ── POST-AUTH SUCCESS ─────────────────────────────────────────────────────────
function showAuthSuccess(name, sub, wallet){
  const b=document.getElementById('mbd');
  if(!b)return;
  document.getElementById('authTabs').style.display='none';
  b.innerHTML=`
    <div class="auth-success">
      <div class="auth-success-icon">✅</div>
      <div class="auth-success-title">Welcome, ${name}!</div>
      <div class="auth-success-sub">${wallet?'Wallet connected: '+sub:'Signed in as '+sub}<br/>Your portfolio is ready.</div>
      <button class="asub" style="max-width:240px;margin:18px auto 0;display:block" onclick="closeAuth();updateTopbarLoggedIn()">Go to Dashboard →</button>
    </div>`;
  updateTopbarLoggedIn();
  setTimeout(()=>{ closeAuth(); }, 2800);
}

function showForgot(){
  const b=document.getElementById('mbd');
  if(!b)return;
  b.innerHTML=`
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px">Reset Password</div>
    <div class="af"><label class="al2">Email</label><input class="ai" id="forgot-email" type="email" placeholder="you@example.com"/></div>
    <button class="asub" onclick="doForgot()">Send Reset Link →</button>
    <div class="alink" style="margin-top:14px"><a onclick="swTab('login')">← Back to sign in</a></div>`;
}
function doForgot(){
  const email=document.getElementById('forgot-email')?.value||'';
  if(!email){return;}
  const b=document.getElementById('mbd');
  b.innerHTML=`<div class="auth-success"><div class="auth-success-icon">📧</div><div class="auth-success-title">Check your inbox</div><div class="auth-success-sub">If ${email} has an account, a reset link will arrive shortly.<br/>(Backend email service needed to activate this.)</div></div>`;
}

// ── TOPBAR UPDATE AFTER LOGIN ─────────────────────────────────────────────────
function updateTopbarLoggedIn(){
  if(!CR_USER)return;
  const tbr=document.getElementById('tbr');
  if(!tbr)return;
  const initials=CR_USER.displayName?CR_USER.displayName.slice(0,2).toUpperCase():'DM';
  // Preserve language toggle + yield/training buttons, just replace auth buttons
  const langToggle = tbr.querySelector('#main-lang-mn')?.parentElement?.outerHTML || '';
  tbr.innerHTML=`
    <div class="clk" id="clk">--:--:-- UTC</div>
    <div style="display:flex;background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden;flex-shrink:0">
      <button id="main-lang-mn" onclick="setSiteLang('mn')" style="padding:5px 10px;background:#00e87a;color:#000;border:none;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">МН</button>
      <button id="main-lang-en" onclick="setSiteLang('en')" style="padding:5px 10px;background:transparent;color:var(--muted);border:none;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">EN</button>
    </div>
    <button class="yield-btn" onclick="openYieldPage()">
      <span class="yb-icon">◈</span>
      <span class="yl-text" data-mn="Өгөөж" data-en="Earn Yield">Өгөөж</span>
      <span class="yb-apy">SOL DeFi</span>
    </button>
    <button class="free-training-btn" onclick="openTrainingPage()">
      <span class="ftr-icon">▶</span>
      <span class="ftr-text" data-mn="Үнэгүй Сургалт" data-en="Free Training">Үнэгүй Сургалт</span>
      <span class="ftr-badge">FREE</span>
    </button>
    <div class="uav" onclick="openPortfolio()">
      <div class="uico">${initials}</div>
      <span class="unm">${CR_USER.displayName}</span>
      <span style="font-size:10px;color:var(--muted)">▾</span>
    </div>
    <button class="abtn al" onclick="doLogout()" style="font-size:10px">Sign Out</button>`;
}

function doLogout(){
  CR_USER=null; DB.clear();
  const tbr=document.getElementById('tbr');
  if(tbr) tbr.innerHTML=`
    <div class="clk" id="clk">--:--:-- UTC</div>
    <div style="display:flex;background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden;flex-shrink:0">
      <button id="main-lang-mn" onclick="setSiteLang('mn')" style="padding:5px 10px;background:#00e87a;color:#000;border:none;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">МН</button>
      <button id="main-lang-en" onclick="setSiteLang('en')" style="padding:5px 10px;background:transparent;color:var(--muted);border:none;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s">EN</button>
    </div>
    <button class="yield-btn" onclick="openYieldPage()">
      <span class="yb-icon">◈</span>
      <span class="yl-text" data-mn="Өгөөж" data-en="Earn Yield">Өгөөж</span>
      <span class="yb-apy">SOL DeFi</span>
    </button>
    <button class="free-training-btn" onclick="openTrainingPage()">
      <span class="ftr-icon">▶</span>
      <span class="ftr-text" data-mn="Үнэгүй Сургалт" data-en="Free Training">Үнэгүй Сургалт</span>
      <span class="ftr-badge">FREE</span>
    </button>
    <button class="abtn al" onclick="openAuth('login')" data-mn="Нэвтрэх" data-en="Sign In">Нэвтрэх</button>
    <button class="abtn aj" onclick="openAuth('register')" data-mn="Бүртгүүлэх" data-en="Join Free">Бүртгүүлэх</button>`;
  toast('Signed out','#4d6475');
}

// ── PORTFOLIO PANEL ───────────────────────────────────────────────────────────
function openPortfolio(){
  if(!CR_USER){ openAuth('register'); return; }
  const ov=document.getElementById('authOv');
  const mbd=document.getElementById('mbd');
  const tabs=document.getElementById('authTabs');
  document.getElementById('mtitle').textContent='My Portfolio';
  tabs.style.display='none';
  ov.classList.add('on');
  renderPortfolio(mbd);
}

function renderPortfolio(container){
  const wallet = CR_USER?.walletAddress;
  const portfolio = CR_USER?.portfolio||[];
  let totalVal=0;
  const rows = portfolio.map(item=>{
    const coin=(typeof ALL_COINS !== 'undefined' ? ALL_COINS : []).find(c=>c.id===item.id||c.symbol?.toLowerCase()===item.symbol?.toLowerCase());
    const val=coin?(coin.current_price*(item.amount||0)):0;
    totalVal+=val;
    const chg=coin?.price_change_percentage_24h||0;
    return {item,coin,val,chg};
  });

  let html=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Total Portfolio Value</div>
        <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#fff">$${totalVal.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        ${wallet?`<div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);margin-top:4px">🔗 ${wallet.slice(0,8)}…${wallet.slice(-6)}</div>`:''}
      </div>
      <button class="port-connect-btn" onclick="addAssetPrompt()">+ Add Asset</button>
    </div>`;

  if(rows.length===0){
    html+=`
      <div class="port-empty" style="padding:30px 20px">
        <div class="port-empty-icon">📊</div>
        <div class="port-empty-title">No assets yet</div>
        <div class="port-empty-sub">Add your crypto holdings manually or connect a wallet to automatically import your on-chain assets.</div>
        ${wallet?`<button class="port-connect-btn" onclick="importWalletAssets()">↓ Import from Wallet</button>`:`<button class="port-connect-btn" onclick="closeAuth();openAuth('register')">Connect Wallet</button>`}
      </div>`;
  } else {
    html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:4px 16px">`;
    rows.forEach(({item,coin,val,chg})=>{
      const sym=(item.symbol||item.id||'?').toUpperCase();
      const col='#'+Math.abs((item.id||sym).split('').reduce((h,ch)=>((h<<5)-h)+ch.charCodeAt(0),0)).toString(16).slice(0,6).padEnd(6,'0');
      html+=`<div class="port-asset-row">
        <div class="port-asset-icon" style="background:${col}22;color:${col}">${sym[0]}</div>
        <div class="port-asset-name">
          <div class="port-asset-nm">${coin?.name||sym}</div>
          <div class="port-asset-sym">${item.amount} ${sym}</div>
        </div>
        <div>
          <div class="port-asset-bal">$${val.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          <div class="port-asset-val ${chg>=0?'up':'dn'}">${chg>=0?'+':''}${chg.toFixed(2)}%</div>
        </div>
        <button onclick="removeAsset('${item.id||item.symbol}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px 8px" title="Remove">✕</button>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <button class="asub" style="background:var(--bg3);color:var(--text);border:1px solid var(--border)" onclick="closeAuth()">Close</button>
    <button class="asub" onclick="doLogout();closeAuth()">Sign Out</button>
  </div>`;

  container.innerHTML=html;
}

function addAssetPrompt(){
  const sym=prompt('Enter coin symbol (e.g. BTC, ETH, SOL):');
  if(!sym)return;
  const amt=parseFloat(prompt('Enter amount you hold:'));
  if(!amt||isNaN(amt))return;
  const coins = typeof ALL_COINS !== 'undefined' ? ALL_COINS : [];
  const coin=coins.find(c=>c.symbol?.toLowerCase()===sym.toLowerCase());
  const entry={id:coin?.id||sym.toLowerCase(), symbol:sym.toUpperCase(), amount:amt};
  if(!CR_USER.portfolio)CR_USER.portfolio=[];
  CR_USER.portfolio.push(entry);
  DB.save(CR_USER);
  const users=DB.getUsers();
  const key=CR_USER.email||'wallet_'+CR_USER.walletAddress;
  if(users[key])users[key].portfolio=CR_USER.portfolio;
  try{localStorage.setItem('cr_users',JSON.stringify(users));}catch(e){}
  renderPortfolio(document.getElementById('mbd'));
  toast('Asset added!','#00e87a');
}

function removeAsset(idOrSym){
  if(!CR_USER?.portfolio)return;
  CR_USER.portfolio=CR_USER.portfolio.filter(a=>a.id!==idOrSym&&a.symbol!==idOrSym);
  DB.save(CR_USER);
  renderPortfolio(document.getElementById('mbd'));
}

function importWalletAssets(){
  toast('On-chain wallet import coming soon — needs backend indexer','#f4c542');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, col='#00e87a'){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:28px;right:28px;background:${col};color:#000;padding:12px 22px;border-radius:6px;font-family:'Space Mono',monospace;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.4)`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function go(id, el){
  // Hide all panels
  document.querySelectorAll('.pnl').forEach(p=>p.classList.remove('on'));
  // Show target panel
  const t=document.getElementById('P-'+id);
  if(t){ t.classList.add('on'); document.getElementById('main').scrollTop=0; }
  // Update sidebar active state
  document.querySelectorAll('.nl').forEach(l=>l.classList.remove('on'));
  if(el) el.classList.add('on');
  // Close mobile sidebar
  const sb=document.querySelector('.sb');
  const sbOv=document.getElementById('sbOverlay');
  if(sb) sb.classList.remove('mob-open');
  if(sbOv) sbOv.classList.remove('on');
  document.body.style.overflow='';
  // Init news panel on first open
  if(id==='news' && typeof window._newsInit==='function') window._newsInit();
  // Init portfolio dashboard on first open
  if(id==='portfolio') {
    if(!CR_USER){ openAuth('register'); return; }
    if(typeof window.initPortfolioDashboard==='function') window.initPortfolioDashboard();
  }
  // Init Trade Lab
  if(id==='trade-lab') {
    if(typeof TL !== 'undefined' && typeof TL.init === 'function') TL.init();
  }
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
  if(tvMap[id] && typeof window[tvMap[id]]==='function'){
    setTimeout(function(){ window[tvMap[id]](); }, 100);
  }
}

function tog(id){
  const g=document.getElementById(id);
  if(g) g.classList.toggle('closed');
}

// ── MOBILE SIDEBAR ────────────────────────────────────────────────────────────
function toggleMobileSidebar(){
  const sb=document.querySelector('.sb');
  const ov=document.getElementById('sbOverlay');
  if(!sb)return;
  const isOpen=sb.classList.contains('mob-open');
  if(isOpen){
    sb.classList.remove('mob-open');
    if(ov)ov.classList.remove('on');
    document.body.style.overflow='';
  } else {
    sb.classList.add('mob-open');
    if(ov)ov.classList.add('on');
    document.body.style.overflow='hidden';
  }
}

function closeMobileSidebar(){
  const sb=document.querySelector('.sb');
  const ov=document.getElementById('sbOverlay');
  if(sb)sb.classList.remove('mob-open');
  if(ov)ov.classList.remove('on');
  document.body.style.overflow='';
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
(function clk(){
  const n=new Date();
  const el=document.getElementById('clk');
  if(el) el.textContent=[n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(v=>String(v).padStart(2,'0')).join(':')+' UTC';
  setTimeout(clk, 1000);
})();

// ── AUTO-RESTORE SESSION ──────────────────────────────────────────────────────
(function restoreSession(){
  const saved=DB.load();
  if(saved){ CR_USER=saved; setTimeout(updateTopbarLoggedIn, 100); }
})();

// ── START ─────────────────────────────────────────────────────────────────────
init();
