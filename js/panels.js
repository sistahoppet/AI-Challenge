// panels.js - Right-hand tabs: flood size slider, Safety tab, Policy tab.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- flood size ---------- */
function drawSize(){ const r=rp(); $('size').max=D.rps.length-1; $('size').value=S.sizeIdx;
  $('sizeWord').textContent=`${sizeWord(r)} flood`;
  $('sizeHint').textContent=`Expected about once every ${r} years (a ${chance(r)} chance each year).`;
  $('sizeTicks').innerHTML=D.rps.map(x=>`<span>${sizeWord(x)}</span>`).join(''); }
$('size').oninput=e=>{S.sizeIdx=+e.target.value; drawSize(); render(); drawActor(); drawAgree(); drawCmp(); makePlan(); if(S.tab==='diag') drawDiagram(); if(S.tab==='coord') drawCoord();};

/* ---------- tabs ---------- */
function setTab(t){ S.tab=t; document.querySelectorAll('.tabs [data-t]').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t));
  ['sim','safety','coord','diag','policy'].forEach(k=>$('tab-'+k).hidden=k!==t);
  $('stage').hidden=t!=='diag'; if(t==='diag') drawDiagram(); if(t==='coord') drawCoord(); if(t==='policy') drawImpact(); drawLegend(); applyLayers(); }
document.querySelector('.tabs').onclick=e=>{const b=e.target.closest('[data-t]'); if(b) setTab(b.dataset.t);};
$('stageClose').onclick=()=>setTab('sim');

/* ---------- safety ---------- */
function drawZones(){ const r=D.zoneRule;
  $('zoneLegend').innerHTML=[[3,'--zr','Red: high risk',`Floods even in a frequent flood (1-in-${r.lo}), or water over 1.5 m in a 1-in-${r.mid} flood`],
    [2,'--zy','Yellow: caution','Floods only in rarer floods, or was flooded in 2021'],[1,'--zg','Green: safer','Dry in every flood size']]
   .map(([z,v,t,s])=>`<div class="crow" style="align-items:start"><span class="sw" style="background:var(${v});margin-top:3px"></span><span><b>${t}</b><br><span class="hint" style="margin:0">${s}</span></span><span class="mono">${fmt(D.zoneTot[z-1].people)} people</span></div>`).join('');}
function drawSafe(){ drawShelterList(); drawShelters(); } // shelters start from the safest places (evac.js)
function flyTo(k){ setOrbit(false); if(S.tab!=='safety'&&S.tab!=='coord') setTab('safety'); map.flyTo({center:E.shelters[k].c,zoom:16,duration:1400}); }

/* ---------- policy ---------- */
function drawActor(){
  const r=rp(),pk=peak(r),deep=pk.cc[2],lo=peak(D.rps[0]),hi=peak(D.rps[D.rps.length-1]),o=D.hasObs?peak('obs'):null,sc=`${sizeWord(r).toLowerCase()} (1-in-${r}-year) flood`,a=$('actorSel').value;
  const T={
    muni:[`${fmt(deep.bld)} buildings sit where water goes over 1.5 m in a ${sc}. Which of them got rebuilding permits after 2021?`,
      `Check whether schools, care homes and the town hall are among the ${fmt(pk.bld)} buildings in the water (needs a building-use layer).`,
      `Show residents their own street at each flood size in a public meeting.`],
    region:[`People in flooded areas grow from ${fmt(lo.people)} (frequent flood) to ${fmt(hi.people)} (extreme flood). Where the jump is biggest, zoning rules matter most.`,
      `Reconstruction money: start with the ${fmt(deep.people)} residents where water goes over 1.5 m.`,`Compare towns: which municipality carries most of the risk?`],
    cp:[`${fmt(pk.people)} people live in areas that flood in a ${sc}; ${fmt(deep.people)} of them where water goes over head height.`,
      `Use the video to plan the evacuation order: low ground floods first.`,`Place shelters at the green "safest places" (Safety tab), outside every flood size.`],
    eu:[o?`The real 2021 flood covered areas where ${fmt(o.people)} people live. Compare with each flood size to see how rare 2021 looks on the hazard maps.`:`Load the 2021 flood file to compare the event with the hazard maps.`,
      `The same method works in Belgium, Germany and the Netherlands: comparable cross-border figures.`,`Where satellite and model disagree, hazard maps or mapping practice may need review.`]};
  $('actorText').innerHTML=(isDemo?['<i>Demo numbers: replace with your team data before quoting.</i>']:[]).concat(T[a]).map(t=>`<li>${t}</li>`).join('');
}
$('actorSel').onchange=drawActor;
function agreeStats(r){ let both=0,mod=0,obs=0; D.cells.forEach(c=>{const w=c.depth[r]>0.01; if(w&&c.obs) both+=c.area; else if(w) mod+=c.area; else if(c.obs) obs+=c.area;}); return {both:both/1e6,mod:mod/1e6,obs:obs/1e6};}
function drawAgree(){ if(!D.hasObs){$('agree').innerHTML='<p class="hint" style="margin:0">Load the 2021 flood file to compare.</p>';return;}
  const r=rp(),a=agreeStats(r),hit=(a.both/(a.both+a.obs||1))*100,inside=(a.both/(a.both+a.mod||1))*100;
  $('agree').innerHTML=`<div class="crow" style="grid-template-columns:1fr auto"><span>Of the area flooded in 2021, the ${sizeWord(r).toLowerCase()} flood map also floods</span><b class="mono">${hit.toFixed(0)}%</b></div>
   <div class="crow" style="grid-template-columns:1fr auto;margin-top:6px"><span>Of the ${sizeWord(r).toLowerCase()} flood area, flooded in 2021 too</span><b class="mono">${inside.toFixed(0)}%</b></div>
   <p class="hint">Low overlap does not mean the model is wrong: the satellite misses some water, and 2021 may have been rarer or more common than this flood size.</p>`;}

/* ---------- model vs real July 2021 ---------- */
// Model = EFAS flood-hazard map for the chosen flood size (what COULD happen). 2021 = Copernicus EMS satellite outline (what WAS seen).
function drawCmp(){ document.querySelectorAll('#cmpSeg [data-c]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===S.cmp));
  const r=rp(),pk=peak(r),oa=(D.observed?.features||[]).flatMap(f=>polysOf(f.geometry)).reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((h,q)=>h+ringArea(q),0),0)/1e6,a=D.hasObs?agreeStats(r):null,wx=WX?.data?.rainLevels,rain21=WX?.data?.replayRain?.reduce((m,x)=>Math.max(m,x.mm48),0);
  const T21=wx&&rain21?levelOf(rain21,wx):null;
  $('cmpBox').innerHTML=`<div class="crow" style="grid-template-columns:14px 1fr auto"><span class="sw" style="background:var(--w2)"></span><span><b>Model</b>: flood map for a ${sizeWord(r).toLowerCase()} flood (1-in-${r}), EFAS</span><span class="mono">${pk.area.toFixed(1)} km²</span></div>
   <div class="crow" style="grid-template-columns:14px 1fr auto"><span class="sw" style="background:var(--obs)"></span><span><b>July 2021</b>: water seen by satellite, Copernicus EMS</span><span class="mono">${D.hasObs?oa.toFixed(2)+' km²':'not loaded'}</span></div>
   ${a?`<p class="hint">Of the model area, ${((a.both/(a.both+a.mod||1))*100).toFixed(0)}% was also seen as flooded in 2021.</p>`:''}
   <p class="hint">${T21?`<b>The 2021 rain</b> (${Math.round(rain21)} mm in 48 h) matches the <b>1-in-${T21}</b> rain level, so the closest model scenario is the ${sizeWord(D.rps[planFromRp(T21)]).toLowerCase()} flood map. `:''}
   Why the 2021 outline looks small here: the satellite images are from 15 July (only part of the valley) and 18 July, after most Vesdre water had drained; narrow streets and water under trees are also missed. So 2021 here is a minimum, not the full flood.</p>`; }
document.querySelector('#cmpSeg').onclick=e=>{const b=e.target.closest('[data-c]'); if(!b) return; S.cmp=b.dataset.c; drawCmp(); drawLegend(); applyLayers();};
