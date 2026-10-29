# =====================================================================
# Flood Scenario Explorer: export the app's data files (Colab version)
#
# The old placeholder cells were replaced on 29 Oct 2026. They had two problems:
#  - file paths were guesses (now known, see export_area.py)
#  - GHS-POP is ~1 km (30 arc-seconds), not 100 m: resampling it with "sum"
#    onto 100 m cells copied each 1 km value into every small cell (~100x too many people).
# The real export now lives in two scripts that run the same in Colab and locally:
#   export_area.py  EFAS depths (native 3" grid), GHS-OBAT buildings, residents placed
#                   on residential buildings, Copernicus EMS 2021 outline
#   export_osm.py   OpenStreetMap hospitals, care homes, schools, sports halls… + roads (Overpass, no key)
#
# In Colab: upload both .py files (Files panel), then run these cells.
# =====================================================================

# --- Cell 1: setup ---
# !pip install -q geopandas rasterio pyogrio shapely pyproj requests

# --- Cell 2: export (Vesdre default; change --bbox W S E N for another area in Belgium) ---
# !python export_area.py --out .
# !python export_osm.py  --out .

# --- Cell 3: download the files, then put them in the app's data/ folder ---
# from google.colab import files
# for f in ["grid.geojson", "buildings.geojson", "observed_2021.geojson", "places.geojson", "roads.geojson", "summary.json"]:
#     files.download(f)
