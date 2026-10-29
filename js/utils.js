// utils.js - Small helpers: DOM shortcuts, number formatting, geometry (areas, point-in-polygon, spatial index).
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = n => n >= 10000 ? Math.round(n/1000)+'k' : Math.round(n).toLocaleString('en');
const fmtFull = n => Math.round(n).toLocaleString('en');
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RP_RE = /^depth_rp(\d+)$/i;
const CLASSES = [{name:'Ankle to knee (< 0.5 m)',v:'--w1'},{name:'Knee to chest (0.5–1.5 m)',v:'--w2'},{name:'Over head height (> 1.5 m)',v:'--w3'}];
const cls = d => d < 0.5 ? 0 : d < 1.5 ? 1 : 2;
let toastT; function toast(m){const t=$('toast'); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2600);}

/* ---------- geometry helpers ---------- */
function ringArea(r){const lat0=r[0][1]*Math.PI/180,kx=111320*Math.cos(lat0),ky=110540;let a=0;
  for(let i=0,j=r.length-1;i<r.length;j=i++) a+=(r[j][0]*kx)*(r[i][1]*ky)-(r[i][0]*kx)*(r[j][1]*ky); return Math.abs(a/2);}
function pipRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];
  if(((yi>y)!==(yj>y))&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) ins=!ins;} return ins;}
function pipPoly(x,y,poly){if(!pipRing(x,y,poly[0])) return false; for(let k=1;k<poly.length;k++) if(pipRing(x,y,poly[k])) return false; return true;}
function polysOf(g){if(!g) return []; if(g.type==='Polygon') return [g.coordinates]; if(g.type==='MultiPolygon') return g.coordinates; return [];}
function bboxOf(list){let b=[180,90,-180,-90];for(const r of list)for(const p of r){if(p[0]<b[0])b[0]=p[0];if(p[1]<b[1])b[1]=p[1];if(p[0]>b[2])b[2]=p[0];if(p[1]>b[3])b[3]=p[1];}return b;}
function centroidOf(g){ if(g.type==='Point') return g.coordinates; const ps=polysOf(g); if(!ps.length) return null; const r=ps[0][0]; let x=0,y=0,n=r.length-1||1;
  for(let i=0;i<n;i++){x+=r[i][0];y+=r[i][1];} return [x/n,y/n];}
function median(a){const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]||0;}
function makeIndex(items,getBox){const boxes=items.map(getBox),w=boxes.length?Math.max(1e-4,median(boxes.map(b=>b[2]-b[0]))):0.01,map=new Map();
  boxes.forEach((b,i)=>{for(let gx=Math.floor(b[0]/w);gx<=Math.floor(b[2]/w);gx++)for(let gy=Math.floor(b[1]/w);gy<=Math.floor(b[3]/w);gy++){const k=gx+':'+gy;(map.get(k)||map.set(k,[]).get(k)).push(i);}});
  return {query:(x,y)=>map.get(Math.floor(x/w)+':'+Math.floor(y/w))||[]};}
