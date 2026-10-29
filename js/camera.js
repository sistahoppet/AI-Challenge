// camera.js - Smooth 2D <-> 3D switch and camera controls (zoom, turn, tilt, auto-orbit).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- 2D <-> 3D and camera ---------- */
let liftAnim=null; const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function setMode(m){ if(m===S.mode||!ready) return; S.mode=m; const three=m==='3d';
  $('v3d').textContent=three?'2D':'3D'; $('v3d').title=three?'Back to flat 2D map':'Switch to 3D view';
  $('grp3d').hidden=!three; $('hint3d').hidden=!three; $('exagRow').hidden=!three; $('hillsRow').hidden=!three;
  const dur=reduce?0:1100,from=S.lift,to=three?1:0,t0=performance.now();
  if(three) S.l3d=true; else setOrbit(false);
  cancelAnimationFrame(liftAnim); applyLayers(); applyTerrain(); setBasemap(S.basemap);
  map.easeTo(three?{pitch:60,bearing:map.getBearing()||-20,duration:dur}:{pitch:0,bearing:0,duration:dur});
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const step=t=>{const k=dur?Math.min(1,(t-t0)/dur):1; S.lift=from+(to-from)*ease(k); applyLayers();
    if(k<1) liftAnim=requestAnimationFrame(step); else if(!three){S.l3d=false; applyLayers(); applyTerrain(); setBasemap(S.basemap);}};
  liftAnim=requestAnimationFrame(step);}
$('v3d').onclick=()=>setMode(S.mode==='3d'?'2d':'3d');
let orbitAnim=null;
function setOrbit(on){ $('orbit').setAttribute('aria-pressed',on); cancelAnimationFrame(orbitAnim); orbitAnim=null; if(!on||!ready) return;
  const spin=()=>{map.setBearing(map.getBearing()+0.12); orbitAnim=requestAnimationFrame(spin);}; orbitAnim=requestAnimationFrame(spin);}
$('orbit').onclick=()=>setOrbit(!orbitAnim);
$('rotL').onclick=()=>map.easeTo({bearing:map.getBearing()-30,duration:500});
$('rotR').onclick=()=>map.easeTo({bearing:map.getBearing()+30,duration:500});
$('tiltU').onclick=()=>map.easeTo({pitch:Math.min(80,map.getPitch()+12),duration:500});
$('tiltD').onclick=()=>{const p=map.getPitch()-12; if(p<=5) setMode('2d'); else map.easeTo({pitch:p,duration:500});};
$('zin').onclick=()=>map.easeTo({zoom:map.getZoom()+1,duration:400}); $('zout').onclick=()=>map.easeTo({zoom:map.getZoom()-1,duration:400});
$('zfit').onclick=()=>map.fitBounds(D.bbox,{padding:50,pitch:map.getPitch(),bearing:map.getBearing()});
$('map').addEventListener('pointerdown',()=>orbitAnim&&setOrbit(false));
document.querySelectorAll('.basemap [data-b]').forEach(b=>b.onclick=()=>setBasemap(b.dataset.b));
$('tHills').onchange=()=>{applyTerrain(); setBasemap(S.basemap);};
$('exag').oninput=e=>{S.exag=+e.target.value; $('exagV').textContent=S.exag+'×'; applyLayers();};
$('tBld').onchange=applyLayers;
document.addEventListener('keydown',e=>{ if(e.target.closest('input,select,textarea')||!$('modal').hidden) return;
  if(e.key===' '){e.preventDefault(); setPlaying(!S.playing);} });
