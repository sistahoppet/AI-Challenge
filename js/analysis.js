// analysis.js - All the numbers: safety zones, safest places, app state, flood exposure per water level.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- regular grid: find the cell under any point, neighbours for routing ---------- */
function buildGrid(D){
  const bx=D.cells.map(c=>bboxOf([c.ring])),w=median(bx.map(b=>b[2]-b[0]))||1e-3,h=median(bx.map(b=>b[3]-b[1]))||1e-3;
  const [x0,y0,x1,y1]=D.bbox,nx=Math.max(1,Math.round((x1-x0)/w)),ny=Math.max(1,Math.round((y1-y0)/h)),idx=new Int32Array(nx*ny).fill(-1);
  D.cells.forEach((c,i)=>{c.gx=Math.min(nx-1,Math.floor((c.c[0]-x0)/w)); c.gy=Math.min(ny-1,Math.floor((c.c[1]-y0)/h)); idx[c.gy*nx+c.gx]=i;});
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
let LAG_MAX=.15; // share of the video by which the most downstream section rises after the most upstream one (scenario "terrain slope" changes it)
let INIT=0;      // scenario: water already in the river at the start (m): low ground near the channel is wet from the first minute
function stageModel(D){ const G=D.G,kx=Math.max(1,Math.round(250/G.m)),ky=Math.max(1,Math.round(250/(G.h*110540))),hasZ=D.cells.some(c=>c.elev!=null);
  D.cells.forEach(c=>{ c.L={}; D.rps.forEach(r=>c.L[r]=c.depth[r]); c.ech=c.elev;
    for(let dy=-ky;dy<=ky;dy++) for(let dx=-kx;dx<=kx;dx++){ const x=c.gx+dx,y=c.gy+dy; if(x<0||y<0||x>=G.nx||y>=G.ny) continue; const j=G.idx[y*G.nx+x]; if(j<0) continue; const o=D.cells[j];
      D.rps.forEach(r=>{if(o.depth[r]>c.L[r]) c.L[r]=o.depth[r];}); if(hasZ&&o.elev!=null&&D.rps.some(r=>o.depth[r]>0)&&(c.ech==null||o.elev<c.ech)) c.ech=o.elev; } });
  const wz=D.cells.filter(c=>c.ech!=null&&D.rps.some(r=>c.depth[r]>0)).map(c=>c.ech),hi=wz.length?Math.max(...wz):0,lo=wz.length?Math.min(...wz):0;
  D.cells.forEach(c=>c.lag=hasZ&&hi>lo&&c.ech!=null?LAG_MAX*Math.min(1,Math.max(0,(hi-c.ech)/(hi-lo))):0);
  D.hasTerrain=hasZ; }
const riseAt=(c,r,T)=>Math.max(level(T-c.lag),Math.min(1,INIT/(c.L[r]||1)));
function nowDepth(c,r,T=S.T){ const d=c.depth[r]; if(!d) return 0; return Math.max(0,d-(1-riseAt(c,r,T))*c.L[r]); }
// moment (0..1 of the video) when the cell starts to get water: used for evacuation waves
function floodStart(c,r){ const d=c.depth[r]; if(!d) return Infinity; const v=1-d/c.L[r]; return c.lag+.45*Math.acos(1-2*v)/Math.PI; }
const KX=y=>111320*Math.cos(y*Math.PI/180);
function mDist(a,b){return Math.hypot((a[0]-b[0])*KX(a[1]),(a[1]-b[1])*110540);}

/* ---------- safety zones + safest places ---------- */
function computeZones(D){
  buildGrid(D);
  const R=D.base||D.rps,lo=R[0],mid=R.includes(100)?100:R[Math.floor(R.length/2)]; D.zoneRule={lo,mid}; // zones use the mapped flood sizes only, not a user scenario
  // one rule, from the EFAS maps only (EU Floods Directive probability classes + a depth limit for people):
  //  red    = under water already in the frequent flood (1-in-lo), or deeper than 1.5 m (over head height) in the 1-in-mid flood
  //  yellow = under water in the 1-in-mid flood (less than 1.5 m)
  //  green  = dry up to 1-in-mid (it may still flood in the extreme one: said in the reason). 2021 satellite outlines are shown apart.
  const top=R[R.length-1],m=v=>v.toFixed(1)+' m';
  D.cells.forEach(c=>{ const a=c.depth[lo]||0,b=c.depth[mid]||0,x=c.depth[top]||0;
    if(a>.01){ c.z=3; c.zr=`under water in the frequent flood (1-in-${lo}): ${m(a)}`; }
    else if(b>1.5){ c.z=3; c.zr=`${m(b)} of water in the 1-in-${mid} flood (over head height)`; }
    else if(b>.01){ c.z=2; c.zr=`${m(b)} of water in the 1-in-${mid} flood`; }
    else { c.z=1; c.zr=x>.01&&top!==mid?`dry up to 1-in-${mid}; ${m(x)} in the extreme 1-in-${top} flood`:'dry in every flood size'; } });
  const lat0=D.cells[0]?.c[1]||50,kx=111320*Math.cos(lat0*Math.PI/180),ky=110540,dist=(a,b)=>Math.hypot((a[0]-b[0])*kx,(a[1]-b[1])*ky);
  const wet=D.cells.filter(c=>c.z>1),red=D.cells.filter(c=>c.z===3),bCount=new Map();
  D.blds.forEach(b=>{if(b.ci>=0) bCount.set(b.ci,(bCount.get(b.ci)||0)+1);});
  const cand=[]; D.cells.forEach((c,i)=>{if(c.z!==1||!bCount.get(i)) return; let dmin=Infinity; for(const w of wet){const d=dist(c.c,w.c); if(d<dmin) dmin=d;}
    if(dmin<150) return; let near=0; for(const r of red) if(dist(c.c,r.c)<=1000) near+=r.pop; if(near>0) cand.push({i,c:c.c,b:bCount.get(i),dmin,near});});
  cand.sort((a,b)=>b.near-a.near); const pick=[]; for(const k of cand){if(pick.every(p=>dist(p.c,k.c)>500)) pick.push(k); if(pick.length===5) break;}
  D.safe=pick;
  D.zoneTot=[1,2,3].map(z=>({people:D.cells.filter(c=>c.z===z).reduce((s,c)=>s+c.pop,0),bld:D.blds.filter(b=>b.ci>=0&&D.cells[b.ci].z===z).length}));
}

/* ---------- riverbank homes: upstairs is unreliable there (houses collapsed along the Vesdre in July 2021) → evacuate early ----------
   Distance to the river line (data/rivers.geojson, OpenStreetMap) ≤ riverbankM (assumption, data/params.json);
   without that file: distance to the river channel cells (deepest water nearby in the most frequent flood), + half a cell. */
function riverbank(D){ const m=+(PARAMS.riverbankM?.value??50),pts=[];
  if(D.rivers?.length){ for(const l of D.rivers) for(let j=1;j<l.length;j++){ const a=l[j-1],b=l[j],n=Math.max(1,Math.ceil(mDist(a,b)/10)); for(let i=0;i<=n;i++) pts.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]); } D.bankSrc='rivers'; }
  else { const r=(D.base||D.rps)[0]; D.cells.forEach(c=>{ if(c.depth[r]>0&&c.depth[r]>=.9*c.L[r]) pts.push(c.c); }); D.bankSrc='channel proxy'; }
  const lim=D.bankSrc==='rivers'?m:m+D.G.m/2,kx=KX(D.bbox[1]),key=(x,y)=>Math.floor(x*kx/lim)+':'+Math.floor(y*110540/lim),bk=new Map();
  pts.forEach(p=>{ const k=key(p[0],p[1]); (bk.get(k)||bk.set(k,[]).get(k)).push(p); }); D.bankM=lim; D.bankN=0;
  for(const b of D.blds){ b.bank=false; const gx=Math.floor(b.c[0]*kx/lim),gy=Math.floor(b.c[1]*110540/lim);
    for(let dx=-1;dx<=1&&!b.bank;dx++) for(let dy=-1;dy<=1&&!b.bank;dy++) for(const p of bk.get((gx+dx)+':'+(gy+dy))||[]) if(mDist(b.c,p)<=lim){ b.bank=true; break; }
    if(b.bank) D.bankN++; } }

/* ---------- state ---------- */
let D=null,isDemo=true;
const S={sizeIdx:1,T:0.5,playing:false,speed:2,exag:1,mode:'2d',l3d:false,lift:0,tab:'sim',diag:'size',metric:'people',basemap:'detail',cmp:'both'};
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
