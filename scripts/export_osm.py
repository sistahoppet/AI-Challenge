"""Export real OpenStreetMap places and roads for the study area (Overpass API, free, no key).

Usage:  python scripts/export_osm.py            (same default bbox as export_area.py)
Output in data/:
  places.geojson   critical infrastructure + shelter candidates (points, with name, kind, floor area)
  roads.geojson    drivable / walkable roads (lines) for flood-aware routing
External source: © OpenStreetMap contributors (ODbL). Not part of the challenge data.
"""
import argparse, json, pathlib, time, requests
from shapely.geometry import Polygon, LineString
from pyproj import Geod

ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; out = pathlib.Path(a.out)
URL = "https://overpass-api.de/api/interpreter"; bb = f"{S},{W},{N},{E}"; geod = Geod(ellps="WGS84")

# kind -> (group, OSM tag filters). group: "critical" = must be protected / evacuated first; "shelter" = candidate shelter
KINDS = {
  "hospital": ("critical", ['amenity=hospital']), "clinic": ("critical", ['amenity=clinic']),
  "care_home": ("critical", ['amenity=nursing_home', 'social_facility=nursing_home', 'social_facility=assisted_living']),
  "fire_station": ("critical", ['amenity=fire_station']), "police": ("critical", ['amenity=police']),
  "town_hall": ("critical", ['amenity=townhall']), "power": ("critical", ['power=substation', 'power=plant']),
  "water_works": ("critical", ['man_made=water_works', 'man_made=wastewater_plant']),
  "school": ("shelter", ['amenity=school', 'amenity=college', 'amenity=university']),
  "sports_hall": ("shelter", ['leisure=sports_hall', 'leisure=sports_centre', 'building=sports_hall']),
  "stadium": ("shelter", ['leisure=stadium']), "community_centre": ("shelter", ['amenity=community_centre']),
  "park": ("assembly", ['leisure=park']),
}
def tagq(t): k, v = t.split("="); return f'nwr["{k}"="{v}"]({bb});'
def overpass(q):
    for i in range(3):
        r = requests.post(URL, data={"data": q}, timeout=180, headers={"User-Agent": "flood-scenario-explorer (hackathon)"})
        if r.ok: return r.json()["elements"]
        print("Overpass busy, retrying…", r.status_code); time.sleep(10 * (i + 1))
    r.raise_for_status()

# --- places ---
q = "[out:json][timeout:120];(" + "".join(tagq(t) for _, ts in KINDS.values() for t in ts) + ");out tags geom;"
els = overpass(q); feats, seen = [], set()
for e in els:
    tags = e.get("tags", {}); kind = next((k for k, (_, ts) in KINDS.items() if any(tags.get(t.split("=")[0]) == t.split("=")[1] for t in ts)), None)
    if not kind or (e["type"], e["id"]) in seen: continue
    seen.add((e["type"], e["id"])); area = 0
    if e["type"] == "node": lon, lat = e["lon"], e["lat"]
    elif "geometry" in e and len(e["geometry"]) >= 3:
        pts = [(p["lon"], p["lat"]) for p in e["geometry"] if p]; poly = Polygon(pts)
        area = abs(geod.geometry_area_perimeter(poly)[0]) if poly.is_valid and pts[0] == pts[-1] else 0
        c = poly.representative_point() if poly.is_valid else poly.centroid; lon, lat = c.x, c.y
    elif "bounds" in e: bd = e["bounds"]; lon, lat = (bd["minlon"] + bd["maxlon"]) / 2, (bd["minlat"] + bd["maxlat"]) / 2
    else: continue
    feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
      "properties": {"kind": kind, "group": KINDS[kind][0], "name": tags.get("name", ""), "area_m2": round(area),
                     "levels": tags.get("building:levels", ""), "osm": f'{e["type"]}/{e["id"]}'}})
(out / "places.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
from collections import Counter; print("places:", dict(Counter(f["properties"]["kind"] for f in feats)))

# --- roads (everything a car or a walker can use) ---
HW = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|track|steps|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"
els = overpass(f'[out:json][timeout:180];way["highway"~"^({HW})$"]({bb});out tags geom;')
rf = []
for e in els:
    g = [[round(p["lon"], 6), round(p["lat"], 6)] for p in e.get("geometry", []) if p]
    if len(g) < 2: continue
    t = e["tags"]; hw = t["highway"]
    rf.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": g},
      "properties": {"hw": hw, "car": 0 if hw in ("footway", "path", "steps", "pedestrian", "track") or t.get("motor_vehicle") == "no" or t.get("access") == "no" else 1,
                     "foot": 0 if hw.startswith("motorway") or hw.startswith("trunk") or t.get("foot") == "no" or t.get("access") == "no" else 1,
                     "bridge": 1 if t.get("bridge") not in (None, "no") else 0, "name": t.get("name", "")}})
(out / "roads.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": rf}, separators=(",", ":")))
print("roads:", len(rf), f"({(out / 'roads.geojson').stat().st_size / 1e6:.1f} MB)")
