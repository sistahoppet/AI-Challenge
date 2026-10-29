// water.js - Smooth flowing water: the depth grid is smoothed into an image; water rises section by section and ripples run downhill.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- animation loop shared by water, cars and evacuees (~30 frames/s) ---------- */
const FX=[]; let fxLast=0;
function fxLoop(now){ requestAnimationFrame(fxLoop); if(document.hidden||!ready||!D||now-fxLast<33) return;
  const dt=Math.min(0.1,(now-fxLast)/1000); fxLast=now; FX.forEach(f=>{ try{ f(now,dt); }catch(e){ if(!f.err){ f.err=1; console.error(e); } } }); } // one failing animation must not stop the others (cars, people, water)
requestAnimationFrame(fxLoop);

/* ---------- smooth water image ---------- */
let WV=null;
function hexRgb(h){h=h.replace('#',''); if(h.length===3) h=[...h].map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
// colour per depth (0 → 3 m): light blue → mid blue at 1 m → dark blue from 2.5 m
function waterLut(){ const a=hexRgb(css('--w1')),b=hexRgb(css('--w2')),c=hexRgb(css('--w3')),lut=new Uint8Array(256*3);
  for(let i=0;i<256;i++){const d=i/255*3,[p,q,t]=d<1?[a,b,d]:[b,c,Math.min(1,(d-1)/1.5)]; for(let k=0;k<3;k++) lut[i*3+k]=p[k]+(q[k]-p[k])*t;} return lut;}
// tileable ripple texture (sum of waves), values 0..1
function rippleTex(){const N=256,t=new Float32Array(N*N),K=[[7,2,0],[-3,9,1.3],[11,-6,2.1],[4,13,.7],[-12,-5,3.3]];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s=0; for(const [a,b,f] of K) s+=Math.sin(2*Math.PI*(a*x+b*y)/N+f); t[y*N+x]=.5+s/10;} return t;}
function buildWater(){
  const G=D.G,k=Math.max(2,Math.min(14,Math.floor(480/Math.max(G.nx,G.ny)))),W=G.nx*k,H=G.ny*k,top=D.rps[D.rps.length-1];
  const field=f=>{const a=new Float32Array(G.nx*G.ny); for(let j=0;j<a.length;j++){const i=G.idx[j]; a[j]=i<0?0:f(D.cells[i]);} return a;};
  const at=(a,x,y)=>a[Math.max(0,Math.min(G.ny-1,y))*G.nx+Math.max(0,Math.min(G.nx-1,x))];
  const soften=a=>a.map((v,j)=>{const x=j%G.nx,y=(j/G.nx)|0; let s=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) s+=at(a,x+dx,y+dy)*(dx&&dy?1:dx||dy?2:4); return (v+s/16)/2;});
  const sm=t=>t*t*(3-2*t);
  // cell values → pixels (smoothstep-bilinear; canvas row 0 = north)
  const up=a=>{const o=new Float32Array(W*H); for(let py=0;py<H;py++){const gy=Math.max(0,Math.min(G.ny-1,(H-py-.5)/k-.5)),y0=Math.floor(gy),y1=Math.min(G.ny-1,y0+1),ty=sm(gy-y0);
    for(let px=0;px<W;px++){const gx=Math.max(0,Math.min(G.nx-1,(px+.5)/k-.5)),x0=Math.floor(gx),x1=Math.min(G.nx-1,x0+1),tx=sm(gx-x0),r0=y0*G.nx,r1=y1*G.nx;
      const v0=a[r0+x0]+(a[r0+x1]-a[r0+x0])*tx,v1=a[r1+x0]+(a[r1+x1]-a[r1+x0])*tx; o[py*W+px]=v0+(v1-v0)*ty;}} return o;};
  const dep={},Lm={}; D.rps.forEach(r=>{dep[r]=up(soften(field(c=>c.depth[r]))); Lm[r]=up(soften(field(c=>c.L[r])));});
  const lag=up(field(c=>c.lag)),lvl=new Float32Array(1201); for(let i=0;i<=1200;i++) lvl[i]=level(i/1000-.2); // rise per moment, table for speed
  // flow direction: downhill along the riverbed (Copernicus DEM, lowest flooded ground nearby) when terrain is loaded;
  // otherwise along the valley (perpendicular to the depth slope). The direction is real when terrain exists; the speed is visual only.
  const dt=field(c=>c.depth[top]),ech=D.hasTerrain?field(c=>c.ech??NaN):null; let sw=0,mx=0,my=0,cxx=0,cyy=0,cxy=0;
  dt.forEach((v,j)=>{if(v>0){sw+=v; mx+=v*(j%G.nx); my+=v*((j/G.nx)|0);}}); mx/=sw||1; my/=sw||1;
  dt.forEach((v,j)=>{if(v>0){const x=j%G.nx-mx,y=((j/G.nx)|0)-my; cxx+=v*x*x; cyy+=v*y*y; cxy+=v*x*y;}});
  const ang=.5*Math.atan2(2*cxy,cxx-cyy),ax=Math.cos(ang),ay=Math.sin(ang),fx=new Float32Array(dt.length),fy=new Float32Array(dt.length);
  dt.forEach((v,j)=>{const x=j%G.nx,y=(j/G.nx)|0,gx=(at(dt,x+1,y)-at(dt,x-1,y))/2,gy=(at(dt,x,y+1)-at(dt,x,y-1))/2;
    let px=-gy,py=gx; if(px*ax+py*ay<0){px=-px;py=-py;} const m=Math.hypot(px,py),wt=m/(m+.15);let vx=px/(m||1)*wt+ax*(1.3-wt),vy=py/(m||1)*wt+ay*(1.3-wt);
    if(ech&&isFinite(ech[j])){ const e=(a,b)=>{const v=at(ech,a,b); return isFinite(v)?v:ech[j];}, ex=(e(x+2,y)-e(x-2,y))/4,ey=(e(x,y+2)-e(x,y-2))/4,g=Math.hypot(ex,ey);
      if(g>.05){ vx=-ex/g; vy=-ey/g; if(px*vx+py*vy<0){px=-px;py=-py;} vx=vx*.6+px/(m||1)*.4; vy=vy*.6+py/(m||1)*.4; } } // downhill, kept along the valley
    const n=Math.hypot(vx,vy)||1; fx[j]=vx/n; fy[j]=vy/n;});
  const UX=up(fx),UY=up(fy),dTop=dep[top],wet=[]; for(let q=0;q<W*H;q++) if(dTop[q]>0.003) wet.push(q);
  const cv=WV?.cv||Object.assign(document.createElement('canvas'),{hidden:true}); if(!cv.isConnected) document.body.appendChild(cv);
  cv.width=W; cv.height=H; const ctx=cv.getContext('2d');
  WV={cv,ctx,img:ctx.createImageData(W,H),W,H,dep,Lm,lag,lvl,fx:UX,fy:UY,wet:Uint32Array.from(wet),lut:waterLut(),noise:WV?.noise||rippleTex(),
    sc:Math.max(.5,Math.min(3,G.m/k/2)),key:''};
  const x1=G.x0+G.nx*G.w,y1=G.y0+G.ny*G.h,coordinates=[[G.x0,y1],[x1,y1],[x1,G.y0],[G.x0,G.y0]];
  if(map.getLayer('water-img')) map.removeLayer('water-img'); if(map.getSource('water-img')) map.removeSource('water-img');
  map.addSource('water-img',{type:'canvas',canvas:cv,coordinates,animate:true});
  map.addLayer({id:'water-img',type:'raster',source:'water-img',paint:{'raster-fade-duration':0,'raster-resampling':'linear'}},'water-2d');
  paintWater(performance.now(),0,true);
}
function paintWater(now,_dt,force){
  if(!WV||S.tab==='safety') return; const r=rp(),key=r+':'+S.T.toFixed(4);
  if(reduce&&!force&&key===WV.key) return; WV.key=key; // reduced motion: only repaint when the water level changes
  const {img,fx,fy,wet,lut,noise,W,sc,lag,lvl}=WV,dep=WV.dep[r],Lm=WV.Lm[r],T=S.T,d=img.data,t=reduce?0:now/1000*.22,a=t%1,b=(t+.5)%1,bl=Math.abs(1-2*a),L=40;
  for(let n=0;n<wet.length;n++){ const q=wet[n],x0=T-lag[q],o=q*4,s=dep[q]-(1-Math.max(lvl[x0<=-.2?0:x0>=1?1200:((x0+.2)*1000)|0],Math.min(1,INIT/(Lm[q]||1))))*Lm[q]; if(s<=0.003){d[o+3]=0; continue;}
    // two ripple layers pushed along the flow, cross-faded so they never stretch
    const x=(q%W)*sc,y=((q/W)|0)*sc,sp=(.5+Math.min(1,s*.5))*L,ux=fx[q]*sp,uy=-fy[q]*sp;
    const n1=noise[((y-uy*a)&255)*256+((x-ux*a)&255)],n2=noise[((y-uy*b+97)&255)*256+((x-ux*b+53)&255)],rip=n1+(n2-n1)*bl;
    const li=(s>=3?255:(s*85)|0)*3,f=.75+rip*.5,fo=s<.15?(1-s/.15)*.55:0,g=1-fo,w=255*fo; // ripple light + white foam at the water's edge
    d[o]=lut[li]*f*g+w; d[o+1]=lut[li+1]*f*g+w; d[o+2]=lut[li+2]*f*g+w; d[o+3]=s>=.06?215:s*3583; }
  WV.ctx.putImageData(img,0,0);
}
FX.push(paintWater);

/* ---------- the drawn water as data: routes use exactly the water you see ---------- */
// pixel of the water image under a point (-1 outside)
function pixAt(p){ if(!WV) return -1; const G=D.G,k=WV.W/G.nx,px=Math.floor((p[0]-G.x0)/G.w*k),py=Math.floor((G.y0+G.ny*G.h-p[1])/G.h*k); return px<0||py<0||px>=WV.W||py>=WV.H?-1:py*WV.W+px; }
// water depth of that pixel at moment T (same formula as paintWater); peak=true: the flood's highest level
function pixDepth(q,r,T=S.T,peak=false){ if(q<0||!WV.dep[r]) return 0; const d=WV.dep[r][q]; if(!(d>0)) return 0; if(peak) return d;
  const L=WV.Lm[r][q]||d,x0=T-WV.lag[q],rise=Math.max(WV.lvl[x0<=-.2?0:x0>=1?1200:((x0+.2)*1000)|0],Math.min(1,INIT/L)); return Math.max(0,d-(1-rise)*L); }
// clock minute when the water at a pixel first exceeds F (inverse of the rise; Infinity if never)
function pixCut(q,r,F,M){ if(q<0||!WV.dep[r]) return Infinity; const d=WV.dep[r][q],L=WV.Lm[r][q]||d; if(!(d>F)) return Infinity; const v=1-(d-F)/L;
  if(INIT/L>=v) return 0; return (WV.lag[q]+.45*Math.acos(1-2*v)/Math.PI)*M; }
// pixels along a line from a to b, one sample per ~10 m
function pixLine(a,b){ const n=Math.max(1,Math.ceil(mDist(a,b)/10)),out=new Set(); for(let i=0;i<=n;i++){ const q=pixAt([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]); if(q>=0) out.add(q); } return [...out]; }
const ANY_WATER=.05; // safe A–B route: no street with visible water (≥ 5 cm) at that moment ("never drive or walk into flood water")
