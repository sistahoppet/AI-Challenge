// weather.js - Rain + river forecast (Open-Meteo, free, no key) linked to the flood sizes: July 2021 replay and live forecast.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).
// External source, not challenge data: Open-Meteo Flood API (GloFAS river discharge, ~5 km cells) and Open-Meteo weather (ERA5 archive, forecast models).

/* ---------- where we look ---------- */
const GAUGE={name:'Vesdre at Pepinster',c:[5.807,50.567]};                 // river point (GloFAS snaps it to its nearest ~5 km river cell)
const RAIN_PTS=[[6.05,50.52],[5.95,50.60],[5.86,50.59],[5.80,50.57]];      // catchment: Hautes Fagnes, Eupen/Limbourg, Verviers, Pepinster (plain mean)
const REPLAY=['2021-07-08','2021-07-24'];
const WX={mode:'replay',data:null,day:null};

/* ---------- fetching (only when the user presses Load; cached in the browser, savable as data/weather.json) ----------
   Rain (ERA5 archive + forecast) always; river flow (GloFAS) only when the Flood API answers: it has a shared daily quota. */
const om=async u=>{const r=await fetch(u); const j=await r.json(); if(!r.ok||j.error) throw new Error(j.reason||('HTTP '+r.status)); return j;};
const ll=pts=>`latitude=${pts.map(p=>p[1]).join(',')}&longitude=${pts.map(p=>p[0]).join(',')}`;
function meanRain(j){const a=Array.isArray(j)?j:[j]; return a[0].daily.time.map((t,i)=>({t,mm:a.reduce((s,x)=>s+(x.daily.precipitation_sum[i]||0),0)/a.length})).map((x,i,arr)=>({...x,mm48:x.mm+(arr[i-1]?.mm||0)}));}
// levels for 1-in-10/100/500 years: Gumbel fit (method of moments) on yearly maxima 1984–2020 (2021 left out: what was known before the event)
function gumbel(rows,k){ const mx={}; rows.forEach(r=>{const y=r.t.slice(0,4); if(y<'2021'&&r[k]!=null) mx[y]=Math.max(mx[y]||0,r[k]);});
  const x=Object.values(mx),n=x.length,m=x.reduce((s,v)=>s+v,0)/n,sd=Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(n-1)),b=sd*Math.sqrt(6)/Math.PI,mu=m-.5772*b;
  const q={}; [10,100,500].forEach(T=>q[T]=+(mu-b*Math.log(-Math.log(1-1/T))).toFixed(1)); return {q,years:n,maxSeen:Math.max(...x)}; }
async function loadWeather(mode){
  const box=$('wxStatus'); box.textContent='Loading from Open-Meteo…'; const d={...(WX.data||{})}; let riverErr='';
  try{
    if(!d.rainLevels||(mode==='replay'&&!d.replayRain)){ const h=meanRain(await om(`https://archive-api.open-meteo.com/v1/archive?${ll(RAIN_PTS)}&start_date=1984-01-01&end_date=2021-12-31&daily=precipitation_sum&timezone=Europe%2FBrussels`));
      d.rainLevels=gumbel(h,'mm48'); d.replayRain=h.filter(x=>x.t>=REPLAY[0]&&x.t<=REPLAY[1]); }
    if(mode==='live'){ d.liveRain=meanRain(await om(`https://api.open-meteo.com/v1/forecast?${ll(RAIN_PTS)}&daily=precipitation_sum&past_days=3&forecast_days=16&timezone=Europe%2FBrussels`)); d.liveAt=new Date().toISOString(); }
    try{
      if(!d.levels){ const h=await om(`https://flood-api.open-meteo.com/v1/flood?latitude=${GAUGE.c[1]}&longitude=${GAUGE.c[0]}&daily=river_discharge&start_date=1984-01-01&end_date=2021-12-31`);
        const rows=h.daily.time.map((t,i)=>({t,q:h.daily.river_discharge[i]})); d.levels=gumbel(rows,'q'); d.gaugeAt=[h.longitude,h.latitude]; d.replayQ=rows.filter(x=>x.t>=REPLAY[0]&&x.t<=REPLAY[1]); }
      if(mode==='live'){ let f; for(const days of [30,16,7]){ try{ f=await om(`https://flood-api.open-meteo.com/v1/flood?latitude=${GAUGE.c[1]}&longitude=${GAUGE.c[0]}&daily=river_discharge,river_discharge_median,river_discharge_max&past_days=3&forecast_days=${days}`); break; }catch(e){ if(days===7) throw e; } }
        d.liveQ=f.daily.time.map((t,i)=>({t,q:f.daily.river_discharge_median?.[i]??f.daily.river_discharge[i],qmax:f.daily.river_discharge_max?.[i]??null})); }
    }catch(e){ riverErr=e.message; }
    WX.data=d; store.set('fse-weather',JSON.stringify(d)); WX.day=null; drawWeather();
    if(riverErr) $('wxStatus').insertAdjacentHTML('afterbegin',`<span style="color:var(--err)">River flow unavailable (${esc(riverErr)}): using 48-hour rain instead.</span> `);
    toast('Forecast data loaded');
  }catch(e){ box.innerHTML=`<span style="color:var(--err)">Could not load: ${esc(e.message)}.</span> Open-Meteo limits free requests per day: try later, or use data/weather.json.`; }
}

/* ---------- which plan? river flow when available, else 48-hour catchment rain ---------- */
function levelOf(v,L){ if(!L||v==null) return null; let hit=null; for(const T of [10,100,500]) if(v>=L.q[T]) hit=T; return hit; }
function planFromRp(T){ if(!T) return null; const i=D.rps.reduce((b,r,k)=>r<=T?k:b,-1); return i<0?null:i; } // highest data flood size not rarer than the forecast

/* ---------- charts: rain (mm) on top, river flow (m³/s) below when available: one axis per chart ---------- */
function drawWeather(){ const d=WX.data,box=$('wxChart'),st=$('wxStatus'); document.querySelectorAll('#wxMode [data-w]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.w===WX.mode));
  const live=WX.mode==='live',R=live?d?.liveRain:d?.replayRain,Q=(live?d?.liveQ:d?.replayQ)||null,RL=d?.rainLevels,QL=Q&&d?.levels;
  if(!R||!RL){ box.innerHTML=''; $('wxPlan').innerHTML=''; st.innerHTML=live?'Press <b>Load</b> to fetch today\'s 16-day forecast.':'Press <b>Load</b> to fetch the July 2021 rain (and river flow if available).'; return; }
  const days=R.map(x=>x.t),n=days.length,W=340,pl=34,pr=56,cw=(W-pl-pr)/n,X=i=>pl+i*cw,cx=i=>X(i)+cw/2;
  const H1=130,top1=14,rMax=Math.max(RL.q[500],...R.map(x=>x.mm48))*1.08,y1=v=>H1-v/rMax*(H1-top1);
  const qv=QL?days.map(t=>Q.find(x=>x.t===t)||{t,q:null}):null,H2=130,top2=H1+28,base2=top2+H2,qTop=QL?Math.max(QL.q[500],...Q.map(x=>Math.max(x.q||0,x.qmax||0)))*1.08:1,y2=v=>base2-v/qTop*(H2-8);
  const path=(arr,k,y)=>arr.map((x,i)=>x[k]==null?'':`${i&&arr[i-1][k]!=null?'L':'M'}${cx(i).toFixed(1)},${y(x[k]).toFixed(1)}`).join('');
  const thr=(L,y)=>[10,100,500].map(T=>`<line x1="${pl}" x2="${W-pr}" y1="${y(L.q[T])}" y2="${y(L.q[T])}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${W-pr+4}" y="${y(L.q[T])+4}" font-size="10" fill="var(--muted)">1-in-${T}</text>`).join('');
  const today=live?days.indexOf(new Date().toISOString().slice(0,10)):-1,bottom=QL?base2:H1;
  const sel=WX.day??(live?R.reduce((b,x,i)=>x.mm48>R[b].mm48?i:b,0):days.indexOf('2021-07-15'));
  const tick=i=>`<text x="${cx(i)}" y="${bottom+14}" font-size="10" text-anchor="middle" fill="var(--muted)">${days[i].slice(8)}/${days[i].slice(5,7)}</text>`;
  box.innerHTML=`<svg viewBox="0 0 ${W} ${bottom+20}" role="img" aria-label="Rain per day, 48-hour rain${QL?' and river flow':''} with flood levels">
    <text x="0" y="9" font-size="10" fill="var(--muted)">Rain, mm (catchment mean): bars = day, line = 48 hours</text>
    <line x1="${pl}" x2="${W-pr}" y1="${H1}" y2="${H1}" stroke="var(--line)"/>${thr(RL,y1)}
    ${R.map((x,i)=>`<rect x="${X(i)+1}" y="${y1(x.mm)}" width="${Math.max(1,cw-2)}" height="${Math.max(0,H1-y1(x.mm))}" rx="2" fill="var(--w1)"/>`).join('')}
    <path d="${path(R,'mm48',y1)}" fill="none" stroke="var(--w3)" stroke-width="2" stroke-linejoin="round"/>
    <text x="${pl-4}" y="${y1(Math.round(rMax/1.08))+4}" font-size="10" text-anchor="end" fill="var(--muted)">${Math.round(rMax/1.08)}</text>
    ${QL?`<text x="0" y="${top2-6}" font-size="10" fill="var(--muted)">River flow, m³/s (${esc(GAUGE.name)}${live?', median forecast; dotted = highest':''})</text>
      <line x1="${pl}" x2="${W-pr}" y1="${base2}" y2="${base2}" stroke="var(--line)"/>${thr(QL,y2)}
      ${live?`<path d="${path(qv,'qmax',y2)}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3" opacity=".7"/>`:''}
      <path d="${path(qv,'q',y2)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`:''}
    ${today>=0?`<line x1="${cx(today)}" x2="${cx(today)}" y1="${top1}" y2="${bottom}" stroke="var(--ink)"/><text x="${cx(today)+3}" y="${top1+8}" font-size="10" fill="var(--ink)">today</text>`:''}
    <line x1="${cx(sel)}" x2="${cx(sel)}" y1="${top1}" y2="${bottom}" stroke="var(--ink)" stroke-dasharray="1 2"/>
    <circle cx="${cx(sel)}" cy="${y1(R[sel].mm48)}" r="4.5" fill="var(--w3)" stroke="var(--surface)" stroke-width="2"/>
    ${tick(0)}${tick(Math.floor(n/2))}${tick(n-1)}
    ${days.map((t,i)=>`<rect class="hit" data-i="${i}" x="${X(i)}" y="0" width="${cw}" height="${bottom}" fill="transparent"/>`).join('')}</svg>`;
  const r=R[sel],q=qv?.[sel],worst=live&&$('wxWorst').checked,qUse=q?(worst?q.qmax??q.q:q.q):null;
  const byRiver=QL&&qUse!=null,T=byRiver?levelOf(qUse,QL):levelOf(r.mm48,RL),k=planFromRp(T);
  $('wxPlan').innerHTML=`<p style="margin:0;font-size:14px"><b>${new Date(r.t).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</b>: rain ${r.mm.toFixed(0)} mm (48 h: ${r.mm48.toFixed(0)} mm)${q&&q.q!=null?`, river ${Math.round(q.q)} m³/s`:''}.<br>
    ${T?`${byRiver?'River flow':'48-hour rain'} above the <b>1-in-${T}</b> level → <b>Plan ${String.fromCharCode(65+k)}</b> (${sizeWord(D.rps[k]).toLowerCase()} flood map).`:`${byRiver?'River flow':'48-hour rain'} below the 1-in-10 level: watch, no plan triggered.`}</p>
    ${T?`<button class="btn primary sm" id="wxShow" style="margin-top:6px">Show Plan ${String.fromCharCode(65+k)} on the map</button>`:''}`;
  if($('wxShow')) $('wxShow').onclick=()=>{ S.sizeIdx=k; $('size').value=k; $('size').oninput({target:$('size')}); toast(`Flood size set to 1-in-${D.rps[k]}`); };
  const lv=(L,u)=>`1-in-10 = ${Math.round(L.q[10])}, 1-in-100 = ${Math.round(L.q[100])}, 1-in-500 = ${Math.round(L.q[500])} ${u}`;
  st.innerHTML=`Levels from yearly maxima 1984–2020 (Gumbel fit; 1-in-500 is an extrapolation). 48-hour rain: ${lv(RL,'mm')}.${QL?` River: ${lv(QL,'m³/s')}.`:' River flow not loaded: the plan uses rain, which assumes rare rain means a rare flood (soil wetness and snow are ignored).'}`
    +(live?` Updated ${new Date(d.liveAt).toLocaleString('en-GB')}.`:' Replay = observed weather (ERA5, coarse: it underestimates local extremes), not the forecast issued at the time.');
  WX.day=sel; }
$('wxChart').addEventListener('click',e=>{const h=e.target.closest('.hit'); if(h){WX.day=+h.dataset.i; drawWeather();}});
$('wxChart').addEventListener('mousemove',e=>{const h=e.target.closest('.hit'),tip=$('wxTip'); if(!h){tip.hidden=true; return;}
  const d=WX.data,live=WX.mode==='live',R=live?d.liveRain:d.replayRain,r=R[+h.dataset.i],x=((live?d.liveQ:d.replayQ)||[]).find(y=>y.t===r.t);
  tip.innerHTML=`<b>${r.t}</b><br>Rain ${r.mm.toFixed(1)} mm · 48 h ${r.mm48.toFixed(1)} mm${x?.q!=null?`<br>River ${Math.round(x.q)} m³/s`:''}${x?.qmax!=null?`<br>Highest forecast ${Math.round(x.qmax)} m³/s`:''}`;
  const b=$('wxChart').getBoundingClientRect(); tip.style.left=Math.min(e.clientX-b.left+10,b.width-130)+'px'; tip.style.top=(e.clientY-b.top+10)+'px'; tip.hidden=false;});
$('wxChart').addEventListener('mouseleave',()=>$('wxTip').hidden=true);
document.querySelector('#wxMode').onclick=e=>{const b=e.target.closest('[data-w]'); if(b){WX.mode=b.dataset.w; WX.day=null; drawWeather();}};
$('wxLoad').onclick=()=>loadWeather(WX.mode);
$('wxWorst').onchange=drawWeather;
$('wxSave').onclick=()=>WX.data?saveFile('weather.json',JSON.stringify(WX.data)):toast('Load the data first');
// start from data/weather.json (offline demo) or the browser cache
setTimeout(async()=>{ let d=null; if(/^https?:$/.test(location.protocol)){ try{ const r=await fetch(DATA_DIR+'weather.json',{cache:'no-store'}); if(r.ok) d=await r.json(); }catch(e){} }
  if(!d){ try{ d=JSON.parse(store.get('fse-weather')||'null'); }catch(e){} } WX.data=d; if(D){ drawWeather(); drawCmp(); } });
