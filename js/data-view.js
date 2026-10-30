// data-view.js - Data tab: every dataset the app uses, shown as it is (raw values on the map, tables with CSV download),
// plus your own GeoJSON / CSV files (e.g. exported from Colab). Nothing here changes the simulation.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

const DV={on:new Set(),user:[],hooked:false};
const seq=(lo,hi,a,b)=>['interpolate',['linear'],['get',a],lo,b[0],hi,b[1]]; // one hue, light → dark
const DSETS=[
  {id:'efas',name:'Water depth',src:'EFAS flood hazard maps (Copernicus CEMS)',file:'cems-efas/Europe_RP10 · RP100 · RP500_filled_depth.tif',kind:'challenge',
    count:()=>`${fmtFull(D.cells.length)} cells (~60 × 90 m)`,fields:()=>(D.base||D.rps).map(r=>'depth_rp'+r).join(', ')+' (m)',
    layer:()=>({id:'raw-efas',type:'fill',source:'cells',paint:{'fill-color':['step',['get','r'+rp()],css('--w1'),.5,css('--w2'),1.5,css('--w3')],'fill-opacity':['case',['>',['get','r'+rp()],0],.85,0]}}),
    legend:()=>`Depth for 1-in-${rp()} (change the flood size in Simulate)`,ramp:()=>[[css('--w1'),'< 0.5 m'],[css('--w2'),'0.5–1.5 m'],[css('--w3'),'> 1.5 m']],
    rows:()=>[['cell','lon','lat',...D.rps.map(r=>'depth_rp'+r)],...D.cells.map((c,i)=>[i,c.c[0].toFixed(5),c.c[1].toFixed(5),...D.rps.map(r=>c.depth[r])])]},
  {id:'dem',name:'Ground height',src:'Copernicus DEM GLO-30 (AWS open data)',file:'Copernicus_DSM_COG_10_N50_00_E005_00_DEM (lowest value per cell)',kind:'external',
    count:()=>`${fmtFull(D.cells.filter(c=>c.elev!=null).length)} cells`,fields:()=>'elev (m above sea level)',
    layer:()=>{const z=D.cells.map(c=>c.elev).filter(v=>v!=null),lo=Math.min(...z),hi=Math.max(...z); DV.demR=[lo,hi];
      return {id:'raw-dem',type:'fill',source:'cells',paint:{'fill-color':seq(lo,hi,'elev',['#f3ead8','#6b4219']),'fill-opacity':['case',['>=',['get','elev'],0],.8,0]}};},
    legend:()=>'Ground height',ramp:()=>[['#f3ead8',`${Math.round(DV.demR?.[0]??0)} m`],['#6b4219',`${Math.round(DV.demR?.[1]??0)} m`]],
    rows:()=>[['cell','lon','lat','elev_m'],...D.cells.map((c,i)=>[i,c.c[0].toFixed(5),c.c[1].toFixed(5),c.elev??''])]},
  {id:'pop',name:'Residents',src:'GHS-POP R2023A, 2020 (JRC), ~1 km cells shared over residential buildings',file:'ghs_pop/GHS_POP_E2020_GLOBE_R2023A_4326_30ss',kind:'challenge',
    count:()=>`${fmtFull(D.cells.reduce((s,c)=>s+c.pop,0))} residents in the study area`,fields:()=>'pop (residents per cell)',
    layer:()=>{const hi=Math.max(1,...D.cells.map(c=>c.pop)); DV.popHi=hi; return {id:'raw-pop',type:'fill',source:'cells',paint:{'fill-color':seq(0,hi,'pop',['#fdeee6','#9c2a12']),'fill-opacity':['case',['>',['get','pop'],0],.8,0]}};},
    legend:()=>'Residents per cell',ramp:()=>[['#fdeee6','0'],['#9c2a12',fmt(DV.popHi||0)]],
    rows:()=>[['cell','lon','lat','residents'],...D.cells.map((c,i)=>[i,c.c[0].toFixed(5),c.c[1].toFixed(5),c.pop.toFixed(1)])]},
  {id:'obat',name:'Buildings',src:'GHS-OBAT R2024A, 2020 (JRC)',file:'obat_be/GHS_OBAT_GPKG_BEL_E2020_R2024A_V1_0.gpkg',kind:'challenge',
    count:()=>`${fmtFull(D.blds.length)} buildings`,fields:()=>'height (m), use (1 residential, 2 non-residential: check Annex 2), area (m²), residents placed',
    layer:()=>({id:'raw-obat',type:'circle',source:'bldpt',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,['interpolate',['linear'],['get','h'],3,1,15,2.5],16,['interpolate',['linear'],['get','h'],3,3,15,8]],
      'circle-color':['match',['get','use'],1,css('--c-mod'),2,css('--wave2'),css('--muted')],'circle-stroke-color':'#fff','circle-stroke-width':.5}}),
    legend:()=>'Buildings by use (size = height)',ramp:()=>[[css('--c-mod'),'Residential (use 1)'],[css('--wave2'),'Non-residential (use 2)'],[css('--muted'),'Unknown']],
    rows:()=>[['lon','lat','height_m','use','area_m2','residents'],...D.blds.map(b=>[b.c[0].toFixed(6),b.c[1].toFixed(6),b.h,b.use??'',b.area||'',(b.pop||0).toFixed(2)])]},
  {id:'ems',name:'Water seen by satellite, July 2021',src:'Copernicus EMS rapid mapping EMSR518 (images 15 and 18 July 2021)',file:'ems_be/EMSR518_AOI01_DEL_*_observedEventA',kind:'challenge',
    count:()=>`${(D.observed?.features||[]).length} polygons`,fields:()=>'event_type, notation, area',
    layer:()=>({id:'raw-ems',type:'fill',source:'obs',paint:{'fill-color':css('--obs'),'fill-opacity':.6,'fill-outline-color':css('--ink')}}),
    legend:()=>'Flooded area seen by satellite',ramp:()=>[[css('--obs'),'July 2021']],
    rows:()=>{const f=D.observed?.features||[],k=[...new Set(f.flatMap(x=>Object.keys(x.properties||{})))]; return [k,...f.map(x=>k.map(c=>x.properties?.[c]??''))];}},
  {id:'places',name:'Key sites',src:'OpenStreetMap via OpenFreeMap tiles (© OSM contributors)',file:'data/places.geojson',kind:'external',
    count:()=>{const c={}; (D.places||[]).forEach(p=>c[p.kind]=(c[p.kind]||0)+1); return `${(D.places||[]).length} sites: `+Object.entries(c).map(([k,n])=>`${n} ${kindName(k).toLowerCase()}`).join(', ');},fields:()=>'kind, name, footprint area (m²), height (m)',
    layer:()=>({id:'raw-places',type:'circle',source:'places',paint:{'circle-radius':6,'circle-color':['match',['get','group'],'critical',css('--crit'),'shelter',css('--shel'),css('--osm-wood3')],'circle-stroke-color':'#fff','circle-stroke-width':1.5}}),
    legend:()=>'Key sites',ramp:()=>[[css('--crit'),'Hospital, fire, police, town hall'],[css('--shel'),'School, sports hall, community centre'],[css('--osm-wood3'),'Park']],
    rows:()=>[['kind','name','lon','lat','footprint_m2','height_m'],...(D.places||[]).map(p=>[p.kind,p.name,p.c[0],p.c[1],p.area,p.h])]},
  {id:'roads',name:'Roads and paths',src:'OpenStreetMap via OpenFreeMap tiles (© OSM contributors)',file:'data/roads.geojson',kind:'external',
    count:()=>`${fmtFull((D.roads||[]).length)} road pieces`,fields:()=>'type, car allowed, walking allowed, bridge',
    layer:()=>{ if(!map.getSource('rawroads')) map.addSource('rawroads',{type:'geojson',data:{type:'FeatureCollection',features:D.roads||[]}});
      return {id:'raw-roads',type:'line',source:'rawroads',paint:{'line-color':['case',['==',['get','bridge'],1],css('--wave2'),['==',['get','car'],1],css('--ink'),css('--muted')],'line-width':['case',['==',['get','car'],1],1.6,.8]}};},
    legend:()=>'Roads',ramp:()=>[[css('--ink'),'Cars allowed'],[css('--muted'),'Walking only'],[css('--wave2'),'Bridge']],
    rows:()=>[['type','car','foot','bridge','points'],...(D.roads||[]).map(f=>[f.properties.hw||f.properties.cls,f.properties.car,f.properties.foot,f.properties.bridge,f.geometry.coordinates.length])]},
  {id:'rain',name:'Rain records',src:'Open-Meteo ERA5 archive, catchment mean of 4 points',file:'data/weather.json',kind:'external',
    count:()=>WX.data?.rainLevels?`${WX.data.rainLevels.years} years of yearly maxima · July 2021 replay`:'not loaded',fields:()=>'date, rain (mm), rain over 48 h (mm)',
    rows:()=>[['date','rain_mm','rain_48h_mm'],...(WX.data?.replayRain||[]).map(r=>[r.t,r.mm.toFixed(1),r.mm48.toFixed(1)])]}];
const allSets=()=>[...DSETS,...DV.user];

/* ---------- assumptions and sources: the parameter registry (data/params.json) ---------- */
const PTAG={sourced:'<span class="tag data">sourced</span>',assumption:'<span class="tag">assumption</span>',placeholder:'<span class="tag">placeholder</span>'};
function paramsCard(){ const P=PARAMS||{},n=k=>Object.values(P).filter(x=>x.status===k).length;
  return `<div class="dcard"><div class="dhead"><b>Assumptions and sources</b><span class="tag">data/params.json</span></div>
    <div class="hint" style="margin:2px 0">Every number the model uses: ${n('sourced')} sourced, ${n('assumption')} team assumptions, ${n('placeholder')} placeholders until data arrives. Edit the file to change them.</div>
    <details class="cands"><summary>Show all ${Object.keys(P).length}</summary><table class="tbl"><thead><tr><th>Name</th><th>Value</th><th>Status</th><th>Source / note</th></tr></thead><tbody>${
    Object.entries(P).map(([k,x])=>`<tr><td class="mono">${esc(k)}</td><td class="mono">${esc(x.value)} ${esc(x.unit||'')}</td><td>${PTAG[x.status]||esc(x.status||'')}</td><td class="hint">${esc([x.source,x.note].filter(Boolean).join(' · ')||'—')}</td></tr>`).join('')}</tbody></table></details></div>`; }

/* ---------- cards ---------- */
function drawData(){ if(!D) return;
  $('dataCards').innerHTML=paramsCard()+allSets().map(d=>`<div class="dcard"><div class="dhead"><b>${esc(d.name)}</b><span class="tag ${d.kind==='challenge'?'data':''}">${d.kind==='challenge'?'challenge data':d.kind==='user'?'your file':'external source'}</span></div>
    <div class="hint" style="margin:2px 0">${esc(d.src)}</div><div class="mono dfile">${esc(d.file)}</div>
    <div style="font-size:13px;margin:4px 0">${esc(d.count())}<br><span class="hint" style="margin:0">Fields: ${esc(d.fields())}</span></div>
    <div class="row" style="justify-content:flex-start">${d.layer?`<button class="btn sm" data-show="${d.id}" aria-pressed="${DV.on.has(d.id)}">${DV.on.has(d.id)?'Hide on map':'Show on map'}</button>`:''}<button class="btn sm" data-table="${d.id}">Table</button>${d.kind==='user'?`<button class="btn sm" data-zoom="${d.id}">Zoom to</button><button class="btn sm" data-del="${d.id}">Remove</button>`:''}</div></div>`).join('');
  hookData(); applyLayers(); drawLegend(); }
$('dataCards').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; const id=b.dataset.show||b.dataset.table||b.dataset.zoom||b.dataset.del,d=allSets().find(x=>x.id===id); if(!d) return;
  if(b.dataset.show){ if(DV.on.has(id)) DV.on.delete(id); else { if(!map.getLayer('raw-'+id)) map.addLayer(d.layer(),'obs-line'); DV.on.add(id); } drawData(); }
  if(b.dataset.table) showTable(d);
  if(b.dataset.zoom&&d.bbox) map.fitBounds(d.bbox,{padding:60});
  if(b.dataset.del){ DV.on.delete(id); if(map.getLayer('raw-'+id)) map.removeLayer('raw-'+id); if(map.getSource(id)) map.removeSource(id); DV.user=DV.user.filter(x=>x!==d); drawData(); } };

/* ---------- raw layers only in the Data tab (simulation layers hidden there) ---------- */
const SIMLAYERS=['water-img','water-3d','bld-2d','bld-hit','bld-3d','bld-rb','people','cars','roads-cut','roads-dmg','zones','zones-tex','obs-fill','obs-line','places','places-lab','places-name','ab-safe','ab-normal'];
const _alData=applyLayers; applyLayers=function(){ _alData(); if(!ready) return; const inData=S.tab==='data';
  if(inData) SIMLAYERS.forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,'visibility','none'));
  allSets().forEach(d=>{ const l='raw-'+d.id; if(map.getLayer(l)) map.setLayoutProperty(l,'visibility',inData&&DV.on.has(d.id)?'visible':'none'); });
  markers.forEach(m=>m.getElement().hidden=m.getElement().hidden||inData); };
const _dlData=drawLegend; drawLegend=function(){ if(S.tab!=='data') return _dlData(); const on=allSets().filter(d=>DV.on.has(d.id)&&d.ramp);
  $('legend').innerHTML=on.length?on.map(d=>`<div class="t">${esc(d.legend())}</div>${d.ramp().map(([c,t])=>`<div class="li"><span class="sw" style="background:${c}"></span>${esc(t)}</div>`).join('')}`).join(''):'<div class="t">Data</div><div class="li">Press "Show on map" on a dataset.</div>'; };
// hover: exact values of the feature under the mouse
function hookData(){ if(DV.hooked||!ready) return; DV.hooked=true;
  map.on('mousemove',ev=>{ if(S.tab!=='data') return; const ls=allSets().map(d=>'raw-'+d.id).filter(l=>map.getLayer(l)&&DV.on.has(l.slice(4))),f=ls.length&&map.queryRenderedFeatures(ev.point,{layers:ls})[0],tip=$('tip');
    if(!f){tip.hidden=true; return;} const p=f.properties,id=f.layer.id.slice(4);
    const rows=id==='efas'?D.rps.map(r=>[`Depth 1-in-${r}`,`${(+p['r'+r]).toFixed(2)} m`]):id==='dem'?[['Ground height',`${(+p.elev).toFixed(1)} m`]]:id==='pop'?[['Residents',(+p.pop).toFixed(1)]]
      :id==='obat'?[['Height',`${p.h} m`],['Use',p.use==1?'residential':p.use==2?'non-residential':'unknown'],['Footprint',`${fmtFull(+p.area)} m²`],['Residents placed',(+p.bpop).toFixed(1)]]
      :Object.entries(p).filter(([k])=>!/^(r|L)\d+$|^lag$/.test(k)).slice(0,10);
    tip.innerHTML=`<b>${esc(allSets().find(d=>d.id===id)?.name||id)}</b><br>`+rows.map(([k,v])=>`${esc(k)}: <span class="mono">${esc(String(v))}</span>`).join('<br>');
    tip.hidden=false; const w=$('map').clientWidth; tip.style.left=Math.min(ev.point.x+14,w-250)+'px'; tip.style.top=(ev.point.y+14)+'px'; }); }

/* ---------- table view ---------- */
let dsCur=null;
function showTable(d){ const rows=d.rows(),head=rows[0],body=rows.slice(1),N=500; dsCur={d,rows};
  $('dsTitle').textContent=`${d.name} · ${fmtFull(body.length)} rows`;
  $('dsTable').innerHTML=!body.length?'<div class="empty">No rows in this dataset.</div>':`<table class="tbl"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.slice(0,N).map(r=>`<tr>${r.map(v=>`<td class="mono">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${body.length>N?`<p class="hint">Showing the first ${N} rows: download the CSV for all ${fmtFull(body.length)}.</p>`:''}`;
  $('dataStage').hidden=false; }
$('dsClose').onclick=()=>$('dataStage').hidden=true;
$('dsCsv').onclick=()=>{ if(!dsCur) return; saveFile(`${dsCur.d.id}.csv`,dsCur.rows.map(r=>r.map(v=>/[",;\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n')); };

/* ---------- your own file (GeoJSON or CSV with lon/lat) ---------- */
function parseCsv(t){ const rows=[]; let r=[],f='',q=false; for(let i=0;i<t.length;i++){ const c=t[i];
    if(q){ if(c==='"'&&t[i+1]==='"'){f+='"';i++;} else if(c==='"') q=false; else f+=c; }
    else if(c==='"') q=true; else if(c===','||c===';'){ r.push(f); f=''; } else if(c==='\n'||c==='\r'){ if(c==='\r'&&t[i+1]==='\n') i++; r.push(f); f=''; if(r.some(x=>x!=='')) rows.push(r); r=[]; } else f+=c; }
  r.push(f); if(r.some(x=>x!=='')) rows.push(r); return rows; }
$('fUser').onchange=()=>{ const file=$('fUser').files[0],st=$('slotUser').querySelector('.st'); if(!file) return; st.textContent='Reading…';
  const rd=new FileReader(); rd.onload=()=>{ try{
    let fc; if(/\.csv$/i.test(file.name)){ const rows=parseCsv(rd.result),h=rows[0].map(x=>x.trim()),lo=h.findIndex(x=>/^(lon|lng|long|longitude|x)$/i.test(x)),la=h.findIndex(x=>/^(lat|latitude|y)$/i.test(x));
        if(lo<0||la<0) throw new Error(`no longitude/latitude columns found (columns: ${h.slice(0,8).join(', ')})`);
        fc={type:'FeatureCollection',features:rows.slice(1).filter(r=>isFinite(+r[lo])&&isFinite(+r[la])&&r[lo]!==''&&r[la]!=='').map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[+r[lo],+r[la]]},properties:Object.fromEntries(h.map((k,i)=>[k,r[i]]))}))}; }
      else fc=JSON.parse(rd.result);
    if(!Array.isArray(fc.features)||!fc.features.length) throw new Error('no features found (expected a GeoJSON FeatureCollection)');
    const pts=fc.features.flatMap(f=>{const g=f.geometry; if(!g) return []; const a=JSON.stringify(g.coordinates).match(/-?\d+\.?\d*(e-?\d+)?/g)?.map(Number)||[]; const o=[]; for(let i=0;i+1<a.length;i+=2) o.push([a[i],a[i+1]]); return o;});
    if(pts.some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90)) throw new Error('coordinates look projected (metres): re-export with gdf.to_crs(4326)');
    const bb=bboxOf([pts]),[x0,y0,x1,y1]=D.bbox,overlap=bb[0]<x1&&bb[2]>x0&&bb[1]<y1&&bb[3]>y0,id='user'+(DV.user.length+1),types=new Set(fc.features.map(f=>f.geometry?.type)),col=css(['--crit','--wave2','--c-both','--accent'][DV.user.length%4]);
    map.addSource(id,{type:'geojson',data:fc});
    const keys=[...new Set(fc.features.flatMap(f=>Object.keys(f.properties||{})))];
    DV.user.push({id,name:file.name,src:'Your file',file:file.name,kind:'user',bbox:bb,count:()=>`${fmtFull(fc.features.length)} features (${[...types].join(', ')})`,fields:()=>keys.slice(0,12).join(', ')||'none',
      layer:()=>({id:'raw-'+id,type:[...types].some(t=>/Polygon/.test(t))?'fill':[...types].some(t=>/Line/.test(t))?'line':'circle',source:id,
        paint:[...types].some(t=>/Polygon/.test(t))?{'fill-color':col,'fill-opacity':.5,'fill-outline-color':css('--ink')}:[...types].some(t=>/Line/.test(t))?{'line-color':col,'line-width':2}:{'circle-radius':5,'circle-color':col,'circle-stroke-color':'#fff','circle-stroke-width':1}}),
      legend:()=>file.name,ramp:()=>[[col,`${fmtFull(fc.features.length)} features`]],rows:()=>[keys,...fc.features.map(f=>keys.map(k=>f.properties?.[k]??''))]});
    DV.on.add(id); map.addLayer(DV.user[DV.user.length-1].layer(),'obs-line');
    st.textContent=`✓ ${file.name}: ${fmtFull(fc.features.length)} features${overlap?'':' · outside the study area: press "Zoom to"'}`; $('slotUser').classList.add('ok'); drawData();
  }catch(err){ st.textContent='✗ '+err.message; $('slotUser').classList.remove('ok'); } }; rd.readAsText(file); };
