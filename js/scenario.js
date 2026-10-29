// scenario.js - "Your rain scenario": rain, soil and drains → which flood size it matches → a flood map built for it.
// Plus the event clock and the alert to authorities. Loaded as a classic script (order set in index.html).
//
// How rain becomes a flood here (a simple index, NOT a rainfall-runoff model):
//   rain reaching the river = intensity × duration × (1 − soaked into the ground) × (1 − removed by drains)
//   → compared with the catchment's real 48-hour rain records (Gumbel levels, data/weather.json) → "1-in-T years"
//   → flood depths for T interpolated between the EFAS maps on a log scale (below 1-in-10: scaled down to 0 at 1-in-2).

const SC={rain:30,dur:180,init:0,perm:20,drain:10,slope:1,pop:100,mins:2880,alertN:1000,leadMin:180};
// Gumbel levels → yearly chance for a rain total
function rainT(mm){ const L=WX.data?.rainLevels?.q; if(!L) return null; const y=T=>-Math.log(-Math.log(1-1/T)),b=(L[100]-L[10])/(y(100)-y(10)),mu=L[10]-b*y(10);
  const p=1-Math.exp(-Math.exp(-(mm-mu)/b)); return p<=0?1e4:Math.max(1.01,1/p); }
const effRain=()=>SC.rain*SC.dur/60*(1-SC.perm/100)*(1-SC.drain/100);
// depth of a cell for any return period T: interpolate the water LEVEL in the nearby channel (L) on a log scale,
// then depth = level − ground (ground above the channel = L − depth of the mapped flood), so a cell gets water only once the level reaches it.
function depthAtT(c,T){ const B=D.base||D.rps,d=r=>c.depth[r]||0,L=r=>c.L?.[r]||d(r),lvl=(a,b,f)=>Math.max(0,L(a)+(L(b)-L(a))*f-(L(b)-d(b)));
  if(T<=2) return 0; if(T<B[0]){ const f=Math.log(T/2)/Math.log(B[0]/2); return Math.max(0,d(B[0])-(1-f)*L(B[0])); }
  for(let i=0;i<B.length-1;i++) if(T<=B[i+1]){const a=B[i],b=B[i+1]; return lvl(a,b,Math.log(T/a)/Math.log(b/a));}
  return d(B[B.length-1]); } // rarer than the rarest map: no data beyond it, shown as that map
function exposureT(T){ let people=0,area=0; for(const c of D.cells) if(depthAtT(c,T)>.01){people+=c.pop; area+=c.area;} return {people,area:area/1e6}; }

function drawScenarioInfo(){ const mm=effRain(),T=rainT(mm),box=$('scInfo');
  if(T==null){ box.innerHTML='<span style="color:var(--err)">No rain records loaded (data/weather.json): load the July 2021 replay in Alert first.</span>'; return; }
  const top=Math.max(...(D.base||D.rps)),Tr=Math.round(T),e=exposureT(Math.min(top,Tr));
  box.innerHTML=`Rain falling: <b>${Math.round(SC.rain*SC.dur/60)} mm</b> · reaching the river: <b>${Math.round(mm)} mm</b><br>
    That is like a <b>${Tr<2?'normal':`1-in-${Tr}-year`}</b> rain (${Tr<2?'no flood expected':`${sizeWord(Tr).toLowerCase()} flood`})${Tr>top?` — rarer than the rarest map (1-in-${top}): shown as 1-in-${top}, the real flood could be bigger`:''} → about <b>${fmt(e.people)}</b> residents and ${e.area.toFixed(1)} km² in the water at the peak.`; }
// build the flood map for the scenario and make it the selected flood size
function buildScenario(){ const T0=rainT(effRain()); if(T0==null){ toast('Rain records not loaded'); return; }
  D.base=D.base||[...D.rps]; const T=Math.min(Math.max(...D.base),Math.round(T0));
  if(D.custom) D.cells.forEach(c=>delete c.depth[D.custom]);
  D.cells.forEach(c=>{ if(c.pop0==null) c.pop0=c.pop; c.pop=c.pop0*SC.pop/100; });
  D.blds.forEach(b=>{ if(b.pop0==null) b.pop0=b.pop; b.pop=b.pop0*SC.pop/100; });
  LAG_MAX=.15/SC.slope; INIT=SC.init/100;
  if(T>=2&&!D.base.includes(T)){ D.cells.forEach(c=>c.depth[T]=+depthAtT(c,T).toFixed(2)); D.custom=T; D.rps=[...D.base,T].sort((a,b)=>a-b); }
  else { D.custom=null; D.rps=[...D.base]; }
  load(D,isDemo); const want=T<2?0:D.rps.indexOf(D.custom??D.base.reduce((b,r)=>Math.abs(Math.log(r/T))<Math.abs(Math.log(b/T))?r:b));
  S.sizeIdx=Math.max(0,want); $('size').value=S.sizeIdx; $('size').oninput({target:$('size')});
  toast(T<2?'This rain does not flood the valley':`Scenario built: 1-in-${T} years`); }
const SCF=[['rain','Rain intensity','mm/h',1,150,1],['dur','Rain duration','min',10,2880,10],['init','Water already in the river','cm',0,300,10],
  ['perm','Soaks into the ground','%',0,90,5],['drain','Removed by drains','%',0,80,5],['slope','Terrain slope effect (how fast the wave runs downhill)','×',.5,3,.1],['pop','People present (100 = residents only)','%',50,200,10]];
$('scIn').innerHTML=SCF.map(([k,t,u,mi,ma,st])=>`<label class="sl">${t} <span class="mono" id="scv-${k}">${SC[k]} ${u}</span><input type="range" min="${mi}" max="${ma}" step="${st}" value="${SC[k]}" data-sc="${k}" data-u="${u}"></label>`).join('');
$('scIn').oninput=e=>{const k=e.target.dataset.sc; if(!k) return; SC[k]=+e.target.value; $('scv-'+k).textContent=`${SC[k]} ${e.target.dataset.u}`; drawScenarioInfo();};
$('scBuild').onclick=buildScenario;
$('scReset').onclick=()=>{ Object.assign(SC,{init:0,slope:1,pop:100}); LAG_MAX=.15; INIT=0; if(D.custom||D.base){ D.cells.forEach(c=>{if(D.custom) delete c.depth[D.custom]; if(c.pop0!=null) c.pop=c.pop0;}); D.blds.forEach(b=>{if(b.pop0!=null) b.pop=b.pop0;}); D.custom=null; D.rps=[...(D.base||D.rps)]; load(D,isDemo);} toast('Back to the mapped flood sizes'); };

/* ---------- event clock + alert to authorities (live, while the video plays) ---------- */
const clock=T=>{const m=Math.round(T*SC.mins),h=Math.floor(m/60); return `${h} h ${String(m%60).padStart(2,'0')}`;};
let alerted=null,warned=null;
function checkAlerts(nowPeople){ const r=rp(),b=$('alertBar');
  const first=Math.min(...D.cells.filter(c=>c.pop>0&&c.depth[r]>.01).map(c=>floodStart(c,r))),warnAt=first-SC.leadMin/SC.mins;
  if(S.T<.02){alerted=warned=null;}
  if(warned==null&&S.T>=warnAt&&isFinite(warnAt)) warned=S.T;
  if(alerted==null&&nowPeople>=SC.alertN) alerted=S.T;
  const parts=[];
  if(warned!=null) parts.push(`📣 <b>Warning to residents</b> due at ${clock(Math.max(0,warned))} (${SC.leadMin} min before water reaches the first homes at ${clock(first)})${warnAt<0?' — <b>too late</b>: the lead time is longer than the time available':''}`);
  if(alerted!=null) parts.push(`🔔 <b>Alert sent to authorities</b> at ${clock(alerted)}: ${fmt(nowPeople)} residents in water now (threshold ${fmt(SC.alertN)})`);
  b.innerHTML=parts.join('<br>'); b.hidden=!parts.length; $('clockLbl').textContent=`Clock ${clock(S.T)} of ${clock(1)}`; }
['alertN','leadMin','mins'].forEach(k=>$('sc-'+k).onchange=e=>{const v=+e.target.value; if(v>0){SC[k]=v; alerted=warned=null; render();}});
