// api.js - "Live model" tab: the team's flood API (flood_api) runs the models for any area: flood risk + who must leave, evacuation flow,
// flood timeline, area check (/region), Help a friend + shelters, building damage (impact) and model checks.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).
// API address: ?api=http://host:port in the page URL, or the field in the tab (remembered in this browser).

// served from valencia (hosted copy) → the live API on the same host; elsewhere (laptop preview) → the :8081 test server
const API_DEFAULT=/^valencia\b|^100\.108\.90\.108$/.test(location.hostname)?`http://${location.hostname}:8080`:'http://valencia.tail142ce3.ts.net:8081';
const A={url:(new URLSearchParams(location.search).get('api')||(()=>{try{return localStorage.getItem('fse-api');}catch(e){return null;}})()||API_DEFAULT).replace(/\/+$/,''),
  ok:false,area:null,pick:null,corner:null,helper:null,req:null,shelters:null,busy:0,cells:[]};

/* ---------- calls ---------- */
async function api(path,body,method){
  let r; try{ r=await fetch(A.url+path,{method:method||(body?'POST':'GET'),headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined}); }
  catch(e){ setApiOk(false); throw new Error('The API can\'t be reached at '+A.url+'. Check the address and that you are on the team network (Tailscale).'); }
  const j=await r.json().catch(()=>({error:'HTTP '+r.status}));
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); return j;
}
// slow runs (new areas, help zones): ?async=1 returns a job at once, then poll /jobs/{id} so the browser never waits minutes on one request
async function apiJob(path,body,out){
  const t0=Date.now(); let j=await api(path+(path.includes('?')?'&':'?')+'async=1',body);
  while(j.status==='running'&&j.job){ if(out) out.innerHTML=`<p class="hint">Working… ${Math.round((Date.now()-t0)/1000)} s (big areas can take a few minutes).</p>`;
    await new Promise(r=>setTimeout(r,3000));
    let r; try{ r=await fetch(`${A.url}/jobs/${j.job}`,{cache:'no-store'}); }catch(e){ throw new Error('Lost the API while waiting; try again.'); }
    const k=await r.json().catch(()=>({error:'HTTP '+r.status}));
    if(r.status===202) continue; if(!r.ok) throw new Error(k.error||('HTTP '+r.status)); return k; }
  return j; }
const fileUrl=u=>typeof u==='string'&&u.startsWith('/files/')?A.url+u:null;
function setApiOk(ok){ A.ok=ok; const b=$('apiBadge'); b.textContent=ok?'API ONLINE':'API OFFLINE'; b.classList.toggle('real',ok);
  $('apiState').textContent=ok?`Connected to ${A.url}`:`Not connected. The Live model tab needs the team API at ${A.url}.`; $('apiState').classList.toggle('err',!ok); }
async function apiConnect(){ $('apiState').textContent='Connecting…';
  try{ const r=await fetch(A.url+'/health',{cache:'no-store'}); setApiOk(r.ok); }catch(e){ setApiOk(false); }
  if(A.ok){ loadModels(); loadImpact(); } }
// one button = one run: the button shows "Running…" and long model runs (up to minutes) can't be started twice
async function run(btn,out,f){ if(btn.disabled) return; const lbl=btn.textContent; btn.disabled=true; btn.textContent='Running…'; A.busy++;
  out.innerHTML='<p class="hint">Working… big areas can take a few minutes.</p>';
  try{ await f(); }catch(e){ out.innerHTML=`<p class="hint err">✗ ${esc(e.message)}</p>`; }
  finally{ btn.disabled=false; btn.textContent=lbl; A.busy--; } }

/* ---------- area for model runs ---------- */
const km2=b=>(b[2]-b[0])*111.32*Math.cos((b[1]+b[3])/2*Math.PI/180)*(b[3]-b[1])*111.32;
const r4=v=>Math.round(v*1e4)/1e4;
// run name from the area: the same area reuses the same output folder on the server instead of filling its disk
const runName=p=>p+'_'+A.area.map(v=>Math.round(v*1000)).join('_').replace(/-/g,'m');
const region=()=>({type:'bbox',bbox:A.area});
function setArea(b){ A.area=b.map(r4); const k=km2(A.area);
  $('apiArea').innerHTML=`${A.area.join(', ')} <span class="hint">(W, S, E, N) · ${fmtFull(k)} km²${k>3000?' · <b class="err">too big: max 3000 km²</b>':''}</span>`;
  map?.getSource('apiArea')?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]}}]}); }
const needArea=()=>{ if(!A.area) throw new Error('Choose an area first.'); return region(); };

/* ---------- map layers (added once the map is ready) ---------- */
function apiLayers(){
  ['apiArea','apiRoute','apiPts','apiFlood'].forEach(id=>map.addSource(id,{type:'geojson',data:empty()}));
  map.addLayer({id:'api-flood',type:'fill',source:'apiFlood',layout:{visibility:'none'},paint:{'fill-opacity':.65,'fill-color':'#4292c6'}});
  map.addLayer({id:'api-area',type:'line',source:'apiArea',layout:{visibility:'none'},paint:{'line-color':css('--accent'),'line-width':2,'line-dasharray':[3,2]}});
  map.addLayer({id:'api-route',type:'line',source:'apiRoute',layout:{visibility:'none','line-cap':'round','line-join':'round'},paint:{'line-color':css('--unit'),'line-width':5,'line-opacity':.85}});
  map.addLayer({id:'api-pts',type:'circle',source:'apiPts',layout:{visibility:'none'},paint:{'circle-radius':['match',['get','k'],'shelter',6,8],'circle-stroke-width':2,'circle-stroke-color':'#fff',
    'circle-color':['match',['get','k'],'helper',css('--shel'),'person',css('--cut'),'shelter',['case',['get','dry'],css('--zg'),css('--zr')],'cell',css('--crit'),css('--unit')]}});
  if(A.area) setArea(A.area); apiShow();
}
function apiShow(){ if(S.tab==='api'&&!A.area&&D) setArea(D.bbox); if(!ready||!map.getLayer('api-area')) return; const v=S.tab==='api'?'visible':'none'; ['api-flood','api-area','api-route','api-pts'].forEach(l=>map.setLayoutProperty(l,'visibility',v)); floodStyle(); }
const pts={helper:null,person:null,shelters:[],cells:[],here:null};
function drawPts(){ const f=(c,k,p)=>({type:'Feature',properties:Object.assign({k},p||{}),geometry:{type:'Point',coordinates:c}});
  map?.getSource('apiPts')?.setData({type:'FeatureCollection',features:[...pts.shelters.map(s=>f([s.lon,s.lat],'shelter',{dry:s.dry})),...pts.cells.map(c=>f(c,'cell')),
    ...(pts.helper?[f(pts.helper,'helper')]:[]),...(pts.person?[f(pts.person,'person')]:[]),...(pts.here?[f(pts.here,'person')]:[])]}); }
const drawRoute=g=>map?.getSource('apiRoute')?.setData(g?{type:'Feature',properties:{},geometry:g}:empty());

/* ---------- clicks on the map while picking (box corners, helper, person) ---------- */
function apiPick(p){ if(!A.pick) return false; const k=A.pick; map.getCanvas().style.cursor='';
  if(k==='box'){ if(!A.corner){ A.corner=p; map.getCanvas().style.cursor='crosshair'; toast('Now click the opposite corner'); return true; }
    const c=A.corner; A.corner=null; A.pick=null; setArea([Math.min(c[0],p[0]),Math.min(c[1],p[1]),Math.max(c[0],p[0]),Math.max(c[1],p[1])]); return true; }
  A.pick=null; if(k==='danger'){ dangerAt(p); return true; }
  pts[k]=p; drawPts(); $(k==='helper'?'hHelpAt':'hNeedAt').textContent=`${r4(p[1])}, ${r4(p[0])}`; return true; }
function startPick(k,msg){ A.pick=k; A.corner=null; map.getCanvas().style.cursor='crosshair'; toast(msg); }

/* ---------- small renderers ---------- */
const stat=(v,l)=>`<div class="stat"><b>${v==null||v===''?'–':typeof v==='number'?fmt(v):esc(v)}</b><span>${esc(l)}</span></div>`;
const dist=m=>m==null||!isFinite(m)?'none nearby':fmtFull(m)+' m';
function links(files){ const out=[]; const walk=(o,pre)=>{ for(const [k,v] of Object.entries(o||{})){ const u=fileUrl(v);
  if(u) out.push(`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">${esc((pre?pre+' ':'')+k.replace(/_/g,' '))}</a>`); else if(v&&typeof v==='object') walk(v,k); } }; walk(files,'');
  return out.length?`<div class="row" style="justify-content:flex-start;margin-top:8px">${out.join('')}</div>`:''; }
const table=(rows,cols)=>rows?.length?`<div class="apiScroll"><table class="apiT"><tr>${cols.map(c=>`<th>${esc(c[1])}</th>`).join('')}</tr>${rows.map(r=>`<tr>${cols.map(c=>{const v=r[c[0]];
  return `<td>${typeof v==='number'?(Math.abs(v)<10&&v%1?v.toFixed(2):fmtFull(v)):esc(v??'')}</td>`;}).join('')}</tr>`).join('')}</table></div>`:'<p class="hint">No rows.</p>';
const mins=s=>s<90?`${Math.round(s)} s`:`${Math.round(s/60)} min`;

/* ---------- 1. flood risk + who must leave (/flood) ---------- */
$('fRun').onclick=e=>run(e.target,$('fOut'),async()=>{
  const floods=[...document.querySelectorAll('#fFloods input:checked')].map(i=>i.value); if(!floods.length) throw new Error('Pick at least one flood size.');
  const j=await apiJob('/flood',{name:runName('app'),region:needArea(),floods},$('fOut'));
  const fl=Object.entries(j.floods||{}); pts.cells=(fl[0]?.[1].evacuation?.first_cells||[]).map(c=>[c.lon,c.lat]); drawPts();
  $('fOut').innerHTML=fl.map(([k,f],n)=>{ const ev=f.evacuation||{};
    return `<h3>${esc(floodLabel(k))}</h3><div class="stats">${stat(f.people_flooded_or_cut_off,'people flooded or cut off')}${stat(ev.people_now,'leave now')}${stat(ev.people_early,'leave early')}
      ${stat(ev.people_by_boat_or_air,'only by boat or air')}${stat(f.buildings_flooded,'buildings flooded')}${stat(f.roads_closed_km,'km of road closed')}</div>
      <p class="hint">km² cells by danger: ${Object.entries(f.cells||{}).map(([a,b])=>`${esc(a)} ${fmtFull(b)}`).join(' · ')}</p>`
      +(n===0&&ev.first_cells?.length?`<h3>Evacuate first <span class="tag data">purple dots</span></h3><ol class="safe">${ev.first_cells.slice(0,8).map(c=>
        `<li><button data-ll="${c.lon},${c.lat}"><span class="n crit">${c.evac_priority}</span><span>${esc(c.evac_level)}<br><span class="hint">${esc(c.evac_reasons)}</span></span></button></li>`).join('')}</ol>`:''); }).join('')
    +(j.caveats?.length?`<p class="hint">Limits: ${j.caveats.map(esc).join(' · ')}</p>`:'')+`<p class="hint">Area ${fmtFull(j.region_km2||0)} km² · mean relative risk ${j.relative_risk?.mean??'–'}${j.outside_study_region_pct?` · ${j.outside_study_region_pct}% outside the study region`:''}</p>`+links(j.files);
});
const floodLabel=k=>({rp10:'1-in-10-year flood',rp100:'1-in-100-year flood',rp500:'1-in-500-year flood',observed:'July 2021 (satellite)'})[k]||k.replace('risk_ge_','model risk ≥ ');

/* ---------- 2. evacuation flow (/evacuation) ---------- */
$('eRun').onclick=e=>run(e.target,$('eOut'),async()=>{
  const hours=$('eHours').value.split(/[ ,]+/).filter(Boolean).map(Number), weather=[...document.querySelectorAll('#eWeather input:checked')].map(i=>i.value);
  if(!weather.length) throw new Error('Pick at least one weather.');
  const j=await apiJob('/evacuation',{name:runName('app'),region:needArea(),flood:$('eFlood').value,hours,weekend:$('eWeekend').checked,weather},$('eOut'));
  $('eOut').innerHTML=`<p class="hint">${esc(j.roads||'')} · ${fmtFull(j.buildings_flooded||0)} buildings flooded, ${fmtFull(j.buildings_cut_off||0)} cut off</p>`
    +table(j.runs,[['run','Run'],['evacuees','Evacuees'],['cars','Cars'],['boat_or_air','Boat / air'],['need_transport','Need transport'],['roads_congested_km','km jammed'],['time_to_safety_p95_h','Hours to safety (95 %)']])
    +(j.caveats?.length?`<p class="hint">Limits: ${esc(j.caveats.at(-1))}</p>`:'')+links(j.files);
});

/* ---------- 3. timeline (/timeline, what-if flood) ---------- */
$('tRun').onclick=e=>run(e.target,$('tOut'),async()=>{
  const j=await apiJob('/timeline',{name:runName('app'),region:needArea(),driver:{type:'whatif',peak_rp:+$('tPeak').value,rise_h:+$('tRise').value,fall_h:+$('tFall').value,step_h:+$('tStep').value}},$('tOut'));
  $('tOut').innerHTML=table(j.steps,[['time','Time'],['T','Flood size (1-in-N)'],['flooded_km2','km² flooded'],['buildings_flooded','Bldgs flooded'],['roads_closed_km','km roads closed'],['people_now','Leave now'],['people_early','Leave early'],['people_air','Boat / air']])+links(j.files);
});

/* ---------- 4. area check (/region) ---------- */
$('rRun').onclick=e=>run(e.target,$('rOut'),async()=>{ needArea();
  const j=await apiJob('/region',{name:runName('app'),bbox:A.area,top_n:20},$('rOut')); const rk=j.risk, ck=j.region_check;
  pts.cells=(rk?.priority_cells||[]).map(c=>[c.lon,c.lat]); drawPts(); await loadCells(j.files?.cells).catch(()=>{});
  const lvl={critical:'crit',high:'crit',elevated:'',low:''};
  $('rOut').innerHTML=`<div class="stats">${stat(j.area_km2,'km² checked')}${stat(rk?.high_risk_km2,'km² high risk')}${stat(rk?.people_in_high_risk_approx,'people in high risk (approx.)')}</div>`
    +(rk?.by_scenario?.length?'<h3>EFAS flood maps in this area</h3>'+table(rk.by_scenario.map(r=>({...r,scenario:floodLabel(r.scenario)})),
      [['scenario','Flood'],['flooded_km2','km² wet'],['deep_km2','km² ≥ 0.3 m'],['people_approx','People in wet cells'],['max_depth_m','Max depth m']]):'')
    +`<h3>Emergency places inside the area</h3><p class="hint">${Object.entries(j.facilities||{}).map(([k,v])=>`${esc(k.replace(/_/g,' '))} ${v}`).join(' · ')||'none found'}</p>`
    +(rk?.priority_cells?.length?`<h3>Top places to act first <span class="tag data">purple dots</span></h3><ol class="safe">${rk.priority_cells.slice(0,8).map(c=>{
      const why=(c.factors||[]).filter(f=>f.level==='high'||f.level==='medium').map(f=>`${f.level==='high'?'HIGH':'medium'}: ${esc(f.reason)}`).join('; ');
      return `<li><button data-ll="${c.lon},${c.lat}"><span class="n ${lvl[c.overall]??'crit'}">${c.rank}</span><span>${esc(c.overall||'')} · ~${fmt(c.people)} people · risk ${c.risk.toFixed(2)}<br><span class="hint">${why||`fire station ${dist(c.dist_fire_station_m)} · hospital ${dist(c.dist_hospital_m)} (straight line)`}</span></span></button></li>`;}).join('')}</ol>
      <p class="hint">Road and building factors (cut off, bridges, flooded buildings) are not in this check: run “Flood risk + who must leave” for them.</p>`:'')
    +(ck?`<p class="hint${ck.cells_outside_training_range_pct>10?' err':''}">Model fit: ${ck.cells_outside_training_range_pct}% of cells outside the training range · nearest training area ${esc(ck.nearest_training_aoi)} (${ck.nearest_training_aoi_km} km away, held-out AUC ${ck.nearest_training_aoi_held_out_auc??'–'})</p>`:'')
    +(j.caveats?.length?`<p class="hint">Limits: ${j.caveats.map(esc).join(' · ')}</p>`:'')+links(j.files);
});

/* ---------- flood layer from the area check (cells.geojson: r = risk, d10/d100/d500 = EFAS depth m) ---------- */
const DEPTH=[[0.01,'#c6dbef'],[0.3,'#6baed6'],[1,'#2171b5'],[3,'#08306b']], RISK=[[0.2,'#fee391'],[0.5,'#fe9929'],[0.8,'#cc4c02']];
function floodStyle(){ if(!ready||!map.getLayer('api-flood')) return; const k=$('rShow').value, ramp=k==='r'?RISK:DEPTH;
  map.setFilter('api-flood',k?['>=',['get',k],ramp[0][0]]:['==',1,0]);
  if(k) map.setPaintProperty('api-flood','fill-color',['step',['get',k],ramp[0][1],...ramp.slice(1).flat()]);
  const lab=(v,i)=>k==='r'?`≥ ${v}`:i?`≥ ${v} m`:'> 0 m';
  $('rLegend').innerHTML=!A.cells.length||!k?'':(k==='r'?'Model risk (a ranking):':'EFAS water depth:')+ramp.map(([v,c],i)=>`<span class="swatch" style="background:${c}"></span>${lab(v,i)}`).join(''); }
$('rShow').onchange=floodStyle;
async function loadCells(url){ A.cells=[]; $('rAnim').disabled=true; map?.getSource('apiFlood')?.setData(empty()); const u=fileUrl(url); if(!u) return;
  const g=await (await fetch(u)).json(); A.cells=g.features; $('rAnim').disabled=!A.cells.length; map?.getSource('apiFlood')?.setData(g); floodStyle(); }
// the checked area's cells become the app's grid (same fields as data/grid.geojson), so Simulate plays its water rising
$('rAnim').onclick=()=>{ if(!A.cells.length) return;
  const grid={type:'FeatureCollection',features:A.cells.map(f=>{ const p=f.properties||{};
    return {type:'Feature',geometry:f.geometry,properties:{depth_rp10:p.d10,depth_rp100:p.d100,depth_rp500:p.d500,pop:p.pop,elev:p.elev}}; })};
  const r=ingest({grid}); if(!r.data){ toast(r.log.filter(l=>l.e).map(l=>l.m).join(' ')); return; }
  load(r.data,false); $('dataBadge').textContent='LIVE AREA'; setTab('sim'); setPlaying(true);
  const wet=r.data.cells.some(c=>D.rps.some(rp=>c.depth[rp]>0));
  toast(wet?`Animating the checked area (${r.data.cells.length.toLocaleString()} cells)${r.data.cells.some(c=>c.pop>0)?'':': no population in the API output yet, people show 0'}`:'No EFAS water in this area: nothing to animate'); };
$('rBack').onclick=()=>tryAutoLoad().then(ok=>{ if(!ok) load(ingest(makeDemo()).data,true); });
// ray casting on the cell square (lon/lat ring)
const inRing=(p,r)=>{ let a=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ const [xi,yi]=r[i],[xj,yj]=r[j];
  if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi) a=!a; } return a; };

/* ---------- Am I in danger? (/point + the loaded area check) ---------- */
$('dPick').onclick=()=>startPick('danger','Click the place to check');
const LEVEL={danger:'In danger',at_risk:'At risk',safe:'Not in the flood maps'};
async function dangerAt(p){ pts.here=p; drawPts(); const out=$('dOut'); out.innerHTML='<p class="hint">Checking…</p>';
  try{ const j=await api(`/point?lon=${r4(p[0])}&lat=${r4(p[1])}`);
    const cell=A.cells.find(c=>inRing(p,c.geometry.coordinates[0])), inArea=A.area&&p[0]>=A.area[0]&&p[0]<=A.area[2]&&p[1]>=A.area[1]&&p[1]<=A.area[3];
    let level=j.level, extra='';
    if(cell&&cell.properties.r>=0.5){ if(level==='safe') level='at_risk'; extra=`Flood-prone terrain: model risk ${cell.properties.r.toFixed(2)} for this 100 m cell (≥ 0.5 = high; a ranking, not a probability).`; }
    else if(cell) extra=`Model risk ${cell.properties.r.toFixed(2)} for this 100 m cell (below the 0.5 high-risk line).`;
    else if(inArea&&A.cells.length) extra='Model risk below 0.2 for this cell.';
    else extra='Run "Check area" (5) on an area around this place to add the model risk.';
    out.innerHTML=`<div class="verdict ${level}">${LEVEL[level]} · ${r4(p[1])}, ${r4(p[0])}</div>`
      +`<ul class="log">${j.by_scenario.map(s=>`<li><b>${esc(floodLabel(s.scenario))}:</b> ${esc(s.text)}${s.efas_depth_m?` (${s.efas_depth_m} m)`:''}</li>`).join('')}</ul>`
      +`<p class="hint">${esc(extra)}</p><p class="hint">Limits: ${j.caveats.map(esc).join(' · ')}</p>`; }
  catch(e){ out.innerHTML=`<p class="hint err">✗ ${esc(e.message)}</p>`; } }

const flyLL=e=>{ const b=e.target.closest('[data-ll]'); if(b) map.flyTo({center:b.dataset.ll.split(',').map(Number),zoom:15,duration:1200}); };
$('rOut').onclick=flyLL; $('fOut').onclick=flyLL;

/* ---------- 5. Help a friend + shelters ---------- */
const zone=()=>runName('zone');
$('hZone').onclick=e=>run(e.target,$('hZoneOut'),async()=>{ needArea(); const j=await apiJob('/help/zones',{name:zone(),bbox:A.area},$('hZoneOut'));
  $('hZoneOut').innerHTML=`<p class="hint">✓ Help zone ready: ${fmtFull(j.area_km2)} km² of roads loaded.</p>`; A.helper=null; A.req=null; });
$('hShel').onclick=e=>run(e.target,$('hZoneOut'),async()=>{ needArea(); const j=await api(`/help/zones/${zone()}/shelters?scenario=${$('hScen').value}`);
  pts.shelters=j.list||[]; drawPts();
  $('hZoneOut').innerHTML=`<p class="hint">${j.shelters} shelters (green = dry, red = flooded at ${esc(j.scenario)}), ${j.dry} dry. Schools and sports halls are candidates, not official shelters.</p>`; });
$('hHelpPick').onclick=()=>startPick('helper','Click where the helper is');
$('hNeedPick').onclick=()=>startPick('person','Click where the person needing help is');
$('hHelp').onclick=e=>run(e.target,$('hHelpOut'),async()=>{ if(!pts.helper) throw new Error('Click "Place on map" first.');
  const j=await api('/helpers',{zone:zone(),lon:pts.helper[0],lat:pts.helper[1],mode:$('hMode').value}); A.helper=j.id;
  $('hHelpOut').innerHTML=`<p class="hint">✓ Helper #${j.id} registered (${esc($('hMode').value)}). Now place someone who needs help.</p><button class="btn sm" data-del="helper">Delete this helper's data</button>`; });
// data minimisation: helpers and requests can be removed at once (the API also deletes them after 72 h)
$('hHelpOut').onclick=async e=>{ if(!e.target.closest('[data-del]')||!A.helper) return;
  try{ const j=await api(`/helpers/${A.helper}`,null,'DELETE'); pts.helper=null; drawPts(); A.helper=null;
    $('hHelpOut').innerHTML=`<p class="hint">Helper #${j.id} deleted${j.requests_reopened?`; ${j.requests_reopened} request(s) open again for other helpers`:''}.</p>`; }
  catch(err){ $('hHelpOut').innerHTML=`<p class="hint err">✗ ${esc(err.message)}</p>`; } };
$('hNeed').onclick=e=>run(e.target,$('hNeedOut'),async()=>{ if(!pts.person) throw new Error('Click "Place on map" first.');
  const j=await api('/help-requests',{zone:zone(),lon:pts.person[0],lat:pts.person[1],need:$('hNeedKind').value,urgent:$('hUrgent').checked,scenario:$('hScen').value}); A.req=j.id; drawRoute(null);
  $('hNeedOut').innerHTML=`<p class="hint">Request #${j.id}: ${esc(j.status)} · ${j.risk?.in_risk_zone?`in the flood zone (${j.risk.efas_depth_m} m at ${esc(j.risk.scenario)})`:'outside the flood zone'}</p>`
    +(j.offers?.length?`<ol class="safe">${j.offers.map((o,i)=>`<li><button data-acc="${o.helper_id}"><span class="n">${i+1}</span><span>Helper #${o.helper_id} (${esc(o.mode)}) · ${mins(o.eta_s)} · ${fmtFull(o.distance_m)} m${o.flooded_m?` · <b class="err">${fmtFull(o.flooded_m)} m in water</b>`:''}<br><span class="hint">Click to accept and show the route</span></span></button></li>`).join('')}</ol>`
      :`<p class="hint err">${esc(j.message||'No helper can reach this person.')}</p>`)
    +`<div class="row" style="justify-content:flex-start;margin-top:8px"><button class="btn sm" data-act="shelter">Route to nearest dry shelter</button><button class="btn sm" data-act="close">Close request</button><button class="btn sm" data-act="delete">Delete request data</button></div><div id="hRoute"></div>`; });
const routeHtml=r=>`<p class="hint">${mins(r.eta_s)} · ${fmtFull(r.distance_m)} m${r.flooded_m?` · <b class="err">${fmtFull(r.flooded_m)} m through water</b>`:''}</p><ol class="apiSteps">${(r.steps||[]).map(s=>`<li>${esc(s.instruction)}${s.distance_m?` <span class="hint">${fmtFull(s.distance_m)} m</span>`:''}</li>`).join('')}</ol>`;
function showRoute(r){ drawRoute(r.geometry); const c=r.geometry?.coordinates; if(c?.length) map.fitBounds(bboxOf([c]),{padding:80,duration:1000}); }
$('hNeedOut').onclick=async e=>{ const b=e.target.closest('[data-acc],[data-act]'); if(!b||!A.req) return; const out=$('hRoute');
  try{ if(b.dataset.acc){ const j=await api(`/help-requests/${A.req}/accept`,{helper_id:+b.dataset.acc}); showRoute(j.route); out.innerHTML=`<h3>Helper #${j.helper_id} → person</h3>`+routeHtml(j.route); }
    else if(b.dataset.act==='shelter'){ out.innerHTML='<p class="hint">Finding a route…</p>'; const j=await api(`/help-requests/${A.req}/shelter`); showRoute(j.route);
      out.innerHTML=`<h3>→ ${esc(j.shelter.name||j.shelter.kind)} (${esc(j.mode)})</h3>`+routeHtml(j.route); }
    else if(b.dataset.act==='delete'){ const j=await api(`/help-requests/${A.req}`,null,'DELETE'); drawRoute(null); pts.person=null; drawPts(); A.req=null;
      $('hNeedOut').innerHTML=`<p class="hint">Request #${j.id} and its offers deleted.</p>`; }
    else { const j=await api(`/help-requests/${A.req}/close`,{}); drawRoute(null); out.innerHTML=`<p class="hint">Request #${j.id} closed.</p>`; } }
  catch(err){ out.innerHTML=`<p class="hint err">✗ ${esc(err.message)}</p>`; } };

/* ---------- 6. building damage + model checks (read-only) ---------- */
async function loadImpact(){ try{ const j=await api('/impact');
  $('iOut').innerHTML=table(j.aois,[['activation','EMS'],['aoi','AOI'],['product','Map'],['flooded','Flooded bldgs'],['loss_m','Loss €M'],['displaced','Displaced']])
    +'<p class="hint">From the July 2021 satellite maps (Copernicus EMS) × GHS-OBAT buildings. Money uses an assumed rebuild cost per m².</p>'; }
  catch(e){ $('iOut').innerHTML=`<p class="hint err">✗ ${esc(e.message)}</p>`; } }
async function loadModels(){ try{ const j=await api('/models');
  $('mOut').innerHTML=table(j.models,[['name','Model'],['what','What it does'],['runs_on','Where']])+'<h3>How well they work (held-out checks)</h3>'+table(j.evaluation,[['check','Check'],['model','Model'],['metric','Metric'],['value','Value']]); }
  catch(e){ $('mOut').innerHTML=`<p class="hint err">✗ ${esc(e.message)}</p>`; } }

/* ---------- connection + area buttons ---------- */
$('apiUrl').value=A.url;
$('apiGo').onclick=()=>{ A.url=$('apiUrl').value.trim().replace(/\/+$/,''); try{localStorage.setItem('fse-api',A.url);}catch(e){} apiConnect(); };
$('aStudy').onclick=()=>D&&setArea(D.bbox);
$('aView').onclick=()=>{ const b=map.getBounds(); setArea([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]); };
$('aDraw').onclick=()=>startPick('box','Click one corner of the area on the map');
function apiInit(){ apiConnect(); if(map) (ready?apiLayers():map.once('load',apiLayers)); }
