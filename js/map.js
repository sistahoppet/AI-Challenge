// map.js - MapLibre map: background maps, water/buildings/zones layers, legend and hover tooltip.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- map ---------- */
// building type: 0 home, 1 shops/offices/industry (GHS-OBAT use), 2 emergency & care (OpenStreetMap site inside), 3 school/sports hall
const KEYK=new Set(['hospital','clinic','care_home','fire_station','police','town_hall']),PUBK=new Set(['school','sports_hall','stadium','community_centre']);
const btOf=b=>KEYK.has(b.kind)?2:PUBK.has(b.kind)?3:b.use===2?1:0;
function squareAround([x,y],m=6){const dx=m/(111320*Math.cos(y*Math.PI/180)),dy=m/110540;return {type:'Polygon',coordinates:[[[x-dx,y-dy],[x+dx,y-dy],[x+dx,y+dy],[x-dx,y+dy],[x-dx,y-dy]]]};}
// every feature carries its cell depth per flood size (r10, r100, …) so the map can follow the video with paint expressions only
// c = the cell (or null): depth per flood size (r10…), channel depth (L10…) and delay (lag) for the "water now" expression
function depthProps(c){const o={lag:c?c.lag:0}; D.rps.forEach(r=>{o['r'+r]=c?c.depth[r]:0; o['L'+r]=c?c.L[r]:0;}); return o;}
function buildSources(){
  cellFC={type:'FeatureCollection',features:D.cells.map((c,i)=>({type:'Feature',geometry:{type:'Polygon',coordinates:c.poly},properties:Object.assign({i,z:c.z,pop:+c.pop.toFixed(1),elev:c.elev??-1},depthProps(c))}))};
  bldFC={type:'FeatureCollection',features:D.blds.map(b=>({type:'Feature',geometry:b.geom.type==='Point'?squareAround(b.c,Math.max(3,Math.sqrt(b.area||36)/2)):b.geom,properties:Object.assign({bt:btOf(b),h:b.h,use:b.use??-1,area:b.area||0,bpop:+(b.pop||0).toFixed(2)},depthProps(b.ci>=0?D.cells[b.ci]:null))}))};
}
// water depth now, per feature: depth − (1 − rise) × L, rise = level(T − lag) (same formula as nowDepth in analysis.js)
// keep=true: highest level reached so far (stays at 1 after the peak) → "water reached here", i.e. likely damage
function riseExpr(T,keep){ const x=['-',T,['get','lag']];
  return ['case',['<=',x,0],0,['<',x,.45],['/',['-',1,['cos',['/',['*',['pi'],x],.45]]],2],keep||['<',x,.6],1,['max',0,['-',1,['/',['-',x,.6],.4]]]]; }
const withInit=e=>INIT>0?['max',e,['min',1,['/',INIT,['max',['get','L'+rp()],.01]]]]:e; // water already in the river at the start
const over=()=>['-',['get','r'+rp()],['*',['-',1,withInit(riseExpr(S.T))],['get','L'+rp()]]];
const overMax=()=>['-',['get','r'+rp()],['*',['-',1,withInit(riseExpr(S.T,true))],['get','L'+rp()]]];
const waterColor=()=>['step',over(),css('--w1'),0.5,css('--w2'),1.5,css('--w3')];
const zoneColor=()=>['match',['get','z'],1,css('--zg'),2,css('--zy'),css('--zr')];
const btColor=()=>['match',['get','bt'],1,css('--bt1'),2,css('--bt2'),3,css('--bt3'),css('--bt0')]; // dry: colour by type
const roofColor=()=>['step',overMax(),['match',['get','bt'],0,css('--roof'),1,css('--roof-flat'),2,css('--bt2'),css('--bt3')],0.01,css('--hit1'),0.5,css('--hit2'),1.5,css('--hit3')];
const bldColor=()=>['step',overMax(),btColor(),0.01,css('--hit1'),0.5,css('--hit2'),1.5,css('--hit3')]; // colour = deepest water so far (stays after the water goes down)
const isDark=()=>css('--bg')==='#0f181c';
const BASE={
  'streets-light':{tiles:['a','b','c','d'].map(s=>`https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`),attr:'© OpenStreetMap contributors © CARTO'},
  'streets-dark':{tiles:['a','b','c','d'].map(s=>`https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`),attr:'© OpenStreetMap contributors © CARTO'},
  'satellite':{tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],attr:'Imagery © Esri, Maxar, Earthstar Geographics'}
};
const OSM_ATTR='© OpenStreetMap contributors · OpenFreeMap';
let tileOk=false,tileFail=0;
const empty=()=>({type:'FeatureCollection',features:[]});
function initMap(){
  const sources={dem:{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:14},
    osm:{type:'vector',url:'https://tiles.openfreemap.org/planet'}};
  const layers=[{id:'bg',type:'background',paint:{'background-color':css('--land')}}];
  for(const k in BASE){sources[k]={type:'raster',tiles:BASE[k].tiles,tileSize:256,maxzoom:19}; layers.push({id:k,type:'raster',source:k,layout:{visibility:'none'}});}
  layers.push(...detailLayers('base'));
  map=new maplibregl.Map({container:'map',attributionControl:false,style:{version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources,layers},bounds:D.bbox,fitBoundsOptions:{padding:50},maxPitch:80,maxZoom:18,preserveDrawingBuffer:true}); // keeps the frame for map figures (Diagrams)
  const isTile=id=>BASE[id]||id==='dem'||id==='osm';
  map.on('error',e=>{ if(e.sourceId&&isTile(e.sourceId)){ tileFail++; if(!tileOk&&tileFail>=2) showNotice(); } });
  map.on('data',e=>{ if(e.dataType==='source'&&e.tile&&isTile(e.sourceId)&&e.sourceId!=='dem'&&e.tile.state==='loaded'){ tileOk=true; $('notice').hidden=true; } });
  map.on('load',()=>{
    ['cells','bld','bldpt','obs','cut','people','cars','routes','groups','walkers','places','ab','trips','incidents','units'].forEach(id=>map.addSource(id,{type:'geojson',data:empty(),...(id==='bld'?{maxzoom:15,buffer:16}:{})})); // buildings: fewer tile levels = no blank moment while zooming
    map.addLayer({id:'zones',type:'fill',source:'cells',layout:{visibility:'none'},paint:{'fill-color':zoneColor(),'fill-opacity':0.55,'fill-antialias':false}});
    map.addLayer({id:'water-2d',type:'fill',source:'cells',paint:{'fill-color':'#000','fill-opacity':0}}); // invisible: only for the hover tooltip
    map.addLayer({id:'water-3d',type:'fill-extrusion',source:'cells',layout:{visibility:'none'},paint:{'fill-extrusion-color':waterColor(),'fill-extrusion-height':0,'fill-extrusion-opacity':0.6}});
    detailLayers('mid').forEach(l=>map.addLayer(l));
    map.addLayer({id:'bld-2d',type:'fill',source:'bld',paint:{'fill-color':bldColor()}});
    map.addLayer({id:'bld-hit',type:'circle',source:'bldpt',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,1.8,16,6]}}); // marker for every building water has reached
    map.addLayer({id:'bld-3d',type:'fill-extrusion',source:'bld',layout:{visibility:'none'},paint:{'fill-extrusion-color':bldColor(),'fill-extrusion-height':0,'fill-extrusion-opacity':0.95,'fill-extrusion-vertical-gradient':true}});
    // roof band on top, thickness and colour by type: tiled homes, flat grey work buildings, coloured public and emergency buildings
    map.addLayer({id:'bld-roof',type:'fill-extrusion',source:'bld',layout:{visibility:'none'},paint:{'fill-extrusion-color':roofColor(),'fill-extrusion-height':0,'fill-extrusion-base':0,'fill-extrusion-opacity':0.95}});
    // 3D: the water around each flooded building, up to today's level; a building lower than the water disappears under it
    map.addLayer({id:'bld-water',type:'fill-extrusion',source:'bld',layout:{visibility:'none'},filter:['==',1,0],paint:{'fill-extrusion-color':css('--w2'),'fill-extrusion-height':0,'fill-extrusion-opacity':.8}});
    map.addLayer({id:'bld-line',type:'line',source:'bld',minzoom:15,paint:{'line-color':css('--ink'),'line-opacity':.25,'line-width':.5}});
    addLiveLayers(); addEvacLayers(); addPlaceLayers(); addResponseLayers();
    map.addLayer({id:'obs-fill',type:'fill',source:'obs',paint:{'fill-color':css('--obs'),'fill-opacity':.45}});
    map.addLayer({id:'obs-line',type:'line',source:'obs',paint:{'line-color':css('--obs'),'line-width':2.4,'line-dasharray':[2,1.5]}});
    detailLayers('top').forEach(l=>map.addLayer(l));
    ready=true; refreshData(); setBasemap(S.basemap); applyLayers(); render();
    // in 3D, dots lie flat on the ground instead of standing up like discs in the air
    map.getStyle().layers.filter(l=>l.type==='circle').forEach(l=>{ map.setPaintProperty(l.id,'circle-pitch-alignment','map'); map.setPaintProperty(l.id,'circle-pitch-scale','map'); });
    map.on('mousemove',onHover); map.on('mouseout',()=>$('tip').hidden=true); let clickT=null; map.on('click',e=>{ clearTimeout(clickT); clickT=setTimeout(()=>onMapClick(e),230); }); // wait: a double-click is A–B, not two clicks
    map.doubleClickZoom.disable(); map.on('dblclick',e=>{ e.preventDefault(); clearTimeout(clickT); abDouble([e.lngLat.lng,e.lngLat.lat]); }); // double-click: route A, then B
    map.on('sourcedata',e=>{ if(e.sourceId==='osm'&&e.tile) collectRoads(); }); // not 'idle': the animated water keeps the map busy
  });
}
// (re)fill every map source after new data is loaded
function refreshData(){ if(!ready) return;
  map.getSource('cells').setData(cellFC); map.getSource('bld').setData(bldFC); map.getSource('bldpt').setData({type:'FeatureCollection',features:D.blds.map((b,i)=>({type:'Feature',geometry:{type:'Point',coordinates:b.c},properties:bldFC.features[i].properties}))}); map.getSource('obs').setData(D.observed||empty());
  buildWater(); buildPeople(); placesData(); roadsReset(); evacReset(); cityBox(); }
// the map stays inside the chosen area: outside is dimmed and you cannot pan or zoom far away from it
function cityBox(b=D.bbox){ const [x0,y0,x1,y1]=b,px=(x1-x0)*.15,py=(y1-y0)*.15,ring=[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
  const fc={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],ring.slice().reverse()]},properties:{}}]};
  if(!map.getSource('outside')){ map.addSource('outside',{type:'geojson',data:fc}); map.addLayer({id:'outside',type:'fill',source:'outside',paint:{'fill-color':css('--bg'),'fill-opacity':.82}});
    map.addLayer({id:'outside-line',type:'line',source:'outside',paint:{'line-color':css('--accent'),'line-width':2}}); }
  else map.getSource('outside').setData(fc);
  map.setMaxBounds([[x0-px,y0-py],[x1+px,y1+py]]); const cam=map.cameraForBounds?.(b,{padding:20}); if(cam) map.setMinZoom(Math.max(0,cam.zoom-.6));
  const c=map.getCenter(); if(c.lng<x0||c.lng>x1||c.lat<y0||c.lat>y1) map.fitBounds(b,{padding:30,duration:0}); } // a new area: start framed on it
function showNotice(){ if(S.basemap==='none') return; const n=$('notice'); n.textContent='The real map can\'t load in this preview. Open the downloaded app file in your browser to see streets, satellite photos and real hills.'; n.hidden=false; }
function setBasemap(b){ S.basemap=b; document.querySelectorAll('.basemap [data-b]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.b===b));
  if(!ready) return; const want=b==='streets'?(isDark()?'streets-dark':'streets-light'):b;
  for(const k in BASE) map.setLayoutProperty(k,'visibility',k===want?'visible':'none');
  $('attr').textContent=[BASE[want]?BASE[want].attr:'',b==='detail'||b==='satellite'?OSM_ATTR:'',S.l3d&&$('tHills').checked&&b!=='none'?'Terrain: Mapzen / AWS':''].filter(Boolean).join(' · '); $('attr').hidden=!$('attr').textContent;
  if(b==='none') $('notice').hidden=true; else if(!tileOk&&tileFail>=2) showNotice();
  applyTerrain(); applyLayers();
}
function applyTerrain(){ if(!ready) return; const on=S.l3d&&$('tHills').checked&&S.basemap!=='none';
  try{ map.setTerrain(on?{source:'dem',exaggeration:1}:null); }catch(e){} } // true scale: hills, buildings and water at real height
function applyLayers(){
  if(!ready) return; const three=S.l3d,vis=b=>b?'visible':'none',zones=S.tab==='safety';
  const model=S.cmp!=='obs',obs=S.cmp!=='model'&&D.hasObs&&!zones;
  map.setLayoutProperty('water-img','visibility',vis(!zones&&model)); map.setLayoutProperty('water-3d','visibility',vis(three&&!zones&&$('tCols').checked));
  map.setLayoutProperty('zones','visibility',vis(zones||$('tZones').checked)); map.setPaintProperty('zones','fill-opacity',zones?.55:.3);
  map.setLayoutProperty('bld-2d','visibility',vis(!three&&$('tBld').checked)); map.setLayoutProperty('bld-hit','visibility',vis(!three&&$('tBld').checked&&!zones)); map.setLayoutProperty('bld-3d','visibility',vis(three&&$('tBld').checked)); map.setLayoutProperty('bld-roof','visibility',vis(three&&$('tBld').checked)); map.setLayoutProperty('bld-water','visibility',vis(three&&$('tBld').checked)); map.setLayoutProperty('bld-line','visibility',vis(!three&&$('tBld').checked));
  map.setLayerZoomRange('bld-hit',0,14.5); // up close the real footprints show the water; the dots only help when zoomed out
  map.setLayoutProperty('obs-line','visibility',vis(obs)); map.setLayoutProperty('obs-fill','visibility',vis(obs));
  map.setPaintProperty('bld-3d','fill-extrusion-height',['*',['get','h'],S.lift,1.02]); // real GHS-OBAT height, just above the OSM footprint it sits in
  map.setPaintProperty('bld-roof','fill-extrusion-base',['*',['get','h'],S.lift,1.02]); map.setPaintProperty('bld-roof','fill-extrusion-height',['*',['+',['get','h'],['match',['get','bt'],0,1.6,1,.4,2,2.2,1.2]],S.lift,1.02]);
  detailVisibility(); evacVisibility(); placesVisibility(); responseVisibility(); paintDynamic(true);
  pinVis();
}
// paint expressions that follow the video (cheap: no data is re-sent to the map)
// each call makes MapLibre recolour every building, so during playback it runs ~10×/s (the last call always lands)
let lastFilter=0,lastPaint=0,paintT=0;
function paintDynamic(force){ if(!ready) return; const t=performance.now(); clearTimeout(paintT);
  if(!force&&t-lastPaint<100){ paintT=setTimeout(()=>paintDynamic(true),100-(t-lastPaint)); return; } lastPaint=t; const cols=S.l3d&&$('tCols').checked;
  map.setPaintProperty('bld-2d','fill-color',bldColor()); map.setPaintProperty('bld-3d','fill-extrusion-color',bldColor()); map.setPaintProperty('bld-roof','fill-extrusion-color',roofColor());
  const hit=['>',overMax(),.01],now=['>',over(),.01];
  map.setPaintProperty('bld-hit','circle-color',bldColor()); map.setPaintProperty('bld-hit','circle-opacity',['case',hit,.95,0]);
  map.setPaintProperty('bld-hit','circle-stroke-color',['case',now,css('--w3'),'#fff']); map.setPaintProperty('bld-hit','circle-stroke-width',['case',now,2,1]);
  map.setPaintProperty('bld-hit','circle-stroke-opacity',['case',hit,1,0]);
  if(S.l3d){ const w=['max',0,over()],sub=['>=',w,['get','h']],z=v=>['*',v,S.lift,1.02];
    map.setPaintProperty('bld-3d','fill-extrusion-base',z(['min',['get','h'],w])); // only the part above the water stands out
    map.setPaintProperty('bld-roof','fill-extrusion-base',['case',sub,0,z(['get','h'])]);
    map.setPaintProperty('bld-roof','fill-extrusion-height',['case',sub,0,z(['+',['get','h'],['match',['get','bt'],0,1.6,1,.4,2,2.2,1.2]])]);
    map.setPaintProperty('bld-water','fill-extrusion-height',z(w)); }
  if(S.l3d&&(force||performance.now()-lastFilter>150)){ lastFilter=performance.now(); // filters are slower, so update them less often
    map.setFilter('bld-water',['>',over(),0.05]);
    // 3D: only buildings in the water are drawn from GHS-OBAT (coloured); all others come from OpenStreetMap at their real height
    map.setFilter('bld-3d',$('tOsmB').checked&&!D.hasFp?['>',over(),0.01]:null); map.setFilter('bld-roof',$('tOsmB').checked&&!D.hasFp?['>',over(),0.01]:null);
    if(cols){ map.setFilter('water-3d',['>',over(),0.01]); map.setPaintProperty('water-3d','fill-extrusion-color',waterColor());
      map.setPaintProperty('water-3d','fill-extrusion-height',['*',['max',over(),0.15],S.exag*S.lift]); } }
  paintDetails(); paintPlaces();
}
function recolor(){ if(!ready) return; if(map.getLayer('outside')){ map.setPaintProperty('outside','fill-color',css('--bg')); map.setPaintProperty('outside-line','line-color',css('--accent')); }
  map.setPaintProperty('bg','background-color',css('--land'));
  map.setPaintProperty('zones','fill-color',zoneColor()); map.setPaintProperty('obs-line','line-color',css('--obs')); map.setPaintProperty('obs-fill','fill-color',css('--obs'));
  recolorDetails(); recolorEvac(); recolorPlaces(); if(WV) WV.lut=waterLut(); setBasemap(S.basemap); drawLegend(); if(S.tab==='diag') drawDiagram();
}
let pending=false; function render(){ if(pending) return; pending=true; requestAnimationFrame(()=>{pending=false; draw();}); }
// the numbers scan every cell and building, so during playback they refresh ~5×/s (the last call always lands)
let lastStats=0,statsT=0;
function draw(){
  if(!D) return; const p=level(S.T);
  paintDynamic();
  const ph=S.T<0.45?0:S.T<0.6?1:2; [0,1,2].forEach(i=>$('ph'+i).classList.toggle('on',i===ph));
  $('nowLbl').textContent=ph===1?'Peak':`${['Rising','Peak','Going down'][ph]} · ${Math.round(p*100)}% of peak`;
  $('time').value=Math.round(S.T*1000);
  if(typeof drillTick==='function') drillTick();
  const t=performance.now(); clearTimeout(statsT);
  if(t-lastStats<200){ statsT=setTimeout(drawStats,200-(t-lastStats)); return; } drawStats();
}
function drawStats(){ if(!D) return; lastStats=performance.now(); const e=exposure(rp(),true);
  $('sPeople').textContent=fmt(e.people); $('sBld').textContent=fmt(e.bld); $('sArea').textContent=e.area.toFixed(e.area<10?2:1);
  $('classes').innerHTML=e.cc.map((c,k)=>`<div class="crow"><span class="sw" style="background:var(${CLASSES[k].v})"></span><span>${CLASSES[k].name}</span><span class="mono">${fmt(c.people)} people · ${fmt(c.bld)} bld</span></div>`).join('')
    +`<div class="crow"><span class="sw" style="background:var(--cut)"></span><span>Streets closed to cars (≥ ${CAR_DEPTH} m)</span><span class="mono">${cutKm(rp(),true).toFixed(1)} km</span></div>`;
  checkAlerts(e.people);
}

/* ---------- legend, tooltip ---------- */
function drawLegend(){
  const L=$('legend'),dot=(v,t,st='')=>`<div class="li"><span class="sw dot" style="background:var(${v});${st}"></span>${t}</div>`;
  if(S.tab==='safety'){
    L.innerHTML=`<div class="t">Safety zones</div>${[['--zr','Red: high risk'],['--zy','Yellow: caution'],['--zg','Green: safer']].map(([v,t])=>`<div class="li"><span class="sw" style="background:var(${v})"></span>${t}</div>`).join('')}<div class="li"><span class="pin" style="width:14px;height:14px;border-width:1px"></span>Shelters</div>
     <div class="t" style="margin-top:6px">Evacuation</div>${[1,2,3].map(w=>`<div class="li"><span class="sw" style="background:var(--wave${w});height:4px"></span>Wave ${w} route</div>`).join('')}${dot('--walk','People walking (sped up)','border:1px solid var(--ink)')}`; return;}
  L.innerHTML=`<div class="t">Water depth</div><div class="grad"></div><div class="gradlab"><span>0</span><span>0.5</span><span>1.5</span><span>2.5+ m</span></div>
   ${D?.hasObs&&S.cmp!=='model'?`<div class="li"><span class="sw" style="border:2px dashed var(--obs);background:color-mix(in srgb,var(--obs) 45%,transparent)"></span>Water seen by satellite, July 2021</div>`:''}<div class="t" style="margin-top:6px">Buildings (real shape)</div>${[['--bt0','Home'],['--bt1','Shop, office, industry'],['--bt3','School, sports hall'],['--bt2','Hospital, fire, police, town hall']].map(([v,t])=>`<div class="li"><span class="sw" style="background:var(${v})"></span>${t}</div>`).join('')}<div class="t" style="margin-top:6px">Water reached buildings</div>${CLASSES.map((c,k)=>`<div class="li"><span class="sw dot" style="background:var(--hit${k+1})"></span>${['under 0.5 m','0.5–1.5 m','over 1.5 m: likely serious damage'][k]}</div>`).join('')}
   <div class="li"><span class="sw dot" style="background:var(--hit2);box-shadow:0 0 0 2px var(--w3)"></span>Blue ring: under water now</div>
   <div class="li"><span class="sw" style="background:var(--cut);height:4px"></span>Street under water (≥ ${CAR_DEPTH} m): closed</div><div class="li"><span class="sw" style="background:repeating-linear-gradient(90deg,var(--dmg) 0 4px,transparent 4px 7px);height:4px"></span>Was flooded: check before use</div>
   ${$('tPeople').checked?dot('--people',`1 dot ≈ ${fmt(perDot)} resident${perDot>1?'s':''}`)+dot('--people-risk','Residents in water'):''}
   ${$('tCars').checked?dot('--car','Cars: illustration only'):''}
   ${D?.places?.length&&$('tPlaces').checked?dot('--crit','Hospital, fire, police, town hall')+dot('--shel','School, sports hall (possible shelter)')+'<div class="li"><span class="sw dot" style="border:3px solid var(--cut)"></span>Site in the water</div>':''}`;
}
function onHover(ev){
  const layer=S.tab==='safety'?'zones':'water-2d',f=ready&&map.queryRenderedFeatures(ev.point,{layers:[layer]})[0],tip=$('tip');
  if(!f){tip.hidden=true;return;} const c=D.cells[f.properties.i];
  if(S.tab!=='safety'&&nowDepth(c,rp())<=0.01){tip.hidden=true;return;}
  tip.innerHTML=`<b>${['','Green zone','Yellow zone','Red zone'][c.z]}</b> · ${fmt(c.pop)} residents<br><i>Why: ${c.zr}</i><br>${D.rps.map(r=>`${sizeWord(r)} (1-in-${r}): <span class="mono">${c.depth[r].toFixed(2)} m</span>`).join('<br>')}${D.hasObs?`<br>Flooded in 2021: ${c.obs?'yes':'no'}`:''}`;
  tip.hidden=false; const w=$('map').clientWidth; tip.style.left=Math.min(ev.point.x+14,w-250)+'px'; tip.style.top=(ev.point.y+14)+'px';
}
