// main.js - Start-up: how-to-use guide, load demo data, auto-load team files from /data.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- guide ---------- */
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
function showGuide(on){$('guide').hidden=!on; $('legend').hidden=on;}
$('helpBtn').onclick=()=>showGuide($('guide').hidden); $('guideOk').onclick=()=>{showGuide(false); store.set('fse-guide','1');};

function load(data,demo){
  D=data; computeZones(D); isDemo=demo; peakCache={}; S.sizeIdx=Math.min(1,D.rps.length-1); S.T=0.5; setPlaying(false);
  $('dataBadge').textContent=demo?'DEMO DATA':'TEAM DATA'; $('dataBadge').classList.toggle('real',!demo);
  buildSources(); drawSize(); drawLegend(); drawZones(); drawActor(); drawAgree(); drawCmp(); drawDList();
  if(!map) initMap(); else if(ready){ refreshData(); applyLayers(); render(); map.fitBounds(D.bbox,{padding:50}); }
  if(S.tab==='diag') drawDiagram();
}
const mq=matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change',recolor);
new MutationObserver(recolor).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(!window.maplibregl){ $('map').innerHTML='<p style="padding:24px">The map library did not load. Check your internet connection and reload.</p>'; }
else { // demo first so the map shows at once (the team files take seconds to download), then team data replaces it
  load(ingest(makeDemo()).data,true); apiInit(); if(!store.get('fse-guide')) showGuide(true); tryAutoLoad(); }
