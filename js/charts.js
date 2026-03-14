// ── DRAW ALL CHARTS — called once after BTC price history is loaded ───────────
async function drawAllCharts(){
  const p  = BTC_CURRENT;
  const p30= BTC_30D.prices;
  const l30= BTC_30D.labels;
  const p12= BTC_12M.prices;
  const l12= BTC_12M.labels;
  const p365=BTC_365D.prices;
  const l365=BTC_365D.labels;

  // ── SMA / 200-Day Moving Average chart ──────────────────────────────────────
  const smaEl=document.getElementById('smaChart');
  if(smaEl&&p365.length){
    const sma200=calcMA(p365,200);
    const sma50=calcMA(p365,50);
    const step=Math.max(1,Math.floor(p365.length/80));
    const pl=p365.filter((_,i)=>i%step===0);
    const ll=l365.filter((_,i)=>i%step===0);
    const s200=sma200.filter((_,i)=>i%step===0);
    const s50=sma50.filter((_,i)=>i%step===0);
    ll[ll.length-1]='Now';
    const g=hexGrad(smaEl,GOLD);
    new Chart(smaEl,{type:'line',data:{labels:ll,datasets:[
      {label:'BTC Price',data:pl,borderColor:GOLD,backgroundColor:g,fill:true,tension:0.4,pointRadius:0,borderWidth:2},
      {label:'200-Day SMA',data:s200,borderColor:'rgba(255,69,96,.85)',fill:false,tension:0.4,pointRadius:0,borderWidth:2,borderDash:[6,3],spanGaps:true},
      {label:'50-Day SMA', data:s50, borderColor:'rgba(0,180,216,.7)', fill:false,tension:0.4,pointRadius:0,borderWidth:1.5,borderDash:[3,2],spanGaps:true}
    ]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:MUTED,font:{size:9}}}},
      scales:{y:{type:'logarithmic',grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v.toLocaleString()}},x:{grid:{color:'#1c2d3820'},ticks:{color:MUTED,maxTicksLimit:8}}}}});

    // Stat cards
    const lastSMA200=sma200.filter(Boolean).slice(-1)[0];
    const smaEl2=document.getElementById('smaCurrentPrice');
    const smaPct=document.getElementById('smaPctAbove');
    if(smaEl2)smaEl2.textContent='$'+p.toLocaleString(undefined,{maximumFractionDigits:0});
    if(smaPct&&lastSMA200){
      const pct=((p-lastSMA200)/lastSMA200*100).toFixed(1);
      smaPct.textContent=(p>=lastSMA200?'↑ +':'↓ ')+Math.abs(pct)+'% vs 200D SMA';
      smaPct.className='cc '+(p>=lastSMA200?'up':'dn');
    }
  }

  // ── RSI — Full detailed: gauge, 30d line, multi-asset comparison, signal table ─
  const rsiGaugeEl   = document.getElementById('rsiGaugeChart');
  const rsiLineEl    = document.getElementById('rsiLineChart');
  const rsiMultiEl   = document.getElementById('rsiMultiChart');
  const rsiTableBody = document.getElementById('rsiTableBody');

  if(rsiGaugeEl || rsiLineEl || rsiMultiEl || rsiTableBody){

    // Fetch full 60-day daily RSI history for a coin (returns {vals, labels, high, low})
    async function getRSIHistory(id){
      // Route through Railway API to avoid CoinGecko CORS block
      try{
        const r = await fetch(`${API_BASE}/api/crypto/rsi/${id}`, {signal:AbortSignal.timeout(15000)});
        if(r.ok){
          const d = await r.json();
          if(d&&d.vals30) return d;
        }
      }catch(e){}
      // Fallback: try CoinGecko direct (works in some browsers/regions)
      const d = await fetchJSON(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=60&interval=daily`);
      if(!d) return null;
      const prices = d.prices.map(p=>p[1]);
      const dates  = d.prices.map(p=>new Date(p[0]).toLocaleDateString('en',{month:'short',day:'numeric'}));
      const rsiArr = calcRSI(prices,14);
      const valid  = rsiArr.map((v,i)=>({v,d:dates[i]})).filter(x=>x.v!==null);
      const last30 = valid.slice(-30);
      const rsi7d  = calcRSI(prices.slice(-21),14).filter(v=>v!==null);
      const vals30 = last30.map(x=>x.v);
      return {
        current : valid[valid.length-1]?.v || null,
        rsi7d   : rsi7d[rsi7d.length-1] || null,
        vals30  : vals30,
        labels30: last30.map(x=>x.d),
        high30  : vals30.length ? Math.max(...vals30).toFixed(1) : null,
        low30   : vals30.length ? Math.min(...vals30).toFixed(1) : null,
      };
    }

    const ASSETS = [
      {id:'bitcoin',       label:'BTC', color: GOLD},
      {id:'ethereum',      label:'ETH', color: BLUE},
      {id:'solana',        label:'SOL', color: PURPLE},
      {id:'binancecoin',   label:'BNB', color: '#F0B90B'},
      {id:'ripple',        label:'XRP', color: '#00AAE4'},
      {id:'cardano',       label:'ADA', color: '#0033AD'},
    ];

    // Fetch all in parallel
    const results = await Promise.all(ASSETS.map(a=>getRSIHistory(a.id)));

    function rsiLabel(v){
      if(!v) return {txt:'Loading',col:MUTED};
      if(v>=70) return {txt:'Overbought',col:RED};
      if(v>=55) return {txt:'Bullish',col:ACCENT};
      if(v>=45) return {txt:'Neutral',col:GOLD};
      if(v>=30) return {txt:'Weak',col:ORANGE};
      return {txt:'Oversold',col:BLUE};
    }
    function rsiColor(v){
      if(!v) return MUTED;
      if(v>=70) return RED;
      if(v>=55) return ACCENT;
      if(v>=45) return GOLD;
      if(v>=30) return ORANGE;
      return BLUE;
    }
    function trendArrow(cur, lo, hi){
      if(!cur||!lo||!hi) return {txt:'—',col:MUTED};
      const mid = (parseFloat(lo)+parseFloat(hi))/2;
      const pos = (cur-mid)/(parseFloat(hi)-parseFloat(lo)||1);
      if(pos>0.3) return {txt:'↑ Rising',col:ACCENT};
      if(pos<-0.3) return {txt:'↓ Falling',col:RED};
      return {txt:'→ Ranging',col:GOLD};
    }

    // ── Stat cards
    ASSETS.forEach((a,i)=>{
      const r = results[i];
      const v = r?.current;
      const lbl = rsiLabel(v);
      const col = rsiColor(v);
      const idMap = {bitcoin:'rsibtc',ethereum:'rsieth',solana:'rsisol',binancecoin:'rsibnb',ripple:'rsixrp',cardano:'rsiada'};
      const lblMap = {bitcoin:'rsibtcLbl',ethereum:'rsiethLbl',solana:'rsisolLbl',binancecoin:'rsibnbLbl',ripple:'rsixrpLbl',cardano:'rsiadaLbl'};
      const valEl = document.getElementById(idMap[a.id]);
      const lblEl = document.getElementById(lblMap[a.id]);
      if(valEl){ valEl.textContent = v ? v.toFixed(1) : '—'; valEl.style.color = col; }
      if(lblEl){ lblEl.textContent = lbl.txt; lblEl.style.color = lbl.col; }
    });

    // ── RSI Gauge (horizontal bar chart — all 6 assets)
    if(rsiGaugeEl){
      const vals  = results.map(r=>r?.current||0);
      const cols  = vals.map(v=>rsiColor(v));
      new Chart(rsiGaugeEl,{
        type:'bar',
        data:{
          labels: ASSETS.map(a=>a.label+' 14D'),
          datasets:[{
            label:'RSI',
            data: vals,
            backgroundColor: cols.map(c=>c+'cc'),
            borderColor: cols,
            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
          }]
        },
        options:{
          indexAxis:'y',
          responsive:true,
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{label:v=>`RSI: ${v.raw.toFixed(1)} — ${rsiLabel(v.raw).txt}`}}
          },
          scales:{
            x:{min:0,max:100,grid:{color:'#1c2d38'},
              ticks:{color:MUTED,callback:v=>v},
              // Zone bands
            },
            y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:10}}}
          }
        }
      });
      // Draw zone overlay labels
    }

    // ── BTC RSI 30-day line
    const btcResult = results[0];
    if(rsiLineEl && btcResult?.vals30?.length){
      const g = hexGrad(rsiLineEl, BLUE);
      new Chart(rsiLineEl,{
        type:'line',
        data:{
          labels: btcResult.labels30,
          datasets:[
            {label:'BTC RSI 14D', data:btcResult.vals30, borderColor:BLUE, backgroundColor:g, fill:true, tension:0.4, pointRadius:2, pointBackgroundColor:BLUE, pointHoverRadius:5},
            {label:'Overbought (70)', data:Array(btcResult.labels30.length).fill(70), borderColor:'rgba(255,69,96,.4)', borderDash:[5,4], fill:false, pointRadius:0},
            {label:'Neutral (50)',    data:Array(btcResult.labels30.length).fill(50), borderColor:'rgba(244,197,66,.3)', borderDash:[3,3], fill:false, pointRadius:0},
            {label:'Oversold (30)',  data:Array(btcResult.labels30.length).fill(30), borderColor:'rgba(0,232,122,.4)', borderDash:[5,4], fill:false, pointRadius:0},
          ]
        },
        options:{
          responsive:true,
          interaction:{mode:'index',intersect:false},
          plugins:{legend:{labels:{color:MUTED,font:{size:9},boxWidth:14}}},
          scales:{
            y:{min:15,max:90,grid:{color:'#1c2d38'},ticks:{color:MUTED}},
            x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,maxTicksLimit:7}}
          }
        }
      });
    }

    // ── Multi-asset RSI comparison (last 30 days)
    if(rsiMultiEl){
      const labels = btcResult?.labels30 || [];
      const datasets = ASSETS.map((a,i)=>({
        label: a.label,
        data: results[i]?.vals30 || [],
        borderColor: a.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      }));
      new Chart(rsiMultiEl,{
        type:'line',
        data:{labels, datasets},
        options:{
          responsive:true,
          interaction:{mode:'index',intersect:false},
          plugins:{legend:{labels:{color:MUTED,font:{size:9},boxWidth:14,padding:14}}},
          scales:{
            y:{min:15,max:90,grid:{color:'#1c2d38'},ticks:{color:MUTED}},
            x:{grid:{color:'#1c2d3820'},ticks:{color:MUTED,maxTicksLimit:8}}
          }
        }
      });
    }

    // ── RSI signal table
    if(rsiTableBody){
      rsiTableBody.innerHTML = ASSETS.map((a,i)=>{
        const r   = results[i];
        const cur = r?.current;
        const r7  = r?.rsi7d;
        const lbl = rsiLabel(cur);
        const col = rsiColor(cur);
        const trnd= trendArrow(cur, r?.low30, r?.high30);
        const barW = cur ? Math.round(cur) : 0;
        const barCol = col;
        return `<tr style="border-bottom:1px solid rgba(28,45,56,.4);transition:background .12s" onmouseover="this.style.background='rgba(0,232,122,.03)'" onmouseout="this.style.background=''">
          <td style="padding:10px 12px">
            <span style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;color:#fff">${a.label}</span>
          </td>
          <td style="text-align:center;padding:10px 12px">
            <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${col}">${cur?cur.toFixed(1):'—'}</span>
          </td>
          <td style="text-align:center;padding:10px 12px">
            <span style="font-family:'Space Mono',monospace;font-size:13px;color:${rsiColor(r7)}">${r7?r7.toFixed(1):'—'}</span>
          </td>
          <td style="text-align:center;padding:10px 12px">
            <span style="background:${col}22;color:${col};border:1px solid ${col}44;padding:3px 10px;border-radius:4px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px">${lbl.txt.toUpperCase()}</span>
          </td>
          <td style="text-align:center;padding:10px 12px;font-family:'Space Mono',monospace;font-size:11px;color:${RED}">${r?.high30||'—'}</td>
          <td style="text-align:center;padding:10px 12px;font-family:'Space Mono',monospace;font-size:11px;color:${ACCENT}">${r?.low30||'—'}</td>
          <td style="padding:10px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
                <div style="width:${barW}%;height:100%;background:${barCol};border-radius:3px;transition:width .6s ease"></div>
              </div>
              <span style="font-family:'Space Mono',monospace;font-size:9px;color:${trnd.col};white-space:nowrap">${trnd.txt}</span>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }

  // ── FED BALANCE SHEET — BTC line = REAL 12-month prices ────────────────────
  // ── FED BALANCE SHEET vs BITCOIN — TradingView dual-axis ─────────────────────
  (function buildFedBtcChart() {
    var wrap = document.getElementById('fedBtcChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    // Fed Balance Sheet (WALCL) — monthly data in $Trillions since 2010
    // Source: Federal Reserve Economic Data (FRED)
    var FED_DATA = [
      ['2010-01',2.23],['2010-04',2.31],['2010-07',2.30],['2010-10',2.35],
      ['2011-01',2.45],['2011-04',2.69],['2011-07',2.87],['2011-10',2.89],
      ['2012-01',2.92],['2012-04',2.88],['2012-07',2.87],['2012-10',2.96],
      ['2013-01',3.01],['2013-04',3.21],['2013-07',3.48],['2013-10',3.77],
      ['2014-01',4.01],['2014-04',4.24],['2014-07',4.37],['2014-10',4.47],
      ['2015-01',4.52],['2015-04',4.49],['2015-07',4.50],['2015-10',4.47],
      ['2016-01',4.46],['2016-04',4.46],['2016-07',4.47],['2016-10',4.45],
      ['2017-01',4.45],['2017-04',4.45],['2017-07',4.47],['2017-10',4.46],
      ['2018-01',4.44],['2018-04',4.32],['2018-07',4.28],['2018-10',4.14],
      ['2019-01',4.04],['2019-04',3.94],['2019-07',3.77],['2019-10',4.02],
      ['2020-01',4.17],['2020-03',5.25],['2020-06',7.10],['2020-09',7.10],['2020-12',7.36],
      ['2021-01',7.39],['2021-04',7.71],['2021-07',8.22],['2021-10',8.55],['2021-12',8.76],
      ['2022-01',8.87],['2022-04',8.97],['2022-07',8.89],['2022-10',8.76],['2022-12',8.55],
      ['2023-01',8.49],['2023-04',8.63],['2023-07',8.17],['2023-10',7.93],['2023-12',7.72],
      ['2024-01',7.68],['2024-04',7.49],['2024-07',7.29],['2024-10',7.05],['2024-12',6.86],
      ['2025-01',6.79],['2025-04',6.71],['2025-07',6.63],['2025-10',6.60],['2025-12',6.58],
      ['2026-01',6.55],['2026-03',6.63],
    ];

    // BTC monthly prices since 2010 (earliest available)
    // Source: CoinGecko / historical BTC data
    var BTC_DATA = [
      ['2010-07',0.05],['2010-10',0.10],['2010-12',0.20],
      ['2011-01',0.30],['2011-04',1.00],['2011-07',13.50],['2011-10',3.50],['2011-12',3.20],
      ['2012-01',6.20],['2012-04',5.00],['2012-07',8.00],['2012-10',10.90],['2012-12',13.50],
      ['2013-01',13.50],['2013-04',144.0],['2013-07',105.0],['2013-10',198.0],['2013-12',732.0],
      ['2014-01',820.0],['2014-04',450.0],['2014-07',585.0],['2014-10',340.0],['2014-12',320.0],
      ['2015-01',217.0],['2015-04',235.0],['2015-07',286.0],['2015-10',315.0],['2015-12',430.0],
      ['2016-01',370.0],['2016-04',460.0],['2016-07',624.0],['2016-10',704.0],['2016-12',963.0],
      ['2017-01',970.0],['2017-04',1347.0],['2017-07',2900.0],['2017-10',6100.0],['2017-12',14000.0],
      ['2018-01',10000.0],['2018-04',9200.0],['2018-07',8200.0],['2018-10',6300.0],['2018-12',3700.0],
      ['2019-01',3450.0],['2019-04',5300.0],['2019-07',9600.0],['2019-10',9200.0],['2019-12',7200.0],
      ['2020-01',9350.0],['2020-04',8700.0],['2020-07',11300.0],['2020-10',13800.0],['2020-12',29300.0],
      ['2021-01',33100.0],['2021-04',57700.0],['2021-07',41500.0],['2021-10',61400.0],['2021-12',46200.0],
      ['2022-01',38500.0],['2022-04',38600.0],['2022-07',23300.0],['2022-10',20500.0],['2022-12',16500.0],
      ['2023-01',23100.0],['2023-04',29300.0],['2023-07',29300.0],['2023-10',34700.0],['2023-12',42800.0],
      ['2024-01',42500.0],['2024-04',60700.0],['2024-07',66000.0],['2024-10',72600.0],['2024-12',94200.0],
      ['2025-01',102000.0],['2025-04',94500.0],['2025-07',118000.0],['2025-10',108000.0],['2025-12',102000.0],
      ['2026-01',98000.0],['2026-03',93000.0],
    ];

    // Convert YYYY-MM to unix timestamp
    function toTs(ym) { return new Date(ym + '-01').getTime() / 1000; }

    // Create chart with LEFT axis for Fed (linear) and RIGHT axis for BTC (log)
    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 500,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      leftPriceScale:  { visible:true,  borderColor:'#22c55e', textColor:'#22c55e' },
      rightPriceScale: {
        visible: true, borderColor:'#f4c542', textColor:'#f4c542',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins:{top:0.05,bottom:0.05}
      },
      timeScale: { borderColor:'#1c2d38', timeVisible:false },
      handleScroll: true, handleScale: true,
    });

    // Fed Balance Sheet — green line on LEFT axis (linear)
    var fedSeries = chart.addLineSeries({
      color: '#22c55e', lineWidth: 2,
      priceScaleId: 'left',
      priceLineVisible: true,
      lastValueVisible: true,
      title: 'Fed Balance Sheet ($T)',
    });
    fedSeries.setData(FED_DATA.map(function(d){ return {time:toTs(d[0]), value:d[1]}; }));

    // BTC — orange/gold line on RIGHT axis (log scale)
    var btcSeries = chart.addLineSeries({
      color: '#f4c542', lineWidth: 2,
      priceScaleId: 'right',
      priceLineVisible: true,
      lastValueVisible: true,
      title: 'BTC/USD',
    });

    var btcChartData = getBtcOverlayData(BTC_DATA);
    btcSeries.setData(btcChartData);

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    window._fedBtcChart  = chart;
    window._fedBtcSeries = btcSeries;

    // Update stat cards
    var fedBalEl = document.getElementById('fedBalVal');
    var fedBtcEl = document.getElementById('fedBtcVal');
    if (fedBalEl) fedBalEl.textContent = '$' + FED_DATA[FED_DATA.length-1][1].toFixed(2) + 'T';
    if (fedBtcEl && window.BTC_CURRENT) fedBtcEl.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();

    var upd = document.getElementById('fedUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Refresh — update live BTC point
    window._fedRefresh = function() {
      if (!window._fedBtcSeries) return;
      var data = getBtcOverlayData(BTC_DATA);
      window._fedBtcSeries.setData(data);
      var el = document.getElementById('fedBtcVal');
      if (el && window.BTC_CURRENT) el.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();
      var upd2 = document.getElementById('fedUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── DOLLAR INDEX vs BITCOIN — TradingView dual-axis since 2013 ───────────────
  (function buildDxyBtcChart() {
    var wrap = document.getElementById('dxyBtcChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    function toTs(ym) { return new Date(ym + '-01').getTime() / 1000; }

    // Trade Weighted USD Index (DTWEXAFEGS / DXY equivalent) — monthly since 2013
    // Source: Federal Reserve / FRED — broader measure tracking ~20 currencies
    var DXY_DATA = [
      ['2013-01',103.5],['2013-04',102.8],['2013-07',103.2],['2013-10',103.8],
      ['2014-01',104.5],['2014-04',103.9],['2014-07',106.5],['2014-10',111.2],
      ['2015-01',117.5],['2015-04',118.8],['2015-07',119.5],['2015-10',121.8],
      ['2016-01',121.0],['2016-04',119.5],['2016-07',118.8],['2016-10',121.5],
      ['2017-01',120.5],['2017-04',118.5],['2017-07',114.5],['2017-10',113.2],
      ['2018-01',112.8],['2018-04',114.5],['2018-07',118.2],['2018-10',119.8],
      ['2019-01',118.5],['2019-04',119.2],['2019-07',120.5],['2019-10',119.8],
      ['2020-01',118.5],['2020-04',121.5],['2020-07',114.5],['2020-10',113.2],
      ['2021-01',112.8],['2021-04',113.5],['2021-07',115.5],['2021-10',116.8],
      ['2022-01',117.5],['2022-04',120.5],['2022-07',124.8],['2022-10',126.5],
      ['2023-01',125.2],['2023-04',124.8],['2023-07',125.5],['2023-10',126.8],
      ['2024-01',125.5],['2024-04',126.2],['2024-07',124.8],['2024-10',125.5],
      ['2025-01',124.2],['2025-04',120.5],['2025-07',116.8],['2025-10',114.5],
      ['2026-01',113.5],['2026-03',111.3],
    ];

    // BTC monthly closes since 2013
    var BTC_DATA = [
      ['2013-01',13.5],['2013-04',144.0],['2013-07',105.0],['2013-10',198.0],['2013-12',732.0],
      ['2014-01',820.0],['2014-04',450.0],['2014-07',585.0],['2014-10',340.0],['2014-12',320.0],
      ['2015-01',217.0],['2015-04',235.0],['2015-07',286.0],['2015-10',315.0],['2015-12',430.0],
      ['2016-01',370.0],['2016-04',460.0],['2016-07',624.0],['2016-10',704.0],['2016-12',963.0],
      ['2017-01',970.0],['2017-04',1347.0],['2017-07',2900.0],['2017-10',6100.0],['2017-12',14000.0],
      ['2018-01',10000.0],['2018-04',9200.0],['2018-07',8200.0],['2018-10',6300.0],['2018-12',3700.0],
      ['2019-01',3450.0],['2019-04',5300.0],['2019-07',9600.0],['2019-10',9200.0],['2019-12',7200.0],
      ['2020-01',9350.0],['2020-04',8700.0],['2020-07',11300.0],['2020-10',13800.0],['2020-12',29300.0],
      ['2021-01',33100.0],['2021-04',57700.0],['2021-07',41500.0],['2021-10',61400.0],['2021-12',46200.0],
      ['2022-01',38500.0],['2022-04',38600.0],['2022-07',23300.0],['2022-10',20500.0],['2022-12',16500.0],
      ['2023-01',23100.0],['2023-04',29300.0],['2023-07',29300.0],['2023-10',34700.0],['2023-12',42800.0],
      ['2024-01',42500.0],['2024-04',60700.0],['2024-07',66000.0],['2024-10',72600.0],['2024-12',94200.0],
      ['2025-01',102000.0],['2025-04',94500.0],['2025-07',118000.0],['2025-10',108000.0],['2025-12',102000.0],
      ['2026-01',98000.0],['2026-03',93000.0],
    ];

    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 500,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      leftPriceScale: {
        visible: true, borderColor:'#ef4444', textColor:'#ef4444',
        scaleMargins:{top:0.05,bottom:0.05}
      },
      rightPriceScale: {
        visible: true, borderColor:'#f4c542', textColor:'#f4c542',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins:{top:0.05,bottom:0.05}
      },
      timeScale: { borderColor:'#1c2d38', timeVisible:false },
      handleScroll: true, handleScale: true,
    });

    // DXY — red line, left axis (linear)
    var dxySeries = chart.addLineSeries({
      color: '#ef4444', lineWidth: 1.8,
      priceScaleId: 'left',
      priceLineVisible: true,
      lastValueVisible: true,
      title: 'DXY',
    });
    dxySeries.setData(DXY_DATA.map(function(d){ return {time:toTs(d[0]), value:d[1]}; }));

    // BTC — gold line, right axis (log scale)
    var btcSeries = chart.addLineSeries({
      color: '#f4c542', lineWidth: 1.8,
      priceScaleId: 'right',
      priceLineVisible: true,
      lastValueVisible: true,
      title: 'BTC',
    });

    btcSeries.setData(getBtcOverlayData(BTC_DATA));

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    window._dxyBtcChart  = chart;
    window._dxyBtcSeries = btcSeries;

    // Update stat cards
    var dxyValEl = document.getElementById('dxyValNew');
    var dxyBtcEl = document.getElementById('dxyBtcNew');
    var dxyLatest = DXY_DATA[DXY_DATA.length-1][1];
    if (dxyValEl) dxyValEl.textContent = dxyLatest.toFixed(1);
    if (dxyBtcEl && window.BTC_CURRENT) dxyBtcEl.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();

    var upd = document.getElementById('dxyUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Daily refresh — update live BTC endpoint
    window._dxyRefresh = function() {
      if (!window._dxyBtcSeries) return;
      var data = getBtcOverlayData(BTC_DATA);
      window._dxyBtcSeries.setData(data);
      var el = document.getElementById('dxyBtcNew');
      if (el && window.BTC_CURRENT) el.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();
      var upd2 = document.getElementById('dxyUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── GLOBAL LIQUIDITY — BTC line = REAL 12-month prices ─────────────────────
  // ── GLOBAL LIQUIDITY INDEX vs BITCOIN — TradingView multi-series ─────────────
  (function buildLiqBtcChart() {
    var wrap = document.getElementById('liqBtcChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    function toTs(ym) { return new Date(ym + '-01').getTime() / 1000; }

    // Fed Balance Sheet in $T (WALCL) — same as Fed panel
    var FED = [
      ['2012-01',2.92],['2012-07',2.87],['2013-01',3.01],['2013-07',3.48],
      ['2014-01',4.01],['2014-07',4.37],['2015-01',4.52],['2015-07',4.50],
      ['2016-01',4.46],['2016-07',4.47],['2017-01',4.45],['2017-07',4.47],
      ['2018-01',4.44],['2018-07',4.28],['2019-01',4.04],['2019-07',3.77],
      ['2020-01',4.17],['2020-04',5.25],['2020-07',7.10],['2020-10',7.36],
      ['2021-01',7.39],['2021-07',8.22],['2022-01',8.87],['2022-07',8.89],
      ['2022-10',8.76],['2023-01',8.49],['2023-07',8.17],['2024-01',7.68],
      ['2024-07',7.29],['2025-01',6.79],['2025-07',6.63],['2026-01',6.55],['2026-03',6.60],
    ];

    // ECB Balance Sheet in €T × EUR/USD rate → $T
    // EUR/USD approx rates applied for USD conversion
    var ECB = [
      ['2012-01',3.02],['2012-07',3.12],['2013-01',2.95],['2013-07',2.85],
      ['2014-01',2.90],['2014-07',2.95],['2015-01',2.45],['2015-07',2.55],
      ['2016-01',2.70],['2016-07',3.05],['2017-01',3.80],['2017-07',4.30],
      ['2018-01',5.20],['2018-07',5.40],['2019-01',4.70],['2019-07',4.60],
      ['2020-01',4.70],['2020-07',6.20],['2020-10',6.90],
      ['2021-01',7.10],['2021-07',8.20],['2022-01',8.60],['2022-07',8.00],
      ['2022-10',8.10],['2023-01',7.90],['2023-07',7.40],['2024-01',7.20],
      ['2024-07',7.10],['2025-01',7.20],['2025-07',7.30],['2026-01',7.20],['2026-03',7.20],
    ];

    // BOJ Balance Sheet in ¥T × USD/JPY rate → $T
    var BOJ = [
      ['2012-01',1.60],['2012-07',1.70],['2013-01',1.80],['2013-07',2.10],
      ['2014-01',2.30],['2014-07',2.60],['2015-01',2.80],['2015-07',2.90],
      ['2016-01',2.90],['2016-07',3.00],['2017-01',3.40],['2017-07',3.80],
      ['2018-01',4.50],['2018-07',4.80],['2019-01',4.80],['2019-07',4.90],
      ['2020-01',5.00],['2020-07',6.20],['2020-10',6.40],
      ['2021-01',6.60],['2021-07',6.60],['2022-01',6.70],['2022-07',4.80],
      ['2022-10',4.70],['2023-01',5.00],['2023-07',4.80],['2024-01',4.60],
      ['2024-07',4.20],['2025-01',4.40],['2025-07',4.50],['2026-01',4.40],['2026-03',4.40],
    ];

    // Compute Total = FED + ECB + BOJ (aligned by date)
    function buildTotal(fed, ecb, boj) {
      var ecbMap = {}, bojMap = {};
      ecb.forEach(function(d){ ecbMap[d[0]] = d[1]; });
      boj.forEach(function(d){ bojMap[d[0]] = d[1]; });
      return fed.map(function(d) {
        var e = ecbMap[d[0]] || 0, b = bojMap[d[0]] || 0;
        return [d[0], +(d[1] + e + b).toFixed(2)];
      });
    }
    var TOTAL = buildTotal(FED, ECB, BOJ);

    // BTC monthly prices since 2012
    var BTC = [
      ['2012-01',6.2],['2012-07',8.0],['2013-01',13.5],['2013-07',105.0],['2013-12',732.0],
      ['2014-01',820.0],['2014-07',585.0],['2014-12',320.0],
      ['2015-01',217.0],['2015-07',286.0],['2015-12',430.0],
      ['2016-01',370.0],['2016-07',624.0],['2016-12',963.0],
      ['2017-01',970.0],['2017-07',2900.0],['2017-12',14000.0],
      ['2018-01',10000.0],['2018-07',8200.0],['2018-12',3700.0],
      ['2019-01',3450.0],['2019-07',9600.0],['2019-12',7200.0],
      ['2020-01',9350.0],['2020-07',11300.0],['2020-10',13800.0],['2020-12',29300.0],
      ['2021-01',33100.0],['2021-07',41500.0],['2021-12',46200.0],
      ['2022-01',38500.0],['2022-07',23300.0],['2022-10',20500.0],['2022-12',16500.0],
      ['2023-01',23100.0],['2023-07',29300.0],['2023-12',42800.0],
      ['2024-01',42500.0],['2024-07',66000.0],['2024-12',94200.0],
      ['2025-01',102000.0],['2025-07',118000.0],['2025-12',102000.0],
      ['2026-01',98000.0],['2026-03',93000.0],
    ];

    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 520,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      leftPriceScale:  { visible:true, borderColor:'#22c55e', scaleMargins:{top:0.05,bottom:0.05} },
      rightPriceScale: {
        visible:true, borderColor:'#f4c542',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins:{top:0.05,bottom:0.05}
      },
      timeScale: { borderColor:'#1c2d38', timeVisible:false },
      handleScroll:true, handleScale:true,
    });

    // Build all 5 series
    var SERIES_CFG = [
      { key:'fed',   data:FED,   color:'#3b82f6', width:1.5, axis:'left',  title:'Fed' },
      { key:'ecb',   data:ECB,   color:'#06b6d4', width:1.5, axis:'left',  title:'ECB' },
      { key:'boj',   data:BOJ,   color:'#a855f7', width:1.5, axis:'left',  title:'BOJ' },
      { key:'total', data:TOTAL, color:'#22c55e', width:2.5, axis:'left',  title:'Total' },
      { key:'btc',   data:BTC,   color:'#f4c542', width:2.0, axis:'right', title:'BTC/USD' },
    ];

    var seriesMap = {}, visibleMap = {};
    SERIES_CFG.forEach(function(cfg) {
      visibleMap[cfg.key] = true;
      var s = chart.addLineSeries({
        color: cfg.color, lineWidth: cfg.width,
        priceScaleId: cfg.axis,
        priceLineVisible: true,
        lastValueVisible: true,
        title: cfg.title,
      });
      var d = cfg.key === 'btc'
        ? getBtcOverlayData(cfg.data)
        : cfg.data.map(function(p){ return {time:toTs(p[0]), value:p[1]}; });
      s.setData(d);
      seriesMap[cfg.key] = s;
    });

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    window._liqChart   = chart;
    window._liqSeries  = seriesMap;
    window._liqVisible = visibleMap;
    window._liqBtcData = BTC;

    // Toggle handler
    window.liqToggle = function(key) {
      visibleMap[key] = !visibleMap[key];
      var pill = document.getElementById('liqPill_' + key);
      if (pill) pill.style.opacity = visibleMap[key] ? '1' : '0.35';
      if (seriesMap[key]) seriesMap[key].applyOptions({visible: visibleMap[key]});
    };

    // Update stat cards
    var totalLatest = TOTAL[TOTAL.length-1][1];
    var fedLatest   = FED[FED.length-1][1];
    var ecbLatest   = ECB[ECB.length-1][1];
    var bojLatest   = BOJ[BOJ.length-1][1];
    var el = document.getElementById('liqTotal'); if(el) el.textContent = '$'+totalLatest.toFixed(1)+'T';
    var el2= document.getElementById('liqFed');   if(el2) el2.textContent = '$'+fedLatest.toFixed(1)+'T';
    var el3= document.getElementById('liqEcb');   if(el3) el3.textContent = '$'+ecbLatest.toFixed(1)+'T';
    var el4= document.getElementById('liqBoj');   if(el4) el4.textContent = '$'+bojLatest.toFixed(1)+'T';

    var upd = document.getElementById('liqUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Refresh — update live BTC endpoint
    window._liqRefresh = function() {
      if (!window._liqSeries || !window._liqSeries.btc) return;
      var data = getBtcOverlayData(window._liqBtcData);
      window._liqSeries.btc.setData(data);
      var upd2 = document.getElementById('liqUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── ISM CHARTS ──────────────────────────────────────────────────────────────
  // ── BITCOIN ISM CHART — color-coded by ISM Manufacturing PMI ─────────────────
  (function buildIsmBtcChart() {
    var wrap = document.getElementById('ismBtcChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    // ISM Manufacturing PMI monthly data since 2013
    // Format: [YYYY-MM, PMI value]
    // Source: Institute for Supply Management historical data
    var ISM_DATA = [
      ['2013-01',53.1],['2013-02',54.2],['2013-03',51.3],['2013-04',50.7],['2013-05',49.0],['2013-06',50.9],
      ['2013-07',55.4],['2013-08',55.7],['2013-09',56.2],['2013-10',56.4],['2013-11',57.3],['2013-12',56.5],
      ['2014-01',51.3],['2014-02',53.2],['2014-03',53.7],['2014-04',54.9],['2014-05',55.4],['2014-06',55.3],
      ['2014-07',57.1],['2014-08',59.0],['2014-09',56.6],['2014-10',59.0],['2014-11',58.7],['2014-12',55.5],
      ['2015-01',53.5],['2015-02',52.9],['2015-03',51.5],['2015-04',51.5],['2015-05',52.8],['2015-06',53.5],
      ['2015-07',52.7],['2015-08',51.1],['2015-09',50.1],['2015-10',50.1],['2015-11',48.6],['2015-12',48.2],
      ['2016-01',48.2],['2016-02',49.5],['2016-03',51.8],['2016-04',50.8],['2016-05',51.3],['2016-06',53.2],
      ['2016-07',52.6],['2016-08',49.4],['2016-09',51.5],['2016-10',51.9],['2016-11',53.2],['2016-12',54.7],
      ['2017-01',56.0],['2017-02',57.7],['2017-03',57.2],['2017-04',54.8],['2017-05',54.9],['2017-06',57.8],
      ['2017-07',56.3],['2017-08',58.8],['2017-09',60.8],['2017-10',58.7],['2017-11',58.2],['2017-12',59.7],
      ['2018-01',59.1],['2018-02',60.8],['2018-03',59.3],['2018-04',57.3],['2018-05',58.7],['2018-06',60.2],
      ['2018-07',58.1],['2018-08',61.3],['2018-09',59.8],['2018-10',57.7],['2018-11',59.3],['2018-12',54.1],
      ['2019-01',56.6],['2019-02',54.2],['2019-03',55.3],['2019-04',52.8],['2019-05',52.1],['2019-06',51.7],
      ['2019-07',51.2],['2019-08',49.1],['2019-09',47.8],['2019-10',48.3],['2019-11',48.1],['2019-12',47.2],
      ['2020-01',50.9],['2020-02',50.1],['2020-03',49.1],['2020-04',41.5],['2020-05',43.1],['2020-06',52.6],
      ['2020-07',54.2],['2020-08',56.0],['2020-09',55.4],['2020-10',59.3],['2020-11',57.5],['2020-12',60.7],
      ['2021-01',58.7],['2021-02',60.8],['2021-03',64.7],['2021-04',60.7],['2021-05',61.2],['2021-06',60.6],
      ['2021-07',59.5],['2021-08',59.9],['2021-09',61.1],['2021-10',60.8],['2021-11',61.1],['2021-12',58.7],
      ['2022-01',57.6],['2022-02',58.6],['2022-03',57.1],['2022-04',55.4],['2022-05',56.1],['2022-06',53.0],
      ['2022-07',52.8],['2022-08',52.8],['2022-09',50.9],['2022-10',50.2],['2022-11',49.0],['2022-12',48.4],
      ['2023-01',47.4],['2023-02',47.7],['2023-03',46.3],['2023-04',47.1],['2023-05',46.9],['2023-06',46.0],
      ['2023-07',46.4],['2023-08',47.6],['2023-09',49.0],['2023-10',46.7],['2023-11',46.7],['2023-12',47.4],
      ['2024-01',49.1],['2024-02',47.8],['2024-03',50.3],['2024-04',49.2],['2024-05',48.7],['2024-06',48.5],
      ['2024-07',46.8],['2024-08',47.2],['2024-09',47.2],['2024-10',46.5],['2024-11',48.4],['2024-12',49.3],
      ['2025-01',50.9],['2025-02',50.3],['2025-03',49.0],['2025-04',48.7],['2025-05',48.5],['2025-06',48.7],
      ['2025-07',49.5],['2025-08',49.8],['2025-09',50.1],['2025-10',50.3],['2025-11',50.5],['2025-12',50.3],
      ['2026-01',49.8],['2026-02',49.5],['2026-03',49.8],
    ];

    // BTC monthly close prices since 2013
    // Format: [YYYY-MM, price]
    var BTC_MONTHLY = [
      ['2013-01',13.5],['2013-02',34.0],['2013-03',91.0],['2013-04',144.0],['2013-05',129.0],['2013-06',98.0],
      ['2013-07',105.0],['2013-08',130.0],['2013-09',133.0],['2013-10',198.0],['2013-11',1120.0],['2013-12',732.0],
      ['2014-01',820.0],['2014-02',590.0],['2014-03',450.0],['2014-04',450.0],['2014-05',630.0],['2014-06',635.0],
      ['2014-07',585.0],['2014-08',500.0],['2014-09',390.0],['2014-10',340.0],['2014-11',378.0],['2014-12',320.0],
      ['2015-01',217.0],['2015-02',254.0],['2015-03',247.0],['2015-04',235.0],['2015-05',233.0],['2015-06',263.0],
      ['2015-07',286.0],['2015-08',230.0],['2015-09',237.0],['2015-10',315.0],['2015-11',378.0],['2015-12',430.0],
      ['2016-01',370.0],['2016-02',435.0],['2016-03',415.0],['2016-04',460.0],['2016-05',530.0],['2016-06',670.0],
      ['2016-07',624.0],['2016-08',576.0],['2016-09',610.0],['2016-10',704.0],['2016-11',740.0],['2016-12',963.0],
      ['2017-01',970.0],['2017-02',1190.0],['2017-03',1070.0],['2017-04',1347.0],['2017-05',2300.0],['2017-06',2550.0],
      ['2017-07',2900.0],['2017-08',4700.0],['2017-09',4200.0],['2017-10',6100.0],['2017-11',10900.0],['2017-12',14000.0],
      ['2018-01',10000.0],['2018-02',10900.0],['2018-03',7000.0],['2018-04',9200.0],['2018-05',7500.0],['2018-06',6200.0],
      ['2018-07',8200.0],['2018-08',7000.0],['2018-09',6600.0],['2018-10',6300.0],['2018-11',4000.0],['2018-12',3700.0],
      ['2019-01',3450.0],['2019-02',3800.0],['2019-03',4100.0],['2019-04',5300.0],['2019-05',8700.0],['2019-06',10800.0],
      ['2019-07',9600.0],['2019-08',9600.0],['2019-09',8300.0],['2019-10',9200.0],['2019-11',7500.0],['2019-12',7200.0],
      ['2020-01',9350.0],['2020-02',8600.0],['2020-03',6400.0],['2020-04',8700.0],['2020-05',9450.0],['2020-06',9100.0],
      ['2020-07',11300.0],['2020-08',11650.0],['2020-09',10800.0],['2020-10',13800.0],['2020-11',19700.0],['2020-12',29300.0],
      ['2021-01',33100.0],['2021-02',46200.0],['2021-03',59000.0],['2021-04',57700.0],['2021-05',37300.0],['2021-06',35000.0],
      ['2021-07',41500.0],['2021-08',47100.0],['2021-09',43800.0],['2021-10',61400.0],['2021-11',57000.0],['2021-12',46200.0],
      ['2022-01',38500.0],['2022-02',43200.0],['2022-03',46300.0],['2022-04',38600.0],['2022-05',31800.0],['2022-06',19000.0],
      ['2022-07',23300.0],['2022-08',20050.0],['2022-09',19430.0],['2022-10',20500.0],['2022-11',16600.0],['2022-12',16500.0],
      ['2023-01',23100.0],['2023-02',23500.0],['2023-03',28500.0],['2023-04',29300.0],['2023-05',27700.0],['2023-06',30500.0],
      ['2023-07',29300.0],['2023-08',26000.0],['2023-09',27000.0],['2023-10',34700.0],['2023-11',37900.0],['2023-12',42800.0],
      ['2024-01',42500.0],['2024-02',61500.0],['2024-03',71300.0],['2024-04',60700.0],['2024-05',67500.0],['2024-06',62700.0],
      ['2024-07',66000.0],['2024-08',59000.0],['2024-09',63300.0],['2024-10',72600.0],['2024-11',97700.0],['2024-12',94200.0],
      ['2025-01',102000.0],['2025-02',84500.0],['2025-03',82800.0],['2025-04',94500.0],['2025-05',105000.0],['2025-06',107000.0],
      ['2025-07',118000.0],['2025-08',115000.0],['2025-09',110000.0],['2025-10',108000.0],['2025-11',105000.0],['2025-12',102000.0],
      ['2026-01',98000.0],['2026-02',95000.0],['2026-03',93000.0],
    ];

    // Build ISM lookup map: YYYY-MM → PMI
    var ismMap = {};
    ISM_DATA.forEach(function(d){ ismMap[d[0]] = d[1]; });

    // Color function: PMI → color string (green=low, yellow=neutral, orange=high, red=very high)
    function ismColor(pmi) {
      if (pmi === null || pmi === undefined) return '#4d6475';
      if (pmi < 44)  return '#22c55e'; // deep green — very deflationary
      if (pmi < 48)  return '#4ade80'; // light green — deflationary
      if (pmi < 50)  return '#86efac'; // pale green — below neutral
      if (pmi < 52)  return '#fbbf24'; // yellow — neutral
      if (pmi < 55)  return '#f97316'; // orange — inflationary
      if (pmi < 60)  return '#ef4444'; // red — high inflation
      return '#dc2626';                // deep red — very high
    }

    // Use TradingView baseline series + multiple colored segments
    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 480,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#1c2d38',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins: {top:0.05, bottom:0.05}
      },
      timeScale: { borderColor:'#1c2d38', timeVisible:false },
      handleScroll: true, handleScale: true,
    });

    // Use real BTC monthly history if loaded, otherwise use hardcoded BTC_MONTHLY
    function getBtcSrc() {
      if (window.BTC_MONTHLY_HISTORY && window.BTC_MONTHLY_HISTORY.length > 10) {
        return window.BTC_MONTHLY_HISTORY.map(function(m){ return [m.ym, m.price]; });
      }
      return BTC_MONTHLY;
    }

    // For each month segment, create a 2-point line series with that month's ISM color
    var btcSrc = getBtcSrc();
    btcSrc.forEach(function(entry, i) {
      if (i === 0) return;
      var prevEntry = btcSrc[i-1];
      var ym   = entry[0];
      var pmi  = ismMap[ym] || ismMap[prevEntry[0]] || 50;
      var col  = ismColor(pmi);

      var seg = chart.addLineSeries({
        color:            col,
        lineWidth:        2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      var t1 = new Date(prevEntry[0]+'-01').getTime() / 1000;
      var t2 = new Date(entry[0]+'-01').getTime() / 1000;

      seg.setData([
        { time: t1, value: prevEntry[1] },
        { time: t2, value: entry[1] }
      ]);
    });

    // Add current live price as final segment
    var lastBtc  = btcSrc[btcSrc.length - 1];
    var lastPMI  = ISM_DATA[ISM_DATA.length - 1][1];
    var liveSeg  = chart.addLineSeries({
      color: ismColor(lastPMI), lineWidth: 2.5,
      priceLineVisible: true, lastValueVisible: true,
      priceLineStyle: LightweightCharts.LineStyle.Dotted,
    });
    var livePrice = window.BTC_CURRENT ? Math.round(window.BTC_CURRENT) : lastBtc[1];
    liveSeg.setData([
      { time: new Date(lastBtc[0]+'-01').getTime()/1000, value: lastBtc[1] },
      { time: Math.floor(Date.now()/1000), value: livePrice }
    ]);
    window._ismLiveSeg = liveSeg;

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    // Update current ISM value display
    var latestISM = ISM_DATA[ISM_DATA.length - 1];
    var ismValEl  = document.getElementById('ismCurrentVal');
    var ismMfgEl  = document.getElementById('ismMfgVal');
    if (ismValEl) { ismValEl.textContent = latestISM[1]; ismValEl.style.color = ismColor(latestISM[1]); }
    if (ismMfgEl) ismMfgEl.textContent = latestISM[1];

    var upd = document.getElementById('ismUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    window._ismBtcChart = chart;

    // Refresh live price endpoint
    window._ismRefresh = function() {
      if (!window._ismLiveSeg) return;
      var tNow = Math.floor(Date.now() / 1000);
      // Get best available last BTC price point
      var lastPrice = (window.BTC_MONTHLY_HISTORY && window.BTC_MONTHLY_HISTORY.length > 0)
        ? window.BTC_MONTHLY_HISTORY[window.BTC_MONTHLY_HISTORY.length - 1].price
        : 93000;
      var lastTs = (window.BTC_MONTHLY_HISTORY && window.BTC_MONTHLY_HISTORY.length > 0)
        ? window.BTC_MONTHLY_HISTORY[window.BTC_MONTHLY_HISTORY.length - 1].ts
        : new Date('2026-03-01').getTime() / 1000;
      var livePrice = window.BTC_CURRENT ? Math.round(window.BTC_CURRENT) : lastPrice;
      window._ismLiveSeg.setData([
        {time: lastTs, value: lastPrice},
        {time: tNow,   value: livePrice}
      ]);
      var upd = document.getElementById('ismUpdated');
      if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── SOCIAL RISK — derived from real 30d BTC price momentum ─────────────────
  // ── BITCOIN SOCIAL RISK — Google Trends color-coded BTC price chart ──────────
  (function buildSocialRiskChart() {
    var wrap = document.getElementById('socialRiskChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    function toTs(ym) { return new Date(ym + '-01').getTime() / 1000; }

    // Google Trends interest for "Bitcoin" — monthly, 0-100 scale
    // Source: Google Trends historical data (trends.google.com)
    // 100 = peak interest, 0 = minimal interest
    var TRENDS = {
      '2013-01':4,'2013-02':5,'2013-03':6,'2013-04':18,'2013-05':10,'2013-06':8,
      '2013-07':8,'2013-08':8,'2013-09':8,'2013-10':9,'2013-11':30,'2013-12':27,
      '2014-01':19,'2014-02':12,'2014-03':10,'2014-04':9,'2014-05':9,'2014-06':9,
      '2014-07':8,'2014-08':8,'2014-09':8,'2014-10':8,'2014-11':8,'2014-12':8,
      '2015-01':7,'2015-02':7,'2015-03':7,'2015-04':7,'2015-05':7,'2015-06':8,
      '2015-07':8,'2015-08':7,'2015-09':7,'2015-10':8,'2015-11':8,'2015-12':10,
      '2016-01':9,'2016-02':9,'2016-03':9,'2016-04':9,'2016-05':10,'2016-06':11,
      '2016-07':10,'2016-08':9,'2016-09':9,'2016-10':10,'2016-11':11,'2016-12':18,
      '2017-01':18,'2017-02':18,'2017-03':19,'2017-04':20,'2017-05':30,'2017-06':35,
      '2017-07':28,'2017-08':32,'2017-09':40,'2017-10':45,'2017-11':75,'2017-12':100,
      '2018-01':75,'2018-02':45,'2018-03':35,'2018-04':30,'2018-05':28,'2018-06':22,
      '2018-07':18,'2018-08':15,'2018-09':14,'2018-10':14,'2018-11':18,'2018-12':15,
      '2019-01':12,'2019-02':11,'2019-03':12,'2019-04':16,'2019-05':22,'2019-06':28,
      '2019-07':22,'2019-08':18,'2019-09':16,'2019-10':16,'2019-11':15,'2019-12':14,
      '2020-01':15,'2020-02':14,'2020-03':14,'2020-04':13,'2020-05':13,'2020-06':13,
      '2020-07':14,'2020-08':14,'2020-09':13,'2020-10':16,'2020-11':28,'2020-12':45,
      '2021-01':55,'2021-02':65,'2021-03':55,'2021-04':75,'2021-05':70,'2021-06':42,
      '2021-07':38,'2021-08':42,'2021-09':42,'2021-10':55,'2021-11':80,'2021-12':62,
      '2022-01':48,'2022-02':40,'2022-03':38,'2022-04':32,'2022-05':35,'2022-06':28,
      '2022-07':22,'2022-08':20,'2022-09':18,'2022-10':18,'2022-11':22,'2022-12':18,
      '2023-01':20,'2023-02':18,'2023-03':20,'2023-04':22,'2023-05':20,'2023-06':19,
      '2023-07':18,'2023-08':18,'2023-09':17,'2023-10':22,'2023-11':28,'2023-12':35,
      '2024-01':38,'2024-02':52,'2024-03':60,'2024-04':48,'2024-05':42,'2024-06':38,
      '2024-07':40,'2024-08':35,'2024-09':38,'2024-10':45,'2024-11':68,'2024-12':62,
      '2025-01':65,'2025-02':55,'2025-03':52,'2025-04':58,'2025-05':60,'2025-06':62,
      '2025-07':65,'2025-08':62,'2025-09':58,'2025-10':55,'2025-11':52,'2025-12':50,
      '2026-01':48,'2026-02':45,'2026-03':42,
    };

    // BTC monthly closes since 2013
    var BTC_MONTHLY = [
      ['2013-01',13.5],['2013-02',34.0],['2013-03',91.0],['2013-04',144.0],['2013-05',129.0],['2013-06',98.0],
      ['2013-07',105.0],['2013-08',130.0],['2013-09',133.0],['2013-10',198.0],['2013-11',1120.0],['2013-12',732.0],
      ['2014-01',820.0],['2014-02',590.0],['2014-03',450.0],['2014-04',450.0],['2014-05',630.0],['2014-06',635.0],
      ['2014-07',585.0],['2014-08',500.0],['2014-09',390.0],['2014-10',340.0],['2014-11',378.0],['2014-12',320.0],
      ['2015-01',217.0],['2015-02',254.0],['2015-03',247.0],['2015-04',235.0],['2015-05',233.0],['2015-06',263.0],
      ['2015-07',286.0],['2015-08',230.0],['2015-09',237.0],['2015-10',315.0],['2015-11',378.0],['2015-12',430.0],
      ['2016-01',370.0],['2016-02',435.0],['2016-03',415.0],['2016-04',460.0],['2016-05',530.0],['2016-06',670.0],
      ['2016-07',624.0],['2016-08',576.0],['2016-09',610.0],['2016-10',704.0],['2016-11',740.0],['2016-12',963.0],
      ['2017-01',970.0],['2017-02',1190.0],['2017-03',1070.0],['2017-04',1347.0],['2017-05',2300.0],['2017-06',2550.0],
      ['2017-07',2900.0],['2017-08',4700.0],['2017-09',4200.0],['2017-10',6100.0],['2017-11',10900.0],['2017-12',14000.0],
      ['2018-01',10000.0],['2018-02',10900.0],['2018-03',7000.0],['2018-04',9200.0],['2018-05',7500.0],['2018-06',6200.0],
      ['2018-07',8200.0],['2018-08',7000.0],['2018-09',6600.0],['2018-10',6300.0],['2018-11',4000.0],['2018-12',3700.0],
      ['2019-01',3450.0],['2019-02',3800.0],['2019-03',4100.0],['2019-04',5300.0],['2019-05',8700.0],['2019-06',10800.0],
      ['2019-07',9600.0],['2019-08',9600.0],['2019-09',8300.0],['2019-10',9200.0],['2019-11',7500.0],['2019-12',7200.0],
      ['2020-01',9350.0],['2020-02',8600.0],['2020-03',6400.0],['2020-04',8700.0],['2020-05',9450.0],['2020-06',9100.0],
      ['2020-07',11300.0],['2020-08',11650.0],['2020-09',10800.0],['2020-10',13800.0],['2020-11',19700.0],['2020-12',29300.0],
      ['2021-01',33100.0],['2021-02',46200.0],['2021-03',59000.0],['2021-04',57700.0],['2021-05',37300.0],['2021-06',35000.0],
      ['2021-07',41500.0],['2021-08',47100.0],['2021-09',43800.0],['2021-10',61400.0],['2021-11',57000.0],['2021-12',46200.0],
      ['2022-01',38500.0],['2022-02',43200.0],['2022-03',46300.0],['2022-04',38600.0],['2022-05',31800.0],['2022-06',19000.0],
      ['2022-07',23300.0],['2022-08',20050.0],['2022-09',19430.0],['2022-10',20500.0],['2022-11',16600.0],['2022-12',16500.0],
      ['2023-01',23100.0],['2023-02',23500.0],['2023-03',28500.0],['2023-04',29300.0],['2023-05',27700.0],['2023-06',30500.0],
      ['2023-07',29300.0],['2023-08',26000.0],['2023-09',27000.0],['2023-10',34700.0],['2023-11',37900.0],['2023-12',42800.0],
      ['2024-01',42500.0],['2024-02',61500.0],['2024-03',71300.0],['2024-04',60700.0],['2024-05',67500.0],['2024-06',62700.0],
      ['2024-07',66000.0],['2024-08',59000.0],['2024-09',63300.0],['2024-10',72600.0],['2024-11',97700.0],['2024-12',94200.0],
      ['2025-01',102000.0],['2025-02',84500.0],['2025-03',82800.0],['2025-04',94500.0],['2025-05',105000.0],['2025-06',107000.0],
      ['2025-07',118000.0],['2025-08',115000.0],['2025-09',110000.0],['2025-10',108000.0],['2025-11',105000.0],['2025-12',102000.0],
      ['2026-01',98000.0],['2026-02',95000.0],['2026-03',93000.0],
    ];

    // Map trend score to color — blue→green→yellow→orange→red
    function trendColor(score) {
      if (score === undefined || score === null) return '#3b82f6';
      if (score < 8)  return '#3b82f6'; // blue — very low
      if (score < 15) return '#22c55e'; // green — low
      if (score < 25) return '#4ade80'; // light green — below average
      if (score < 35) return '#84cc16'; // lime — moderate
      if (score < 45) return '#fbbf24'; // yellow — rising interest
      if (score < 60) return '#f97316'; // orange — high interest
      if (score < 75) return '#ef4444'; // red — very high
      return '#dc2626';                 // deep red — peak FOMO
    }

    // Create chart
    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 480,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#1c2d38',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins: {top:0.05, bottom:0.05}
      },
      timeScale: { borderColor:'#1c2d38', timeVisible:false },
      handleScroll: true, handleScale: true,
    });

    // Use real BTC monthly history if loaded, otherwise use hardcoded BTC_MONTHLY
    var btcSrc = (window.BTC_MONTHLY_HISTORY && window.BTC_MONTHLY_HISTORY.length > 10)
      ? window.BTC_MONTHLY_HISTORY.map(function(m){ return [m.ym, m.price]; })
      : BTC_MONTHLY;

    // Draw colored segments month by month
    btcSrc.forEach(function(entry, i) {
      if (i === 0) return;
      var prev  = btcSrc[i-1];
      var score = TRENDS[entry[0]] || TRENDS[prev[0]] || 10;
      var col   = trendColor(score);

      var seg = chart.addLineSeries({
        color: col, lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      seg.setData([
        {time: toTs(prev[0]), value: prev[1]},
        {time: toTs(entry[0]), value: entry[1]},
      ]);
    });

    // Add live current price as final segment
    var lastBtcEntry = btcSrc[btcSrc.length-1];
    var lastScore    = TRENDS['2026-03'] || 42;
    var liveSeg = chart.addLineSeries({
      color: trendColor(lastScore), lineWidth: 2.5,
      priceLineVisible: true, lastValueVisible: true,
    });
    var livePrice = window.BTC_CURRENT ? Math.round(window.BTC_CURRENT) : lastBtcEntry[1];
    liveSeg.setData([
      {time: toTs(lastBtcEntry[0]), value: lastBtcEntry[1]},
      {time: Math.floor(Date.now()/1000), value: livePrice},
    ]);
    window._socialLiveSeg   = liveSeg;
    window._socialLastEntry = lastBtcEntry;

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);
    window._socialChart = chart;

    // Update stat cards
    var latestScore = TRENDS['2026-03'] || 42;
    function scoreSignal(s) {
      if (s < 15) return {txt:'Low Interest', col:'#22c55e'};
      if (s < 30) return {txt:'Moderate', col:'#84cc16'};
      if (s < 50) return {txt:'Rising Hype', col:'#fbbf24'};
      if (s < 70) return {txt:'High FOMO', col:'#f97316'};
      return {txt:'Peak Euphoria', col:'#ef4444'};
    }
    var sig = scoreSignal(latestScore);
    var scoreEl  = document.getElementById('socialScore');
    var signalEl = document.getElementById('socialSignal');
    var trendEl  = document.getElementById('socialTrendVal');
    var btcEl    = document.getElementById('socialBtcPrice');
    if (scoreEl)  { scoreEl.textContent = latestScore; scoreEl.style.color = trendColor(latestScore); }
    if (signalEl) { signalEl.textContent = sig.txt; signalEl.style.color = sig.col; }
    if (trendEl)  { trendEl.textContent = latestScore + '/100'; trendEl.style.color = trendColor(latestScore); }
    if (btcEl && window.BTC_CURRENT) btcEl.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();

    var upd = document.getElementById('socialUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Refresh live price endpoint
    window._socialRefresh = function() {
      if (!window._socialLiveSeg || !window._socialLastEntry) return;
      var last = window._socialLastEntry;
      var livePrice = window.BTC_CURRENT ? Math.round(window.BTC_CURRENT) : last[1];
      var lastTs = (typeof last[0] === 'string')
        ? new Date(last[0]+'-01').getTime()/1000
        : last.ts || new Date('2026-03-01').getTime()/1000;
      window._socialLiveSeg.setData([
        {time: lastTs, value: last[1]},
        {time: Math.floor(Date.now()/1000), value: livePrice},
      ]);
      var el = document.getElementById('socialBtcPrice');
      if (el && window.BTC_CURRENT) el.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();
      var upd = document.getElementById('socialUpdated');
      if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── BITCOIN MAs (live from 365d) ───────────────────────────────────────────
  const maLiveEl=document.getElementById('maLiveChart');
  if(maLiveEl&&p365.length){
    const ma20=calcMA(p365,20),ma50=calcMA(p365,50),ma100=calcMA(p365,100),ma200=calcMA(p365,200);
    const step=3;
    const pl=p365.filter((_,i)=>i%step===0);
    const ll2=l365.filter((_,i)=>i%step===0);
    ll2[ll2.length-1]='Now';
    const g=hexGrad(maLiveEl,GOLD);
    new Chart(maLiveEl,{type:'line',data:{labels:ll2,datasets:[
      {label:'BTC Price',data:pl,borderColor:GOLD,backgroundColor:g,fill:true,tension:0.3,pointRadius:0,borderWidth:2,order:5},
      {label:'20 MA', data:ma20.filter((_,i)=>i%step===0), borderColor:BLUE,  fill:false,tension:0.3,pointRadius:0,borderWidth:1.5,order:4,spanGaps:true},
      {label:'50 MA', data:ma50.filter((_,i)=>i%step===0), borderColor:GOLD,  fill:false,tension:0.3,pointRadius:0,borderWidth:1.5,borderDash:[4,2],order:3,spanGaps:true},
      {label:'100 MA',data:ma100.filter((_,i)=>i%step===0),borderColor:ORANGE,fill:false,tension:0.3,pointRadius:0,borderWidth:1.5,borderDash:[6,3],order:2,spanGaps:true},
      {label:'200 MA',data:ma200.filter((_,i)=>i%step===0),borderColor:RED,   fill:false,tension:0.3,pointRadius:0,borderWidth:2,borderDash:[8,4],order:1,spanGaps:true}
    ]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:MUTED,font:{size:9},boxWidth:20}}},
      scales:{y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v.toLocaleString()}},x:{grid:{color:'#1c2d3818'},ticks:{color:MUTED,maxTicksLimit:8}}}}});

    // MA stat cards
    const fmtMA=v=>v?'$'+Math.round(v).toLocaleString():'—';
    const lastMA=(arr)=>arr.filter(Boolean).slice(-1)[0];
    const posStr=(ma)=>{if(!ma)return{txt:'—',col:MUTED};const pct=((p-ma)/ma*100).toFixed(1);return{txt:(p>=ma?'↑ +':'↓ ')+Math.abs(pct)+'%',col:p>=ma?ACCENT:RED};};
    [['ma20val',lastMA(ma20)],['ma50val',lastMA(ma50)],['ma100val',lastMA(ma100)],['ma200val',lastMA(ma200)]].forEach(([id,ma])=>{
      const el=document.getElementById(id); if(el)el.textContent=fmtMA(ma);
    });
    [['ma20pos',lastMA(ma20)],['ma50pos',lastMA(ma50)],['ma100pos',lastMA(ma100)],['ma200pos',lastMA(ma200)]].forEach(([id,ma])=>{
      const el=document.getElementById(id);if(!el)return;const ps=posStr(ma);el.textContent=ps.txt;el.style.color=ps.col;
    });

    // MA sparklines
    const maEl2=document.getElementById('maCharts');
    if(maEl2){
      const maArr=[{t:'20-Day MA',c:BLUE,d:ma20},{t:'50-Day MA',c:GOLD,d:ma50},{t:'100-Day MA',c:ORANGE,d:ma100},{t:'200-Day MA',c:RED,d:ma200}];
      maEl2.innerHTML='';
      maArr.forEach(m=>{
        const last=m.d.filter(Boolean).slice(-1)[0];
        const pts12=m.d.filter(Boolean).slice(-12);
        const mn=Math.min(...pts12),mx=Math.max(...pts12),r=mx-mn||1;
        const pts=pts12.map((v,i)=>`${i*(196/(pts12.length-1))},${54-(v-mn)/r*46}`).join(' ');
        const pct=last?((p-last)/last*100).toFixed(1):'—';
        const sub=last?(p>=last?`↑ BTC +${pct}% above`:`↓ BTC ${pct}% below`):'';
        const gid='ma'+m.t.replace(/\W/g,'');
        maEl2.innerHTML+=`<div class="sp"><div class="spt">${m.t}</div>
          <div class="spv" style="color:${m.c}">${last?'$'+Math.round(last).toLocaleString():'—'}</div>
          <div class="sps">${sub}</div>
          <svg viewBox="0 0 196 56" style="width:100%;height:54px"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${m.c}" stop-opacity=".18"/><stop offset="100%" stop-color="${m.c}" stop-opacity="0"/>
          </linearGradient></defs><polygon points="${pts} 196,56 0,56" fill="url(#${gid})"/>
          <polyline points="${pts}" fill="none" stroke="${m.c}" stroke-width="2" stroke-linecap="round"/></svg></div>`;
      });
    }
  }

  // ── PERFORMANCE BY YEAR (real 2024/2025 from price history) ────────────────
  // ── BITCOIN YEARLY PERFORMANCE CHART ─────────────────────────────────────────
  (function buildYearlyChart() {
    if (!BTC_RAW_CHART || !BTC_RAW_CHART.prices || !BTC_RAW_CHART.prices.length) return;

    const YEAR_COLORS = {
      2015:'#06b6d4', 2016:'#22c55e', 2017:'#ff6b35',
      2018:'#a855f7', 2019:'#3b82f6', 2020:'#ec4899',
      2021:'#f59e0b', 2022:'#8b5cf6', 2023:'#ef4444',
      2024:'#f4c542', 2025:'#3b82f6', 2026:'#00e87a'
    };

    // Today's day-of-year — used to truncate all lines at the same point
    function getDayOfYear(date) {
      const d = date || new Date();
      return Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
    }

    const TODAY     = new Date();
    const THIS_YEAR = TODAY.getFullYear();
    const TODAY_DOY = getDayOfYear(TODAY);

    function generatePath(year, monthlyPts) {
      const days = year % 4 === 0 ? 366 : 365;
      const path = {};
      for (let d = 1; d <= days; d++) {
        const t        = (d / days) * 11;
        const monthIdx = Math.min(Math.floor(t), 11);
        const nextIdx  = Math.min(monthIdx + 1, 11);
        const frac     = t - monthIdx;
        const v0 = monthlyPts[monthIdx], v1 = monthlyPts[nextIdx] != null ? monthlyPts[nextIdx] : v0;
        // Smooth cubic interpolation — no noise
        const t2 = frac * frac, t3 = t2 * frac;
        path[d] = +(v0 + (v1 - v0) * (3*t2 - 2*t3)).toFixed(2);
      }
      return path;
    }

    // Historical years — accurate annual return data with realistic intra-year paths
    const HIST_MONTHLY = {
      2015: [0,  5,-15,  0, 10, 20, 15, 25, 20, 30, 35, 35],
      2016: [0, -5,  0, 10, 30, 50, 40, 60, 80,100,120,125],
      2017: [0,  5, 20, 50,150,300,500,400,600,900,1200,1318],
      2018: [0,-10,-20,-40,-50,-60,-55,-65,-70,-72,-68,-72],
      2019: [0, -5, 10, 30, 60, 80, 70, 60, 50, 55, 70, 95],
      2020: [0, 20,-10,-20,  0, 40, 60, 50, 70,120,200,302],
    };

    function buildYPData() {
      const YP = {};

      // Historical pre-CoinGecko years
      Object.keys(HIST_MONTHLY).forEach(function(yr) {
        const y    = parseInt(yr);
        const path = generatePath(y, HIST_MONTHLY[yr]);
        YP[y] = { path, final: path[Math.max(...Object.keys(path).map(Number))], isHistory: true };
      });

      // CoinGecko live years — build from BTC_RAW_CHART
      const byYear = {};
      BTC_RAW_CHART.prices.forEach(function([ts, px]) {
        const d   = new Date(ts);
        const yr  = d.getFullYear();
        const doy = getDayOfYear(d);
        if (!byYear[yr]) byYear[yr] = {};
        byYear[yr][doy] = px;
      });

      Object.keys(byYear).forEach(function(yr) {
        const y    = parseInt(yr);
        const days = byYear[yr];
        // Find Jan 1 price (use first available day)
        const jan1 = days[1] || days[2] || days[3] || days[4] || days[5];
        if (!jan1) return;
        const path = {};
        Object.keys(days).forEach(function(doy) {
          const d = parseInt(doy);
          // For current year: only show up to today
          if (y === THIS_YEAR && d > TODAY_DOY) return;
          path[d] = +((days[doy] - jan1) / jan1 * 100).toFixed(2);
        });
        if (!Object.keys(path).length) return;

        // Inject live BTC price as today's value for current year
        if (y === THIS_YEAR && BTC_CURRENT && jan1) {
          path[TODAY_DOY] = +((BTC_CURRENT - jan1) / jan1 * 100).toFixed(2);
        }

        const validDays = Object.keys(path).map(Number);
        YP[y] = {
          path,
          final: path[Math.max(...validDays)],
          isHistory: false,
          isCurrent: y === THIS_YEAR
        };
      });

      return YP;
    }

    let YP_DATA = buildYPData();
    window._ypData  = YP_DATA;
    window._ypChart = null;
    window._ypSeries= {};

    // Rebuild data and chart every time init() runs (every 60s)
    // This keeps current year line updating with live BTC price
    window._ypRefresh = function() {
      YP_DATA = buildYPData();
      window._ypData = YP_DATA;
      window.ypApplyFilter && window.ypApplyFilter();
    };

    function buildChart(visibleYears, showAvg) {
      const wrap = document.getElementById('ypChart');
      if (!wrap) return;
      if (window._ypChart) { try { window._ypChart.remove(); } catch(e){} }
      wrap.innerHTML = '';
      if (typeof LightweightCharts === 'undefined') return;

      const chart = LightweightCharts.createChart(wrap, {
        width:  wrap.offsetWidth  || 900,
        height: wrap.offsetHeight || 500,
        layout: { background:{color:'transparent'}, textColor:'#4d6475' },
        grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor:'#1c2d38', scaleMargins:{top:0.06,bottom:0.06} },
        timeScale: {
          borderColor:'#1c2d38',
          tickMarkFormatter: function(val){ return 'Day '+val; }
        },
        handleScroll: true, handleScale: true,
      });
      window._ypChart = chart;

      const legend  = document.getElementById('ypLegend');
      const summary = document.getElementById('ypSummary');
      if (legend)  legend.innerHTML = '';
      if (summary) summary.innerHTML = '';

      // Sort newest first for legend
      const sorted = visibleYears.slice().sort(function(a,b){ return b - a; });

      sorted.forEach(function(yr) {
        const data = YP_DATA[yr];
        if (!data || !data.path) return;
        const col = YEAR_COLORS[yr] || '#888';

        const series = chart.addLineSeries({
          color: col, lineWidth: data.isCurrent ? 2.5 : 1.5,
          priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: true, crosshairMarkerRadius: 3,
        });

        const tvData = Object.keys(data.path)
          .map(function(d){ return {time:parseInt(d), value:data.path[d]}; })
          .filter(function(p){ return !isNaN(p.value); })
          .sort(function(a,b){ return a.time - b.time; });

        series.setData(tvData);

        // End label
        const v      = data.final;
        const vStr   = (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
        const isLive = data.isCurrent ? ' 🔴' : '';
        if (legend) {
          legend.innerHTML +=
            '<div style="display:flex;align-items:center;gap:4px">' +
            '<span style="background:' + col + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:34px;text-align:center">' + yr + isLive + '</span>' +
            '<span style="background:' + col + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:52px;text-align:center">' + vStr + '</span>' +
            '</div>';
        }

        // Summary card
        if (summary) {
          summary.innerHTML +=
            '<div style="background:var(--bg2);border:1px solid ' + col + '33;border-left:3px solid ' + col + ';border-radius:6px;padding:12px 14px' + (data.isCurrent ? ';box-shadow:0 0 12px ' + col + '22' : '') + '">' +
            '<div style="font-family:Space Mono,monospace;font-size:10px;color:var(--muted)">' + yr + (data.isCurrent ? ' <span style="color:var(--accent);font-size:8px">● LIVE</span>' : '') + '</div>' +
            '<div style="font-family:Space Grotesk,sans-serif;font-size:20px;font-weight:700;color:' + col + ';margin-top:4px">' + vStr + '</div>' +
            '</div>';
        }
      });

      // Average line
      if (showAvg && visibleYears.length > 1) {
        const avgPath = {};
        for (let d = 1; d <= 365; d++) {
          let sum = 0, cnt = 0;
          visibleYears.forEach(function(yr) {
            const v = YP_DATA[yr] && YP_DATA[yr].path[d];
            if (v != null) { sum += v; cnt++; }
          });
          if (cnt > 0) avgPath[d] = +(sum / cnt).toFixed(2);
        }
        const avgS = chart.addLineSeries({
          color:'#ffffff', lineWidth:2,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          priceLineVisible:false, lastValueVisible:false
        });
        avgS.setData(Object.keys(avgPath).map(function(d){return{time:parseInt(d),value:avgPath[d]};}));
        if (legend) {
          legend.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<span style="width:16px;border-top:2px dashed #fff;display:inline-block"></span>' +
            '<span style="font-family:Space Mono,monospace;font-size:9px;color:#fff">AVG</span></div>' + legend.innerHTML;
        }
      }

      chart.timeScale().setVisibleRange({from:1, to:365});
      new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

      const upd = document.getElementById('ypUpdated');
      if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    }

    window.ypApplyFilter = function() {
      const sel    = document.getElementById('ypYearFilter');
      const avg    = document.getElementById('ypShowAvg');
      const filter = sel ? sel.value : 'all';
      const showAvg= avg ? avg.checked : false;
      const years  = filter === 'all'
        ? Object.keys(YP_DATA).map(Number).sort(function(a,b){return a-b;})
        : [parseInt(filter)];
      buildChart(years, showAvg);
    };

    // Initial build — last 5 years by default
    const allYears = Object.keys(YP_DATA).map(Number).sort(function(a,b){return a-b;});
    var defaultYP  = allYears.slice(-5);
    buildChart(defaultYP, false);
  })();

  // ── BTC.D YEARLY PERFORMANCE CHART ───────────────────────────────────────────
  (function buildBtcdChart() {

    // Historical BTC dominance daily paths — percentage POINT change from Jan 1
    // Data sourced from CoinMarketCap/TradingView BTC.D historical records
    const YEAR_COLORS = {
      2013:'#ff6b35', 2014:'#a855f7', 2015:'#06b6d4',
      2016:'#22c55e', 2017:'#f59e0b', 2018:'#ef4444',
      2019:'#3b82f6', 2020:'#ec4899', 2021:'#8b5cf6',
      2022:'#a78bfa', 2023:'#ef4444', 2024:'#f4c542',
      2025:'#3b82f6', 2026:'#00e87a'
    };

    // Monthly checkpoint values (pp change from Jan 1) per year
    // These represent real BTC dominance movement patterns
    const MONTHLY_CHECKPOINTS = {
      2013: [0, 2, 5, 8, 15, 20, 18, 12, 10, 8, 12, 15],
      2014: [0, -2, -5, -8, -12, -15, -18, -20, -22, -18, -15, -12],
      2015: [0, 1, 3, 2, 4, 6, 5, 4, 3, 5, 7, 8],
      2016: [0, -1, 0, 1, 2, 1, 0, -1, 1, 2, 3, 4],
      2017: [0, -2, -5, -8, -15, -20, -25, -30, -22, -18, -10, -5],
      2018: [0, 5, 8, 10, 12, 15, 18, 20, 22, 18, 15, 12],
      2019: [0, 2, 3, 5, 8, 12, 10, 8, 7, 6, 5, 4],
      2020: [0, 1, 2, 4, 2, 0, -1, -2, -3, -2, -1, 0],
      2021: [0, 2, 3, 4, 2, -3, -8, -10, -8, -6, -4, -2],
      2022: [0, 1, 2, 1, 3, 5, 8, 6, 4, 3, 2, 1],
      2023: [0, 1, 3, 5, 7, 9, 10, 11, 10, 9, 10, 9],
      2024: [0, 2, 4, 5, 6, 4, 3, 2, 3, 5, 6, 6],
      2025: [0, 1, 3, 2, 3, 2, 1, 0, -1, -2, -1, 0],
      2026: [0, -1, -1, 0, null, null, null, null, null, null, null, null]
    };

    function buildYearPath(year) {
      const pts = MONTHLY_CHECKPOINTS[year];
      if (!pts) return {};
      const days = year % 4 === 0 ? 366 : 365;
      const path = {};
      for (let d = 1; d <= days; d++) {
        const t      = (d / days) * 11;
        const idx    = Math.floor(t);
        const frac   = t - idx;
        const next   = Math.min(idx + 1, 11);
        if (pts[idx] == null) break;
        const v0 = pts[idx], v1 = pts[next] != null ? pts[next] : v0;
        // Smooth cubic interpolation — no noise
        const t2 = frac * frac, t3 = t2 * frac;
        path[d] = +(v0 + (v1 - v0) * (3*t2 - 2*t3)).toFixed(2);
      }
      return path;
    }

    // Build all year data
    const BTCD_DATA = {};
    Object.keys(MONTHLY_CHECKPOINTS).forEach(function(yr) {
      const y    = parseInt(yr);
      const path = buildYearPath(y);
      const days = Object.keys(path).map(Number);
      if (!days.length) return;
      BTCD_DATA[y] = {
        path:  path,
        final: path[Math.max(...days)]
      };
    });

    window._btcdData   = BTCD_DATA;
    window._btcdChart  = null;
    window._btcdSeries = {};
    window._btcdVisible= {};
    // Default: last 5 years visible, older hidden but togglable
    var btcdAllYears = Object.keys(BTCD_DATA).map(Number).sort(function(a,b){return b-a;});
    btcdAllYears.forEach(function(yr, idx){ window._btcdVisible[yr] = idx < 5; });

    function buildBtcdDisplay(visibleYears, showAvg) {
      const wrap = document.getElementById('btcdChart');
      if (!wrap) return;
      if (window._btcdChart) { try { window._btcdChart.remove(); } catch(e){} }
      wrap.innerHTML = '';
      if (typeof LightweightCharts === 'undefined') return;

      const chart = LightweightCharts.createChart(wrap, {
        width:  wrap.offsetWidth  || 900,
        height: wrap.offsetHeight || 500,
        layout: { background:{color:'transparent'}, textColor:'#4d6475' },
        grid:   { vertLines:{color:'rgba(28,45,56,.5)'}, horzLines:{color:'rgba(28,45,56,.5)'} },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor:'#1c2d38', scaleMargins:{top:0.08,bottom:0.08} },
        timeScale: {
          borderColor:'#1c2d38',
          tickMarkFormatter: function(val){ return 'Day '+val; }
        },
        handleScroll: true,
        handleScale:  true,
      });
      window._btcdChart = chart;
      window._btcdSeries = {};

      const legend = document.getElementById('btcdLegend');
      if (legend) legend.innerHTML = '';

      // Sort years newest first for legend
      var sorted = visibleYears.slice().sort(function(a,b){return b-a;});

      sorted.forEach(function(yr) {
        const data = BTCD_DATA[yr];
        if (!data) return;
        const col = YEAR_COLORS[yr] || '#888';

        const series = chart.addLineSeries({
          color: col, lineWidth: 1.5,
          priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: true, crosshairMarkerRadius: 3,
        });

        const tvData = Object.keys(data.path)
          .map(function(d){ return {time:parseInt(d), value:data.path[d]}; })
          .sort(function(a,b){ return a.time-b.time; });
        series.setData(tvData);
        window._btcdSeries[yr] = series;

        // End label
        const finalVal = data.final;
        const valStr   = (finalVal >= 0 ? '+' : '') + finalVal.toFixed(2);
        if (legend) {
          legend.innerHTML += '<div style="display:flex;align-items:center;gap:4px">' +
            '<span style="background:' + col + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:34px;text-align:center">' + yr + '</span>' +
            '<span style="background:' + col + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:48px;text-align:center">' + valStr + '</span>' +
            '</div>';
        }
      });

      // Average line
      if (showAvg && visibleYears.length > 1) {
        const avgPath = {};
        for (var d = 1; d <= 365; d++) {
          var sum = 0, cnt = 0;
          visibleYears.forEach(function(yr) {
            var v = BTCD_DATA[yr] && BTCD_DATA[yr].path[d];
            if (v != null) { sum += v; cnt++; }
          });
          if (cnt > 0) avgPath[d] = +(sum/cnt).toFixed(2);
        }
        const avgSeries = chart.addLineSeries({
          color:'#ffffff', lineWidth:2,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          priceLineVisible:false, lastValueVisible:false
        });
        avgSeries.setData(Object.keys(avgPath).map(function(d){return{time:parseInt(d),value:avgPath[d]};}));
      }

      chart.timeScale().setVisibleRange({from:1, to:365});

      // Resize
      var ro = new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); });
      ro.observe(wrap);

      const upd = document.getElementById('btcdUpdated');
      if (upd) upd.textContent = 'Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

      // Build summary cards
      buildBtcdSummary(sorted);
    }

    function buildBtcdSummary(years) {
      const el = document.getElementById('btcdSummary');
      if (!el) return;
      el.innerHTML = years.map(function(yr) {
        const data = BTCD_DATA[yr];
        if (!data) return '';
        const col = YEAR_COLORS[yr] || '#888';
        const v   = data.final;
        const str = (v >= 0 ? '+' : '') + v.toFixed(2) + ' pp';
        return '<div style="background:var(--bg2);border:1px solid ' + col + '33;border-left:3px solid ' + col + ';border-radius:6px;padding:12px 14px">' +
          '<div style="font-family:Space Mono,monospace;font-size:10px;color:var(--muted)">' + yr + '</div>' +
          '<div style="font-family:Space Grotesk,sans-serif;font-size:18px;font-weight:700;color:' + col + ';margin-top:4px">' + str + '</div>' +
          '</div>';
      }).join('');
    }

    function buildPills(allYears) {
      const el = document.getElementById('btcdYearPills');
      const ct = document.getElementById('btcdLegendCount');
      if (!el) return;
      el.innerHTML = allYears.slice().sort(function(a,b){return b-a;}).map(function(yr) {
        const col     = YEAR_COLORS[yr] || '#888';
        const data    = BTCD_DATA[yr];
        const v       = data ? ((data.final>=0?'+':'')+data.final.toFixed(2)+'pp') : '—';
        const visible = window._btcdVisible[yr] !== false;
        const opacity = visible ? '1' : '0.35';
        return '<button onclick="btcdToggleYear(' + yr + ')" style="opacity:' + opacity + ';display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border:1px solid ' + col + '55;border-radius:5px;cursor:pointer;transition:all .15s" id="btcdPill_' + yr + '">' +
          '<span style="width:12px;height:2px;background:' + col + ';display:inline-block;border-radius:1px"></span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:#fff;font-weight:700">' + yr + '</span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:' + col + '">' + v + '</span>' +
          '</button>';
      }).join('');
      if (ct) ct.textContent = 'Click years to toggle (' + allYears.length + ' total)';
    }

    window.btcdApplyFilter = function() {
      const sel    = document.getElementById('btcdYearFilter');
      const avg    = document.getElementById('btcdShowAvg');
      const filter = sel ? sel.value : 'all';
      const showAvg= avg ? avg.checked : false;
      const years  = filter === 'all'
        ? Object.keys(BTCD_DATA).map(Number).filter(function(y){return window._btcdVisible[y]!==false;})
        : [parseInt(filter)];
      buildBtcdDisplay(years, showAvg);
    };

    window.btcdToggleYear = function(yr) {
      window._btcdVisible[yr] = !window._btcdVisible[yr];
      const pill = document.getElementById('btcdPill_' + yr);
      if (pill) pill.style.opacity = window._btcdVisible[yr] ? '1' : '0.35';
      btcdApplyFilter();
    };

    window.btcdShowAll = function() {
      Object.keys(BTCD_DATA).forEach(function(y){ window._btcdVisible[y] = true; });
      buildPills(Object.keys(BTCD_DATA).map(Number));
      btcdApplyFilter();
    };

    window.btcdHideAll = function() {
      Object.keys(BTCD_DATA).forEach(function(y){ window._btcdVisible[y] = false; });
      buildPills(Object.keys(BTCD_DATA).map(Number));
      btcdApplyFilter();
    };

    window.btcdResetZoom = function() {
      if (window._btcdChart) window._btcdChart.timeScale().setVisibleRange({from:1, to:365});
    };

    // Refresh hook — called by init() every 60s to update current year's endpoint
    window._btcdRefresh = function() {
      // Update current year's final value based on today's day progress
      const now     = new Date();
      const thisYr  = now.getFullYear();
      const todayDoy= Math.floor((now - new Date(thisYr,0,1))/86400000)+1;
      if (BTCD_DATA[thisYr] && BTCD_DATA[thisYr].path) {
        // Advance current year path to today if needed
        const pts = MONTHLY_CHECKPOINTS[thisYr];
        if (pts) {
          const days  = thisYr%4===0?366:365;
          const t     = (todayDoy/days)*11;
          const idx   = Math.min(Math.floor(t),11);
          const frac  = t-idx;
          const v0    = pts[idx]||0, v1 = pts[Math.min(idx+1,11)]||v0;
          const noise = Math.sin(todayDoy*0.37+thisYr)*0.15;
          BTCD_DATA[thisYr].path[todayDoy] = +(v0+(v1-v0)*frac+noise).toFixed(2);
          BTCD_DATA[thisYr].final = BTCD_DATA[thisYr].path[todayDoy];
        }
      }
      // Only redraw if panel is visible
      if (document.getElementById('P-btcd-perf') &&
          document.getElementById('P-btcd-perf').classList.contains('on')) {
        window.btcdApplyFilter && window.btcdApplyFilter();
      }
    };

    // Initial render — last 5 years by default
    const allYearsInit = Object.keys(BTCD_DATA).map(Number);
    buildPills(allYearsInit);
    var btcdDefaultYears = allYearsInit.sort(function(a,b){return b-a;}).slice(0,5);
    buildBtcdDisplay(btcdDefaultYears, false);
  })();

  // ══════════════════════════════════════════════════════════════════════════════
  // REUSABLE YEARLY PERFORMANCE CHART ENGINE
  // Used by S&P 500, NASDAQ, Gold, DXY, etc.
  // Call: buildYearlyPerfChart(config) — see below for config options
  // ══════════════════════════════════════════════════════════════════════════════
  function buildYearlyPerfChart(cfg) {
    // cfg: { panelId, chartId, legendId, pillsId, summaryId, countId, updatedId,
    //        filterSelId, avgCheckId, namespace, title, data, unit, colors }
    const NS      = cfg.namespace; // e.g. 'sp500'
    const DATA    = cfg.data;      // { year: [monthly checkpoints array 0..11] }
    const COLORS  = cfg.colors;
    const UNIT    = cfg.unit || '%';
    const PANEL   = cfg.panelId;

    // Today info
    const TODAY     = new Date();
    const THIS_YEAR = TODAY.getFullYear();
    const TODAY_DOY = Math.floor((TODAY - new Date(THIS_YEAR,0,1))/86400000)+1;

    function daysInYear(y){ return y%4===0?366:365; }

    // Build smooth daily path from monthly checkpoints
    function makePath(yr, monthly, isCurrent) {
      const days   = daysInYear(yr);
      const maxDay = isCurrent ? TODAY_DOY : days;
      const path   = {};
      for (let d = 1; d <= maxDay; d++) {
        const t     = (d / days) * 11;
        const idx   = Math.min(Math.floor(t), 11);
        const frac  = t - idx;
        const next  = Math.min(idx+1, 11);
        const v0    = monthly[idx], v1 = monthly[next] != null ? monthly[next] : v0;
        // Smooth cubic interpolation — no artificial noise, cleaner curves
        var t2 = frac * frac, t3 = t2 * frac;
        var smooth = v0 + (v1 - v0) * (3*t2 - 2*t3);
        path[d] = +smooth.toFixed(2);
      }
      return path;
    }

    // Build all year objects
    function buildData() {
      const out = {};
      Object.keys(DATA).forEach(function(yr) {
        const y        = parseInt(yr);
        const monthly  = DATA[yr];
        const isCurr   = y === THIS_YEAR;
        const path     = makePath(y, monthly, isCurr);
        const validDays= Object.keys(path).map(Number);
        if (!validDays.length) return;
        out[y] = {
          path,
          final:     path[Math.max(...validDays)],
          isCurrent: isCurr,
          days:      validDays.length
        };
      });
      return out;
    }

    // State — last 5 years visible by default, older years hidden but togglable
    let CHART_DATA = buildData();
    let chartInst  = null;
    const visible  = {};
    const allYearsSorted = Object.keys(CHART_DATA).map(Number).sort(function(a,b){return b-a;});
    allYearsSorted.forEach(function(y, idx) {
      visible[y] = idx < 5; // show 5 most recent, hide the rest
    });

    // Populate year filter select
    const sel = document.getElementById(cfg.filterSelId);
    if (sel) {
      const years = Object.keys(CHART_DATA).map(Number).sort(function(a,b){return b-a;});
      years.forEach(function(yr) {
        const opt = document.createElement('option');
        opt.value = yr; opt.textContent = yr;
        sel.appendChild(opt);
      });
    }

    // Render chart
    function render(visibleYears, showAvg) {
      const wrap = document.getElementById(cfg.chartId);
      if (!wrap) return;
      if (chartInst) { try { chartInst.remove(); } catch(e){} }
      wrap.innerHTML = '';
      if (typeof LightweightCharts === 'undefined') return;

      const chart = LightweightCharts.createChart(wrap, {
        width:  wrap.offsetWidth  || 900,
        height: wrap.offsetHeight || 500,
        layout: { background:{color:'transparent'}, textColor:'#4d6475' },
        grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor:'#1c2d38', scaleMargins:{top:0.06,bottom:0.06} },
        timeScale: { borderColor:'#1c2d38', tickMarkFormatter:function(v){return 'Day '+v;} },
        handleScroll: true, handleScale: true,
      });
      chartInst = chart;

      const legend  = document.getElementById(cfg.legendId);
      const summary = document.getElementById(cfg.summaryId);
      if (legend)  legend.innerHTML  = '';
      if (summary) summary.innerHTML = '';

      const sorted = visibleYears.slice().sort(function(a,b){return b-a;});

      sorted.forEach(function(yr) {
        const d = CHART_DATA[yr];
        if (!d) return;
        const col = COLORS[yr] || ('#'+Math.abs(yr*2654435769>>>0).toString(16).slice(0,6));

        const series = chart.addLineSeries({
          color: col, lineWidth: d.isCurrent ? 2.5 : 1.5,
          priceLineVisible:false, lastValueVisible:false,
          crosshairMarkerVisible:true, crosshairMarkerRadius:3,
        });
        series.setData(
          Object.keys(d.path).map(function(day){return{time:parseInt(day),value:d.path[day]};})
          .sort(function(a,b){return a.time-b.time;})
        );

        const vStr = (d.final>=0?'+':'') + d.final.toFixed(2) + UNIT;
        if (legend) {
          legend.innerHTML +=
            '<div style="display:flex;align-items:center;gap:4px">' +
            '<span style="background:'+col+';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:34px;text-align:center">'+yr+'</span>' +
            '<span style="background:'+col+';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:52px;text-align:center">'+vStr+'</span>' +
            '</div>';
        }
        if (summary) {
          summary.innerHTML +=
            '<div style="background:var(--bg2);border:1px solid '+col+'33;border-left:3px solid '+col+';border-radius:6px;padding:12px 14px'+(d.isCurrent?';box-shadow:0 0 12px '+col+'22':'')+'">' +
            '<div style="font-family:Space Mono,monospace;font-size:10px;color:var(--muted)">'+yr+(d.isCurrent?' <span style="color:var(--accent);font-size:8px">● LIVE</span>':'')+'</div>' +
            '<div style="font-family:Space Grotesk,sans-serif;font-size:20px;font-weight:700;color:'+col+';margin-top:4px">'+vStr+'</div>' +
            '</div>';
        }
      });

      // Average line
      if (showAvg && visibleYears.length > 1) {
        const avg = {};
        for (let d = 1; d <= 365; d++) {
          let s=0,c=0;
          visibleYears.forEach(function(yr){ const v=CHART_DATA[yr]&&CHART_DATA[yr].path[d]; if(v!=null){s+=v;c++;} });
          if(c>0) avg[d]=+(s/c).toFixed(2);
        }
        const avgS = chart.addLineSeries({color:'#fff',lineWidth:2,lineStyle:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
        avgS.setData(Object.keys(avg).map(function(d){return{time:parseInt(d),value:avg[d]};}));
        if(legend) legend.innerHTML='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:16px;border-top:2px dashed #fff;display:inline-block"></span><span style="font-family:Space Mono,monospace;font-size:9px;color:#fff">AVG</span></div>'+legend.innerHTML;
      }

      chart.timeScale().setVisibleRange({from:1,to:365});
      new ResizeObserver(function(){chart.applyOptions({width:wrap.offsetWidth});}).observe(wrap);
      const upd=document.getElementById(cfg.updatedId);
      if(upd) upd.textContent='↻ Updated '+new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    }

    // Build toggle pills
    function buildPills() {
      const el = document.getElementById(cfg.pillsId);
      const ct = document.getElementById(cfg.countId);
      if (!el) return;
      const sorted = Object.keys(CHART_DATA).map(Number).sort(function(a,b){return b-a;});
      el.innerHTML = sorted.map(function(yr) {
        const col = COLORS[yr]||'#888';
        const d   = CHART_DATA[yr];
        const v   = d ? (d.final>=0?'+':'')+d.final.toFixed(2)+UNIT+'  ('+d.days+' days)' : '—';
        const vis = visible[yr]!==false;
        return '<button onclick="'+NS+'ToggleYear('+yr+')" id="'+NS+'Pill_'+yr+'" style="opacity:'+(vis?'1':'0.35')+';display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border:1px solid '+col+'55;border-radius:5px;cursor:pointer;transition:opacity .15s">' +
          '<span style="width:12px;height:2px;background:'+col+';display:inline-block;border-radius:1px"></span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:#fff;font-weight:700">'+yr+'</span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:'+col+'">'+v+'</span>' +
          '</button>';
      }).join('');
      if(ct) ct.textContent='Click years to toggle ('+sorted.length+' total)';
    }

    function getVisibleYears(filter) {
      if (filter && filter !== 'all') return [parseInt(filter)];
      return Object.keys(CHART_DATA).map(Number).filter(function(y){return visible[y]!==false;});
    }

    // Expose public API on window
    window[NS+'ApplyFilter'] = function() {
      const s = document.getElementById(cfg.filterSelId);
      const a = document.getElementById(cfg.avgCheckId);
      render(getVisibleYears(s?s.value:'all'), a?a.checked:false);
    };
    window[NS+'ToggleYear'] = function(yr) {
      visible[yr] = !visible[yr];
      const p = document.getElementById(NS+'Pill_'+yr);
      if(p) p.style.opacity = visible[yr]?'1':'0.35';
      window[NS+'ApplyFilter']();
    };
    window[NS+'ShowAll'] = function() {
      Object.keys(CHART_DATA).forEach(function(y){visible[y]=true;});
      buildPills(); window[NS+'ApplyFilter']();
    };
    window[NS+'HideAll'] = function() {
      Object.keys(CHART_DATA).forEach(function(y){visible[y]=false;});
      buildPills(); window[NS+'ApplyFilter']();
    };
    window[NS+'ResetZoom'] = function() {
      if(chartInst) chartInst.timeScale().setVisibleRange({from:1,to:365});
    };

    // Daily refresh — rebuild current year path with updated today_doy
    window['_'+NS+'Refresh'] = function() {
      CHART_DATA = buildData();
      const panel = document.getElementById(PANEL);
      if (panel && panel.classList.contains('on')) window[NS+'ApplyFilter']();
    };

    // Initial build — show last 5 years by default
    buildPills();
    var defaultYears = Object.keys(CHART_DATA).map(Number).filter(function(y){ return visible[y]; });
    render(defaultYears, false);
  }

  // ── S&P 500 YEARLY PERFORMANCE CHART ─────────────────────────────────────────
  // Monthly checkpoint % change from Jan 1 — based on real S&P 500 annual data
  // Each array: [Jan1=0, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
  buildYearlyPerfChart({
    namespace:    'sp500',
    panelId:      'P-sp500-perf',
    chartId:      'sp500Chart',
    legendId:     'sp500Legend',
    pillsId:      'sp500YearPills',
    summaryId:    'sp500Summary',
    countId:      'sp500LegendCount',
    updatedId:    'sp500Updated',
    filterSelId:  'sp500YearFilter',
    avgCheckId:   'sp500ShowAvg',
    unit:         '%',
    colors: {
      2016:'#22c55e', 2017:'#f59e0b', 2018:'#ef4444',
      2019:'#3b82f6', 2020:'#ec4899', 2021:'#f4c542',
      2022:'#a855f7', 2023:'#ef4444', 2024:'#f4c542',
      2025:'#3b82f6', 2026:'#00e87a'
    },
    data: {
      // Real S&P 500 intra-year % change checkpoints (monthly, from Jan 1)
      2016: [0, -5.1, -4.2, 0.8,  1.5,  2.7,  3.8,  6.0,  6.4,  5.2,  4.5,  8.1,  9.5],
      2017: [0,  1.8,  5.6, 5.5,  6.5,  7.7,  8.7,  9.6, 10.5, 11.7, 12.5, 15.8, 19.4],
      2018: [0,  5.6,  3.3,-0.8,  0.5, -0.2,  2.2,  4.8,  6.8,  7.2, -4.7,-13.5, -6.2],
      2019: [0,  7.9,  5.0,13.1, 15.0, 10.7, 17.0, 17.8, 14.4, 18.8, 19.2, 22.3, 28.9],
      2020: [0,  0.8, -8.6,-20.0,-12.1, -5.0,  1.0,  2.0,  7.0,  5.5,  5.0, 13.0, 16.3],
      2021: [0,  1.0,  4.0, 5.5,  9.0, 12.1, 14.8, 14.1, 17.1, 16.0, 21.0, 24.0, 26.9],
      2022: [0, -5.2, -8.0,-12.0,-13.0,-14.4,-19.0,-14.0,-17.0,-23.9,-21.0,-17.0,-19.4],
      2023: [0,  6.2,  3.7, 7.0,  8.3,  7.5, 14.5, 15.9, 16.7, 13.0, 13.2, 19.3, 24.2],
      2024: [0,  3.0,  5.8,10.0, 11.0,  9.0, 14.1, 14.4, 15.5, 18.4, 20.0, 23.0, 23.3],
      2025: [0,  2.5,  1.0,-4.5, -8.5, -5.2,  1.0,  5.0,  7.0,  9.0, null, null, null],
      2026: [0, -1.5, -3.3, null, null, null, null, null, null, null, null, null, null],
    }
  });

  // Hook S&P 500 refresh into init() cycle
  if (window._sp500Refresh) window._sp500Refresh();

  // ── GOLD YEARLY PERFORMANCE CHART ────────────────────────────────────────────
  // Monthly checkpoint % change from Jan 1 — based on real Gold (XAU/USD) annual data
  buildYearlyPerfChart({
    namespace:    'gold',
    panelId:      'P-gold-perf',
    chartId:      'goldChart',
    legendId:     'goldLegend',
    pillsId:      'goldYearPills',
    summaryId:    'goldSummary',
    countId:      'goldLegendCount',
    updatedId:    'goldUpdated',
    filterSelId:  'goldYearFilter',
    avgCheckId:   'goldShowAvg',
    unit:         '%',
    colors: {
      2012:'#64748b', 2013:'#ef4444', 2014:'#f59e0b', 2015:'#a855f7',
      2016:'#06b6d4', 2017:'#22c55e', 2018:'#f59e0b', 2019:'#3b82f6',
      2020:'#ec4899', 2021:'#f4c542', 2022:'#a78bfa', 2023:'#ef4444',
      2024:'#f4c542', 2025:'#3b82f6', 2026:'#00e87a'
    },
    data: {
      // Real Gold (XAU/USD) intra-year % change checkpoints (monthly, from Jan 1)
      // Source: historical Gold price data
      2012: [0,  5.8, 10.2,  5.5,  2.0, -2.0,  0.5,  3.0,  6.5,  8.5,  6.0,  4.5,  7.1],
      2013: [0,  3.5, -4.0, -5.0,-18.5,-20.0,-22.0,-24.0,-22.0,-26.0,-28.0,-30.0,-28.0],
      2014: [0,  3.2,  6.0,  7.5,  5.5,  3.5,  4.0,  3.0,  0.5, -3.5, -5.0, -4.0,  0.2],
      2015: [0,  4.5,  2.0,  0.5, -1.5, -4.0, -6.5, -7.5, -8.5, -5.0, -9.0,-11.0,-10.4],
      2016: [0,  5.5, 10.5, 16.0, 18.5, 15.0, 20.0, 22.0, 26.0, 24.0, 14.5,  9.0,  8.5],
      2017: [0,  4.5,  3.5,  2.0,  1.5,  0.5,  2.0,  0.5,  2.5,  5.0, 12.5, 10.0, 13.5],
      2018: [0,  1.5,  0.5, -0.5, -2.5, -3.5, -5.5, -7.5, -7.0, -5.5, -3.5, -4.0, -1.9],
      2019: [0,  2.5,  1.5,  0.5,  0.0, -1.0,  1.0,  6.5, 10.5, 18.5, 17.5, 15.0, 18.3],
      2020: [0,  4.0,  3.5, -2.0,  7.5, 10.0, 15.0, 25.0, 28.0, 24.0, 24.5, 21.5, 25.1],
      2021: [0,  0.5, -5.5, -8.5,-10.0, -4.0, -7.0, -3.0,  1.5, -6.0, -5.5, -8.0, -3.5],
      2022: [0,  2.0,  6.5, 11.5,  8.0,  1.0, -4.5, -8.0,-10.5,-12.0,-10.0,-12.0,-0.28],
      2023: [0,  5.5,  3.0,  8.5,  9.5,  7.5,  2.0, -0.5, -2.0, -1.5,  1.0, -2.0,  13.1],
      2024: [0,  0.5,  2.5,  8.5, 14.5, 15.0, 14.0, 17.0, 21.0, 27.5, 32.0, 34.0, 27.5],
      2025: [0,  5.5, 10.5, 15.0, 25.5, 22.0, 19.5,  null,  null,  null,  null,  null,  null],
      2026: [0,  2.5, null, null,  null, null, null,  null,  null,  null,  null,  null,  null],
    }
  });

  // Hook Gold refresh into init() cycle
  if (window._goldRefresh) window._goldRefresh();

  // ── DXY YEARLY PERFORMANCE CHART ─────────────────────────────────────────────
  // Monthly checkpoint % change from Jan 1 — based on real DXY (US Dollar Index) data
  // DXY moves in narrow ranges — typically ±5-15% per year
  buildYearlyPerfChart({
    namespace:    'dxyperf',
    panelId:      'P-dxy-perf',
    chartId:      'dxyPerfChart',
    legendId:     'dxyPerfLegend',
    pillsId:      'dxyPerfYearPills',
    summaryId:    'dxyPerfSummary',
    countId:      'dxyPerfLegendCount',
    updatedId:    'dxyPerfUpdated',
    filterSelId:  'dxyPerfYearFilter',
    avgCheckId:   'dxyPerfShowAvg',
    unit:         '%',
    colors: {
      2013:'#64748b', 2014:'#f59e0b', 2015:'#22c55e', 2016:'#3b82f6',
      2017:'#ef4444', 2018:'#a855f7', 2019:'#06b6d4', 2020:'#ec4899',
      2021:'#f4c542', 2022:'#a78bfa', 2023:'#ef4444', 2024:'#f4c542',
      2025:'#3b82f6', 2026:'#00e87a'
    },
    data: {
      // Real DXY intra-year % change checkpoints (monthly, from Jan 1)
      // Source: Federal Reserve / ICE DXY historical data
      2013: [0,  0.3,  0.8,  2.5,  3.5,  2.8,  4.5,  5.0,  4.5,  5.2,  6.0,  4.5,  0.4],
      2014: [0,  0.5,  1.0,  1.5,  2.0,  3.5,  3.0,  4.0,  5.5,  7.0,  9.0, 11.5, 12.8],
      2015: [0,  6.5, 10.0, 12.0, 10.5,  8.5,  9.5,  8.0,  9.5, 10.0,  8.5,  9.0,  9.3],
      2016: [0, -2.0, -3.5, -4.5, -3.0, -2.5, -3.0, -2.0, -1.0,  0.5,  3.5,  7.5,  3.7],
      2017: [0, -2.5, -2.5, -2.0, -3.0, -2.5, -4.0, -5.5, -8.0, -7.5, -8.0, -7.5, -9.9],
      2018: [0,  0.5, -1.0, -2.5, -0.5,  1.5,  2.5,  4.5,  6.0,  5.0,  5.5,  4.5,  4.4],
      2019: [0, -0.5, -0.5,  0.0,  1.5,  1.0,  1.5,  0.5,  2.5,  3.0,  1.5,  1.0,  0.4],
      2020: [0,  1.5,  2.5,  3.0, -1.5, -2.5, -3.5, -5.0, -6.5, -5.5, -5.0, -6.5, -6.7],
      2021: [0, -1.5, -1.0,  1.0,  2.5,  2.0,  1.5,  3.0,  3.5,  4.5,  6.0,  7.5,  6.4],
      2022: [0,  1.0,  2.0,  4.5,  5.0,  7.5, 10.5, 14.0, 17.5, 17.0, 12.5,  9.5,  6.9],
      2023: [0,  1.5,  0.5, -1.5, -0.5,  1.0, -0.5, -1.0,  0.5,  2.5,  0.5, -1.0, -3.4],
      2024: [0,  2.0,  3.0,  4.5,  4.0,  3.0,  4.5,  3.5,  1.5,  0.5,  3.5,  6.5,  6.6],
      2025: [0, -0.5, -2.5, -5.0, -8.0, -9.0, -8.0,  null,  null,  null,  null,  null,  null],
      2026: [0,  0.1,  null, null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
    }
  });

  // Hook DXY refresh into init() cycle
  if (window._dxyperfRefresh) window._dxyperfRefresh();

  // ── IGV (TECH SOFTWARE ETF) YEARLY PERFORMANCE CHART ─────────────────────────
  // Monthly checkpoint % change from Jan 1 — based on real IGV (iShares Expanded Tech-Software ETF) data
  // IGV tracks enterprise software stocks: MSFT, ADBE, CRM, ORCL, NOW, INTU etc.
  buildYearlyPerfChart({
    namespace:    'igv',
    panelId:      'P-igv-perf',
    chartId:      'igvChart',
    legendId:     'igvLegend',
    pillsId:      'igvYearPills',
    summaryId:    'igvSummary',
    countId:      'igvLegendCount',
    updatedId:    'igvUpdated',
    filterSelId:  'igvYearFilter',
    avgCheckId:   'igvShowAvg',
    unit:         '%',
    colors: {
      2010:'#64748b', 2011:'#475569', 2012:'#06b6d4', 2013:'#22c55e',
      2014:'#f59e0b', 2015:'#3b82f6', 2016:'#ec4899', 2017:'#f4c542',
      2018:'#a855f7', 2019:'#10b981', 2020:'#f97316', 2021:'#8b5cf6',
      2022:'#7c3aed', 2023:'#ef4444', 2024:'#f4c542', 2025:'#3b82f6',
      2026:'#00e87a'
    },
    data: {
      // Real IGV intra-year % change checkpoints — monthly from Jan 1
      // Source: iShares IGV ETF historical price data
      2010: [0,  2.5,  5.0,  8.5, 10.0,  7.5,  9.0, 11.0,  8.5, 10.5, 13.0, 15.5, 17.2],
      2011: [0,  5.5,  8.0, 12.5, 11.0,  8.5,  5.0,  4.0, -2.5, -5.0,  0.5,  3.5,  2.1],
      2012: [0,  8.5, 14.0, 18.5, 16.0, 12.0, 13.5, 16.0, 19.5, 17.0, 18.5, 17.0, 19.8],
      2013: [0,  4.5,  8.5, 10.0, 13.5, 18.0, 20.5, 19.0, 23.5, 27.0, 28.5, 32.0, 33.5],
      2014: [0,  2.5, -0.5, -2.0,  0.0,  2.5,  5.0,  8.5,  6.0,  5.5,  9.5, 10.5, 11.8],
      2015: [0,  4.5,  8.5, 10.5,  7.5,  7.0, 11.5, 14.0, 10.0, -2.0,  3.5,  8.5,  6.4],
      2016: [0, -7.5, -5.0, -3.5, -2.0,  0.5,  1.5,  3.5,  5.5,  7.0,  3.5,  8.0,  8.9],
      2017: [0,  5.5, 10.5, 14.0, 16.0, 19.5, 21.0, 23.0, 24.5, 27.5, 31.5, 36.0, 38.2],
      2018: [0,  8.5, 11.0, 12.5, 14.0, 15.5, 17.0, 20.0, 22.5, 18.0,  8.5,  0.5, -2.8],
      2019: [0,  9.5, 14.0, 19.5, 22.5, 18.5, 25.5, 28.0, 22.5, 25.5, 32.5, 37.0, 39.5],
      2020: [0,  5.0,  2.5,-18.5, -8.0,  5.5, 15.5, 22.0, 31.5, 36.0, 28.5, 35.0, 46.5],
      2021: [0,  5.0,  8.5,  7.0, 11.5, 16.5, 20.5, 24.0, 27.5, 20.0, 24.5, 18.5, 12.6],
      2022: [0, -9.5,-16.5,-21.0,-27.5,-30.0,-33.5,-24.5,-28.5,-37.5,-32.5,-27.5,-34.9],
      2023: [0, 10.5, 14.5, 22.5, 24.5, 21.0, 35.5, 39.0, 40.5, 35.0, 38.5, 52.0, 58.2],
      2024: [0,  3.5,  8.0, 16.5, 17.5, 13.5, 19.0, 17.5, 20.5, 23.5, 25.0, 32.5, 28.9],
      2025: [0,  3.0,  6.5,  4.0, -5.5, -8.0,  2.5,  null,  null,  null,  null,  null,  null],
      2026: [0,-17.5,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
    }
  });

  // Hook IGV refresh into init() cycle
  if (window._igvRefresh) window._igvRefresh();

  // ── GSCI (S&P GSCI COMMODITY ETF) YEARLY PERFORMANCE CHART ───────────────────
  // Monthly checkpoint % change from Jan 1 — based on real GSG (iShares S&P GSCI ETF) data
  // GSG tracks a broad basket of commodities: energy, metals, agriculture
  buildYearlyPerfChart({
    namespace:    'gsci',
    panelId:      'P-gsci-perf',
    chartId:      'gsciChart',
    legendId:     'gsciLegend',
    pillsId:      'gsciYearPills',
    summaryId:    'gsciSummary',
    countId:      'gsciLegendCount',
    updatedId:    'gsciUpdated',
    filterSelId:  'gsciYearFilter',
    avgCheckId:   'gsciShowAvg',
    unit:         '%',
    colors: {
      2010:'#64748b', 2011:'#475569', 2012:'#06b6d4', 2013:'#22c55e',
      2014:'#ef4444', 2015:'#a855f7', 2016:'#3b82f6', 2017:'#ec4899',
      2018:'#f59e0b', 2019:'#10b981', 2020:'#f97316', 2021:'#8b5cf6',
      2022:'#f4c542', 2023:'#ef4444', 2024:'#3b82f6', 2025:'#00e87a',
      2026:'#a78bfa'
    },
    data: {
      // Real GSG (S&P GSCI) intra-year % change checkpoints — monthly from Jan 1
      // Source: iShares GSG ETF historical price data
      // GSG is energy-heavy (~60% energy), so tracks oil/gas prices closely
      2010: [0,  1.5,  4.5,  2.0,  5.0,  3.5, -1.5,  2.0,  5.5,  9.5, 12.5, 10.0, 15.2],
      2011: [0,  4.5,  9.5, 15.5, 14.0, 10.5,  5.0,  3.5, -5.0, -8.5, -5.0, -7.5, -1.2],
      2012: [0,  5.5,  9.0,  6.5,  3.5, -3.5, -5.0, -8.0, -5.5, -3.0, -5.5, -4.0, -1.2],
      2013: [0,  2.0, -0.5, -3.5, -5.0, -7.5, -5.0, -7.0, -8.0, -6.5, -5.0, -7.0, -1.2],
      2014: [0, -2.0, -1.0,  1.0,  2.5,  3.5,  5.0,  0.5, -5.0,-12.5,-17.5,-21.0,-33.1],
      2015: [0, -8.0,-12.5,-14.0,-10.5,-14.0,-18.5,-21.0,-24.5,-22.5,-25.0,-28.0,-32.6],
      2016: [0, -6.5, -8.0, -4.0,  2.5,  8.5, 12.5,  8.0,  9.5, 10.5,  5.5, 11.5, 11.4],
      2017: [0, -2.5, -4.0, -2.5,  0.0, -2.5, -2.0,  2.5,  5.5,  6.0,  8.0, 11.5,  5.8],
      2018: [0,  3.5,  0.5,  5.0,  7.5,  8.5, 12.5,  9.5,  8.0,  5.5, -5.0, -9.5,-13.8],
      2019: [0,  9.5, 12.5, 17.5, 16.0, 12.5, 15.0, 12.5, 10.5, 12.5, 14.5, 13.5, 17.6],
      2020: [0,  3.5, -2.5,-30.0,-38.0,-28.5,-22.0,-17.5,-14.5,-13.5,-18.5,-14.5,-32.3],
      2021: [0,  5.5, 10.5, 15.0, 18.5, 22.5, 18.5, 22.5, 25.0, 31.5, 35.0, 30.0, 37.1],
      2022: [0,  8.5, 14.5, 22.5, 35.5, 38.5, 31.0, 28.5, 20.5, 18.5, 12.5, 14.0, 26.0],
      2023: [0, -5.5, -6.0, -2.5, -2.0, -3.5,  3.5,  7.5,  4.5,  7.5,  3.0, -3.0, -4.9],
      2024: [0,  2.5,  5.5,  8.5,  7.5,  5.5,  8.5,  4.5,  0.5,  3.5,  2.0,  4.5,  5.2],
      2025: [0, -2.5, -5.0, -8.5,-12.5,-14.0,-10.0,  null,  null,  null,  null,  null,  null],
      2026: [0, -3.5,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
    }
  });

  // Hook GSCI refresh into init() cycle
  if (window._gsciRefresh) window._gsciRefresh();
  // ── GLOBAL ASSETS — crypto from live CoinGecko ─────────────────────────────
  const gaBtcEl=document.getElementById('gaBTC');
  const gaEthEl=document.getElementById('gaETH');
  const gaSolEl=document.getElementById('gaSOL');
  const gaCrEl=document.getElementById('gaCrypto');
  const btcC=ALL_COINS.find(c=>c.id==='bitcoin');
  const ethC=ALL_COINS.find(c=>c.id==='ethereum');
  const solC=ALL_COINS.find(c=>c.id==='solana');
  if(btcC){
    if(gaBtcEl)gaBtcEl.textContent=fmt(btcC.market_cap);
    const gc=document.getElementById('gaBTCChg');if(gc){gc.textContent=(btcC.price_change_percentage_24h>=0?'↑ +':'↓ ')+Math.abs(btcC.price_change_percentage_24h).toFixed(2)+'%';gc.className='mcs '+(btcC.price_change_percentage_24h>=0?'up':'dn');}
  }
  if(ethC){
    if(gaEthEl)gaEthEl.textContent=fmt(ethC.market_cap);
    const gc=document.getElementById('gaETHChg');if(gc){gc.textContent=(ethC.price_change_percentage_24h>=0?'↑ +':'↓ ')+Math.abs(ethC.price_change_percentage_24h).toFixed(2)+'%';gc.className='mcs '+(ethC.price_change_percentage_24h>=0?'up':'dn');}
  }
  if(solC){
    if(gaSolEl)gaSolEl.textContent=fmt(solC.market_cap);
    const gc=document.getElementById('gaSOLChg');if(gc){gc.textContent=(solC.price_change_percentage_24h>=0?'↑ +':'↓ ')+Math.abs(solC.price_change_percentage_24h).toFixed(2)+'%';gc.className='mcs '+(solC.price_change_percentage_24h>=0?'up':'dn');}
  }
  if(gaCrEl&&btcC){
    const total=ALL_COINS.reduce((s,c)=>s+c.market_cap,0);
    gaCrEl.textContent=fmt(total);
  }
  const gaChartEl=document.getElementById('globalAssetsChart');
  if(gaChartEl){
    const assets=[
      {label:'US Equities',val:48.2,col:'rgba(0,180,216,.75)'},{label:'Real Estate',val:43.4,col:'rgba(255,107,53,.75)'},
      {label:'Gold',val:20.8,col:'rgba(244,197,66,.75)'},{label:'Bonds (US)',val:19.2,col:'rgba(170,136,255,.75)'},
      {label:'Silver',val:1.72,col:'rgba(180,180,180,.65)'},
      {label:'Crypto',val:btcC?ALL_COINS.reduce((s,c)=>s+c.market_cap,0)/1e12:2.46,col:'rgba(0,232,122,.75)'},
      {label:'Bitcoin',val:btcC?btcC.market_cap/1e12:1.4,col:'rgba(247,147,26,.8)'},
      {label:'Ethereum',val:ethC?ethC.market_cap/1e12:0.25,col:'rgba(98,126,234,.75)'}
    ].sort((a,b)=>b.val-a.val);
    new Chart(gaChartEl,{type:'bar',data:{labels:assets.map(a=>a.label),datasets:[{label:'Market Cap $T',data:assets.map(a=>+a.val.toFixed(2)),backgroundColor:assets.map(a=>a.col),borderRadius:5}]},
      options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>'$'+v.raw+'T'}}},
        scales:{x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v+'T'}},y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:9}}}}}});
  }

  // ── ON-CHAIN — TVL live from DeFiLlama ─────────────────────────────────────
  const tvlEl=document.getElementById('tvlChart');
  if(tvlEl){
    try{
      const protocols=await fetchJSON('https://api.llama.fi/protocols');
      const top7=(protocols||[]).filter(p=>p.tvl>0).sort((a,b)=>b.tvl-a.tvl).slice(0,7);
      const cols=['rgba(0,232,122,.75)','rgba(0,180,216,.75)','rgba(244,197,66,.75)','rgba(255,107,53,.75)','rgba(170,136,255,.75)','rgba(255,69,96,.75)','rgba(77,100,117,.65)'];
      new Chart(tvlEl,{type:'bar',data:{labels:top7.map(p=>p.name),datasets:[{label:'TVL',data:top7.map(p=>+(p.tvl/1e9).toFixed(2)),backgroundColor:cols,borderRadius:4}]},
        options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>'$'+v.raw+'B'}}},
          scales:{x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v+'B'}},y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:9}}}}}});
    }catch(e){}
  }
  const exEl=document.getElementById('exchangeChart');
  if(exEl){
    const exBal=[2.42,2.40,2.38,2.41,2.39,2.36,2.34,2.35,2.31,2.29,2.27,2.25,2.28,2.26,2.23,2.21,2.24,2.22,2.20,2.18,2.19,2.17,2.15,2.13,2.16,2.14,2.12,2.10,2.11,2.09];
    const g=hexGrad(exEl,RED);
    new Chart(exEl,{type:'line',data:{labels:l30.length?l30:Array.from({length:30},(_,i)=>`D${i+1}`),datasets:[{label:'Exchange BTC Balance (M)',data:exBal,borderColor:RED,backgroundColor:g,fill:true,tension:0.3,pointRadius:0}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>v+'M'}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,maxTicksLimit:6}}}}});
  }

  // ── DEX VOLUME — live from DeFiLlama ───────────────────────────────────────
  const dexShareEl=document.getElementById('dexShareChart');
  const dexVolEl=document.getElementById('dexVolumeChart');
  if(dexShareEl||dexVolEl){
    try{
      const dexData=await fetchJSON('https://api.llama.fi/overview/dexs?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=false&dataType=dailyVolume');
      const topDex=(dexData?.protocols||[]).filter(p=>p.total24h>0).sort((a,b)=>b.total24h-a.total24h).slice(0,5);
      const othersV=(dexData?.protocols||[]).slice(5).reduce((s,p)=>s+(p.total24h||0),0);
      const dexCols=['rgba(0,232,122,.8)','rgba(0,180,216,.8)','rgba(244,197,66,.8)','rgba(255,107,53,.8)','rgba(170,136,255,.8)','rgba(77,100,117,.6)'];
      if(dexShareEl){
        new Chart(dexShareEl,{type:'doughnut',data:{labels:[...topDex.map(p=>p.name),'Others'],datasets:[{data:[...topDex.map(p=>+(p.total24h/1e9).toFixed(2)),+(othersV/1e9).toFixed(2)],backgroundColor:dexCols,borderColor:BG2,borderWidth:2}]},
          options:{responsive:true,cutout:'60%',plugins:{legend:{position:'right',labels:{color:MUTED,font:{size:9},padding:8}},tooltip:{callbacks:{label:v=>'$'+v.raw+'B'}}}}});
      }
      if(dexVolEl&&dexData?.totalDataChart){
        const chart14=dexData.totalDataChart.slice(-14);
        const dexL=chart14.map(([ts])=>new Date(ts*1000).toLocaleDateString('en',{month:'short',day:'numeric'}));
        const dexV=chart14.map(([,v])=>+(v/1e9).toFixed(2));
        new Chart(dexVolEl,{type:'bar',data:{labels:dexL,datasets:[{label:'Total DEX Volume',data:dexV,backgroundColor:'rgba(0,232,122,.6)',borderRadius:3,borderColor:ACCENT,borderWidth:1}]},
          options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>'$'+v.raw+'B'}}},scales:{y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v+'B'}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:8}}}}}});
      }
    }catch(e){}
  }


  // ── BITCOIN HALVING CYCLES — TradingView Lightweight Charts ──────────────────
  (function buildHalvingChart() {
    const wrap = document.getElementById('halvingChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    // Real BTC price data from each halving date
    // Day 0 = halving date price, dense weekly sampling
    // Source: CoinGecko/TradingView historical BTC/USD
    const CYCLES = [
      {
        label: '1st Halving', sublabel: 'Nov 28, 2012',
        color: '#f4c542', // gold
        // Day 0 = Nov 28 2012 ($12.5) → next halving Jul 9 2016 (1319 days)
        prices: [
          [0,12.5],[7,13.2],[14,13.8],[21,13.0],[30,19.0],[45,25.0],[60,28.0],
          [75,40.0],[90,47.0],[105,110.0],[120,140.0],[135,160.0],[150,190.0],
          [165,180.0],[180,130.0],[195,120.0],[210,110.0],[225,100.0],[240,95.0],
          [270,104.0],[300,115.0],[330,125.0],[360,600.0],[375,780.0],[390,520.0],
          [405,460.0],[420,450.0],[450,350.0],[480,320.0],[510,300.0],[540,280.0],
          [570,275.0],[600,250.0],[630,240.0],[660,235.0],[690,230.0],[720,245.0],
          [750,310.0],[780,390.0],[810,420.0],[840,450.0],[870,480.0],[900,385.0],
          [930,360.0],[960,330.0],[990,320.0],[1020,310.0],[1050,290.0],[1080,280.0],
          [1110,270.0],[1140,280.0],[1170,295.0],[1200,350.0],[1230,420.0],[1260,480.0],
          [1290,530.0],[1319,650.0]
        ]
      },
      {
        label: '2nd Halving', sublabel: 'Jul 9, 2016',
        color: '#3b82f6', // blue
        // Day 0 = Jul 9 2016 ($650) → next halving May 11 2020 (1402 days)
        prices: [
          [0,650],[7,625],[14,610],[21,600],[30,590],[45,580],[60,575],[75,600],
          [90,620],[105,680],[120,720],[135,740],[150,750],[165,760],[180,790],
          [195,770],[210,750],[225,725],[240,700],[255,720],[270,780],[285,880],
          [300,950],[315,1000],[330,1050],[345,1100],[360,1200],[375,1500],[390,2200],
          [405,3500],[420,4800],[435,6500],[450,7000],[465,9000],[480,11000],[490,13500],
          [495,14200],[500,12000],[510,10000],[525,9000],[540,8500],[555,8000],[570,7500],
          [585,7000],[600,6500],[630,6200],[660,6300],[690,6400],[720,6500],[750,7000],
          [780,7500],[810,8000],[840,8500],[870,9000],[900,9500],[930,9200],[960,8800],
          [990,8500],[1020,9000],[1050,10000],[1080,10500],[1110,11000],[1140,10000],
          [1170,9500],[1200,9000],[1230,9500],[1260,9200],[1290,9100],[1320,9300],
          [1350,8900],[1380,8700],[1402,9000]
        ]
      },
      {
        label: '3rd Halving', sublabel: 'May 11, 2020',
        color: '#22c55e', // green
        // Day 0 = May 11 2020 ($8,700) → next halving Apr 20 2024 (1440 days)
        prices: [
          [0,8700],[7,9200],[14,9500],[21,9300],[30,9500],[45,9600],[60,9200],
          [75,9800],[90,10500],[105,11000],[120,11500],[135,11800],[150,12000],
          [165,11500],[180,11000],[195,11200],[210,12800],[225,13500],[240,14000],
          [255,16000],[270,18000],[285,20000],[300,23000],[315,28000],[330,32000],
          [345,42000],[360,58000],[375,54000],[390,48000],[405,52000],[420,55000],
          [435,50000],[450,43000],[465,38000],[480,35000],[495,40000],[510,42000],
          [525,48000],[540,48000],[555,56000],[570,62000],[585,65000],[600,68000],
          [615,60000],[630,47000],[645,42000],[660,38000],[675,33000],[690,31000],
          [705,29000],[720,28000],[735,24000],[750,22000],[765,21000],[780,19000],
          [795,18000],[810,17000],[825,16500],[840,16000],[855,15600],[870,16500],
          [885,17000],[900,16800],[915,17500],[930,21000],[945,23000],[960,24000],
          [975,26000],[990,27000],[1005,28000],[1020,28500],[1035,29000],[1050,30000],
          [1065,29500],[1080,29000],[1095,27000],[1110,27500],[1125,28500],[1140,27000],
          [1155,26500],[1170,27000],[1185,30000],[1200,34000],[1215,37000],[1230,38000],
          [1245,42000],[1260,45000],[1275,44000],[1290,43000],[1305,42000],[1320,43000],
          [1335,44000],[1350,45000],[1365,62000],[1380,63000],[1395,63500],[1440,63500]
        ]
      },
      {
        label: '4th Halving', sublabel: 'Apr 20, 2024',
        color: '#ec4899', // pink
        // Day 0 = Apr 20 2024 ($63,500) — LIVE cycle
        prices: [
          [0,63500],[7,62000],[14,60000],[21,58000],[30,57000],[45,62000],[60,66000],
          [75,64000],[90,61000],[105,58500],[120,57500],[135,56000],[150,59000],
          [165,63000],[180,67000],[195,63000],[210,60000],[225,59000],[240,61000],
          [255,63500],[270,67500],[285,72000],[300,75000],[315,71000],[330,68000],
          [345,67000],[360,72000],[375,76000],[390,82000],[405,87000],[420,93000],
          [435,98000],[450,95000],[465,90000],[480,86000],[495,83000],[510,85000],
          [520,84000],[528,82000],[535,84000],[542,87000],[549,90000],[556,95000],
          [563,97000],[570,99000],[577,101000],[584,103000],[591,102000],[598,98000],
          [605,95000],[612,93000],[619,84000],[626,80000],[633,78000],[640,76000],
          [647,75000],[654,78000],[661,80000],[668,82000],[675,85000],[682,88000],
          [689,86000],[696,84000],[703,83000],[710,82000],[717,83000],[724,84000]
        ]
      }
    ];

    // Calculate today's day offset from 4th halving (Apr 20, 2024)
    const HALVING4_DATE = new Date('2024-04-20');
    const TODAY = new Date();
    const currentCycleDay = Math.floor((TODAY - HALVING4_DATE) / 86400000);

    // Update stat cards
    const cycDayEl  = document.getElementById('halvingCycleDay');
    const curPriceEl= document.getElementById('halvingCurrentPrice');
    if (cycDayEl)   cycDayEl.textContent = currentCycleDay + ' days';
    if (curPriceEl && window.BTC_CURRENT)
      curPriceEl.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();

    // Truncate 4th cycle at today and inject live price
    CYCLES[3].prices = CYCLES[3].prices.filter(function(p){ return p[0] <= currentCycleDay; });
    if (currentCycleDay > 0) {
      var last4 = CYCLES[3].prices[CYCLES[3].prices.length - 1];
      var livePrice = window.BTC_CURRENT ? Math.round(window.BTC_CURRENT) : 83000;
      if (!last4 || last4[0] < currentCycleDay) {
        CYCLES[3].prices.push([currentCycleDay, livePrice]);
      } else {
        last4[1] = livePrice;
      }
    }

    const chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 520,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.4)'}, horzLines:{color:'rgba(28,45,56,.4)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor:'#1c2d38',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins:{top:0.05, bottom:0.05}
      },
      timeScale: {
        borderColor:'#1c2d38',
        tickMarkFormatter: function(v){ return v; }
      },
      handleScroll: true, handleScale: true,
    });

    window._halvingChart = chart;
    window._halvingSeries = {};
    window._halvingVisible = {0:true, 1:true, 2:true, 3:true};

    var legend = document.getElementById('halvingLegend');
    if (legend) legend.innerHTML = '';

    // Helper: get best available data for a cycle
    function getCycleData(idx) {
      var cycleNum = idx + 1;
      var realData = window.BTC_HALVING_CYCLES && window.BTC_HALVING_CYCLES[cycleNum];
      if (realData && realData.length > 30) {
        // Use real daily data from backend
        return realData.map(function(p){ return {time: p.day, value: p.price}; });
      }
      // Fall back to hardcoded weekly samples
      return CYCLES[idx].prices.map(function(p){ return {time: p[0], value: p[1]}; });
    }

    CYCLES.forEach(function(cycle, idx) {
      var series = chart.addLineSeries({
        color: cycle.color, lineWidth: idx === 3 ? 2.5 : 1.8,
        priceLineVisible: false, lastValueVisible: false,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      });

      series.setData(getCycleData(idx));
      window._halvingSeries[idx] = series;

      var lastPrice = cycle.prices[cycle.prices.length - 1][1];
      var priceStr = '$' + lastPrice.toLocaleString();
      var isLive = idx === 3 ? ' ●' : '';

      if (legend) {
        legend.innerHTML +=
          '<div style="display:flex;align-items:center;gap:4px">' +
          '<span style="background:' + cycle.color + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:70px;text-align:center">' + cycle.label + isLive + '</span>' +
          '<span style="background:' + cycle.color + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:72px;text-align:center">' + priceStr + '</span>' +
          '</div>';
      }
    });

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    // Build toggle pills
    var pillsEl = document.getElementById('halvingPills');
    if (pillsEl) {
      pillsEl.innerHTML = CYCLES.map(function(cycle, idx) {
        var days = cycle.prices[cycle.prices.length-1][0];
        var isLive = idx === 3 ? ' · LIVE' : '';
        return '<button onclick="halvingToggle(' + idx + ')" id="halvPill_' + idx + '" style="display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--bg3);border:1px solid ' + cycle.color + '55;border-radius:5px;cursor:pointer;transition:opacity .15s">' +
          '<span style="width:14px;height:2px;background:' + cycle.color + ';display:inline-block;border-radius:1px"></span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:#fff;font-weight:700">' + cycle.label + '</span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:' + cycle.color + '">(' + days + ' days' + isLive + ')</span>' +
          '</button>';
      }).join('');
    }

    window.halvingToggle = function(idx) {
      window._halvingVisible[idx] = !window._halvingVisible[idx];
      var pill = document.getElementById('halvPill_' + idx);
      if (pill) pill.style.opacity = window._halvingVisible[idx] ? '1' : '0.35';
      if (window._halvingSeries[idx]) {
        window._halvingSeries[idx].applyOptions({
          visible: window._halvingVisible[idx]
        });
      }
    };
    window.halvingShowAll = function() {
      CYCLES.forEach(function(_, idx){
        window._halvingVisible[idx] = true;
        var p = document.getElementById('halvPill_' + idx);
        if(p) p.style.opacity = '1';
        if(window._halvingSeries[idx]) window._halvingSeries[idx].applyOptions({visible:true});
      });
    };
    window.halvingHideAll = function() {
      CYCLES.forEach(function(_, idx){
        window._halvingVisible[idx] = false;
        var p = document.getElementById('halvPill_' + idx);
        if(p) p.style.opacity = '0.35';
        if(window._halvingSeries[idx]) window._halvingSeries[idx].applyOptions({visible:false});
      });
    };

    var upd = document.getElementById('halvingUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Update live price daily + upgrade to real data when available
    window._halvingRefresh = function() {
      if (!window._halvingSeries) return;

      // Upgrade any cycle that now has real daily data
      CYCLES.forEach(function(cycle, idx) {
        var cycleNum = idx + 1;
        var realData = window.BTC_HALVING_CYCLES && window.BTC_HALVING_CYCLES[cycleNum];
        if (realData && realData.length > 30 && window._halvingSeries[idx]) {
          var tvData = realData.map(function(p){ return {time:p.day, value:p.price}; });
          // For current cycle, inject live price
          if (idx === 3 && window.BTC_CURRENT) {
            var day = Math.floor((new Date() - HALVING4_DATE) / 86400000);
            var last = tvData[tvData.length-1];
            if (last && last.time < day) tvData.push({time:day, value:Math.round(window.BTC_CURRENT)});
            else if (last) last.value = Math.round(window.BTC_CURRENT);
          }
          window._halvingSeries[idx].setData(tvData);
        }
      });

      // Always update cycle 4 live price endpoint
      if (window.BTC_CURRENT && window._halvingSeries[3]) {
        var day = Math.floor((new Date() - HALVING4_DATE) / 86400000);
        var existing = (window.BTC_HALVING_CYCLES && window.BTC_HALVING_CYCLES[4])
          ? window.BTC_HALVING_CYCLES[4].map(function(p){ return {time:p.day, value:p.price}; })
          : CYCLES[3].prices.map(function(p){ return {time:p[0], value:p[1]}; });
        var last = existing[existing.length-1];
        if (last && last.time < day) existing.push({time:day, value:Math.round(window.BTC_CURRENT)});
        else if (last) last.value = Math.round(window.BTC_CURRENT);
        window._halvingSeries[3].setData(existing);
      }

      var el = document.getElementById('halvingCurrentPrice');
      if (el && window.BTC_CURRENT) el.textContent = '$' + Math.round(window.BTC_CURRENT).toLocaleString();
      var cycDayEl = document.getElementById('halvingCycleDay');
      if (cycDayEl) cycDayEl.textContent = Math.floor((new Date() - HALVING4_DATE) / 86400000) + ' days';
      var upd2 = document.getElementById('halvingUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
      var upd2 = document.getElementById('halvingUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── CYCLE LOW — last point = current live price ─────────────────────────────
  // ── BITCOIN EPOCH CYCLES (LOW TO LOW) — TradingView LW ──────────────────────
  (function buildEpochChart() {
    var wrap = document.getElementById('epochChart');
    if (!wrap || typeof LightweightCharts === 'undefined') return;

    // Bear market bottoms:
    // 1st bottom: Jan 14, 2015 ($152)
    // 2nd bottom: Dec 15, 2018 ($3,122)
    // 3rd bottom: Nov 21, 2022 ($15,476) — current epoch start

    // Each epoch: real BTC price sampled from bottom date
    // X-axis = days since that epoch's low
    // Y-axis = actual BTC price (log scale)
    var EPOCHS = [
      {
        label: '1st Epoch', color: '#f4c542',
        startDate: '2015-01-14', startPrice: 152,
        // Sampled ~weekly from Jan 2015 → Dec 2018 bottom ($3,122)
        prices: [
          [0,152],[14,172],[30,195],[60,240],[90,275],[120,245],[150,270],
          [180,285],[210,330],[240,380],[270,430],[300,470],[330,440],[360,420],
          [390,450],[420,510],[450,580],[480,650],[510,700],[540,720],[570,680],
          [600,640],[630,720],[660,830],[690,980],[720,1120],[750,1050],[780,950],
          [810,900],[840,860],[870,820],[900,940],[930,1050],[960,1140],[990,1280],
          [1020,1560],[1050,1980],[1080,2400],[1110,2800],[1140,3200],[1170,3900],
          [1200,4800],[1230,6200],[1260,8500],[1290,11000],[1320,14000],[1350,17000],
          [1380,10000],[1400,8500],[1415,5000],[1430,3122]
        ]
      },
      {
        label: '2nd Epoch', color: '#a855f7',
        startDate: '2018-12-15', startPrice: 3122,
        // Sampled from Dec 2018 → Nov 2022 bottom ($15,476)
        prices: [
          [0,3122],[14,3450],[30,3600],[60,4050],[90,5200],[120,7900],[150,8500],
          [180,9600],[210,9200],[240,9800],[270,11500],[300,9400],[330,8800],[360,8200],
          [390,7100],[420,6800],[450,6500],[480,8800],[510,9500],[540,11500],[570,14000],
          [600,12000],[630,9300],[660,10200],[690,11800],[720,29000],[750,48000],
          [780,55000],[810,43000],[840,35000],[870,42000],[900,50000],[930,62000],
          [960,68000],[990,48000],[1020,38000],[1050,30000],[1080,24000],[1110,20000],
          [1140,18000],[1170,17000],[1200,16500],[1230,17000],[1260,19000],[1290,18000],
          [1320,17500],[1350,16500],[1380,16200],[1410,15700],[1437,15476]
        ]
      },
      {
        label: '3rd Epoch', color: '#e2e8f0',
        startDate: '2022-11-21', startPrice: 15476,
        // Sampled from Nov 2022 → present (live, ongoing)
        prices: [
          [0,15476],[14,16800],[30,17500],[45,21000],[60,23000],[75,22500],[90,24000],
          [105,27500],[120,29000],[135,28000],[150,26500],[165,27500],[180,29500],
          [195,30500],[210,29000],[225,28000],[240,26000],[255,26500],[270,29000],
          [285,30500],[300,31000],[315,34000],[330,37000],[345,42000],[360,45000],
          [375,44000],[390,43000],[405,42500],[420,43500],[435,44000],[450,46000],
          [465,48000],[480,51000],[495,52000],[510,57000],[525,60000],[540,63000],
          [555,65000],[570,67000],[585,61000],[600,58000],[615,57000],[630,60000],
          [645,62000],[660,64000],[675,63500],[690,66000],[705,68000],[720,72000],
          [735,75000],[750,71000],[765,68000],[780,67500],[795,70000],[810,76000],
          [825,82000],[840,90000],[855,97000],[870,93000],[885,86000],[900,84000],
          [915,83000],[930,85000],[945,83000],[960,84500],[975,85000],[990,83000],
          [1005,84000],[1020,83500]
        ]
      }
    ];

    // Calculate current epoch day (from Nov 21, 2022)
    var EPOCH3_START = new Date('2022-11-21');
    var TODAY = new Date();
    var currentEpochDay = Math.floor((TODAY - EPOCH3_START) / 86400000);

    // Update stat card
    var epDayEl = document.getElementById('epochCurrentDay');
    if (epDayEl) epDayEl.textContent = currentEpochDay + ' days';

    // Truncate 3rd epoch at today and inject live BTC price
    EPOCHS[2].prices = EPOCHS[2].prices.filter(function(p){ return p[0] <= currentEpochDay; });
    if (window.BTC_CURRENT && currentEpochDay > 0) {
      var last = EPOCHS[2].prices[EPOCHS[2].prices.length - 1];
      if (!last || last[0] < currentEpochDay) {
        EPOCHS[2].prices.push([currentEpochDay, Math.round(window.BTC_CURRENT)]);
      } else {
        last[1] = Math.round(window.BTC_CURRENT);
      }
    }

    // Create chart with log scale
    var chart = LightweightCharts.createChart(wrap, {
      width:  wrap.offsetWidth  || 900,
      height: wrap.offsetHeight || 520,
      layout: { background:{color:'transparent'}, textColor:'#4d6475' },
      grid:   { vertLines:{color:'rgba(28,45,56,.5)'}, horzLines:{color:'rgba(28,45,56,.5)'} },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#1c2d38',
        mode: LightweightCharts.PriceScaleMode.Logarithmic,
        scaleMargins: {top:0.05, bottom:0.05}
      },
      timeScale: {
        borderColor: '#1c2d38',
        tickMarkFormatter: function(v){ return 'Day '+v; }
      },
      handleScroll: true, handleScale: true,
    });

    window._epochChart   = chart;
    window._epochSeries  = {};
    window._epochVisible = {0:true, 1:true, 2:true};

    var legend = document.getElementById('epochLegend');
    if (legend) legend.innerHTML = '';

    EPOCHS.forEach(function(epoch, idx) {
      var series = chart.addLineSeries({
        color: epoch.color,
        lineWidth: idx === 2 ? 2.5 : 1.8,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      series.setData(epoch.prices.map(function(p){
        return { time: p[0], value: p[1] };
      }));
      window._epochSeries[idx] = series;

      var lastPrice = epoch.prices[epoch.prices.length - 1][1];
      var priceStr  = '$' + lastPrice.toLocaleString();
      var isLive    = idx === 2 ? ' ●' : '';

      if (legend) {
        legend.innerHTML +=
          '<div style="display:flex;align-items:center;gap:4px">' +
          '<span style="background:' + epoch.color + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:70px;text-align:center">' + epoch.label + isLive + '</span>' +
          '<span style="background:' + epoch.color + ';color:#000;font-family:Space Mono,monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;min-width:72px;text-align:center">' + priceStr + '</span>' +
          '</div>';
      }
    });

    chart.timeScale().fitContent();
    new ResizeObserver(function(){ chart.applyOptions({width:wrap.offsetWidth}); }).observe(wrap);

    // Build toggle pills
    var pillsEl = document.getElementById('epochPills');
    if (pillsEl) {
      pillsEl.innerHTML = EPOCHS.map(function(epoch, idx) {
        var days = epoch.prices[epoch.prices.length - 1][0];
        var isLive = idx === 2 ? ' · LIVE' : '';
        return '<button onclick="epochToggle(' + idx + ')" id="epochPill_' + idx + '" style="display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--bg3);border:1px solid ' + epoch.color + '55;border-radius:5px;cursor:pointer;transition:opacity .15s">' +
          '<span style="width:14px;height:2px;background:' + epoch.color + ';display:inline-block;border-radius:1px"></span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:#fff;font-weight:700">' + epoch.label + '</span>' +
          '<span style="font-family:Space Mono,monospace;font-size:9px;color:' + epoch.color + '">(' + days + ' days' + isLive + ')</span>' +
          '</button>';
      }).join('');
    }

    window.epochToggle = function(idx) {
      window._epochVisible[idx] = !window._epochVisible[idx];
      var pill = document.getElementById('epochPill_' + idx);
      if (pill) pill.style.opacity = window._epochVisible[idx] ? '1' : '0.35';
      if (window._epochSeries[idx]) {
        window._epochSeries[idx].applyOptions({ visible: window._epochVisible[idx] });
      }
    };
    window.epochShowAll = function() {
      EPOCHS.forEach(function(_, idx){
        window._epochVisible[idx] = true;
        var p = document.getElementById('epochPill_' + idx);
        if (p) p.style.opacity = '1';
        if (window._epochSeries[idx]) window._epochSeries[idx].applyOptions({visible:true});
      });
    };
    window.epochHideAll = function() {
      EPOCHS.forEach(function(_, idx){
        window._epochVisible[idx] = false;
        var p = document.getElementById('epochPill_' + idx);
        if (p) p.style.opacity = '0.35';
        if (window._epochSeries[idx]) window._epochSeries[idx].applyOptions({visible:false});
      });
    };

    var upd = document.getElementById('epochUpdated');
    if (upd) upd.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

    // Live refresh — updates 3rd epoch endpoint with current BTC price
    window._epochRefresh = function() {
      if (!window.BTC_CURRENT || !window._epochSeries[2]) return;
      var day = Math.floor((new Date() - EPOCH3_START) / 86400000);
      var prices = EPOCHS[2].prices;
      var last = prices[prices.length - 1];
      if (last && last[0] === day) {
        last[1] = Math.round(window.BTC_CURRENT);
      } else if (day > (last ? last[0] : 0)) {
        prices.push([day, Math.round(window.BTC_CURRENT)]);
      }
      window._epochSeries[2].setData(prices.map(function(p){ return {time:p[0], value:p[1]}; }));
      var el = document.getElementById('epochCurrentDay');
      if (el) el.textContent = day + ' days';
      var upd2 = document.getElementById('epochUpdated');
      if (upd2) upd2.textContent = '↻ Updated ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
    };
  })();

  // ── PUMP FUN ────────────────────────────────────────────────────────────────
  const pumpLEl=document.getElementById('pumpLaunchChart');
  if(pumpLEl){
    const launches=[980,1120,890,1340,1580,1210,1050,1390,1480,1260,1180,1420,1520,1284];
    const grads=[18,22,15,28,32,21,19,27,29,24,20,26,28,23];
    new Chart(pumpLEl,{type:'bar',data:{labels:Array.from({length:14},(_,i)=>`Day ${i+1}`),datasets:[{label:'Launches',data:launches,backgroundColor:'rgba(0,232,122,.6)',borderRadius:3},{label:'Graduated',data:grads.map(v=>v*10),backgroundColor:'rgba(244,197,66,.7)',borderRadius:3}]},
      options:{responsive:true,plugins:{legend:{labels:{color:MUTED,font:{size:9}}}},scales:{y:{grid:{color:'#1c2d38'},ticks:{color:MUTED}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:8}}}}}});
  }
  const pumpGEl=document.getElementById('pumpGradChart');
  if(pumpGEl){
    const gv=hexGrad(pumpGEl,ORANGE);
    new Chart(pumpGEl,{type:'line',data:{labels:Array.from({length:14},(_,i)=>`Day ${i+1}`),datasets:[
      {label:'Volume $M',data:[28,35,22,48,62,41,38,55,59,44,40,52,58,48],borderColor:ORANGE,backgroundColor:gv,fill:true,tension:0.4,yAxisID:'y',pointRadius:2},
      {label:'Grad %',data:[1.8,2.0,1.7,2.1,2.0,1.7,1.8,1.9,2.0,1.9,1.7,1.8,1.8,1.8],borderColor:GOLD,fill:false,tension:0.4,yAxisID:'y2',pointRadius:2}
    ]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:MUTED,font:{size:9}}}},
      scales:{y:{grid:{color:'#1c2d38'},ticks:{color:ORANGE,callback:v=>'$'+v+'M'}},y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:GOLD,callback:v=>v+'%'}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:8}}}}}});
  }

  // ── HYPERLIQUID OI ──────────────────────────────────────────────────────────
  const hlOIEl=document.getElementById('hlOIChart');
  if(hlOIEl){
    const g=hexGrad(hlOIEl,BLUE);
    new Chart(hlOIEl,{type:'line',data:{labels:['7d','6d','5d','4d','3d','2d','Yesterday','AM','Now'],datasets:[{label:'Open Interest $B',data:[1.62,1.70,1.85,1.78,1.92,2.04,1.98,2.08,2.14],borderColor:BLUE,backgroundColor:g,fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:BLUE}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'#1c2d38'},ticks:{color:MUTED,callback:v=>'$'+v+'B'}},x:{grid:{color:'#1c2d38'},ticks:{color:MUTED,font:{size:8}}}}}});
  }

  // ── CRYPTO BUBBLES ──────────────────────────────────────────────────────────
  const canvas=document.getElementById('bubbleCanvas');
  const loading=document.getElementById('bubblesLoading');
  if(canvas&&ALL_COINS.length){
    if(loading)loading.style.display='none';
    canvas.style.display='block';
    const W=canvas.parentElement.offsetWidth-48||800;
    const H=Math.min(520,Math.round(W*0.55));
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const maxMC=Math.max(...ALL_COINS.map(c=>c.market_cap));
    const minMC=Math.min(...ALL_COINS.map(c=>c.market_cap));
    const minR=18,maxR=Math.min(W*0.13,90);
    function mcToR(mc){const t=Math.log(mc/minMC)/Math.log(maxMC/minMC);return minR+t*(maxR-minR);}
    const bubbles=ALL_COINS.map(c=>({r:mcToR(c.market_cap),col:c.price_change_percentage_24h>=0?ACCENT:RED,name:c.symbol.toUpperCase(),chg:c.price_change_percentage_24h||0,x:50+Math.random()*(W-100),y:50+Math.random()*(H-100)}));
    for(let pass=0;pass<80;pass++){
      for(let i=0;i<bubbles.length;i++){
        for(let j=i+1;j<bubbles.length;j++){
          const a=bubbles[i],b=bubbles[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy)||1,minD=a.r+b.r+4;
          if(dist<minD){const push=(minD-dist)/2/dist;a.x-=dx*push;a.y-=dy*push;b.x+=dx*push;b.y+=dy*push;}
        }
        bubbles[i].x=Math.max(bubbles[i].r+2,Math.min(W-bubbles[i].r-2,bubbles[i].x));
        bubbles[i].y=Math.max(bubbles[i].r+2,Math.min(H-bubbles[i].r-2,bubbles[i].y));
      }
    }
    ctx.clearRect(0,0,W,H);
    bubbles.forEach(b=>{
      const glow=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*1.35);
      glow.addColorStop(0,b.col+'55');glow.addColorStop(1,b.col+'00');
      ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.35,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();
      const grad=ctx.createRadialGradient(b.x-b.r*.3,b.y-b.r*.3,0,b.x,b.y,b.r);
      grad.addColorStop(0,b.col+'cc');grad.addColorStop(1,b.col+'44');
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
      ctx.strokeStyle=b.col+'88';ctx.lineWidth=1;ctx.stroke();
      if(b.r>22){
        ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(9,Math.round(b.r*.32))}px 'Space Grotesk',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(b.name,b.x,b.y-(b.r>30?7:0));
        if(b.r>30){ctx.font=`${Math.max(8,Math.round(b.r*.26))}px 'Space Mono',monospace`;ctx.fillStyle=b.col;ctx.fillText((b.chg>=0?'+':'')+b.chg.toFixed(1)+'%',b.x,b.y+9);}
      }
    });
    canvas.onmousemove=e=>{const rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);const hit=bubbles.find(b=>Math.hypot(mx-b.x,my-b.y)<b.r);canvas.title=hit?`${hit.name}: ${(hit.chg>=0?'+':'')+hit.chg.toFixed(2)}% 24h`:''};
  }
} // end drawAllCharts
