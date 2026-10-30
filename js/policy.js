// policy.js - "Live model" tab, section 9: policy advice. Sends the model results this page already got from the flood API
// (A.res, filled by api.js) to the team's policy API (flood-policy-advisor), which answers which of the team's policies to take.
// Answer by: Claude (key typed here, sent only to the policy API for that one request), the local model on the server, or rules only.
// Policy API address: ?policy=http://host:port in the page URL, or the field (remembered in this browser).

const POLICY_DEFAULT=location.hostname==='dev.nsrddyn.com'?`${location.origin}/policy`:/^valencia\b|^100\.108\.90\.108$/.test(location.hostname)?`http://${location.hostname}:8082`:'http://valencia.tail142ce3.ts.net:8082';
const store={get(k){try{return localStorage.getItem(k)??sessionStorage.getItem(k);}catch(e){return null;}},
  set(k,v,keep){try{(keep?localStorage:sessionStorage).setItem(k,v);(keep?sessionStorage:localStorage).removeItem(k);}catch(e){}},
  del(k){try{localStorage.removeItem(k);sessionStorage.removeItem(k);}catch(e){}}};
const P={url:(new URLSearchParams(location.search).get('policy')||store.get('fse-policy')||POLICY_DEFAULT).replace(/\/+$/,''),health:null};
const POLICY_INPUTS=[['flood','2 · Flood risk'],['evacuation','3 · Evacuation'],['timeline','4 · Timeline'],['region','5 · Area check'],['impact','7 · Damage 2021'],['models','8 · Model checks']];

async function policyConnect(){ $('pState').textContent='Connecting…';
  try{ const r=await fetch(P.url+'/health',{cache:'no-store'}); P.health=r.ok?await r.json():null; }catch(e){ P.health=null; }
  const h=P.health, loc=$('pProv').querySelector('[value=local]');
  if(!h){ $('pState').textContent=`Policy API not reachable at ${P.url} (team network / Tailscale needed).`; $('pState').classList.add('err'); return; }
  $('pState').classList.remove('err');
  loc.disabled=!h.providers?.local; loc.textContent=h.providers?.local?`Local model on the server (${h.providers.local}, slow: ~15 min)`:'Local model (not running on the server)';
  $('pState').textContent=`Connected to ${P.url} · Claude key on server: ${h.providers?.claude?.server_key?'yes':'no'}`;
  policyForm(); }

function policyForm(){ const prov=$('pProv').value, h=P.health;
  $('pKeyRow').hidden=prov!=='claude';
  $('pKeyHint').textContent=h?.providers?.claude?.server_key?'Optional: the server has its own key. A key typed here is used instead.':'Needed: the server has no Claude key.';
  $('pInputs').innerHTML='Uses: '+POLICY_INPUTS.map(([k,l])=>`<span class="tag${A.res?.[k]?' data':''}">${A.res?.[k]?'✓':'–'} ${esc(l)}</span>`).join(' ')
    +(Object.keys(A.res||{}).some(k=>POLICY_INPUTS.some(p=>p[0]===k&&k!=='impact'&&k!=='models'))?'':'<br>Run 2, 3, 4 or 5 first for advice about this area.'); }

async function policyAdvise(){
  const models=Object.fromEntries(POLICY_INPUTS.map(([k])=>[k,A.res?.[k]]).filter(([,v])=>v));
  if(!Object.keys(models).length) throw new Error('No model results yet: run at least one of sections 2–5 first.');
  const prov=$('pProv').value, key=$('pKey').value.trim(), headers={'content-type':'application/json'};
  if(prov==='claude'&&key){ headers['x-anthropic-key']=key; if($('pKeep').checked) store.set('fse-claude-key',key,true); else store.set('fse-claude-key',key,false); }
  const body={area:A.area?A.area.join(', '):'',language:$('pLang').value,provider:prov,question:$('pQ').value.trim(),models};
  const t0=Date.now(), out=$('pOut');
  let r; try{ r=await fetch(P.url+'/advise?async=1',{method:'POST',headers,body:JSON.stringify(body)}); }
  catch(e){ throw new Error('The policy API can\'t be reached at '+P.url+'.'); }
  let j=await r.json().catch(()=>({error:'HTTP '+r.status}));
  if(!r.ok&&r.status!==202) throw new Error(j.error||('HTTP '+r.status));
  while(j.status==='running'&&j.job){
    out.innerHTML=`<p class="hint">Thinking… ${Math.round((Date.now()-t0)/1000)} s${prov==='local'?' (the local model is slow: ~15 min)':''}</p>`;
    await new Promise(res=>setTimeout(res,3000));
    try{ r=await fetch(`${P.url}/jobs/${j.job}`,{cache:'no-store'}); }catch(e){ throw new Error('Lost the policy API while waiting; try again.'); }
    j=await r.json().catch(()=>({error:'HTTP '+r.status}));
    if(r.status===202) continue; if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); }
  policyShow(j); }

function policyShow(j){
  const who={claude:`Claude (${j.model})`,local:`local model (${(j.model||'').replace('local:','')})`,rules:'rules (no AI)'}[j.source]||j.source;
  const pr={now:'crit',soon:'',later:''};
  $('pOut').innerHTML=`<p style="margin:8px 0"><span class="tag data">${esc(who)}</span>${j.cached?' <span class="tag">cached</span>':''}</p>`
    +(j.ai_rejected?`<p class="hint err">AI answer not used: ${esc(j.ai_rejected.reason)}${j.ai_rejected.problems?' ('+j.ai_rejected.problems.map(esc).join('; ')+')':''}. Showing the rule-based advice.</p>`:'')
    +`<p style="font-size:14px">${esc(j.summary)}</p>`
    +`<ol class="safe">${(j.recommendations||[]).map(r=>`<li><span class="n ${pr[r.priority]??''}">${r.rank}</span><span><b>${esc(r.title)}</b> <span class="tag">${esc(r.priority)}</span><br>${esc(r.why)}
      <details><summary class="hint" style="cursor:pointer">What and why (2021)</summary><p class="hint">${esc(r.what)}</p><p class="hint">2021: ${esc(r.lesson_2021)}</p>
      <p class="hint">Model facts: ${(r.evidence||[]).map(e=>`${esc(e.text)} = ${typeof e.value==='number'?fmtFull(e.value):esc(e.value)}`).join(' · ')||'–'}</p><p class="hint">Source: ${esc(r.source)}</p></details></span></li>`).join('')}</ol>`
    +(j.unknowns?.length?`<h3>What the models don't tell</h3><ul>${j.unknowns.map(u=>`<li class="hint">${esc(u)}</li>`).join('')}</ul>`:'')
    +`<p class="hint">${esc(j.disclaimer||'')}</p>`; }

$('pUrl').value=P.url;
$('pKey').value=store.get('fse-claude-key')||''; $('pKeep').checked=(()=>{try{return !!localStorage.getItem('fse-claude-key');}catch(e){return false;}})();
$('pGo').onclick=()=>{ P.url=$('pUrl').value.trim().replace(/\/+$/,''); store.set('fse-policy',P.url,true); policyConnect(); };
$('pProv').onchange=policyForm;
$('pForget').onclick=()=>{ store.del('fse-claude-key'); $('pKey').value=''; $('pKeep').checked=false; };
$('pRun').onclick=e=>run(e.target,$('pOut'),policyAdvise);
// called from apiShow / after each model run so the "Uses:" line stays current
function policyInit(){ policyConnect(); }
