// evac.js - Evacuation plan: who leaves, to which shelter, by which route, in which order. Data + the team's own choices.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- choices (shelter capacity, speed and warning time are user assumptions, not data) ---------- */
const E={shelters:[],who:'water',cap:0,speed:4,lead:3,adding:false,plan:null,walkers:[]};
// start from real buildings (schools, sports halls…) when the places file is loaded, else from the safest grid spots
function evacReset(){ RS.out=null; RS.cmp=null; for(const k in tsCache) delete tsCache[k]; const sc=shelterCandidates(); E.cands=sc.list; E.out=sc.out; const real=pickShelters(sc.list);
  E.shelters=real.length?real.map(asShelter)
    :D.safe.map((s,k)=>({c:s.c,auto:true,name:`Safe place ${k+1}`,cap:null,demo:true,stay:'overnight',desc:`${s.b} buildings · ${Math.round(s.dmin)} m from flood water`}));
  placesData(); makePlan(); } // map colours: sites with capacity to be checked
const asShelter=p=>({...p,auto:true,src:p,name:p.name||kindName(p.kind),cap:p.cap||null,capSrc:p.capSrc});
const capOf=k=>{const s=E.shelters[k]; return s.userCap??s.cap??(s.demo?(E.cap||500):s.stay==='assembly'?0:E.cap);}; // set by hand > floor area > 'places when size unknown' (default 0 = not counted; demo data only: 500)

/* ---------- route network: OpenStreetMap streets when loaded, otherwise grid cells (open ground) ---------- */
// mode: 'foot' | 'car'. limit: water depth above which a segment is closed (Infinity = open, deeper costs more unless plain).
// now: judge the water at the video's moment instead of the peak
function roadGraph(r,mode='foot',limit=Infinity,plain=false,now=false){ const key=[r,mode,limit,plain,now&&S.T.toFixed(2)].join(); if(graphCache[key]) return graphCache[key];
  if(Object.keys(graphCache).length>24) graphCache={};
  if(roadSegs.size<50) return null; const id=new Map(),pts=[],adj=[];
  const node=p=>{const k=kk(p); let n=id.get(k); if(n===undefined){n=pts.length; id.set(k,n); pts.push(p); adj.push([]);} return n;};
  for(const s of roadSegs.values()){ s.qs??=pixLine(s.a,s.b); // depth = deepest drawn water along the street (and its grid cells)
    const d=Math.max(now?s.cs.reduce((m,c)=>Math.max(m,nowDepth(c,r)),0):s.dep[r]||0,s.qs.reduce((m,q)=>Math.max(m,pixDepth(q,r,S.T,!now)),0)); if(!s[mode]||d>limit) continue;
    const a=node(s.a),b=node(s.b),w=plain||limit<Infinity?s.len:s.len*(1+4*Math.max(0,d-CAR_DEPTH)); adj[a].push(b,w); adj[b].push(a,w);} // deep streets cost more
  return graphCache[key]={pts,adj,kind:'streets'};}
function gridGraph(r){ const G=D.G,pts=D.cells.map(c=>c.c),adj=D.cells.map(()=>[]);
  D.cells.forEach((c,i)=>{ for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){ const x=c.gx+dx,y=c.gy+dy; if(x<0||y<0||x>=G.nx||y>=G.ny) continue; const j=G.idx[y*G.nx+x]; if(j<0) continue;
    const w=G.m*Math.hypot(dx,dy)*(1+2*(c.depth[r]+D.cells[j].depth[r])); adj[i].push(j,w); adj[j].push(i,w);} });
  return {pts,adj,kind:'ground'};}
// nearest graph node: look in growing rings of ~200 m buckets (built once per graph)
function nearest(g,p){ const W=.0025,key=(x,y)=>x+':'+y;
  if(!g.bk){ g.bk=new Map(); g.pts.forEach((q,i)=>{const k=key(Math.floor(q[0]/W),Math.floor(q[1]/W)); (g.bk.get(k)||g.bk.set(k,[]).get(k)).push(i);}); }
  const cx=Math.floor(p[0]/W),cy=Math.floor(p[1]/W); let best=-1,bd=Infinity;
  for(let R=0;R<60;R++){ for(let x=cx-R;x<=cx+R;x++) for(let y=cy-R;y<=cy+R;y++){ if(Math.max(Math.abs(x-cx),Math.abs(y-cy))!==R) continue;
      for(const i of g.bk.get(key(x,y))||[]){const d=mDist(p,g.pts[i]); if(d<bd){bd=d; best=i;}} }
    if(best>=0&&bd<R*W*70000) break; } // ring R is at least R×~175 m away: nothing closer can remain
  // tiny road pieces (private driveways, joins lost at map-tile edges) lead nowhere: prefer the main network within 300 m
  const cs=compSizes(g); if(best<0||cs[best]>=100) return best; let alt=-1,ad=300;
  for(let x=cx-2;x<=cx+2;x++) for(let y=cy-2;y<=cy+2;y++) for(const i of g.bk.get(key(x,y))||[]){const d=mDist(p,g.pts[i]); if(cs[i]>=100&&d<ad){ad=d; alt=i;}}
  return alt>=0?alt:best; }
function compSizes(g){ if(g.cs) return g.cs; const c=new Int32Array(g.pts.length).fill(-1),sz=[];
  for(let i=0;i<c.length;i++){ if(c[i]>=0) continue; let n=0; const st=[i]; c[i]=sz.length;
    while(st.length){const u=st.pop(); n++; const a=g.adj[u]; for(let j=0;j<a.length;j+=2) if(c[a[j]]<0){c[a[j]]=sz.length; st.push(a[j]);}} sz.push(n); }
  return g.cs=Int32Array.from(c,k=>sz[k]); }
function dijkstra(g,src){ const n=g.pts.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),hk=[],hv=[];
  const push=(k,v)=>{let i=hk.length; hk.push(k); hv.push(v); while(i){const p=(i-1)>>1; if(hk[p]<=k) break; hk[i]=hk[p]; hv[i]=hv[p]; i=p;} hk[i]=k; hv[i]=v;};
  const pop=()=>{const v=hv[0],k=hk.pop(),x=hv.pop(); if(hk.length){let i=0; for(;;){let c=2*i+1; if(c>=hk.length) break; if(c+1<hk.length&&hk[c+1]<hk[c]) c++; if(hk[c]>=k) break; hk[i]=hk[c]; hv[i]=hv[c]; i=c;} hk[i]=k; hv[i]=x;} return v;};
  dist[src]=0; push(0,src);
  while(hk.length){const d=hk[0],u=pop(); if(d>dist[u]) continue; const a=g.adj[u]; for(let j=0;j<a.length;j+=2){const v=a[j],nd=d+a[j+1]; if(nd<dist[v]){dist[v]=nd; prev[v]=u; push(nd,v);}}}
  return {dist,prev};}

/* ---------- groups of ~400 m; wave = when water first reaches the group in the video (low ground and upstream first: an order, not hours) ---------- */
const tsCache={};
function waveOf(t,r=rp()){ if(!isFinite(t)) return 3; let c=tsCache[r]; if(!c){ const ts=D.cells.map(x=>floodStart(x,r)).filter(isFinite),lo=Math.min(...ts),hi=Math.max(...ts); c=tsCache[r]=[lo+(hi-lo)/3,lo+2*(hi-lo)/3]; }
  return t<c[0]?1:t<c[1]?2:3; }
function evacGroups(r){ const B=Math.max(1,Math.round(400/D.G.m)),m=new Map();
  D.cells.forEach(c=>{ if(!c.pop||!(E.who==='red'?c.z===3:c.depth[r]>.01)) return; const key=Math.floor(c.gx/B)+':'+Math.floor(c.gy/B);
    let g=m.get(key); if(!g) m.set(key,g={key,pop:0,x:0,y:0,dmax:0,ts:Infinity}); g.pop+=c.pop; g.x+=c.c[0]*c.pop; g.y+=c.c[1]*c.pop; g.dmax=Math.max(g.dmax,c.depth[r]); g.ts=Math.min(g.ts,floodStart(c,r));});
  return [...m.values()].map(g=>({key:g.key,pop:g.pop,c:[g.x/g.pop,g.y/g.pop],dmax:g.dmax,ts:g.ts,wave:waveOf(g.ts,r)})); }
function planFor(r){
  const groups=evacGroups(r).sort((a,b)=>a.wave-b.wave||b.pop-a.pop),total=groups.reduce((s,g)=>s+g.pop,0),load=E.shelters.map(()=>0),routes=[];
  if(!E.shelters.length) return {r,kind:'none',groups,routes,load,total,moved:0,over:total,slow:0};
  const g=roadGraph(r,'car')||gridGraph(r),trees=E.shelters.map(s=>dijkstra(g,nearest(g,s.c))); let moved=0,over=0,slow=0;
  for(const [gi,gr] of groups.entries()){ const st=nearest(g,gr.c); let left=gr.pop;
    const order=trees.map((t,k)=>k).filter(k=>isFinite(trees[k].dist[st])).sort((a,b)=>trees[a].dist[st]-trees[b].dist[st]);
    const way=k=>{const path=[gr.c]; for(let u=st;u>=0;u=trees[k].prev[u]) path.push(g.pts[u]); path.push(E.shelters[k].c); return prepLine(path);};
    if(order.length) gr.near={...way(order[0]),k:order[0]}; // where people go on their own (closest shelter): used by the drill
    for(const k of order){ if(left<=0) break; const take=Math.min(left,capOf(k)-load[k]); if(take<=0) continue; load[k]+=take; left-=take; // fills the closest shelter with room
      // in time = get ready + walk + delay fits in the time available: the warning lead time, or less if the water arrives sooner
      const l=way(k),min=l.len/(E.speed*1000/60),avail=Math.min(SC.leadMin,isFinite(gr.ts)?gr.ts*SC.mins:Infinity),clear=FW.mob+min+FW.delay,ok=clear<=avail; moved+=take; if(!ok) slow+=take;
      routes.push({...l,min,avail,clear,people:take,wave:gr.wave,k,ok,gi}); if(!ok) gr.slow=(gr.slow||0)+take; }
    gr.left=left; over+=left; }
  return {r,kind:g.kind,groups,routes,load,total,moved,over,slow,g,trees};
}
let planT=null;
function makePlan(){ clearTimeout(planT); planT=setTimeout(()=>{ if(!D) return; E.plan=planFor(rp()); drawPlan(); },60); }

/* ---------- map layers ---------- */
const walkCol=()=>['match',['get','st'],'stuck',css('--cut'),'noplace',css('--people-risk'),css('--walk')]; // drill: stuck in water / turned away
const waveCol=()=>['match',['get','wave'],1,css('--wave1'),2,css('--wave2'),css('--wave3')];
function addEvacLayers(){
  map.addLayer({id:'routes-case',type:'line',source:'routes',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#fff','line-width':6,'line-opacity':.8}});
  map.addLayer({id:'routes',type:'line',source:'routes',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':waveCol(),'line-width':3,'line-opacity':['case',['==',['get','ok'],1],.95,.55]}});
  map.addLayer({id:'groups',type:'circle',source:'groups',paint:{'circle-radius':['interpolate',['linear'],['sqrt',['get','pop']],0,5,40,20],'circle-color':waveCol(),'circle-opacity':.85,'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
  map.addLayer({id:'groups-lab',type:'symbol',source:'groups',layout:{'text-field':['get','lab'],'text-font':['Noto Sans Bold'],'text-size':11,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  const ic=carIcon(); if(ic&&!map.hasImage('evcar')) map.addImage('evcar',ic,{sdf:true}); // evacuees drive: one car icon, coloured by status, turned along the road
  map.addLayer({id:'walkers',type:'symbol',source:'walkers',layout:{'icon-image':'evcar','icon-size':['interpolate',['exponential',2],['zoom'],12,.12,15,.15,17,.6,19,2.4],'icon-rotate':['-',['get','b'],90],'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true},
    paint:{'icon-color':walkCol(),'icon-halo-color':'#000','icon-halo-width':1}});
  addDrillLayers();
}
function evacVisibility(){ const on=S.tab==='safety'&&!!E.plan; ['routes-case','routes','groups','groups-lab','catch-fill','catch-line'].forEach(id=>map.setLayoutProperty(id,'visibility',on||(id.startsWith('catch')&&DR.sel!=null)?'visible':'none'));
  const cars=(on||S.tab==='sim')&&E.plan; map.setLayoutProperty('walkers','visibility',cars&&!S.l3d?'visible':'none'); map.setLayoutProperty('cars-3d','visibility',cars&&S.l3d?'visible':'none'); pinVis(); }
function recolorEvac(){ ['routes','groups'].forEach(id=>map.setPaintProperty(id,id==='routes'?'line-color':'circle-color',waveCol()));
  map.setPaintProperty('walkers','icon-color',walkCol()); }
function drawPlan(){ const P=E.plan; if(!P) return; drawShelterList(); drawEvacPanel(); drawCritical(); if(typeof drillReset==='function') drillReset(); if(S.tab==='policy'){ drawCosts(); drawImpact(); }
  if(!ready) return; const F=fs=>({type:'FeatureCollection',features:fs}),pt=(c,p)=>({type:'Feature',geometry:{type:'Point',coordinates:c},properties:p});
  map.getSource('routes').setData(F(P.routes.map(r=>({type:'Feature',geometry:{type:'LineString',coordinates:r.pts},properties:{wave:r.wave,ok:r.ok?1:0,k:r.k}}))));
  map.getSource('groups').setData(F(P.groups.map(g=>pt(g.c,{pop:g.pop,wave:g.wave,lab:fmt(g.pop)}))));
  // moving dots: about one per 2 dots of residents, capped for speed
  const R=rng(3),per=Math.max(perDot*2,P.moved/1200); E.walkers=[];
  P.routes.forEach((r,i)=>{for(let n=Math.max(1,Math.round(r.people/per));n>0;n--) E.walkers.push({r:i,s0:R()});});
  drawShelters(); evacVisibility(); drillRun(); }
function stepWalkers(now){ const P=E.plan; if(!P||!(S.tab==='safety'||S.tab==='sim')||!E.walkers.length) return; if(DR.run) return drillWalkers(); const t=reduce?0:now/1000,v=E.speed/3.6*60,f=[]; // 60× faster than real
  for(const w of E.walkers){const r=P.routes[w.r]; if(!r.len) continue; f.push({type:'Feature',geometry:{type:'Point',coordinates:along(r,((w.s0+t*v/r.len)%1)*r.len)},properties:{wave:r.wave}});}
  map.getSource('walkers').setData({type:'FeatureCollection',features:f}); }
FX.push(stepWalkers);
// best-placed overnight sites when none has a known capacity (same ranking as the plan, 400 m apart): amber pins + list, not in the run
const recSites=()=>E.shelters.length?[]:(E.cands||[]).filter(c=>c.stay==='overnight'&&c.access!==false&&c.near).sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.slice(0,i).every(p=>mDist(p.c,c.c)>400)).slice(0,5);
function drawShelters(){ markers.forEach(m=>m.remove()); markers=[]; if(!ready) return;
  recSites().forEach((c,k)=>{const el=document.createElement('div'); el.className='pin unk'; el.innerHTML=`<span>${k+1}</span>`;
    el.title=`${c.name||kindName(c.kind)}${nearTown(c.c)?' near '+nearTown(c.c):''}: recommended site, capacity to be checked`; el.onclick=e=>{ e.stopPropagation(); map.flyTo({center:c.c,zoom:16,duration:1000}); };
    markers.push(new maplibregl.Marker({element:el,anchor:'bottom-left'}).setLngLat(c.c).addTo(map));});
  E.shelters.forEach((s,k)=>{const el=document.createElement('div'); el.className='pin'+(s.auto?'':' you'); el.innerHTML=`<span>${k+1}</span>`;
    el.title=`${s.name}: ${fmtFull(E.plan?.load[k]||0)} of ${fmtFull(capOf(k))} places used`; el.onclick=e=>{ e.stopPropagation(); selectShelter(k); flyTo(k); };
    markers.push(new maplibregl.Marker({element:el,anchor:'bottom-left'}).setLngLat(s.c).addTo(map));});
  pinVis(); }

/* ---------- panel ---------- */
// closest town name (OpenStreetMap labels), to locate sites the data gives no name for
const nearTown=p=>{ let b=null,bd=Infinity; for(const t of D.towns||[]){ const d=mDist(p,t.c); if(d<bd){bd=d; b=t;} } return bd<4000?b.name:''; };
function drawShelterList(){ const ul=$('safeList'),P=E.plan;
  const best=recSites();
  ul.innerHTML=!E.shelters.length?(best.length?`<li class="hint"><b>Recommended sites, capacity to be checked</b>: dry, outside every mapped flood, close to the people at risk. No published capacity or floor area for them, so they are not in the evacuation run: ask the commune for the places, or set "Places when size unknown" below.</li>`
      +best.map((c,k)=>`<li class="shel"><button data-cand="${E.cands.indexOf(c)}"><span class="n">${k+1}</span><span><b>${esc(c.name||kindName(c.kind))}</b> <span class="hint" style="margin:0">${c.name?kindName(c.kind)+' · ':''}${nearTown(c.c)?'near '+esc(nearTown(c.c))+' · ':''}capacity to be checked</span><br>${chips(c)}</span></button></li>`).join('')
    :'<li class="hint">No shelter found: no school, sports hall, community centre or shelter outside the mapped floods with a dry road. Add one on the map.</li>'):E.shelters.map((s,k)=>{const ld=P?.load[k]||0,full=ld>=capOf(k);
    return `<li class="shel"><button data-k="${k}"><span class="n${s.auto?'':' you'}">${k+1}</span><span><b>${esc(s.name)}</b> <span class="hint" style="margin:0">${s.kind?`${kindName(s.kind)} · ${STAY[s.stay]||''}`:s.auto?'':'added by you'}</span>
      ${s.dmin!=null&&s.src?`<br>${chips(s)}`:s.desc?`<br><span class="hint" style="margin:0">${esc(s.desc)}</span>`:''}</span></button>
      <span class="capbox"><span class="mono">${fmtFull(capOf(k))} places</span><span class="mono">${fmtFull(ld)} planned${full?' · FULL':''}</span>
      <span class="hint" style="margin:0">${s.capSrc&&/places \(/.test(s.capSrc)?'published capacity':s.cap?'from floor area':s.userCap!=null?'set by hand':s.demo?'default (demo)':E.cap?'your assumption':'capacity to be checked – not counted'}</span></span></li>`;}).join('');
  const inPlan=new Set(E.shelters.map(s=>s.src)),rest=(E.cands||[]).filter(c=>!inPlan.has(c));
  $('candList').innerHTML=`<summary>Next best shelters (${rest.length}), used when the first ones are full · excluded: ${E.out?.zone||0} in a flood zone, ${E.out?.near||0} closer than 150 m to water, ${E.out?.y2021||0} flooded in July 2021 · ${(E.cands||[]).filter(c=>c.stay==='overnight'&&!c.cap).length} sites with capacity to be checked (amber on the map): ${E.cap?`counted as ${E.cap} places (your assumption)`:'not counted'}</summary>`
    +rest.slice(0,25).map(c=>`<div class="cand"><span><b>${esc(c.name||kindName(c.kind))}</b> <span class="hint" style="margin:0">${kindName(c.kind)} · ${STAY[c.stay]} · ${c.cap?fmtFull(c.cap)+' places':'<span style="color:var(--unk)">capacity to be checked – not counted</span>'} · score ${Math.round(c.score*100)}</span><br>${chips(c)}</span>
      </div>`).join(''); }
function drawEvacPanel(){ const P=E.plan,r=rp(),pct=n=>P.total?Math.round(n/P.total*100)+'%':'–';
  $('evScen').textContent=`For the ${sizeWord(r).toLowerCase()} flood (1-in-${r} years) picked in Simulate.`;
  $('evStats').innerHTML=[[P.total,'people to move'],[P.moved-P.slow,`reach a shelter in time by car (${pct(P.moved-P.slow)})`],[P.slow+P.over,'need help: too far or no place left']]
    .map(([n,t],i)=>`<div class="stat${i===2&&n>0?' warn':''}"><b>${fmt(n)}</b><span>${t}</span></div>`).join('')
    +(typeof DR!=='undefined'&&DR.share!=null?`<p class="hint" style="margin:6px 0 0;grid-column:1/-1">Need a public shelter: <b>${fmt(P.total*DR.share/100)}</b> of ${fmt(P.total)} (${DR.share}%, the others go to family or friends)</p>`:'');
  $('evGroups').innerHTML=P.routes.slice(0,14).map((x,i)=>`<li><button data-r="${i}"><span class="wv" style="background:var(--wave${x.wave})">${x.wave}</span><span>${fmtFull(x.people)} people → shelter ${x.k+1}<br><span class="mono">${(x.len/1000).toFixed(1)} km · ${Math.round(x.min)} min by car ${x.ok?'✓':'⚠ too slow'}</span></span></button></li>`).join('')
    +(P.routes.length>14?`<li class="hint">+ ${P.routes.length-14} more routes (in the downloads, Alert tab)</li>`:'')
    +(P.over?`<li class="hint" style="color:var(--err)">${fmtFull(P.over)} people have no shelter place: add a shelter or raise the capacity.</li>`:'');
  $('evNote').textContent=(P.kind==='streets'?'Routes follow OpenStreetMap streets and avoid deep water. ':P.kind==='ground'?'Routes go over open ground (streets not loaded yet: zoom in on the area). ':'')
    +'Waves: wave 1 is where water arrives first in the video (low ground, upstream sections first). This is an order, not real timing. Capacity, speed and warning time are your assumptions.'; }
const num=(id,k)=>$(id).onchange=e=>{const v=+e.target.value; if(v>0){E[k]=v; makePlan();}};
$('evCap').onchange=e=>{const v=+e.target.value; if(v>=0){E.cap=v; evacReset();}}; E.speed=20; // km/h, OpenStreetMap streets in a town (CAR_KMH in places.js)
$('evSpeedMs').onchange=e=>{const v=+e.target.value; if(v>0){E.speed=v; makePlan();}}; // km/h
$('sf-foot').onchange=e=>{const v=+e.target.value; if(v>0){FOOT_DEPTH=v; graphCache={}; if(AB.a) abRoute(false);}};
$('sf-car').onchange=e=>{const v=+e.target.value; if(v>0){CAR_DEPTH=v; roadsReset(); render(); drawLegend();}};
$('evWho').onchange=e=>{E.who=e.target.value; makePlan();};
$('evAdd').onclick=()=>{E.adding=!E.adding; $('evAdd').setAttribute('aria-pressed',E.adding); if(ready) map.getCanvas().style.cursor=E.adding?'crosshair':''; if(E.adding) toast('Click the map where the shelter is');};
$('evResetS').onclick=()=>{evacReset(); toast('Shelters reset to the safest places');};
$('safeList').onchange=e=>{const i=e.target.dataset.cap; if(i!=null){const v=+e.target.value; if(v>=0){E.shelters[+i].userCap=v; makePlan();}}};
$('candList').onclick=e=>{const b=e.target.closest('[data-add]'); if(b){E.shelters.push(asShelter(E.cands[+b.dataset.add])); makePlan(); toast('Added to the plan');}};
$('safeList').onclick=e=>{ if(e.target.closest('input')) return; const d=e.target.closest('[data-del]'); if(d){E.shelters.splice(+d.dataset.del,1); makePlan(); return;} const b=e.target.closest('[data-k]'); if(b) flyTo(+b.dataset.k);
  const c=e.target.closest('[data-cand]'); if(c) map.flyTo({center:E.cands[+c.dataset.cand].c,zoom:16,duration:1000});};
$('evGroups').onclick=e=>{const b=e.target.closest('[data-r]'); if(!b) return; const r=E.plan.routes[+b.dataset.r]; map.fitBounds(bboxOf([r.pts]),{padding:80,duration:1000,pitch:map.getPitch(),bearing:map.getBearing()});};
function onMapClick(e){ const p=[e.lngLat.lng,e.lngLat.lat]; if(apiPick(p)||abPick(p)) return;
  if(E.adding){ E.adding=false; $('evAdd').setAttribute('aria-pressed',false); map.getCanvas().style.cursor='';
    const d=depthAt(p),wet=d&&D.rps.some(r=>d[r]>0); E.shelters.push({c:p,auto:false,name:`Shelter ${String.fromCharCode(65+E.shelters.filter(s=>!s.auto).length%26)}`});
    toast(wet?'Careful: this place floods in at least one flood size':'Shelter added'); makePlan(); return; }
  if(S.tab==='coord') checkPlace(p); else if(!S.playing&&S.tab!=='diag') inspect(p); else if(S.playing) toast('Pause the video (space bar) and click to check a place'); }
