// player.js - Video-style player: play/pause, restart, timeline, speed, loop.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- video player ---------- */
let anim=null,last=0; const DUR=60000; // 1× speed: the whole event in 60 s
function setPlaying(on){ S.playing=on; $('play').textContent=on?'❚❚':'▶'; $('play').setAttribute('aria-label',on?'Pause':'Play');
  cancelAnimationFrame(anim); if(!on) return; if(S.T>=1) S.T=0; last=performance.now();
  const step=t=>{const dt=t-last; last=t; S.T+=dt*S.speed/DUR; if(S.T>=1){ if($('loop').checked) S.T=0; else {S.T=1; render(); setPlaying(false); return;} } render(); anim=requestAnimationFrame(step);};
  anim=requestAnimationFrame(step);}
$('play').onclick=()=>setPlaying(!S.playing);
$('restart').onclick=()=>{S.T=0; render();};
$('time').oninput=e=>{S.T=e.target.value/1000; render();};
$('speed').oninput=e=>{S.speed=+e.target.value; $('speedV').textContent='×'+S.speed;};
