# Flood Scenario Explorer

Browser app that shows how floods like July 2021 could hit an area: flood size slider,
video-style water rise, 2D/3D map on real streets or satellite photos, safety zones,
safest places, and downloadable diagrams for the policy brief.

European AI Challenge 2026 · Team project.

## Run it in VS Code

1. Open this folder in VS Code (**File → Open Folder…**).
2. Install the **Live Server** extension (VS Code suggests it automatically).
3. Right-click `index.html` → **Open with Live Server**. The app opens in your browser.
4. Edit any file and save: the page reloads by itself.

Double-clicking `index.html` also works, but then the app can't read the `data/` folder
(use the **Load team data** button instead).

## Folder map

```
flood-scenario-explorer/
├── index.html            page layout (header, map, player, tabs)
├── css/style.css         all colours, fonts and layout (colours = variables at the top)
├── js/                   loaded in this order:
│   ├── utils.js          helpers: formatting, geometry
│   ├── demo-data.js      fake test data (same format as the real files)
│   ├── data-loader.js    reads + checks the GeoJSON files, auto-loads data/
│   ├── analysis.js       the numbers: exposure, safety zones, safest places
│   ├── map.js            map, real background maps, layers, legend, tooltip
│   ├── player.js         play / pause / speed / loop
│   ├── camera.js         smooth 2D ↔ 3D, zoom, turn, tilt, auto-orbit
│   ├── panels.js         Simulate / Safety / Policy tabs
│   ├── diagrams.js       charts + PNG / SVG / CSV downloads
│   └── main.js           start-up
├── data/                 put grid.geojson (+ observed_2021, buildings) here
├── scripts/
│   └── colab_export_for_app.py   for the data person (Colab)
├── build.py              bundles everything into ONE html file
└── dist/                 output of build.py (the file to submit)
```

## Make the file to submit

```
python build.py
```
→ `dist/flood-scenario-explorer.html` (one file, works offline except the background maps).

## Where to change things

| I want to… | File |
|---|---|
| change colours or fonts | `css/style.css` (top) |
| change safety-zone rules (red / yellow / green) | `js/analysis.js` → `computeZones` |
| change depth classes (0.5 m, 1.5 m) | `js/utils.js` → `CLASSES`, `cls` |
| change video length | `js/player.js` → `DUR` |
| add a diagram | `js/diagrams.js` → `DIAGS` + `chartData` |
| change texts for each public actor | `js/panels.js` → `drawActor` |

## Data honesty (jury criterion 1)

- Flood sizes come from model hazard maps (EFAS), not forecasts.
- The video is illustrative: low ground floods first, real timing is not modelled.
- Demo data is synthetic and marked **DEMO DATA** everywhere, including downloaded diagrams.
