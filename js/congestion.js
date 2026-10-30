// congestion.js - Clog points: where evacuation cars exceed road capacity (volume/capacity ratio), and the delay that implies.
// Queue at a bottleneck: deterministic (point) queue, wait at the end of a window T = T × (V/C − 1) when demand exceeds capacity (Newell, Applications of Queueing Theory, 1982).
// Formula: BPR link performance function (US Bureau of Public Roads, Traffic Assignment Manual, 1964): t = t0 × (1 + 0.15 × (V/C)^4).
// Pessimistic: the worst queue of every clog point a route crosses is added to that route's travel time, then the run is redone.
// V = cars per hour on a road piece (busiest 15-min window × 4) from the drill run; C = capacity per direction by road class.
// Capacities: Highway Capacity Manual 2000 values quoted in KLD, Lee Nuclear Station ETE (NRC ML073510573): freeway ~2,250/lane,
// multilane ~2,100/lane, two-lane road ~1,700; urban signalised street ≈ 1,900 × green share ≈ 950/lane (FHWA HPMS guidance 2020).
// Lanes per direction by road class and persons per car are ASSUMPTIONS (shown in the app). Limit: delays are reported, not fed back into the run.
const CLOG={occ:1.4,cap:{motorway:4200,motorway_link:1700,trunk:3400,trunk_link:1700,primary:1700,primary_link:1500,secondary:1700,secondary_link:1300,tertiary:950,tertiary_link:950,
  minor:950,unclassified:950,residential:600,living_street:400,service:400},list:[],worst:0,delayMin:0};
const clogCap=cls=>CLOG.cap[cls]??600;
function computeClogs(){ CLOG.list=[]; CLOG.worst=0; CLOG.delayMin=0; const R=DR.run; if(!R||!roadSegs.size){ drawClogs(); return; }
  const veh=new Map(),get=(a,b)=>{const k1=kk(a)+'|'+kk(b),k2=kk(b)+'|'+kk(a); return roadSegs.has(k1)?k1:roadSegs.has(k2)?k2:null;};
  for(const c of R.co){ if(!(c.n>0)) continue; for(const s of c.segs){ if(s[1]!=='walk') continue; const l=s[2],dep=s[3],v=s[4];
      for(let j=1;j<l.pts.length;j++){ const k=get(l.pts[j-1],l.pts[j]); if(!k) continue; const t=dep+l.cum[j-1]/v,bin=Math.floor(t/15); let m=veh.get(k); if(!m) veh.set(k,m=new Map()); m.set(bin,(m.get(bin)||0)+c.n/CLOG.occ); } } }
  for(const [k,m] of veh){ const s=roadSegs.get(k),C=clogCap(s.cls),peak=Math.max(...m.values())*4,vc=peak/C; if(vc<=1) continue;
    const t0=s.len/(E.speed*1000/60),extra=t0*0.15*vc**4; CLOG.list.push({a:s.a,b:s.b,vc,cars:peak,cls:s.cls,extra,queue:15*(vc-1)}); }
  CLOG.list.sort((x,y)=>y.vc-x.vc); CLOG.worst=CLOG.list[0]?.vc||0; CLOG.delayMin=CLOG.list.reduce((s,x)=>s+x.extra,0); drawClogs(); }
function drawClogs(){ if(!ready) return; if(!map.getSource('clogs')){ map.addSource('clogs',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'clogs',type:'line',source:'clogs',layout:{'line-cap':'round'},paint:{'line-color':css('--clog'),'line-dasharray':[1,.6],'line-width':['interpolate',['linear'],['zoom'],11,3,16,9],'line-opacity':.9}}); }
  map.getSource('clogs').setData({type:'FeatureCollection',features:CLOG.list.map(x=>({type:'Feature',geometry:{type:'LineString',coordinates:[x.a,x.b]},properties:{vc:+x.vc.toFixed(2)}}))});
  map.setLayoutProperty('clogs','visibility',S.tab==='safety'||S.tab==='sim'?'visible':'none'); }
function clogText(){ return CLOG.list.length?`<b>${CLOG.list.length} clog points</b>: road pieces where evacuation cars exceed capacity (worst ${CLOG.worst.toFixed(1)}× capacity, ${CLOG.list[0].cls} road). At the worst point cars queue up to ≈ ${Math.round(CLOG.list[0].queue)} min (deterministic queue over the busiest 15 min: wait = 15 × (V/C − 1)); slower driving on clogged pieces ≈ ${Math.round(CLOG.delayMin)} min in total (BPR). Added to the travel time of every route through them (pessimistic) and the run is redone. Stagger departures by wave on these corridors.`
  :'No clog point: cars stay under road capacity in this run (BPR / Highway Capacity Manual values).'; }
function routeLines(){ const out=new Set(); (DR.prep?.groups||[]).forEach(g=>[...g.legs,...g.near].forEach(L=>out.add(L.l))); return [...out]; }
function feedQueues(){ const q=new Map(); CLOG.list.forEach(x=>q.set(kk(x.a)+'|'+kk(x.b),x.queue)); let any=false;
  for(const l of routeLines()){ let s=0; for(let j=1;j<l.pts.length;j++) s+=q.get(kk(l.pts[j-1])+'|'+kk(l.pts[j]))||q.get(kk(l.pts[j])+'|'+kk(l.pts[j-1]))||0; l.qd=s; if(s>0) any=true; } return any; }
const _drillRunC=drillRun; drillRun=function(){ routeLines().forEach(l=>l.qd=0); _drillRunC(); computeClogs();
  if(DR.prep&&feedQueues()){ const o=drillOpts(); DR.run=simulate(o); DR.range=rangeOf(o); DR.base=simulate(drillOpts({},{comply:DR0.comply/100,capX:DR0.capX/100,rate:DR0.rescue,lead:DR0.lead,mob:DR0.mob,delay:DR0.delay,v:DR0.speed*1000/60})); if(ready) render(); }
  drawDrill(); if(typeof SRC==='object') SRC.clog=['mix','Clog points: cars per hour on each road piece (drill run, people ÷ 1.4 per car) vs capacity (Highway Capacity Manual 2000 via KLD/NRC; FHWA 2020); delay from the BPR function t = t0(1 + 0.15 (V/C)^4), US Bureau of Public Roads 1964.','Lanes per road class and persons per car are assumptions. Pessimistic: the worst queue of each clog point is added to every route crossing it.']; };
const _drawDrillC=drawDrill; drawDrill=function(){ _drawDrillC(); const b=$('drillOut'); if(b&&DR.run) b.insertAdjacentHTML('beforeend',`<p class="hint" data-src="clog">${clogText()} Cars = people ÷ ${CLOG.occ} per car (assumption).</p>`); };
const _applyLayersC=applyLayers; applyLayers=function(){ _applyLayersC(); if(ready&&map.getLayer('clogs')) map.setLayoutProperty('clogs','visibility',(S.tab==='safety'||S.tab==='sim')?'visible':'none'); };
