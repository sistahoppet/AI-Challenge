# data/ — the data pipeline

All files in EPSG:4326 (longitude, latitude). The app reads them automatically when served over http
(`python3 -m http.server` or VS Code Live Server); with a double-clicked file use **Load team data** (grid, 2021, buildings only).
Only `grid.geojson` is required; every other file is optional and the app says what is missing.

| File | Req. | Made by | Content / columns | Status |
|---|---|---|---|---|
| `grid.geojson` | yes | `scripts/export_area.py` | EFAS cells: `depth_rp10`, `depth_rp100`, `depth_rp500` (m), `pop` (GHS-POP residents), `elev` (Copernicus DEM, m) | ready |
| `buildings.geojson` | – | `scripts/export_area.py` | GHS-OBAT points: `height` (m), `use` (1/2, check Annex 2), `area` (m²), `pop` (residents placed) | ready |
| `buildings_fp.geojson` | – | `scripts/export_footprints.py` | same + OSM outline as geometry, `kind` when a key site is inside | ready |
| `observed_2021.geojson` | – | `scripts/export_area.py` | Copernicus EMS flood outline, July 2021 | **incomplete: main EMS delineation not exported yet** (only 2 MONIT01 polygons) |
| `places.geojson` | – | `scripts/export_tiles.py` (or `export_osm.py`) | OSM `kind`, `group` (critical/shelter/assembly), `name`, `area_m2`, `height_m` | ready |
| `roads.geojson` | – | `scripts/export_tiles.py` | OSM roads: `hw`, `cls`, `car`, `foot`, `bridge` | ready |
| `towns.geojson` | – | `scripts/export_towns.py` | OSM place names: `name`, `class` | ready |
| `weather.json` | – | `scripts/export_weather.py` | ERA5 48 h rain levels (Gumbel) + July 2021 replay | ready |
| `summary.json` | – | `scripts/export_area.py` | sanity-check totals | ready |
| `params.json` | – | by hand (team) | **parameter registry**: `{key: {value, unit, status: sourced/assumption/placeholder, source, note}}` for every number of the model (follow rate, speeds, depths, rescue, shelter share, riverbank distance, Impact values). Shown in the Data tab | ready (values to source) |
| `rivers.geojson` | – | `scripts/export_rivers.py` | OSM waterways: `class` (river/stream/canal), `name`. Used for riverbank homes (“upstairs unreliable, evacuate early”, distance `riverbankM` in params.json). Without it the app uses the river channel cells as a proxy | **missing** (tile server blocked from our machines: run the script where it is reachable) |
| `shelter_capacity.csv` | – | by hand (Researcher): commune emergency plans, governor's planning service, Red Cross | `name, lon, lat, capacity, source` — matched to the OSM shelter within 75 m; replaces the floor-area estimate | **missing** |
| `q2_measures.json` | – | by hand (Researcher), from the Drive doc “Policies since the flood 2021” | array of `{area, measure, type (defence/rebuild/abandoned/warning/plan/campaign/infrastructure), date, source, url, verified (true/false), lon?, lat?}` | **missing** |
| `prm.csv` | – | Statbel (age per statistical sector) or commune registers | `name, lon, lat, residents_65plus, residents_80plus, source` — people with reduced mobility, for priority evacuation | **missing (gap: no PRM database found yet)** |
| `municipalities.geojson` | – | Statbel / IGN municipal boundaries | polygons with `name` — municipality as unit of analysis | **missing (next step)** |

Rules: never put an invented number in a data file; if a value is an assumption, write it in `params.json` with status `assumption`.
