// data-loader.js - Reads + validates the 3 GeoJSON files (grid, observed_2021, buildings) and the "Load team data" window.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

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
    const p=f.properties||{}; places.push({c,ci,kind:p.kind,group:p.group,name:p.name||'',area:+p.area_m2||0,h:+p.height_m||0});}
  if(places.length) ok(`Places: ${places.length} (hospitals, schools, sports halls…).`);
  const roads=(files.roads?.features||[]).filter(f=>f.geometry?.type==='LineString');
  if(roads.length) ok(`Roads: ${roads.length.toLocaleString()} from OpenStreetMap.`);
  return {log,data:{cells,rps,blds,places,roads,observed:files.observed||null,hasObs:obsPolys.length>0,hasFp:blds.filter(b=>b.fp).length>blds.length/2,towns:(files.towns?.features||[]).map(f=>({name:f.properties.name,cls:f.properties.class,c:f.geometry.coordinates})),bbox:bboxOf(cells.map(c=>c.ring))}};
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
// returns true when team data was loaded (otherwise the caller shows the demo)
// which data folder: data/ (default) or another area exported to data/cities/<name>/ and chosen in the top bar (?area=cities/<name>)
const DATA_AREA=(new URLSearchParams(location.search).get('area')||'').replace(/[^\w\-\/]/g,'').replace(/^\/+|\/+$/g,''),DATA_DIR=DATA_AREA?`data/${DATA_AREA}/`:'data/';
async function tryAutoLoad(){
  if(!/^https?:$/.test(location.protocol)) return false;
  // all files at once; 'no-cache' re-downloads only when a file changed. Real building outlines when exported, else GHS-OBAT points
  const get=async n=>{ try{ const r=await fetch(DATA_DIR+n,{cache:'no-cache'}); return r.ok?await r.json():null; }catch(e){ return null; } };
  const [grid,observed,fp,pts,places,roads,towns]=await Promise.all(['grid','observed_2021','buildings_fp','buildings','places','roads','towns'].map(n=>get(n+'.geojson')));
  if(!grid) return false;
  const r=ingest({grid,observed,buildings:fp||pts,places,roads,towns});
  if(r.data){ load(r.data,false); toast('Team data loaded from the data folder'); return true; }
  toast('data/grid.geojson has a problem: '+r.log.filter(l=>l.e).map(l=>l.m).join(' ')); return false;
}
