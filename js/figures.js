// figures.js - Extra figures for the diagram studio: line graphs over time, map figures (captured from the live map),
// and system-design diagrams (flowchart, architecture, data flow, entity–relationship). All export as PNG / SVG.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- shared SVG pieces ---------- */
const xmlEsc=t=>esc(t).replace(/'/g,'&#39;');
function legendRow(items,x,y,ink){ let lx=x,o=''; items.forEach(l=>{o+=`<rect x="${lx}" y="${y}" width="14" height="${l.line?3:12}" rx="${l.dot?6:2}" ${l.line?`transform="translate(0,5)"`:''} fill="${l.color}"/><text x="${lx+20}" y="${y+11}" font-size="13" fill="${ink}">${xmlEsc(l.name)}</text>`; lx+=26+l.name.length*7+18;}); return o; }
function extraSvg(c,W,F,ink,muted,line,bg){
  if(c.kind==='line'){ const H=430,X0=70,X1=W-90,Y0=110,Y1=H-70,n=c.x.length,all=c.series.flatMap(s=>s.values).concat((c.refs||[]).map(r=>r.v)),max=niceMax(Math.max(...all,0.01));
    const sx=i=>X0+(X1-X0)*i/Math.max(1,n-1),sy=v=>Y1-(Y1-Y0)*v/max;
    let o=head(c,W,H,F,ink,muted,bg)+legendRow(c.series.map(s=>({name:s.name,color:s.color,line:1})),X0,82,ink);
    for(let i=0;i<=4;i++){const v=max*i/4; o+=`<line x1="${X0}" x2="${X1}" y1="${sy(v)}" y2="${sy(v)}" stroke="${line}"/><text x="${X0-8}" y="${sy(v)+4}" font-size="12" fill="${muted}" text-anchor="end">${+v.toFixed(v<10?1:0)}</text>`;}
    o+=`<text x="${X0-8}" y="${Y0-12}" font-size="12" fill="${muted}" text-anchor="end">${xmlEsc(c.yTitle)}</text>`;
    (c.refs||[]).forEach(r=>{o+=`<line x1="${X0}" x2="${X1}" y1="${sy(r.v)}" y2="${sy(r.v)}" stroke="${muted}" stroke-dasharray="4 4"/><text x="${X1+6}" y="${sy(r.v)+4}" font-size="12" fill="${muted}">${xmlEsc(r.label)}</text>`;});
    const tick=Math.ceil(n/8); c.x.forEach((t,i)=>{ if(i%tick===0||i===n-1) o+=`<text x="${sx(i)}" y="${Y1+18}" font-size="11.5" fill="${muted}" text-anchor="middle">${xmlEsc(t)}</text>`; });
    c.series.forEach(s=>{ o+=`<path d="${s.values.map((v,i)=>`${i?'L':'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
      s.values.forEach((v,i)=>{o+=`<circle cx="${sx(i)}" cy="${sy(v)}" r="7" fill="transparent"><title>${xmlEsc(s.name)} · ${xmlEsc(c.x[i])}: ${v.toFixed(2)} ${xmlEsc(c.yTitle)}</title></circle>`;}); });
    return o+foot(c,H,muted)+'</svg>'; }
  if(c.kind==='img'){ if(!c.img) return head(c,W,200,F,ink,muted,bg)+`<text x="24" y="120" font-size="14" fill="${ink}">Drawing…</text></svg>`;
    const H=c.h+150; let o=head(c,W,H,F,ink,muted,bg)+`<image href="${c.img}" x="24" y="80" width="${W-48}" height="${c.h}"/>`+(c.overlay||'')+legendRow(c.legend||[],24,c.h+92,ink);
    return o+foot(c,H,muted)+'</svg>'; }
  // boxes
  const H=c.H; let o=head(c,W,H,F,ink,muted,bg)+`<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${muted}"/></marker></defs>`;
  const N=Object.fromEntries(c.nodes.map(n=>[n.id,n])),edgePt=(a,b)=>{const dx=b.x+b.w/2-(a.x+a.w/2),dy=b.y+b.h/2-(a.y+a.h/2),t=Math.min(Math.abs(a.w/2/(dx||1e-9)),Math.abs(a.h/2/(dy||1e-9)));return [a.x+a.w/2+dx*t,a.y+a.h/2+dy*t];};
  c.edges.forEach(([a,b,lab,bend])=>{const A=N[a],B=N[b],p=edgePt(A,B),q=edgePt(B,A);
    if(bend){ const x=bend; o+=`<path d="M${A.x+A.w},${A.y+A.h/2}H${x}V${B.y+B.h/2}H${B.x+B.w}" fill="none" stroke="${muted}" stroke-width="1.5" marker-end="url(#ar)"/>`+(lab?`<text x="${x-6}" y="${(A.y+B.y+B.h)/2}" font-size="11.5" fill="${muted}" text-anchor="end">${xmlEsc(lab)}</text>`:''); return; }
    o+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${muted}" stroke-width="1.5" marker-end="url(#ar)"/>`;
    if(lab) o+=`<text x="${(p[0]+q[0])/2+4}" y="${(p[1]+q[1])/2-4}" font-size="11.5" fill="${muted}">${xmlEsc(lab)}</text>`;});
  c.nodes.forEach(n=>{ const sh=n.shape||'box',lines=n.label.split('\n'),fill=n.fill||css('--bg');
    o+=sh==='store'?`<path d="M${n.x},${n.y}H${n.x+n.w}M${n.x},${n.y+n.h}H${n.x+n.w}" stroke="${ink}" stroke-width="1.5"/><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${fill}" opacity=".6"/>`
      :`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${sh==='proc'?n.h/2:8}" fill="${fill}" stroke="${n.stroke||line}" stroke-width="1.5"/>`;
    lines.forEach((t,i)=>{o+=`<text x="${n.x+(n.left?10:n.w/2)}" y="${n.y+(n.left?20:n.h/2-(lines.length-1)*8+5)+i*(n.left?17:16)}" font-size="${i===0?13.5:12}" font-weight="${i===0?700:400}" fill="${ink}" text-anchor="${n.left?'start':'middle'}">${xmlEsc(t)}</text>`;}); });
  return o+foot(c,H,muted)+'</svg>'; }
const head=(c,W,H,F,ink,muted,bg)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${F}" role="img" aria-label="${xmlEsc(c.title)}"><rect width="${W}" height="${H}" fill="${bg}"/>
  <text x="24" y="40" font-size="22" font-weight="700" fill="${ink}">${xmlEsc(c.title)}</text><text x="24" y="64" font-size="13" fill="${muted}">${xmlEsc(c.sub||'')}</text>`;
const foot=(c,H,muted)=>`<text x="24" y="${H-16}" font-size="11.5" fill="${muted}">${xmlEsc(c.src)} · Flood Scenario Explorer</text>`;

/* ---------- map figures: set the view, wait for the map to draw, capture the canvas ---------- */
async function mapFigure(k){ const keep={tab:S.tab,T:S.T,cmp:S.cmp},r=rp(),W=712;
  const shot=async v=>{ Object.assign(S,v); applyLayers(); draw(); paintWater(performance.now(),0,true); await new Promise(res=>setTimeout(res,1200));
    return new Promise(res=>{ map.once('render',()=>res(map.getCanvas().toDataURL('image/png'))); map.triggerRepaint(); }); };
  const cv=map.getCanvas(),ratio=cv.height/cv.width,h=Math.round(W*ratio),f={h,sub:'',legend:[]};
  const pins=()=>E.shelters.map((s,i)=>{const p=map.project(s.c),x=24+p.x/cv.clientWidth*W,y=80+p.y/cv.clientHeight*h; return x<24||x>24+W||y<80||y>80+h?'':`<circle cx="${x}" cy="${y}" r="9" fill="${css('--zg')}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y+4}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${i+1}</text>`;}).join('');
  try{
    if(k==='mhaz'){ f.img=await shot({tab:'safety'}); f.sub='Red: floods in the most frequent flood or deeper than 1.5 m at 1-in-100. Yellow: floods only in rarer floods or in 2021. Green: dry in every flood size.';
      f.legend=[{name:'Red: high risk',color:css('--zr')},{name:'Yellow: caution',color:css('--zy')},{name:'Green: safer',color:css('--zg')}]; }
    if(k==='mheat'){ f.img=await shot({tab:'sim',T:.6,cmp:'model'}); f.sub=`Water depth at the peak of the ${sizeWord(r).toLowerCase()} flood (1-in-${r}), EFAS. Darker blue = deeper.`;
      f.legend=[{name:'Shallow (< 0.5 m)',color:css('--w1')},{name:'Knee to chest (0.5–1.5 m)',color:css('--w2')},{name:'Over head height (> 1.5 m)',color:css('--w3')}]; }
    if(k==='mprog'){ const t=[.18,.32,.6],imgs=[]; for(const T of t) imgs.push(await shot({tab:'sim',T,cmp:'model'})); const w=(W-16)/3,hh=Math.round(w*ratio);
      f.h=hh+24; f.img=imgs[0]; f.overlay=imgs.map((u,i)=>`<image href="${u}" x="${24+i*(w+8)}" y="80" width="${w}" height="${hh}"/><text x="${24+i*(w+8)}" y="${80+hh+16}" font-size="12.5" fill="${css('--ink')}">${['Early','Rising','Peak'][i]} · clock ${clock(t[i])}</text>`).join('');
      f.img='data:image/gif;base64,R0lGODlhAQABAAAAACw='; f.sub=`Area under water at three moments of the ${sizeWord(r).toLowerCase()} flood: upstream sections fill first.`; }
    if(k==='mevac'){ f.img=await shot({tab:'safety'}); f.overlay=pins(); f.sub=`Evacuation plan for the ${sizeWord(r).toLowerCase()} flood: routes by wave, groups of residents, shelters (numbered).`;
      f.legend=[{name:'Wave 1 route',color:css('--wave1'),line:1},{name:'Wave 2',color:css('--wave2'),line:1},{name:'Wave 3',color:css('--wave3'),line:1},{name:'Shelter',color:css('--zg'),dot:1}]; }
  } finally { Object.assign(S,keep); applyLayers(); render(); }
  return f; }

/* ---------- system-design diagrams ---------- */
const mix=(a,b,t)=>'#'+hexRgb(a).map((v,i)=>Math.round(v*t+hexRgb(b)[i]*(1-t)).toString(16).padStart(2,'0')).join(''); // plain hex: exported SVGs open everywhere
function designDiagram(k){ const sf=css('--surface'),blue=mix(css('--accent'),sf,.14),warm=mix(css('--obs'),sf,.18),green=mix(css('--zg'),sf,.16);
  const src='Design of this prototype · Flood Scenario Explorer',csv=n=>[['element','description'],...n.nodes.map(x=>[x.id,x.label.replace(/\n/g,' — ')]),...n.edges.map(e=>[`${e[0]} → ${e[1]}`,e[2]||''])];
  let d;
  if(k==='flow'){ const x=150,w=380,h=46,g=60,steps=[
      ['load','1 · Load terrain and data','Copernicus DEM, EFAS depths (1-in-10/100/500), GHS people & buildings, OSM roads & shelters'],
      ['rain','2 · Add rainfall','Forecast, July 2021 replay, or your scenario → rain reaching the river'],
      ['size','3 · Match rain to a flood size','48-hour rain records → yearly chance → flood map (interpolated)'],
      ['flow','4 · Water rises section by section','Riverbed depth nearby + downstream delay from terrain'],
      ['upd','5 · Update water depth','Cells, buildings, roads, people, critical sites'],
      ['risk','6 · Check flood risk','Zones, closed roads, shelters, routes, alert thresholds'],
      ['next','7 · Next time step','Until the end of the event']];
    d={nodes:steps.map(([id,a,b],i)=>({id,label:`${a}\n${b}`,x,y:90+i*(h+g/2+10),w,h:h+6,fill:i===5?warm:blue,shape:i===0||i===6?'proc':'box'})),
      edges:steps.slice(1).map((s,i)=>[steps[i][0],s[0]]).concat([['next','flow','repeat',x+w+90]]),H:90+7*(h+g/2+10)+40};
    d.nodes.push({id:'alert',label:'Alert\nauthorities & residents',x:x+w+120,y:d.nodes[5].y-4,w:170,h:58,fill:green}); d.edges.push(['risk','alert','over threshold']); }
  if(k==='arch'){ const col=(i)=>30+i*178,row=(j)=>110+j*92,b=(id,label,i,j,fill,h=70)=>({id,label,x:col(i),y:row(j),w:158,h,fill});
    d={nodes:[b('wx','Weather forecasts\nOpen-Meteo, GloFAS',0,0,blue),b('sens','River gauges, sensors\n(future: SPW hydrometry)',0,1,blue),b('data','Hazard & exposure data\nEFAS, GHS, OSM, DEM',0,2,blue),
      b('sim','Simulation\nscenario → water rise\nover time',1,1,warm,90),b('risk','Risk analysis\nzones, roads, shelters,\nevacuation, teams',2,1,warm,90),
      b('alert','Alerts\nauthority alert, CAP draft,\nresident messages',3,1,green,90),b('auth','Authorities\nmayor, civil protection',3,0,green),b('res','Residents\nmessages, safe routes',3,2,green)],
      edges:[['wx','sim'],['sens','sim','not connected yet'],['data','sim'],['sim','risk'],['risk','alert'],['alert','auth'],['alert','res']],H:430}; }
  if(k==='dfd'){ const n=(id,label,x,y,shape,fill,w=150,h=58)=>({id,label,x,y,w,h,shape,fill});
    d={nodes:[n('E1','Weather service',24,100,'box',css('--bg')),n('E2','Sensors (future)',24,230,'box',css('--bg')),n('E3','Authorities',590,100,'box',css('--bg')),n('E4','Residents',590,330,'box',css('--bg')),
      n('P1','1.0 Ingest data',220,100,'proc',blue),n('P2','2.0 Simulate flood',220,230,'proc',blue),n('P3','3.0 Assess risk',400,230,'proc',blue),n('P4','4.0 Plan evacuation',400,360,'proc',blue),n('P5','5.0 Issue alerts',590,230,'proc',warm),
      n('D1','D1 Hazard maps & terrain',220,360,'store',css('--bg'),160,40),n('D2','D2 Scenarios & results',40,370,'store',css('--bg'),160,40),n('D3','D3 Alert log',400,110,'store',css('--bg'),150,40)],
      edges:[['E1','P1','rain'],['E2','P1','levels'],['P1','P2','rain index'],['D1','P2','depths'],['P2','D2','results'],['P2','P3','water over time'],['P3','P4','risk areas'],['P4','P5','plan'],['P3','P5','thresholds'],['P5','E3','alert'],['P5','E4','messages'],['P5','D3','log']],H:450}; }
  if(k==='erd'){ const e=(id,fields,x,y)=>({id,label:`${id}\n${fields.join('\n')}`,x,y,w:160,h:24+fields.length*17,fill:blue,left:true});
    d={nodes:[e('User',['id','role','municipality'],24,100),e('Simulation',['id','user_id','scenario params','created_at'],230,100),e('FloodEvent',['id','simulation_id','return_period','peak_time'],440,100),
      e('Sensor',['id','type','location'],24,290),e('Reading',['id','sensor_id','time','value'],230,290),e('Alert',['id','simulation_id','level','audience','sent_at'],440,290),
      e('Report',['id','simulation_id','format','created_at'],620,100),e('Shelter',['id','name','capacity','location'],620,290)],
      edges:[['User','Simulation','1 → n'],['Simulation','FloodEvent','1 → n'],['Sensor','Reading','1 → n'],['Simulation','Alert','1 → n'],['Simulation','Report','1 → n'],['Reading','Simulation','feeds'],['Alert','Shelter','points to']],H:440}; }
  const meta={flow:['Flowchart: how the simulation works','The algorithm as built in this app (not a hydraulic model).'],arch:['System architecture','From forecasts and data to alerts. Sensors are a proposed extension.'],
    dfd:['Data flow diagram','External entities (rectangles), processes (rounded), data stores (open boxes).'],erd:['Entity–relationship diagram','Proposed database for an operational version: the prototype stores no personal data.']}[k];
  return {kind:'boxes',title:meta[0],sub:meta[1],...d,src,csv:csv(d)}; }
