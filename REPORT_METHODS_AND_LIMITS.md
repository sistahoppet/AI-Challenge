# Report: methods and limits (moved out of the PDF)

The PDF report (js/report.js) is for the crisis coordinator, the mayors and their planning teams. This file holds the technical background that used to be printed at the end of the PDF.

## Methods
1. **Flood depth**: EFAS flood hazard maps (1-in-10/100/500 years) per grid cell. Other return periods are interpolated on the water level, log scale. A rain scenario becomes a return period with a Gumbel fit of 37 years of 48-hour rain (ERA5).
2. **Water over time** (illustrative):
   - Local level = peak × rise(T − lag).
   - Rise = (1 − cos(πT/0.45))/2 up to the peak (45% of the event), flat until 60%, then falling.
   - Lag: up to 15% of the event from upstream to downstream (Copernicus DEM).
3. **People**:
   - GHS-POP residents are spread over GHS-OBAT buildings and gathered in groups of about 400 m.
   - A group's water time is the median start of flooding for its residents.
   - A share of those who leave (public shelter share) needs a public shelter. The others go to family or friends.
4. **Evacuation**:
   - Warning time = water reaching the first homes − warning time.
   - Departures are spread over 2 × the time to get ready.
   - Cars drive on OpenStreetMap streets (Dijkstra) at the driving speed, plus a delay.
   - A car is stuck once the street water is above 0.3 m.
5. **Shelters**:
   - Candidates: OSM schools, sports and community halls outside every mapped flood, at least 150 m from water, with dry road access.
   - Ranking: people at risk within 1.5 km, capacity, height above the water and distance (equal weights).
   - Capacity: published, or floor area ÷ 3.5 m² (Sphere). Sites without a known capacity are not counted.
6. **At home**: a resident is "upstairs" if the building (GHS-OBAT height) is at least water + 3 m. Upstairs is a last resort, and these people count as *not yet evacuated*. Otherwise they are "trapped". Rescue serves the trapped and stuck at a fixed rate.
7. **Not yet evacuated at the peak** = trapped + stuck + without a shelter place + upstairs, at 60% of the event. The per-place table uses the same parts, so it adds up to the headline.
8. **Headline counts** (residents and buildings in the flood) come from `data/summary.json` (scripts/export_area.py) when it is served next to the app. Otherwise they are recomputed in the browser.
9. **Buildings section**: each GHS-OBAT building gets the depth of its grid cell. Classes: ≤0.3 m; 0.3 m to `dryProofMaxM`; up to `wetProofMaxM`; above that. Damage uses the JRC depth–damage curves (Huizinga 2017) × floor area, 2010 prices × 1.218 (HICP).
10. **Sensitivity (Annex B)**: one factor at a time. The ranges for the shelter share (`shelterShare.range`) and the rise time (`riseH.range`) are read from `data/params.json`.
11. **Cross-border sheltering**: recommended only when the run leaves people without a shelter place.

## Limits
- Not a forecast and not a count of casualties. Water timing is illustrative, and behaviour settings are assumptions (see `data/params.json`, field `status`).
- The scenario uses the EFAS 1-in-100-year map as a stand-in for July 2021. The July 2021 satellite outline (CEMS EMSR518) is not fully loaded, so the report does not compare with 2021.
- EFAS maps are about 90 m: small streams and blocked bridges are missing.
- Defences, rebuilt and demolished buildings since 2021 are not in the flood or building data. Section 6 lists them from desk research only.
- Study area: Belgian Vesdre only (Chaudfontaine – Verviers). Dutch Limburg, Region Aachen and the Meuse are not modelled.
- Places are OpenStreetMap localities, not municipalities.
- Shelter places are an upper bound: beds, sanitation and staff are not counted.
- Building counts: the depth-class table counts buildings in the browser (7,946 at 1-in-100). `summary.json` counts 7,962. The two codes match buildings to grid cells differently, and the gap is open until the pipeline exports one depth per building.
- With the default 21.6 h rise, warning time, time to get ready, driving speed, shelter places and shelter share do not change the result. Only the follow rate, rescue capacity and rise time do (Annex B).
- FEMA dry flood-proofing limit (0.9 m): to verify against Belgian or Walloon guidance.
