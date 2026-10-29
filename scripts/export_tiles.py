"""Export places + roads for the study area from OpenStreetMap map tiles (OpenFreeMap, free, no key).
Fallback for export_osm.py when the Overpass API can't be reached. Same output files:
  places.geojson   critical infrastructure + shelter candidates (points, name, kind, footprint area, height)
  roads.geojson    roads and paths (lines) cut exactly at tile edges so they join up for routing
Usage: python scripts/export_tiles.py [--bbox W S E N]
External source: © OpenStreetMap contributors (ODbL), tiles by OpenFreeMap. Not part of the challenge data.
Tiles at zoom 14 carry fewer details than raw OpenStreetMap (e.g. no building levels, few care homes).
"""
import argparse, json, math, pathlib, requests, mapbox_vector_tile as mvt
from collections import Counter
from shapely.geometry import shape, box, Point, mapping
from shapely.strtree import STRtree
from shapely.ops import transform  # noqa (per-point lon/lat conversion)
from pyproj import Geod

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; out = pathlib.Path(a.out); Z = 14; EXT = 4096
URL = requests.get("https://tiles.openfreemap.org/planet", timeout=30).json()["tiles"][0]
geod = Geod(ellps="WGS84")
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat): return (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * 2**Z
def lonlat(x, y):  # tile-space (fractional tile numbers) -> lon/lat
    return x / 2**Z * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2**Z))))

# OpenMapTiles poi "subclass" (= the OSM tag value) -> (kind, group)
KIND = {"hospital": ("hospital", "critical"), "clinic": ("clinic", "critical"), "nursing_home": ("care_home", "critical"),
        "social_facility": ("care_home", "critical"), "fire_station": ("fire_station", "critical"), "police": ("police", "critical"),
        "townhall": ("town_hall", "critical"), "school": ("school", "shelter"), "college": ("school", "shelter"),
        "university": ("school", "shelter"), "sports_centre": ("sports_hall", "shelter"), "sports_hall": ("sports_hall", "shelter"),
        "stadium": ("stadium", "shelter"), "community_centre": ("community_centre", "shelter"), "park": ("park", "assembly")}
CAR = {"motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"}
NOFOOT = {"motorway", "trunk"}
KEEP = CAR | {"path", "track"}

places, roads = [], []
x0, x1, y0, y1 = int(tx(W)), int(tx(E)), int(ty(N)), int(ty(S))
print(f"{(x1 - x0 + 1) * (y1 - y0 + 1)} tiles at zoom {Z}")
for X in range(x0, x1 + 1):
    for Y in range(y0, y1 + 1):
        r = requests.get(URL.format(z=Z, x=X, y=Y), timeout=30)
        if not r.ok: print("tile failed", X, Y, r.status_code); continue
        t = mvt.decode(r.content, default_options={"y_coord_down": True})
        to_ll = lambda g: transform(lambda px, py, z=None: lonlat(X + px / EXT, Y + py / EXT), g)
        tile = box(0, 0, EXT, EXT)
        blds, bh = [], []  # tiles merge many buildings into one MultiPolygon: split them back into single footprints
        for f in t.get("building", {}).get("features", []):
            for part in getattr(shape(f["geometry"]), "geoms", [shape(f["geometry"])]): blds.append(part); bh.append(f["properties"].get("render_height"))
        tree = STRtree(blds) if blds else None
        for f in t.get("poi", {}).get("features", []):
            p = f["properties"]; k = KIND.get(p.get("subclass")) or KIND.get(p.get("class"))
            g = shape(f["geometry"])
            if not k or g.geom_type != "Point" or not tile.contains(g): continue  # skip the copy in the neighbour tile's buffer
            area = h = 0
            if tree is not None:
                hits = [i for i in tree.query(g) if blds[i].contains(g)]
                if hits:
                    i = hits[0]; area = abs(geod.geometry_area_perimeter(to_ll(blds[i]))[0]); h = bh[i] or 0
            lon, lat = to_ll(g).coords[0]
            places.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
              "properties": {"kind": k[0], "group": k[1], "name": p.get("name", ""), "area_m2": round(area), "height_m": h}})
        for f in t.get("transportation", {}).get("features", []):
            p = f["properties"]; c = p.get("class")
            if c not in KEEP: continue
            g = shape(f["geometry"]).intersection(tile)  # cut exactly at the tile edge -> pieces meet the next tile
            for part in getattr(g, "geoms", [g]):
                if part.geom_type != "LineString" or part.length == 0: continue
                coords = [[round(v, 6) for v in lonlat(X + px / EXT, Y + py / EXT)] for px, py in part.coords]
                roads.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                  "properties": {"hw": p.get("subclass") or c, "cls": c, "car": int(c in CAR), "foot": int(c not in NOFOOT),
                                 "bridge": int(p.get("brunnel") == "bridge")}})
inb = lambda f: W <= f["geometry"]["coordinates"][0] <= E and S <= f["geometry"]["coordinates"][1] <= N
places = [f for f in places if inb(f)]
(out / "places.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": places}))
(out / "roads.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": roads}, separators=(",", ":")))
print("places:", dict(Counter(f["properties"]["kind"] for f in places)))
print("roads:", len(roads), f"({(out / 'roads.geojson').stat().st_size / 1e6:.1f} MB), car:", sum(f["properties"]["car"] for f in roads))
