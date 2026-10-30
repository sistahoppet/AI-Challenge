# Flood Scenario Explorer

Browser app for Anna, cross-border crisis coordinator: what would happen if the July 2021 flood came back to the
Vesdre valley (BE)? Water rising on real streets and buildings, who must leave, which shelters take them, cars
looking for the next shelter when one is full, the best sequence of actions, and a PDF report after each run.

European AI Challenge 2026 · Team project.

## Launch the app yourself

The app needs a small local web server (so it can read the `data/` folder). Pick one way.

### A. From the WSL / Ubuntu terminal (simplest)

```bash
cd "/root/ai challenge/flood-scenario-explorer-project"
python3 scripts/serve.py --port 8000
```

(Use this server, not `python3 -m http.server`: it tells the browser to always check for new files and compresses the
data 10×. With the plain server, Chrome can keep old copies of the code after an update and the app breaks.)

Then open **http://localhost:8000** in Chrome or Edge on Windows. Leave the terminal open; `Ctrl+C` stops it.
After changing a file, reload the page with **Ctrl+Shift+R**.

### B. From VS Code

1. In the WSL terminal: `code "/root/ai challenge/flood-scenario-explorer-project"` (opens the folder in VS Code).
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**. The page reloads by itself when you save a file.

### C. Without a server

Double-click `dist/flood-scenario-explorer.html`. It opens with demo data only: use **Load team data** to pick
the files in `data/` by hand.

**Needs internet** for the background maps, fonts and the map library (MapLibre). The flood data is local.

## Using it (1 minute)

1. **Guided demo** (top bar) walks through the story in 7 steps. **Explain** opens a menu with what every colour,
   counter and slider means.
2. Under the map: set the **flood**, how fast the **water rises**, the **warning** time, how many people **follow**
   the order, **shelter places**, **speed**, **rescue** capacity, and the 3 choices (order, shelter full, rescue).
   Every change puts the clock back to 0.
3. Press **▶** (speed ×0.1 to ×10). Cars drive to shelters; shelter pins fill up and turn red when full; the
   counters at the top show home / driving / sheltered / upstairs / danger / no place / rescued.
4. **Click a shelter pin**: the area it serves and why it was chosen. **Double-click the map** twice: safe route A → B.
5. At the end of the run: **PDF report** (Anna's 4 questions, shelters, towns, best actions, sensitivity, methods,
   run comparison) and **Data files** (CSV / GeoJSON / JSON). The **Report** button under the map does the same any time.
6. **Best actions** tests every combination of choices and shows the sequence that leaves the fewest people unsafe.
7. Policy tab: mayor's decision card, Q2 notes (your desk research, printed in the report), costs.

## Folder map

```
flood-scenario-explorer-project/
├── index.html            page layout (header, map, controls, tabs)
├── css/style.css         colours (variables at the top), fonts, layout
├── js/                   loaded in this order (see the <script> tags at the end of index.html)
│   ├── utils.js          helpers: formatting, geometry
│   ├── demo-data.js      synthetic test data (same format as the real files)
│   ├── data-loader.js    reads + checks the files, auto-loads data/
│   ├── analysis.js       exposure, safety zones (one rule, with the reason per cell), water over time
│   ├── map.js            map, layers, buildings (real outlines, type colours, 3D roofs, water around them), legend
│   ├── water.js          animated water image; the same water is used for closed streets and routes
│   ├── details.js        OpenStreetMap streets, people dots, closed streets
│   ├── evac.js           evacuation plan: groups, car routes, shelters (chosen by the app)
│   ├── respond.js        Alert tab: share files with emergency services, check a place
│   ├── places.js         hospitals, schools…; shelter scoring; safe route A → B (double-click)
│   ├── weather.js        rain records, July 2021 replay, live forecast
│   ├── impact.js         impact for the mayor
│   ├── response.js       emergency teams: nearest vs priority dispatch
│   ├── scenario.js       your own rain → flood size; event clock; alerts
│   ├── player.js         play / pause / speed (×0.1 → ×10) / loop
│   ├── camera.js         2D ↔ 3D, zoom, turn, tilt
│   ├── panels.js         tab contents, 2021 satellite check
│   ├── diagrams.js, figures.js, framework.js, costs.js   diagrams (PNG / SVG / CSV), costs, Anna's framework
│   ├── data-view.js      Data tab: every dataset, tables, CSV
│   ├── drill.js          evacuation over time: cars, shelters filling, next best shelter, best actions, controls bar
│   ├── brief.js          number sources (click a dotted number), decision card, guided demo
│   ├── howto.js          30-second "what to do" video (EN / FR / NL / DE)
│   ├── report.js         PDF report after each run, data files, sensitivity, run comparison
│   ├── ui.js, ux.js      folding sections, icons, tooltips, map toolbox
│   └── main.js           start-up
├── data/                 grid, buildings (+ real outlines), roads, places, towns, 2021 outline, rain
├── scripts/              how the data/ files were made (see below)
├── build.py              bundles the code into ONE html file → dist/
└── dist/                 output of build.py
├── data/                 put grid.geojson (+ observed_2021, buildings) here
├── scripts/
│   ├── colab_export_for_app.py   for the data person (Colab)
│   └── serve.py          server with gzip (data 21 MB → ~2 MB): python3 scripts/serve.py
├── build.py              bundles everything into ONE html file
└── dist/                 output of build.py (the file to submit)
```

## Remake the data files

Needs Python with `requests mapbox-vector-tile shapely pyproj` (and the challenge bucket for export_area.py).

| Script | Makes | Source |
|---|---|---|
| `scripts/export_area.py` | grid.geojson, buildings.geojson, observed_2021.geojson | EFAS, GHS-POP, GHS-OBAT, Copernicus EMS, DEM (challenge data) |
| `scripts/export_tiles.py` | places.geojson, roads.geojson | OpenStreetMap via OpenFreeMap tiles |
| `scripts/export_footprints.py` | buildings_fp.geojson (real building outlines) | OpenStreetMap tiles + GHS-OBAT |
| `scripts/export_towns.py` | towns.geojson (town and village names) | OpenStreetMap tiles |
| `scripts/export_weather.py` | weather.json (rain records, July 2021) | Open-Meteo / ERA5 |

## Switch area or town

- **Town of the loaded area**: the menu next to *TEAM DATA* lists the towns with residents in the water. Choosing one frames it
  (the rest is dimmed); the simulation still covers the whole valley, because the water comes from upstream.
- **Another area** (another city in BE / DE / NL): the data team exports the same files into `data/cities/<name>/`
  (grid, buildings or buildings_fp, observed_2021, places, roads, towns, weather.json) and lists it in `data/cities/index.json`:

```json
[{"name": "Bad Neuenahr-Ahrweiler (DE)", "dir": "cities/ahrweiler"}]
```

  It then appears under *Other areas* in the menu (the page reloads with `?area=cities/<name>`).

## All July 2021 areas from the team server

The **📍 Area** menu lists two kinds of areas:

- **Areas with full detail**: the Vesdre and the Ahr, exported to `data/` (buildings, roads, shelters with capacity, towns, rain).
- **All 19 areas mapped by satellite in July 2021** (Copernicus EMS: 2 BE, 16 DE, 1 NL), straight from the team flood API.
  Choosing one reloads the page with `?aoi=<code>`, and the app then fetches:
  1. `POST /flood` on the area code: flood and evacuation model (people flooded or cut off, buildings, roads closed), 3 flood sizes;
  2. the box of the 1 km cells it returns, then `POST /region` on that box: 100 m cells with EFAS water depth (1-in-10/100/500),
     GHS-POP residents, ground height and terrain risk, plus hospitals, fire stations, police and shelters (OpenStreetMap);
  3. the same results go to the Live model tab and the policy advice.
  When the server cannot run the whole area (bigger than 3000 km², partly outside its study region, or a server error), the app
  takes the largest box around the most affected 1 km cell that the server accepts (20 → 3 km) and says so ("part", and on the
  Data sources page).
  Town names come from the OpenStreetMap labels of the background map inside the area; the area is named after the city or town
  with most residents in the water. The **Zoom to a town** list shows every town and village, most residents in water first.

**What the server does not send stays empty** (no invented data): building outlines and heights, roads for car routes,
shelter sizes, town names. So for these areas the car drill has no shelter capacity: use the Vesdre or the Ahr for the full drill.

**For the jury:** the **Data sources** button (next to the area menu) opens a page listing every layer and number of the loaded area,
its dataset, its limits and where the app gets it, plus the server's results and stated limits for that area. The synthetic demo
data only builds the map while the real data loads; it is covered and never shown as a result.

## Live model tab (team server)

The tab talks to two public HTTPS APIs on the team server, no Tailscale needed:

- **Flood models** `https://dev.nsrddyn.com/api` ([flood_api](https://github.com/nasrlol/eu-ai-challange)): flood risk, evacuation, timeline,
  area check, "am I in danger", help a friend, 2021 building damage, model checks.
- **Policy advisor** `https://dev.nsrddyn.com/policy` ([flood-policy-advisor](https://github.com/nasrlol/flood-policy-advisor)): picks and orders
  policies from the team catalogue, citing the model numbers. **Run all models + advice** runs sections 2–5 on the chosen area, then asks it.
  Every answer shows the facts sent, the rules that fired and the model limits; the full catalogue is listed under the button.

Other address: `?api=…&policy=…` in the page URL, or the field in the tab.

## Hide the panels

**Hide UI** (or key **H**) keeps only the map and the play bar. The small **›** tab on the right edge of the map folds the side
panel; **Controls ▴ / ▾** folds the bar under the map (folded by default on small screens).

## Make the single file

```bash
python3 build.py
```
→ `dist/flood-scenario-explorer.html`.

## CI/CD

- **CI** (`.github/workflows/ci.yml`, every PR and push to `main`): JS syntax (`node --check`), Python compiles,
  `scripts/ci_check.py` (every `<script>`/css in `index.html` exists, every `js/*.js` is loaded, data JSON parses,
  warning when `dist/` is out of date), smoke test (`serve.py` serves every asset with 200).
- **CD**: when CI is green on `main`, the workflow moves branch `live` to that commit. The server (valencia) pulls
  `live` every minute (`deploy/deploy.sh`, systemd `frontend-deploy.timer`), and the `verify` job waits until
  https://dev.nsrddyn.com serves the new files. A red `main` never goes live. Roll back: push an older commit to `live`.
- Server setup (once): `cd ~/frontend && git fetch origin live && git checkout -B live FETCH_HEAD`, then
  `sudo cp deploy/frontend-deploy.{service,timer} /etc/systemd/system/ && sudo systemctl enable --now frontend-deploy.timer`.
  Log: `journalctl -u frontend-deploy`.

## Where to change things

| I want to… | File |
|---|---|
| colours or fonts | `css/style.css` (top) |
| safety-zone rule (red / yellow / green) | `js/analysis.js` → `computeZones` |
| shelter choice (distance, capacity, height…) | `js/places.js` → `shelterCandidates`, `pickShelters` |
| evacuation model (speeds, rescue, "unsafe") | `js/drill.js` (comments at the top) |
| report content | `js/report.js` → `openReport` |
| sliders and choices under the map | `js/drill.js` → `DOCK`, `CHOICES` |

## Data honesty

- Flood sizes come from model hazard maps (EFAS), not forecasts. The water timing is illustrative.
- Behaviour settings (follow rate, speeds, rescue) are assumptions, marked as such everywhere.
- "Unsafe" is not a count of casualties.
- The 2021 satellite outline covers only a small part of this valley: the app says the check is inconclusive.
- Demo data is synthetic and marked **DEMO DATA**.

## Data credits

The challenge datasets are free to use with credit (Annex 2 of the challenge). The files in `data/` are extracts made from them.

- **Copernicus Emergency Management Service, Rapid Mapping** (© European Union): activations EMSR517 (Germany), EMSR518 (Belgium), EMSR520 (Netherlands), July 2021. https://mapping.emergency.copernicus.eu/
- **EFAS river flood hazard maps for Europe**, European Commission, Joint Research Centre (JRC). https://data.jrc.ec.europa.eu/collection/id-0054
- **GHS-OBAT R2024A** buildings, European Commission, JRC. https://data.jrc.ec.europa.eu/dataset/f41a22f1-5741-4c41-86eb-6384654f6927
- **GHS-POP R2023A** population, European Commission, JRC. https://data.jrc.ec.europa.eu/dataset/2ff68a52-5b5b-4a22-8f40-c41da8332cfe

Other public sources:

- **OpenStreetMap** © OpenStreetMap contributors, under the Open Database License (ODbL 1.0): roads, places, building outlines and town names, read from OpenFreeMap tiles. The OSM-derived files (`roads`, `places`, `buildings_fp`, `towns`) stay under the ODbL. https://www.openstreetmap.org/copyright
- **Copernicus DEM GLO-30** (ground height): © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.
- **Open-Meteo** (CC BY 4.0) with **ERA5** reanalysis (Copernicus Climate Change Service): rain records and forecasts.
- **Background maps** (display only, credited on the map): Esri World Imagery, CARTO, OpenFreeMap, Mapzen/AWS terrain tiles.
- **Research values**: JRC depth–damage functions (Huizinga, de Moel & Szewczyk 2017, doi 10.2760/16510) and the sources listed in `SOURCES.md`.
