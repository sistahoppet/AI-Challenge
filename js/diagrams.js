// diagrams.js - Diagram studio for research: 4 charts as SVG, download as PNG / SVG / CSV.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

/* ---------- diagrams (for research; downloadable) ---------- */
const DIAGS=[
  {k:'size',t:'People & buildings per flood size',s:'How exposure grows from frequent to extreme floods, with the real 2021 flood for reference.',metric:true},
  {k:'depth',t:'How deep is the water?',s:'People or buildings by water depth, for the flood size you picked.',metric:true},
  {k:'zones',t:'Safety zones share',s:'Share of residents and buildings in red, yellow and green zones.',metric:false},
  {k:'agree',t:'Model vs the real 2021 flood',s:'Area flooded in both, only on the hazard map, or only in 2021.',metric:false}];
function drawDList(){ $('dlist').innerHTML=DIAGS.map(d=>`<button data-k="${d.k}" aria-pressed="${S.diag===d.k}"><b>${d.t}</b><span>${d.s}</span></button>`).join(''); }
$('dlist').onclick=e=>{const b=e.target.closest('button'); if(!b) return; S.diag=b.dataset.k; drawDList(); drawDiagram();};
$('metricSeg').onclick=e=>{const b=e.target.closest('button'); if(!b) return; S.metric=b.dataset.m; $('metricSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); drawDiagram();};
let current=null;
function chartData(){
  const M=S.metric,ml=M==='people'?'Residents':'Buildings',src=isDemo?'DEMO DATA (synthetic) — not real figures':'Sources: EFAS flood hazard maps, GHS-POP, GHS-OBAT, Copernicus EMS (EMSR517/518/520)';
  if(S.diag==='size'){ const rows=D.rps.map(r=>({label:`${sizeWord(r)} (1-in-${r})`,value:peak(r)[M],color:css('--c-mod')}));
    if(D.hasObs) rows.push({label:'Real flood, July 2021',value:peak('obs')[M],color:css('--c-obs')});
    return {kind:'bar',title:`${ml} in flooded areas, by flood size`,sub:'At peak water level. 2021 = inside the satellite flood outline.',rows,src,
      csv:[['flood_size','return_period_years','residents','buildings','area_km2'],...D.rps.map(r=>[sizeWord(r),r,Math.round(peak(r).people),peak(r).bld,peak(r).area.toFixed(3)]),...(D.hasObs?[['July 2021 observed','',Math.round(peak('obs').people),peak('obs').bld,peak('obs').area.toFixed(3)]]:[])]};}
  if(S.diag==='depth'){ const r=rp(),cc=peak(r).cc,cols=['--w1','--w2','--w3'];
    return {kind:'bar',title:`${ml} by water depth — ${sizeWord(r).toLowerCase()} flood (1-in-${r})`,sub:'At peak water level.',src,
      rows:CLASSES.map((c,k)=>({label:c.name,value:cc[k][M],color:css(cols[k])})),
      csv:[['depth_class','residents','buildings','area_km2'],...CLASSES.map((c,k)=>[c.name,Math.round(cc[k].people),cc[k].bld,(cc[k].area/1e6).toFixed(3)])]};}
  if(S.diag==='zones'){ const z=D.zoneTot,names=['Green: safer','Yellow: caution','Red: high risk'],cols=['--zg','--zy','--zr'],tot=k=>z.reduce((s,x)=>s+x[k],0)||1;
    const order=[2,1,0];
    return {kind:'stack',title:'Share in each safety zone',sub:`Red = floods in 1-in-${D.zoneRule.lo}, or over 1.5 m in 1-in-${D.zoneRule.mid}. Yellow = floods in rarer floods or in 2021. Green = always dry.`,src,
      legend:order.map(i=>({name:names[i],color:css(cols[i])})),
      rows:[['Residents','people'],['Buildings','bld']].map(([l,k])=>({label:l,parts:order.map(i=>({name:names[i],value:z[i][k]/tot(k)*100,raw:z[i][k],color:css(cols[i])}))})),pct:true,
      csv:[['zone','residents','buildings'],...order.map(i=>[names[i],Math.round(z[i].people),z[i].bld])]};}
  const names=['Flooded in both','Only on the hazard map','Only in 2021'],cols=['--c-both','--c-mod','--c-obs'];
  if(!D.hasObs) return {kind:'empty',title:'Model vs the real 2021 flood',sub:'Load the 2021 flood file (Copernicus EMS) to draw this diagram.',src,csv:[['note'],['no 2021 file loaded']]};
  return {kind:'stack',title:'Hazard map vs the real 2021 flood (area, km²)',sub:'How much of each flood-size map overlaps the satellite outline of July 2021.',src,
    legend:names.map((n,i)=>({name:n,color:css(cols[i])})),
    rows:D.rps.map(r=>{const a=agreeStats(r);return {label:`${sizeWord(r)} (1-in-${r})`,parts:[a.both,a.mod,a.obs].map((v,i)=>({name:names[i],value:v,raw:v,color:css(cols[i])}))};}),
    csv:[['flood_size','return_period_years','both_km2','model_only_km2','2021_only_km2'],...D.rps.map(r=>{const a=agreeStats(r);return [sizeWord(r),r,a.both.toFixed(3),a.mod.toFixed(3),a.obs.toFixed(3)];})]};
}
function roundedBar(x,y,w,h,rL,rR){ rL=Math.min(rL,w/2,h/2); rR=Math.min(rR,w/2,h/2);
  return `M${x+rL},${y}H${x+w-rR}${rR?`Q${x+w},${y} ${x+w},${y+rR}`:''}V${y+h-rR}${rR?`Q${x+w},${y+h} ${x+w-rR},${y+h}`:''}H${x+rL}${rL?`Q${x},${y+h} ${x},${y+h-rL}`:''}V${y+rL}${rL?`Q${x},${y} ${x+rL},${y}`:''}Z`; }
function niceMax(v){ if(v<=0) return 1; const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p; return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
function buildSvg(c){
  const W=760,F='Arial, Helvetica, sans-serif',ink=css('--ink'),muted=css('--muted'),line=css('--line'),bg=css('--surface');
  const LW=200,X0=LW+16,X1=W-80,top=96,rh=46,bh=22; const n=c.rows?.length||0,legendH=c.legend?30:0,H=top+legendH+n*rh+70;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${F}" role="img" aria-label="${esc(c.title)}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <text x="24" y="40" font-size="22" font-weight="700" fill="${ink}">${esc(c.title)}</text>
  <text x="24" y="64" font-size="13" fill="${muted}">${esc(c.sub)}</text>`;
  if(c.kind==='empty') return s+`<text x="24" y="${top+20}" font-size="15" fill="${ink}">No data yet.</text></svg>`;
  let y=top;
  if(c.legend){ let lx=X0; c.legend.forEach(l=>{s+=`<rect x="${lx}" y="${y}" width="12" height="12" rx="2" fill="${l.color}"/><text x="${lx+18}" y="${y+11}" font-size="13" fill="${ink}">${esc(l.name)}</text>`; lx+=18+l.name.length*7.2+22;}); y+=legendH; }
  if(c.kind==='bar'){ const max=niceMax(Math.max(...c.rows.map(r=>r.value))),sx=v=>X0+(X1-X0)*v/max;
    for(let i=0;i<=4;i++){const v=max*i/4,x=sx(v); s+=`<line x1="${x}" x2="${x}" y1="${y-6}" y2="${y+n*rh}" stroke="${line}" stroke-width="1"/><text x="${x}" y="${y+n*rh+18}" font-size="12" fill="${muted}" text-anchor="middle">${fmtFull(v)}</text>`;}
    c.rows.forEach((r,i)=>{const yy=y+i*rh+(rh-bh)/2,w=Math.max(2,sx(r.value)-X0);
      s+=`<text x="${LW}" y="${yy+bh/2+5}" font-size="14" fill="${ink}" text-anchor="end">${esc(r.label)}</text>
      <path d="${roundedBar(X0,yy,w,bh,0,4)}" fill="${r.color}"><title>${esc(r.label)}: ${fmtFull(r.value)}</title></path>
      <text x="${X0+w+6}" y="${yy+bh/2+5}" font-size="13" font-weight="700" fill="${ink}">${fmtFull(r.value)}</text>`;});
  } else {
    const max=c.pct?100:niceMax(Math.max(...c.rows.map(r=>r.parts.reduce((a,p)=>a+p.value,0)))),sx=v=>(X1-X0)*v/max;
    for(let i=0;i<=4;i++){const v=max*i/4,x=X0+sx(v); s+=`<line x1="${x}" x2="${x}" y1="${y-6}" y2="${y+n*rh}" stroke="${line}"/><text x="${x}" y="${y+n*rh+18}" font-size="12" fill="${muted}" text-anchor="middle">${c.pct?Math.round(v)+'%':v.toFixed(v<10?1:0)}</text>`;}
    c.rows.forEach((r,i)=>{const yy=y+i*rh+(rh-bh)/2; let x=X0; const vis=r.parts.filter(p=>p.value>0);
      s+=`<text x="${LW}" y="${yy+bh/2+5}" font-size="14" fill="${ink}" text-anchor="end">${esc(r.label)}</text>`;
      vis.forEach((p,j)=>{const w=Math.max(1,sx(p.value)-(j<vis.length-1?2:0)),lab=c.pct?`${p.value.toFixed(0)}%`:p.value.toFixed(2);
        s+=`<path d="${roundedBar(x,yy,w,bh,j===0?4:0,j===vis.length-1?4:0)}" fill="${p.color}"><title>${esc(r.label)} · ${esc(p.name)}: ${c.pct?fmtFull(p.raw)+' ('+lab+')':lab+' km²'}</title></path>`;
        if(w>34) s+=`<text x="${x+w/2}" y="${yy+bh/2+5}" font-size="12" font-weight="700" fill="${p.color===css('--zy')?'#2a2300':'#ffffff'}" text-anchor="middle">${lab}</text>`;
        x+=sx(p.value);});});
  }
  s+=`<text x="24" y="${H-16}" font-size="11.5" fill="${muted}">${esc(c.src)} · Flood Scenario Explorer</text></svg>`;
  return s;
}
function drawDiagram(){ if(!D) return; drawDList(); const d=DIAGS.find(x=>x.k===S.diag); $('stageTitle').textContent=d.t; $('metricSeg').hidden=!d.metric;
  current=chartData(); $('chartbox').innerHTML=buildSvg(current); }
const fileBase=()=>`flood-${S.diag}${DIAGS.find(x=>x.k===S.diag).metric?'-'+S.metric:''}${S.diag==='depth'?'-rp'+rp():''}${isDemo?'-DEMO':''}`;
async function saveFile(filename,data){
  try{ if(window.claude?.use){ const dl=await window.claude.use('downloads'); if(dl){ await dl.save({filename,data}); toast('Saved '+filename); return; } } }
  catch(e){ if(e?.code==='declined'){toast('Download cancelled'); return;} if(e?.code==='rate_limited'){toast('A download is already waiting for your OK'); return;} }
  const blob=data instanceof Blob?data:new Blob([data],{type:'application/octet-stream'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); toast('Downloading '+filename);
}
$('dlSvg').onclick=()=>saveFile(fileBase()+'.svg',buildSvg(current));
$('dlCsv').onclick=()=>saveFile(fileBase()+'.csv',current.csv.map(r=>r.map(v=>/[",;]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n'));
$('dlPng').onclick=()=>{ const svg=buildSvg(current),img=new Image(),m=svg.match(/viewBox="0 0 (\d+) (\d+)"/),W=+m[1],H=+m[2];
  img.onload=()=>{const cv=document.createElement('canvas'); cv.width=W*2; cv.height=H*2; const g=cv.getContext('2d'); g.scale(2,2); g.drawImage(img,0,0);
    cv.toBlob(b=>b?saveFile(fileBase()+'.png',b):toast('Could not make the image'),'image/png');};
  img.onerror=()=>toast('Could not make the image'); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); };
