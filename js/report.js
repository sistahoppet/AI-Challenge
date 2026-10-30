// report.js - After each run: a report for Anna (cross-border crisis coordinator) built around her four questions
// (Q1 what the flood covers, Q2 what was done since, Q3 can we shelter people, Q4 where people stay exposed), plus what a
// researcher needs to check and reuse it: the run's data files, a sensitivity table, the methods, and a comparison of runs.
// The PDF is the browser's "Save as PDF" on a print-ready page (no extra library). Loaded as a classic script.

// documents (report, decision card) open inside the app, not in a pop-up (browsers often block those silently)
function docStage(title){ const st=$('docStage'),fr=$('docFrame'); $('docTitle').textContent=title; st.hidden=false; let html='';
  fr.srcdoc='<p style="font:16px sans-serif;padding:24px">Preparing…</p>';
  return {document:{open(){ html=''; },write(h){ html+=h; },close(){ fr.srcdoc=html; }}}; }
$('docPrint').onclick=()=>$('docFrame').contentWindow?.print(); $('docClose').onclick=()=>{ $('docStage').hidden=true; };
const RUNS=(()=>{ try{ return JSON.parse(localStorage.getItem('fse-runs')||'[]'); }catch(e){ return []; } })(); // finished runs, kept in this browser
const saveRuns=()=>{ try{ localStorage.setItem('fse-runs',JSON.stringify(RUNS.slice(-12))); }catch(e){} };

/* ---------- towns: each grid cell belongs to the closest named place (OpenStreetMap), hamlets only when very close ---------- */
function townIndex(){ if(!D.towns?.length) return null; if(D.townOf) return D.townOf;
  const near=c=>{ let b=-1,bd=Infinity; D.towns.forEach((t,i)=>{ const d=mDist(c,t.c)*(t.cls==='hamlet'?2.5:1); if(d<bd){bd=d; b=i;} }); return b; };
  return D.townOf=D.cells.map(c=>near(c.c)); }
function townStats(R=DR.run){ const ti=townIndex(); if(!ti) return []; const r=rp(),T=D.towns.map(t=>({...t,res:0,bld:0,area:0,unsafe:0,danger:0,noplace:0,shel:0,places:0}));
  D.cells.forEach((c,i)=>{ if(c.depth[r]>.01){ T[ti[i]].res+=c.pop; T[ti[i]].area+=c.area; } });
  D.blds.forEach(b=>{ if(b.ci>=0&&D.cells[b.ci].depth[r]>.01) T[ti[b.ci]].bld++; });
  if(R){ const raw=R.peak.trap+R.peak.stuck,f0=R.co.reduce((s,c)=>{const x=segAt(c,R.peakT); return s+(x[1]==='stuck'?c.n:x[1]==='wet'?c.n*(1-(c.up??c.g.up)):0);},0),f=f0?raw/f0*(R.peak.danger/(raw||1)):0;
    for(const c of R.co){ const x=segAt(c,R.peakT),i=D.G.at(c.g.c[0],c.g.c[1]),t=T[i>=0?ti[i]:0]; if(!t) continue;
      if(x[1]==='stuck') t.danger+=c.n*f; else if(x[1]==='wet') t.danger+=c.n*(1-(c.up??c.g.up))*f; else if(x[1]==='noplace') t.noplace+=c.n; else if(x[1]==='shel') t.shel+=c.n; }
    R.sh.forEach(s=>{ if(s.extra&&!s.load) return; const i=D.G.at(s.c[0],s.c[1]); if(i>=0) T[ti[i]].places+=s.cap; }); }
  T.forEach(t=>t.unsafe=t.danger+t.noplace); return T.filter(t=>t.res>=1).sort((a,b)=>b.res-a.res); }

/* ---------- one-at-a-time sensitivity: each assumption moved down and up, same flood, same choices ---------- */
function sensitivity(){ const o=drillOpts(),base=simulate(o).score,rows=[],run=a=>simulate({...o,...a}).score;
  rows.push(['People who follow the order',`${Math.round(o.comply*100-15)}% / ${Math.round(o.comply*100+15)}%`,run({comply:Math.max(0,o.comply-.15)}),run({comply:Math.min(1,o.comply+.15)})]);
  rows.push(['Warning before the water',`${o.lead-60} / ${o.lead+60} min`,run({lead:Math.max(0,o.lead-60)}),run({lead:o.lead+60})]);
  rows.push(['Time to get ready',`${Math.round(o.mob*1.5)} / ${Math.round(o.mob*.5)} min`,run({mob:o.mob*1.5}),run({mob:o.mob*.5})]);
  rows.push(['Driving speed',`−20% / +20%`,run({v:o.v*.8}),run({v:o.v*1.2})]);
  rows.push(['Shelter places',`−30% / +30%`,run({capX:o.capX*.7}),run({capX:o.capX*1.3})]);
  rows.push(['Rescue capacity',`−50% / +50%`,run({rate:o.rate*.5}),run({rate:o.rate*1.5})]);
  // how fast the water rises changes every closing time: rebuild the inputs for each case, then restore
  const keep=SC.mins,P=E.plan,clear=()=>{ P.routes.forEach(x=>delete x.cells); P.groups.forEach(g=>g.near&&delete g.near.cells); },rise=k=>{ SC.mins=Math.round(keep*k); clear(); DR.prep=drillPrep(); return simulate(drillOpts()).score; };
  const fast=rise(.5),slow=rise(2); SC.mins=keep; clear(); DR.prep=drillPrep(); DR.run=simulate(drillOpts());
  rows.push(['Water rises in',`${Math.round(keep*.45/60/2)} / ${Math.round(keep*.45/60*2)} h`,fast,slow]);
  return {base,rows:rows.map(([n,v,lo,hi])=>({n,v,lo,hi,sw:Math.abs(hi-lo)})).sort((a,b)=>b.sw-a.sw)}; }

/* ---------- the run's settings, kept with every report and data file ---------- */
function runSettings(){ const r=rp(),c=DR.dec; return {flood:`1-in-${r} years (${sizeWord(r)})`,rise_h:+(SC.mins*.45/60).toFixed(1),event_min:SC.mins,warning_min:SC.leadMin,follow_pct:DR.comply,
  ready_min:FW.mob,delay_min:FW.delay,speed_kmh:E.speed,places_pct:DR.capX,rescue_per_h:DR.rescue,car_limit_m:CAR_DEPTH,order:c.order,when_full:c.full,rescue_support:c.help,
  data:'EFAS flood maps, GHS-POP, GHS-OBAT (JRC); Copernicus EMS 2021; Copernicus DEM; OpenStreetMap (roads, sites, building outlines, names); Open-Meteo/ERA5 rain'}; }
const CH={order:{plan:'each street → its shelter',tall:'places first for homes without an upper floor',door:'+ door-to-door',near:'people choose'},full:{redirect:'next best shelter',pack:'squeeze in +30%'},help:{local:'local teams',nat:'+ national support'}};

/* ---------- end of a run: keep it, offer the report ---------- */
let played=false,endDone=false;
FX.push(()=>{ if(S.playing) played=true; if(S.T<.99) endDone=false; if(S.T>=1&&!S.playing&&played&&!endDone&&DR.run){ endDone=true; played=false; runEnded(); } });
function runEnded(){ const R=DR.run,s=runSettings();
  RUNS.push({at:new Date().toLocaleString('en-GB'),...s,unsafe:Math.round(R.score),saved:Math.round(savedBy(R)),danger:Math.round(R.peak.danger),noplace:Math.round(R.peak.noplace),shel:Math.round(R.peak.shel),up:Math.round(R.peak.up),
    range:DR.range.map(Math.round),extra:R.sh.filter(x=>x.extra&&x.load>0).length}); saveRuns();
  const b=$('runEnd'); b.innerHTML=`<div class="ih">${SVGI('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>')}<b>Run finished</b></div>
    <p><b>${savedTxt(R)}</b> compared with no evacuation order (${fmt(DR.none.score)} → ${fmt(R.score)} unsafe at the peak, range ${fmt(DR.range[0])}–${fmt(DR.range[1])}); ${fmt(R.peak.shel)} in shelters. Run ${RUNS.length} saved for comparison.</p>
    <div class="iopts row"><button class="btn sm primary" id="reOpen">PDF report</button><button class="btn sm" id="reData">Data files</button><button class="btn sm" id="reNo">Not now</button></div>`;
  b.hidden=false; $('reOpen').onclick=()=>{ b.hidden=true; openReport(); }; $('reData').onclick=downloadAll; $('reNo').onclick=()=>b.hidden=true; }
$('reportBtn').onclick=()=>openReport();

/* ---------- map picture for the report: whole area at the peak ---------- */
async function snapMap(){ const cam={center:map.getCenter(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()},keep={T:S.T,tab:S.tab};
  map.fitBounds(D.bbox,{padding:20,pitch:0,bearing:0,duration:0}); Object.assign(S,{T:.6,tab:'sim'}); applyLayers(); draw(); paintWater(performance.now(),0,true);
  await new Promise(res=>setTimeout(res,1500)); const url=await new Promise(res=>{ map.once('render',()=>res(map.getCanvas().toDataURL('image/jpeg',.85))); map.triggerRepaint(); });
  const cv=map.getCanvas(),pins=(DR.run?.sh||[]).map((s,i)=>({s,i})).filter(({s,i})=>i<E.shelters.length||s.load>0).map(({s,i})=>{ const p=map.project(s.c); return {x:p.x/cv.clientWidth*100,y:p.y/cv.clientHeight*100,n:i<E.shelters.length?i+1:'+',full:s.full!=null}; });
  Object.assign(S,keep); map.jumpTo(cam); applyLayers(); render(); return {url,pins,ratio:cv.clientHeight/cv.clientWidth}; }

/* ---------- the report ---------- */
async function openReport(){ const R=DR.run; if(!R){ toast('Run the simulation first'); return; } const w=docStage('Report of this run');
  const B=DR.best||bestPlan(),sn=await snapMap(),sens=sensitivity(),r=rp(),pk=peak(r),st=runSettings(),towns=townStats(R),cost=floodCost(r),g=agreePix?.(r);
  const used=R.sh.map((s,i)=>({...s,i,src:i<E.shelters.length?E.shelters[i].src:(E.cands||[]).find(c=>c.c===s.c)})).filter(s=>!s.extra||s.load>0);
  const crit=(D.places||[]).filter(p=>p.ci>=0&&(p.group==='critical'||p.group==='shelter')&&D.cells[p.ci].depth[r]>.01).map(p=>({p,d:D.cells[p.ci].depth[r]})).sort((a,b)=>b.d-a.d);
  const plain=s=>String(s).replace(/<span class="gain">(.*?)<\/span>/g,'<em>($1)</em>'),acts=actionPlan(B),first=acts.find(([,x])=>!/At the peak/.test(x)),top=towns.slice().sort((a,b)=>b.unsafe-a.unsafe||b.res-a.res);
  const notes=(()=>{ try{ return localStorage.getItem('fse-q2')||''; }catch(e){ return ''; } })(),tag=k=>`<span class="tg ${k}">${{data:'data',ext:'published source',as:'assumption'}[k]}</span>`;
  const osm=c=>`https://www.openstreetmap.org/?mlat=${c[1].toFixed(5)}&mlon=${c[0].toFixed(5)}#map=17/${c[1].toFixed(5)}/${c[0].toFixed(5)}`,mx=Math.max(1,...sens.rows.map(x=>Math.max(x.lo,x.hi,sens.base)));
  w.document.open(); w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flood report – ${esc(st.flood)}</title><style>
  body{font:12.5px/1.45 system-ui,sans-serif;color:#1d2529;max-width:820px;margin:20px auto;padding:0 16px} h1{font-size:22px;margin:0} h2{font-size:15px;margin:20px 0 6px;padding-bottom:3px;border-bottom:2px solid #0e8f7e;text-transform:uppercase;letter-spacing:.03em}
  h3{font-size:13px;margin:12px 0 4px} table{width:100%;border-collapse:collapse;margin:4px 0} th,td{padding:3px 5px;border-bottom:1px solid #dde3e5;text-align:left;vertical-align:top} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
  .k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}.k div{border:1px solid #cdd6d9;border-radius:6px;padding:6px 8px}.k b{display:block;font-size:19px}
  .s{color:#56696f;font-size:11.5px} .lead{font-size:14px;border-left:4px solid #0e8f7e;padding:6px 10px;background:#eef7f5} em{color:#0e6b5e;font-style:normal;font-weight:600}
  .tg{font-size:10px;padding:1px 5px;border-radius:8px;color:#fff;white-space:nowrap}.tg.data{background:#0e8f7e}.tg.ext{background:#1d4ed8}.tg.as{background:#a87b00}
  .map{position:relative}.map img{width:100%;display:block;border-radius:6px}.pin{position:absolute;transform:translate(-50%,-100%);background:#0e8f7e;color:#fff;border:2px solid #fff;border-radius:50%;width:18px;height:18px;font:700 10px/18px sans-serif;text-align:center}.pin.full{background:#c0262d}
  .bar{height:9px;background:#cdd6d9;border-radius:3px;position:relative}.bar i{position:absolute;top:0;height:9px;background:#c0262d;border-radius:3px}.bar u{position:absolute;top:-2px;width:2px;height:13px;background:#1d2529}
  ol li{margin:3px 0} .t{font-family:ui-monospace,monospace;color:#56696f;margin-right:6px} .pb{page-break-before:always} .note{white-space:pre-wrap;border:1px dashed #cdd6d9;padding:6px 8px;border-radius:6px}
  @media print{button{display:none} body{margin:0}}</style></head><body>
  <button onclick="print()" style="float:right;padding:6px 12px">Save as PDF / print</button>
  <h1>Flood scenario report</h1><div class="s">${esc(STUDY.name)} · ${esc(st.flood)} · water rises in ${st.rise_h} h · run of ${new Date().toLocaleString('en-GB')} · Flood Scenario Explorer (European AI Challenge 2026)</div>
  <p class="lead"><b>First action for Anna:</b> ${first?plain(first[1]):'—'}</p>
  <div class="map"><img src="${sn.url}" alt="Flood at its peak with shelters">${sn.pins.filter(p=>p.x>0&&p.x<100&&p.y>0&&p.y<100).map(p=>`<span class="pin${p.full?' full':''}" style="left:${p.x}%;top:${p.y}%">${p.n}</span>`).join('')}</div>
  <div class="s">Water at the peak (blue, darker = deeper), buildings coloured where water reached them, shelters (numbered; red = full; + = next best site used). Scale: whole study area, ~25 × 10 km.</div>
  <div class="k"><div><b>${fmt(pk.people)}</b>residents in flooded areas ${tag('data')}</div><div><b>${fmt(pk.bld)}</b>buildings in the water ${tag('data')}</div><div><b>${fmt(R.score)}</b>unsafe at the peak (${fmt(DR.range[0])}–${fmt(DR.range[1])}) ${tag('as')}</div><div><b>${fmt(Math.round(savedBy(R)))}</b>people saved vs no evacuation order (${fmt(DR.none.score)} unsafe; negative = the order makes it worse) ${tag('as')}</div><div><b>${eur(cost.damage)}</b>damage, buildings + roads (proxy) ${tag('ext')}</div></div>

  <h2>Q1 · What does the flood cover?</h2>
  <p>The ${esc(st.flood)} flood map (EFAS) puts <b>${fmt(pk.people)} residents</b> (GHS-POP) and <b>${fmt(pk.bld)} buildings</b> (GHS-OBAT) under water over ${pk.area.toFixed(1)} km². The July 2021 rain matched about a 1-in-100 rain in this valley (37 years of ERA5 rain, Gumbel fit).
  ${g?` July 2021 satellite check (Copernicus EMS): ${esc($('agreeHead').textContent.replace(/^.*?:\s*/,''))}`:''}</p>
  ${towns.length?`<table><thead><tr><th>Town / village</th><th class="n">Residents in water</th><th class="n">Buildings in water</th><th class="n">Area, km²</th></tr></thead><tbody>${towns.slice(0,15).map(t=>`<tr><td>${esc(t.name)} <span class="s">${t.cls}</span></td><td class="n">${fmtFull(t.res)}</td><td class="n">${fmtFull(t.bld)}</td><td class="n">${(t.area/1e6).toFixed(2)}</td></tr>`).join('')}</tbody></table><div class="s">Each ${Math.round(D.G.m)} m cell counted in the closest named place (OpenStreetMap). ${towns.length>15?`${towns.length-15} more places in the data files.`:''}</div>`:''}

  <h2>Q2 · What has been done since 2021?</h2>
  ${notes?`<div class="note">${esc(notes)}</div>`:'<p class="s">Desk research of the team (Policy tab → "Q2 notes"): not filled in yet.</p>'}
  <p class="s">The model maps are the same before and after 2021: new defences, rebuilt or abandoned buildings are not in the data, so the numbers above describe exposure without them.</p>

  <h2 class="pb">Q3 · Could we shelter the exposed people in buildings standing today?</h2>
  <p><b>${fmt(P_total())}</b> people have to leave. The app chose ${E.shelters.length} shelters (outside every mapped flood, at least 150 m from water, dry road access) with <b>${fmt(E.shelters.reduce((s,x,k)=>s+capOf(k),0))} places</b>${R.sh.some(s=>s.extra&&s.load)?`; when they were full, cars went on to ${R.sh.filter(s=>s.extra&&s.load).length} next best sites (+${fmt(R.sh.filter(s=>s.extra&&s.load).reduce((s,x)=>s+x.cap,0))} places)`:''}. At the peak: <b>${fmt(R.peak.shel)} in shelters</b>, ${fmt(R.peak.up)} upstairs at home, ${fmt(R.peak.noplace)} without a place.</p>
  <table><thead><tr><th>#</th><th>Shelter</th><th>Type</th><th class="n">Places</th><th class="n">People in</th><th>Full at</th><th>Why</th></tr></thead><tbody>${used.map(s=>`<tr><td>${s.i<E.shelters.length?s.i+1:'+'}</td><td><a href="${osm(s.c)}">${esc(s.name)}</a></td><td>${s.src?esc(kindName(s.src.kind)):''}</td><td class="n">${fmtFull(s.cap)}</td><td class="n">${fmtFull(s.load)}</td><td>${s.full!=null?clockM(s.full):'—'}</td>
    <td class="s">${s.src?[s.src.margin!=null?`${Math.round(s.src.margin)} m above water`:'',`${Math.round(s.src.dmin)} m from water`,s.src.capSrc||''].filter(Boolean).join(' · '):''}</td></tr>`).join('')}</tbody></table>
  <div class="s">Places = floor area (building outline × floors from GHS-OBAT height) ÷ 3.5 m² per person (Sphere standard) ${tag('ext')} — a maximum: beds, toilets and staff limit it further.</div>
  <h3>Hospitals, emergency services and schools inside the flood</h3>
  ${crit.length?`<table><tbody>${crit.slice(0,14).map(({p,d})=>`<tr><td>${esc(p.name||kindName(p.kind))}</td><td>${esc(kindName(p.kind))}</td><td class="n">${d.toFixed(2)} m of water</td></tr>`).join('')}</tbody></table>`:'<p>None in this flood.</p>'}

  <h2>Q4 · Where do we still stand exposed?</h2>
  ${top.length?`<table><thead><tr><th>Most exposed places</th><th class="n">Residents in water</th><th class="n">Unsafe at peak</th><th class="n">No place</th><th class="n">Shelter places in the place</th></tr></thead><tbody>${top.slice(0,8).map(t=>`<tr><td>${esc(t.name)}</td><td class="n">${fmtFull(t.res)}</td><td class="n">${fmtFull(t.unsafe)}</td><td class="n">${fmtFull(t.noplace)}</td><td class="n">${fmtFull(t.places)}</td></tr>`).join('')}</tbody></table>`:''}
  <h3>Best sequence of actions (${3*4*2*2} combinations tested)</h3>
  <p>With these actions: <b>${savedTxt(B.run)}</b>, <b>${fmt(B.run.score)}</b> unsafe (range ${fmt(B.range[0])}–${fmt(B.range[1])}) instead of ${fmt(R.score)} with the choices of this run.</p>
  <ol>${acts.map(([t,x])=>`<li><span class="t">${isFinite(t)?clockM(t):'Before'}</span>${plain(x)}</li>`).join('')}</ol>

  <h2 class="pb">Factors of this run</h2>
  <table><tbody>${[['Flood size',st.flood,'data'],['Water rises in',st.rise_h+' h','as'],['Warning before the water',st.warning_min+' min','as'],['People who follow the order',st.follow_pct+'%','as'],['Time to get ready / delay on the way',`${st.ready_min} / ${st.delay_min} min`,'as'],
    ['Driving speed',st.speed_kmh+' km/h','as'],['Road closed to cars from',st.car_limit_m+' m of water','ext'],['Shelter places',st.places_pct+'% of floor-area capacity','as'],['Rescue capacity',st.rescue_per_h+' people/h (×3 with national support)','as'],
    ['Order given',CH.order[st.order],'as'],['When a shelter is full',CH.full[st.when_full],'as'],['Rescue support',CH.help[st.rescue_support],'as']].map(([a,b,k])=>`<tr><td>${a}</td><td><b>${esc(b)}</b></td><td>${tag(k)}</td></tr>`).join('')}</tbody></table>

  <h2>Which assumption matters most? (sensitivity)</h2>
  <p class="s">Each assumption moved down and up on its own; same flood and choices. Bar = people unsafe at the peak (low → high), line = this run (${fmt(sens.base)}).</p>
  <table><thead><tr><th>Assumption</th><th>Down / up</th><th class="n">Down</th><th class="n">Up</th><th style="width:30%"></th></tr></thead><tbody>${sens.rows.map(x=>`<tr><td>${x.n}</td><td class="s">${x.v}</td><td class="n">${fmtFull(x.lo)}</td><td class="n">${fmtFull(x.hi)}</td>
    <td><div class="bar"><i style="left:${Math.min(x.lo,x.hi)/mx*100}%;width:${Math.max(1,Math.abs(x.hi-x.lo)/mx*100)}%"></i><u style="left:${sens.base/mx*100}%"></u></div></td></tr>`).join('')}</tbody></table>

  ${RUNS.length>1?`<h2>Compare runs</h2><table><thead><tr><th>Run</th><th>Flood</th><th class="n">Rise h</th><th class="n">Warn min</th><th class="n">Follow</th><th>Order</th><th>Full</th><th class="n">Saved</th><th class="n">Unsafe</th><th class="n">Sheltered</th></tr></thead><tbody>${RUNS.slice(-8).map((x,i)=>`<tr><td>${RUNS.length-Math.min(8,RUNS.length)+i+1} <span class="s">${esc(x.at)}</span></td><td>${esc(x.flood.replace(/ \(.*\)/,''))}</td><td class="n">${x.rise_h}</td><td class="n">${x.warning_min}</td><td class="n">${x.follow_pct}%</td><td>${esc(CH.order[x.order]||'')}</td><td>${esc(CH.full[x.when_full]||'')}</td><td class="n">${x.saved==null?"–":fmtFull(x.saved)}</td><td class="n">${fmtFull(x.unsafe)}</td><td class="n">${fmtFull(x.shel)}</td></tr>`).join('')}</tbody></table>`:''}

  <h2 class="pb">Methods (to reproduce)</h2>
  <ol class="s">
   <li><b>Flood depth</b>: EFAS flood hazard maps (1-in-10/100/500 years) per grid cell; other return periods interpolated on the water level, log scale. A rain scenario is turned into a return period with a Gumbel fit of 37 years of 48-hour rain (ERA5).</li>
   <li><b>Water over time</b> (illustrative): local level = peak × rise(T − lag); rise = (1 − cos(πT/0.45))/2 up to the peak (45% of the event), flat to 60%, then falling; lag up to 15% of the event from upstream to downstream (Copernicus DEM). Depth now = depth − (1 − rise) × L, L = deepest water within 250 m.</li>
   <li><b>People</b>: GHS-POP residents spread over GHS-OBAT buildings; groups of ~400 m; a group's water time = residents' median start of flooding.</li>
   <li><b>Evacuation</b>: warning = water at the first homes − warning time; departures spread over 2 × time to get ready; cars on OpenStreetMap streets (Dijkstra, deeper streets cost more) at the driving speed + delay. A car is stuck when it reaches a street point after the water there exceeds ${CAR_DEPTH} m.</li>
   <li><b>Shelters</b>: OpenStreetMap schools, sports and community halls outside every mapped flood, ≥ 150 m from water, with dry road access; ranked by people at risk within 1.5 km, capacity, height above the water and distance (equal weights). Full on arrival → next shelter with room, by road.</li>
   <li><b>At home</b>: a resident is "upstairs" if the building (GHS-OBAT height) is ≥ water + 3 m, else "trapped". Rescue serves the trapped and stuck at a fixed rate, from 30 min after the first person is in danger.</li>
   <li><b>Unsafe at the peak</b> = trapped + stuck (not yet rescued) + without a shelter place, at 60% of the event. Range = faster / slower reactions (follow ±, speed ±20%, getting ready ×0.75–1.5).</li>
   <li><b>Damage</b>: JRC depth–damage curves (Huizinga 2017) × floor area, 2010 prices × 1.218 (HICP).</li></ol>
  <h2>Limits</h2>
  <p class="s">Not a forecast and not a count of casualties: water timing is illustrative, behaviour settings are assumptions. EFAS maps are ~90 m: small streams and blocked bridges are missing. Defences and buildings changed since 2021 are not in the data. The 2021 satellite outline covers only a small part of this valley. Shelter places are an upper bound. ${esc(st.data)}.</p>
  </body></html>`); w.document.close(); }
const P_total=()=>E.plan?.total||0;

/* ---------- data files of the run (for re-analysis) ---------- */
const csv=(rows)=>rows.map(r=>r.map(v=>typeof v==='string'&&/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v).join(',')).join('\n');
const dl=(name,text,type='text/csv')=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); };
function downloadAll(){ const R=DR.run; if(!R) return; const r=rp(),tag=`rp${r}`,steps=[]; for(let t=Math.ceil(R.tStart/15)*15;t<=R.M;t+=15) steps.push(t);
  const files=[
    [`timeline_${tag}.csv`,csv([['minute','at_home','driving','sheltered','upstairs','in_danger','no_place','rescued'],...steps.map(t=>{const k=countAt(R,t); return [t,...['home','walk','shel','up','danger','noplace','resc'].map(x=>Math.round(k[x]))];})])],
    [`shelters_${tag}.csv`,csv([['id','name','lon','lat','places','people_in','full_at_minute','next_best_site'],...R.sh.map((s,i)=>[i<E.shelters.length?i+1:'+'+(i-E.shelters.length+1),s.name,s.c[0].toFixed(5),s.c[1].toFixed(5),Math.round(s.cap),Math.round(s.load),s.full!=null?Math.round(s.full):'',s.extra?1:0])])],
    [`shelter_fill_${tag}.csv`,(()=>{ const U=R.sh.map((s,i)=>({s,i})).filter(x=>x.s.load>0); return csv([['minute',...U.map(x=>x.s.name)],...steps.map(t=>[t,...U.map(x=>Math.round(loadAt(x.s,t)))])]); })()],
    [`towns_${tag}.csv`,csv([['place','class','lon','lat','residents_in_water','buildings_in_water','unsafe_at_peak','in_danger','no_place','sheltered','shelter_places'],...townStats(R).map(t=>[t.name,t.cls,t.c[0],t.c[1],...['res','bld','unsafe','danger','noplace','shel','places'].map(k=>Math.round(t[k]))])])],
    [`plan_${tag}.geojson`,JSON.stringify({type:'FeatureCollection',features:[...E.plan.routes.map(x=>({type:'Feature',geometry:{type:'LineString',coordinates:x.pts},properties:{kind:'route',people:Math.round(x.people),shelter:x.k+1,wave:x.wave,minutes:Math.round(x.min)}})),
      ...R.sh.map((s,i)=>({type:'Feature',geometry:{type:'Point',coordinates:s.c},properties:{kind:'shelter',name:s.name,places:Math.round(s.cap),people_in:Math.round(s.load),next_best_site:!!s.extra}})),
      ...E.plan.groups.map(g=>({type:'Feature',geometry:{type:'Point',coordinates:g.c},properties:{kind:'resident_group',people:Math.round(g.pop),wave:g.wave}}))]}),'application/geo+json'],
    [`settings_${tag}.json`,JSON.stringify({...runSettings(),result:{unsafe:Math.round(R.score),saved:Math.round(savedBy(R)),unsafe_no_order:Math.round(DR.none.score),range:DR.range.map(Math.round),peak:Object.fromEntries(Object.entries(R.peak).map(([k,v])=>[k,Math.round(v)]))},runs:RUNS},null,1),'application/json']];
  files.forEach(([n,t,ty],i)=>setTimeout(()=>dl(n,t,ty),i*350)); toast(`${files.length} files: timeline, shelters, shelter fill, towns, plan (GeoJSON), settings`); }

/* ---------- Q2 notes (desk research), kept in this browser and printed in the report ---------- */
(()=>{ const t=$('q2Notes'); if(!t) return; try{ t.value=localStorage.getItem('fse-q2')||''; }catch(e){} t.oninput=()=>{ try{ localStorage.setItem('fse-q2',t.value); }catch(e){} }; })();
