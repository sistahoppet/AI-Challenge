// impact.js - "Impact for the mayor": the team's three-stage framework (anticipation, coordination, institutionalisation)
// computed from the app's data where it exists; behaviour and money stay visible assumptions (defaults = the framework's examples).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

const IM={R0:60,Q0:70,R1:90,Q1:80,T0:6,T1:2,C:2,D0:30,D1:18}; // %, %, %, %, hours, hours, €M, €M, €M (hypothetical)
// expected residents in flooded areas per year: area under the (probability, residents) curve between the mapped flood sizes
function expectedAnnual(){ const pts=D.rps.map(r=>[1/r,peak(r).people]).sort((a,b)=>b[0]-a[0]); let s=0;
  for(let i=0;i<pts.length-1;i++) s+=(pts[i][0]-pts[i+1][0])*(pts[i][1]+pts[i+1][1])/2; return s+pts[pts.length-1][0]*pts[pts.length-1][1]; }
function planWithLead(m){ const keep=SC.leadMin; SC.leadMin=m; const P=planFor(rp()); SC.leadMin=keep; return P; } // m = warning lead time in minutes
function drawImpact(){ if(!D||!E.plan) return; const P=E.plan,r=rp(),N=P.total,K=E.shelters.reduce((s,_,k)=>s+capOf(k),0);
  const ev=(R,Q)=>Math.min(N*R/100*Q/100,K),b=ev(IM.R0,IM.Q0),a=ev(IM.R1,IM.Q1),gain=Math.max(0,IM.T0-IM.T1);
  const pb=planWithLead(SC.leadMin),pa=planWithLead(SC.leadMin+gain*60),inTime=x=>x.moved-x.slow,dD=IM.D0-IM.D1,thr=dD>0?IM.C/dD*100:null,pf=1/r*100;
  const row=(k,v,src)=>`<tr><td>${k}</td><td class="mono">${v}</td><td>${src==='data'?'<span class="tag data">data</span>':src==='mix'?'<span class="tag data">data</span> <span class="tag">assumption</span>':'<span class="tag">assumption</span>'}</td></tr>`;
  $('impOut').innerHTML=`<table class="tbl"><tbody>
    <tr><th colspan="3">1 · Anticipation</th></tr>
    ${row('Residents to move (this flood size)',fmtFull(N),'data')}
    ${row('Shelter places in the plan',fmtFull(K),'data')}
    ${row('Shelter coverage (places ÷ people)',N?Math.round(K/N*100)+'%':'–','data')}
    ${row('Residents in flooded areas, expected per year',fmt(expectedAnnual()),'data')}
    ${row(`Activation threshold C ÷ (D0 − D1)`,thr!=null?thr.toFixed(1)+'%':'–','assumption')}
    <tr><th colspan="3">2 · Coordination</th></tr>
    ${row(`Evacuated, today's alerts (${IM.R0}% reach × ${IM.Q0}% follow, max = places)`,`${fmtFull(b)} (${N?Math.round(b/N*100):0}%)`,'mix')}
    ${row(`Evacuated, with the tool (${IM.R1}% × ${IM.Q1}%)`,`${fmtFull(a)} (${N?Math.round(a/N*100):0}%)`,'mix')}
    ${row('Extra people evacuated',`+${fmtFull(a-b)}`,'mix')}
    <tr><th colspan="3">3 · Institutions</th></tr>
    ${row(`Decision time ${IM.T0} h → ${IM.T1} h`,IM.T0?`−${Math.round(gain/IM.T0*100)}%`:'–','assumption')}
    ${row(`Reach a shelter in time by car: warning ${SC.leadMin} → ${SC.leadMin+gain*60} min`,`${fmtFull(inTime(pb))} → ${fmtFull(inTime(pa))} (+${fmtFull(inTime(pa)-inTime(pb))})`,'mix')}
  </tbody></table>
  <p style="font-size:14px;margin:8px 0 0"><b>For the mayor:</b> ${N?`at a ${sizeWord(r).toLowerCase()} flood ${fmtFull(N)} residents must leave, but the shelters in the plan hold ${fmtFull(K)} (${Math.round(K/N*100)}%). `:''}
   ${N&&a-b<1&&K<N*IM.R1/100*IM.Q1/100?`Better alerts add nobody while the shelters are full: <b>shelter capacity is the bottleneck</b>. `:''}
   ${gain?`Deciding ${gain} h faster lets about ${fmtFull(inTime(pa)-inTime(pb))} more people reach a shelter by car before the water. `:''}
   ${thr!=null?`With the cost and damage figures entered, acting is worth it when the flood chance is above ${thr.toFixed(0)}% (this map's yearly chance: ${pf<1?pf.toFixed(1):Math.round(pf)}%).`:''}</p>
  <p class="hint">Data: EFAS flood maps, GHS-POP/OBAT, OpenStreetMap shelters and roads, your plan in Evacuate. Assumptions: alert reach and compliance, decision times, costs and damages are illustrative (the framework's example values): replace them with sourced figures before quoting. Euros are hypothetical: no depth–damage data is loaded.</p>`; }
const IMF=[['R0','Alert reach today, %'],['Q0','People who follow, today, %'],['R1','Alert reach with tool, %'],['Q1','People who follow, with tool, %'],
  ['T0','Decision time today, h'],['T1','Decision time with tool, h'],['C','Cost of acting, €M'],['D0','Damage if no action, €M'],['D1','Damage with action, €M']];
$('impIn').innerHTML=IMF.map(([k,t])=>`<label>${t}<input class="btn" type="number" step="any" min="0" data-im="${k}" value="${IM[k]}"></label>`).join('');
$('impIn').oninput=e=>{const k=e.target.dataset.im; if(k&&e.target.value!==''){IM[k]=+e.target.value; drawImpact();}};
