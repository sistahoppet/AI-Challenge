// demo-data.js - Synthetic test data in the SAME format as the team files. Replace by loading real data.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- synthetic demo data (same format as the team files) ---------- */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeDemo(){
  const R=rng(2021),lon0=5.775,lat0=50.556,nx=44,ny=34,cm=100;
  const dLon=cm/(111320*Math.cos(lat0*Math.PI/180)),dLat=cm/110540;
  const riverY=x=>1700+520*Math.sin(x/900)+180*Math.sin(x/310+1);
  const towns=[{x:1200,y:2050,s:330,p:110},{x:3000,y:1350,s:420,p:90},{x:3900,y:2100,s:260,p:55}];
  const grid=[],STAGE={10:1.4,100:3.0,500:4.0};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const x=(i+.5)*cm,y=(j+.5)*cm,dist=Math.abs(y-riverY(x));
    const side=0.6*Math.sin(x/500+(y>riverY(x)?2:0));
    const elev=0.004*dist+3*(dist/600)**2+0.7*R()+side-0.3;
    const props={}; for(const rp in STAGE){const d=STAGE[rp]-Math.max(0,elev); props['depth_rp'+rp]=d>0.02?+d.toFixed(2):0;}
    let pop=1.5*R(); for(const t of towns){const r2=(x-t.x)**2+(y-t.y)**2; pop+=t.p*Math.exp(-r2/(2*t.s*t.s));}
    props.pop=Math.round(pop); const a=lon0+i*dLon,b=lat0+j*dLat;
    grid.push({type:'Feature',geometry:{type:'Polygon',coordinates:[[[a,b],[a+dLon,b],[a+dLon,b+dLat],[a,b+dLat],[a,b]]]},properties:props});
  }
  const up=[],dn=[]; for(let x=0;x<=nx*cm;x+=50){const w=230+120*Math.sin(x/700+.5)+40*Math.sin(x/170),ll=lon0+x/cm*dLon;
    up.push([ll,lat0+(riverY(x)+w)/cm*dLat]); dn.push([ll,lat0+(riverY(x)-w*0.85)/cm*dLat]);}
  const observed={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[...up,...dn.reverse(),up[0]]]},properties:{source:'synthetic'}}]};
  const bl=[]; grid.forEach(f=>{const n=Math.min(25,Math.round(f.properties.pop/2.3+(R()<.04?1:0))),c=f.geometry.coordinates[0][0];
    for(let k=0;k<n;k++) bl.push({type:'Feature',geometry:{type:'Point',coordinates:[c[0]+R()*dLon,c[1]+R()*dLat]},properties:{height:+(5+R()*10).toFixed(1)}});});
  return {grid:{type:'FeatureCollection',features:grid},observed,buildings:{type:'FeatureCollection',features:bl}};
}
