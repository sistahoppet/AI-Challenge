// server-areas.js - every July 2021 mapped area (Copernicus EMS AOI) loaded straight from the team flood API, no local file:
//   list of areas        = GET /impact (one row per AOI, with people affected in 2021)
//   area box             = the 1 km cells returned by POST /flood on the AOI code (their lon/lat), + 800 m
//   map cells (100 m)    = POST /region on that box: EFAS depth per flood size, GHS-POP residents, ground height, terrain risk
//   emergency places     = the facilities file of that /region run (OpenStreetMap)
// The same results feed the Live model tab and the policy advice. Nothing is made up: what the server does not send stays empty.
// Also: the "Data sources" page (what every layer of the loaded area comes from), for the jury.

let AOIS=[];
async function aoiList(){ if(AOIS.length) return AOIS;
  try{ const j=await (await fetch(A.url+'/impact',{cache:'no-store'})).json();
    AOIS=(j.aois||[]).map(a=>({code:`${a.activation}_${a.aoi}_${a.product}`,country:a.country,affected:Math.round(a.affected||0),flooded:Math.round(a.flooded||0)}))
      .sort((a,b)=>b.affected-a.affected); }catch(e){}
  return AOIS; }
// server facility kinds → map places (critical sites are checked for water; shelters are shown, their size is not known)
const FAC={hospital:'critical',fire_station:'critical',police:'critical',ambulance_station:'critical',shelter:'shelter',candidate_shelter:'shelter'};

const srvMsg=m=>{ const e=$('srvLoad'); e.hidden=!m; e.innerHTML=m||''; };
async function getJson(u){ try{ const r=await fetchRetry(u,{cache:'no-store'}); return r.ok?await r.json():null; }catch(e){ return null; } }

async function loadServerArea(code){
  const nm='aoi_'+code, bn='aoibox_'+code, info=AOIS.find(a=>a.code===code)||(await aoiList()).find(a=>a.code===code);
  try{
    // 1. flood + evacuation model on the AOI (reuses the server's last run of this AOI when it has all 3 flood sizes)
    srvMsg(`<b>${esc(code)}</b> from the team server<br>1/3 · flood and evacuation model…`);
    let fl=await getJson(`${A.url}/files/regions/${nm}/summary.json`);
    if(!fl?.floods?.rp10||!fl?.floods?.rp100||!fl?.floods?.rp500) fl=await apiJob('/flood',{name:nm,region:{type:'aoi',aoi:code},floods:['rp10','rp100','rp500']});
    A.res.flood=fl;
    const csv=await fetch(`${A.url}/files/regions/${nm}/danger_rp100.csv`,{cache:'no-store'}).then(r=>r.ok?r.text():'').catch(()=>'');
    // 1 km cells: lon, lat (last columns) and people (10th column, before any quoted text)
    const ll=csv.trim().split('\n').slice(1).map(l=>{ const f=l.split(','),x=f.slice(-2).map(Number); return [x[0],x[1],+f[9]||0]; }).filter(p=>isFinite(p[0])&&isFinite(p[1]));
    if(!ll.length) throw new Error('the server sent no cells for this area');
    // boxes to try, largest first: all cells (+800 m, +500 m); then, when the AOI is too big (> 3000 km²) or partly outside the
    // server's study region, the cells within 20 → 3 km of the 1 km cell with the most people affected
    const bx=(pts,pad)=>{ const px=pad/Math.cos(pts[0][1]*Math.PI/180);
      return [Math.min(...pts.map(p=>p[0]))-px,Math.min(...pts.map(p=>p[1]))-pad,Math.max(...pts.map(p=>p[0]))+px,Math.max(...pts.map(p=>p[1]))+pad].map(r4); };
    const top=ll.reduce((a,p)=>p[2]>a[2]?p:a,ll[0]);
    const tries=[[bx(ll,.008),''],[bx(ll,.0045),''],...[20,12,8,5,3].map(R=>{ const pts=ll.filter(p=>mDist(p,top)<=R*1000);
      return [bx(pts,.0045),`the ${R} km around the most affected spot (${r4(top[1])}, ${r4(top[0])}); the server could not run the whole 2021 area (too big, outside its study region, or a server error)`]; })]
      .filter(([t])=>km2(t)<=3000);
    // 2. 100 m cells of that box (same fields as data/grid.geojson after renaming)
    srvMsg(`<b>${esc(code)}</b> from the team server<br>2/3 · 100 m cells: water depth, residents, terrain risk…`);
    let rg=null,b,part='',err;
    for(const [t,why] of tries){ try{ rg=await apiJob('/region',{name:bn,bbox:t,top_n:20}); b=t; part=why; break; }catch(e){ err=e; } } // smaller box on any refusal (size, study region, a bad server tile, a dropped request)
    if(!rg) throw err;
    const cells=await getJson(fileUrl(rg.files?.cells)), fac=await getJson(fileUrl(rg.files?.facilities));
    if(!cells?.features?.length) throw new Error('the server sent no map cells for this area');
    A.cells=cells.features;
    // 3. into the app
    srvMsg(`<b>${esc(code)}</b> from the team server<br>3/3 · drawing…`);
    const grid={type:'FeatureCollection',features:cells.features.map(f=>{ const p=f.properties||{};
      return {type:'Feature',geometry:f.geometry,properties:{depth_rp10:p.d10,depth_rp100:p.d100,depth_rp500:p.d500,pop:p.pop,elev:p.elev}}; })};
    const places={type:'FeatureCollection',features:(fac?.features||[]).filter(f=>FAC[f.properties?.kind]&&f.geometry?.type==='Point')
      .map(f=>({type:'Feature',geometry:f.geometry,properties:{kind:f.properties.kind,group:FAC[f.properties.kind],name:f.properties.name||''}}))};
    const r=ingest({grid,places}); if(!r.data) throw new Error(r.log.filter(l=>l.e).map(l=>l.m).join(' '));
    STUDY={name:`${info?.country||''} · ${code.replace(/_/g,' ')}${part?' (part)':''}`,part,gauge:'area centre',gaugeAt:[(b[0]+b[2])/2,(b[1]+b[3])/2],server:code,flood:fl,region:rg,bbox:b,info};
    GAUGE.name='area centre'; GAUGE.c=STUDY.gaugeAt;
    RAIN_PTS.splice(0,RAIN_PTS.length,[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]); // rain = mean of the box corners, not another valley
    load(r.data,false); $('dataBadge').textContent='SERVER DATA'; setArea(b); aoiTowns();
    srvMsg(''); toast(`${code}: ${fmtFull(r.data.cells.length)} cells, ${fmt(r.data.cells.reduce((s,c)=>s+c.pop,0))} residents, from the team server${part?' · shows '+part:''}`);
    return true; }
  catch(e){ srvMsg(`<b>${esc(code)}</b>: could not load from the team server (${esc(e.message)}).<br><button class="btn sm" onclick="location.search=''">Back to the default area</button>`); return false; } }

// town names: the OpenStreetMap place labels of the basemap tiles inside the area (the server sends no names);
// the town with most residents in water names the area, remembered for the menu
async function aoiTowns(){ if(!map) return; await new Promise(r=>setTimeout(r,1500)); await new Promise(r=>map.loaded()?r():map.once('idle',r));
  const seen=new Set(),b=D.bbox,t=[];
  for(const f of map.querySourceFeatures('osm',{sourceLayer:'place'})){ const p=f.properties||{},c=f.geometry?.coordinates;
    if(f.geometry?.type!=='Point'||!p.name||!['city','town','village','suburb'].includes(p.class)||seen.has(p.name)) continue;
    if(c[0]<b[0]||c[0]>b[2]||c[1]<b[1]||c[1]>b[3]) continue; seen.add(p.name); t.push({name:p.name,cls:p.class,c}); }
  if(!t.length) return; D.towns=t; D.townOf=null;
  const ti=townIndex(),r=D.zoneRule?.mid||rp(),n=t.map(()=>0); D.cells.forEach((c,i)=>{ if(c.depth[r]>.01) n[ti[i]]+=c.pop; });
  // named after the city or town with most residents in water (a suburb or village only when no town has any)
  const best=k=>t.map((x,i)=>i).filter(i=>k.includes(t[i].cls)).sort((a,b)=>n[b]-n[a])[0], ct=best(['city','town']);
  const big=t[ct!=null&&n[ct]>0?ct:best(['city','town','village','suburb'])].name;
  STUDY.name=`${STUDY.info?.country||''} · ${big} area${STUDY.part?' (part)':''}`; STUDY.near=big;
  try{ const m=JSON.parse(localStorage.getItem('fse-aoi-names')||'{}'); m[STUDY.server]=big; localStorage.setItem('fse-aoi-names',JSON.stringify(m)); }catch(e){}
  drawCities(); }
const aoiName=code=>{ try{ return JSON.parse(localStorage.getItem('fse-aoi-names')||'{}')[code]||''; }catch(e){ return ''; } };

/* ---------- Data sources: where every layer and number of the loaded area comes from ---------- */
const SRC_ROWS=()=>{ const s=!!STUDY.server, d=s?`team flood API, ${STUDY.server}`:`data/${DATA_AREA?DATA_AREA+'/':''} (scripts/export_area.py)`;
  return [
  ['Flood water depth, 1-in-10 / 100 / 500 years','EFAS flood hazard maps (challenge data, JRC)',`model scenarios, not forecasts; ~90 m${s?', on 100 m server cells':' (native cells)'}; rivers under 500 km² catchment left out`,d],
  ['Residents per cell','GHS-POP 2020 (challenge data, JRC), 1 km','split over GHS-OBAT buildings (challenge data); residents only, no commuters or visitors',d],
  ['Ground height','Copernicus DEM GLO-30 (external, public)','30 m surface model (includes buildings and trees); used for terrain risk and water timing',d],
  ['Terrain risk (0–1)',s?'Team risk model (risk_model.py): terrain + EFAS, trained on points inside the 2021 Copernicus EMS areas labelled flooded / not flooded':'not loaded for this area','a ranking, not a probability; checked on held-out areas (Live model › 8)',s?d:'–'],
  ['Who must leave, cut-off buildings, roads closed',s?'Team access model (flood_tool.py) on EFAS + GHS-OBAT + OpenStreetMap roads':'App model (js/evac.js, js/drill.js) on the same data','per 1 km cell; evacuation levels with reasons',s?d:'computed in the browser'],
  ['Buildings (height, use, outline)',s?'not sent by the server for this area':'GHS-OBAT (challenge data) + OpenStreetMap outlines',s?'building counts come from the server summary instead':'height from GHS-OBAT',s?'–':d],
  ['Hospitals, fire stations, police, shelters','OpenStreetMap',s?'from the server; shelter size not known, so no shelter capacity':'with floor area from OpenStreetMap / GHS-OBAT',s?d:'data/places.geojson'],
  ['July 2021 flood outline','Copernicus EMS rapid mapping (challenge data)',s?'used by the server for training and the damage table':'drawn on the map, satellite check',s?'Live model › 7':d],
  ['Building damage and losses 2021','Team impact model: EMS outlines × GHS-OBAT','money uses an assumed rebuild cost per m²','team flood API /impact'],
  ['Policy advice','Team policy advisor: 14 policies from our Policy Brief','AI only picks and orders catalogue policies; every number checked against the model facts','team policy API /advise'],
  ['Water timing during a run, behaviour (follow rate, speeds, rescue)','Assumptions (sliders)','not data: marked as assumptions everywhere; the report tests their effect','the controls under the map']]; };
function openSources(title='Data sources'){ const w=docStage(title), d=w.document, rows=SRC_ROWS(), fl=STUDY.flood?.floods, r0=rp();
  const res=D.rps.map(r=>({r,pk:peak(r),c:floodCost(r)})), crit=(D.places||[]).filter(p=>p.group==='critical'&&p.ci>=0&&D.cells[p.ci].depth[r0]>.01);
  d.open(); d.write(`<!doctype html><meta charset="utf-8"><style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1b1b1b}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f2f2f2}h1{font-size:20px}</style>
    <h1>${esc(title)} · ${esc(STUDY.name)}${STUDY.server?` <small>(${esc(STUDY.server)})</small>`:''}</h1>
    ${title!=='Data sources'?`<h2>Results on the map (EFAS water depth × GHS-POP residents)</h2><table><tr><th>Flood</th><th>Residents in flooded cells</th><th>km² under water</th><th>Direct damage (proxy, ${esc(areaCountry())} JRC values)</th></tr>${res.map(x=>
      `<tr><td>1-in-${x.r} (${esc(sizeWord(x.r).toLowerCase())})</td><td>${fmtFull(Math.round(x.pk.people))}</td><td>${x.pk.area.toFixed(2)}</td><td>${eur(x.c.damage)}</td></tr>`).join('')}</table>
      <p>Hospitals, fire stations, police and ambulance posts in the water at 1-in-${r0}: <b>${crit.length}</b>${crit.length?` (${crit.slice(0,12).map(p=>esc(p.name||kindName(p.kind))).join(', ')}${crit.length>12?'…':''})`:''}.</p>
      ${D.blds.length?'':'<p>Building damage needs building data, which the server does not send for this area: damage here counts roads only.</p>'}`:''}${STUDY.part?`<p><b>Coverage:</b> the map shows ${esc(STUDY.part)}.</p>`:''}<p>Every layer on the map and every number in the app comes from one of these. Nothing is random or invented; assumptions are named as such.</p>
    <table><tr><th>What</th><th>Source</th><th>Note</th><th>Where we get it</th></tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`
    +(fl?`<h2>Server results for this area</h2><table><tr><th>Flood</th><th>People flooded or cut off</th><th>Buildings</th><th>Flooded</th><th>Cut off</th><th>Road km closed</th></tr>${['rp10','rp100','rp500'].filter(k=>fl[k]).map(k=>
      `<tr><td>1-in-${k.slice(2)}</td><td>${fmtFull(fl[k].people_flooded_or_cut_off)}</td><td>${fmtFull(fl[k].buildings)}</td><td>${fmtFull(fl[k].buildings_flooded)}</td><td>${fmtFull(fl[k].buildings_cut_off)}</td><td>${fl[k].roads_closed_km}</td></tr>`).join('')}</table>
      <p>Datasets the server says it used: challenge ${(STUDY.flood.sources?.challenge||[]).map(esc).join(', ')}; external ${(STUDY.flood.sources?.external||[]).map(esc).join(', ')}.</p><p>Limits stated by the server:</p><ul>${(STUDY.flood.caveats||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:'')
    +`<p style="color:#666">Generated by Flood Scenario Explorer on ${new Date().toLocaleString()}.</p>`); d.close(); }
$('srcBtn').onclick=()=>openSources();
