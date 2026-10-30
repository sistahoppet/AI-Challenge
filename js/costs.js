// costs.js - What the flood costs, item by item: direct damage from water depth (JRC depth–damage functions) and the cost of the response.
// Every unit cost carries its source; anything without a published figure is an input the team must fill in.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- research values ---------- */
// JRC depth–damage functions for Europe (Huizinga, de Moel & Szewczyk 2017, EUR 28552 EN, doi 10.2760/16510), as polynomials
// published in the EU CLIMAAX handbook (highest power first; depth clipped to 0–6 m, damage share to 0–1).
const DDF={res:[0.0005869,-0.01077,0.07497,-0.2602,0.5959,0],com:[0,0,-0.0009149,-0.02021,0.3216,0],ind:[0,0,-0.001202,-0.01225,0.2852,0],road:[0,-0.00938,0.07734,-0.2906,0.7625,0]};
const ddf=(k,h)=>{ const x=Math.max(0,Math.min(6,h)); let y=0; for(const a of DDF[k]) y=y*x+a; return Math.max(0,Math.min(1,y)); };
const COST={
  cpi:1.218,      // 2010 → 2022 prices: EU consumer price index ratio used by CLIMAAX
  res:792,        // €/m² 2010, Belgium, residential building incl. contents (JRC 2017, Table 3-22)
  com:1004,       // €/m² 2010, commercial: 502 structure + 502 contents (JRC 2017 via CLIMAAX)
  ind:820,        // €/m² 2010, industrial: 328 structure + 492 contents (JRC 2017 via CLIMAAX)
  road:25.9,      // €/m² 2010, roads: set per country below (JRC 2017, Table 3-28 method)
  shelterNight:125, // € per person per night: weak proxy (Dutch emergency shelters 2015–16, NL Times); replace with a national figure
  nights:3,       // assumption: nights in the shelter
  teamHour:0      // € per emergency-team hour: no published national figure found, enter the official rate
};
// per country, set from the loaded area (data/cities/index.json "country", or the team server's AOI country):
// homes = JRC 2017 Table 3-22 country maximum damage (residential, €/m² 2010); roads = 25.2 €/m² (Europe, 2010) × GDP per capita
// of the country / 43 082 US$ (JRC 2017 Table 3-28 method and values). Commercial and industrial stay at the EU values above:
// Table 3-22 has no Belgian value and its German / Dutch ones use other definitions (the report says country values vary strongly because of different assumptions and definitions).
const CTRY={Belgium:{res:792,gdp:44283},Germany:{res:526,gdp:41788},Netherlands:{res:717,gdp:50341}};
const COST_SET={}; // unit costs the user typed: kept when the area changes
const areaCountry=()=>STUDY.info?.country||STUDY.country||'Belgium';
function costCountry(){ const c=CTRY[areaCountry()]||CTRY.Belgium;
  if(!COST_SET.res) COST.res=c.res; if(!COST_SET.road) COST.road=Math.round(25.2*c.gdp/43082*10)/10; return areaCountry(); }
// road surface widths by class (m): assumption, typical cross-sections
const ROADW={motorway:25,motorway_link:8,trunk:15,trunk_link:8,primary:12,primary_link:7,secondary:9,secondary_link:7,tertiary:7,tertiary_link:6,
  minor:6,unclassified:6,residential:6,living_street:5,service:4,pedestrian:3,track:3,footway:2,path:2,cycleway:2,steps:2,bridleway:2};
const REAL2021={Belgium:[['Insured claims, Belgium (30 Sept 2021)','€2.164 bn (Wallonia €2.07 bn)','Assuralia, via The Insurer'],
  ['Estimated total damage, Belgium (≈1 year later)','≈ €2.5 bn (Wallonia €2.44 bn)','Assuralia, via Brussels Times'],
  ['Walloon reconstruction investment','≈ €1.125 bn, of which €998 M roads, energy, telecom; €98 M public buildings','Le Soir, via Brussels Times'],
  ['Walloon government bill after insurance','≥ €3 bn, up to €4 bn with emergency costs','Brussels Times (2022)']],
 Germany:[['Insured damage, Germany (GDV estimate, Aug 2021)','≈ €7 bn (earlier estimate €4.5–5.5 bn)','GDV, via Insurance Journal (27 Aug 2021)']],
 Netherlands:[['Total flood damage, Limburg (mostly Geul valley)','€350–600 M','TU Delft study, via Watersnoodmuseum'],
  ['Damage in Valkenburg (homes, businesses, lost tourism)','≈ €400 M (mayor\'s estimate)','NL Times / AP (21 Jul 2021)']]};

/* ---------- the bill for one flood size (peak water) ---------- */
function floodCost(r){ costCountry(); const e=v=>v*COST.cpi,out={items:[],r};
  const grp={res:{n:0,m2:0,eur:0},non:{n:0,m2:0,eur:0}};
  for(const b of D.blds){ if(b.ci<0) continue; const h=D.cells[b.ci].depth[r]; if(!(h>.01)||!b.area) continue;
    if(b.use===2){ const v=b.area*(COST.com*ddf('com',h)+COST.ind*ddf('ind',h))/2; grp.non.n++; grp.non.m2+=b.area; grp.non.eur+=e(v); }
    else { grp.res.n++; grp.res.m2+=b.area; grp.res.eur+=e(b.area*COST.res*ddf('res',h)); } }
  let rm2=0,rkm=0,reur=0,rmiss=0; for(const s of roadSegs.values()){ const h=s.dep[r]||0; if(h<=.01) continue; const w=ROADW[s.cls]; if(!w){rmiss++; continue;}
    rkm+=s.len/1000; rm2+=s.len*w; reur+=e(s.len*w*COST.road*ddf('road',h)); }
  const P=r===rp()?E.plan:planFor(r),placed=P?P.moved:0,teamH=RS.cmp?.[RS.mode]?.st.reduce((s,t)=>s+(t.trips.length?(t.trips[t.trips.length-1].a+RS.scene)/60:0),0)??0; // each team busy until its last job ends
  out.items=[
    {g:'Damage',k:'Homes (structure + contents)',q:`${fmtFull(grp.res.n)} buildings · ${fmtFull(grp.res.m2)} m²`,unit:`€${COST.res}/m² (2010) × damage share by depth`,eur:grp.res.eur,src:`JRC 2017 Table 3-22 (${areaCountry()}) + JRC residential curve`,kind:'data'},
    {g:'Damage',k:'Shops, offices, industry (structure + contents)',q:`${fmtFull(grp.non.n)} buildings · ${fmtFull(grp.non.m2)} m²`,unit:`avg of €${COST.com} and €${COST.ind}/m² (2010) × curves`,eur:grp.non.eur,src:'JRC 2017 via CLIMAAX (EU values); use code 2 = non-residential (check Annex 2)',kind:'data'},
    {g:'Damage',k:'Roads and paths',q:`${rkm.toFixed(1)} km · ${fmtFull(rm2)} m²`,unit:`€${COST.road}/m² (2010) × road curve`,eur:reur,src:`JRC 2017: 25.2 €/m² Europe × GDP per capita of ${areaCountry()} (Table 3-28); widths by road class are assumptions`,kind:'mix'},
    {g:'Response',k:'Shelter (people placed × nights)',q:`${fmtFull(placed)} people × ${COST.nights} nights`,unit:`€${COST.shelterNight} per person-night`,eur:placed*COST.nights*COST.shelterNight,src:'Weak proxy: Dutch emergency shelters 2015–16; replace with Red Cross / civil protection figure',kind:'proxy'},
    {g:'Response',k:'Emergency teams (driving + time on scene)',q:RS.cmp?`${teamH.toFixed(0)} team-hours`:'run Dispatch in Alert',unit:COST.teamHour?`€${COST.teamHour} per team-hour`:'rate not set',eur:teamH*COST.teamHour,src:'No published national rate found: enter the official one',kind:'missing'}];
  out.notCounted=['Vehicles (no data)','Agriculture and gardens (no land-use data loaded)','Bridges, rail, energy and telecom networks (no asset data; in 2021 these were a large share, see Walloon reconstruction)','Business interruption, health, clean-up, temporary housing'];
  out.damage=out.items.filter(x=>x.g==='Damage').reduce((s,x)=>s+x.eur,0); out.response=out.items.filter(x=>x.g==='Response').reduce((s,x)=>s+x.eur,0);
  return out; }
const eur=v=>v>=1e9?`€${(v/1e9).toFixed(2)} bn`:v>=1e6?`€${(v/1e6).toFixed(1)} M`:v>=1e3?`€${Math.round(v/1e3)} k`:`€${Math.round(v)}`;
// average annual damage (UNDRR AAL): area under the damage–probability curve between the mapped flood sizes
function costAAL(){ const pts=(D.base||D.rps).map(r=>[1/r,floodCost(r).damage]).sort((a,b)=>b[0]-a[0]); let s=0;
  for(let i=0;i<pts.length-1;i++) s+=(pts[i][0]-pts[i+1][0])*(pts[i][1]+pts[i+1][1])/2; return s+pts[pts.length-1][0]*pts[pts.length-1][1]; }

/* ---------- panel (Policy tab) ---------- */
function drawCosts(){ if(!D||!$('costOut')) return; const ctry=costCountry(),r=rp(),c=floodCost(r),tag=k=>({data:'<span class="tag data">data + research</span>',mix:'<span class="tag data">data</span> <span class="tag">width assumed</span>',proxy:'<span class="tag">proxy</span>',missing:'<span class="tag">needs a rate</span>'}[k]);
  $('costOut').innerHTML=`<div class="stats"><div class="stat"><b>${eur(c.damage)}</b><span>direct damage, ${sizeWord(r).toLowerCase()} flood (2022 €)</span></div><div class="stat"><b>${eur(c.response)}</b><span>response costs counted</span></div><div class="stat"><b>${eur(costAAL())}</b><span>average damage per year (AAL)</span></div></div>
   <table class="tbl" style="margin-top:8px"><thead><tr><th>Item</th><th>Quantity</th><th>Unit cost</th><th>Total</th></tr></thead><tbody>
   ${c.items.map(x=>`<tr><td><b>${x.k}</b><br>${tag(x.kind)}</td><td>${x.q}</td><td>${x.unit}</td><td class="mono"><b>${eur(x.eur)}</b></td></tr>`).join('')}</tbody></table>
   <details class="info"><summary>ⓘ Sources, method and what is not counted</summary>
   <ul class="limits">${c.items.map(x=>`<li><b>${x.k}:</b> ${x.src}</li>`).join('')}
   <li>Damage = floor area × maximum damage per m² × share damaged at the water depth (JRC depth–damage curve), at peak water; prices ×${COST.cpi} from 2010 to 2022 (EU CPI, as in CLIMAAX).</li>
   <li><b>Not counted:</b> ${c.notCounted.join('; ')}.</li></ul></details>
   <h3 class="sub">Real July 2021 costs, ${esc(ctry)} (for comparison: whole country or region, not only this area)</h3>
   <table class="tbl"><tbody>${(REAL2021[ctry]||[]).map(x=>`<tr><td>${x[0]}</td><td class="mono">${x[1]}</td><td class="hint">${x[2]}</td></tr>`).join('')}</tbody></table>
   <details class="cands"><summary>Change unit costs</summary><div class="form" style="margin-top:8px">${[['shelterNight','Shelter, € per person-night'],['nights','Nights in shelter'],['teamHour','Emergency team, € per hour'],['res','Homes, €/m² (2010)'],['com','Commercial, €/m² (2010)'],['ind','Industrial, €/m² (2010)'],['road','Roads, €/m² (2010)'],['cpi','Price update 2010→today']].map(([k,t])=>`<label>${t}<input class="btn" type="number" step="any" min="0" data-cost="${k}" value="${COST[k]}"></label>`).join('')}</div></details>`; }
document.addEventListener('change',e=>{const k=e.target.dataset?.cost; if(k&&e.target.value!==''){COST[k]=+e.target.value; COST_SET[k]=1; drawCosts(); if(S.tab==='diag') drawDiagram();}});

/* ---------- diagrams ---------- */
function costChart(k){ const src='JRC depth–damage functions (Huizinga et al. 2017) · GHS-OBAT buildings · OpenStreetMap roads · EFAS depths · prices 2022 €';
  if(k==='costItems'){ const c=floodCost(rp()),cols=['--c-mod','--c-both','--wave2','--c-obs','--crit'];
    const rows=c.items.map((x,i)=>({label:x.k,value:x.eur/1e6,txt:eur(x.eur),color:css(cols[i])}));
    return {kind:'bar',title:`Cost of a ${sizeWord(rp()).toLowerCase()} flood (1-in-${rp()}), € million`,sub:`Direct damage ${eur(c.damage)} + response ${eur(c.response)}. Not counted: vehicles, agriculture, bridges and networks, business interruption.`,rows,src,
      csv:[['item','quantity','unit_cost','total_EUR','source'],...c.items.map(x=>[x.k,x.q,x.unit,Math.round(x.eur),x.src])]}; }
  if(k==='costRP'){ const B=D.base||D.rps,rows=B.map(r=>{const v=floodCost(r).damage; return {label:`${sizeWord(r)} (1-in-${r})`,value:v/1e6,txt:eur(v),color:css('--c-mod')};});
    return {kind:'bar',title:'Direct damage per flood size, € million',sub:`Average damage per year (AAL, UNDRR method): ${eur(costAAL())}. Same unit costs and curves for every size.`,rows,src,
      csv:[['flood_size','damage_EUR'],...B.map((r,i)=>[r,Math.round(rows[i].value*1e6)])]}; }
  const hs=Array.from({length:13},(_,i)=>i/2);
  return {kind:'line',title:'Depth–damage curves (share of value lost)',sub:'JRC Europe curves (Huizinga et al. 2017), as published in the EU CLIMAAX handbook.',x:hs.map(h=>h+' m'),yTitle:'share',
    series:[['res','Homes',css('--c-mod')],['com','Commercial',css('--c-both')],['ind','Industrial',css('--wave2')],['road','Roads',css('--c-obs')]].map(([k,n,c])=>({name:n,color:c,values:hs.map(h=>ddf(k,h))})),
    src:'Huizinga, de Moel & Szewczyk (2017), EUR 28552 EN, doi 10.2760/16510',csv:[['depth_m','homes','commercial','industrial','roads'],...hs.map(h=>[h,...['res','com','ind','road'].map(k=>ddf(k,h).toFixed(3))])]}; }
