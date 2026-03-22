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
  // Fetch real tier from backend (overrides localStorage tier)
  fetchBackendTier(user.email);
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
  if(CR_USER.walletAddress === 'GskmXrB1ESZqx8p76fi154UNi2sZgFUU26N2QtuMXnmZ'){
    CR_USER.tier = 3;
    DB.save(CR_USER);
    const users=DB.getUsers();
    const key='wallet_'+addr;
    if(users[key]) users[key].tier=3;
    try{localStorage.setItem('cr_users',JSON.stringify(users));}catch(e){}
  }
  fetchBackendTier(addr);
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
    ${CR_USER?.walletAddress === 'GskmXrB1ESZqx8p76fi154UNi2sZgFUU26N2QtuMXnmZ' ? `
    <button onclick="openAdminPanel()" style="display:flex;align-items:center;gap:6px;padding:7px 13px;background:rgba(244,197,66,0.12);border:1px solid rgba(244,197,66,0.35);border-radius:6px;color:#f4c542;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .15s" onmouseover="this.style.background='rgba(244,197,66,0.22)'" onmouseout="this.style.background='rgba(244,197,66,0.12)'">
      <span style="font-size:11px">⚡</span>
      <span>ADMIN</span>
    </button>` : ''}
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

// ── ADMIN PANEL — owner only ──────────────────────────────────────────────────
function openAdminPanel() {
  if (CR_USER?.walletAddress !== 'GskmXrB1ESZqx8p76fi154UNi2sZgFUU26N2QtuMXnmZ') return;

  // Remove any existing panel
  const existing = document.getElementById('adminPanelOverlay');
  if (existing) { existing.remove(); return; }

  const ov = document.createElement('div');
  ov.id = 'adminPanelOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };

  ov.innerHTML = `
    <div style="background:#030a0f;border:1px solid rgba(244,197,66,0.3);border-radius:14px;width:100%;max-width:760px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:#f4c542">⚡ DEFIMONGO ADMIN</div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4a6070;letter-spacing:2px;margin-top:2px">MEMBER ACCESS MANAGEMENT</div>
        </div>
        <button onclick="document.getElementById('adminPanelOverlay').remove()" style="background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#4a6070;font-size:16px;cursor:pointer;padding:4px 10px;font-family:'Space Mono',monospace">✕</button>
      </div>

      <!-- Summary cards -->
      <div id="adm-cards" style="display:flex;gap:10px;padding:16px 24px;flex-shrink:0;flex-wrap:wrap">
        <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:8px;padding:12px 16px;flex:1;min-width:70px;text-align:center">
          <div id="adm-total" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#fff">—</div>
          <div style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;margin-top:2px">TOTAL</div>
        </div>
        <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:8px;padding:12px 16px;flex:1;min-width:70px;text-align:center">
          <div id="adm-active" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#00e87a">—</div>
          <div style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;margin-top:2px">ACTIVE</div>
        </div>
        <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:8px;padding:12px 16px;flex:1;min-width:70px;text-align:center">
          <div id="adm-pending" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#00b4d8">—</div>
          <div style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;margin-top:2px">PENDING</div>
        </div>
        <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:8px;padding:12px 16px;flex:1;min-width:70px;text-align:center">
          <div id="adm-expiring" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#f4c542">—</div>
          <div style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;margin-top:2px">EXPIRING</div>
        </div>
        <div style="background:#0a1520;border:1px solid rgba(0,180,216,0.12);border-radius:8px;padding:12px 16px;flex:1;min-width:70px;text-align:center">
          <div id="adm-expired" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#ff4444">—</div>
          <div style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;margin-top:2px">EXPIRED</div>
        </div>
      </div>

      <!-- Add member form -->
      <div style="padding:0 24px 16px;flex-shrink:0">
        <div style="background:#0a1520;border:1px solid rgba(0,232,122,0.15);border-radius:10px;padding:16px">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:#00e87a;margin-bottom:12px">+ ADD / UPGRADE MEMBER</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <input id="adm-email" type="email" placeholder="Email address" style="flex:2;min-width:160px;background:#030a0f;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:8px 12px;color:#ccd8df;font-family:'Space Mono',monospace;font-size:11px;outline:none">
            <input id="adm-tv" type="text" placeholder="TradingView username" style="flex:2;min-width:140px;background:#030a0f;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:8px 12px;color:#ccd8df;font-family:'Space Mono',monospace;font-size:11px;outline:none">
            <select id="adm-tier" style="flex:1;min-width:140px;background:#030a0f;border:1px solid rgba(0,180,216,0.2);border-radius:6px;padding:8px 12px;color:#ccd8df;font-family:'Space Mono',monospace;font-size:10px;outline:none">
              <option value="monthly">Monthly — $40 (30d)</option>
              <option value="biannual">6-Month — $150 (180d)</option>
              <option value="annual">Annual — $250 (365d)</option>
            </select>
            <button onclick="admAddMember()" style="padding:8px 16px;background:#00e87a;border:none;border-radius:6px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;color:#000;cursor:pointer;white-space:nowrap">ADD →</button>
          </div>
          <div id="adm-add-result" style="font-family:'Space Mono',monospace;font-size:10px;color:#4a6070;margin-top:8px;min-height:16px"></div>
        </div>
      </div>

      <!-- Search -->
      <div style="padding:0 24px 12px;flex-shrink:0">
        <input id="adm-search" oninput="admFilter()" placeholder="Search email or TradingView username..." style="width:100%;background:#0a1520;border:1px solid rgba(0,180,216,0.15);border-radius:8px;padding:9px 14px;color:#ccd8df;font-family:'Space Mono',monospace;font-size:11px;outline:none">
      </div>

      <!-- Members table -->
      <div style="overflow-y:auto;flex:1;padding:0 24px 24px">
        <table id="adm-table" style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">EMAIL</th>
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">TRADINGVIEW</th>
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">TIER</th>
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">STATUS</th>
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">EXPIRES</th>
              <th style="font-family:'Space Mono',monospace;font-size:8px;color:#4a6070;letter-spacing:1px;text-align:left;padding:8px 10px;white-space:nowrap">ACTIONS</th>
            </tr>
          </thead>
          <tbody id="adm-body">
            <tr><td colspan="6" style="text-align:center;padding:32px;color:#4a6070;font-family:'Space Mono',monospace;font-size:11px">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Toast -->
      <div id="adm-toast" style="position:absolute;bottom:20px;right:20px;background:#0a1520;border:1px solid rgba(0,232,122,0.4);border-radius:8px;padding:10px 18px;font-family:'Space Mono',monospace;font-size:11px;color:#00e87a;opacity:0;transition:opacity .3s;pointer-events:none"></div>
    </div>`;

  document.body.appendChild(ov);
  admLoad();
}

const RAILWAY = 'https://chainroot-production-b7d1.up.railway.app';

function admFmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function admBadge(row) {
  if (row.status === 'active' && row.daysLeft !== null && row.daysLeft <= 7)
    return '<span style="background:rgba(244,197,66,0.15);color:#f4c542;border-radius:3px;padding:2px 7px;font-size:8px;font-weight:700;letter-spacing:1px">⚠ EXPIRING</span>';
  const styles = {
    active:  'background:rgba(0,232,122,0.15);color:#00e87a',
    pending: 'background:rgba(0,180,216,0.12);color:#00b4d8',
    expired: 'background:rgba(255,68,68,0.12);color:#ff4444',
    revoked: 'background:rgba(100,100,100,0.15);color:#4a6070',
  };
  const labels = { active:'✓ ACTIVE', pending:'⏳ PENDING', expired:'✗ EXPIRED', revoked:'— REVOKED' };
  const s = styles[row.status] || styles.pending;
  const l = labels[row.status] || row.status.toUpperCase();
  return '<span style="'+s+';border-radius:3px;padding:2px 7px;font-size:8px;font-weight:700;letter-spacing:1px">'+l+'</span>';
}

function admTier(row) {
  const t = (row.tierName || '').toUpperCase();
  if (t === 'ANNUAL')   return '<span style="color:#00b4d8;font-weight:700">ANNUAL</span>';
  if (t === 'BIANNUAL') return '<span style="color:#f4c542;font-weight:700">6-MONTH</span>';
  if (t === 'MONTHLY' || row.tier >= 1) return '<span style="color:#00e87a;font-weight:700">MONTHLY</span>';
  return '<span style="color:#4a6070">FREE</span>';
}

let ADM_ROWS = [];

function admRender(rows) {
  const tbody = document.getElementById('adm-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#4a6070;font-family:Space Mono,monospace;font-size:11px">No members found</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r) {
    const btnStyle = 'border:none;border-radius:4px;padding:4px 9px;font-family:Space Mono,monospace;font-size:8px;font-weight:700;letter-spacing:1px;cursor:pointer;margin-right:4px';
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">' +
      '<td style="padding:9px 10px;color:#ccd8df;font-family:Space Mono,monospace">' + r.email + '</td>' +
      '<td style="padding:9px 10px;color:#00b4d8;font-family:Space Mono,monospace;font-weight:700">' + (r.tvUsername || '—') + '</td>' +
      '<td style="padding:9px 10px">' + admTier(r) + '</td>' +
      '<td style="padding:9px 10px">' + admBadge(r) + '</td>' +
      '<td style="padding:9px 10px;color:#4a6070;font-family:Space Mono,monospace;font-size:10px">' + admFmt(r.membershipEnd) + (r.daysLeft > 0 ? ' <span style="color:#f4c542">('+r.daysLeft+'d)</span>' : '') + '</td>' +
      '<td style="padding:9px 10px">' +
        '<button style="'+btnStyle+';background:#00e87a;color:#000" onclick="admAction(\'activate\',\''+r.email+'\')">+30D</button>' +
        '<button style="'+btnStyle+';background:#00b4d8;color:#000" onclick="admAction(\'extend\',\''+r.email+'\')">EXTEND</button>' +
        '<button style="'+btnStyle+';background:#ff4444;color:#fff" onclick="admAction(\'revoke\',\''+r.email+'\')">REVOKE</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function admFilter() {
  const q = (document.getElementById('adm-search')?.value || '').toLowerCase();
  admRender(q ? ADM_ROWS.filter(function(r){ return r.email.toLowerCase().includes(q) || (r.tvUsername||'').toLowerCase().includes(q); }) : ADM_ROWS);
}

async function admLoad() {
  try {
    const wallet = CR_USER?.walletAddress || '';
    const r = await fetch(RAILWAY + '/api/admin-data?wallet=' + encodeURIComponent(wallet));
    const d = await r.json();
    document.getElementById('adm-total').textContent    = d.summary.total;
    document.getElementById('adm-active').textContent   = d.summary.active;
    document.getElementById('adm-pending').textContent  = d.summary.pending;
    document.getElementById('adm-expiring').textContent = d.summary.expiring;
    document.getElementById('adm-expired').textContent  = d.summary.expired;
    ADM_ROWS = d.rows;
    admRender(ADM_ROWS);
  } catch(e) {
    console.error('[Admin] Load failed:', e.message);
    admToast('Failed to load — check Railway is running', true);
  }
}

async function admAction(endpoint, email) {
  if (endpoint === 'revoke' && !confirm('Revoke access for ' + email + '?')) return;
  try {
    const r = await fetch(RAILWAY + '/api/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: CR_USER?.walletAddress, action: endpoint, email }),
    });
    const d = await r.json();
    if (d.ok) { admToast('✓ Done — ' + email); admLoad(); }
    else admToast('Error: ' + (d.error || 'unknown'), true);
  } catch(e) { admToast('Network error', true); }
}

async function admAddMember() {
  const email   = document.getElementById('adm-email')?.value.trim();
  const tv      = document.getElementById('adm-tv')?.value.trim();
  const tierVal = document.getElementById('adm-tier')?.value;
  const result  = document.getElementById('adm-add-result');
  if (!email) { admToast('Email is required', true); return; }
  const tierMap = {
    monthly:  { tier:1, tierName:'MONTHLY',  days:30  },
    biannual: { tier:2, tierName:'BIANNUAL', days:180 },
    annual:   { tier:3, tierName:'ANNUAL',   days:365 },
  };
  const t = tierMap[tierVal] || tierMap.monthly;
  try {
    const r2 = await fetch(RAILWAY + '/api/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: CR_USER?.walletAddress, action: 'add', email, tvUsername: tv || '—', tier: t.tier, tierName: t.tierName, days: t.days }),
    });
    const d2 = await r2.json();
    if (d2.ok) {
      if (result) result.textContent = '✓ Added: ' + email + ' | ' + t.tierName + ' | Expires: ' + admFmt(d2.membershipEnd);
      if (document.getElementById('adm-email')) document.getElementById('adm-email').value = '';
      if (document.getElementById('adm-tv'))    document.getElementById('adm-tv').value = '';
      admToast('✓ Member added!');
      admLoad();
    } else {
      admToast('Error activating member', true);
    }
  } catch(e) { admToast('Network error: ' + e.message, true); }
}

function admToast(msg, err) {
  const t = document.getElementById('adm-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = err ? 'rgba(255,68,68,0.4)' : 'rgba(0,232,122,0.4)';
  t.style.color = err ? '#ff4444' : '#00e87a';
  t.style.opacity = 1;
  setTimeout(function(){ t.style.opacity = 0; }, 3000);
}

// ── BACKEND TIER SYNC — fetch real tier from Railway on login ─────────────────
async function fetchBackendTier(email) {
  if (!email) return;
  try {
    const res = await fetch(RAILWAY + '/api/user/tier?email=' + encodeURIComponent(email));
    const data = await res.json();
    if (data && data.tier > 0 && CR_USER) {
      CR_USER.tier = data.tier;
      CR_USER.tierName = data.tierName;
      CR_USER.membershipEnd = data.membershipEnd;
      DB.save(CR_USER);
      const users = DB.getUsers();
      const key = CR_USER.type === 'wallet' ? 'wallet_' + CR_USER.walletAddress : CR_USER.email;
      if (users[key]) {
        users[key].tier = data.tier;
        users[key].tierName = data.tierName;
        try { localStorage.setItem('cr_users', JSON.stringify(users)); } catch(e) {}
      }
      if (typeof applyTierGating === 'function') applyTierGating();
      console.log('[Auth] Backend tier synced:', data.tier, data.tierName);
    }
  } catch(e) {
    console.log('[Auth] Could not fetch backend tier (offline?):', e.message);
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
init();
