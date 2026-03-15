let _cmChart=null, currentCoinId=null;

function openCoinModal(id){
  currentCoinId=id;
  const c=ALL_COINS.find(x=>x.id===id);
  if(!c)return;
  document.getElementById('cm-ov').classList.add('on');
  const img=document.getElementById('cmImg');img.src=c.image||'';img.style.display='';
  document.getElementById('cmName').textContent=c.name;
  document.getElementById('cmSym').textContent=c.symbol.toUpperCase();
  document.getElementById('cmRank').textContent='#'+(c.market_cap_rank||'—');
  document.getElementById('cmPrice').textContent=fmt(c.current_price);
  function setChg(id,val){const el=document.getElementById(id);if(!el)return;el.textContent=fmtPct(val||0);el.style.color=(val||0)>=0?ACCENT:RED;}
  setChg('cmC1h',c.price_change_percentage_1h_in_currency);
  setChg('cmC24',c.price_change_percentage_24h);
  setChg('cmC7d',c.price_change_percentage_7d_in_currency);
  setChg('cmC30d',c.price_change_percentage_30d_in_currency);
  document.getElementById('cmMC').textContent=fmt(c.market_cap);
  document.getElementById('cmVol').textContent=fmt(c.total_volume);
  document.getElementById('cmVolMC').textContent=c.market_cap>0?((c.total_volume/c.market_cap)*100).toFixed(2)+'%':'—';
  const sup=c.circulating_supply;
  document.getElementById('cmSupply').textContent=sup?sup.toLocaleString(undefined,{maximumFractionDigits:0})+' '+c.symbol.toUpperCase():'—';
  document.getElementById('cmATH').textContent=fmt(c.ath);
  const athPct=document.getElementById('cmATHpct');if(athPct){const v=c.ath_change_percentage||0;athPct.textContent=fmtPct(v)+' from ATH';athPct.style.color=v>=0?ACCENT:RED;}
  document.getElementById('cmATL').textContent=fmt(c.atl);
  const atlPct=document.getElementById('cmATLpct');if(atlPct){const v=c.atl_change_percentage||0;atlPct.textContent='+'+Math.abs(v).toFixed(0)+'% from ATL';atlPct.style.color=ACCENT;}
  const lo=c.low_24h||c.current_price,hi=c.high_24h||c.current_price;
  document.getElementById('cmLow').textContent=fmt(lo);
  document.getElementById('cmHigh').textContent=fmt(hi);
  const pct=hi>lo?Math.round((c.current_price-lo)/(hi-lo)*100):50;
  document.getElementById('cmRangeFill').style.width=pct+'%';
  document.getElementById('cmRangeDot').style.left=pct+'%';
  const spark=c.sparkline_in_7d?.price||[];
  const canvas=document.getElementById('cmChart');
  if(_cmChart){_cmChart.destroy();_cmChart=null;}
  if(canvas&&spark.length>1){
    const sc=spark[spark.length-1]>=spark[0]?ACCENT:RED;
    const ctx=canvas.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,canvas.offsetHeight||120);
    g.addColorStop(0,sc+'55');g.addColorStop(1,sc+'00');
    const labels=spark.map((_,i)=>{const d=new Date();d.setHours(d.getHours()-(spark.length-1-i));return i%24===0?d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'}):''});
    _cmChart=new Chart(canvas,{type:'line',data:{labels,datasets:[{data:spark,borderColor:sc,backgroundColor:g,fill:true,tension:0.4,pointRadius:0,pointHoverRadius:5,borderWidth:2}]},
      options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>' '+fmt(v.raw)}}},
        scales:{y:{grid:{color:'rgba(28,45,56,.6)'},ticks:{color:MUTED,callback:v=>fmt(v)}},x:{grid:{color:'rgba(28,45,56,.3)'},ticks:{color:MUTED,maxTicksLimit:7}}}}});
  }
}
function closeCoinModal(){document.getElementById('cm-ov').classList.remove('on');if(_cmChart){_cmChart.destroy();_cmChart=null;}}

function addToPortfolioFromModal(id){
  if(!CR_USER){closeCoinModal();openAuth('register');return;}
  const coin=ALL_COINS.find(c=>c.id===id);if(!coin)return;
  const amt=parseFloat(prompt('How much '+coin.symbol.toUpperCase()+' do you hold?'));
  if(!amt||isNaN(amt))return;
  if(!CR_USER.portfolio)CR_USER.portfolio=[];
  const existing=CR_USER.portfolio.find(a=>a.id===id);
  if(existing){existing.amount=amt;}else{CR_USER.portfolio.push({id,symbol:coin.symbol.toUpperCase(),amount:amt});}
  DB.save(CR_USER);
  const users=DB.getUsers();const key=CR_USER.email||'wallet_'+CR_USER.walletAddress;
  if(users[key])users[key].portfolio=CR_USER.portfolio;
  try{localStorage.setItem('cr_users',JSON.stringify(users));}catch(e){}
  toast(coin.symbol.toUpperCase()+' added to portfolio ✓','#00e87a');
}
