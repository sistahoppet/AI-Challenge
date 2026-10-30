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
function townStats(R=DR.run){ const ti=townIndex(); if(!ti) return []; const r=rp(),T=D.towns.map(t=>({...t,res:0,bld:0,area:0,unsafe:0,danger:0,noplace:0,shel:0,places:0,up:0}));
  D.cells.forEach((c,i)=>{ if(c.depth[r]>.01){ T[ti[i]].res+=c.pop; T[ti[i]].area+=c.area; } });
  D.blds.forEach(b=>{ if(b.ci>=0&&D.cells[b.ci].depth[r]>.01) T[ti[b.ci]].bld++; });
  if(R){ const raw=R.peak.trap+R.peak.stuck,f0=R.co.reduce((s,c)=>{const x=segAt(c,R.peakT); return s+(x[1]==='stuck'?c.n:x[1]==='wet'?c.n*(1-(c.up??c.g.up)):0);},0),f=f0?raw/f0*(R.peak.danger/(raw||1)):0;
    for(const c of R.co){ const x=segAt(c,R.peakT),i=D.G.at(c.g.c[0],c.g.c[1]),t=T[i>=0?ti[i]:0]; if(!t) continue;
      if(x[1]==='stuck') t.danger+=c.n*f; else if(x[1]==='wet'){ t.danger+=c.n*(1-(c.up??c.g.up))*f; t.up+=c.n*(c.up??c.g.up); } else if(x[1]==='noplace') t.noplace+=c.n; else if(x[1]==='shel') t.shel+=c.n; }
    R.sh.forEach(s=>{ if(s.extra&&!s.load) return; const i=D.G.at(s.c[0],s.c[1]); if(i>=0) T[ti[i]].places+=s.cap; }); }
  if(R){ const ru=T.reduce((a,t)=>a+t.up,0),k=ru?(R.peak.up||0)/ru:0; T.forEach(t=>t.up*=k); } T.forEach(t=>t.unsafe=t.danger+t.noplace+t.up); /* same parts as the headline: in danger + no place + upstairs (last resort) */ return T.filter(t=>t.res>=1).sort((a,b)=>b.res-a.res); }

/* ---------- one-at-a-time sensitivity: each assumption moved down and up, same flood, same choices ---------- */
function sensitivity(){ const o=drillOpts(),base=simulate(o).score,rows=[],run=a=>simulate({...o,...a}).score;
  rows.push(['People who follow the order',`${Math.round(o.comply*100-15)}% / ${Math.round(o.comply*100+15)}%`,run({comply:Math.max(0,o.comply-.15)}),run({comply:Math.min(1,o.comply+.15)})]);
  rows.push(['Warning before the water',`${o.lead-60} / ${o.lead+60} min`,run({lead:Math.max(0,o.lead-60)}),run({lead:o.lead+60})]);
  rows.push(['Time to get ready',`${Math.round(o.mob*1.5)} / ${Math.round(o.mob*.5)} min`,run({mob:o.mob*1.5}),run({mob:o.mob*.5})]);
  rows.push(['Driving speed',`−20% / +20%`,run({v:o.v*.8}),run({v:o.v*1.2})]);
  rows.push(['Shelter places',`−30% / +30%`,run({capX:o.capX*.7}),run({capX:o.capX*1.3})]);
  const sr=PARAMS?.shelterShare?.range||[5,50]; rows.push(['People needing a public shelter',`${sr[0]}% / ${sr[1]}%`,run({share:sr[0]/100}),run({share:sr[1]/100})]);
  rows.push(['Rescue capacity',`−50% / +50%`,run({rate:o.rate*.5}),run({rate:o.rate*1.5})]);
  // how fast the water rises changes every closing time: rebuild the inputs for each case, then restore
  const keep=SC.mins,P=E.plan,clear=()=>{ P.routes.forEach(x=>delete x.cells); P.groups.forEach(g=>g.near&&delete g.near.cells); },rise=k=>{ SC.mins=Math.round(keep*k); clear(); DR.prep=drillPrep(); return simulate(drillOpts()).score; };
  const cur=keep*.45/60,rh=PARAMS?.riseH?.range||[3,6],fast=rise(rh[0]/cur),slow=rise(rh[1]/cur); SC.mins=keep; clear(); DR.prep=drillPrep(); DR.run=simulate(drillOpts());
  rows.push(['Water rises in',`${rh[0]} h / ${rh[1]} h (this scenario ${Math.round(cur)} h)`,fast,slow]);
  return {base,rows:rows.map(([n,v,lo,hi])=>({n,v,lo,hi,sw:Math.abs(hi-lo)})).sort((a,b)=>b.sw-a.sw)}; }

/* ---------- the run's settings, kept with every report and data file ---------- */
function runSettings(){ const r=rp(),c=DR.dec; return {flood:`1-in-${r} years (${sizeWord(r)})`,rise_h:+(SC.mins*.45/60).toFixed(1),event_min:SC.mins,warning_min:SC.leadMin,follow_pct:DR.comply,
  ready_min:FW.mob,delay_min:FW.delay,speed_kmh:E.speed,places_pct:DR.capX,rescue_per_h:DR.rescue,car_limit_m:CAR_DEPTH,order:c.order,when_full:c.full,rescue_support:c.help,
  data:'EFAS flood maps, GHS-POP, GHS-OBAT (JRC); Copernicus EMS 2021; Copernicus DEM; OpenStreetMap (roads, sites, building outlines, names); Open-Meteo/ERA5 rain'}; }
const CH={order:{plan:'each street → its shelter',tall:'places first for homes without an upper floor',door:'+ door-to-door',near:'people choose'},full:{redirect:'next best shelter',pack:'squeeze in +30%'},help:{local:'local teams',nat:'+ national support'}};

/* ---------- end of a run: keep it, offer the report ---------- */
let played=false,endDone=false;
FX.push(()=>{ if(S.playing) played=true; if(S.T<.99) endDone=false; if(S.T>=1&&!S.playing&&played&&!endDone&&D&&!isDemo){ endDone=true; played=false; runEnded(); } });
function runEnded(){ const R=DR.run,s=runSettings();
  if(!R){ const b=$('runEnd'); // no car drill here (no buildings or shelter sizes from the server): report of the water, people, places and server results
    b.innerHTML=`<div class="ih">${SVGI('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>')}<b>Run finished</b></div>
    <p>No evacuation drill for this area (the server sends no buildings or shelter sizes): the report covers the water, residents, emergency places, costs and the server's model results.</p>
    <div class="iopts row"><button class="btn sm primary" id="reOpen">Area report (PDF)</button><button class="btn sm" id="reNo">Not now</button></div>`;
    b.hidden=false; $('reOpen').onclick=()=>{ b.hidden=true; openSources('Area report'); }; $('reNo').onclick=()=>b.hidden=true; return; }
  RUNS.push({at:new Date().toLocaleString('en-GB'),...s,unsafe:Math.round(R.score),saved:Math.round(savedBy(R)),danger:Math.round(R.peak.danger),noplace:Math.round(R.peak.noplace),shel:Math.round(R.peak.shel),up:Math.round(R.peak.up),away:Math.round(R.peak.away||0),
    range:DR.range.map(Math.round),extra:R.sh.filter(x=>x.extra&&x.load>0).length}); saveRuns();
  const b=$('runEnd'); b.innerHTML=`<div class="ih">${SVGI('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>')}<b>Run finished</b></div>
    <p><b>${savedTxt(R)}</b> than with no evacuation order (${fmt(DR.none.score)} → ${fmt(R.score)} not evacuated).</p>
    <p><b>${fmt(R.score)}</b> people not evacuated at the peak (range ${fmt(DR.range[0])}–${fmt(DR.range[1])}), ${fmt(R.peak.shel)} in shelters${R.peak.away?`, ${fmt(R.peak.away)} with family or friends`:''}. Run ${RUNS.length} saved for comparison.</p>
    <div class="iopts row"><button class="btn sm primary" id="reOpen">Download the report</button><button class="btn sm" id="reData">Data files</button><button class="btn sm" id="reNo">Not now</button></div>`;
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
  const plain=s=>String(s).replace(/<span class="gain">(.*?)<\/span>/g,'<em>($1)</em>'),acts=actionPlan(B),todo=acts.filter(([,x])=>!/At the peak/.test(x)),first=todo[0],top=towns.slice().sort((a,b)=>b.unsafe-a.unsafe||b.res-a.res);
  const notes=(()=>{ try{ return localStorage.getItem('fse-q2')||''; }catch(e){ return ''; } })(),tag=k=>`<span class="tg ${k}">${{data:'data',ext:'published source',as:'assumption'}[k]}</span>`;
  const osm=c=>`https://www.openstreetmap.org/?mlat=${c[1].toFixed(5)}&mlon=${c[0].toFixed(5)}#map=17/${c[1].toFixed(5)}/${c[0].toFixed(5)}`,mx=Math.max(1,...sens.rows.map(x=>Math.max(x.lo,x.hi,sens.base)));
  // one-minute summary inputs
  const share=typeof DR!=='undefined'&&DR.share!=null?+DR.share:100,toMove=P_total(),needPub=toMove*share/100,places=E.shelters.reduce((s,x,k)=>s+capOf(k),0);
  const extraUsed=R.sh.filter(s=>s.extra&&s.load>0),extraPl=extraUsed.reduce((s,x)=>s+x.cap,0),unk=(E.cands||[]).filter(c=>c.stay==='overnight'&&!c.cap).length;
  const medIn=crit.filter(({p})=>['hospital','clinic','care_home'].includes(p.kind)).length,schIn=crit.filter(({p})=>p.kind==='school').length,away=R.peak.away||0;
  const q2=Array.isArray(D.q2)&&D.q2.length?D.q2:null,q2Types=q2?Object.entries(q2.reduce((m,x)=>(m[x.type||'other']=(m[x.type||'other']||0)+1,m),{})).sort((a,b)=>b[1]-a[1]):[],q2Ver=q2?q2.filter(x=>x.verified===true||x.verified==='yes'||x.verified===1).length:0;
  const isVer=x=>x.verified===true||x.verified==='yes'||x.verified===1,srcLink=x=>x.url?`<a href="${esc(x.url)}">${esc(x.source||'source')}</a>`:esc(x.source||'');
  const P=typeof PARAMS==='object'&&PARAMS?PARAMS:null,ptag=s=>/data/i.test(s||'')?'data':/assum|unsourced|illustr|placeholder/i.test(s||'')?'as':'ext';
  const pf=(keys,def)=>{ if(P) for(const k of keys) if(P[k]) return {t:ptag(P[k].status),s:P[k].source||''}; return {t:def,s:''}; };
  const gap=needPub-(places+extraPl);
  // ---- numbers from the data pipeline (scripts/export_area.py → summary.json) when available, so the report matches the data files
  let SUM=null; try{ SUM=await (await fetch(DATA_DIR+'summary.json')).json(); }catch(e){}
  const ps=SUM?.['rp'+r],resIn=ps?ps.residents_in_water:pk.people,bldIn=ps?ps.buildings_in_water:pk.bld;
  // ---- emergency and public-service sites inside the flood
  const EMK=['fire_station','police','town_hall','hospital','clinic','care_home'],emerg=crit.filter(({p})=>EMK.includes(p.kind));
  // ---- buildings: what can be protected before the next flood (depth classes, thresholds in data/params.json)
  const dryM=+(PARAMS?.dryProofMaxM?.value??0.9),wetM=+(PARAMS?.wetProofMaxM?.value??2),ti=townIndex();
  const bEur=(b,h)=>{ if(!b.area) return 0; const v=b.use===2?b.area*(COST.com*ddf('com',h)+COST.ind*ddf('ind',h))/2:b.area*COST.res*ddf('res',h); return v*COST.cpi; };
  const BC=[{k:'low',lab:`Up to 0.3 m`,act:'Simple household measures: sandbags or door boards, non-return valves on drains, valuables and electrics off the floor.'},
    {k:'dry',lab:`0.3 – ${dryM} m`,act:'Keep the water out (dry flood-proofing): certified door and window barriers, sealed walls and openings, backflow valves. Subsidy and advice priority.'},
    {k:'wet',lab:`${dryM} – ${wetM} m`,act:'Let the water in with limited damage (wet flood-proofing): raise meters, boiler and sockets, water-resistant ground-floor materials, safe upper floor or roof exit.'},
    {k:'deep',lab:`Over ${wetM} m`,act:'Protection of the building alone is not enough: candidates for voluntary buy-out, relocation or rebuilding with no living space on the ground floor; evacuate first.'}].map(x=>({...x,n:0,eur:0,town:{}}));
  for(const b of D.blds){ if(b.ci<0) continue; const h=D.cells[b.ci].depth[r]; if(!(h>0)) continue; const c=BC[h<=.3?0:h<=dryM?1:h<=wetM?2:3]; c.n++; c.eur+=bEur(b,h); const nm=ti?D.towns[ti[b.ci]]?.name:''; if(nm) c.town[nm]=(c.town[nm]||0)+1; }
  const topT=c=>Object.entries(c.town).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,v])=>`${esc(n)} ${fmtFull(v)}`).join(' · ');
  // ---- answer to Anna's question
  const warnN=q2?q2.filter(x=>x.type==='warning').length:0,noPl=R.peak.noplace||0,spare=used.reduce((s,x)=>s+Math.max(0,x.cap-x.load),0);
  const verdict=warnN&&(emerg.length||noPl>=1||R.score>=1)?'Partly':warnN?'Yes, for this scenario':'Not demonstrably';
  const mk=k=>`<sup class="m">${{data:'D',ext:'S',as:'A',est:'E'}[k]}</sup>`,hm=m=>`${Math.floor(Math.abs(m)/60)} h ${String(Math.round(Math.abs(m)%60)).padStart(2,'0')}`,whenTxt=t=>!isFinite(t)?'Before the flood season':t<0?`T − ${hm(t)}`:`T + ${hm(t)}`;
  const steps=acts.filter(([,x])=>!/At the peak/.test(x)),preS=[]; if(emerg.length) preS.push([-Infinity,`<b>Before the season</b>: Plan back-up locations for the emergency and public services that sit inside the flood area (${emerg.slice(0,4).map(({p,d})=>`${esc(p.name||kindName(p.kind))}, ${d.toFixed(1)} m`).join('; ')}${emerg.length>4?'…':''}): fire engines, police and the crisis cell must be moved out before the water arrives.`]);
  const pr=DR.prep,G0=pr?.groups||[],cmp=+(st.follow_pct||80)/100,tName=g=>{ const i=D.G.at(g.c[0],g.c[1]); return ti&&i>=0?D.towns[ti[i]]?.name:''; };
  // waves = one order per locality, from the simulation's own flood timing (g.ts = when the water reaches the group's homes):
  // each locality's deadline is its earliest group; the time span is split in three equal parts (wave 1 = water first)
  const TW={}; G0.forEach(g=>{ const n=tName(g)||'Other'; const t=TW[n]=TW[n]||{n,pop:0,noFloor:0,first:Infinity,sk:{}}; t.pop+=g.pop; t.noFloor+=g.pop*(1-g.up); t.first=Math.min(t.first,g.ts); g.legs.forEach(L=>{ t.sk[L.k]=(t.sk[L.k]||0)+L.n; }); });
  const TL=Object.values(TW),t0=Math.min(...TL.map(t=>t.first)),t1=Math.max(...TL.map(t=>t.first)),dt=(t1-t0)/3||1;
  TL.forEach(t=>t.w=Math.min(3,1+Math.floor((t.first-t0)/dt)));
  const waves=[1,2,3].map(w=>{ const ts=TL.filter(t=>t.w===w).sort((a,b)=>a.first-b.first); if(!ts.length) return null; const sk={}; ts.forEach(t=>{ for(const k in t.sk) sk[k]=(sk[k]||0)+t.sk[k]; });
    const pop=ts.reduce((a,t)=>a+t.pop,0),first=ts[0].first;
    return {w,pop,first,order:first-SC.leadMin,noFloor:ts.reduce((a,t)=>a+t.noFloor,0),stay:pop*(1-cmp),
      places:ts.map(t=>`${esc(t.n)} (${fmtFull(Math.round(t.pop))}, water ${whenTxt(t.first)})`).join(', '),
      shel:Object.entries(sk).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>`${esc(E.shelters[k]?.name||'shelter '+(+k+1))} (#${+k+1})`).join(', ')}; }).filter(Boolean);
  const nowSteps=steps.filter(([t])=>isFinite(t)),prepSteps=[...preS,...steps.filter(([t])=>!isFinite(t))]; // during the flood first (the evacuation policy), preparation after
  w.document.open(); w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flood preparedness report – ${esc(STUDY.name)} – ${esc(st.flood)}</title><style>
  @page{size:A4;margin:16mm 14mm 16mm}
  body{font:11.5px/1.5 "Source Sans 3",Arial,sans-serif;color:#1a1f24;max-width:820px;margin:18px auto;padding:0 16px}
  .hdr{border-top:6px solid #1f3a5f;border-bottom:1px solid #1f3a5f;padding:8px 0 6px;margin-bottom:10px;display:flex;justify-content:space-between;gap:12px;font-size:10.5px;color:#3d4a57;text-transform:uppercase;letter-spacing:.05em}
  h1{font-size:21px;margin:4px 0 2px;color:#1f3a5f} .sub{color:#3d4a57;font-size:11.5px;margin-bottom:10px}
  h2{font-size:14px;margin:18px 0 6px;color:#1f3a5f;border-bottom:1.5px solid #1f3a5f;padding-bottom:2px} h3{font-size:12px;margin:10px 0 4px;color:#1f3a5f}
  table{width:100%;border-collapse:collapse;margin:4px 0} th{background:#e9eef4;font-weight:600} th,td{padding:3px 6px;border:1px solid #c9d2dc;text-align:left;vertical-align:top} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
  .box{border:1.5px solid #1f3a5f;padding:8px 12px;margin:8px 0;background:#f5f7fa} .box p{margin:4px 0} .ans{font-size:14px}
  .k{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.k div{border:1px solid #c9d2dc;padding:5px 8px;background:#fff}.k b{display:block;font-size:17px;color:#1f3a5f}
  .s{color:#4d5a66;font-size:10.5px} sup.m{font-size:8px;font-weight:700;color:#1f3a5f;margin-left:1px}
  .map{position:relative}.map img{width:100%;display:block;border:1px solid #c9d2dc}.pin{position:absolute;transform:translate(-50%,-100%);background:#1f3a5f;color:#fff;border:2px solid #fff;width:18px;height:18px;font:700 10px/18px sans-serif;text-align:center;border-radius:50%}.pin.full{background:#9b1c1c}
  .bar{height:9px;background:#dbe2ea;position:relative}.bar i{position:absolute;top:0;height:9px;background:#1f3a5f}.bar u{position:absolute;top:-2px;width:2px;height:13px;background:#9b1c1c}
  .pb{page-break-before:always} .warn{color:#9b1c1c;font-weight:700} .foot{margin-top:14px;border-top:1px solid #c9d2dc;padding-top:4px}
  @media print{button{display:none} body{margin:0}}</style></head><body>
  <button onclick="print()" style="float:right;padding:6px 12px">Save as PDF / print</button>
  <div class="hdr"><span>Cross-border crisis coordination · Liège – Limburg – Aachen</span><span>Planning scenario – not a forecast · ${new Date().toLocaleDateString('en-GB')}</span></div>
  <h1>Flood report – ${esc(STUDY.name)} – ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</h1>
  <div class="sub">Scenario: ${esc(st.flood)} flood (EFAS) · Report issued ${new Date().toLocaleString('en-GB')} · For the governor, the mayors and the municipal emergency planning teams${isDemo?' · <b>TEST DATA</b>':''}</div>
  <div class="k"><div><b>${fmtFull(Math.round(ps?resIn:toMove))}</b>residents to evacuate${mk('data')}</div><div><b>${fmtFull(Math.round(needPub))}</b>need a public shelter (${share}%)${mk('as')}</div><div><b>${fmtFull(Math.round(places+extraPl))}</b>shelter places (${E.shelters.length} sites + ${extraUsed.length} back-up)${mk('est')}</div><div><b>${fmtFull(Math.round(R.score))}</b>not yet evacuated at the peak${mk('est')}</div></div>

  <h2>1. Decision card: evacuation by wave</h2>
  <table><thead><tr><th style="width:15%">When</th><th>Action</th></tr></thead><tbody>
   <tr><td>On the warning</td><td><b>Activate the crisis cell</b> outside the flood area${emerg.length?`; move ${emerg.slice(0,3).map(({p})=>esc(p.name||kindName(p.kind))).join(', ')} out before the water`:''}. <b>Open and staff ${used.length} shelters</b> (${fmtFull(Math.round(places+extraPl))} places, Section 1.2). Close roads once water exceeds ${st.car_limit_m} m.</td></tr>
   ${waves.map(v=>`<tr><td><b>Wave ${v.w}</b><br>order at the latest ${whenTxt(v.order)}<br><span class="s">water at first homes ${whenTxt(v.first)}</span></td><td><b>Order ${fmtFull(Math.round(v.pop))} residents to leave</b>, whole localities, in this order: ${v.places}.<br>About ${fmtFull(Math.round(v.pop*share/100))} need a public shelter: send them to ${v.shel}; when full, to the back-up sites (B).<br>First: ${fmtFull(Math.round(v.noFloor))} residents with no floor above the water and the riverbank streets. Door-to-door and loudspeakers for the ~${fmtFull(Math.round(v.stay))} expected not to leave on the first message. Departures over ${2*st.ready_min} min; each locality out before its water time.</td></tr>`).join('')}
   ${nowSteps.filter(([,x])=>!/Order the evacuation/.test(x)).map(([t,x])=>`<tr><td>${whenTxt(t)}</td><td>${plain(x)}</td></tr>`).join('')}
   <tr><td>At the peak</td><td><b>${fmtFull(Math.round(R.score))} residents still at home</b> (${fmtFull(Math.round(R.peak.up))} upstairs, ${fmtFull(Math.round(R.peak.danger))} in danger): rescue teams by boat, single-storey homes first, then upstairs residents (Section 2).</td></tr>
  </tbody></table>
  <p class="s">T = start of the flood event (T − = before it, T + = after it). Order of evacuation: ${esc(CH.order[st.order]||'')}; when a shelter is full: ${esc(CH.full[st.when_full]||'')}.</p>
  ${prepSteps.length?`<h3>Before the next flood season</h3><table><tbody>${prepSteps.map(([,x])=>`<tr><td>${plain(x).replace(/^<b>Before the season<\/b>:\s*/,'').replace(/^(<b>)?([a-z])/,(m,t,c)=>(t||'')+c.toUpperCase())}</td></tr>`).join('')}</tbody></table>`:''}
  <h3>1.2 Shelters to open</h3>
  <table><thead><tr><th>#</th><th>Site</th><th>Type</th><th class="n">Places</th><th class="n">Expected arrivals</th><th>Full at</th><th>Site check</th></tr></thead><tbody>${used.map(s=>`<tr><td>${s.i<E.shelters.length?s.i+1:'B'}</td><td><a href="${osm(s.c)}">${esc(s.name)}</a></td><td>${s.src?esc(kindName(s.src.kind)):''}</td><td class="n">${fmtFull(s.cap)}</td><td class="n">${fmtFull(s.load)}</td><td>${s.full!=null?clockM(s.full):'—'}</td>
    <td class="s">${s.src?[s.src.margin!=null?`${Math.round(s.src.margin)} m above the water`:'',`${Math.round(s.src.dmin)} m from the water`,s.src.capSrc||''].filter(Boolean).join(' · '):''}</td></tr>`).join('')}</tbody></table>
  <p class="s">B = back-up site opened when the first shelters are full. Places = published capacity when known, otherwise floor area ÷ 3.5 m² per person (Sphere standard)${mk('ext')}: a maximum before beds, sanitation and staff. ${unk} further sites have no known capacity and are not counted: their capacity should be confirmed with the municipalities.</p>
  <p><b>Cross-border sheltering:</b> ${noPl>=1?`<span class="warn">needed</span>: ${fmtFull(noPl)} people find no place in this area at the peak. An agreement with Dutch Limburg and Region Aachen (through EMRIC) is required; none exists for sheltering evacuees today.`:`not needed for this scenario: the shelters in this area cover everyone expected to need a public place (${fmtFull(spare)} places spare). To be reviewed if the public-shelter share is higher (see Annex B).`}</p>

  <h2>2. Where people remain exposed at the peak</h2>
  <p><b>${fmtFull(Math.round(R.score))}</b> residents are not yet evacuated at the peak${mk('est')}: ${fmtFull(Math.round(R.peak.danger))} in danger (trapped or stuck on the road), ${fmtFull(Math.round(R.peak.noplace))} without a shelter place and <b>${fmtFull(Math.round(R.peak.up))} sheltering upstairs at home</b>. Going upstairs is a last resort only: these residents remain to be evacuated or rescued.${away?` A further ${fmtFull(Math.round(away))} residents leave to family or friends.`:''}</p>
  ${top.length?`<table><thead><tr><th>Place</th><th class="n">Residents in the flood area</th><th class="n">Not yet evacuated</th><th class="n">of which upstairs (last resort)</th><th class="n">in danger</th><th class="n">no shelter place</th><th class="n">Shelter places in the place</th></tr></thead><tbody>${top.slice(0,10).map(t=>`<tr><td>${esc(t.name)}</td><td class="n">${fmtFull(t.res)}</td><td class="n"><b>${fmtFull(t.unsafe)}</b></td><td class="n">${fmtFull(t.up)}</td><td class="n">${fmtFull(t.danger)}</td><td class="n">${fmtFull(t.noplace)}</td><td class="n">${fmtFull(t.places)}</td></tr>`).join('')}</tbody></table><p class="s">Top 10 of ${top.length} places, ranked by residents not yet evacuated. Places are OpenStreetMap localities.</p>`:''}

  <h2>3. Emergency services and public buildings inside the flood area</h2>
  ${crit.length?`<table><thead><tr><th>Site</th><th>Type</th><th class="n">Water depth</th></tr></thead><tbody>${crit.map(({p,d})=>`<tr><td>${esc(p.name||kindName(p.kind))}</td><td>${esc(kindName(p.kind))}</td><td class="n">${d.toFixed(2)} m</td></tr>`).join('')}</tbody></table><p class="s">${crit.length} sites${mk('data')}: ${medIn} hospitals or care sites, ${schIn} schools, ${emerg.filter(({p})=>!['hospital','clinic','care_home'].includes(p.kind)).length} fire, police or town-hall sites.</p>`:'<p>None in this flood.</p>'}

  <h2 class="pb">4. Flood area: residents and buildings</h2>
  <div class="map"><img src="${sn.url}" alt="Flood area at the peak with shelters">${sn.pins.filter(p=>p.x>0&&p.x<100&&p.y>0&&p.y<100).map(p=>`<span class="pin${p.full?' full':''}" style="left:${p.x}%;top:${p.y}%">${p.n==='+'?'B':p.n}</span>`).join('')}</div>
  <p class="s">Flood area at the peak (blue, darker = deeper); shelters numbered, B = back-up site, dark red = full. Area shown about 25 × 10 km.</p>
  <p>The ${esc(st.flood)} flood map (EFAS) covers ${pk.area.toFixed(1)} km² with <b>${fmtFull(resIn)} residents</b> (GHS-POP) and <b>${fmtFull(bldIn)} buildings</b> (GHS-OBAT)${mk('data')}.</p>
  ${towns.length?`<table><thead><tr><th>Place</th><th class="n">Residents</th><th class="n">Buildings</th><th class="n">Flooded area, km²</th></tr></thead><tbody>${towns.slice(0,15).map(t=>`<tr><td>${esc(t.name)}</td><td class="n">${fmtFull(t.res)}</td><td class="n">${fmtFull(t.bld)}</td><td class="n">${(t.area/1e6).toFixed(2)}</td></tr>`).join('')}</tbody></table>${towns.length>15?`<p class="s">${towns.length-15} more places in the data files.</p>`:''}`:''}

  <h2>5. Protecting buildings before the next flood</h2>
  <p>Buildings in the flood area by water depth${mk('data')}, the measures that fit each depth${mk('ext')} and the damage at stake (JRC depth–damage curves)${mk('est')}.</p>
  <table><thead><tr><th>Water depth</th><th class="n">Buildings</th><th class="n">Damage at stake</th><th>Measure</th><th>Most buildings in</th></tr></thead><tbody>${BC.map(c=>`<tr><td><b>${c.lab}</b></td><td class="n">${fmtFull(c.n)}</td><td class="n">${eur(c.eur)}</td><td>${c.act}</td><td class="s">${topT(c)}</td></tr>`).join('')}</tbody></table>
  <p class="s">${D.bankN?`${fmtFull(D.bankN)} buildings stand within ${Math.round(D.bankM)} m of the river, where the current can damage the structure: they evacuate early, whatever their depth class. `:''}Depth limits are set in the data parameters (dry flood-proofing up to ${dryM} m, wet flood-proofing up to ${wetM} m).</p>

  <h2>6. Measures taken since 2021</h2>
  <p><b>Better prepared than in 2021? ${verdict}.</b> ${warnN?`Warning has improved (${warnN} warning measures)${mk('ext')}; `:''}the flood area still holds ${fmtFull(resIn)} residents and ${fmtFull(bldIn)} buildings${mk('data')}${emerg.length?`, including ${emerg.length} emergency or public-service sites`:''}.</p>
  ${q2?`<table><thead><tr><th>Area</th><th>Measure</th><th>Type</th><th>Date</th><th>Source</th></tr></thead><tbody>${q2.map(x=>`<tr><td>${esc(x.area||'')}</td><td>${esc(x.measure||'')}</td><td>${esc(x.type||'')}</td><td>${esc(x.date||'')}</td><td class="s">${srcLink(x)}${isVer(x)?' (official)':' (press)'}</td></tr>`).join('')}</tbody></table><p class="s">${q2.length} measures, ${q2Ver} from official sources${mk('ext')}.</p>`
   :notes?`<div class="s" style="white-space:pre-wrap">${esc(notes)}</div>`:'<p class="s">Not documented yet.</p>'}

  <h2 class="pb">Annex A. Planning assumptions of this scenario</h2>
  <table><thead><tr><th>Factor</th><th>Value</th><th></th><th>Basis</th></tr></thead><tbody>${[['Flood size',st.flood,['flood'],'data'],['Water rises in',st.rise_h+' h',['rise','mins'],'as'],['Warning before the water',st.warning_min+' min',['leadMin'],'as'],['Residents who follow the order',st.follow_pct+'%',['comply'],'as'],
    ['Time to get ready / delay on the way',`${st.ready_min} / ${st.delay_min} min`,['mob'],'as'],['Driving speed',st.speed_kmh+' km/h',['speedCar'],'as'],['Road closed to cars from',st.car_limit_m+' m of water',['carDepth'],'ext'],
    ['Public shelter share',share+'% of residents who leave',['shelterShare'],'as'],['Shelter places',st.places_pct+'% of floor-area capacity',['capX'],'as'],['Rescue capacity',st.rescue_per_h+' people/h',['rescueRate'],'as']].map(([a,b,keys,def])=>{ const f=pf(keys,def); return `<tr><td>${a}</td><td><b>${esc(b)}</b></td><td>${mk(f.t)}</td><td class="s">${esc(f.s||(f.t==='data'?'EFAS flood hazard map':'Planning assumption'))}</td></tr>`; }).join('')}</tbody></table>

  <h2>Annex B. Which assumption changes the result most</h2>
  <p class="s">Each assumption is moved to a lower and a higher value on its own, same flood. Result = residents not yet evacuated at the peak (bar: low → high; red line: this scenario, ${fmtFull(sens.base)}).</p>
  <table><thead><tr><th>Assumption</th><th>Lower / higher value</th><th class="n">Result (lower)</th><th class="n">Result (higher)</th><th style="width:28%"></th></tr></thead><tbody>${sens.rows.map(x=>`<tr><td>${x.n}</td><td class="s">${x.v}</td><td class="n">${fmtFull(x.lo)}</td><td class="n">${fmtFull(x.hi)}</td>
    <td><div class="bar"><i style="left:${Math.min(x.lo,x.hi)/mx*100}%;width:${Math.max(1,Math.abs(x.hi-x.lo)/mx*100)}%"></i><u style="left:${sens.base/mx*100}%"></u></div></td></tr>`).join('')}</tbody></table>
  ${RUNS.length>1?`<h2>Annex C. Scenarios compared</h2><table><thead><tr><th>Run</th><th>Flood</th><th class="n">Rise h</th><th class="n">Warning min</th><th class="n">Follow</th><th class="n">Not yet evacuated</th><th class="n">Sheltered</th></tr></thead><tbody>${RUNS.slice(-8).map((x,i)=>`<tr><td>${RUNS.length-Math.min(8,RUNS.length)+i+1} <span class="s">${esc(x.at)}</span></td><td>${esc(x.flood.replace(/ \(.*\)/,''))}</td><td class="n">${x.rise_h}</td><td class="n">${x.warning_min}</td><td class="n">${x.follow_pct}%</td><td class="n">${fmtFull(x.unsafe)}</td><td class="n">${fmtFull(x.shel)}</td></tr>`).join('')}</tbody></table>`:''}
  <h2 class="pb">Annex D. Data sources and flood sizes</h2>
  <table><thead><tr><th>Flood</th><th class="n">Residents in the flood area</th><th class="n">Flooded area, km²</th><th class="n">Direct damage (JRC values)</th></tr></thead><tbody>${D.rps.map(x=>{ const q=SUM?.['rp'+x],k=peak(x); return `<tr><td>1-in-${x} years${x===r?' (this scenario)':''}</td><td class="n">${fmtFull(Math.round(q?q.residents_in_water:k.people))}</td><td class="n">${k.area.toFixed(1)}</td><td class="n">${eur(floodCost(x).damage)}</td></tr>`; }).join('')}</tbody></table>
  ${typeof SRC_ROWS==='function'?`<table><thead><tr><th>What</th><th>Source</th><th>Note</th><th>Where it comes from</th></tr></thead><tbody>${SRC_ROWS().filter(x=>!/^Policy advice/.test(x[0])&&!/^not loaded/.test(x[1])&&(STUDY.server||!/2021/.test(x[0]))).map(x=>`<tr>${x.map(c=>`<td class="s">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:''}
  <p class="s foot">Source markers: <b>D</b> challenge datasets (EFAS flood maps, GHS-POP, GHS-OBAT, Copernicus EMS, OpenStreetMap) · <b>S</b> published source or standard · <b>E</b> estimate from this scenario · <b>A</b> planning assumption (Annex A). Full list of sources in Annex D.</p>
  </body></html>`); w.document.close(); }
const P_total=()=>E.plan?.total||0;

/* ---------- data files of the run (for re-analysis) ---------- */
const csv=(rows)=>rows.map(r=>r.map(v=>typeof v==='string'&&/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v).join(',')).join('\n');
const dl=(name,text,type='text/csv')=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); };
function downloadAll(){ const R=DR.run; if(!R) return; const r=rp(),tag=`rp${r}`,steps=[]; for(let t=Math.ceil(R.tStart/15)*15;t<=R.M;t+=15) steps.push(t);
  const files=[
    [`timeline_${tag}.csv`,csv([['minute','at_home','driving','sheltered','upstairs','in_danger','no_place','rescued','left_to_family_friends'],...steps.map(t=>{const k=countAt(R,t); return [t,...['home','walk','shel','up','danger','noplace','resc','away'].map(x=>Math.round(k[x]||0))];})])],
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
