// places.js - Real places from OpenStreetMap: critical sites in the water, shelter candidates with capacity, safe route from A to B.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- assumptions (shown in the app; check before quoting) ---------- */
const FOOT_DEPTH=0.15;  // water a walker should not cross; US NWS "Turn Around Don't Drown": ~15 cm of moving water can knock an adult down
const SPHERE_M2=3.5;    // m² of covered floor per person in a shelter (Sphere humanitarian minimum standard)
const CAR_KMH=30;       // average car speed in town, for travel times only
const KINDS={hospital:['H','Hospital'],clinic:['+','Clinic'],care_home:['C','Care home'],fire_station:['F','Fire station'],police:['P','Police'],town_hall:['T','Town hall'],
  power:['E','Power'],water_works:['W','Water works'],school:['S','School'],sports_hall:['G','Sports hall'],stadium:['St','Stadium'],community_centre:['CC','Community centre'],park:['','Park']};
const kindName=k=>KINDS[k]?.[1]||k;

/* ---------- map layer ---------- */
function addPlaceLayers(){
  map.addLayer({id:'places',type:'circle',source:'places',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,['match',['get','group'],'critical',5,'assembly',3,4],16,['match',['get','group'],'critical',11,'assembly',6,9]],
    'circle-color':['match',['get','group'],'critical',css('--crit'),'shelter',css('--shel'),css('--osm-wood3')],'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
  map.addLayer({id:'places-lab',type:'symbol',source:'places',minzoom:12,layout:{'text-field':['get','abbr'],'text-font':['Noto Sans Bold'],'text-size':['interpolate',['linear'],['zoom'],12,8,16,12],'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'places-name',type:'symbol',source:'places',minzoom:14.5,filter:['!=',['get','group'],'assembly'],layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,1.3],'text-anchor':'top','text-optional':true},paint:{'text-color':css('--ink'),...halo()}});
  map.addLayer({id:'ab-normal',type:'line',source:'ab',filter:['==',['get','k'],'normal'],layout:{'line-cap':'round'},paint:{'line-color':css('--cut'),'line-width':3,'line-dasharray':[1.5,1.5],'line-opacity':.8}});
  map.addLayer({id:'ab-safe',type:'line',source:'ab',filter:['==',['get','k'],'safe'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':css('--zg'),'line-width':6,'line-opacity':.95}});
}
function placesData(){ if(!ready) return;
  map.getSource('places').setData({type:'FeatureCollection',features:(D.places||[]).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:p.c},
    properties:Object.assign({group:p.group,abbr:KINDS[p.kind]?.[0]||'',name:p.name},depthProps(p.ci>=0?D.cells[p.ci]:null))}))}); }
function placesVisibility(){ const on=$('tPlaces').checked&&!!D.places?.length; ['places','places-lab','places-name'].forEach(id=>map.setLayoutProperty(id,'visibility',on?'visible':'none'));
  ['ab-normal','ab-safe'].forEach(id=>map.setLayoutProperty(id,'visibility',S.tab!=='diag'?'visible':'none')); }
function paintPlaces(){ // red ring when the place is in the water right now
  map.setPaintProperty('places','circle-stroke-color',['case',['>',over(),.01],css('--cut'),'#fff']);
  map.setPaintProperty('places','circle-stroke-width',['case',['>',over(),.01],3.5,1.5]); }
function recolorPlaces(){ map.setPaintProperty('places','circle-color',['match',['get','group'],'critical',css('--crit'),'shelter',css('--shel'),css('--osm-wood3')]);
  map.setPaintProperty('places-name','text-color',css('--ink')); map.setPaintProperty('places-name','text-halo-color',css('--osm-halo'));
  map.setPaintProperty('ab-safe','line-color',css('--zg')); map.setPaintProperty('ab-normal','line-color',css('--cut')); }

/* ---------- critical sites in the water at this flood size: evacuate or protect first ---------- */
function drawCritical(){ const ul=$('critList'),r=rp(); if(!D.places?.length){ul.innerHTML='<li class="hint">No places file loaded (data/places.geojson).</li>'; return;}
  const hit=D.places.filter(p=>p.group==='critical'&&p.ci>=0&&D.cells[p.ci].depth[r]>.01).map(p=>({p,d:D.cells[p.ci].depth[r]})).sort((a,b)=>b.d-a.d);
  const tot=D.places.filter(p=>p.group==='critical').length;
  ul.innerHTML=hit.length?hit.map(({p,d},i)=>`<li><button data-c="${D.places.indexOf(p)}"><span class="n crit">${KINDS[p.kind][0]}</span><span>${esc(p.name||kindName(p.kind))}<br><span class="mono">${kindName(p.kind)} · ${d.toFixed(2)} m of water</span></span></button></li>`).join('')
    :`<li class="hint">None of the ${tot} critical sites found is in the water in this flood size.</li>`; }
$('critList').onclick=e=>{const b=e.target.closest('[data-c]'); if(b) map.flyTo({center:D.places[+b.dataset.c].c,zoom:16.5,duration:1200});};

/* ---------- shelters: type, capacity, safety criteria ----------
   Types: overnight shelter (school, sports hall, community centre) = covered floor ÷ 3.5 m² per person (Sphere minimum);
          assembly point (stadium, park) = people gather briefly before transport: no capacity computed (set it by hand).
   Floor area: OpenStreetMap footprint, else the largest non-residential GHS-OBAT building within 60 m (use = 2: check Annex 2).
   Floors = height ÷ 3.5 m (at least 1). Hard rules: dry in every flood size, not flooded in 2021, ≥ 150 m from flood water.
   Ranking: equal weights on 4 criteria (each as a rank among candidates): residents at risk within 1.5 km, capacity,
   height above the nearest flood water (DEM + EFAS 1-in-500), distance to flood water. No dry road at the biggest flood halves the score. */
const STYPE={school:'overnight',sports_hall:'overnight',community_centre:'overnight',stadium:'assembly',park:'assembly'};
const STAY={overnight:'Overnight shelter',assembly:'Assembly point'};
function floorArea(p){ if(p.area) return {a:p.area,h:p.h,src:'OSM footprint'}; let best=null;
  for(const b of D.blds) if(b.use===2&&b.area>(best?.area||0)&&mDist(p.c,b.c)<=60) best=b;
  return best?{a:best.area,h:best.h,src:'GHS-OBAT building'}:{a:0,h:0,src:''}; }
function shelterCandidates(){ if(!D.places?.length) return {list:[],out:{}};
  const top=D.rps[D.rps.length-1],wet=D.cells.filter(c=>c.z>1),red=wet.filter(c=>c.z===3),flood=D.cells.filter(c=>c.depth[top]>0),out={zone:0,near:0};
  const g=roadGraph(top,'car',CAR_DEPTH),cs=g&&compSizes(g),big=cs?Math.max(...cs):0;
  const list=D.places.filter(p=>STYPE[p.kind]&&p.ci>=0).map(p=>{ const c=D.cells[p.ci];
    if(c.z!==1){out.zone++; return null;}
    let dmin=Infinity,nw=null; for(const w of wet){const d=mDist(p.c,w.c); if(d<dmin){dmin=d;}} for(const w of flood){const d=mDist(p.c,w.c); if(!nw||d<nw.d) nw={w,d};}
    if(dmin<150){out.near++; return null;}
    let near=0; for(const w of red) if(mDist(p.c,w.c)<=1500) near+=w.pop;
    const stay=STYPE[p.kind],fa=floorArea(p),floors=fa.h>=7?Math.round(fa.h/3.5):1,cap=stay==='overnight'&&fa.a?Math.floor(fa.a*floors/SPHERE_M2):0;
    const margin=c.elev!=null&&nw?.w.elev!=null?c.elev-(nw.w.elev+nw.w.depth[top]):null,access=g?cs[nearest(g,p.c)]>=big/2:null;
    return {...p,stay,dmin,near,floors,cap,area:fa.a,capSrc:cap?`${fmtFull(fa.a)} m² × ${floors} floor${floors>1?'s':''} (${fa.src}) ÷ ${SPHERE_M2} m²`:'',margin,access}; }).filter(Boolean);
  const rank=(k)=>{const v=list.map(x=>x[k]??-Infinity).sort((a,b)=>a-b); list.forEach(x=>x['r_'+k]=v.length>1?v.indexOf(x[k]??-Infinity)/(v.length-1):1);};
  ['near','cap','margin','dmin'].forEach(rank);
  list.forEach(x=>x.score=(x.r_near+x.r_cap+x.r_margin+x.r_dmin)/4*(x.access===false?.5:1));
  return {list:list.sort((a,b)=>b.score-a.score),out}; }
function pickShelters(cands,n=8){ const pick=[]; for(const c of cands){ if(c.stay!=='overnight'||c.access===false||!c.near) continue; if(pick.every(p=>mDist(p.c,c.c)>400)) pick.push(c); if(pick.length===n) break; } return pick; }
const chips=s=>[s.margin!=null?`${s.margin>=0?'+':''}${Math.round(s.margin)} m above flood water`:'',`${Math.round(s.dmin)} m from water`,
  s.access==null?'':s.access?'dry road access':'⚠ no dry road at the biggest flood',`${fmt(s.near)} at-risk residents within 1.5 km`].filter(Boolean).map(t=>`<span class="chip">${t}</span>`).join('');

/* ---------- safe route A → B on real roads, avoiding water at the peak of the chosen flood size ---------- */
const AB={a:null,b:null,pick:null,mk:{}};
function abSet(which,p){ AB[which.toLowerCase()]=p; AB.mk[which]?.remove(); const el=document.createElement('div'); el.className='abpin'; el.textContent=which;
  AB.mk[which]=new maplibregl.Marker({element:el}).setLngLat(p).addTo(map); }
function abPick(p){ if(!AB.pick) return false; const w=AB.pick; AB.pick=null; map.getCanvas().style.cursor=''; ['abA','abB'].forEach(id=>$(id).setAttribute('aria-pressed',false));
  abSet(w,p); if(AB.a&&(AB.b||w==='A'&&AB.toShelter)) abRoute(); return true; }
function pathOf(g,tree,from){const out=[]; for(let u=from;u>=0;u=tree.prev[u]) out.push(g.pts[u]); return out;}
function abRoute(fit=true){ const r=rp(),mode=AB.mode||$('abMode').value,lim=mode==='car'?CAR_DEPTH:FOOT_DEPTH,out=$('abOut'),off=S.T<.45||S.T>.6; // water at the video's current moment
  const safe=roadGraph(r,mode,lim,false,true),any=roadGraph(r,mode,Infinity,true); if(!safe){out.textContent='Roads are not loaded yet.'; return;}
  const sa=nearest(safe,AB.a),ta=dijkstra(safe,sa); let tb,dest;
  if(AB.toShelter){ let best=Infinity; E.shelters.forEach((s,k)=>{const n=nearest(safe,s.c); if(ta.dist[n]<best){best=ta.dist[n]; tb=n; dest=s;}}); if(dest) abSet('B',dest.c); }
  else tb=nearest(safe,AB.b);
  const F=[],kmh=mode==='car'?CAR_KMH:E.speed,ok=tb!=null&&isFinite(ta.dist[tb]);
  let html='';
  if(ok){ const pts=[AB.a,...pathOf(safe,ta,tb).reverse(),AB.toShelter?dest.c:AB.b],l=prepLine(pts),br=countBridges(pts);
    F.push({type:'Feature',geometry:{type:'LineString',coordinates:pts},properties:{k:'safe'}});
    html=`<b style="color:var(--zg)">Safe route${dest?` to ${esc(dest.name)}`:''}:</b> ${(l.len/1000).toFixed(1)} km, about ${Math.max(1,Math.round(l.len/(kmh*1000/60)))} min ${mode==='car'?'by car':'on foot'}.`
      +(br?` Crosses ${br} bridge${br>1?'s':''}: bridges over a flooded river can be damaged or blocked by debris, check them first.`:''); }
  else html=`<b style="color:var(--err)">No dry route</b> ${mode==='car'?'by car':'on foot'} at this moment of the flood. Leave earlier, or stay on high ground or upper floors and call 112.`;
  if(any&&AB.b){ const na=nearest(any,AB.a),t=dijkstra(any,na),nb=nearest(any,AB.b); if(isFinite(t.dist[nb])){ const pts=pathOf(any,t,nb).reverse(),wet=wetLen(pts,r,lim);
    if(wet>0){ F.push({type:'Feature',geometry:{type:'LineString',coordinates:pts},properties:{k:'normal'}});
      html+=`<br><span style="color:var(--cut)">The usual shortest route (dashed) has ${Math.round(wet)} m under ${lim} m of water or more.</span>`; } } }
  map.getSource('ab').setData({type:'FeatureCollection',features:F}); out.innerHTML=html+`<br><span class="hint">Water ${off?`at the moment shown in the video (${['rising','','going down'][S.T<.45?0:2]})`:'at the peak'} of the ${sizeWord(r).toLowerCase()} flood. Move the timeline and press the button again to compare. Limits: car ${CAR_DEPTH} m, walking ${FOOT_DEPTH} m (assumptions).</span>`;
  if(F.length&&fit) map.fitBounds(bboxOf([F.flatMap(f=>f.geometry.coordinates)]),{padding:90,duration:900,pitch:map.getPitch(),bearing:map.getBearing()}); return html; }
function countBridges(pts){let n=0,on=false; for(let j=1;j<pts.length;j++){const s=roadSegs.get(kk(pts[j-1])+'|'+kk(pts[j]))||roadSegs.get(kk(pts[j])+'|'+kk(pts[j-1])),b=!!s?.bridge; if(b&&!on) n++; on=b;} return n;}
function wetLen(pts,r,lim){let m=0; for(let j=1;j<pts.length;j++){const s=roadSegs.get(kk(pts[j-1])+'|'+kk(pts[j]))||roadSegs.get(kk(pts[j])+'|'+kk(pts[j-1])); if(s&&s.cs.some(c=>nowDepth(c,r)>lim)) m+=s.len;} return m;}
function abStart(w){ AB.pick=w; AB.toShelter=false; $('ab'+w).setAttribute('aria-pressed',true); map.getCanvas().style.cursor='crosshair'; toast(`Click the map to set ${w}`); }
$('abA').onclick=()=>abStart('A'); $('abB').onclick=()=>abStart('B');
$('abShelter').onclick=()=>{ AB.toShelter=true; AB.b=null; if(AB.a) abRoute(); else { AB.pick='A'; $('abA').setAttribute('aria-pressed',true); map.getCanvas().style.cursor='crosshair'; toast('Click the map to set A (where you are)'); } };
$('abMode').onchange=()=>{ if(AB.a&&(AB.b||AB.toShelter)) abRoute(); };

/* ---------- pause the video and click: what is here, and the safe way out at this moment ---------- */
function inspect(p){ const c=cellAt(p); if(!c){ toast('Outside the study area'); return; } const r=rp(),now=nowDepth(c,r),peakD=c.depth[r],near=D.places?.filter(x=>x.group==='critical'&&mDist(x.c,p)<300)||[];
  abSet('A',p); AB.toShelter=true; AB.b=null; AB.mode='foot'; const route=abRoute(false); AB.mode=null;
  new maplibregl.Popup({closeButton:true,maxWidth:'280px',className:'insp'}).setLngLat(p).setHTML(`<b>${['','Green zone (safer)','Yellow zone (caution)','Red zone (high risk)'][c.z]}</b><br>
    Water now: <b>${now>.01?now.toFixed(2)+' m':'dry'}</b> · at the peak: ${peakD>.01?peakD.toFixed(2)+' m':'dry'}<br>
    ${peakD>.01?`Wave ${waveOf(floodStart(c,r))} (wave 1 = water arrives first)<br>`:''}${fmt(c.pop)} residents in this cell
    ${near.length?`<br>Nearby: ${near.slice(0,3).map(x=>esc(x.name||kindName(x.kind))).join(', ')}`:''}
    <hr style="border:0;border-top:1px solid var(--line);margin:6px 0">${route||''}`).addTo(map); }
