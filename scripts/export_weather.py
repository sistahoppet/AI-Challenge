"""Export data/weather.json for the app's forecast panel (Open-Meteo, free, no key). External source, not challenge data.
  rain: catchment-mean daily rain 1984-2021 (ERA5 archive) -> 48-hour rain levels 1-in-10/100/500 (Gumbel on yearly maxima 1984-2020)
        + the July 2021 replay
  river: GloFAS river flow at Pepinster, same method, IF the Open-Meteo flood API answers (it has a shared daily quota)
Usage: python scripts/export_weather.py
"""
import json, math, pathlib, statistics as st, requests
import argparse
ap = argparse.ArgumentParser()
ap.add_argument("--pts", nargs="+", type=float, default=[6.05, 50.52, 5.95, 50.60, 5.86, 50.59, 5.80, 50.57], help="lon lat pairs in the catchment (default: Vesdre)")
ap.add_argument("--gauge", nargs=2, type=float, default=[5.807, 50.567], help="river point for the flow (default: Pepinster)")
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args()
OUT = pathlib.Path(a.out) / "weather.json"
PTS = list(zip(a.pts[::2], a.pts[1::2]))
GAUGE = tuple(a.gauge); REPLAY = ("2021-07-08", "2021-07-24")
ll = f"latitude={','.join(str(p[1]) for p in PTS)}&longitude={','.join(str(p[0]) for p in PTS)}"

def gumbel(series):  # series: {date: value}; yearly maxima 1984-2020, method of moments
    mx = {}
    for t, v in series.items():
        if v is not None and t[:4] < "2021": mx[t[:4]] = max(mx.get(t[:4], 0), v)
    x = list(mx.values()); b = st.stdev(x) * math.sqrt(6) / math.pi; mu = st.mean(x) - 0.5772 * b
    return {"q": {T: round(mu - b * math.log(-math.log(1 - 1 / T)), 1) for T in (10, 100, 500)}, "years": len(x), "maxSeen": round(max(x), 1)}

r = requests.get(f"https://archive-api.open-meteo.com/v1/archive?{ll}&start_date=1984-01-01&end_date=2021-12-31&daily=precipitation_sum&timezone=Europe%2FBrussels", timeout=120).json()
days = r[0]["daily"]["time"]
rain = [sum((x["daily"]["precipitation_sum"][i] or 0) for x in r) / len(r) for i in range(len(days))]
r48 = {days[i]: rain[i] + rain[i - 1] for i in range(1, len(days))}   # rain of this day + the day before
d = {"rainLevels": gumbel(r48), "replayRain": [{"t": t, "mm": round(rain[i], 1), "mm48": round(r48.get(t, rain[i]), 1)} for i, t in enumerate(days) if REPLAY[0] <= t <= REPLAY[1]]}
try:
    f = requests.get(f"https://flood-api.open-meteo.com/v1/flood?latitude={GAUGE[1]}&longitude={GAUGE[0]}&daily=river_discharge&start_date=1984-01-01&end_date=2021-12-31", timeout=120).json()
    if f.get("error"): raise RuntimeError(f["reason"])
    q = dict(zip(f["daily"]["time"], f["daily"]["river_discharge"]))
    d["levels"] = gumbel(q); d["gaugeAt"] = [f["longitude"], f["latitude"]]
    d["replayQ"] = [{"t": t, "q": q[t]} for t in sorted(q) if REPLAY[0] <= t <= REPLAY[1]]
except Exception as e:
    print("River flow not available (", e, "): rain-only file.")
OUT.write_text(json.dumps(d)); print(json.dumps({k: v for k, v in d.items() if k.endswith("Levels") or k == "levels"}, indent=1))
print("July 2021, 48-h rain:", [(x["t"][5:], x["mm48"]) for x in d["replayRain"] if "07-12" <= x["t"][5:] <= "07-17"])
