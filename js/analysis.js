// analysis.js - All the numbers: safety zones, safest places, app state, flood exposure per water level.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- regular grid: find the cell under any point, neighbours for routing ---------- */
function buildGrid(D){
  const bx=D.cells.map(c=>bboxOf([c.ring])),w=median(bx.map(b=>b[2]-b[0]))||1e-3,h=median(bx.map(b=>b[3]-b[1]))||1e-3;
  const [x0,y0,x1,y1]=D.bbox,nx=Math.max(1,Math.round((x1-x0)/w)),ny=Math.max(1,Math.round((y1-y0)/h)),idx=new Int32Array(nx*ny).fill(-1);
  // cells from the API are slightly skewed squares: when a slot is taken, use the free neighbour on the side the centre leans to
  D.cells.forEach((c,i)=>{const fx=(c.c[0]-x0)/w,fy=(c.c[1]-y0)/h; c.gx=Math.min(nx-1,Math.floor(fx)); c.gy=Math.min(ny-1,Math.floor(fy));
    if(idx[c.gy*nx+c.gx]>=0){const sx=fx-c.gx<.5?-1:1,sy=fy-c.gy<.5?-1:1;
      for(const [dx,dy] of [[sx,0],[0,sy],[sx,sy],[-sx,0],[0,-sy]]){const x=c.gx+dx,y=c.gy+dy; if(x>=0&&y>=0&&x<nx&&y<ny&&idx[y*nx+x]<0){c.gx=x;c.gy=y;break;}}}
    idx[c.gy*nx+c.gx]=i;});
  D.G={x0,y0,w,h,nx,ny,idx,m:w*111320*Math.cos(y0*Math.PI/180),
    at:(x,y)=>{const ix=Math.floor((x-x0)/w),iy=Math.floor((y-y0)/h); return ix<0||iy<0||ix>=nx||iy>=ny?-1:idx[iy*nx+ix];}};
  D.dmax={}; D.rps.forEach(r=>D.dmax[r]=maxDepth(r));
  stageModel(D);
}
/* ---------- how the water arrives (video) ----------
   Each valley section fills from its riverbed: L = deepest water within ~250 m (the channel); a cell gets water once the local
   level has risen by (L − its own depth), so its depth at a moment = depth − (1 − rise) × L, and at the peak it equals the EFAS depth.
   Upstream sections rise first: delay ∝ how far down the channel is (ground height of the lowest flooded cell nearby, Copernicus DEM).
   The order follows the terrain; the timing itself is illustrative (no hydraulic model). */
const LAG_MAX=.15; // share of the video by which the most downstream section rises after the most upstream one
function stageModel(D){ const G=D.G,kx=Math.max(1,Math.round(250/G.m)),ky=Math.max(1,Math.round(250/(G.h*110540))),hasZ=D.cells.some(c=>c.elev!=null);
  const wetC=D.cells.map(c=>D.rps.some(r=>c.depth[r]>0)); // dry neighbours change neither L nor the riverbed height
  D.cells.forEach(c=>{ c.L={}; D.rps.forEach(r=>c.L[r]=c.depth[r]); c.ech=c.elev;
    for(let dy=-ky;dy<=ky;dy++) for(let dx=-kx;dx<=kx;dx++){ const x=c.gx+dx,y=c.gy+dy; if(x<0||y<0||x>=G.nx||y>=G.ny) continue; const j=G.idx[y*G.nx+x]; if(j<0||!wetC[j]) continue; const o=D.cells[j];
      for(const r of D.rps) if(o.depth[r]>c.L[r]) c.L[r]=o.depth[r]; if(hasZ&&o.elev!=null&&(c.ech==null||o.elev<c.ech)) c.ech=o.elev; } });
  const wz=D.cells.filter(c=>c.ech!=null&&D.rps.some(r=>c.depth[r]>0)).map(c=>c.ech),hi=wz.length?Math.max(...wz):0,lo=wz.length?Math.min(...wz):0;
  D.cells.forEach(c=>c.lag=hasZ&&hi>lo&&c.ech!=null?LAG_MAX*Math.min(1,Math.max(0,(hi-c.ech)/(hi-lo))):0);
  D.hasTerrain=hasZ; }
function nowDepth(c,r,T=S.T){ const d=c.depth[r]; if(!d) return 0; return Math.max(0,d-(1-level(T-c.lag))*c.L[r]); }
// moment (0..1 of the video) when the cell starts to get water: used for evacuation waves
function floodStart(c,r){ const d=c.depth[r]; if(!d) return Infinity; const v=1-d/c.L[r]; return c.lag+.45*Math.acos(1-2*v)/Math.PI; }
const KX=y=>111320*Math.cos(y*Math.PI/180);
function mDist(a,b){return Math.hypot((a[0]-b[0])*KX(a[1]),(a[1]-b[1])*110540);}

/* ---------- safety zones + safest places ---------- */
function computeZones(D){
  buildGrid(D);
  const lo=D.rps[0],mid=D.rps.includes(100)?100:D.rps[Math.floor(D.rps.length/2)]; D.zoneRule={lo,mid};
  D.cells.forEach(c=>{const any=D.rps.some(rp=>c.depth[rp]>0); c.z=(c.depth[lo]>0||c.depth[mid]>1.5)?3:(any||c.obs)?2:1;});
  const lat0=D.cells[0]?.c[1]||50,kx=111320*Math.cos(lat0*Math.PI/180),ky=110540,dist=(a,b)=>Math.hypot((a[0]-b[0])*kx,(a[1]-b[1])*ky);
  const wet=D.cells.filter(c=>c.z>1),red=D.cells.filter(c=>c.z===3),bCount=new Map();
  D.blds.forEach(b=>{if(b.ci>=0) bCount.set(b.ci,(bCount.get(b.ci)||0)+1);});
  // red cells in 1 km buckets: the people-nearby sum only looks at the 3×3 buckets around a cell; the exact distance to water
  // is then measured only for cells that have red cells nearby
  const bk=(x,y)=>Math.floor(x*kx/1000)+','+Math.floor(y*ky/1000),redB=new Map();
  red.forEach(r=>{const k=bk(r.c[0],r.c[1]); if(!redB.has(k)) redB.set(k,[]); redB.get(k).push(r);});
  // exact distance to the nearest wet cell: 250 m buckets searched ring by ring until no closer cell can exist
  const WB=250,wetB=new Map(),wk=(x,y)=>x+','+y;
  wet.forEach(w=>{const k=wk(Math.floor(w.c[0]*kx/WB),Math.floor(w.c[1]*ky/WB)); if(!wetB.has(k)) wetB.set(k,[]); wetB.get(k).push(w);});
  const nearestWet=p=>{ if(!wet.length) return Infinity; const bx=Math.floor(p[0]*kx/WB),by=Math.floor(p[1]*ky/WB); let best=Infinity;
    for(let r=0;(r-1)*WB<best;r++){ for(let dx=-r;dx<=r;dx++) for(let dy=-r;dy<=r;dy++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
      for(const w of wetB.get(wk(bx+dx,by+dy))||[]){const d=dist(p,w.c); if(d<best) best=d;} } } return best; };
  const cand=[]; D.cells.forEach((c,i)=>{if(c.z!==1||!bCount.get(i)) return;
    const bx=Math.floor(c.c[0]*kx/1000),by=Math.floor(c.c[1]*ky/1000); let near=0;
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(const r of redB.get((bx+dx)+','+(by+dy))||[]) if(dist(c.c,r.c)<=1000) near+=r.pop;
    if(!(near>0)) return; const dmin=nearestWet(c.c); if(dmin<150) return;
    cand.push({i,c:c.c,b:bCount.get(i),dmin,near});});
  cand.sort((a,b)=>b.near-a.near); const pick=[]; for(const k of cand){if(pick.every(p=>dist(p.c,k.c)>500)) pick.push(k); if(pick.length===5) break;}
  D.safe=pick;
  D.zoneTot=[1,2,3].map(z=>({people:D.cells.filter(c=>c.z===z).reduce((s,c)=>s+c.pop,0),bld:D.blds.filter(b=>b.ci>=0&&D.cells[b.ci].z===z).length}));
}

/* ---------- state ---------- */
let D=null,isDemo=true;
const S={sizeIdx:1,T:0.5,playing:false,speed:1,exag:1,mode:'2d',l3d:false,lift:0,tab:'sim',diag:'size',metric:'people',basemap:'detail',cmp:'both'};
let cellFC,bldFC,map,ready=false,markers=[],peakCache={};
const rp=()=>D.rps[S.sizeIdx];
function level(T){return T<=0?0:T<0.45?(1-Math.cos(Math.PI*T/0.45))/2:T<0.6?1:Math.max(0,1-(T-0.6)/0.4);} // 0..1 share of the local peak
function maxDepth(r){let m=0;for(const c of D.cells) if(c.depth[r]>m) m=c.depth[r];return m;}
function exposure(r,now){ // now: water at the video's moment; otherwise at the peak
  const cc=[0,0,0].map(()=>({people:0,bld:0,area:0})),disp=D.cells.map(c=>now?nowDepth(c,r):c.depth[r]); let people=0,area=0,bld=0;
  D.cells.forEach((c,i)=>{const d=disp[i]; if(d>0.01){people+=c.pop;area+=c.area;const k=cls(d);cc[k].people+=c.pop;cc[k].area+=c.area;}});
  const bcls=D.blds.map(b=>{if(b.ci<0) return 0; const d=disp[b.ci]; return d>0.01?cls(d)+1:0;});
  bcls.forEach(k=>{if(k){bld++;cc[k-1].bld++;}}); return {people,bld,area:area/1e6,cc,disp,bcls};
}
function peak(r){const k=String(r); if(!peakCache[k]){
  if(r==='obs'){let people=0,area=0; D.cells.forEach(c=>{if(c.obs){people+=c.pop;area+=c.area;}}); peakCache[k]={people,bld:D.blds.filter(b=>b.obs).length,area:area/1e6};}
  else {const e=exposure(r,false); peakCache[k]={people:e.people,bld:e.bld,area:e.area,cc:e.cc};}} return peakCache[k];}
function sizeWord(r){return r<=30?'Frequent':r<=150?'Rare':r<=300?'Very rare':'Extreme';}
function chance(r){const p=100/r; return p>=1?`${Math.round(p)}%`:`${p.toFixed(1)}%`;}
