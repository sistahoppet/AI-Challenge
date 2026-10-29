// map.js - MapLibre map: background maps, water/buildings/zones layers, legend and hover tooltip.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- map ---------- */
function squareAround([x,y],m=6){const dx=m/(111320*Math.cos(y*Math.PI/180)),dy=m/110540;return {type:'Polygon',coordinates:[[[x-dx,y-dy],[x+dx,y-dy],[x+dx,y+dy],[x-dx,y+dy],[x-dx,y-dy]]]};}
// every feature carries its cell depth per flood size (r10, r100, …) so the map can follow the video with paint expressions only
// c = the cell (or null): depth per flood size (r10…), channel depth (L10…) and delay (lag) for the "water now" expression
function depthProps(c){const o={lag:c?c.lag:0}; D.rps.forEach(r=>{o['r'+r]=c?c.depth[r]:0; o['L'+r]=c?c.L[r]:0;}); return o;}
function buildSources(){
  cellFC={type:'FeatureCollection',features:D.cells.map((c,i)=>({type:'Feature',geometry:{type:'Polygon',coordinates:c.poly},properties:Object.assign({i,z:c.z},depthProps(c))}))};
  bldFC={type:'FeatureCollection',features:D.blds.map(b=>({type:'Feature',geometry:b.geom.type==='Point'?squareAround(b.c):b.geom,properties:Object.assign({h:b.h},depthProps(b.ci>=0?D.cells[b.ci]:null))}))};
}
// water depth now, per feature: depth − (1 − rise) × L, rise = level(T − lag) (same formula as nowDepth in analysis.js)
// keep=true: highest level reached so far (stays at 1 after the peak) → "water reached here", i.e. likely damage
function riseExpr(T,keep){ const x=['-',T,['get','lag']];
  return ['case',['<=',x,0],0,['<',x,.45],['/',['-',1,['cos',['/',['*',['pi'],x],.45]]],2],keep||['<',x,.6],1,['max',0,['-',1,['/',['-',x,.6],.4]]]]; }
const over=()=>['-',['get','r'+rp()],['*',['-',1,riseExpr(S.T)],['get','L'+rp()]]];
const overMax=()=>['-',['get','r'+rp()],['*',['-',1,riseExpr(S.T,true)],['get','L'+rp()]]];
const waterColor=()=>['step',over(),css('--w1'),0.5,css('--w2'),1.5,css('--w3')];
const zoneColor=()=>['match',['get','z'],1,css('--zg'),2,css('--zy'),css('--zr')];
const bldColor=()=>['step',overMax(),css('--bld'),0.01,css('--hit1'),0.5,css('--hit2'),1.5,css('--hit3')]; // colour = deepest water so far (stays after the water goes down)
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
  map=new maplibregl.Map({container:'map',attributionControl:false,style:{version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources,layers},bounds:D.bbox,fitBoundsOptions:{padding:50},maxPitch:80,maxZoom:18});
  const isTile=id=>BASE[id]||id==='dem'||id==='osm';
  map.on('error',e=>{ if(e.sourceId&&isTile(e.sourceId)){ tileFail++; if(!tileOk&&tileFail>=2) showNotice(); } });
  map.on('data',e=>{ if(e.dataType==='source'&&e.tile&&isTile(e.sourceId)&&e.sourceId!=='dem'&&e.tile.state==='loaded'){ tileOk=true; $('notice').hidden=true; } });
  map.on('load',()=>{
    ['cells','bld','bldpt','obs','cut','people','cars','routes','groups','walkers','places','ab','trips','incidents','units'].forEach(id=>map.addSource(id,{type:'geojson',data:empty()}));
    map.addLayer({id:'zones',type:'fill',source:'cells',layout:{visibility:'none'},paint:{'fill-color':zoneColor(),'fill-opacity':0.55,'fill-antialias':false}});
    map.addLayer({id:'water-2d',type:'fill',source:'cells',paint:{'fill-color':'#000','fill-opacity':0}}); // invisible: only for the hover tooltip
    map.addLayer({id:'water-3d',type:'fill-extrusion',source:'cells',layout:{visibility:'none'},paint:{'fill-extrusion-color':waterColor(),'fill-extrusion-height':0,'fill-extrusion-opacity':0.6}});
    detailLayers('mid').forEach(l=>map.addLayer(l));
    map.addLayer({id:'bld-2d',type:'fill',source:'bld',paint:{'fill-color':bldColor()}});
    map.addLayer({id:'bld-hit',type:'circle',source:'bldpt',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,1.8,16,6]}}); // marker for every building water has reached
    map.addLayer({id:'bld-3d',type:'fill-extrusion',source:'bld',layout:{visibility:'none'},paint:{'fill-extrusion-color':bldColor(),'fill-extrusion-height':0,'fill-extrusion-opacity':0.95}});
    addLiveLayers(); addEvacLayers(); addPlaceLayers(); addResponseLayers();
    map.addLayer({id:'obs-fill',type:'fill',source:'obs',paint:{'fill-color':css('--obs'),'fill-opacity':.45}});
    map.addLayer({id:'obs-line',type:'line',source:'obs',paint:{'line-color':css('--obs'),'line-width':2.4,'line-dasharray':[2,1.5]}});
    detailLayers('top').forEach(l=>map.addLayer(l));
    ready=true; refreshData(); setBasemap(S.basemap); applyLayers(); render();
    map.on('mousemove',onHover); map.on('mouseout',()=>$('tip').hidden=true); map.on('click',onMapClick);
    map.on('sourcedata',e=>{ if(e.sourceId==='osm'&&e.tile) collectRoads(); }); // not 'idle': the animated water keeps the map busy
  });
}
// (re)fill every map source after new data is loaded
function refreshData(){ if(!ready) return;
  map.getSource('cells').setData(cellFC); map.getSource('bld').setData(bldFC); map.getSource('bldpt').setData({type:'FeatureCollection',features:D.blds.map((b,i)=>({type:'Feature',geometry:{type:'Point',coordinates:b.c},properties:bldFC.features[i].properties}))}); map.getSource('obs').setData(D.observed||empty());
  buildWater(); buildPeople(); placesData(); roadsReset(); evacReset(); }
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
  map.setLayoutProperty('bld-2d','visibility',vis(!three&&$('tBld').checked)); map.setLayoutProperty('bld-hit','visibility',vis(!three&&$('tBld').checked&&!zones)); map.setLayoutProperty('bld-3d','visibility',vis(three&&$('tBld').checked));
  map.setLayoutProperty('obs-line','visibility',vis(obs)); map.setLayoutProperty('obs-fill','visibility',vis(obs));
  map.setPaintProperty('bld-3d','fill-extrusion-height',['*',['get','h'],S.lift,1.02]); // just above the OSM footprint it sits in
  detailVisibility(); evacVisibility(); placesVisibility(); responseVisibility(); paintDynamic(true);
  markers.forEach(m=>m.getElement().hidden=!(zones||S.tab==='coord'));
}
// paint expressions that follow the video (cheap: no data is re-sent to the map)
let lastFilter=0;
function paintDynamic(force){ if(!ready) return; const cols=S.l3d&&$('tCols').checked;
  map.setPaintProperty('bld-2d','fill-color',bldColor()); map.setPaintProperty('bld-3d','fill-extrusion-color',bldColor());
  const hit=['>',overMax(),.01],now=['>',over(),.01];
  map.setPaintProperty('bld-hit','circle-color',bldColor()); map.setPaintProperty('bld-hit','circle-opacity',['case',hit,.95,0]);
  map.setPaintProperty('bld-hit','circle-stroke-color',['case',now,css('--w3'),'#fff']); map.setPaintProperty('bld-hit','circle-stroke-width',['case',now,2,1]);
  map.setPaintProperty('bld-hit','circle-stroke-opacity',['case',hit,1,0]);
  if(S.l3d&&(force||performance.now()-lastFilter>150)){ lastFilter=performance.now(); // filters are slower, so update them less often
    // 3D: only buildings in the water are drawn from GHS-OBAT (coloured); all others come from OpenStreetMap at their real height
    map.setFilter('bld-3d',$('tOsmB').checked?['>',over(),0.01]:null);
    if(cols){ map.setFilter('water-3d',['>',over(),0.01]); map.setPaintProperty('water-3d','fill-extrusion-color',waterColor());
      map.setPaintProperty('water-3d','fill-extrusion-height',['*',['max',over(),0.15],S.exag*S.lift]); } }
  paintDetails(); paintPlaces();
}
function recolor(){ if(!ready) return;
  map.setPaintProperty('bg','background-color',css('--land'));
  map.setPaintProperty('zones','fill-color',zoneColor()); map.setPaintProperty('obs-line','line-color',css('--obs')); map.setPaintProperty('obs-fill','fill-color',css('--obs'));
  recolorDetails(); recolorEvac(); recolorPlaces(); if(WV) WV.lut=waterLut(); setBasemap(S.basemap); drawLegend(); if(S.tab==='diag') drawDiagram();
}
let pending=false; function render(){ if(pending) return; pending=true; requestAnimationFrame(()=>{pending=false; draw();}); }
function draw(){
  if(!D) return; const p=level(S.T),e=exposure(rp(),true);
  paintDynamic();
  $('sPeople').textContent=fmt(e.people); $('sBld').textContent=fmt(e.bld); $('sArea').textContent=e.area.toFixed(e.area<10?2:1);
  $('classes').innerHTML=e.cc.map((c,k)=>`<div class="crow"><span class="sw" style="background:var(${CLASSES[k].v})"></span><span>${CLASSES[k].name}</span><span class="mono">${fmt(c.people)} people · ${fmt(c.bld)} bld</span></div>`).join('')
    +`<div class="crow"><span class="sw" style="background:var(--cut)"></span><span>Streets closed to cars (≥ ${CAR_DEPTH} m)</span><span class="mono">${cutKm(rp(),true).toFixed(1)} km</span></div>`;
  const ph=S.T<0.45?0:S.T<0.6?1:2; [0,1,2].forEach(i=>$('ph'+i).classList.toggle('on',i===ph));
  $('nowLbl').textContent=ph===1?'Peak':`${['Rising','Peak','Going down'][ph]} · ${Math.round(p*100)}% of peak`;
  $('time').value=Math.round(S.T*1000);
}

/* ---------- legend, tooltip ---------- */
function drawLegend(){
  const L=$('legend'),dot=(v,t,st='')=>`<div class="li"><span class="sw dot" style="background:var(${v});${st}"></span>${t}</div>`;
  if(S.tab==='safety'){
    L.innerHTML=`<div class="t">Safety zones</div>${[['--zr','Red: high risk'],['--zy','Yellow: caution'],['--zg','Green: safer']].map(([v,t])=>`<div class="li"><span class="sw" style="background:var(${v})"></span>${t}</div>`).join('')}<div class="li"><span class="pin" style="width:14px;height:14px;border-width:1px"></span>Shelters</div>
     <div class="t" style="margin-top:6px">Evacuation</div>${[1,2,3].map(w=>`<div class="li"><span class="sw" style="background:var(--wave${w});height:4px"></span>Wave ${w} route</div>`).join('')}${dot('--walk','People walking (sped up)','border:1px solid var(--ink)')}`; return;}
  L.innerHTML=`<div class="t">Water depth</div><div class="grad"></div><div class="gradlab"><span>0</span><span>0.5</span><span>1.5</span><span>2.5+ m</span></div>
   ${D?.hasObs&&S.cmp!=='model'?`<div class="li"><span class="sw" style="border:2px dashed var(--obs);background:color-mix(in srgb,var(--obs) 45%,transparent)"></span>Water seen by satellite, July 2021</div>`:''}<div class="t" style="margin-top:6px">Water reached buildings</div>${CLASSES.map((c,k)=>`<div class="li"><span class="sw dot" style="background:var(--hit${k+1})"></span>${['under 0.5 m','0.5–1.5 m','over 1.5 m: likely serious damage'][k]}</div>`).join('')}
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
  tip.innerHTML=`<b>${['','Green zone','Yellow zone','Red zone'][c.z]}</b> · ${fmt(c.pop)} residents<br>${D.rps.map(r=>`${sizeWord(r)} (1-in-${r}): <span class="mono">${c.depth[r].toFixed(2)} m</span>`).join('<br>')}${D.hasObs?`<br>Flooded in 2021: ${c.obs?'yes':'no'}`:''}`;
  tip.hidden=false; const w=$('map').clientWidth; tip.style.left=Math.min(ev.point.x+14,w-250)+'px'; tip.style.top=(ev.point.y+14)+'px';
}
