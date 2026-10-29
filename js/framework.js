// framework.js - The team's evidence-based policy framework as diagrams: architecture, method review, stages and their status in
// this app, plus charts computed from the app's data (clearance time, G-6, risk curve, fill rate) and hypothetical € charts (cost–loss, BCR).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

const FW={mob:60,delay:15,p:30}; // assumptions: minutes to get ready, minutes of delay on the way; forecast chance (%) for the BCR example
const HYPO='Hypothetical values (the framework\'s example): replace with sourced figures before quoting';
const fwSrc='Framework: UNDRR (Sendai, AAL, Scorecard), JRC depth–damage (Huizinga et al. 2017), ECMWF cost–loss, USACE HEC-FIA, Liu et al. 2014, EC cost–benefit';

function fwChart(k){ const r=rp(),dataSrc=isDemo?'DEMO DATA':'Data: EFAS, GHS-POP, GHS-OBAT, OpenStreetMap, Copernicus DEM';
  if(k==='fwArch'){ const sf=css('--surface'),c1=mix(css('--accent'),sf,.14),c2=mix(css('--obs'),sf,.18),c3=mix(css('--zg'),sf,.16),w=330,x1=24,x2=400;
    const M=[['M1','Module 1 · Risk assessment','UNDRR AAL + JRC depth–damage','In app: residents per flood size, risk curve; € damage not yet (no damage curves loaded)',c1],
      ['M2','Module 2 · Decision support','ECMWF cost–loss model','In app: rain/forecast triggers (Plan A/B/C); cost–loss with hypothetical €',c1],
      ['M3','Module 3 · Response optimisation','HEC-FIA + humanitarian logistics','In app: evacuation plan, clearance time, G-6, team dispatch (nearest / priority), fill rate',c2],
      ['M4','Module 4 · Institutional resilience','UNDRR Disaster Resilience Scorecard','In app: who-does-what checklist only (scorecard not computed)',c3],
      ['M5','Module 5 · Policy impact evaluation','NPV + benefit–cost ratio','In app: single-intervention BCR with hypothetical €',c3]];
    return {kind:'boxes',title:'AI-assisted crisis management: five modules',sub:'Left: the method each module uses. Right: what this prototype already does with real data.',src:fwSrc,H:600,
      nodes:M.flatMap(([id,t,m,a,f],i)=>[{id,label:`${t}\n${m}`,x:x1,y:96+i*98,w,h:62,fill:f},{id:id+'a',label:wrapTxt(a,44),x:x2,y:96+i*98,w:340,h:62,fill:css('--bg'),left:true}]),
      edges:M.slice(1).map((m,i)=>[M[i][0],m[0]]).concat(M.map(m=>[m[0],m[0]+'a'])),csv:[['module','method','in this app'],...M.map(m=>[m[1],m[2],m[3]])]}; }
  if(k==='fwMethods') return {kind:'table',title:'Review of the calculation methods',sub:'Which formulas are supported by established methods, and what replaces the rest.',src:fwSrc,
    cols:['Original method','Validation','Recommended adjustment'],w:[250,170,290],rows:[
      ['Expected loss = probability × damage','Supported','Average Annual Loss (UNDRR)'],['Activation threshold = cost / avoided damage','Supported','ECMWF cost–loss model'],
      ['Evacuation rate = evacuated / at-risk','Supported','UNDRR indicator G-6'],['Evacuated = population × reach × compliance','Simplified assumption','Evacuation modelling (e.g. HEC-FIA)'],
      ['Resource matching = fulfilled / requested','Supported (logistics research)','Define as fill rate'],['Resource allocation = maximise lives protected','Incomplete','Constrained optimisation'],
      ['Infrastructure risk = failure probability × impact','Supported as expected loss','Infrastructure damage / service models'],['Decision-time reduction (%)','Valid operational KPI','Not an international standard'],
      ['Critical service continuity (%)','Needs a definition','SAIDI or Sendai Target D'],['Benefit–cost ratio','Supported','Discounted BCR for long-term policies']]};
  if(k==='fwStages') return {kind:'table',title:'Recommended framework for the 2021 floods, and where this app stands',sub:'Status: ● uses real data · ◐ partly / with assumptions · ○ not built yet.',src:fwSrc,
    cols:['Stage','Method (reference)','In this app'],w:[170,230,310],rows:[
      ['1 · Flood risk prediction','Average Annual Loss (UNDRR)','◐ Risk curve and expected residents per year from EFAS + GHS; no € yet'],
      ['2 · Economic damage','Depth–damage functions (JRC)','○ Depth at every building is ready; JRC curves and asset values not loaded'],
      ['3 · Policy activation','Cost–loss model (ECMWF)','◐ Calculator and diagram with hypothetical €'],
      ['4 · Evacuation planning','G-6 + HEC-FIA (UNDRR / USACE)','◐ G-6 and clearance time from real routes and flood timing; HEC-FIA not used'],
      ['5 · Resource allocation','Humanitarian logistics (Liu et al. 2014)','◐ Team dispatch nearest / priority (greedy) and fill rate; not the full optimisation'],
      ['6 · Infrastructure disruption','SAIDI / Sendai Target D','◐ Critical sites in the water listed; no outage data'],
      ['7 · Institutional resilience','Disaster Resilience Scorecard (UNDRR)','○ Checklist only; scorecard not computed'],
      ['8 · Economic evaluation','NPV and BCR (European Commission)','◐ Single-intervention BCR with hypothetical €']]};
  if(k==='fwClear'){ const P=E.plan; if(!P) return {kind:'empty',title:'Evacuation clearance time',sub:'The evacuation plan is not ready yet.',src:dataSrc,csv:[['note'],['no plan']]};
    const rows=P.routes.map(x=>{ const g=P.groups.find(g=>mDist(g.c,x.pts[0])<1),avail=g&&isFinite(g.ts)?g.ts*SC.mins:null;
      return {label:`Wave ${x.wave} · ${fmtFull(x.people)} people → shelter ${x.k+1}`,a:avail,b:FW.mob+x.min+FW.delay,people:x.people}; }).filter(x=>x.a!=null).sort((a,b)=>(a.a-a.b)-(b.a-b.b)).slice(0,14);
    const late=rows.filter(x=>x.b>x.a).length;
    return {kind:'dumbbell',title:'Can people leave before the water arrives?',sub:`T clearance = ${FW.mob} min to get ready + walking time (real route) + ${FW.delay} min delay, vs T available = when water reaches the group (event = ${SC.mins} min). ${late} of these ${rows.length} groups are too late.`,
      rows,aName:'Time available (water arrives)',bName:'Clearance time',xTitle:'minutes',src:dataSrc+' · mobilisation and delay are assumptions (Evacuate tab)',
      csv:[['group','available_min','clearance_min','people'],...rows.map(x=>[x.label,Math.round(x.a),Math.round(x.b),Math.round(x.people)])]}; }
  if(k==='fwG6'){ const rows=D.rps.map(rr=>{const P=planFor(rr),prot=P.routes.filter(x=>FW.mob+x.min+FW.delay<=(P.groups.find(g=>mDist(g.c,x.pts[0])<1)?.ts??0)*SC.mins).reduce((s,x)=>s+x.people,0);
      const v=Math.round(P.total?prot/P.total*100:0); return {label:`${sizeWord(rr)} (1-in-${rr})`,value:v,txt:`${v}% (${fmt(prot)} of ${fmt(P.total)})`,people:prot,total:P.total,color:css('--c-mod')};});
    return {kind:'bar',title:'UNDRR G-6: share of at-risk residents protected by pre-emptive evacuation (%)',sub:'Protected = has a shelter place and can clear before the water arrives (same assumptions as the clearance chart).',rows,src:dataSrc+' · estimate from the evacuation plan, not HEC-FIA',
      csv:[['flood_size','protected','at_risk','G6_percent'],...rows.map(x=>[x.label,Math.round(x.people),Math.round(x.total),x.value])]}; }
  if(k==='fwAAL'){ const pts=D.rps.map(rr=>({r:rr,p:100/rr,n:peak(rr).people})).sort((a,b)=>b.p-a.p);
    return {kind:'line',title:'Risk curve: residents in flooded areas vs yearly chance',sub:`AAL logic (UNDRR) applied to people, as no € damage data is loaded: area under the curve ≈ ${fmt(expectedAnnual())} residents affected per year on average.`,
      x:pts.map(x=>`${x.p<1?x.p.toFixed(1):Math.round(x.p)}% / year (1-in-${x.r})`),yTitle:'residents',series:[{name:'Residents in flooded areas at the peak',color:css('--c-mod'),values:pts.map(x=>x.n)}],src:dataSrc,
      csv:[['return_period','annual_probability_percent','residents'],...pts.map(x=>[x.r,x.p.toFixed(2),Math.round(x.n)])]}; }
  if(k==='fwCost'){ const L=IM.D0-IM.D1,ps=Array.from({length:21},(_,i)=>i*5),pstar=L>0?IM.C/L*100:null;
    return {kind:'line',title:'ECMWF cost–loss model: when is acting worth it?',sub:`Act: pay C = €${IM.C}M. Don't act: expect p × L = p × €${L}M avoidable loss. Lines cross at p* = C / L = ${pstar!=null?pstar.toFixed(1)+'%':'–'}.`,
      x:ps.map(p=>p+'%'),yTitle:'€M expected',series:[{name:'Act (cost C)',color:css('--c-mod'),values:ps.map(()=>IM.C)},{name:"Don't act (p × L)",color:css('--c-obs'),values:ps.map(p=>p/100*L)}],
      vref:pstar!=null?{i:pstar/5,label:`p* = ${pstar.toFixed(1)}%`}:null,src:HYPO,csv:[['probability_percent','act_cost_EURm','no_action_expected_loss_EURm'],...ps.map(p=>[p,IM.C,(p/100*L).toFixed(2)])]}; }
  if(k==='fwBCR'){ const av=FW.p/100*(IM.D0-IM.D1),rows=[{label:'Expected avoided damage',value:av,color:css('--c-mod')},{label:'Cost of the intervention',value:IM.C,color:css('--c-obs')},{label:'Net expected benefit',value:Math.max(0,av-IM.C),color:css('--c-both')}].map(x=>({...x,txt:`€${x.value.toFixed(1)}M`}));
    return {kind:'bar',title:`Benefit–cost: BCR = ${(av/(IM.C||1)).toFixed(2)} (€ million)`,sub:`Forecast chance ${FW.p}% × (D0 €${IM.D0}M − D1 €${IM.D1}M) vs cost €${IM.C}M. Single intervention, not a discounted multi-year appraisal.`,rows,src:HYPO,
      csv:[['item','EUR_million'],...rows.map(x=>[x.label,x.value.toFixed(2)]),['BCR',(av/(IM.C||1)).toFixed(2)]]}; }
  if(k==='fwFill'){ const C=RS.cmp; if(!C) return {kind:'empty',title:'Fill rate of emergency teams',sub:'Run "Dispatch now" in the Alert tab first.',src:dataSrc,csv:[['note'],['no dispatch']]};
    const rows=[];['nearest','priority'].forEach(m=>{const o=C[m],n=o.I.length; [[Infinity,'reached at all'],[30,'reached within 30 min']].forEach(([lim,t])=>{const v=Math.round(n?o.I.filter(x=>x.a!=null&&x.a<=lim).length/n*100:0); rows.push({label:`${m==='nearest'?'Nearest':'Priority'} first · ${t}`,value:v,txt:v+'%',color:css(m==='nearest'?'--c-mod':'--c-both')});}));});
    return {kind:'bar',title:'Fill rate: requests for help that get a team (%)',sub:'Requests = flooded critical sites and groups who cannot reach a shelter in time; one team each. Team numbers and speed are assumptions.',rows,src:dataSrc+' · dispatch at the moment chosen in the Alert tab',
      csv:[['rule','fill_rate_percent'],...rows.map(x=>[x.label,x.value])]}; }
}
function wrapTxt(t,n){ const w=t.split(' '),out=['']; w.forEach(x=>{ if((out[out.length-1]+' '+x).trim().length>n) out.push(x); else out[out.length-1]=(out[out.length-1]+' '+x).trim(); }); return out.join('\n'); }
// extra figure kinds: table, dumbbell (two values per row on one minutes axis)
function fwSvg(c,W,F,ink,muted,line,bg){
  if(c.kind==='table'){ const rh=40,H=110+(c.rows.length+1)*rh+40,xs=[24]; c.w.forEach((w,i)=>xs.push(xs[i]+w)); let o=head(c,W,H,F,ink,muted,bg);
    const cell=(t,x,y,w,b)=>wrapTxt(t,Math.floor(w/7)).split('\n').slice(0,2).map((l,i)=>`<text x="${x+6}" y="${y+16+i*15}" font-size="12.5" font-weight="${b?700:400}" fill="${ink}">${xmlEsc(l)}</text>`).join('');
    o+=`<rect x="24" y="86" width="${xs[xs.length-1]-24}" height="${rh}" fill="${css('--bg')}"/>`+c.cols.map((t,i)=>cell(t,xs[i],90,c.w[i],1)).join('');
    c.rows.forEach((r,j)=>{const y=86+(j+1)*rh; o+=`<line x1="24" x2="${xs[xs.length-1]}" y1="${y}" y2="${y}" stroke="${line}"/>`+r.map((t,i)=>cell(t,xs[i],y+4,c.w[i],i===0)).join('');});
    return o+foot(c,H,muted)+'</svg>'; }
  const rh=30,X0=300,X1=W-60,H=130+c.rows.length*rh+50,max=niceMax(Math.max(...c.rows.flatMap(r=>[r.a,r.b]))),sx=v=>X0+(X1-X0)*v/max,ca=css('--zg'),cb=css('--cut');
  let o=head(c,W,H,F,ink,muted,bg)+legendRow([{name:c.aName,color:ca,dot:1},{name:c.bName,color:cb,dot:1}],24,82,ink);
  for(let i=0;i<=4;i++){const v=max*i/4; o+=`<line x1="${sx(v)}" x2="${sx(v)}" y1="110" y2="${110+c.rows.length*rh}" stroke="${line}"/><text x="${sx(v)}" y="${126+c.rows.length*rh}" font-size="12" fill="${muted}" text-anchor="middle">${Math.round(v)}</text>`;}
  o+=`<text x="${X1}" y="${142+c.rows.length*rh}" font-size="12" fill="${muted}" text-anchor="end">${xmlEsc(c.xTitle)}</text>`;
  c.rows.forEach((r,i)=>{const y=110+i*rh+rh/2,late=r.b>r.a; o+=`<text x="${X0-10}" y="${y+4}" font-size="12.5" fill="${ink}" text-anchor="end">${xmlEsc(r.label)}</text>
    <line x1="${sx(r.a)}" x2="${sx(r.b)}" y1="${y}" y2="${y}" stroke="${late?cb:muted}" stroke-width="2"/><circle cx="${sx(r.a)}" cy="${y}" r="6" fill="${ca}"><title>Available: ${Math.round(r.a)} min</title></circle>
    <circle cx="${sx(r.b)}" cy="${y}" r="6" fill="${cb}"><title>Clearance: ${Math.round(r.b)} min${late?' (too late)':''}</title></circle>`;});
  return o+foot(c,H,muted)+'</svg>'; }
['mob','delay'].forEach(k=>$('fw-'+k).onchange=e=>{const v=+e.target.value; if(v>=0){FW[k]=v; if(S.tab==='diag') drawDiagram();}});
