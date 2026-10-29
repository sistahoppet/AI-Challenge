"""Export town and village names for the study area from OpenStreetMap map tiles (OpenFreeMap, free, no key).
The app uses them to count people and buildings per town (Anna's questions 1 and 4: "name the areas").
Writes data/towns.geojson: points with name and class (city, town, village, suburb, hamlet).
Usage: python scripts/export_towns.py [--bbox W S E N]
External source: (c) OpenStreetMap contributors (ODbL), tiles by OpenFreeMap. Not part of the challenge data.
"""
import argparse, json, math, pathlib, requests, mapbox_vector_tile as mvt

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; Z = 12; EXT = 4096  # zoom 12 carries towns, villages and suburbs
URL = requests.get("https://tiles.openfreemap.org/planet", timeout=30).json()["tiles"][0]
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat): return (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**Z
def lonlat(x, y): return x / 2**Z * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2**Z))))
KEEP = {"city", "town", "village", "suburb", "hamlet"}
seen, out = set(), []
for X in range(int(tx(W)), int(tx(E)) + 1):
    for Y in range(int(ty(N)), int(ty(S)) + 1):
        r = requests.get(URL.format(z=Z, x=X, y=Y), timeout=30)
        if not r.ok: print("tile failed", X, Y, r.status_code); continue
        for f in mvt.decode(r.content, default_options={"y_coord_down": True}).get("place", {}).get("features", []):
            p = f["properties"]; g = f["geometry"]
            if p.get("class") not in KEEP or g["type"] != "Point" or not p.get("name"): continue
            lon, lat = lonlat(X + g["coordinates"][0] / EXT, Y + g["coordinates"][1] / EXT)
            if not (W <= lon <= E and S <= lat <= N) or p["name"] in seen: continue
            seen.add(p["name"])
            out.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                        "properties": {"name": p["name"], "class": p["class"]}})
pathlib.Path(a.out, "towns.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": out}))
print(len(out), "places:", sorted({f["properties"]["class"] for f in out}))
