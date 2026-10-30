"""Export rivers and streams for the study area from OpenStreetMap map tiles (OpenFreeMap, free, no key).
The app uses them to flag riverbank homes ("upstairs unreliable, evacuate early", distance set in data/params.json).
Writes data/rivers.geojson: LineStrings with class (river, stream, canal) and name, cut exactly at tile edges.
Usage: python scripts/export_rivers.py [--bbox W S E N]
External source: (c) OpenStreetMap contributors (ODbL), tiles by OpenFreeMap. Not part of the challenge data.
"""
import argparse, json, math, pathlib, requests, mapbox_vector_tile as mvt
from shapely.geometry import shape, box

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; Z = 14; EXT = 4096
URL = requests.get("https://tiles.openfreemap.org/planet", timeout=30).json()["tiles"][0]
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat): return (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**Z
def lonlat(x, y): return x / 2**Z * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2**Z))))
KEEP = {"river", "stream", "canal"}
out = []
for X in range(int(tx(W)), int(tx(E)) + 1):
    for Y in range(int(ty(N)), int(ty(S)) + 1):
        r = requests.get(URL.format(z=Z, x=X, y=Y), timeout=30)
        if not r.ok: print("tile failed", X, Y, r.status_code); continue
        tile = box(0, 0, EXT, EXT)
        for f in mvt.decode(r.content, default_options={"y_coord_down": True}).get("waterway", {}).get("features", []):
            p = f["properties"]
            if p.get("class") not in KEEP: continue
            g = shape(f["geometry"]).intersection(tile)  # cut at the tile edge: no duplicates from the tile buffer
            for part in getattr(g, "geoms", [g]):
                if part.geom_type != "LineString" or part.length == 0: continue
                coords = [[round(v, 6) for v in lonlat(X + px / EXT, Y + py / EXT)] for px, py in part.coords]
                out.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                            "properties": {"class": p["class"], "name": p.get("name", "")}})
pathlib.Path(a.out, "rivers.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")))
from collections import Counter
print(len(out), "lines:", dict(Counter(f["properties"]["class"] for f in out)))
