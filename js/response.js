// response.js - Emergency teams: real fire stations, police and hospitals send teams to the places that need help,
// either "nearest first" or "priority first", on the roads that are still passable at the video's current moment.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- assumptions (editable in the Alert tab; not data) ---------- */
const RS={fire:2,police:1,amb:2,kmh:40,scene:30,depth:.3,mode:'priority',out:null};
const UNIT_KIND={fire_station:['fire','F','Fire team'],police:['police','P','Police team'],hospital:['amb','A','Ambulance']};

/* ---------- who needs help (from the flood maps and the evacuation plan) ----------
   hospital / clinic in water: evacuate patients (top priority); fire station / police / town hall in water: protect or relocate;
   groups whose residents cannot reach a shelter in time or have no place: help them leave (priority grows with people, wave 1 first). */
function incidents(){ const r=rp(),out=[];
  for(const p of D.places||[]) if(p.group==='critical'&&p.ci>=0&&D.cells[p.ci].depth[r]>.01){
    const med=p.kind==='hospital'||p.kind==='clinic'||p.kind==='care_home';
    out.push({c:p.c,what:med?'Evacuate patients':'Protect / relocate',name:p.name||kindName(p.kind),people:0,prio:med?1000:300}); }
  for(const g of E.plan?.groups||[]){ const need=(g.left||0)+(g.slow||0); if(need>=1) out.push({c:g.c,what:'Help residents leave',name:`Wave ${g.wave} group`,people:need,prio:need*(4-g.wave)/10,wave:g.wave}); }
  return out.sort((a,b)=>b.prio-a.prio).slice(0,30); }
function units(){ const r=rp(),out=[];
  for(const p of D.places||[]){ const k=UNIT_KIND[p.kind]; if(!k) continue; const c=p.ci>=0?D.cells[p.ci]:null,wet=c&&nowDepth(c,r)>.1;
    for(let i=0;i<RS[k[0]];i++) out.push({c:p.c,kind:k[0],abbr:k[1],label:k[2],base:p.name||kindName(p.kind),down:wet}); }
  return out; }

/* ---------- dispatch: each team does one job at a time (drive + time on scene), then the next ---------- */
function dispatch(mode){ const r=rp(),g=roadGraph(r,'car',RS.depth,false,true); if(!g) return null;
  const I=incidents(),U=units(),ok=U.filter(u=>!u.down),inN=I.map(x=>nearest(g,x.c)),tr=inN.map(n=>dijkstra(g,n)),mpm=RS.kmh*1000/60;
  const st=ok.map(u=>({u,node:nearest(g,u.c),pos:-1,free:0,trips:[]})),done=I.map(()=>null);
  const dist=(s,i)=>s.pos<0?tr[i].dist[s.node]:tr[i].dist[inN[s.pos]],
    arrive=(s,i)=>s.u.kind==='amb'&&I[i].what==='Protect / relocate'?Infinity:s.free+dist(s,i)/mpm; // ambulances: patients and residents only
  const assign=(s,i)=>{ const a=arrive(s,i),from=s.pos<0?s.node:inN[s.pos],path=[]; for(let u=from;u>=0;u=tr[i].prev[u]) path.push(g.pts[u]);
    s.trips.push({i,path,a}); done[i]={a,unit:s.u}; s.free=a+RS.scene; s.pos=i; };
  if(mode==='nearest'){ for(;;){ let best=null; st.forEach(s=>I.forEach((_,i)=>{ if(done[i]) return; const a=arrive(s,i); if(isFinite(a)&&(!best||a<best.a)) best={s,i,a}; })); if(!best) break; assign(best.s,best.i); } }
  else I.forEach((_,i)=>{ let best=null; st.forEach(s=>{const a=arrive(s,i); if(isFinite(a)&&(!best||a<best.a)) best={s,a};}); if(best) assign(best.s,i); });
  const reached=I.map((x,i)=>({...x,...done[i]})),hit=reached.filter(x=>x.a!=null),ppl=hit.filter(x=>x.people);
  return {mode,I:reached,st,down:U.filter(u=>u.down),avail:ok.length,
    avg:hit.length?hit.reduce((s,x)=>s+x.a,0)/hit.length:null,
    crit:Math.max(0,...hit.filter(x=>x.prio>=300).map(x=>x.a)),
    pplAvg:ppl.length?ppl.reduce((s,x)=>s+x.a*x.people,0)/ppl.reduce((s,x)=>s+x.people,0):null,
    miss:I.length-hit.length}; }

/* ---------- map ---------- */
function addResponseLayers(){
  map.addLayer({id:'trips',type:'line',source:'trips',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':css('--unit'),'line-width':3,'line-opacity':.75,'line-dasharray':[2,1]}});
  map.addLayer({id:'incidents',type:'circle',source:'incidents',paint:{'circle-radius':9,'circle-color':['case',['>=',['get','prio'],300],css('--crit'),css('--cut')],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.addLayer({id:'incidents-lab',type:'symbol',source:'incidents',layout:{'text-field':['get','lab'],'text-font':['Noto Sans Bold'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'units',type:'circle',source:'units',paint:{'circle-radius':8,'circle-color':['case',['==',['get','down'],1],css('--muted'),css('--unit')],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.addLayer({id:'units-lab',type:'symbol',source:'units',layout:{'text-field':['get','abbr'],'text-font':['Noto Sans Bold'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
}
function responseVisibility(){ const on=S.tab==='coord'&&!!RS.out; ['trips','incidents','incidents-lab','units','units-lab'].forEach(id=>map.setLayoutProperty(id,'visibility',on?'visible':'none')); }
function drawResponse(){ const o=RS.out,F=f=>({type:'FeatureCollection',features:f}),pt=(c,p)=>({type:'Feature',geometry:{type:'Point',coordinates:c},properties:p});
  if(!o){ $('rsOut').innerHTML=''; return; }
  map.getSource('trips').setData(F(o.st.flatMap(s=>s.trips.map(t=>({type:'Feature',geometry:{type:'LineString',coordinates:t.path},properties:{}}))).filter(f=>f.geometry.coordinates.length>1)));
  map.getSource('incidents').setData(F(o.I.map((x,i)=>pt(x.c,{prio:x.prio,lab:x.a!=null?Math.round(x.a)+'′':'✕'}))));
  map.getSource('units').setData(F([...o.st.map(s=>pt(s.u.c,{abbr:s.u.abbr,down:0})),...o.down.map(u=>pt(u.c,{abbr:u.abbr,down:1}))]));
  const m=v=>v==null?'–':Math.round(v)+' min',a=RS.cmp,b=o;
  $('rsOut').innerHTML=`<table class="tbl"><thead><tr><th></th><th>Nearest first</th><th>Priority first</th></tr></thead><tbody>
    <tr><td>Hospitals, fire, police sites reached by</td><td>${m(a.nearest.crit||null)}</td><td>${m(a.priority.crit||null)}</td></tr>
    <tr><td>Average wait, weighted by people</td><td>${m(a.nearest.pplAvg)}</td><td>${m(a.priority.pplAvg)}</td></tr>
    <tr><td>Average wait, all places</td><td>${m(a.nearest.avg)}</td><td>${m(a.priority.avg)}</td></tr>
    <tr><td>Places no team can reach (no dry road)</td><td>${a.nearest.miss}</td><td>${a.priority.miss}</td></tr></tbody></table>
    <p style="font-size:14px;margin:8px 0 4px">${b.avail} teams available${b.down.length?`, <b style="color:var(--err)">${b.down.length} stuck: base under water</b> (${[...new Set(b.down.map(u=>esc(u.base)))].join(', ')})`:''}. Showing <b>${RS.mode==='nearest'?'nearest first':'priority first'}</b> on the map: numbers = minutes until a team arrives, ✕ = unreachable.</p>
    <ol class="rsl">${b.I.slice(0,12).map(x=>`<li><b>${esc(x.what)}</b>: ${esc(x.name)}${x.people?` (${fmtFull(x.people)} people)`:''} → ${x.a!=null?`${esc(x.unit.label)} from ${esc(x.unit.base)}, <span class="mono">${Math.round(x.a)} min</span>`:'<span style="color:var(--err)">no team can reach it</span>'}</li>`).join('')}</ol>`;
  responseVisibility(); }
function runDispatch(){ if(!E.plan){ toast('The evacuation plan is not ready yet'); return; }
  RS.cmp={nearest:dispatch('nearest'),priority:dispatch('priority')}; RS.out=RS.cmp[RS.mode]; if(!RS.out){ toast('Roads are not loaded'); return; }
  drawResponse(); toast(`Teams dispatched at this moment of the video (${['water rising','peak','water going down'][S.T<.45?0:S.T<.6?1:2]})`); }
// moving team markers along their trips (sped up)
let rsT0=0; FX.push(now=>{ const o=RS.out; if(!o||S.tab!=='coord') return; const f=[];
  for(const s of o.st){ if(!s.trips.length) continue; const path=s.trips.flatMap(t=>[...t.path]).filter(Boolean); if(path.length<2) continue;
    const l=s.line||(s.line=prepLine(path)); if(!l.len) continue; f.push({type:'Feature',geometry:{type:'Point',coordinates:along(l,((now/1000*RS.kmh/3.6*30)%l.len))},properties:{abbr:s.u.abbr,down:0}}); }
  map.getSource('units').setData({type:'FeatureCollection',features:[...f,...o.down.map(u=>({type:'Feature',geometry:{type:'Point',coordinates:u.c},properties:{abbr:u.abbr,down:1}}))]}); });
document.querySelector('#rsMode').onclick=e=>{const b=e.target.closest('[data-m]'); if(!b) return; RS.mode=b.dataset.m; document.querySelectorAll('#rsMode [data-m]').forEach(x=>x.setAttribute('aria-pressed',x===b)); if(RS.cmp){RS.out=RS.cmp[RS.mode]; RS.out.st.forEach(s=>s.line=null); drawResponse();}};
$('rsGo').onclick=runDispatch;
const RSF=[['fire','Teams per fire station'],['police','Teams per police station'],['amb','Ambulances per hospital'],['kmh','Average speed, km/h'],['scene','Time on scene, min'],['depth','Max water a vehicle can cross, m']];
$('rsIn').innerHTML=RSF.map(([k,t])=>`<label>${t}<input class="btn" type="number" step="any" min="0" data-rs="${k}" value="${RS[k]}"></label>`).join('');
$('rsIn').onchange=e=>{const k=e.target.dataset.rs; if(k&&e.target.value!==''){RS[k]=+e.target.value; graphCache={}; if(RS.out) runDispatch();}};
