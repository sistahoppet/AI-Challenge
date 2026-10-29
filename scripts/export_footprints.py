"""Give every GHS-OBAT building its real footprint (outline) from OpenStreetMap map tiles, so the app draws buildings at real scale.
Reads data/buildings.geojson (GHS-OBAT points: height, use, area, pop) and data/places.geojson (hospitals, schools...).
Writes data/buildings_fp.geojson: same properties, geometry = the OSM footprint that contains the point (largest point wins
when several share one footprint; the others keep their point), plus "kind" when a key site (school, hospital...) sits inside.
Usage: python scripts/export_footprints.py [--bbox W S E N]
External source: (c) OpenStreetMap contributors (ODbL), tiles by OpenFreeMap. Heights and uses stay GHS-OBAT (challenge data).
"""
import argparse, json, math, pathlib, requests, mapbox_vector_tile as mvt
from shapely.geometry import shape, box, Point, mapping
from shapely.strtree import STRtree
from shapely.ops import transform

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--data", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; data = pathlib.Path(a.data); Z = 14; EXT = 4096
URL = requests.get("https://tiles.openfreemap.org/planet", timeout=30).json()["tiles"][0]
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat): return (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**Z
def lonlat(x, y): return x / 2**Z * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2**Z))))

obat = json.loads((data / "buildings.geojson").read_text())["features"]
places = json.loads((data / "places.geojson").read_text())["features"]
pts = [Point(f["geometry"]["coordinates"]) for f in obat]; ptree = STRtree(pts)
ppts = [Point(f["geometry"]["coordinates"]) for f in places]; pltree = STRtree(ppts)
best = {}  # obat index -> footprint (lon/lat polygon)
x0, x1, y0, y1 = int(tx(W)), int(tx(E)), int(ty(N)), int(ty(S)); n = 0
for X in range(x0, x1 + 1):
    for Y in range(y0, y1 + 1):
        r = requests.get(URL.format(z=Z, x=X, y=Y), timeout=30)
        if not r.ok: print("tile failed", X, Y, r.status_code); continue
        t = mvt.decode(r.content, default_options={"y_coord_down": True}); tile = box(0, 0, EXT, EXT)
        to_ll = lambda g: transform(lambda px, py, z=None: lonlat(X + px / EXT, Y + py / EXT), g)
        for f in t.get("building", {}).get("features", []):
            for part in getattr(shape(f["geometry"]), "geoms", [shape(f["geometry"])]):
                if not tile.contains(part.representative_point()): continue  # the copy in the neighbour tile's buffer
                fp = to_ll(part).simplify(2e-6)
                inside = [i for i in ptree.query(fp) if fp.contains(pts[i])]
                if not inside: continue
                i = max(inside, key=lambda k: obat[k]["properties"].get("area") or 0)
                if i not in best or fp.area > best[i].area: best[i] = fp
        n += 1
print(f"{n} tiles, {len(best)} of {len(obat)} buildings got a footprint")
out = []
for i, f in enumerate(obat):
    g = best.get(i); p = dict(f["properties"])
    if g is not None:
        k = [j for j in pltree.query(g) if g.contains(ppts[j])]
        if k: p["kind"] = places[k[0]]["properties"]["kind"]
        geo = mapping(g); geo["coordinates"] = json.loads(json.dumps(geo["coordinates"]), parse_float=lambda v: round(float(v), 6))
    else: geo = f["geometry"]
    out.append({"type": "Feature", "geometry": geo, "properties": p})
(data / "buildings_fp.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")))
print(f"wrote buildings_fp.geojson ({(data / 'buildings_fp.geojson').stat().st_size / 1e6:.1f} MB)")
