// main.js - Start-up: how-to-use guide, load demo data, auto-load team files from /data.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- guide ---------- */
// store: see policy.js (loaded earlier)
function showGuide(on){$('guide').hidden=!on; document.body.classList.toggle('explain',on); $('helpBtn').setAttribute('aria-expanded',on);} // also shows the explanations in the side panel
$('helpBtn').onclick=()=>showGuide($('guide').hidden); $('guideOk').onclick=()=>{showGuide(false); store.set('fse-guide','1');};

function load(data,demo){
  D=data; computeZones(D); isDemo=demo; peakCache={}; S.sizeIdx=Math.min(1,D.rps.length-1); S.T=0; setPlaying(false);
  $('dataBadge').textContent=demo?'DEMO DATA':'TEAM DATA'; $('dataBadge').classList.toggle('real',!demo);
  buildSources(); drawSize(); drawLegend(); drawZones(); drawActor(); drawAgree(); drawCmp(); drawDList();
  if(!map) initMap(); else if(ready){ refreshData(); applyLayers(); render(); map.fitBounds(D.bbox,{padding:50}); }
  if(S.tab==='diag') drawDiagram(); if(S.tab==='fc') drawForecast(); if(typeof drawCities==='function') drawCities(); if(typeof drawScenarioInfo==='function') drawScenarioInfo();
}
const mq=matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change',recolor);
new MutationObserver(recolor).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(!window.maplibregl){ $('map').innerHTML='<p style="padding:24px">The map library did not load. Check your internet connection and reload.</p>'; }
else { // demo first so the map shows at once (the team files take seconds to download), then team data replaces it
  load(ingest(makeDemo()).data,true); apiInit(); if(!store.get('fse-guide')) showGuide(true); // the synthetic demo only builds the map: it stays covered until the real data is in
  srvMsg('Loading the team data…'); (SERVER_AOI?loadServerArea(SERVER_AOI):tryAutoLoad().then(()=>srvMsg(''))); }
