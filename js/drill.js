// drill.js - Evacuation drill over the event clock: people leaving, walking, shelters filling up, streets cut by the water,
// people caught at home. Training mode pauses at key moments and asks for a decision (like a flight simulator); the debrief shows
// the sequence of actions that leaves the fewest people unsafe. Deterministic: same inputs give the same result (no random numbers).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).
//
// Model (a scenario built on assumptions, not a prediction):
//  - warning at (water reaches the first homes − warning lead time); people who follow the order leave spread evenly over 2 × "time to get ready"
//  - they walk their route (OpenStreetMap streets) at walking speed + delay; a street point is closed once the water there reaches the
//    safe walking depth (same water rise as the video): a walker reaching it later is stuck on a flooded street
//  - shelter full on arrival: sent to the closest shelter with room (straight line × 1.3, water not checked), else "no place"
//  - people still home when the water arrives: upstairs if their building (GHS-OBAT height) is ≥ water + one floor (3 m), else trapped
//  - rescue teams take people out of danger at a fixed rate (people per hour) once mobilised (30 min after the first person is in danger)

const DR={comply:80,capX:100,rescue:60,train:false,dec:{},log:[],run:null,prep:null,best:null,asked:null};
const STOREY=3,DETOUR=1.3,NC=6,RESCUE_MOB=30,SUPPORT_X=3,EXTRA_LEAD=[0,60,120];
const DR0={comply:80,capX:100,rescue:60,lead:180,mob:60,delay:15,speed:1.1}; // starting point for the scoreboard (defaults of the app)
const clockM=m=>m<0?`${clock(-m/SC.mins)} before start`:clock(m/SC.mins);

/* ---------- inputs that depend on the plan and the water (rebuilt when either changes) ---------- */
function drillPrep(){ const P=E.plan; if(!P?.groups.length||!E.shelters.length) return null; const r=P.r,M=SC.mins,F=FOOT_DEPTH,G=D.G,B=Math.max(1,Math.round(400/G.m));
  // minute when the water at a cell first reaches F (inverse of nowDepth's rise, same curve as floodStart)
  const cutT=c=>{const d=c.depth[r]; if(!(d>F)) return Infinity; const v=1-(d-F)/c.L[r]; if(INIT/(c.L[r]||1)>=v) return 0; return (c.lag+.45*Math.acos(1-2*v)/Math.PI)*M;};
  const cellsOf=l=>{ if(l.cells) return l.cells; const out=[],seen=new Set(); for(let s=0;s<=l.len;s+=40){const p=along(l,s),i=G.at(p[0],p[1]); if(i<0||seen.has(i)) continue; seen.add(i); const t=cutT(D.cells[i]); if(isFinite(t)) out.push([s,t]);} return l.cells=out; };
  const up=new Map(); // share of residents whose building keeps a floor above the water (GHS-OBAT height)
  for(const b of D.blds){ if(b.ci<0) continue; const c=D.cells[b.ci],d=c.depth[r]; if(!(d>.01)) continue; const k=Math.floor(c.gx/B)+':'+Math.floor(c.gy/B),w=b.pop||1,u=up.get(k)||up.set(k,{a:0,n:0}).get(k); u.n+=w; if(b.h>=d+STOREY) u.a+=w; }
  // when the water reaches the homes of a group: the residents' median moment (the group's first wet cell is often the riverbed)
  const tw=new Map(); for(const c of D.cells){ if(!c.pop||!(c.depth[r]>.01)) continue; const k=Math.floor(c.gx/B)+':'+Math.floor(c.gy/B); (tw.get(k)||tw.set(k,[]).get(k)).push([floodStart(c,r),c.pop]); }
  const midT=k=>{ const a=(tw.get(k)||[]).sort((x,y)=>x[0]-y[0]),h=a.reduce((s,x)=>s+x[1],0)/2; let s=0; for(const [t,p] of a){ s+=p; if(s>=h) return t; } return null; };
  const groups=P.groups.map((g,gi)=>{ const u=up.get(g.key),tm=midT(g.key),legs=P.routes.filter(x=>x.gi===gi).map(x=>(cellsOf(x),{n:x.people,l:x,k:x.k}));
    if(g.near) cellsOf(g.near); if(g.left>0&&g.near) legs.push({n:g.left,l:g.near,k:g.near.k});
    return {pop:g.pop,c:g.c,wave:g.wave,ts:(tm??g.ts)*M,dmax:g.dmax,up:u?.n?u.a/u.n:0,legs,near:g.near?[{n:g.pop,l:g.near,k:g.near.k}]:[]}; });
  return {groups,first:Math.min(...groups.map(g=>g.ts)),M}; }

// best candidates not yet in the plan (read at each run: the candidates list can arrive after the plan)
function extraShelters(){const inPlan=new Set(E.shelters.map(s=>s.src)); return (E.cands||[]).filter(c=>!inPlan.has(c)&&c.stay!=='assembly').slice(0,3).map(c=>({c:c.c,cap:c.cap||E.cap,name:c.name||kindName(c.kind)})); }

/* ---------- decisions → model options ---------- */
function drillOpts(dec=DR.dec,a={}){ const o={lead:SC.leadMin,comply:DR.comply/100,capX:DR.capX/100,mob:FW.mob,delay:FW.delay,v:E.speed*1000/60,rate:DR.rescue,...a};
  return {...o,guide:dec.order==='near'?'near':'plan',door:dec.order==='door',tall:dec.order==='tall',wait:dec.order==='wait'?60:0,lead:o.lead+(dec.early||0),
    full:dec.full||'redirect',fullAt:dec.fullAt??-Infinity,vert:dec.cut==='up',vertAt:dec.cutAt??-Infinity,support:dec.help==='nat',supportAt:dec.helpAt??-Infinity}; }

/* ---------- one run: cohorts of people with a timeline of states ---------- */
function simulate(o){ const pr=DR.prep; if(!pr) return null; const M=pr.M,W=pr.first-o.lead+o.wait,comply=Math.min(1,o.comply+(o.door?.1:0));
  const sh=E.shelters.map((s,k)=>({c:s.c,name:s.name,cap:capOf(k)*o.capX,load:0,full:null,from:-Infinity,tl:[]}));
  if(o.full==='open') extraShelters().forEach(x=>sh.push({...x,cap:x.cap*o.capX,load:0,full:null,from:o.fullAt,tl:[],extra:true}));
  // "tall": shelter places go first to people without a safe upper floor; the share f of the others that still fits leaves too, the rest stays upstairs
  const C=sh.reduce((a,x)=>a+x.cap,0),need=pr.groups.reduce((a,g)=>a+g.pop*comply*(1-g.up),0),upN=pr.groups.reduce((a,g)=>a+g.pop*comply*g.up,0),f=o.tall?Math.max(0,Math.min(1,(C-need)/(upN||1))):1;
  const capAt=(s,t)=>s.cap*(o.full==='pack'&&t>=o.fullAt?1.3:1),co=[],arr=[],danger=[];
  const wet=(c,t)=>{c.segs.push([t,'wet']); danger.push([t,c.n*(1-(c.up??c.g.up))]);};
  for(const g of pr.groups){
    if(comply<1){ const c={n:g.pop*(1-comply),g,segs:[[-Infinity,'home']]}; wet(c,g.ts); co.push(c); } // did not follow the order
    if(o.tall&&g.up*(1-f)>0){ const c={n:g.pop*comply*g.up*(1-f),g,up:1,segs:[[-Infinity,'home']]}; wet(c,g.ts); co.push(c); } // told to stay upstairs: building has a floor above the water
    const go=1-g.up*(1-f);
    for(const L of o.guide==='near'?g.near:g.legs) for(let j=0;j<NC;j++){ const n=L.n*comply*go/NC,dep=W+o.mob*2*(j+.5)/NC,c={n,g,segs:[[-Infinity,'home']]}; co.push(c);
      if(dep>=g.ts){ if(o.vert&&g.ts>=o.vertAt) wet(c,g.ts); else { c.segs.push([g.ts,'stuck',g.c]); danger.push([g.ts,n]); } continue; } // water already at the door
      const v=L.l.len/Math.max(1,L.l.len/o.v+o.delay); let stuck=null;
      for(const [s,t] of L.l.cells) if(dep+s/v>=t){ stuck=[dep+s/v,s]; break; }
      c.segs.push([dep,'walk',L.l,dep,v]);
      if(stuck){ c.segs.push([stuck[0],'stuck',along(L.l,stuck[1])]); danger.push([stuck[0],n]); } else arr.push({t:dep+L.l.len/v,c,k:L.k}); }
  }
  arr.sort((a,b)=>a.t-b.t);
  while(arr.length){ const a=arr.shift(),s=sh[a.k],inN=Math.min(Math.max(0,capAt(s,a.t)-s.load),a.c.n),rest=a.c.n-inN;
    if(inN>0){ s.load+=inN; s.tl.push([a.t,s.load]); }
    const done=rest<=1e-6?a.c:{...a.c,n:rest,segs:[...a.c.segs]}; if(rest>1e-6){ a.c.n=inN; co.push(done); s.full??=a.t; }
    if(inN>0) a.c.segs.push([a.t,'shel',a.k]); if(rest<=1e-6) continue;
    let j=-1,bd=Infinity; sh.forEach((x,i)=>{ if(i===a.k||x.from>a.t||capAt(x,a.t)-x.load<=0) return; const d=mDist(s.c,x.c); if(d<bd){bd=d; j=i;} });
    if(j<0){ done.segs.push([a.t,'noplace',s.c]); continue; }
    const l=prepLine([s.c,sh[j].c]),t2=a.t+bd*DETOUR/o.v; done.segs.push([a.t,'walk',l,a.t,l.len/(t2-a.t)]);
    const at={t:t2,c:done,k:j},i=arr.findIndex(x=>x.t>t2); i<0?arr.push(at):arr.splice(i,0,at); }
  // rescue: queue served at a rate (people/h); support from national teams multiplies it from the moment it is requested
  danger.sort((a,b)=>a[0]-b[0]); const t0=(danger[0]?.[0]??Infinity)+RESCUE_MOB,step=5,R=[];
  let A=0,i=0,q=0; const tStart=Math.min(0,W); for(let t=tStart;t<=M;t+=step){ while(i<danger.length&&danger[i][0]<=t) A+=danger[i++][1];
    const rate=t<t0?0:o.rate*(o.support&&t>=Math.max(t0,o.supportAt+RESCUE_MOB)?SUPPORT_X:1); q=Math.min(A,q+rate*step/60); R.push(q); }
  const run={o,W,f,comply,sh,co,R,tStart,step,M,firstDanger:danger[0]?.[0]??null,peakT:.6*M,firstFull:Math.min(...sh.map(s=>s.full??Infinity))};
  run.firstStuck=Math.min(...co.map(c=>c.segs.find(s=>s[1]==='stuck')?.[0]??Infinity));
  run.peak=countAt(run,run.peakT); run.score=run.peak.danger+run.peak.noplace; return run; }
const segAt=(c,t)=>{let s=c.segs[0]; for(const x of c.segs){ if(x[0]>t) break; s=x; } return s;};
function countAt(run,t){ const k={home:0,walk:0,shel:0,up:0,trap:0,stuck:0,noplace:0};
  for(const c of run.co){ const s=segAt(c,t); if(s[1]==='wet'){ const u=c.up??c.g.up; k.up+=c.n*u; k.trap+=c.n*(1-u); } else k[s[1]==='shel'?'shel':s[1]]+=c.n; }
  const resc=run.R[Math.max(0,Math.min(run.R.length-1,Math.floor((t-run.tStart)/run.step)))]||0,dg=k.trap+k.stuck,f=dg>0?Math.max(0,1-resc/dg):1;
  k.resc=Math.min(dg,resc); k.trap*=f; k.stuck*=f; k.danger=k.trap+k.stuck; return k; }

/* ---------- runs: yours (with low/high range), starting point, best ---------- */
const rangeOf=o=>[simulate(o),simulate({...o,comply:Math.min(1,o.comply+.1),v:o.v*1.2,mob:o.mob*.75}),simulate({...o,comply:Math.max(0,o.comply-.15),v:o.v*.8,mob:o.mob*1.5})].map(x=>x?.score??0).sort((a,b)=>a-b).filter((x,i,a)=>i!==1);
function drillReset(){ if(!$('dk-size')||+$('dk-size').max!==D.rps.length-1) drawDock(); DR.prep=drillPrep(); DR.dec={}; DR.log=[]; DR.asked=null; DR.best=null; $('inject').hidden=true; drillRun(); }
let drT=null;
function drillRun(){ if(!DR.prep){ DR.run=null; drawDrill(); return; } const o=drillOpts(); DR.run=simulate(o); DR.range=rangeOf(o);
  DR.base=simulate(drillOpts({},{comply:DR0.comply/100,capX:DR0.capX/100,rate:DR0.rescue,lead:DR0.lead,mob:DR0.mob,delay:DR0.delay,v:DR0.speed*60}));
  clearTimeout(drT); drT=setTimeout(()=>{ DR.best=bestPlan(); drawDrill(); },250); drawDrill(); if(ready) render(); }
// every combination of the decisions; best = fewest people unsafe at the peak, then fewest actions
function bestPlan(){ if(!DR.prep) return null; let best=null;
  for(const early of EXTRA_LEAD) for(const order of ['plan','door','tall','near']) for(const full of ['redirect','open','pack']) for(const cut of ['go','up']) for(const help of ['local','nat']){
    const dec={early,order,full,fullAt:-Infinity,cut,cutAt:-Infinity,help,helpAt:-Infinity},run=simulate(drillOpts(dec)),n=(early>0)+(order!=='plan')+(full!=='redirect')+(cut==='up')+(help==='nat');
    if(!best||run.score<best.run.score-.5||(Math.abs(run.score-best.run.score)<=.5&&n<best.n)) best={dec,run,n}; }
  const def={early:0,order:'plan',full:'redirect',cut:'go',help:'local'};
  best.gain={}; for(const k in def) if(best.dec[k]!==def[k]) best.gain[k]=simulate(drillOpts({...best.dec,[k]:def[k]})).score-best.run.score;
  best.range=rangeOf(drillOpts(best.dec)); return best; }

/* ---------- action sequence for the debrief and the decision card ---------- */
function actionPlan(b=DR.best){ if(!b) return []; const R=b.run,d=b.dec,g=k=>b.gain[k]>.5?` <span class="gain">−${fmt(b.gain[k])} unsafe</span>`:'',out=[],pr=DR.prep;
  const tall=Math.round(pr.groups.reduce((s,x)=>s+x.pop*x.up,0)),f=d.order==='tall'?R.f:1,stay=pr.groups.reduce((s,x)=>s+x.pop*R.comply*x.up*(1-f),0);
  if(d.full==='open') out.push([-Infinity,`<b>Before the season</b>: agree with ${extraShelters().map(x=>esc(x.name)).join(', ')} to open as extra shelters (+${fmt(extraShelters().reduce((s,x)=>s+x.cap,0))} places).${g('full')}`]);
  if(d.early) out.push([R.W,`<b>Be ready to warn ${d.early/60} h earlier</b> (${SC.leadMin+d.early} min before the water): forecast watch + a pre-agreed trigger (EFAS / IRM-KMI warnings).${g('early')}`]);
  const toGo=pr.groups.reduce((s,x)=>s+x.pop*(1-x.up*(1-f)),0);
  if(d.order==='tall') out.push([R.W,`<b>Tell about ${fmt(stay)} residents whose building has a floor above the water to go upstairs and stay</b>: the ${fmt(R.sh.reduce((s,x)=>s+x.cap,0))} shelter places go first to people without a safe floor.${g('order')}`]);
  out.push([R.W,`<b>Order the evacuation</b> of ${fmt(toGo)} residents${d.order==='tall'?' (all homes without a safe upper floor, then as many others as places allow)':''}, wave 1 (low ground, upstream) first, each street told <b>which shelter</b> to use (SMS, BE-Alert, loudspeakers)${d.order==='door'?' and <b>door-to-door</b> teams for people who do not react':''}.${d.order==='tall'?'':g('order')}`]);
  if(d.cut==='up') out.push([R.W,`<b>Tell people who cannot reach a shelter before the water to go upstairs</b> and wait (about ${fmt(tall)} residents live in buildings with a floor above the water).${g('cut')}`]);
  if(d.full==='pack') out.push([R.firstFull,`<b>When a shelter is full</b>: open corridors and halls (+30% emergency places) instead of sending people back out.${g('full')}`]);
  if(d.full==='redirect'&&isFinite(R.firstFull)) out.push([R.firstFull,`<b>When a shelter is full</b>: send arrivals to the closest shelter with room (staff at the door with the live count).`]);
  if(R.firstDanger!=null) out.push([R.firstDanger,`<b>Rescue teams</b> to people trapped in flooded homes or streets, single-storey homes and flooded streets first${d.help==='nat'?'; <b>ask for national support</b> (civil protection, army) now':''}.${g('help')}`]);
  out.push([R.peakT,`<b>At the peak</b>: ${fmt(R.peak.shel)} in shelters, ${fmt(R.peak.up)} upstairs at home (check on them), ${fmt(R.score)} still unsafe.`]);
  return out.sort((a,b)=>a[0]-b[0]); }

/* ---------- training: pause at key moments and ask ---------- */
const INJ={
  order:{t:r=>r.W,title:'Time to warn',txt:r=>`Water will reach the first homes at ${clockM(DR.prep.first)}. ${fmt(DR.prep.groups.reduce((s,g)=>s+g.pop,0))} residents live where the water will come. What do you do?`,
    opts:[['plan','Order evacuation: each street gets its shelter'],['tall','Shelter places first for homes without a safe upper floor; others go upstairs'],['door','Same + door-to-door teams (+10% leave)'],['near','Order evacuation, people pick the nearest shelter'],['wait','Wait 1 hour for a better forecast']]},
  full:{t:r=>r.firstFull,title:'A shelter is full',txt:r=>{const s=r.sh.find(x=>x.full===r.firstFull); return `${esc(s?.name||'A shelter')} is full (${fmt(s?.cap||0)} places). People are still arriving.`;},
    opts:[['redirect','Send them to the next shelter with room'],['open','Open extra buildings as shelters now'],['pack','Squeeze in: corridors and halls (+30%)']]},
  cut:{t:r=>r.firstStuck,title:'Water on the escape routes',txt:r=>`People are getting stuck in flooded streets (${clockM(r.firstStuck)}). Others are still leaving.`,
    opts:[['go','Keep evacuating everyone'],['up','Tell those not yet out to go upstairs and wait']]},
  help:{t:r=>r.firstDanger,title:'People in danger',txt:r=>`${fmt(countAt(r,r.firstDanger+60).danger)} people will be trapped within the hour. Local teams rescue about ${DR.rescue} people per hour.`,
    opts:[['local','Manage with local teams'],['nat',`Request national support (×${SUPPORT_X} rescue)`]]}};
function drillTick(){ const R=DR.run; syncDock(); drawHud(); drawPins(); if(!R||!DR.train||!S.playing) return; const t=S.T*R.M;
  for(const k in INJ){ if(DR.dec[k]!=null) continue; const at=INJ[k].t(R); if(at!=null&&isFinite(at)&&t>=Math.max(0,at)){ askInject(k,at); return; } } }
function askInject(k,at){ setPlaying(false); const I=INJ[k],b=$('inject'); DR.asked=k;
  b.innerHTML=`<div class="ih"><span class="tag warn">Decision · ${clockM(at)}</span><b>${I.title}</b></div><p>${I.txt(DR.run)}</p>
    <div class="iopts">${I.opts.map(([v,t],i)=>`<button class="btn${i?'':' primary'}" data-v="${v}">${t}</button>`).join('')}</div>`;
  b.hidden=false; b.querySelector('button').focus();
  b.onclick=e=>{ const v=e.target.closest('[data-v]')?.dataset.v; if(!v) return; DR.dec[k]=v; DR.dec[k+'At']=at; if(k==='order'&&v==='wait') DR.dec.orderAt=at+60;
    DR.log.push([at,`${I.title}: ${I.opts.find(o=>o[0]===v)[1]}`]); b.hidden=true; DR.asked=null; drillRun(); setPlaying(true); }; }
// a decision taken at time t only changes what happens after t, so re-running from the start keeps the past identical
// (exception "wait": the order itself moves one hour later; the question is then not asked again)

/* ---------- on screen: live counts, shelter fill, walkers ---------- */
function drawHud(){ const h=$('hud'),R=DR.run; if(!R){ h.hidden=true; return; } const k=countAt(R,S.T*R.M),used=R.sh.reduce((s,x)=>s+Math.min(x.load,x.cap),0);
  const room=R.sh.filter(x=>x.from<=S.T*R.M).reduce((s,x)=>s+x.cap,0),lo=v=>`<b data-src="drill">${fmt(v)}</b>`;
  h.innerHTML=[['home','At home, dry',k.home],['walk','On the way',k.walk],['shel',`In shelters (${fmt(room)} places)`,k.shel],['up','Upstairs at home',k.up],['danger','In danger',k.danger],['noplace','No shelter place',k.noplace],['resc','Rescued',k.resc]]
    .map(([c,t,v])=>`<span class="hi ${c}${v>=1&&(c==='danger'||c==='noplace')?' bad':''}">${lo(v)}<i>${t}</i></span>`).join(''); h.hidden=false; }
function drawPins(){ const R=DR.run; if(!R) return; const t=S.T*R.M;
  markers.forEach((m,k)=>{ const s=R.sh[k]; if(!s) return; let ld=0; for(const [tt,l] of s.tl){ if(tt>t) break; ld=l; } const el=m.getElement(),pc=s.cap?Math.min(1,ld/s.cap):0;
    el.style.setProperty('--fill',Math.round(pc*100)+'%'); el.classList.toggle('full',pc>=.999); el.title=`${s.name}: ${fmtFull(ld)} of ${fmtFull(s.cap)} places taken`; }); }
function drillWalkers(){ const R=DR.run,t=S.T*R.M,f=[];
  for(const c of R.co){ const s=segAt(c,t); let p=null; if(s[1]==='walk') p=along(s[2],Math.min(s[2].len,(t-s[3])*s[4])); else if(s[1]==='stuck'||s[1]==='noplace') p=s[2]; if(!p) continue;
    f.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{wave:c.g.wave,st:s[1]}}); }
  map.getSource('walkers').setData({type:'FeatureCollection',features:f}); }

/* ---------- panel: scoreboard (starting point / your settings / best plan) + debrief ---------- */
function drawDrill(){ const box=$('drillOut'); if(!box) return; const R=DR.run,B=DR.best,b0=DR.base;
  if(!R){ box.innerHTML='<p class="hint">No evacuation plan yet: shelters and routes are needed (Evacuate tab).</p>'; return; }
  const row=(t,f,src)=>`<tr><td>${t}</td>${[b0,R,B?.run].map(x=>`<td class="mono" data-src="${src}">${x?fmt(f(x)):'…'}</td>`).join('')}</tr>`;
  box.innerHTML=`<table class="tbl score"><thead><tr><th></th><th>Starting point</th><th>Your settings</th><th>Best plan</th></tr></thead><tbody>
    ${row('<b>Unsafe at the peak</b>',x=>x.score,'drill')}${row('in danger (trapped, stuck)',x=>x.peak.danger,'drill')}${row('no shelter place',x=>x.peak.noplace,'drill')}${row('in shelters',x=>x.peak.shel,'drill')}${row('upstairs at home',x=>x.peak.up,'obat')}${row('rescued',x=>x.peak.resc,'rescue')}
    <tr><td class="hint">likely range</td><td></td><td class="mono hint">${fmt(DR.range[0])}–${fmt(DR.range[1])}</td><td class="mono hint">${B?`${fmt(B.range[0])}–${fmt(B.range[1])}`:''}</td></tr></tbody></table>
    <p class="hint">At the peak = clock ${clockM(R.peakT)}. Range: people react faster/slower (follow rate ±, walking speed ±20%, getting ready ×0.75–1.5).</p>
    <div class="row" style="justify-content:flex-start"><button class="btn primary sm" id="drDebrief">Best sequence of actions</button><button class="btn sm" id="drBest" ${B?'':'disabled'}>Replay with best plan</button></div>
    ${DR.log.length?`<h3 class="h3">Your decisions</h3><ol class="dlog">${DR.log.map(([t,x])=>`<li><span class="mono">${clockM(t)}</span> ${esc(x)}</li>`).join('')}</ol>`:''}`;
  $('drDebrief').onclick=showDebrief; $('drBest').onclick=()=>{ if(!B) return; DR.dec={...B.dec}; DR.log=[[0,'Best plan loaded']]; drillRun(); S.T=0; render(); setPlaying(true); }; }
function showDebrief(){ const B=DR.best,R=DR.run,st=$('drillStage'); if(!B||!R){ toast('Still computing the best plan…'); return; } setPlaying(false);
  $('drillBody').innerHTML=`<div class="stats"><div class="stat${R.score>B.run.score+.5?' warn':''}"><b data-src="drill">${fmt(R.score)}</b><span>unsafe at the peak with your decisions (range ${fmt(DR.range[0])}–${fmt(DR.range[1])})</span></div>
    <div class="stat"><b data-src="drill">${fmt(B.run.score)}</b><span>with the best sequence below (range ${fmt(B.range[0])}–${fmt(B.range[1])})</span></div>
    <div class="stat"><b>${fmt(Math.max(0,R.score-B.run.score))}</b><span>more people safe by following it</span></div></div>
    <h3 class="h3">Best sequence of actions</h3><ol class="steps">${actionPlan(B).map(([t,x])=>`<li><span class="mono">${isFinite(t)?clockM(t):'Before'}</span><span>${x}</span></li>`).join('')}</ol>
    ${DR.log.length?`<h3 class="h3">What you decided</h3><ol class="dlog">${DR.log.map(([t,x])=>`<li><span class="mono">${clockM(t)}</span> ${esc(x)}</li>`).join('')}</ol>`:''}
    <p class="hint">"Unsafe" = trapped in a flooded home without a floor above the water, stuck in a flooded street, or without a shelter place, when the water is highest. Tested: ${3*4*3*2*2} combinations of decisions on the same flood. "Upstairs at home" is not risk-free: buildings can be damaged, and people may be cut off without power or water, so they must be checked on. Model with assumptions (follow rate, speeds, capacities, rescue rate); the water timing is illustrative. A training aid, not a prediction of deaths.</p>`;
  st.hidden=false; $('drillClose').focus(); }

/* ---------- controls in front of the map (dock) ---------- */
const DOCK=[['size','Flood size',0,2,1,()=>S.sizeIdx,v=>{$('size').value=v; $('size').oninput({target:$('size')});},v=>sizeWord(D.rps[v])+` (1-in-${D.rps[v]})`],
  ['rain','Rain',1,150,1,()=>SC.rain,v=>{SC.rain=v; drawScenarioInfo();},v=>v+' mm/h'],
  ['dur','Rain lasts',1,48,1,()=>SC.dur/60,v=>{SC.dur=v*60; drawScenarioInfo();},v=>v+' h'],
  ['lead','Warning before water',0,720,15,()=>SC.leadMin,v=>{SC.leadMin=v; $('sc-leadMin').value=v; alerted=warned=null; makePlan();},v=>`${Math.floor(v/60)} h ${v%60?String(v%60).padStart(2,'0'):''}`],
  ['comply','People who follow the order',30,100,5,()=>DR.comply,v=>{DR.comply=v; drillRun();},v=>v+'%'],
  ['cap','Shelter places',50,300,10,()=>DR.capX,v=>{DR.capX=v; drillRun();},v=>v+'% of planned'],
  ['walk','Walking speed',.5,1.6,.1,()=>E.speed/3.6,v=>{E.speed=v*3.6; $('evSpeedMs').value=v; makePlan();},v=>v.toFixed(1)+' m/s'],
  ['resc','Rescue capacity',0,500,10,()=>DR.rescue,v=>{DR.rescue=v; drillRun();},v=>v+' people/h']];
function drawDock(){ $('dockIn').innerHTML=DOCK.map(([k,t,mi,ma,st,get,,lab])=>{ const v=get(),mx=k==='size'?D.rps.length-1:ma;
  return `<label class="dk"><span>${t}</span><b class="mono" id="dkv-${k}">${lab(v)}</b><input type="range" id="dk-${k}" min="${mi}" max="${mx}" step="${st}" value="${v}" aria-label="${t}"></label>`; }).join('')
  +`<button class="btn sm primary" id="dkBuild" title="Turn this rain into a flood (compared with 37 years of rain records)">Build flood from rain</button>`; }
let dkT={};
$('dockIn').oninput=e=>{ const k=e.target.id?.slice(3),d=DOCK.find(x=>x[0]===k); if(!d) return; const v=+e.target.value; $('dkv-'+k).textContent=d[7](v);
  clearTimeout(dkT[k]); dkT[k]=setTimeout(()=>d[6](v),k==='size'?0:200); };
$('dockIn').onclick=e=>{ if(e.target.id==='dkBuild') buildScenario(); };
$('dockHide').onclick=()=>{ const on=$('dock').classList.toggle('min'); $('dockHide').textContent=on?'Show controls':'Hide'; $('dockHide').setAttribute('aria-expanded',!on); };
function syncDock(){ if(!$('dk-size')) return; DOCK.forEach(([k,,,,,get,,lab])=>{ const el=$('dk-'+k); if(el&&document.activeElement!==el&&+el.value!==get()){ el.value=get(); $('dkv-'+k).textContent=lab(get()); } }); }

/* ---------- training on/off, restart, end of the run ---------- */
$('trainBtn').onclick=()=>{ DR.train=!DR.train; $('trainBtn').setAttribute('aria-pressed',DR.train); DR.dec={}; DR.log=[]; drillRun(); evacVisibility(); $('inject').hidden=true;
  if(DR.train){ S.T=0; render(); toast('Training: the run stops when you must decide'); setPlaying(true); } };
$('debriefBtn').onclick=showDebrief; $('drillClose').onclick=()=>{$('drillStage').hidden=true;};
$('drillCard').onclick=()=>openCard();
const _restart=$('restart').onclick; $('restart').onclick=()=>{ if(DR.train){ DR.dec={}; DR.log=[]; drillRun(); $('inject').hidden=true; } _restart(); };
let endShown=false; FX.push(()=>{ if(!DR.run) return; if(S.T>=1&&!S.playing&&DR.train&&!endShown){ endShown=true; showDebrief(); } if(S.T<1) endShown=false; });
