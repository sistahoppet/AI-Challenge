"""Export municipal boundaries for the study area from the OpenStreetMap extracts of the challenge data (Geofabrik .osm.pbf).
The app uses them as the unit of analysis (results per municipality).
Writes data/municipalities.geojson: Polygons/MultiPolygons with name, admin_level and osm_id; whole municipalities, not cut at the
area box, so a municipality that is only partly in the grid keeps its real outline.
Belgium: admin_level 8 = commune / gemeente. Germany: admin_level 8 = Gemeinde / Stadt (Verbandsgemeinden are level 7, left out).
Usage: python scripts/export_municipalities.py --pbf ../hackathon/working_data/osm/belgium-latest.osm.pbf [--pbf ...] [--bbox W S E N]
Needs geopandas + pyogrio (GDAL with the OSM driver), e.g. the hackathon .venv.
External source: (c) OpenStreetMap contributors (ODbL), extracts by Geofabrik. Not part of the challenge data.
"""
import argparse, json, pathlib
import geopandas as gpd, pandas as pd, pyogrio

ap = argparse.ArgumentParser()
ap.add_argument("--pbf", action="append", required=True, help="OSM .pbf extract; repeat for areas on a border")
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--level", default="8", help="OSM admin_level of a municipality")
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args()

parts = []
for pbf in a.pbf:
    g = pyogrio.read_dataframe(pbf, layer="multipolygons", bbox=tuple(a.bbox),
                               where=f"boundary = 'administrative' AND admin_level = '{a.level}'",
                               columns=["osm_id", "osm_way_id", "name", "admin_level"])
    print(f"{pathlib.Path(pbf).name}: {len(g)} municipalities touch the box")
    parts.append(g)
g = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=parts[0].crs).to_crs(4326)
g["osm_id"] = g["osm_id"].fillna(g["osm_way_id"])
g = g[g.geometry.notna() & ~g.geometry.is_empty & g["name"].notna()].drop_duplicates("osm_id")  # same relation in two extracts
g["geometry"] = g.geometry.simplify(0.0001, preserve_topology=True)  # ~10 m, far below the 100 m grid
g = g.sort_values("name")

feats = [{"type": "Feature", "geometry": json.loads(gpd.GeoSeries([geom]).to_json())["features"][0]["geometry"],
          "properties": {"name": r["name"], "admin_level": int(r["admin_level"]), "osm_id": str(r["osm_id"])}}
         for (_, r), geom in zip(g.iterrows(), g.geometry)]
def rnd(c): return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 6), round(c[1], 6)]
for f in feats: f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
pathlib.Path(a.out, "municipalities.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":"), ensure_ascii=False))
print(len(feats), "municipalities:", ", ".join(g["name"]))
