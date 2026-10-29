// drill.js - Evacuation over the event clock: people leave by car, shelters fill up, the next best shelter is searched automatically,
// streets close as the water rises, people are caught at home. Choices are made before pressing play; "Best actions" tests every
// combination and shows the sequence that leaves the fewest people unsafe. Deterministic: same inputs give the same result.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).
//
// Model (a scenario built on assumptions, not a prediction):
//  - warning at (water reaches the homes − warning lead time); people who follow the order leave spread evenly over 2 × "time to get ready"
//  - they drive their route (OpenStreetMap streets) at the driving speed + delay; a street point closes once the water there reaches the
//    car limit (same water rise as the video): a car reaching it later is stuck
//  - shelters: chosen by the app (distance from the flood, height above it, capacity from floor area, people at risk nearby, dry road access).
//    Full on arrival: the car drives on to the closest shelter with room by road, among the chosen ones and the next best candidates; else "no place"
//  - people still home when the water arrives: upstairs if their building (GHS-OBAT height) is ≥ water + one floor (3 m), else trapped
//  - rescue teams take people out of danger at a fixed rate (people per hour) once mobilised (30 min after the first person is in danger)

const DR={comply:80,capX:100,rescue:60,dec:{order:'plan',full:'redirect',help:'local'},run:null,prep:null,best:null,sel:null,mk:[]};
const STOREY=3,NC=6,RESCUE_MOB=30,SUPPORT_X=3,EXTRA_LEAD=[0,60,120];
const DR0={comply:80,capX:100,rescue:60,lead:180,mob:60,delay:15,speed:30}; // starting point for the scoreboard (defaults of the app)
const clockM=m=>m<0?`${clock(-m/SC.mins)} before start`:clock(m/SC.mins);

/* ---------- inputs that depend on the plan and the water (rebuilt when either changes) ---------- */
function drillPrep(){ const P=E.plan; if(!P?.groups.length||!E.shelters.length) return null; const r=P.r,M=SC.mins,F=CAR_DEPTH,G=D.G,B=Math.max(1,Math.round(400/G.m));
  // minute when the water at a cell first reaches F (inverse of nowDepth's rise, same curve as floodStart)
  const cutT=c=>{const d=c.depth[r]; if(!(d>F)) return Infinity; const v=1-(d-F)/c.L[r]; if(INIT/(c.L[r]||1)>=v) return 0; return (c.lag+.45*Math.acos(1-2*v)/Math.PI)*M;};
  // closing time along a route: drawn water (same as the map) and grid cells, every 15 m
  const cellsOf=l=>{ if(l.cells) return l.cells; const out=[],seen=new Set(); for(let s=0;s<=l.len;s+=15){const p=along(l,s),i=G.at(p[0],p[1]),q=pixAt(p); if(seen.has(q+':'+i)) continue; seen.add(q+':'+i);
    const t=Math.min(i<0?Infinity:cutT(D.cells[i]),pixCut(q,r,F,M)); if(isFinite(t)) out.push([s,t]);} return l.cells=out; };
  const key=c=>Math.floor(c.gx/B)+':'+Math.floor(c.gy/B),up=new Map(); // share of residents whose building keeps a floor above the water (GHS-OBAT height)
  for(const b of D.blds){ if(b.ci<0) continue; const c=D.cells[b.ci],d=c.depth[r]; if(!(d>.01)) continue; const k=key(c),w=b.pop||1,u=up.get(k)||up.set(k,{a:0,n:0}).get(k); u.n+=w; if(b.h>=d+STOREY) u.a+=w; }
  // when the water reaches the homes of a group: the residents' median moment (the group's first wet cell is often the riverbed)
  const tw=new Map(); for(const c of D.cells){ if(!c.pop||!(c.depth[r]>.01)) continue; (tw.get(key(c))||tw.set(key(c),[]).get(key(c))).push([floodStart(c,r),c.pop]); }
  const midT=k=>{ const a=(tw.get(k)||[]).sort((x,y)=>x[0]-y[0]),h=a.reduce((s,x)=>s+x[1],0)/2; let s=0; for(const [t,p] of a){ s+=p; if(s>=h) return t; } return null; };
  const groups=P.groups.map((g,gi)=>{ const u=up.get(g.key),tm=midT(g.key),legs=P.routes.filter(x=>x.gi===gi).map(x=>(cellsOf(x),{n:x.people,l:x,k:x.k}));
    if(g.near) cellsOf(g.near); if(g.left>0&&g.near) legs.push({n:g.left,l:g.near,k:g.near.k});
    return {pop:g.pop,c:g.c,key:g.key,wave:g.wave,ts:(tm??g.ts)*M,dmax:g.dmax,up:u?.n?u.a/u.n:0,legs,near:g.near?[{n:g.pop,l:g.near,k:g.near.k}]:[],
      main:legs.length?legs.reduce((a,b)=>b.n>a.n?b:a).k:g.near?.k??-1}; });
  // area each shelter serves: the populated flooded cells of the groups sent to it (shown when a shelter is clicked)
  const gk=new Map(groups.map(g=>[g.key,g.main])),catchFC={type:'FeatureCollection',features:D.cells.filter(c=>c.pop&&c.depth[r]>.01&&gk.has(key(c)))
    .map(c=>({type:'Feature',geometry:{type:'Polygon',coordinates:c.poly},properties:{k:gk.get(key(c))}}))};
  return {groups,first:Math.min(...groups.map(g=>g.ts)),M,catchFC,rt:new Map(),rb:new Map()}; }

// next best shelters after the chosen ones: all ranked candidates for an overnight stay with dry road access (places from floor area)
function extraShelters(){ const inPlan=new Set(E.shelters.map(s=>s.src)); return (E.cands||[]).filter(c=>!inPlan.has(c)&&c.stay==='overnight'&&c.access!==false)
  .map(c=>({c:c.c,cap:c.cap||E.cap,name:c.name||kindName(c.kind),kind:c.kind,score:c.score})); }
// road route between two shelters (one Dijkstra per full shelter, kept for the whole plan)
function roadBetween(a,b){ const pk=a.join()+'>'+b.join(); if(DR.prep.rb.has(pk)) return DR.prep.rb.get(pk); const l=roadPath(a,b); DR.prep.rb.set(pk,l); return l; }
function roadPath(a,b){ const P=E.plan,g=P?.g; if(!g) return prepLine([a,b]); const k=a.join(); let t=DR.prep.rt.get(k);
  if(!t){ const s=nearest(g,a); if(s<0) return null; t=dijkstra(g,s); DR.prep.rt.set(k,t); } const j=nearest(g,b); if(j<0||!isFinite(t.dist[j])) return null;
  const pts=[]; for(let u=j;u>=0;u=t.prev[u]) pts.push(g.pts[u]); return prepLine([a,...pts.reverse(),b]); }

/* ---------- choices → model options ---------- */
function drillOpts(dec=DR.dec,a={}){ const o={lead:SC.leadMin,comply:DR.comply/100,capX:DR.capX/100,mob:FW.mob,delay:FW.delay,v:E.speed*1000/60,rate:DR.rescue,...a};
  return {...o,guide:dec.order==='near'?'near':'plan',door:dec.order==='door',tall:dec.order==='tall',lead:o.lead+(dec.early||0),full:dec.full||'redirect',support:dec.help==='nat'}; }

/* ---------- one run: cohorts of people with a timeline of states ---------- */
function simulate(o){ const pr=DR.prep; if(!pr) return null; const M=pr.M,W=pr.first-o.lead,comply=Math.min(1,o.comply+(o.door?.1:0));
  const sh=[...E.shelters.map((s,k)=>({c:s.c,name:s.name,cap:capOf(k)*o.capX})),...extraShelters().map(x=>({...x,cap:x.cap*o.capX,extra:true}))].map(s=>({...s,load:0,full:null,tl:[]}));
  // "tall": shelter places go first to people without a safe upper floor; the share f of the others that still fits leaves too, the rest stays upstairs
  const C=sh.reduce((a,x)=>a+x.cap,0),need=pr.groups.reduce((a,g)=>a+g.pop*comply*(1-g.up),0),upN=pr.groups.reduce((a,g)=>a+g.pop*comply*g.up,0),f=o.tall?Math.max(0,Math.min(1,(C-need)/(upN||1))):1;
  const capAt=s=>s.cap*(o.full==='pack'?1.3:1),co=[],arr=[],danger=[];
  const wet=(c,t)=>{c.segs.push([t,'wet']); danger.push([t,c.n*(1-(c.up??c.g.up))]);};
  for(const g of pr.groups){
    if(comply<1){ const c={n:g.pop*(1-comply),g,segs:[[-Infinity,'home']]}; wet(c,g.ts); co.push(c); } // did not follow the order
    if(o.tall&&g.up*(1-f)>0){ const c={n:g.pop*comply*g.up*(1-f),g,up:1,segs:[[-Infinity,'home']]}; wet(c,g.ts); co.push(c); } // told to stay upstairs
    const go=1-g.up*(1-f);
    for(const L of o.guide==='near'?g.near:g.legs) for(let j=0;j<NC;j++){ const n=L.n*comply*go/NC,dep=W+o.mob*2*(j+.5)/NC,c={n,g,segs:[[-Infinity,'home']]}; co.push(c);
      if(dep>=g.ts){ c.segs.push([g.ts,'stuck',g.c]); danger.push([g.ts,n]); continue; } // water already at the door when they try to leave
      const v=L.l.len/Math.max(1,L.l.len/o.v+o.delay); let stuck=null;
      for(const [s,t] of L.l.cells) if(dep+s/v>=t){ stuck=[dep+s/v,s]; break; }
      c.segs.push([dep,'walk',L.l,dep,v]);
      if(stuck){ c.segs.push([stuck[0],'stuck',along(L.l,stuck[1])]); danger.push([stuck[0],n]); } else arr.push({t:dep+L.l.len/v,c,k:L.k}); }
  }
  arr.sort((a,b)=>a.t-b.t);
  while(arr.length){ const a=arr.shift(),s=sh[a.k],inN=Math.min(Math.max(0,capAt(s)-s.load),a.c.n),rest=a.c.n-inN;
    if(inN>0){ s.load+=inN; s.tl.push([a.t,s.load]); }
    const done=rest<=1e-6?a.c:{...a.c,n:rest,segs:[...a.c.segs]}; if(rest>1e-6){ a.c.n=inN; co.push(done); s.full??=a.t; }
    if(inN>0) a.c.segs.push([a.t,'shel',a.k]); if(rest<=1e-6) continue;
    // full: drive on to the closest shelter with room (straight-line shortlist of 4, then by road)
    const near=sh.map((x,i)=>[i,mDist(s.c,x.c)]).filter(([i])=>i!==a.k&&capAt(sh[i])-sh[i].load>0).sort((x,y)=>x[1]-y[1]).slice(0,4);
    let best=null; for(const [i] of near){ const l=roadBetween(s.c,sh[i].c); if(l&&(!best||l.len<best.l.len)) best={i,l}; }
    if(!best){ done.segs.push([a.t,'noplace',s.c]); continue; }
    const t2=a.t+best.l.len/o.v; done.segs.push([a.t,'walk',best.l,a.t,o.v]);
    const at={t:t2,c:done,k:best.i},i=arr.findIndex(x=>x.t>t2); i<0?arr.push(at):arr.splice(i,0,at); }
  // rescue: queue served at a rate (people/h); national support multiplies it
  danger.sort((a,b)=>a[0]-b[0]); const t0=(danger[0]?.[0]??Infinity)+RESCUE_MOB,step=5,R=[];
  let A=0,i=0,q=0; const tStart=Math.min(0,W); for(let t=tStart;t<=M;t+=step){ while(i<danger.length&&danger[i][0]<=t) A+=danger[i++][1];
    const rate=t<t0?0:o.rate*(o.support?SUPPORT_X:1); q=Math.min(A,q+rate*step/60); R.push(q); }
  const run={o,W,f,comply,sh,co,R,tStart,step,M,firstDanger:danger[0]?.[0]??null,peakT:.6*M,firstFull:Math.min(...sh.map(s=>s.full??Infinity))};
  run.peak=countAt(run,run.peakT); run.score=run.peak.danger+run.peak.noplace; return run; }
const segAt=(c,t)=>{let s=c.segs[0]; for(const x of c.segs){ if(x[0]>t) break; s=x; } return s;};
function countAt(run,t){ const k={home:0,walk:0,shel:0,up:0,trap:0,stuck:0,noplace:0};
  for(const c of run.co){ const s=segAt(c,t); if(s[1]==='wet'){ const u=c.up??c.g.up; k.up+=c.n*u; k.trap+=c.n*(1-u); } else k[s[1]==='shel'?'shel':s[1]]+=c.n; }
  const resc=run.R[Math.max(0,Math.min(run.R.length-1,Math.floor((t-run.tStart)/run.step)))]||0,dg=k.trap+k.stuck,f=dg>0?Math.max(0,1-resc/dg):1;
  k.resc=Math.min(dg,resc); k.trap*=f; k.stuck*=f; k.danger=k.trap+k.stuck; return k; }

/* ---------- runs: yours (with low/high range), starting point, best ---------- */
const rangeOf=o=>[simulate(o),simulate({...o,comply:Math.min(1,o.comply+.1),v:o.v*1.2,mob:o.mob*.75}),simulate({...o,comply:Math.max(0,o.comply-.15),v:o.v*.8,mob:o.mob*1.5})].map(x=>x?.score??0).sort((a,b)=>a-b).filter((x,i)=>i!==1);
function drillReset(){ if(!$('dk-size')||+$('dk-size').max!==D.rps.length-1) drawDock(); DR.prep=drillPrep(); DR.best=null; DR.sel=null; drillRun();
  if(ready&&DR.prep){ map.getSource('catch')?.setData(DR.prep.catchFC); selectShelter(null); } }
let drT=null;
function drillRun(){ if(!DR.prep){ DR.run=null; drawDrill(); return; } const o=drillOpts(); DR.run=simulate(o); DR.range=rangeOf(o);
  DR.base=simulate(drillOpts({},{comply:DR0.comply/100,capX:DR0.capX/100,rate:DR0.rescue,lead:DR0.lead,mob:DR0.mob,delay:DR0.delay,v:DR0.speed*1000/60}));
  clearTimeout(drT); drT=setTimeout(()=>{ DR.best=bestPlan(); drawDrill(); },250); drawDrill(); extraPins(); if(ready) render(); }
// every combination of the choices; best = fewest people unsafe at the peak, then fewest changes
function bestPlan(){ if(!DR.prep) return null; let best=null;
  for(const early of EXTRA_LEAD) for(const order of ['plan','door','tall','near']) for(const full of ['redirect','pack']) for(const help of ['local','nat']){
    const dec={early,order,full,help},run=simulate(drillOpts(dec)),n=(early>0)+(order!=='plan')+(full!=='redirect')+(help==='nat');
    if(!best||run.score<best.run.score-.5||(Math.abs(run.score-best.run.score)<=.5&&n<best.n)) best={dec,run,n}; }
  const def={early:0,order:'plan',full:'redirect',help:'local'};
  best.gain={}; for(const k in def) if(best.dec[k]!==def[k]) best.gain[k]=simulate(drillOpts({...best.dec,[k]:def[k]})).score-best.run.score;
  best.range=rangeOf(drillOpts(best.dec)); return best; }

/* ---------- action sequence for "Best actions" and the decision card ---------- */
function actionPlan(b=DR.best){ if(!b) return []; const R=b.run,d=b.dec,g=k=>b.gain[k]>.5?` <span class="gain">−${fmt(b.gain[k])} unsafe</span>`:'',out=[],pr=DR.prep;
  const f=d.order==='tall'?R.f:1,stay=pr.groups.reduce((s,x)=>s+x.pop*R.comply*x.up*(1-f),0),used=R.sh.filter(s=>s.extra&&s.load>0);
  if(used.length) out.push([-Infinity,`<b>Before the season</b>: agree with the next best sites (${used.slice(0,4).map(x=>esc(x.name)).join(', ')}${used.length>4?'…':''}) that they open when the first shelters are full (+${fmt(used.reduce((s,x)=>s+x.cap,0))} places).`]);
  if(d.early) out.push([R.W,`<b>Be ready to warn ${d.early/60} h earlier</b> (${SC.leadMin+d.early} min before the water): forecast watch + a pre-agreed trigger (EFAS / IRM-KMI warnings).${g('early')}`]);
  const toGo=pr.groups.reduce((s,x)=>s+x.pop*(1-x.up*(1-f)),0);
  if(d.order==='tall') out.push([R.W,`<b>Tell about ${fmt(stay)} residents whose building has a floor above the water to go upstairs and stay</b>: shelter places go first to people without a safe floor.${g('order')}`]);
  out.push([R.W,`<b>Order the evacuation</b> of ${fmt(toGo)} residents, wave 1 (low ground, upstream) first, each street told <b>which shelter</b> to drive to (SMS, BE-Alert, loudspeakers)${d.order==='door'?' and <b>door-to-door</b> teams for people who do not react':''}.${d.order==='tall'?'':g('order')}`]);
  if(isFinite(R.firstFull)) out.push([R.firstFull,d.full==='pack'?`<b>When a shelter is full</b>: open corridors and halls (+30% emergency places).${g('full')}`:`<b>When a shelter is full</b>: send cars on to the next shelter with room (staff at the door with the live count).`]);
  if(R.firstDanger!=null) out.push([R.firstDanger,`<b>Rescue teams</b> to people trapped in flooded homes or streets, single-storey homes first${d.help==='nat'?'; <b>ask for national support</b> (civil protection, army)':''}.${g('help')}`]);
  out.push([R.peakT,`<b>At the peak</b>: ${fmt(R.peak.shel)} in shelters, ${fmt(R.peak.up)} upstairs at home (check on them), ${fmt(R.score)} still unsafe.`]);
  return out.sort((a,b)=>a[0]-b[0]); }

/* ---------- on screen: live counts, shelter fill, cars ---------- */
const SVGI=p=>`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const HUDI={home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',walk:'<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  shel:'<path d="M12 3l9 5v13H3V8z"/><path d="M12 10v6M9 13h6"/>',up:'<path d="M4 20h4v-4h4v-4h4V8h4"/>',danger:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  noplace:'<circle cx="12" cy="12" r="9"/><path d="M7 7l10 10"/>',resc:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6"/>'};
const HUDT={home:'At home, water not there yet',walk:'Driving to a shelter',shel:'In a shelter / places available',up:'Water at home, building has a floor above it',danger:'Trapped without a safe floor, or stuck in a flooded street',noplace:'Reached a full shelter, no room in the area',resc:'Taken out by rescue teams'};
function drillTick(){ syncDock(); drawHud(); drawPins(); }
function drawHud(){ const h=$('hud'),R=DR.run; if(!R){ h.hidden=true; return; } const t=S.T*R.M,k=countAt(R,t),room=R.sh.filter(x=>!x.extra||x.load>0).reduce((s,x)=>s+x.cap,0);
  h.innerHTML=[['home','home',k.home],['walk','driving',k.walk],['shel',`sheltered /${fmt(room)}`,k.shel],['up','upstairs',k.up],['danger','danger',k.danger],['noplace','no place',k.noplace],['resc','rescued',k.resc]]
    .map(([c,t,v])=>`<span title="${HUDT[c]}" class="hi ${c}${v>=1&&(c==='danger'||c==='noplace')?' bad':''}">${SVGI(HUDI[c])}<b data-src="drill">${fmt(v)}</b><i>${t}</i></span>`).join(''); h.hidden=false; }
const loadAt=(s,t)=>{ let ld=0; for(const [tt,l] of s.tl){ if(tt>t) break; ld=l; } return ld; };
function drawPins(){ const R=DR.run; if(!R) return; const t=S.T*R.M,n=E.shelters.length;
  [...markers.map((m,k)=>[m,R.sh[k]]),...DR.mk.map(([m,i])=>[m,R.sh[i]])].forEach(([m,s])=>{ if(!s) return; const ld=loadAt(s,t),el=m.getElement(),pc=s.cap?Math.min(1,ld/(s.cap*(R.o.full==='pack'?1.3:1))):0;
    el.style.setProperty('--fill',Math.round(pc*100)+'%'); el.classList.toggle('full',pc>=.999); el.title=`${s.name}: ${fmtFull(ld)} of ${fmtFull(s.cap)} places taken`; }); }
// pins for the next best shelters the run actually used
function extraPins(){ DR.mk.forEach(([m])=>m.remove()); DR.mk=[]; if(!ready||!DR.run) return;
  DR.run.sh.forEach((s,i)=>{ if(!s.extra||!s.load) return; const el=document.createElement('div'); el.className='pin extra'; el.innerHTML='<span>+</span>'; el.onclick=()=>selectShelter(i);
    DR.mk.push([new maplibregl.Marker({element:el,anchor:'bottom-left'}).setLngLat(s.c).addTo(map),i]); }); pinVis(); }
function pinVis(){ const on=S.tab==='safety'||S.tab==='sim'||S.tab==='coord'; [...markers,...DR.mk.map(x=>x[0])].forEach(m=>m.getElement().hidden=!on); }
function drillWalkers(){ const R=DR.run,t=S.T*R.M,f=[];
  for(const c of R.co){ if(c.n<1e-6) continue; const s=segAt(c,t); let p=null,b=0; if(s[1]==='walk'){ if((t-s[3])*s[4]>s[2].len) continue; const d=(t-s[3])*s[4],q=along(s[2],Math.min(s[2].len,d+8)); p=along(s[2],d);
      b=Math.atan2((q[0]-p[0])*KX(p[1]),(q[1]-p[1])*110540)*180/Math.PI; } else if(s[1]==='stuck'||s[1]==='noplace') p=s[2]; if(!p) continue;
    f.push({type:'Feature',geometry:S.l3d?carBox(p,b):{type:'Point',coordinates:p},properties:{wave:c.g.wave,st:s[1],b}}); }
  map.getSource(S.l3d?'cars3d':'walkers').setData({type:'FeatureCollection',features:f}); }
// 3D: a real-size car (4.5 × 1.9 m footprint, turned along the road), extruded 1.6 m
function carBox(p,b){ const a=b*Math.PI/180,kx=KX(p[1]),f=[Math.sin(a)*2.25,Math.cos(a)*2.25],s=[Math.cos(a)*.95,-Math.sin(a)*.95],pt=(i,j)=>[p[0]+(f[0]*i+s[0]*j)/kx,p[1]+(f[1]*i+s[1]*j)/110540];
  return {type:'Polygon',coordinates:[[pt(1,1),pt(1,-1),pt(-1,-1),pt(-1,1),pt(1,1)]]}; }
// car icon drawn once (signed-distance icon: one shape, coloured by status in the layer)
function carIcon(){ const W=40,H=22,cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d'); if(!x?.getImageData) return null;
  x.fillStyle='#000'; x.beginPath(); x.roundRect?.(3,1,W-6,H-2,6); x.fill(); x.globalCompositeOperation='destination-out'; x.fillRect(W-14,4,6,H-8); x.fillRect(8,4,5,H-8);
  const d=x.getImageData(0,0,W,H); return {width:W,height:H,data:new Uint8Array(d.data.buffer)}; }

/* ---------- shelter clicked: the area it serves + why it was chosen ---------- */
function addDrillLayers(){ map.addSource('catch',{type:'geojson',data:DR.prep?.catchFC||{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'catch-fill',type:'fill',source:'catch',filter:['==',['get','k'],-9],paint:{'fill-color':css('--accent'),'fill-opacity':.35}},'routes-case');
  map.addLayer({id:'catch-line',type:'line',source:'catch',filter:['==',['get','k'],-9],paint:{'line-color':css('--accent'),'line-width':1}},'routes-case');
  map.addSource('cars3d',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'cars-3d',type:'fill-extrusion',source:'cars3d',layout:{visibility:'none'},paint:{'fill-extrusion-color':walkCol(),'fill-extrusion-height':1.6,'fill-extrusion-opacity':.95}}); }
function selectShelter(k){ DR.sel=k; const card=$('shelCard'); if(!ready) return; const f=['==',['get','k'],k??-9];
  map.setFilter('catch-fill',f); map.setFilter('catch-line',f); map.setFilter('routes',k==null?null:f); map.setFilter('routes-case',k==null?null:f);
  if(k==null||!DR.run){ card.hidden=true; return; } const s=DR.run.sh[k],src=k<E.shelters.length?E.shelters[k].src:(E.cands||[]).find(c=>c.c===s.c),R=DR.run;
  const served=DR.prep.groups.filter(g=>g.main===k).reduce((a,g)=>a+g.pop,0),cars=R.co.filter(c=>c.segs.some(x=>x[1]==='shel'&&x[2]===k)).reduce((a,c)=>a+c.n,0);
  card.innerHTML=`<div class="ih">${SVGI(HUDI.shel)}<b>${esc(s.name)}</b><button class="x" aria-label="Close">✕</button></div>
    <div class="kv"><span>${fmtFull(s.cap)}</span><i>places${src?.capSrc?` (${esc(src.capSrc)})`:''}</i><span>${fmtFull(cars)}</span><i>people arrive in this run</i>
      <span>${fmt(served)}</span><i>residents in the blue area</i><span>${isFinite(s.full)&&s.full!=null?clockM(s.full):'never'}</span><i>full at</i></div>
    ${src?`<div class="chips">${chips(src)}</div>`:''}<p class="mini">${s.extra?'Next best site: used when the first shelters were full.':'Chosen by the app: far from the water, above it, room for many, people at risk nearby, dry road access.'}</p>`;
  card.hidden=false; card.querySelector('.x').onclick=()=>selectShelter(null); }

/* ---------- panel: scoreboard + best actions ---------- */
function drawDrill(){ const box=$('drillOut'); if(!box) return; const R=DR.run,B=DR.best,b0=DR.base;
  if(!R){ box.innerHTML='<p class="hint">No evacuation plan yet.</p>'; return; }
  const row=(t,f,src)=>`<tr><td>${t}</td>${[b0,R,B?.run].map(x=>`<td class="mono" data-src="${src}">${x?fmt(f(x)):'…'}</td>`).join('')}</tr>`;
  box.innerHTML=`<table class="tbl score"><thead><tr><th></th><th>Start</th><th>Yours</th><th>Best</th></tr></thead><tbody>
    ${row('<b>Unsafe at the peak</b>',x=>x.score,'drill')}${row('in danger',x=>x.peak.danger,'drill')}${row('no shelter place',x=>x.peak.noplace,'drill')}${row('in shelters',x=>x.peak.shel,'drill')}${row('upstairs at home',x=>x.peak.up,'obat')}${row('rescued',x=>x.peak.resc,'rescue')}
    <tr><td class="hint">likely range</td><td></td><td class="mono hint">${fmt(DR.range[0])}–${fmt(DR.range[1])}</td><td class="mono hint">${B?`${fmt(B.range[0])}–${fmt(B.range[1])}`:''}</td></tr></tbody></table>
    <p class="hint">At the peak = clock ${clockM(R.peakT)}. Range: people react faster/slower (follow rate, driving speed ±20%, getting ready ×0.75–1.5).</p>
    <div class="row" style="justify-content:flex-start"><button class="btn primary sm" id="drDebrief">Best actions</button><button class="btn sm" id="drBest" ${B?'':'disabled'}>Use best choices</button></div>`;
  $('drDebrief').onclick=showDebrief; $('drBest').onclick=useBest; }
function useBest(){ const B=DR.best; if(!B) return; DR.dec={order:B.dec.order,full:B.dec.full,help:B.dec.help}; if(B.dec.early){ SC.leadMin+=B.dec.early; $('sc-leadMin').value=SC.leadMin; makePlan(); }
  drawChoices(); drillRun(); restart0(); toast('Best choices set: press ▶'); }
function showDebrief(){ const B=DR.best,R=DR.run,st=$('drillStage'); if(!B||!R){ toast('Still computing the best plan…'); return; } setPlaying(false);
  $('drillBody').innerHTML=`<div class="stats"><div class="stat${R.score>B.run.score+.5?' warn':''}"><b data-src="drill">${fmt(R.score)}</b><span>unsafe at the peak with your choices (${fmt(DR.range[0])}–${fmt(DR.range[1])})</span></div>
    <div class="stat"><b data-src="drill">${fmt(B.run.score)}</b><span>with the best actions (${fmt(B.range[0])}–${fmt(B.range[1])})</span></div>
    <div class="stat"><b>${fmt(Math.max(0,R.score-B.run.score))}</b><span>more people safe</span></div></div>
    <ol class="steps">${actionPlan(B).map(([t,x])=>`<li><span class="mono">${isFinite(t)?clockM(t):'Before'}</span><span>${x}</span></li>`).join('')}</ol>
    <div class="row" style="justify-content:flex-start"><button class="btn primary sm" id="dbUse">Use these choices and play</button></div>
    <p class="hint">"Unsafe" = trapped without a floor above the water, stuck in a flooded street, or without a shelter place, when the water is highest. ${3*4*2*2} combinations tested on the same flood. "Upstairs" is not risk-free: people must be checked on. A planning aid with assumptions, not a prediction of deaths.</p>`;
  st.hidden=false; $('dbUse').onclick=()=>{ st.hidden=true; useBest(); setPlaying(true); }; $('drillClose').focus(); }

/* ---------- controls under the map: sliders + the choices, set before pressing play ---------- */
const restart0=()=>{ setPlaying(false); S.T=0; render(); };
const DOCK=[['size','Flood',0,2,1,()=>S.sizeIdx,v=>{$('size').value=v; $('size').oninput({target:$('size')});},v=>`1-in-${D.rps[v]}`],
  ['rain','Rain',1,150,1,()=>SC.rain,v=>{SC.rain=v; drawScenarioInfo();},v=>v+' mm/h'],
  ['dur','Hours',1,48,1,()=>SC.dur/60,v=>{SC.dur=v*60; drawScenarioInfo();},v=>v+' h'],
  ['lead','Warning',0,720,15,()=>SC.leadMin,v=>{SC.leadMin=v; $('sc-leadMin').value=v; alerted=warned=null; makePlan();},v=>`${Math.floor(v/60)} h ${v%60?String(v%60).padStart(2,'0'):''}`],
  ['rise','Water rises in',2,24,1,()=>Math.round(SC.mins*.45/60),v=>{SC.mins=Math.round(v*60/.45); $('sc-mins').value=SC.mins; alerted=warned=null; makePlan();},v=>v+' h'],
  ['comply','Follow',30,100,5,()=>DR.comply,v=>{DR.comply=v; drillRun();},v=>v+'%'],
  ['cap','Places',50,300,10,()=>DR.capX,v=>{DR.capX=v; drillRun();},v=>v+'%'],
  ['walk','Speed',10,60,5,()=>E.speed,v=>{E.speed=v; $('evSpeedMs').value=v; makePlan();},v=>v+' km/h'],
  ['resc','Rescue',0,500,10,()=>DR.rescue,v=>{DR.rescue=v; drillRun();},v=>v+'/h']];
const CHOICES=[['order','Order',[['plan','Each street → its shelter'],['tall','Places first: no upper floor'],['door','+ door-to-door'],['near','People choose']]],
  ['full','Shelter full',[['redirect','Next best shelter'],['pack','Squeeze in +30%']]],['help','Rescue',[['local','Local teams'],['nat','+ national support']]]];
function drawDock(){ $('dockIn').innerHTML=DOCK.map(([k,t,mi,ma,st,get,,lab])=>{ const v=get(),mx=k==='size'?D.rps.length-1:ma;
  return `<label class="dk"><span>${t}</span><b class="mono" id="dkv-${k}">${lab(v)}</b><input type="range" id="dk-${k}" min="${mi}" max="${mx}" step="${st}" value="${v}" aria-label="${t}"></label>`; }).join('')
  +`<button class="btn sm" id="dkBuild" title="Turn this rain into a flood (compared with 37 years of rain records)">Build</button>`; drawChoices(); }
function drawChoices(){ $('dockCh').innerHTML=CHOICES.map(([k,t,o])=>`<label class="dk ch"><span>${t}</span><select class="btn" data-ch="${k}" aria-label="${t}">${o.map(([v,l])=>`<option value="${v}"${DR.dec[k]===v?' selected':''}>${l}</option>`).join('')}</select></label>`).join('')
  +`<button class="btn sm primary" id="dkBest" title="Best actions for this flood">Best actions</button>`; }
let dkT={};
$('dockIn').oninput=e=>{ const k=e.target.id?.slice(3),d=DOCK.find(x=>x[0]===k); if(!d) return; const v=+e.target.value; $('dkv-'+k).textContent=d[7](v);
  clearTimeout(dkT[k]); dkT[k]=setTimeout(()=>{ d[6](v); restart0(); },k==='size'?0:200); };
$('dockIn').onclick=e=>{ if(e.target.id==='dkBuild'){ buildScenario(); restart0(); } };
$('dockCh').onchange=e=>{ const k=e.target.dataset.ch; if(!k) return; DR.dec[k]=e.target.value; drillRun(); restart0(); };
$('dockCh').onclick=e=>{ if(e.target.id==='dkBest') showDebrief(); };
$('dockHide').onclick=()=>{ const on=$('dock').classList.toggle('min'); $('dockHide').textContent=on?'Controls ▴':'▾'; $('dockHide').setAttribute('aria-expanded',!on); };
function syncDock(){ if(!$('dk-size')) return; DOCK.forEach(([k,,,,,get,,lab])=>{ const el=$('dk-'+k); if(el&&document.activeElement!==el&&+el.value!==get()){ el.value=get(); $('dkv-'+k).textContent=lab(get()); } }); }
$('drillClose').onclick=()=>{$('drillStage').hidden=true;};
$('drillCard').onclick=()=>openCard();
