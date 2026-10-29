// details.js - Real map details from OpenStreetMap (rivers, streets, trees, buildings, names), people dots, illustrative cars, streets cut by water.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- OpenStreetMap layers (OpenFreeMap vector tiles, OpenMapTiles schema) ---------- */
let CAR_DEPTH=0.3; // assumption (editable in Evacuate): streets under 0.3 m of water or more count as closed to cars
const VEH=['motorway','trunk','primary','secondary','tertiary','minor','service'];
const MAJOR=['motorway','trunk','primary'];
const roadW=f=>['interpolate',['exponential',1.6],['zoom'],11,['*',f,['match',['get','class'],MAJOR,1.6,['secondary','tertiary'],1.1,.5]],17,['*',f,['match',['get','class'],MAJOR,16,['secondary','tertiary'],12,'minor',8,5]]];
const halo=()=>({'text-halo-color':css('--osm-halo'),'text-halo-width':1.6});
// [layer id, paint property, colour token]: re-applied when the theme changes
const DCOL=[['osm-urban','fill-color','--osm-urban'],['osm-park','fill-color','--osm-grass'],['osm-grass','fill-color','--osm-grass'],['osm-wood','fill-color','--osm-wood'],
  ['osm-water','fill-color','--osm-river'],['osm-river','line-color','--osm-river'],['osm-road-case','line-color','--osm-case'],['osm-path','line-color','--osm-case'],
  ['osm-bld','fill-color','--osm-bld'],['osm-bld-3d','fill-extrusion-color','--osm-bld'],
  ['osm-river-name','text-color','--osm-river-ink'],['osm-street-name','text-color','--osm-label'],['osm-place','text-color','--ink'],['roads-cut','line-color','--cut'],['roads-dmg','line-color','--dmg'],['cars','circle-color','--car']];
function detailLayers(part){
  const o={source:'osm'},road=()=>['match',['get','class'],MAJOR,css('--osm-major'),css('--osm-road')];
  if(part==='base') return [
    {...o,id:'osm-urban',type:'fill','source-layer':'landuse',filter:['match',['get','class'],['residential','commercial','industrial','retail'],true,false],paint:{'fill-color':css('--osm-urban')}},
    {...o,id:'osm-grass',type:'fill','source-layer':'landcover',filter:['match',['get','class'],['grass','farmland','wetland'],true,false],paint:{'fill-color':css('--osm-grass')}},
    {...o,id:'osm-park',type:'fill','source-layer':'park',paint:{'fill-color':css('--osm-grass')}},
    {...o,id:'osm-wood',type:'fill','source-layer':'landcover',filter:['==',['get','class'],'wood'],paint:{'fill-color':css('--osm-wood')}},
    {...o,id:'osm-water',type:'fill','source-layer':'water',paint:{'fill-color':css('--osm-river')}},
    {...o,id:'osm-river',type:'line','source-layer':'waterway',layout:{'line-cap':'round'},paint:{'line-color':css('--osm-river'),
      'line-width':['interpolate',['linear'],['zoom'],10,['match',['get','class'],'river',1.6,.6],16,['match',['get','class'],'river',9,'canal',6,2.5]]}},
    {...o,id:'osm-path',type:'line','source-layer':'transportation',minzoom:14,filter:['match',['get','class'],['path','track'],true,false],paint:{'line-color':css('--osm-case'),'line-width':1,'line-dasharray':[2,2]}},
    {...o,id:'osm-road-case',type:'line','source-layer':'transportation',filter:['match',['get','class'],VEH,true,false],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':css('--osm-case'),'line-width':roadW(1.5)}},
    {...o,id:'osm-road',type:'line','source-layer':'transportation',filter:['match',['get','class'],VEH,true,false],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':road(),'line-width':roadW(1)}},
    {...o,id:'osm-probe',type:'line','source-layer':'transportation',paint:{'line-opacity':0}} // keeps street tiles loading on every background (closed streets, routes, cars)
  ];
  if(part==='mid') return [
    {id:'roads-dmg',type:'line',source:'cut',paint:{'line-color':css('--dmg'),'line-width':['interpolate',['linear'],['zoom'],12,2,17,6],'line-dasharray':[1.2,1],'line-opacity':0}},
    {id:'roads-cut',type:'line',source:'cut',layout:{'line-cap':'round'},paint:{'line-color':css('--cut'),'line-width':['interpolate',['linear'],['zoom'],12,2.5,17,8],'line-opacity':0}},
    {...o,id:'osm-bld',type:'fill','source-layer':'building',minzoom:13,paint:{'fill-color':css('--osm-bld'),'fill-opacity':.85}},
    {...o,id:'osm-bld-3d',type:'fill-extrusion','source-layer':'building',minzoom:13,layout:{visibility:'none'},paint:{'fill-extrusion-color':css('--osm-bld'),'fill-extrusion-height':0,'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.9}},
  // no 3D forest blocks: big shapes are lifted to the ground height at their centre and float over slopes
  ];
  return [
    {...o,id:'osm-river-name',type:'symbol','source-layer':'waterway',filter:['==',['get','class'],'river'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['Noto Sans Italic'],'text-size':13,'text-letter-spacing':.1},paint:{'text-color':css('--osm-river-ink'),...halo()}},
    {...o,id:'osm-street-name',type:'symbol','source-layer':'transportation_name',minzoom:15,layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11},paint:{'text-color':css('--osm-label'),...halo()}},
    {...o,id:'osm-place',type:'symbol','source-layer':'place',filter:['match',['get','class'],['city','town','village','suburb','hamlet'],true,false],layout:{'text-field':['get','name'],'text-font':['Noto Sans Bold'],'text-size':['match',['get','class'],['city','town'],16,13]},paint:{'text-color':css('--ink'),...halo()}}
  ];
}
// checkbox → layers it controls
const DGROUPS={tRiv:['osm-water','osm-river','osm-river-name'],tRoad:['osm-road-case','osm-road','osm-path','osm-street-name'],tTree:['osm-wood','osm-grass','osm-park'],tOsmB:['osm-bld','osm-bld-3d'],tNames:['osm-place']};
function detailVisibility(){
  const b=S.basemap,fills=b==='detail',lines=fills||b==='satellite',three=S.l3d,set=(id,on)=>map.setLayoutProperty(id,'visibility',on?'visible':'none');
  set('osm-urban',fills);
  for(const [box,ids] of Object.entries(DGROUPS)) ids.forEach(id=>{const t=map.getLayer(id).type,area=t==='fill'||t==='fill-extrusion';
    set(id,$(box).checked&&(area?fills:lines)&&(id.endsWith('-3d')?three:id==='osm-bld'?!three:true));});
  map.setPaintProperty('osm-bld-3d','fill-extrusion-height',['*',['coalesce',['get','render_height'],6],S.lift]);
  set('people',$('tPeople').checked&&S.tab!=='safety'); set('cars',$('tCars').checked&&S.tab!=='safety'); set('roads-cut',S.tab!=='safety'); set('roads-dmg',S.tab!=='safety');
}
function paintDetails(){
  map.setPaintProperty('roads-cut','line-opacity',['case',['>',over(),CAR_DEPTH],.95,0]);
  map.setPaintProperty('roads-dmg','line-opacity',['case',['all',['>',overMax(),CAR_DEPTH],['<=',over(),CAR_DEPTH]],.9,0]); // water has gone: road may be damaged or covered in mud
  map.setPaintProperty('people','circle-color',['case',['>',over(),.01],css('--people-risk'),css('--people')]);
}
function recolorDetails(){ DCOL.forEach(([id,p,v])=>map.getLayer(id)&&map.setPaintProperty(id,p,css(v)));
  map.setPaintProperty('osm-road','line-color',['match',['get','class'],MAJOR,css('--osm-major'),css('--osm-road')]);
  ['osm-river-name','osm-street-name','osm-place'].forEach(id=>map.setPaintProperty(id,'text-halo-color',css('--osm-halo'))); }
function addLiveLayers(){
  map.addLayer({id:'people',type:'circle',source:'people',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,1.1,16,3.4],'circle-color':css('--people'),'circle-opacity':.85}});
  map.addLayer({id:'cars',type:'circle',source:'cars',paint:{'circle-radius':['interpolate',['linear'],['zoom'],12,2,17,5],'circle-color':['case',['==',['get','k'],1],css('--cut'),css('--car')],'circle-stroke-color':'#fff','circle-stroke-width':1}});
}

/* ---------- people: 1 dot ≈ N residents. Real data: dots sit on the residential buildings that hold them (pop per building).
   Demo data only: dots are spread inside their cell. Rounding carries over so the dot total matches the residents. ---------- */
let perDot=1;
function buildPeople(){ const onB=D.blds.some(b=>b.pop>0),src=onB?D.blds.filter(b=>b.pop>0&&b.ci>=0):D.cells,tot=src.reduce((s,x)=>s+x.pop,0),R=rng(11),f=[]; let carry=0;
  perDot=Math.max(1,Math.ceil(tot/4000));
  src.forEach(x=>{carry+=x.pop/perDot; let n=Math.floor(carry); carry-=n; const c=onB?D.cells[x.ci]:x,b=onB?null:bboxOf([c.ring]);
    while(n-->0) f.push({type:'Feature',geometry:{type:'Point',coordinates:onB?x.c:[b[0]+R()*(b[2]-b[0]),b[1]+R()*(b[3]-b[1])]},properties:depthProps(c)});});
  map.getSource('people').setData({type:'FeatureCollection',features:f}); drawLegend(); }

/* ---------- road network: data/roads.geojson (OpenStreetMap export) when loaded, otherwise roads read from the map tiles on screen ----------
   roadSegs: one entry per road segment, with the deepest water found along it (sampled every 30 m) per flood size.
   cutPieces: 30 m pieces of car roads that flood, drawn red when the water on them is ≥ CAR_DEPTH. */
let roadSegs=new Map(),roadLines=[],cutPieces=[],roadT=null,graphCache={};
const kk=p=>p[0].toFixed(5)+','+p[1].toFixed(5);
function roadsReset(){ roadSegs=new Map(); roadLines=[]; cutPieces=[]; cars=[]; graphCache={};
  if(ready){map.getSource('cut').setData(empty()); map.getSource('cars').setData(empty());}
  if(D.roads?.length){ addRoads(D.roads.map(f=>({pts:f.geometry.coordinates,car:f.properties.car!==0,foot:f.properties.foot!==0,bridge:!!f.properties.bridge,cls:f.properties.hw||f.properties.cls}))); finishRoads(); } }
function cellAt(p){const i=D.G.at(p[0],p[1]); return i<0?null:D.cells[i];}
function depthAt(p){return cellAt(p)?.depth||null;}
function addRoads(lines){ let added=0;
  for(const L of lines){ const pts=L.pts; if(L.car) roadLines.push(pts);
    for(let j=1;j<pts.length;j++){ const a=pts[j-1],b=pts[j],key=kk(a)+'|'+kk(b); if(roadSegs.has(key)||roadSegs.has(kk(b)+'|'+kk(a))) continue;
      const len=mDist(a,b),n=Math.max(1,Math.ceil(len/30)),dep={},cs=new Set();
      for(let s=0;s<n;s++){ const t0=s/n,t1=(s+1)/n,q=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],e=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],c=cellAt([(q[0]+e[0])/2,(q[1]+e[1])/2]);
        if(!c) continue; D.rps.forEach(r=>dep[r]=Math.max(dep[r]||0,c.depth[r])); if(D.rps.some(r=>c.depth[r]>0)) cs.add(c);
        if(L.car&&D.rps.some(r=>c.depth[r]>CAR_DEPTH)) cutPieces.push({a:q,b:e,len:len/n,dep:c.depth,c}); }
      roadSegs.set(key,{a,b,len,dep,cs:[...cs],car:L.car,foot:L.foot,bridge:L.bridge,cls:L.cls}); added++; } }
  return added; }
function finishRoads(){ graphCache={}; if(!ready) return;
  map.getSource('cut').setData({type:'FeatureCollection',features:cutPieces.map(s=>({type:'Feature',geometry:{type:'LineString',coordinates:[s.a,s.b]},properties:depthProps(s.c)}))});
  spawnCars(); render(); makePlan(); if(S.tab==='coord') drawCoord(); }
function collectRoads(){ if(D?.roads?.length) return; clearTimeout(roadT); roadT=setTimeout(()=>{ if(!ready||!D) return;
  const [x0,y0,x1,y1]=D.bbox,inB=p=>p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1,lines=[];
  for(const f of map.querySourceFeatures('osm',{sourceLayer:'transportation'})){ if(!VEH.includes(f.properties.class)) continue;
    const g=f.geometry; for(const pts of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]) if(pts.some(inB)) lines.push({pts,cls:f.properties.class,car:true,foot:!MAJOR.slice(0,2).includes(f.properties.class),bridge:f.properties.brunnel==='bridge'}); }
  if(addRoads(lines)) finishRoads(); },500); }
function cutKm(r,now){let m=0; for(const s of cutPieces) if((now?nowDepth(s.c,r):s.dep[r])>CAR_DEPTH) m+=s.len; return m/1000;}

/* ---------- cars: illustration only (no traffic data); they stop where the street is under water ---------- */
let cars=[];
function prepLine(pts){const cum=[0]; for(let j=1;j<pts.length;j++) cum.push(cum[j-1]+mDist(pts[j-1],pts[j])); return {pts,cum,len:cum[cum.length-1]};}
function along(l,s){let j=1; while(j<l.cum.length-1&&l.cum[j]<s) j++; const a=l.pts[j-1],b=l.pts[j],t=(s-l.cum[j-1])/((l.cum[j]-l.cum[j-1])||1); return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function spawnCars(){ if(!ready) return; const R=rng(5),lines=roadLines.map(prepLine).filter(l=>l.len>150); cars=[]; if(!lines.length) return;
  for(let k=0;k<Math.min(150,lines.length*2);k++){const l=lines[Math.floor(R()*lines.length)]; cars.push({l,s:R()*l.len,dir:R()<.5?1:-1,v:8+R()*6});} }
function stepCars(now,dt){ if(!cars.length||!$('tCars').checked||S.tab==='safety') return; const f=[],r=rp();
  for(const c of cars){ const p=along(c.l,c.s),cl=cellAt(p),stuck=cl&&nowDepth(cl,r)>CAR_DEPTH;
    if(!stuck&&!reduce){ c.s+=c.dir*c.v*5*dt; if(c.s<0||c.s>c.l.len){c.dir*=-1; c.s=Math.max(0,Math.min(c.l.len,c.s));} } // moves 5× faster than real
    f.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{k:stuck?1:0}}); }
  map.getSource('cars').setData({type:'FeatureCollection',features:f}); }
FX.push(stepCars);
['tRiv','tRoad','tTree','tOsmB','tNames','tPeople','tCars','tCols','tPlaces','tZones'].forEach(id=>$(id).onchange=()=>{applyLayers(); drawLegend();});
