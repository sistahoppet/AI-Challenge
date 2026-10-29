// howto.js - "What to do": a 30-second animated explainer for residents (4 scenes, captions in EN/FR/NL/DE), drawn in SVG.
// Advice follows the usual public guidance (BE-Alert, 112, "turn around, don't drown"); no data from the challenge.
// Loaded as a classic script: top-level names are shared between files (order set in index.html).

const HOWTO={
  en:['Alert on your phone (BE-Alert): it says where your shelter is.','Take medicines, papers, charger and water. Check on neighbours who need help.','Drive to your shelter on dry roads. Never drive into water: 30 cm can float a car.','Water already in the street? Go upstairs, call 112 and wait for help.'],
  fr:['Alerte sur votre téléphone (BE-Alert) : elle indique votre abri.','Prenez médicaments, papiers, chargeur et eau. Aidez les voisins qui en ont besoin.','Roulez vers l\'abri par les routes sèches. N\'entrez jamais dans l\'eau : 30 cm suffisent à emporter une voiture.','L\'eau est déjà dans la rue ? Montez à l\'étage, appelez le 112 et attendez les secours.'],
  nl:['Alarm op je telefoon (BE-Alert): het zegt waar je opvangplaats is.','Neem medicijnen, papieren, oplader en water mee. Help buren die hulp nodig hebben.','Rijd via droge wegen naar de opvang. Rijd nooit het water in: 30 cm kan een auto meesleuren.','Staat het water al in de straat? Ga naar boven, bel 112 en wacht op hulp.'],
  de:['Warnung auf dem Handy (BE-Alert): sie nennt Ihre Notunterkunft.','Nehmen Sie Medikamente, Papiere, Ladegerät und Wasser mit. Helfen Sie Nachbarn.','Fahren Sie über trockene Straßen zur Unterkunft. Nie ins Wasser fahren: 30 cm können ein Auto mitreißen.','Wasser schon auf der Straße? Gehen Sie nach oben, rufen Sie 112 und warten Sie auf Hilfe.']};
// one scene per step: simple shapes in the app colours, animated with CSS (see .howto in style.css)
const HSC=[
  `<rect x="140" y="20" width="80" height="140" rx="12" class="hs-dev"/><rect x="150" y="38" width="60" height="100" rx="4" class="hs-scr"/><path d="M162 62h36l-18-18z" class="hs-warn"/><rect x="160" y="80" width="40" height="6" rx="3" class="hs-ink"/><rect x="160" y="94" width="30" height="6" rx="3" class="hs-ink"/><path d="M118 70q-10 20 0 40M102 60q-18 30 0 60M242 70q10 20 0 40M258 60q18 30 0 60" class="hs-wave hs-buzz"/>`,
  `<rect x="120" y="70" width="120" height="80" rx="10" class="hs-dev"/><path d="M155 70v-14h50v14" class="hs-line"/><rect x="134" y="90" width="22" height="30" rx="3" class="hs-shel hs-pop1"/><rect x="166" y="96" width="30" height="24" rx="3" class="hs-scr hs-pop2"/><rect x="206" y="88" width="16" height="32" rx="6" class="hs-water hs-pop3"/>`,
  `<rect x="0" y="140" width="360" height="40" class="hs-road"/><path d="M0 160h360" class="hs-dash"/><path d="M270 60l50 28v52h-100V88z" class="hs-shel"/><path d="M270 100v24M258 112h24" class="hs-plus"/><g class="hs-car"><rect x="20" y="122" width="70" height="22" rx="6" class="hs-carb"/><path d="M34 122l8-14h28l8 14z" class="hs-carb"/><circle cx="38" cy="146" r="7" class="hs-ink"/><circle cx="74" cy="146" r="7" class="hs-ink"/></g><path d="M120 176q15-10 30 0t30 0t30 0" class="hs-wave"/>`,
  `<path d="M180 30l80 50v90H100V80z" class="hs-dev"/><rect x="160" y="88" width="40" height="30" class="hs-scr"/><circle cx="180" cy="100" r="7" class="hs-ink"/><path d="M180 107v8" class="hs-line"/><rect x="0" y="130" width="360" height="50" class="hs-water hs-rise"/><text x="270" y="60" class="hs-112">112</text>`];
let htI=0,htT=null,htOn=false;
function drawHowTo(){ const box=$('howto'); if(!box||box.dataset.done) return; box.dataset.done=1;
  box.innerHTML=`<div class="htscreen"><svg viewBox="0 0 360 180" role="img" aria-label="What to do in a flood" id="htSvg"></svg><div class="htcap" id="htCap" aria-live="polite"></div>
    <div class="htbar"><span id="htProg"></span></div></div>
    <div class="row" style="justify-content:flex-start;margin-top:6px"><button class="btn sm primary" id="htPlay">▶ Play</button><button class="btn sm" id="htPrev" aria-label="Previous">‹</button><button class="btn sm" id="htNext" aria-label="Next">›</button>
    <select class="btn" id="htLang" aria-label="Language"><option value="en">English</option><option value="fr">Français</option><option value="nl">Nederlands</option><option value="de">Deutsch</option></select></div>`;
  $('htPlay').onclick=()=>{ htOn=!htOn; $('htPlay').textContent=htOn?'❚❚ Pause':'▶ Play'; if(htOn) htShow(htI); else clearTimeout(htT); };
  $('htPrev').onclick=()=>htShow((htI+3)%4); $('htNext').onclick=()=>htShow((htI+1)%4); $('htLang').onchange=()=>htShow(htI); htShow(0); }
function htShow(i){ htI=i; clearTimeout(htT); const L=$('htLang').value; $('htSvg').innerHTML=HSC[i]; $('htCap').innerHTML=`<b>${i+1}/4</b> ${HOWTO[L][i]}`;
  const p=$('htProg'); p.style.transition='none'; p.style.width=(i*25)+'%'; void p.offsetWidth; if(htOn){ p.style.transition='width 7.5s linear'; p.style.width=((i+1)*25)+'%'; htT=setTimeout(()=>htShow((i+1)%4),7500); } }
drawHowTo();
