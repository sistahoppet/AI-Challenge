// forecast.js - Flood forecast model: rain + how wet the ground is → river flow → flood size (1-in-N years) → people and buildings in the water.
// Two uses: Sandbox (set the conditions yourself) and Now (today's data from Open-Meteo). The model is trained in the browser
// for the river point of the loaded area and kept in this browser.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).
// External sources, not challenge data: Open-Meteo ERA5 archive + forecast (rain, evapotranspiration), GloFAS river flow (~5 km).
// Method (checked in Python on the Vesdre, trained 1984-2014, tested 2015-2021): ridge regression on log river flow; the weights of
// rain, wetness and dryness are kept ≥ 0 so wetter conditions never lower the flood. Test NSE 0.72 (log flow); July 2021 predicted
// at ~170 m³/s (GloFAS 153, 1-in-500 flow 100), one day late. Weeks above the 1-in-10 flow 2015-2021: 1 of 2 caught, 2 false alarms.

const FC={model:null,live:null,busy:false,lastT:null};
const FC_NPOS=9; // r0 r1 r2 R3 R7 api sqR3 R3xapi dry30 (≥ 0), then season sin, cos (free)

/* ---------- river point: the Vesdre gauge in the study area, otherwise the area centre ---------- */
function fcPoint(){ const b=D.bbox,inB=p=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
  if(inB(GAUGE.c)) return {name:GAUGE.name,c:GAUGE.c,rain:RAIN_PTS};
  const c=[(b[0]+b[2])/2,(b[1]+b[3])/2].map(v=>+v.toFixed(3)),o=.08;
  return {name:`river cell nearest ${c[1]} N, ${c[0]} E`,c,rain:[c,[c[0]-o,c[1]],[c[0]+o,c[1]],[c[0],c[1]-o],[c[0],c[1]+o]]}; }
const fcKey=()=>'fse-fc1:'+fcPoint().c.join(',');

/* ---------- features per day (rain on day i counts: in a forecast that is the forecast rain) ---------- */
function fcFeatures(R,E,dates){ const out=[],k=.9; let v=0;
  for(let i=0;i<R.length;i++){ const api=v; v=v*k+(i>=3?(R[i-3]||0):0); if(i<29){ out.push(null); continue; } // api: wetness from rain up to 3 days before
    const sum=(a,m)=>{let t=0; for(let j=i-m+1;j<=i;j++) t+=a[j]; return t;},R3=sum(R,3),d=new Date(dates[i]);
    const doy=(d-Date.UTC(d.getUTCFullYear(),0,0))/864e5,w=2*Math.PI*doy/365.25;
    const f=[R[i],R[i-1],R[i-2],R3,sum(R,7),api,Math.sqrt(R3),R3*api/100,-sum(E,30),Math.sin(w),Math.cos(w)];
    out.push(f.every(Number.isFinite)?f:null); }
  return out; }
// ridge on standardised features, first FC_NPOS weights ≥ 0 (coordinate descent on the Gram matrix)
function fcFit(X,y,lam=1,it=500){ const n=X.length,p=X[0].length,mu=Array(p).fill(0),sd=Array(p).fill(0);
  X.forEach(r=>r.forEach((v,j)=>mu[j]+=v/n)); X.forEach(r=>r.forEach((v,j)=>sd[j]+=(v-mu[j])**2/n)); for(let j=0;j<p;j++) sd[j]=Math.sqrt(sd[j])||1;
  const ym=y.reduce((s,v)=>s+v,0)/n,G=Array.from({length:p},()=>Array(p).fill(0)),c=Array(p).fill(0),b=Array(p).fill(0);
  X.forEach((r,i)=>{ const z=r.map((v,j)=>(v-mu[j])/sd[j]); for(let j=0;j<p;j++){ c[j]+=z[j]*(y[i]-ym); for(let l=0;l<p;l++) G[j][l]+=z[j]*z[l]; } });
  for(let t=0;t<it;t++) for(let j=0;j<p;j++){ let s=c[j]; for(let l=0;l<p;l++) if(l!==j) s-=G[j][l]*b[l]; const v=s/(G[j][j]+lam); b[j]=j<FC_NPOS?Math.max(0,v):v; }
  return {mu,sd,ym,b}; }
const fcLogQ=(m,f)=>m.ym+f.reduce((s,v,j)=>s+(v-m.mu[j])/m.sd[j]*m.b[j],0);
const fcQ=(m,f)=>f?Math.max(0,Math.expm1(fcLogQ(m,f))):null;
// flow ↔ return period: Gumbel on yearly maxima (method of moments)
const qOfT=(g,T)=>g.mu-g.b*Math.log(-Math.log(1-1/T)), tOfQ=(g,q)=>1/(1-Math.exp(-Math.exp(-(q-g.mu)/g.b)));
const tLabel=T=>!isFinite(T)||T>500?'beyond 1-in-500':T<2?'below 1-in-2 (normal flow)':`1-in-${T<20?T.toFixed(1):Math.round(T)}`;
const meanPts=(a,k)=>a[0].daily.time.map((_,i)=>{ let s=0; for(const x of a){ const v=x.daily[k][i]; if(v==null) return NaN; s+=v; } return s/a.length; });

/* ---------- training (two Open-Meteo calls, then a few milliseconds) ---------- */
async function fcTrain(force){ const P=fcPoint(),key=fcKey();
  if(!force){ try{ const m=JSON.parse(store.get(key)||'null'); if(m){ FC.model=m; return m; } }catch(e){} }
  const y1=new Date().getUTCFullYear()-1,end=`${y1}-12-31`;
  const [rain,flow]=await Promise.all([om(`https://archive-api.open-meteo.com/v1/archive?${ll(P.rain)}&start_date=1984-01-01&end_date=${end}&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=Europe%2FBrussels`),
    om(`https://flood-api.open-meteo.com/v1/flood?latitude=${P.c[1]}&longitude=${P.c[0]}&daily=river_discharge&start_date=1984-01-01&end_date=${end}`)]);
  const ra=Array.isArray(rain)?rain:[rain],dates=ra[0].daily.time,R=meanPts(ra,'precipitation_sum'),E=meanPts(ra,'et0_fao_evapotranspiration');
  const qBy=new Map(flow.daily.time.map((t,i)=>[t,flow.daily.river_discharge[i]])),F=fcFeatures(R,E,dates),rows=[];
  dates.forEach((t,i)=>{ const q=qBy.get(t); if(F[i]&&q!=null&&q>=0) rows.push({t,y:+t.slice(0,4),f:F[i],ly:Math.log1p(q)}); });
  if(rows.length<3650) throw new Error('not enough river-flow history for this point');
  // honest skill: train without the last 7 years, test on them; then train on everything
  const cut=y1-6,trn=rows.filter(r=>r.y<cut),tst=rows.filter(r=>r.y>=cut),m0=fcFit(trn.map(r=>r.f),trn.map(r=>r.ly));
  const om_=tst.reduce((s,r)=>s+r.ly,0)/tst.length,nse=1-tst.reduce((s,r)=>s+(r.ly-fcLogQ(m0,r.f))**2,0)/tst.reduce((s,r)=>s+(r.ly-om_)**2,0);
  const m=fcFit(rows.map(r=>r.f),rows.map(r=>r.ly)),am={};
  rows.forEach(r=>{ const q=Math.expm1(r.ly); am[r.y]=Math.max(am[r.y]||0,q); });
  const x=Object.values(am),mean=x.reduce((s,v)=>s+v,0)/x.length,sdv=Math.sqrt(x.reduce((s,v)=>s+(v-mean)**2,0)/(x.length-1)),gb=sdv*Math.sqrt(6)/Math.PI,g={mu:mean-.5772*gb,b:gb};
  const et0m=Array(12).fill(0),cnt=Array(12).fill(0); dates.forEach((t,i)=>{ if(Number.isFinite(E[i])){ const k=+t.slice(5,7)-1; et0m[k]+=E[i]; cnt[k]++; } });
  const i13=dates.indexOf('2021-07-13'); let p21=null;
  if(i13>=30){ const fq=dates.slice(i13-3,i13+8).map(t=>qBy.get(t)??0),mq=[...Array(11)].map((_,j)=>fcQ(m,F[i13-3+j])||0);
    p21={rain:[R[i13],R[i13+1],R[i13+2]].map(v=>Math.round(v)),past30:Math.round(R.slice(i13-30,i13).reduce((s,v)=>s+(v||0),0)),model:Math.max(...mq),glofas:Math.max(...fq)}; }
  FC.model={key,name:P.name,c:P.c,...m,g,q:{10:qOfT(g,10),100:qOfT(g,100),500:qOfT(g,500)},nse,test:[cut,y1],years:[1984,y1],
    et0m:et0m.map((s,k)=>s/(cnt[k]||1)),p21,maxSeen:Math.max(...x),gauge:[flow.longitude,flow.latitude]};
  store.set(key,JSON.stringify(FC.model)); return FC.model; }

/* ---------- people and buildings in the water for any flood size (EFAS depths blended on log T, as in risk_model.blend_T) ---------- */
function blendDepth(c,T){ if(T<=2) return 0; let lo=2,dlo=0;
  for(const r of D.rps){ const d=c.depth[r]; if(T<=r){ const w=(Math.log(T)-Math.log(lo))/(Math.log(r)-Math.log(lo)); return (1-w)*dlo+w*d; } lo=r; dlo=d; }
  return dlo; } // above the rarest map: keep its depth (no extrapolation)
function fcImpact(T){ const wet=new Uint8Array(D.cells.length); let people=0,area=0,deep=0,bld=0;
  D.cells.forEach((c,i)=>{ const d=blendDepth(c,T); if(d>.01){ wet[i]=1; people+=c.pop; area+=c.area; if(d>1.5) deep+=c.pop; } });
  D.blds.forEach(b=>{ if(b.ci>=0&&wet[b.ci]) bld++; }); return {people,area:area/1e6,deep,bld}; }

/* ---------- sandbox: build a 60-day series from the sliders, predict the next 5 days ---------- */
const FCS=['fcR1','fcR2','fcR3','fcPast'];
function fcSandbox(){ const m=FC.model,mo=+$('fcMonth').value,rain=FCS.slice(0,3).map(id=>+$(id).value),past=+$('fcPast').value,N=60,R=[],E=[],dates=[];
  for(let i=0;i<N+5;i++){ R.push(i<N?past/30:i<N+3?rain[i-N]:0); E.push(m.et0m[mo-1]); dates.push(`2023-${String(mo).padStart(2,'0')}-15`); }
  const F=fcFeatures(R,E,dates),Q=Math.max(...F.slice(N).map(f=>fcQ(m,f))),base=fcQ(m,F[N-1]); return {Q,base,T:tOfQ(m.g,Q)}; }
function fcLabels(){ FCS.forEach(id=>$(id+'V').textContent=$(id).value+' mm'); }
function drawSandbox(){ fcLabels(); const box=$('fcSOut'); if(!fcReady()){ box.innerHTML=''; return; }
  const s=fcSandbox(); FC.lastT={T:s.T,src:'sandbox'}; box.innerHTML=fcResult(s.Q,s.T,`flow before the rain ~${s.base.toFixed(0)} m³/s`); }
function fcResult(Q,T,extra){ const m=FC.model,Tc=Math.min(isFinite(T)?T:500,500),im=fcImpact(Tc),k=planFromRp(Tc),warn=T>=10;
  return `<div class="stats"><div class="stat${warn?' warn':''}"><b>${Q.toFixed(0)}</b><span>m³/s peak river flow (1-in-10: ${m.q[10].toFixed(0)}, 1-in-100: ${m.q[100].toFixed(0)})</span></div>
    <div class="stat${warn?' warn':''}"><b>${!isFinite(T)||T>500?'>500':T<2?'<2':Math.round(T)}</b><span>years: flood size (${tLabel(T)})</span></div>
    <div class="stat"><b>${fmt(im.people)}</b><span>residents in the water${im.deep?`, ${fmt(im.deep)} over 1.5 m`:''}</span></div></div>
    <p class="hint">${fmt(im.bld)} buildings · ${im.area.toFixed(2)} km² wet in the loaded area${extra?' · '+esc(extra):''}.
    ${k==null?'Below the smallest flood map: no map to show.':`Map: the ${sizeWord(D.rps[k]).toLowerCase()} flood map (1-in-${D.rps[k]}), the rarest one not beyond this flood.`}</p>`; }
const fcReady=()=>FC.model&&FC.model.key===fcKey();

/* ---------- now: last 60 days + 16-day forecast (rain) and the GloFAS flow forecast ---------- */
async function fcLoadLive(){ const P=fcPoint(),m=FC.model;
  const w=await om(`https://api.open-meteo.com/v1/forecast?${ll(P.rain)}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=60&forecast_days=16&timezone=Europe%2FBrussels`);
  const wa=Array.isArray(w)?w:[w],dates=wa[0].daily.time,R=meanPts(wa,'precipitation_sum'),E=meanPts(wa,'et0_fao_evapotranspiration'),F=fcFeatures(R,E,dates);
  let g=null; for(const days of [30,16,7]){ try{ g=await om(`https://flood-api.open-meteo.com/v1/flood?latitude=${P.c[1]}&longitude=${P.c[0]}&daily=river_discharge,river_discharge_median,river_discharge_max&past_days=3&forecast_days=${days}`); break; }catch(e){ g=null; } }
  const gBy=g?new Map(g.daily.time.map((t,i)=>[t,g.daily.river_discharge_median?.[i]??g.daily.river_discharge[i]])):new Map();
  const today=new Date().toISOString().slice(0,10),i0=Math.max(29,dates.indexOf(today)-7),days=dates.slice(i0);
  FC.live={at:new Date().toISOString(),days,today,rain:R.slice(i0),qm:F.slice(i0).map(f=>fcQ(m,f)),qg:days.map(t=>gBy.get(t)??null),hasG:!!g}; }
function drawLive(){ const box=$('fcChart'),out=$('fcLOut'),L=FC.live;
  if(!L||!fcReady()){ box.innerHTML=''; out.innerHTML=L?'<p class="hint">Train the model for this area, then load again.</p>':''; return; }
  const m=FC.model,n=L.days.length,W=340,pl=34,pr=56,H=150,top=14,cw=(W-pl-pr)/n,cx=i=>pl+i*cw+cw/2,ti=L.days.indexOf(L.today);
  const vals=[...L.qm,...L.qg].filter(v=>v!=null),mx=Math.max(m.q[100],...vals)*1.1,y=v=>H-v/mx*(H-top);
  const path=a=>a.map((v,i)=>v==null?'':`${i&&a[i-1]!=null?'L':'M'}${cx(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const thr=[10,100,500].filter(T=>m.q[T]<mx).map(T=>`<line x1="${pl}" x2="${W-pr}" y1="${y(m.q[T])}" y2="${y(m.q[T])}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${W-pr+4}" y="${y(m.q[T])+4}" font-size="10" fill="var(--muted)">1-in-${T}</text>`).join('');
  const rMax=Math.max(10,...L.rain.filter(Number.isFinite)),tick=i=>`<text x="${cx(i)}" y="${H+14}" font-size="10" text-anchor="middle" fill="var(--muted)">${L.days[i].slice(8)}/${L.days[i].slice(5,7)}</text>`;
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H+20}" role="img" aria-label="Predicted river flow per day with flood levels">
    <text x="0" y="9" font-size="10" fill="var(--muted)">River flow, m³/s: solid = our model from rain${L.hasG?', dashed = GloFAS forecast':''}; bars = rain</text>
    ${L.rain.map((v,i)=>Number.isFinite(v)?`<rect x="${pl+i*cw+1}" y="${H-v/rMax*40}" width="${Math.max(1,cw-2)}" height="${v/rMax*40}" fill="var(--w1)" opacity=".6"/>`:'').join('')}
    <line x1="${pl}" x2="${W-pr}" y1="${H}" y2="${H}" stroke="var(--line)"/>${thr}
    <path d="${path(L.qg)}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${path(L.qm)}" fill="none" stroke="var(--w3)" stroke-width="2" stroke-linejoin="round"/>
    <text x="${pl-4}" y="${y(Math.round(mx/1.1))+4}" font-size="10" text-anchor="end" fill="var(--muted)">${Math.round(mx/1.1)}</text>
    ${ti>=0?`<line x1="${cx(ti)}" x2="${cx(ti)}" y1="${top}" y2="${H}" stroke="var(--ink)"/><text x="${cx(ti)+3}" y="${top+8}" font-size="10" fill="var(--ink)">today</text>`:''}
    ${tick(0)}${ti>0?tick(ti):''}${tick(n-1)}</svg>`;
  const fut=L.days.map((t,i)=>({t,q:L.qm[i],g:L.qg[i]})).filter(x=>x.t>=L.today&&x.q!=null),pk=fut.reduce((b,x)=>x.q>b.q?x:b,fut[0]||{q:0,t:L.today});
  const gpk=fut.filter(x=>x.g!=null).reduce((b,x)=>!b||x.g>b.g?x:b,null),T=tOfQ(m.g,pk.q); FC.lastT={T,src:'now'};
  out.innerHTML=fcResult(pk.q,T,`peak on ${pk.t}`)+(gpk?`<p class="hint">GloFAS forecast (Copernicus river model) peaks at ${gpk.g.toFixed(0)} m³/s on ${gpk.t}: ${tLabel(tOfQ(m.g,gpk.g))}. When the two disagree, trust neither alone: check the official gauges.</p>`:'<p class="hint">GloFAS forecast not available right now (free daily quota): model only.</p>')
    +`<p class="hint">Loaded ${L.at.slice(0,16).replace('T',' ')} UTC.</p>`; }

/* ---------- panel ---------- */
function drawModel(){ const el=$('fcModel'),P=fcPoint();
  if(!fcReady()){ try{ const m=JSON.parse(store.get(fcKey())||'null'); if(m) FC.model=m; }catch(e){} }
  if(!fcReady()){ el.innerHTML=`River point: ${esc(P.name)}. <b>Train the model</b> to use the sandbox and today's data (downloads ~2 MB from Open-Meteo once).`; $('fc21').disabled=true; return; }
  const m=FC.model; $('fc21').disabled=!m.p21;
  el.innerHTML=`River point: ${esc(m.name)} (GloFAS cell ${m.gauge.map(v=>v.toFixed(3)).join(', ')}). Trained on ${m.years[0]}–${m.years[1]}.
    Skill on ${m.test[0]}–${m.test[1]} (left out): NSE ${m.nse.toFixed(2)} on log flow (1 = perfect, 0 = no better than the average).
    ${m.p21?`July 2021 (inside the training years): model ${m.p21.model.toFixed(0)} m³/s, GloFAS ${m.p21.glofas.toFixed(0)} m³/s (1-in-500 flow ${m.q[500].toFixed(0)}).`:''}`; }
function drawForecast(){ drawModel(); drawSandbox(); drawLive(); }
$('fcTrain').onclick=async e=>{ const b=e.target; if(FC.busy) return; FC.busy=true; b.disabled=true; $('fcModel').textContent='Downloading 40 years of rain and river flow…';
  try{ await fcTrain(true); toast('Forecast model trained'); }catch(err){ $('fcModel').innerHTML=`<span style="color:var(--err)">Could not train: ${esc(err.message)}.</span> Open-Meteo limits free requests per day: try later.`; FC.busy=false; b.disabled=false; return; }
  FC.busy=false; b.disabled=false; drawForecast(); };
$('fcLive').onclick=async e=>{ const b=e.target; if(!fcReady()){ toast('Train the model first'); return; } b.disabled=true; $('fcLOut').innerHTML='<p class="hint">Loading today\'s data…</p>';
  try{ await fcLoadLive(); drawLive(); }catch(err){ $('fcLOut').innerHTML=`<p class="hint" style="color:var(--err)">Could not load: ${esc(err.message)}.</p>`; } b.disabled=false; };
FCS.forEach(id=>$(id).oninput=drawSandbox); $('fcMonth').onchange=drawSandbox;
$('fc21').onclick=()=>{ const p=FC.model?.p21; if(!p) return; ['fcR1','fcR2','fcR3'].forEach((id,i)=>$(id).value=p.rain[i]); $('fcPast').value=p.past30; $('fcMonth').value=7; drawSandbox(); };
$('fcShow').onclick=()=>{ const t=FC.lastT; if(!t){ toast('Run the sandbox or load today\'s data first'); return; } const k=planFromRp(Math.min(isFinite(t.T)?t.T:500,500));
  if(k==null){ toast('Below the smallest flood map (1-in-'+D.rps[0]+'): nothing to show'); return; }
  S.sizeIdx=k; $('size').value=k; $('size').oninput({target:$('size')}); setTab('sim'); toast(`Showing the 1-in-${D.rps[k]} flood map (${t.src})`); };
fcLabels();
