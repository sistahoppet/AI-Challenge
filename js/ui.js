// ui.js - Less on screen: each panel section folds (one open at a time per tab), long explanations hide behind ⓘ,
// the legend folds to a small button. Works on the existing HTML, so sections added later behave the same.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- sections: click the title to open; opening one closes the others in the same tab ---------- */
const KEEP_OPEN={'tab-sim':3}; // first sections that always stay visible (Simulate: flood size, play, numbers right now)
const OPEN_FIRST={'tab-sim':-1,'tab-safety':1,'tab-coord':0,'tab-diag':0,'tab-policy':0};
document.querySelectorAll('.tabbody').forEach(tab=>{
  const secs=[...tab.children].filter(s=>s.querySelector(':scope > h2'));
  secs.forEach((sec,i)=>{ if(i<(KEEP_OPEN[tab.id]||0)) return;
    const h=sec.querySelector(':scope > h2'),body=document.createElement('div'); body.className='secbody';
    [...sec.childNodes].filter(n=>n!==h).forEach(n=>body.appendChild(n)); sec.appendChild(body); sec.classList.add('sec');
    h.setAttribute('role','button'); h.tabIndex=0; h.classList.add('fold');
    const open=on=>{ sec.classList.toggle('open',on); h.setAttribute('aria-expanded',on); };
    open(i===(OPEN_FIRST[tab.id]??0));
    const toggle=()=>{ const on=!sec.classList.contains('open'); if(on) tab.querySelectorAll('.sec.open').forEach(o=>{o.classList.remove('open'); o.querySelector('h2').setAttribute('aria-expanded',false);}); open(on); if(on) sec.scrollIntoView({block:'nearest',behavior:'smooth'}); };
    h.onclick=toggle; h.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault(); toggle();}}; });
});
// "Show on map" + "Map details" become one "Map layers" section
(()=>{ const secs=[...$('tab-sim').querySelectorAll('.sec')],a=secs.find(s=>/Show on map/.test(s.querySelector('h2').textContent)),b=secs.find(s=>/Map details/.test(s.querySelector('h2').textContent));
  if(a&&b){ a.querySelector('h2').textContent='Map layers'; const sub=document.createElement('p'); sub.className='sub'; sub.textContent='Map details (OpenStreetMap)'; a.querySelector('.secbody').append(sub,...b.querySelector('.secbody').childNodes); b.remove(); } })();

/* ---------- long explanations → ⓘ ---------- */
document.querySelectorAll('.tabbody p.hint, .tabbody .secbody > .hint').forEach(p=>{
  if(['sizeHint','evScen'].includes(p.id)) return; const dyn=['evNote','wxStatus'].includes(p.id);
  if(!dyn&&p.textContent.trim().length<90) return;
  const d=document.createElement('details'); d.className='info'; d.innerHTML='<summary>ⓘ How this works</summary>'; p.replaceWith(d); d.appendChild(p); p.style.margin='4px 0 0'; });

/* ---------- legend: folds to a small button ---------- */
(()=>{ const L=$('legend'); let open=false; const btn=document.createElement('button'); btn.className='ov legbtn'; btn.textContent='Legend ▸'; L.after(btn);
  const set=on=>{open=on; L.classList.toggle('folded',!on); btn.textContent=on?'Legend ▾':'Legend ▸'; btn.setAttribute('aria-expanded',on);}; set(false);
  btn.onclick=()=>set(!open); })(); // legend folded by default; the button opens it
