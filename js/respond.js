// respond.js - Alert tab: forecast triggers, who does what, messages to residents, files for emergency services, "check a place".
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- be ready: one plan per flood size, started when a forecast says that size is likely ---------- */
function drawCoord(){ if(!D) return;
  const rows=D.rps.map(r=>{const pk=peak(r),P=planFor(r); return {r,pk,P,km:cutKm(r,false)};});
  $('trig').innerHTML=`<table class="tbl"><thead><tr><th>If the forecast says…</th><th>Residents in water</th><th>Streets closed</th><th>To move</th><th>Need help</th></tr></thead><tbody>${
    rows.map(({r,pk,P,km},i)=>`<tr${r===rp()?' class="on"':''}><td><b>Plan ${String.fromCharCode(65+i)}</b> · ${sizeWord(r)}<br><span class="hint">1-in-${r} years</span></td><td>${fmt(pk.people)}</td><td>${km.toFixed(1)} km</td><td>${fmt(P.total)}</td><td>${fmt(P.slow+P.over)}</td></tr>`).join('')}</tbody></table>`;
  drawWeather(); }

/* ---------- alert text (used in the CAP alert draft) ---------- */
const MSG={
  en:{go:'FLOOD WARNING – {area}. Water may reach your street soon. Leave now and go to {shelter}. Walk on dry streets; never walk or drive through moving water. Help neighbours who need it. Do not go back before the all-clear.',
      ready:'FLOOD ALERT – {area}. Water may reach your street in the coming hours. Get ready to leave: medicines, papers, phone charger. Your shelter: {shelter}. Follow official updates.'},
  fr:{go:'ALERTE INONDATION – {area}. L\'eau peut bientôt atteindre votre rue. Partez maintenant vers {shelter}. Marchez par les rues sèches ; ne traversez jamais une eau en mouvement, à pied ou en voiture. Aidez vos voisins qui en ont besoin. Ne revenez pas avant la fin de l\'alerte.',
      ready:'VIGILANCE INONDATION – {area}. L\'eau peut atteindre votre rue dans les prochaines heures. Préparez-vous à partir : médicaments, papiers, chargeur. Votre abri : {shelter}. Suivez les consignes officielles.'},
  nl:{go:'OVERSTROMINGSWAARSCHUWING – {area}. Het water kan snel uw straat bereiken. Vertrek nu naar {shelter}. Loop via droge straten; loop of rijd nooit door stromend water. Help buren die hulp nodig hebben. Ga pas terug na het sein veilig.',
      ready:'OVERSTROMINGSALARM – {area}. Het water kan de komende uren uw straat bereiken. Maak u klaar om te vertrekken: medicijnen, papieren, oplader. Uw opvangplek: {shelter}. Volg de officiële berichten.'},
  de:{go:'HOCHWASSERWARNUNG – {area}. Das Wasser kann bald Ihre Straße erreichen. Gehen Sie jetzt zu {shelter}. Nutzen Sie trockene Straßen; gehen oder fahren Sie nie durch fließendes Wasser. Helfen Sie Nachbarn, die Hilfe brauchen. Kehren Sie erst nach der Entwarnung zurück.',
      ready:'HOCHWASSERALARM – {area}. Das Wasser kann in den nächsten Stunden Ihre Straße erreichen. Bereiten Sie sich auf das Verlassen vor: Medikamente, Papiere, Ladegerät. Ihre Notunterkunft: {shelter}. Folgen Sie den offiziellen Meldungen.'}};
const AREA={en:'wave {w} area',fr:'zone de la vague {w}',nl:'gebied golf {w}',de:'Gebiet Welle {w}'};
const osmLink=c=>`https://www.openstreetmap.org/?mlat=${c[1].toFixed(5)}&mlon=${c[0].toFixed(5)}#map=17/${c[1].toFixed(5)}/${c[0].toFixed(5)}`;
const copy=t=>navigator.clipboard?.writeText(t).then(()=>toast('Copied'),()=>toast('Copy blocked: select the text and copy it by hand'));

/* ---------- files for emergency services (nothing is sent automatically) ---------- */
const stamp=()=>new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
function report(){ const r=rp(),pk=peak(r),P=E.plan,cc=pk.cc,km=cutKm(r,false),ll=c=>`${c[1].toFixed(5)}, ${c[0].toFixed(5)}`;
  return `# Flood situation report (draft, ${new Date().toLocaleString('en-GB')})

**Data:** ${isDemo?'DEMO DATA (synthetic, not real)':'team data'} · **Scenario:** ${sizeWord(r).toLowerCase()} flood, 1-in-${r} years, at peak.

## Who and what is in the water
- Residents in flooded areas: ${fmtFull(pk.people)} (over 1.5 m deep: ${fmtFull(cc[2].people)})
- Buildings in the water: ${fmtFull(pk.bld)}
- Area under water: ${pk.area.toFixed(2)} km²
- Streets with ${CAR_DEPTH} m of water or more: ${km.toFixed(1)} km (OpenStreetMap streets loaded on the map)

## Evacuation plan
- People to move: ${fmtFull(P.total)} (${E.who==='red'?'red-zone residents':'everyone in the water'})
- Reach a shelter in time on foot: ${fmtFull(P.moved-P.slow)}
- Too far for the warning time: ${fmtFull(P.slow)} · No shelter place left: ${fmtFull(P.over)}
- Routes follow ${P.kind==='streets'?'OpenStreetMap streets, avoiding deep water':'open ground (streets not loaded)'}

| Shelter | Location (lat, lon) | People assigned | Capacity |
|---|---|---|---|
${E.shelters.map((s,k)=>`| ${k+1}. ${s.name} | ${ll(s.c)} | ${fmtFull(P.load[k]||0)} | ${fmtFull(capOf(k))}${s.cap?'':' (default)'} |`).join('\n')}

## Critical sites in the water (evacuate or protect first)
${(D.places||[]).filter(p=>p.group==='critical'&&p.ci>=0&&D.cells[p.ci].depth[r]>.01).map(p=>`- ${kindName(p.kind)}: ${p.name||'(no name)'} (${ll(p.c)}), ${D.cells[p.ci].depth[r].toFixed(2)} m`).join('\n')||'- none found'}

## Routes (wave 1 = water arrives first)
| Wave | People | To shelter | Distance | On foot | In time? |
|---|---|---|---|---|---|
${P.routes.map(x=>`| ${x.wave} | ${fmtFull(x.people)} | ${x.k+1} | ${(x.len/1000).toFixed(1)} km | ${Math.round(x.min)} min | ${x.ok?'yes':'no'} |`).join('\n')}

## Assumptions (team choices, not data)
- Shelter capacity: floor area ÷ ${SPHERE_M2} m² per person (Sphere standard) when the building size is known, else ${E.cap} people · walking speed ${E.speed} km/h · warning lead time ${SC.leadMin} min, ${FW.mob} min to get ready, ${FW.delay} min delay
- Streets under ${CAR_DEPTH} m of water or more count as closed to cars
- Waves follow the order water arrives in the model (lowest ground first), not real timing

## Limits
- Flood maps are model results per flood size, not a forecast of a specific day.
- "Residents" = where people live, not where they are during the day.
- Shelter suitability (building use, access, accessibility) must be checked on site.

Sources: EFAS flood hazard maps, GHS-POP, GHS-OBAT, Copernicus EMS (2021 outline), OpenStreetMap streets.
`; }
function planGeo(){ const P=E.plan,r=rp(),F=(g,p)=>({type:'Feature',geometry:g,properties:p});
  return JSON.stringify({type:'FeatureCollection',name:`evacuation_plan_rp${r}`,features:[
    ...E.shelters.map((s,k)=>F({type:'Point',coordinates:s.c},{kind:'shelter',id:k+1,name:s.name,assigned:P.load[k]||0,capacity:capOf(k)})),
    ...(D.places||[]).filter(p=>p.group==='critical'&&p.ci>=0&&D.cells[p.ci].depth[r]>.01).map(p=>F({type:'Point',coordinates:p.c},{kind:'critical_in_water',type:p.kind,name:p.name,depth_m:D.cells[p.ci].depth[r]})),
    ...P.groups.map(g=>F({type:'Point',coordinates:g.c},{kind:'group',people:g.pop,wave:g.wave,no_place:g.left||0})),
    ...P.routes.map(x=>F({type:'LineString',coordinates:x.pts},{kind:'route',wave:x.wave,people:x.people,shelter:x.k+1,km:+(x.len/1000).toFixed(2),minutes_on_foot:Math.round(x.min),in_time:x.ok})),
    ...cutPieces.filter(s=>(s.dep[r]||0)>CAR_DEPTH).map(s=>F({type:'LineString',coordinates:[s.a,s.b]},{kind:'closed_street',depth_m:+s.dep[r].toFixed(2)}))]}); }
// convex hull of the people to move: the alert area
function hull(ps){ ps=[...ps].sort((a,b)=>a[0]-b[0]||a[1]-b[1]); if(ps.length<3) return ps; const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const p of ps){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p);}
  for(const p of ps.reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p);} return lo.slice(0,-1).concat(up.slice(0,-1)); }
function capXml(){ const r=rp(),P=E.plan,now=new Date(),z=-now.getTimezoneOffset(),pad=n=>String(Math.abs(n)).padStart(2,'0');
  const sent=now.toISOString().slice(0,19)+(z>=0?'+':'-')+pad(Math.trunc(z/60))+':'+pad(z%60);
  const cs=D.cells.filter(c=>c.pop&&(E.who==='red'?c.z===3:c.depth[r]>.01)).flatMap(c=>c.ring),h=hull(cs);
  const poly=h.length>2?h.concat([h[0]]).map(p=>`${p[1].toFixed(5)},${p[0].toFixed(5)}`).join(' '):'';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DRAFT for exercises only. Generated by Flood Scenario Explorer. Not an official alert. -->
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>FSE-${stamp()}</identifier>
  <sender>flood-scenario-explorer</sender>
  <sent>${sent}</sent>
  <status>Exercise</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en</language>
    <category>Met</category>
    <event>Flood</event>
    <urgency>Expected</urgency>
    <severity>Severe</severity>
    <certainty>Possible</certainty>
    <headline>Flood: ${fmtFull(P.total)} residents in the area to evacuate (scenario 1-in-${r} years)</headline>
    <description>${esc(`Scenario based on flood-hazard maps: ${fmtFull(peak(r).people)} residents live in areas that flood. ${isDemo?'DEMO DATA.':''}`)}</description>
    <instruction>${esc(MSG.en.go.replace('{area}','evacuation area').replace('{shelter}',E.shelters.map(s=>s.name).join(' / ')||'the nearest shelter'))}</instruction>
    <area>
      <areaDesc>Evacuation area, ${sizeWord(r).toLowerCase()} flood scenario</areaDesc>${poly?`
      <polygon>${poly}</polygon>`:''}
    </area>
  </info>
</alert>
`; }
const need=()=>{ if(!E.plan){toast('No plan yet'); return false;} return true; };
$('shReport').onclick=()=>need()&&saveFile(`flood-sitrep-${stamp()}.md`,report());
$('shGeo').onclick=()=>need()&&saveFile(`evacuation-plan-${stamp()}.geojson`,planGeo());
$('shCap').onclick=()=>need()&&saveFile(`flood-alert-draft-${stamp()}.xml`,capXml());
$('shCopy').onclick=()=>{ if(!need()) return; const r=rp(),P=E.plan;
  copy(`Flood scenario 1-in-${r} years (${sizeWord(r).toLowerCase()})${isDemo?' [DEMO DATA]':''}: ${fmtFull(peak(r).people)} residents in flooded areas, ${fmtFull(P.total)} to move, ${fmtFull(P.slow+P.over)} need help. Shelters: ${E.shelters.map((s,k)=>`${k+1}) ${s.name} ${Math.round(P.load[k]||0)}/${capOf(k)}`).join('; ')}. Streets closed: ${cutKm(r,0).toFixed(1)} km.`); };

/* ---------- check a place (click on the map in this tab) ---------- */
function checkPlace(p){ const i=D.G.at(p[0],p[1]),box=$('placeInfo');
  if(i<0){box.innerHTML='<p class="hint" style="margin:0">Outside the study area.</p>'; return;}
  const c=D.cells[i],r=rp(),wet=c.depth[r]>.01,wave=waveOf(floodStart(c,r));
  const near=E.shelters.map((s,k)=>({k,d:mDist(p,s.c)})).sort((a,b)=>a.d-b.d)[0];
  box.innerHTML=`<div class="crow" style="grid-template-columns:14px 1fr"><span class="sw" style="background:var(${['','--zg','--zy','--zr'][c.z]})"></span><b>${['','Green zone','Yellow zone','Red zone'][c.z]}</b></div>
    <ul class="limits" style="margin-top:6px">${D.rps.map(x=>`<li>${sizeWord(x)} flood (1-in-${x}): ${c.depth[x]>.01?`<b>${c.depth[x].toFixed(2)} m</b> of water`:'dry'}</li>`).join('')}</ul>
    <p style="margin:6px 0 0;font-size:14px">${wet?`In this flood size: <b>wave ${wave}</b>. `:'Dry in this flood size. '}${near?`Nearest shelter: <b>${near.k+1}. ${esc(E.shelters[near.k].name)}</b>, ${(near.d/1000).toFixed(1)} km in a straight line.`:''}</p>`;
  new maplibregl.Popup({closeButton:false,maxWidth:'220px'}).setLngLat(p).setHTML(`<b>${['','Green','Yellow','Red'][c.z]} zone</b>${wet?` · wave ${wave}`:''}`).addTo(map); }
