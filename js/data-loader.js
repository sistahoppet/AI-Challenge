// data-loader.js - Reads + validates the 3 GeoJSON files (grid, observed_2021, buildings) and the "Load team data" window.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- parameter registry: every number the model uses, with status and source (data/params.json overrides these) ---------- */
const DEFAULT_PARAMS={"comply": {"value": 80, "unit": "%", "status": "sourced", "source": "Endendijk et al. 2023, Journal of Coastal and Riverine Flood Risk: 75.7% of advised residents left (Limburg 2021)", "note": "range 70–80%"}, "doorBoost": {"value": 0, "unit": "percentage points", "status": "placeholder", "source": "", "note": "set to 0 until sourced (pessimistic). no study isolates door-to-door. Personal advice raised evacuation from 18.9% to 75.7% (Endendijk 2023); 'no single channel is likely to reach all people' (Pescaroli & Magni 2015)"}, "mob": {"value": 60, "unit": "min", "status": "sourced (proxy)", "source": "KLD Evacuation Time Estimate, Lee Nuclear Station (NRC ML073510574), Table 5-5: 62% ready by 30 min, 82% by 1 h, 97% by 2 h", "note": "US nuclear-plant study, not a European flood: replace when a local curve exists"}, "delay": {"value": 15, "unit": "min", "status": "assumption", "source": "", "note": "delay on the way (traffic, closures)"}, "speedCar": {"value": 20, "unit": "km/h", "status": "sourced (proxy)", "source": "FLOODsite Evacuation Calculator (c.2009): 'usually an average velocity of 20 km/hour is used' in flood evacuation models; legal limits 50 km/h built-up, 90 km/h outside built-up areas in Wallonia (police.be 2024)", "note": "average speed in evacuation traffic, below legal limits"}, "carDepth": {"value": 0.3, "unit": "m", "status": "sourced", "source": "AIDR Guideline 7-3 Flood Hazard, 2017 (class H1: ≤0.3 m and ≤2 m/s)", "note": ""}, "footDepth": {"value": 0.15, "unit": "m", "status": "sourced", "source": "AIDR Guideline 7-3, 2017 (≤0.3 m generally safe; 0.15 m kept as a conservative limit)", "note": ""}, "leadMin": {"value": 180, "unit": "min", "status": "assumption", "source": "", "note": "July 2021 Vesdre: ~0–3 h between alerts and the water (Walloon Parliament inquiry 2022)"}, "sphere": {"value": 3.5, "unit": "m² per person", "status": "sourced", "source": "Sphere Handbook 2018 (minimum covered living space)", "note": "humanitarian standard, not a Belgian norm; set in js/places.js"}, "squeeze": {"value": 30, "unit": "%", "status": "assumption", "source": "", "note": "extra emergency places when a shelter is full"}, "rescueRate": {"value": 60, "unit": "people/h", "status": "placeholder", "source": "", "note": "no published rate for the Vesdre. 2021 context: fire zone Vesdre-Hoëgne & Plateau ~3,300 missions in 72 h (~46/h, L'Avenir 2022); 9 helicopters rescued 21 people in 42 flight hours (L'Avenir 2021). Ask the rescue zone."}, "rescueMob": {"value": 30, "unit": "min", "status": "placeholder", "source": "", "note": "rescue starts this long after the first person is in danger"}, "nationalX": {"value": 3, "unit": "×", "status": "placeholder", "source": "", "note": "no source. 2021: Civil Protection ~30 agents and 6 boats at first, then max ~60 staff per day (L'Avenir 2021); ~300 foreign rescuers, 50 boats"}, "shelterShare": {"value": 25, "unit": "%", "status": "assumption", "source": "", "note": "evidence: ~4.5% went to public centres in Limburg 2021 (Endendijk 2023); Verviers plan 600 beds for ~4,600 people (~13%); 25% keeps a large margin"}, "riverbankM": {"value": 50, "unit": "m", "status": "assumption", "source": "", "note": "homes this close to the river: upstairs unreliable, evacuate early (houses collapsed along the Vesdre in Pepinster, July 2021)"}, "storey": {"value": 3, "unit": "m", "status": "assumption", "source": "", "note": "a building has a safe floor if it is at least this much taller than the water"}, "R0": {"value": 60, "unit": "%", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "Q0": {"value": 70, "unit": "%", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "R1": {"value": 90, "unit": "%", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "Q1": {"value": 80, "unit": "%", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "T0": {"value": 6, "unit": "h", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "T1": {"value": 2, "unit": "h", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "C": {"value": 2, "unit": "€M", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "D0": {"value": 30, "unit": "€M", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}, "D1": {"value": 18, "unit": "€M", "status": "placeholder", "source": "", "note": "Impact table: illustrative until data arrives"}};
let PARAMS=DEFAULT_PARAMS;
// push the registry into the model variables (they live in later files; this runs after start-up)
function applyParams(P){ PARAMS={...DEFAULT_PARAMS,...P}; const set=(k,f)=>{ const v=PARAMS[k]?.value; if(v!=null&&isFinite(+v)) f(+v); };
  set('comply',x=>DR.comply=x); set('doorBoost',x=>DOOR_BOOST=x/100); set('mob',x=>FW.mob=x); set('delay',x=>FW.delay=x); set('speedCar',x=>E.speed=x);
  set('carDepth',x=>CAR_DEPTH=x); set('footDepth',x=>FOOT_DEPTH=x); set('leadMin',x=>SC.leadMin=x); set('squeeze',x=>SQUEEZE=x/100); set('rescueRate',x=>DR.rescue=x);
  set('rescueMob',x=>RESCUE_MOB=x); set('nationalX',x=>SUPPORT_X=x); set('shelterShare',x=>DR.share=x); set('storey',x=>STOREY=x);
  ['R0','Q0','R1','Q1','T0','T1','C','D0','D1'].forEach(k=>set(k,x=>IM[k]=x));
  Object.assign(DR0,{comply:DR.comply,rescue:DR.rescue,lead:SC.leadMin,mob:FW.mob,delay:FW.delay,speed:E.speed});
  const inp={'sc-leadMin':SC.leadMin,'fw-mob':FW.mob,'fw-delay':FW.delay,'evSpeedMs':E.speed,'sf-car':CAR_DEPTH,'sf-foot':FOOT_DEPTH}; for(const id in inp) if($(id)) $(id).value=inp[id];
  document.querySelectorAll('#impIn [data-im]').forEach(i=>i.value=IM[i.dataset.im]); }
// CSV with a header row → objects (keys lower-case)
function csvObjects(text){ const rows=parseCsv(text); if(rows.length<2) return []; const h=rows[0].map(x=>x.trim().toLowerCase()); return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]??'').trim()]))); }
const lonOf=o=>+(o.lon??o.lng??o.longitude??o.x),latOf=o=>+(o.lat??o.latitude??o.y);

/* ---------- ingest (validates team files) ---------- */
function ingest(files){
  const log=[],err=m=>log.push({e:1,m}),ok=m=>log.push({e:0,m}); const g=files.grid;
  if(!g||!Array.isArray(g.features)||!g.features.length){err('Grid file is missing or has no features.');return {log};}
  const rpSet=new Set(); g.features.slice(0,500).forEach(f=>Object.keys(f.properties||{}).forEach(k=>{const m=k.match(RP_RE); if(m) rpSet.add(+m[1]);}));
  const rps=[...rpSet].sort((a,b)=>a-b);
  if(!rps.length){err('No depth columns found. Name them depth_rp10, depth_rp100, … (metres).');return {log};}
  const cells=[]; let projected=false;
  for(const f of g.features){const ps=polysOf(f.geometry); if(!ps.length) continue; const ring=ps[0][0];
    if(Math.abs(ring[0][0])>180||Math.abs(ring[0][1])>90){projected=true;break;}
    const p=f.properties||{},depth={}; rps.forEach(rp=>{const v=+p['depth_rp'+rp]; depth[rp]=isFinite(v)&&v>0?v:0;});
    cells.push({ring,poly:ps[0],c:centroidOf(f.geometry),depth,pop:+p.pop>0?+p.pop:0,area:ringArea(ring),obs:false,elev:p.elev!=null&&isFinite(+p.elev)?+p.elev:null});}
  if(projected){err('Coordinates look projected (metres). Re-export with gdf.to_crs(4326).');return {log};}
  ok(`Grid: ${cells.length.toLocaleString()} cells, flood sizes ${rps.map(r=>'1-in-'+r).join(', ')}.`);
  if(!cells.some(c=>c.pop>0)) ok('No "pop" column: resident counts will show 0.');
  const obsPolys=[]; (files.observed?.features||[]).forEach(f=>polysOf(f.geometry).forEach(p=>obsPolys.push({p,b:bboxOf([p[0]])})));
  const inObs=(x,y)=>obsPolys.some(o=>x>=o.b[0]&&x<=o.b[2]&&y>=o.b[1]&&y<=o.b[3]&&pipPoly(x,y,o.p));
  if(obsPolys.length){cells.forEach(c=>c.obs=inObs(c.c[0],c.c[1])); ok(`2021 flood: ${obsPolys.length} polygon(s), ${cells.filter(c=>c.obs).length} cells inside.`);}
  else ok('No 2021 file: comparison with the satellite map is hidden.');
  const idx=makeIndex(cells,c=>bboxOf([c.ring])),blds=[]; let missed=0;
  for(const f of (files.buildings?.features||[])){const c=f.geometry&&centroidOf(f.geometry); if(!c) continue;
    let ci=-1; for(const i of idx.query(c[0],c[1])) if(pipPoly(c[0],c[1],cells[i].poly)){ci=i;break;}
    if(ci<0) missed++; const h=+(f.properties?.height??f.properties?.height_m);
    const bp=+f.properties?.pop; blds.push({c,geom:f.geometry,h:isFinite(h)&&h>0?h:8,ci,pop:bp>0?bp:0,use:f.properties?.use??null,kind:f.properties?.kind??null,fp:f.geometry.type!=='Point',area:+f.properties?.area||0,obs:obsPolys.length?inObs(c[0],c[1]):false});}
  if(blds.length) ok(`Buildings: ${blds.length.toLocaleString()}${missed?` (${missed} outside the grid, not counted)`:''}.`);
  else ok('No buildings file: building counts will show 0.');
  // OpenStreetMap places (hospitals, schools…) and roads: optional, from scripts/export_tiles.py or export_osm.py
  const places=[]; for(const f of (files.places?.features||[])){const c=f.geometry?.type==='Point'&&f.geometry.coordinates; if(!c) continue;
    let ci=-1; for(const i of idx.query(c[0],c[1])) if(pipPoly(c[0],c[1],cells[i].poly)){ci=i;break;}
    const p=f.properties||{}; places.push({c,ci,kind:p.kind,group:p.group,name:p.name||'',area:+p.area_m2||0,h:+p.height_m||0,obs:obsPolys.length?inObs(c[0],c[1]):false});}
  if(places.length) ok(`Places: ${places.length} (hospitals, schools, sports halls…).`);
  const roads=(files.roads?.features||[]).filter(f=>f.geometry?.type==='LineString');
  if(roads.length) ok(`Roads: ${roads.length.toLocaleString()} from OpenStreetMap.`);
  // optional files of the data pipeline (data/README.md)
  const rivers=[]; for(const f of (files.rivers?.features||[])){ const g=f.geometry; if(g?.type==='LineString') rivers.push(g.coordinates); else if(g?.type==='MultiLineString') rivers.push(...g.coordinates); }
  if(rivers.length) ok(`Rivers: ${rivers.length.toLocaleString()} lines (riverbank homes).`);
  const shelterCap=(files.shelterCap||[]).map(o=>({name:o.name||'',c:[lonOf(o),latOf(o)],cap:+o.capacity,source:o.source||''})).filter(x=>isFinite(x.c[0])&&isFinite(x.c[1])&&x.cap>0);
  if(shelterCap.length) ok(`Shelter capacities: ${shelterCap.length} sites with an official or checked capacity.`);
  const q2=Array.isArray(files.q2)?files.q2:[]; if(q2.length) ok(`Measures since 2021: ${q2.length}.`);
  const prm=(files.prm||[]).map(o=>({name:o.name||'',c:[lonOf(o),latOf(o)],r65:+o.residents_65plus||0,r80:+o.residents_80plus||0,source:o.source||''})).filter(x=>isFinite(x.c[0]));
  const munis=(files.munis?.features||[]).filter(f=>polysOf(f.geometry).length).map(f=>({name:f.properties?.name||'',polys:polysOf(f.geometry)}));
  return {log,data:{cells,rps,blds,places,roads,rivers,shelterCap,q2,prm,munis,observed:files.observed||null,hasObs:obsPolys.length>0,hasFp:blds.filter(b=>b.fp).length>blds.length/2,towns:(files.towns?.features||[]).map(f=>({name:f.properties.name,cls:f.properties.class,c:f.geometry.coordinates})),bbox:bboxOf(cells.map(c=>c.ring))}};
}

/* ---------- data loading modal ---------- */
const picked={};
function readFile(input,key,slot){input.onchange=()=>{const f=input.files[0]; if(!f) return; const st=$(slot).querySelector('.st'); st.textContent='Reading…';
  const r=new FileReader(); r.onload=()=>{try{picked[key]=JSON.parse(r.result); st.textContent=`✓ ${f.name} · ${(picked[key].features||[]).length.toLocaleString()} features`; $(slot).classList.add('ok');}
    catch(e){st.textContent='✗ Not valid GeoJSON. Export with gdf.to_file(..., driver="GeoJSON").'; delete picked[key]; $(slot).classList.remove('ok');}}; r.readAsText(f);};}
readFile($('fGrid'),'grid','slotGrid'); readFile($('fObs'),'observed','slotObs'); readFile($('fBld'),'buildings','slotBld');
$('openData').onclick=()=>{$('modal').hidden=false; $('log').innerHTML='';};
$('mClose').onclick=()=>$('modal').hidden=true;
$('modal').onclick=e=>{if(e.target.id==='modal') $('modal').hidden=true;};
document.addEventListener('keydown',e=>{if(e.key==='Escape') $('modal').hidden=true;});
$('mApply').onclick=()=>{const r=ingest(picked); $('log').innerHTML=r.log.map(l=>`<li class="${l.e?'err':''}">${esc(l.m)}</li>`).join(''); if(!r.data) return; load(r.data,false); setTimeout(()=>$('modal').hidden=true,1200);};
$('useDemo').onclick=()=>{load(ingest(makeDemo()).data,true); $('modal').hidden=true;};

/* ---------- auto-load from the data/ folder ----------
   When the app runs on a local server (VS Code "Live Server"), it looks for
   data/grid.geojson (+ optional observed_2021.geojson, buildings.geojson)
   and shows them instead of the demo. Opening index.html by double-click
   (file://) cannot read the folder: use "Load team data" instead. */
async function tryAutoLoad(){
  if(!/^https?:$/.test(location.protocol)) return;
  const get=async n=>{ try{ const r=await fetch('data/'+n,{cache:'no-store'}); return r.ok?await r.json():null; }catch(e){ return null; } };
  const getT=async n=>{ try{ const r=await fetch('data/'+n,{cache:'no-store'}); return r.ok?await r.text():null; }catch(e){ return null; } };
  const params=await get('params.json'); if(params) applyParams(params); // parameter registry: values, status and sources
  const grid=await get('grid.geojson'); if(!grid) return;
  const csvF=async n=>{ const t=await getT(n); return t?csvObjects(t):null; };
  const r=ingest({grid,observed:await get('observed_2021.geojson'),buildings:await get('buildings_fp.geojson')||await get('buildings.geojson'),places:await get('places.geojson'),roads:await get('roads.geojson'),towns:await get('towns.geojson'),
    rivers:await get('rivers.geojson'),shelterCap:await csvF('shelter_capacity.csv'),q2:await get('q2_measures.json'),prm:await csvF('prm.csv'),munis:await get('municipalities.geojson')});
  if(r.data){ load(r.data,false); toast('Team data loaded from the data folder'); }
  else toast('data/grid.geojson has a problem: '+r.log.filter(l=>l.e).map(l=>l.m).join(' '));
}
