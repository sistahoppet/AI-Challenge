// ux.js - Usability layer: SVG icons, tooltips for technical terms, rain presets, Reset, input checks, empty states,
// and risk shown by shape + hatching (not colour alone). Runs on the existing page, so new sections get it too.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- icons (24×24, stroke = currentColor) ---------- */
const IC={
  wave:'<path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
  exit:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l4-4-4-4"/><path d="M14 12H4"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  chart:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  bank:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M3 20h18"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="8" r="2.5"/><path d="M16 14a5 5 0 0 1 5 6"/>',
  building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  area:'<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M7 15c2 0 2-2 4-2s2 2 4 2 2-1 2-1"/>',
  rain:'<path d="M7 16a5 5 0 1 1 1-9.9A6 6 0 0 1 19 9a4 4 0 0 1-1 7"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  reset:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".6" fill="currentColor"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  upload:'<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  house:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  hospital:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
  route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  truck:'<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
  pin:'<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  euro:'<path d="M17 6a7 7 0 1 0 0 12"/><path d="M4 10h9M4 14h9"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  compare:'<path d="M12 3v18"/><path d="M4 8h5M4 16h5M15 8h5M15 16h5"/>',
  warn:'<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".6" fill="currentColor"/>',
  check:'<path d="M4 12l5 5L20 6"/>',
  play:'<path d="M7 4l13 8-13 8V4z"/>'};
const icon=(n,cls='ic')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
const pre=(el,n)=>{ if(el&&!el.querySelector(':scope > svg.ic')) el.insertAdjacentHTML('afterbegin',icon(n)); };
// tabs, header buttons, numbers
document.querySelectorAll('.tabs [data-t]').forEach(b=>pre(b,{sim:'wave',safety:'exit',coord:'bell',diag:'chart',policy:'bank',data:'list'}[b.dataset.t]));
pre($('helpBtn'),'help'); pre($('openData'),'upload');
[['sPeople','people'],['sBld','building'],['sArea','area']].forEach(([id,n])=>pre($(id).parentElement,n));
// section titles: icon by keyword
const H2IC=[[/flood size|How big/i,'rain'],[/Right now/i,'chart'],[/Press/i,'play'],[/Model or real/i,'compare'],[/Map layers|Show on map/i,'layers'],[/Safety zones/i,'shield'],[/Shelters/i,'house'],
  [/Critical/i,'hospital'],[/route/i,'route'],[/Evacuation plan/i,'exit'],[/Forecast/i,'rain'],[/Emergency teams/i,'truck'],[/Be ready/i,'warn'],[/Who does what/i,'list'],
  [/Message/i,'megaphone'],[/Share/i,'share'],[/Check a place/i,'pin'],[/diagram/i,'chart'],[/Cost/i,'euro'],[/Impact/i,'bank'],[/What it means/i,'people'],[/2021 flood/i,'compare'],[/Read with care/i,'info'],[/Data used/i,'list'],[/own file/i,'upload']];
document.querySelectorAll('.panel h2').forEach(h=>{ const m=H2IC.find(([re])=>re.test(h.textContent)); if(m) h.insertAdjacentHTML('afterbegin',icon(m[1],'ic h2ic')); });

/* ---------- tooltips for technical terms (hover or keyboard focus) ---------- */
const GLOSS={
  'EFAS':'European Flood Awareness System: official EU flood maps showing how deep water gets for floods of a given rarity.',
  'GHS-POP':'Global Human Settlement population grid (EU JRC): where people live, about 1 km cells.',
  'GHS-OBAT':'EU JRC building dataset: each building with its footprint, height and use.',
  'EMS':'Copernicus Emergency Management Service: satellite maps made during the 2021 flood.',
  'DEM':'Digital elevation model: ground height everywhere (here: Copernicus 30 m).',
  'OSM':'OpenStreetMap: open map data for roads, schools, hospitals and more.',
  'OpenStreetMap':'Open map data made by volunteers: roads, schools, hospitals and more.',
  'AAL':'Average annual loss: damage you can expect per year on average, adding up big rare floods and smaller frequent ones.',
  'G-6':'UN Sendai indicator: share of people at risk protected by evacuating before the disaster.',
  'CAP':'Common Alerting Protocol: the international standard format for public warnings.',
  'Gumbel':'A standard statistical method to estimate how rare an extreme rain or river flow is.',
  'GloFAS':'Global Flood Awareness System: a worldwide river-flow forecast (about 5 km cells).',
  'ERA5':'European weather re-analysis: past weather reconstructed from observations.',
  'Sphere':'International humanitarian standards: at least 3.5 m² of covered floor per person in a shelter.',
  'JRC':'Joint Research Centre: the European Commission\'s science service.',
  'BCR':'Benefit–cost ratio: euros of damage avoided per euro spent. Above 1 = worth it.',
  'wave':'Evacuation order: wave 1 is where water arrives first, so they leave first.',
  'return period':'How rare a flood is: 1-in-100 means a 1% chance each year, not once every 100 years exactly.'};
const RP_TIP='How rare a flood is: 1-in-N means about a 1/N chance each year (e.g. 1-in-100 = 1% per year).';
const termRe=new RegExp(`\\b(${Object.keys(GLOSS).map(k=>k.replace(/[-]/g,'\\-')).join('|')}|1-in-\\d+)\\b`,'g');
function markTerms(root){ const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{ const p=n.parentElement;
    if(!p||p.closest('svg,script,style,input,select,textarea,option,button,.term,summary,.tip,.maplibregl-popup')) return NodeFilter.FILTER_REJECT;
    termRe.lastIndex=0; return termRe.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT; }}),list=[];
  while(walk.nextNode()) list.push(walk.currentNode);
  list.forEach(n=>{ const frag=document.createElement('span'); frag.innerHTML=esc(n.nodeValue).replace(termRe,m=>`<span class="term" tabindex="0" data-tip="${esc(GLOSS[m]||RP_TIP)}">${m}</span>`); n.replaceWith(...frag.childNodes); }); }
let termT=null; const termObs=new MutationObserver(()=>{ clearTimeout(termT); termT=setTimeout(()=>{ termObs.disconnect(); document.querySelectorAll('.tabbody,#legend').forEach(markTerms); watchTerms(); },250); });
const watchTerms=()=>document.querySelectorAll('.tabbody,#legend').forEach(el=>termObs.observe(el,{childList:true,subtree:true,characterData:true}));
document.querySelectorAll('.tabbody,#legend').forEach(markTerms); watchTerms();
// one floating tooltip for terms and any [data-tip]
const tipEl=Object.assign(document.createElement('div'),{className:'uxtip',role:'tooltip',hidden:true}); document.body.appendChild(tipEl);
const showTip=t=>{ const s=t.dataset.tip; if(!s) return; tipEl.textContent=s; tipEl.hidden=false; const b=t.getBoundingClientRect();
  tipEl.style.left=Math.max(8,Math.min(innerWidth-288,b.left))+'px'; tipEl.style.top=(b.bottom+6+tipEl.offsetHeight>innerHeight?b.top-tipEl.offsetHeight-6:b.bottom+6)+'px'; };
['mouseover','focusin'].forEach(ev=>document.addEventListener(ev,e=>{const t=e.target.closest?.('[data-tip]'); if(t) showTip(t);}));
['mouseout','focusout'].forEach(ev=>document.addEventListener(ev,e=>{ if(e.target.closest?.('[data-tip]')) tipEl.hidden=true; }));
document.addEventListener('keydown',e=>{ if(e.key==='Escape') tipEl.hidden=true; });

/* ---------- rain presets ---------- */
const PRESETS=[['Light rain',{rain:3,dur:360,perm:30,drain:20}],['Heavy rain',{rain:12,dur:360,perm:20,drain:10}],['Extreme rain',{rain:20,dur:720,perm:10,drain:5}],['July 2021 (48 h)',{rain:1.9,dur:2880,perm:0,drain:0}]];
$('scIn').insertAdjacentHTML('beforebegin',`<div class="presets" role="group" aria-label="Rain presets">${PRESETS.map(([n,v],i)=>`<button class="btn sm" data-preset="${i}" data-tip="${v.rain} mm/h for ${v.dur>=120?v.dur/60+' h':v.dur+' min'}${v.perm||v.drain?`, ${v.perm}% soaks in, ${v.drain}% drained`:''}">${icon('rain')}${n}</button>`).join('')}</div>`);
document.querySelector('.presets').onclick=e=>{ const b=e.target.closest('[data-preset]'); if(!b) return; const v=PRESETS[+b.dataset.preset][1];
  Object.assign(SC,v); document.querySelectorAll('#scIn [data-sc]').forEach(i=>{ const k=i.dataset.sc; i.value=SC[k]; $('scv-'+k).textContent=`${SC[k]} ${i.dataset.u}`; }); drawScenarioInfo(); buildScenario(); };

/* ---------- Reset everything ---------- */
$('openData').insertAdjacentHTML('beforebegin',`<button class="btn" id="resetAll" data-tip="Back to the start: mapped flood sizes, Rare flood, water at the start, default layers and view">${icon('reset')}Reset</button>`);
$('resetAll').onclick=()=>{ setPlaying(false); if(D.custom||D.base) $('scReset').click(); S.T=0; S.cmp='both'; S.sizeIdx=Math.min(1,D.rps.length-1); $('size').value=S.sizeIdx; $('size').oninput({target:$('size')});
  if(S.mode==='3d') setMode('2d'); setTab('sim'); setBasemap('detail'); ['tRiv','tRoad','tTree','tOsmB','tNames','tPeople','tCars','tPlaces','tBld'].forEach(id=>$(id).checked=true); ['tZones','tCols'].forEach(id=>$(id).checked=false);
  map.fitBounds(D.bbox,{padding:50}); applyLayers(); drawLegend(); render(); toast('Everything is back to the start'); };

/* ---------- input checks: clear message next to any number field out of range ---------- */
document.addEventListener('input',e=>{ const i=e.target; if(i.type!=='number') return; const v=i.value===''?NaN:+i.value,mn=i.min!==''?+i.min:-Infinity,mx=i.max!==''?+i.max:Infinity,ok=isFinite(v)&&v>=mn&&v<=mx;
  i.setAttribute('aria-invalid',!ok); let m=i.parentElement.querySelector('.vmsg'); if(ok){ m?.remove(); return; }
  if(!m){ m=document.createElement('span'); m.className='vmsg'; m.setAttribute('role','alert'); i.after(m); }
  m.textContent=!isFinite(v)?'Enter a number':v<mn?`Minimum ${mn}`:`Maximum ${mx}`; });

/* ---------- empty states ---------- */
const emptyMsg=(ic,t)=>`<div class="empty">${icon(ic)}<span>${t}</span></div>`;
if(!$('rsOut').innerHTML) $('rsOut').innerHTML=emptyMsg('truck','No teams sent yet. Pause the video at a moment, then press <b>Dispatch now</b>.');
if(!$('placeInfo').innerHTML) $('placeInfo').innerHTML=emptyMsg('pin','Click anywhere on the map to see the water, zone and nearest shelter there.');
$('abOut').innerHTML=emptyMsg('route','Press <b>Set A</b> and <b>Set B</b>, then click the map. Or <b>A → nearest shelter</b>.');

/* ---------- risk by shape + hatching (colour-blind safe) ---------- */
const ZSHAPE={3:'▲',2:'◆',1:'●'};
function addHatch(){ if(!ready||map.hasImage('hatch-red')) return; const mk=(dir,col,dots)=>{ const n=16,c=document.createElement('canvas'); c.width=c.height=n; const g=c.getContext('2d'); g.strokeStyle=g.fillStyle=col; g.lineWidth=2;
    if(dots){ g.beginPath(); g.arc(n/2,n/2,1.6,0,7); g.fill(); } else { g.beginPath(); g.moveTo(0,dir?0:n); g.lineTo(n,dir?n:0); g.stroke(); }
    return {width:n,height:n,data:new Uint8Array(g.getImageData(0,0,n,n).data)}; };
  map.addImage('hatch-red',mk(1,'rgba(0,0,0,.45)')); map.addImage('dots-yel',mk(0,'rgba(0,0,0,.4)',1));
  map.addLayer({id:'zones-tex',type:'fill',source:'cells',layout:{visibility:'none'},filter:['>',['get','z'],1],paint:{'fill-pattern':['match',['get','z'],3,'hatch-red','dots-yel'],'fill-opacity':.6,'fill-antialias':false}},'water-img'); }
const zoneTex=()=>{ if(!ready) return; addHatch(); map.setLayoutProperty('zones-tex','visibility',map.getLayoutProperty('zones','visibility')); };
const _applyLayers=applyLayers; applyLayers=function(){ _applyLayers(); zoneTex(); };
const _drawLegend=drawLegend; drawLegend=function(){ _drawLegend(); const L=$('legend');
  L.querySelectorAll('.li').forEach(li=>{ const t=li.textContent; const z=/Red|high risk/i.test(t)?3:/Yellow|caution/i.test(t)?2:/Green|safer/i.test(t)?1:0; if(z&&!li.querySelector('.zs')) li.insertAdjacentHTML('afterbegin',`<span class="zs" aria-hidden="true">${ZSHAPE[z]}</span>`); });
  if(S.tab==='safety'||$('tZones').checked) L.insertAdjacentHTML('beforeend','<div class="hint" style="margin:4px 0 0">Map: hatched = high risk, dotted = caution.</div>'); };
// zone names in panel lists get their shape too
new MutationObserver(()=>document.querySelectorAll('#zoneLegend .crow').forEach((r,i)=>{ if(!r.querySelector('.zs')) r.querySelector('.sw')?.insertAdjacentHTML('afterend',`<span class="zs" aria-hidden="true">${ZSHAPE[3-i]}</span>`); })).observe($('zoneLegend'),{childList:true});

/* ---------- map toolbox: one icon per layer group (same switches as "Map layers" in the panel) ---------- */
const TOOLS=[['tZones','Safety zones','<path d="M12 3l8 4v6c0 5-4 8-8 9-4-1-8-4-8-9V7z"/>'],['tBld','Buildings','<path d="M4 21V9l6-4v16M10 21V3l10 5v13M2 21h20"/>'],
  ['tPeople','Residents','<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 11a3 3 0 1 0 0-6M21 20c0-3-2-5-4-5.5"/>'],['tPlaces','Key sites','<path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12z"/><path d="M12 6v6M9 9h6"/>'],
  ['tRoad','Streets','<path d="M8 3L5 21M16 3l3 18M12 4v3M12 11v3M12 18v2"/>'],['tTree','Trees, parks','<path d="M12 3l6 9h-4l4 6H6l4-6H6z"/><path d="M12 18v3"/>'],
  ['tNames','Place names','<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],['tCars','Traffic (illustration)','<rect x="3" y="11" width="18" height="6" rx="2"/><path d="M6 11l2-4h8l2 4"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>']];
$('tools').innerHTML=TOOLS.map(([id,t,p])=>`<button data-for="${id}" title="${t}" aria-label="${t}" aria-pressed="${$(id).checked}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg></button>`).join('');
$('tools').onclick=e=>{ const b=e.target.closest('[data-for]'); if(!b) return; const c=$(b.dataset.for); c.checked=!c.checked; c.dispatchEvent(new Event('change',{bubbles:true})); };
document.addEventListener('change',e=>{ const b=document.querySelector(`#tools [data-for="${e.target.id}"]`); if(b) b.setAttribute('aria-pressed',e.target.checked); });

/* ---------- hide / show the interface: only the map and the play bar stay (button or key H) ---------- */
function setUI(hide){ document.body.classList.toggle('hideui',hide); $('uiBtn').setAttribute('aria-pressed',hide); $('uiShow').hidden=!hide; setTimeout(()=>map?.resize(),50); }
$('uiBtn').onclick=()=>setUI(true); $('uiShow').onclick=()=>setUI(false);
document.addEventListener('keydown',e=>{ if((e.key==='h'||e.key==='H')&&!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) setUI(!document.body.classList.contains('hideui')); });

/* ---------- side panel folds away (button on the map edge); the controls bar folds on small screens ---------- */
function setPanel(open){ document.body.classList.toggle('nopanel',!open); const b=$('panelBtn'); b.textContent=open?'›':'‹'; b.setAttribute('aria-expanded',open);
  b.title=b.ariaLabel=open?'Hide the side panel':'Show the side panel'; b.textContent=open?'›':'‹ Panel'; try{ localStorage.setItem('fse-panel',open?'1':'0'); }catch(e){} setTimeout(()=>map?.resize(),60); }
$('panelBtn').onclick=()=>setPanel(document.body.classList.contains('nopanel')); $('panelHide').onclick=()=>setPanel(false);
try{ if(localStorage.getItem('fse-panel')==='0') setPanel(false); }catch(e){}
if(innerHeight<760) $('dockHide').click(); // small screen: the map gets the room, the controls open with one click
// at the start of a run (clock 0, paused) the map has no water yet: say so next to the play button
FX.push(()=>{ const h=$('playHint'),on=S.T<.001&&!S.playing&&!!D; if(h.hidden===on) h.hidden=!on; $('play').classList.toggle('pulse',on); });

/* ---------- choose the area: a town of the loaded data (focus box), or another area exported to data/cities/ ---------- */
async function drawCities(){ const sel=$('citySel'); if(!D||isDemo) return; sel.hidden=false;
  const ti=townIndex(),r=D.zoneRule?.mid||rp(),n=(D.towns||[]).map(()=>0); if(ti) D.cells.forEach((c,i)=>{ if(c.depth[r]>.01) n[ti[i]]+=c.pop; });
  const towns=D.towns.map((t,i)=>({t,i,n:n[i]})).filter(x=>x.n>=50&&x.t.cls!=='hamlet').sort((a,b)=>b.n-a.n);
  let areas=[]; try{ areas=await (await fetch('data/cities/index.json',{cache:'no-cache'})).json(); }catch(e){}
  const here=SERVER_AOI?null:areas.find(x=>(x.dir||'')===DATA_AREA), aois=await aoiList();
  sel.innerHTML=`<option value="">${esc(SERVER_AOI?STUDY.name:here?.name||'Whole area')}</option>`
    +`<optgroup label="Areas with full detail (buildings, roads, shelters)">${areas.filter(x=>x!==here).map(x=>`<option value="a${esc(x.dir||'')}">${esc(x.name)}</option>`).join('')}</optgroup>`
    +(aois.length?`<optgroup label="All July 2021 mapped areas · team server (people affected in 2021)">${aois.filter(a=>a.code!==SERVER_AOI).map(a=>`<option value="s${esc(a.code)}">${esc(a.country)} · ${esc(a.code.replace(/_/g,' '))} · ${fmt(a.affected)}</option>`).join('')}</optgroup>`:'')
    +(towns.length?`<optgroup label="Zoom to a town (residents in water at 1-in-${r})">${towns.map(x=>`<option value="t${x.i}">${esc(x.t.name)} · ${fmt(x.n)}</option>`).join('')}</optgroup>`:''); }
$('citySel').onchange=e=>{ const v=e.target.value, q=new URLSearchParams(location.search);
  if(v[0]==='a'){ q.delete('aoi'); v.length>1?q.set('area',v.slice(1)):q.delete('area'); location.search=q.toString(); return; }
  if(v[0]==='s'){ q.delete('area'); q.set('aoi',v.slice(1)); location.search=q.toString(); return; }
  if(!v){ cityBox(); map.fitBounds(D.bbox,{padding:30}); return; }
  const ti=townIndex(),k=+v.slice(1),pts=D.cells.filter((c,i)=>ti[i]===k&&c.pop>0).map(c=>c.c); if(!pts.length) return;
  const b=bboxOf([pts]),px=600/KX(b[1]),py=600/110540,box=[b[0]-px,b[1]-py,b[2]+px,b[3]+py]; // the town's populated cells + 600 m
  cityBox(box); map.fitBounds(box,{padding:30,duration:900}); toast(`${D.towns[k].name}: the simulation still covers the whole area (water comes from upstream)`); };
