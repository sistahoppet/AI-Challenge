# data/

Put the team's files here (made with `scripts/colab_export_for_app.py`):

| File | Required | What it holds |
|---|---|---|
| `grid.geojson` | yes | square cells, columns `depth_rp10`, `depth_rp100`, … (metres) and `pop` (residents) |
| `observed_2021.geojson` | no | Copernicus EMS flood outline, July 2021 |
| `buildings.geojson` | no | building points or footprints, optional `height` (m) |

All in EPSG:4326 (longitude, latitude).

When you open the app with **Live Server**, it loads these files automatically.
If you double-click `index.html` instead, use the **Load team data** button.
