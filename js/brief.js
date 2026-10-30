// brief.js - For the jury and the mayor: "where does this number come from?" (click any number marked with a dotted line),
// the printable decision card, and the guided demo (6 steps through the story).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- where each number comes from: data (challenge datasets), external (published sources), assumption (yours) ---------- */
const SRC={
  efas:['data','Flood depth: EFAS flood hazard maps (JRC, 1-in-10/100/500 years, ~90 m). Timing of the rise in the video is illustrative.','Model maps, not the 2021 event; small streams and blocked bridges not represented.'],
  pop:['data','Residents: GHS-POP 2020 (JRC, ~1 km cells), spread over buildings with GHS-OBAT.','1 km cells: counts in a street are approximate; tourists and workers not included.'],
  obat:['data','Buildings and their height: GHS-OBAT (JRC). "Upstairs" = building at least 3 m taller than the water (one floor, your assumption).','Heights are modelled; no data on who lives on which floor.'],
  drill:['assumption','Evacuation drill: plan routes on OpenStreetMap streets + flood depths (data), with your assumptions: follow rate, time to get ready, walking speed, warning lead time, shelter places, rescue rate.','Training aid: people do not all behave the same way; range shown for faster/slower reactions.'],
  rescue:['assumption','Rescue: your rescue capacity (people per hour), starting 30 min after the first person is in danger; national support ×3 (assumption).','No published Belgian rate used: set it with the fire and rescue zone.'],
  cost:['external','Damage: JRC depth–damage curves (Huizinga 2017, via CLIMAAX) × building floor area (GHS-OBAT), 2010 prices × 1.218 (Eurostat HICP).','A proxy: vehicles, networks, agriculture and business interruption not counted.'],
  ems:['data','July 2021 check: share of the area seen flooded by satellite (Copernicus EMS rapid mapping, EMSR518 for Belgium) that the selected EFAS flood map also floods, per grid cell.','Satellite images from 15 and 18 July miss part of the Vesdre (taken after the water drained, streets and trees hide water): 2021 here is a minimum, so this is a hit rate, not a full validation.'],
  shel:['mix','Shelter places: floor area of real buildings (OpenStreetMap) ÷ 3.5 m² per person (Sphere standard), or set by you.','Real capacity depends on beds, toilets and staff: check with each site.']};
const KIND={data:'Challenge data',external:'Published source',assumption:'Your assumption',mix:'Data + assumption'};
document.addEventListener('click',e=>{ const el=e.target.closest('[data-src]'),pop=$('srcPop'); if(!el){ if(!e.target.closest('#srcPop')) pop.hidden=true; return; }
  const s=SRC[el.dataset.src]; if(!s) return; const r=el.getBoundingClientRect();
  pop.innerHTML=`<span class="tag ${s[0]}">${KIND[s[0]]}</span><p>${s[1]}</p><p class="hint" style="margin:0"><b>Limit:</b> ${s[2]}</p>`;
  pop.hidden=false; pop.style.left=Math.min(r.left,innerWidth-330)+'px'; pop.style.top=(r.bottom+6+pop.offsetHeight>innerHeight?r.top-pop.offsetHeight-6:r.bottom+6)+'px'; });
addEventListener('keydown',e=>{ if(e.key==='Escape'){ $('srcPop').hidden=true; } });

/* ---------- mayor's decision card: one printable page ---------- */
// Anna's report replaces the separate decision card: one PDF, page 1 = the one-minute summary (report.js)
function openCard(){ openReport(); }
$('cardBtn').onclick=openCard;

/* ---------- guided demo ---------- */
const TOUR=[
  ['The valley, with real data',()=>{tab('sim'); S.T=0; render(); map.fitBounds(D.bbox,{padding:50});},'Vesdre valley, Belgium. Every building, resident count and water depth comes from the challenge data (EFAS, GHS-POP, GHS-OBAT) and OpenStreetMap. Click any dotted number to see its source.'],
  ['Choose the flood',()=>{ const i=D.rps.indexOf(100); if(i>=0){$('size').value=i; $('size').oninput({target:$('size')});} },'The controls under the map set the scenario. 1-in-100 years is about the rain of July 2021 in this valley. You can also build a flood from your own rain.'],
  ['Watch the water rise',()=>{tab('sim'); S.T=0; setSpeed(5); setPlaying(true);},'Upstream and low ground flood first. Buildings turn colour when water reaches them; red streets are closed to cars.'],
  ['Who must leave, and where to',()=>{setPlaying(false); tab('safety'); S.T=.3; render();},'Each circle is a group of residents, with a car route on real streets to a shelter the app chose (far from water, room for many). Click a shelter pin to see the area it serves.'],
  ['Choose, then play',()=>{ tab('sim'); S.T=0; render(); },'Under the map: the order to give, what happens when a shelter is full, and rescue support. Choose before pressing ▶: cars leave, shelters fill up, the next best shelter is found, streets flood.'],
  ['Best actions',()=>{ setPlaying(false); showDebrief(); },'The app tests every combination of choices on the same flood and shows the sequence that leaves the fewest people not evacuated, with a range.'],
  ['Anna\'s report',()=>{ $('drillStage').hidden=true; },'Anna\'s report: one page with what flooded, what changed, whether everyone can be sheltered, and what to do first. Button: "Report" under the map.']];
let tourI=-1;
const tab=t=>document.querySelector(`.tabs [data-t="${t}"]`)?.click();
function tourGo(i){ tourI=i; const b=$('tour'); if(i<0||i>=TOUR.length){ b.hidden=true; tourI=-1; return; } const [t,act,txt]=TOUR[i]; try{act();}catch(e){}
  b.innerHTML=`<div class="ih"><span class="tag">Demo ${i+1} / ${TOUR.length}</span><b>${t}</b></div><p>${txt}</p>
    <div class="iopts row"><button class="btn sm" data-g="${i-1}" ${i?'':'disabled'}>Back</button><button class="btn sm primary" data-g="${i+1}">${i<TOUR.length-1?'Next':'Finish'}</button><button class="btn sm" data-g="-1">Exit</button></div>`;
  b.hidden=false; }
$('tour').onclick=e=>{ const g=e.target.closest('[data-g]'); if(g) tourGo(+g.dataset.g); };
$('tourBtn').onclick=()=>tourGo(0);
