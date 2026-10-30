# Evacuation policy: what is real, what the app assumes

Researched on 30 Oct 2026 (web search by AI; **check each number at the source before quoting**).
Labels: [OFF] official · [LIT] peer-reviewed · [NEWS] press · [PROXY] other country/hazard · [AS] our assumption.
Complements the team's Drive doc "Policies since the flood 2021" (2021 problems, what was done since).

## 1. Who decides an evacuation today
- **Belgium**: Royal Decree of 22 May 2019 on emergency planning. Municipal phase = mayor, provincial phase = governor,
  federal phase = Interior Minister. Five disciplines (fire, medical, police, Civil Protection/logistics, information).
  Each municipality has a general plan (PGUI) and may have risk-specific plans (PPUI). Overview: https://www.uvcw.be/focus/police/art-2292 [OFF]
- **Wallonia after 2021**: decree of 13/07/2023 on risk and crisis management (regional crisis plan, single contact point)
  https://wallex.wallonie.be/eli/loi-decret/2023/07/13/2023044777 [OFF]; Regional Crisis Management Plan 2025 [OFF];
  first regional flood plan, ~100 hydrometric stations, Schéma Vesdre finished (https://wallonie.be/fr/actualites/5-ans-apres-les-inondations-de-2021-ou-en-est) [OFF].
  Inquiry report with 161 recommendations: https://www.wallonie.be/sites/default/files/2022-11/Inondations%20rapport%20de%20la%20commission%20parlementaire.pdf [OFF]
- **Verviers flood evacuation plan (2023)**: based on the area flooded in 2021 (~4,600 people) instead of the hazard map
  (~30 homes in red zone); moving upstairs first, shelter for people with reduced mobility on ground floors;
  3 sectors × 200-bed reception centres; phase activated within 1 h of a major flood alert.
  https://www.lavenir.net/regions/verviers/2023/02/28/verviers-un-plan-daction-pour-etre-plus-efficace-en-cas-dinondations-video-4L3B7SAG4RFYBMIRN44M2FVBMM/ [NEWS]
- **Alerts**: BE-Alert (cell broadcast now in all four countries); new sirens in Limbourg (2025) and a mobile siren in Verviers (2025) [NEWS].
- **Dutch Limburg**: mayor orders, Veiligheidsregio Zuid-Limburg coordinates (not checked in the law). 2021: ~12,000 evacuated overnight
  along the Meuse; no crisis plan for small rivers (Geul, Gulp) per COT evaluation [NEWS].
- **Region Aachen / NRW**: districts and cities are disaster-protection authorities (BHKG, not checked). 2021: ~20% not warned,
  sirens reached 6.3% (HoWas2021 fact sheet, Uni Potsdam) [LIT].
- **Cross-border**: EMRIC (Euregio Meuse-Rhine services), EMfloodResilience project. **No formal agreement to shelter evacuees
  across the border was found** → supports our cross-border shelter angle.

## 2. July 2021 on the Vesdre (timeline, [OFF] inquiry report)
EFAS formal warning 13/07 · BE-Alert from 06:16 on 14/07 · red alert 09:27 · Vesdre in flood ~12:00 · first evacuation order
(Limbourg) 14:16 · general Vesdre evacuation order 17:57. → The lead time actually used was ~0–3 h; orders came after the water.

## 3. App parameters vs evidence
| Parameter | App now | Evidence | Status |
|---|---|---|---|
| Follow the order | 80% | 75.7% of advised residents left vs 18.9% without advice (Limburg 2021, Endendijk et al. 2023 [LIT]) | sourced, range 70–80% |
| Door-to-door | +10 pts | no study isolates it; advice of any kind 19%→76% [LIT] | [AS] – label it |
| Warning lead time | 180 min | 2021: ~0–3 h (timeline above) | test 0 / 180 / 360 |
| Car limit | 0.30 m | AIDR 2017 H1: ≤0.3 m and ≤2 m/s [OFF, PROXY] | sourced |
| Walker limit | 0.15 m | AIDR: ≤0.3 m generally safe; children/elderly unsafe >0.5 m or D×V>0.6 [OFF, PROXY] | conservative; could be 0.3 m |
| Shelter space | 3.5 m²/person | Sphere minimum (humanitarian, not a Belgian norm) | sourced, label |
| Share going to a public shelter | 100% (implicit) | ~4.5% to evacuation centres, 81% to family/friends (Limburg 2021 [LIT]); Verviers plans 600 beds for ~4,600 people | **biggest correction** |
| Squeeze in | +30% | none found | [AS] |
| Get ready / departure spread | 60 min / 2× | none found | [AS] |
| Driving speed / delay | 30 km/h / 15 min | none found | [AS] |
| Rescue | 60 people/h, +30 min, ×3 national | none found; 2021: 9 helicopters rescued 21 people, ~300 foreign rescuers [NEWS] | [AS] – ask the Liège rescue zone |

## 4. Upstairs ("vertical evacuation")
- Real policy uses it: Verviers plan puts moving upstairs first [NEWS]; Rhein & Kreibich 2025 (Ahr) and Thieken et al. 2026
  advise upper floors when leaving is too late; cellars are traps [LIT].
- But not safe near the riverbank: ~10 houses collapsed along the Vesdre in Pepinster on 15/07/2021 (L'Avenir); ~50 buildings to demolish
  (VRT, 30/07/2021); Pepinster 116 and Limbourg 78 buildings to demolish under the €25M buy-out (L'Avenir, 2022) [NEWS].
  Causes cited: buildings on river walls, debris jams at bridges, water height as main damage driver (ULiège, Rodríguez Castro et al. 2025 [LIT]).
- Data: EMSR518 (Belgium) has **no damage grading** (only EMSR517, Germany). No official map of demolished plots found.
  SPW layer "Zones inondées IDW – hauteur d'eau juillet 2021" exists (water depth from field surveys) [OFF].
- Deaths: 39 in Wallonia [OFF]; per-commune figures disagree between sources; no inside/outside split for Belgium.

## 5. Data to get to match real plans
1. Walloon flood hazard/risk maps (map service) · 2. Reception centres in the communes' PGUI/PPUI (usually not public: ask the
governor's emergency planning service) · 3. Hydrometric stations and alert thresholds · 4. Schéma Vesdre layers ·
5. SPW July 2021 water depth layer · 6. NL LIWO / NRW Hochwassergefahrenkarten.
