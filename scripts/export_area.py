"""Export the challenge data for one study area into the 3 files the app reads.

Runs locally (or in Colab) and reads ONLY the study-area window from the public bucket.
Usage:  python scripts/export_area.py            (Vesdre valley, BE, default)
        python scripts/export_area.py --bbox W S E N --ems-country be --ems EMSR518_AOI01

Output in data/:
  grid.geojson           EFAS cells (native 3" grid) with depth_rp10/100/500 + pop + elev (ground height, Copernicus DEM)
  buildings.geojson      GHS-OBAT building points: height, use, pop (estimated residents)
  observed_2021.geojson  Copernicus EMS flooded area 2021 (delineation + monitoring, merged)
"""
import argparse, json, os, pathlib
import numpy as np, geopandas as gpd, pandas as pd, pyogrio, rasterio
from rasterio.windows import from_bounds
from shapely.geometry import box

os.environ["GS_NO_SIGN_REQUEST"] = "YES"   # public bucket, no login
B = "/vsigs/datasets_challenge/working_data/"
ap = argparse.ArgumentParser()
ap.add_argument("--bbox", nargs=4, type=float, default=[5.60, 50.55, 5.96, 50.64])  # Chaudfontaine -> Verviers
ap.add_argument("--keep-km", type=float, default=1.0, help="keep dry cells this close to any flooded cell")
ap.add_argument("--ems-country", default="be")
ap.add_argument("--ems", default="EMSR518_AOI01")
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "data"))
a = ap.parse_args(); W, S, E, N = a.bbox; out = pathlib.Path(a.out); out.mkdir(exist_ok=True)

# --- 1. EFAS depth per return period, on its own 3" grid (no resampling: values stay as published) ---
depth = {}
for rp in (10, 100, 500):
    with rasterio.open(B + f"cems-efas/Europe_RP{rp}_filled_depth.tif") as s:
        win = from_bounds(W, S, E, N, s.transform).round_offsets().round_lengths()
        d = s.read(1, window=win).astype("float32"); tr = s.window_transform(win)
        d[(d == s.nodata) | (d < 0) | ~np.isfinite(d)] = 0
        depth[rp] = d
nrow, ncol = depth[10].shape
wet = np.any([d > 0 for d in depth.values()], axis=0)
lat0 = (S + N) / 2; cw = tr.a * 111320 * np.cos(np.radians(lat0)); ch = -tr.e * 110540
# keep flooded cells + a band of dry cells around them (where shelters can be)
kx, ky = int(a.keep_km * 1000 / cw), int(a.keep_km * 1000 / ch)
keep = np.zeros_like(wet); rows, cols = np.nonzero(wet)
cum = np.zeros((nrow + 1, ncol + 1), int); cum[1:, 1:] = wet.cumsum(0).cumsum(1)
r0 = np.clip(np.arange(nrow) - ky, 0, nrow); r1 = np.clip(np.arange(nrow) + ky + 1, 0, nrow)
c0 = np.clip(np.arange(ncol) - kx, 0, ncol); c1 = np.clip(np.arange(ncol) + kx + 1, 0, ncol)
keep = (cum[r1][:, c1] - cum[r0][:, c1] - cum[r1][:, c0] + cum[r0][:, c0]) > 0
print(f"EFAS grid {ncol}x{nrow}, cell {cw:.0f} x {ch:.0f} m, flooded {wet.sum()}, kept {keep.sum()}")

# --- 2. GHS-OBAT buildings (real points) ---
bld = pyogrio.read_dataframe(B + "obat_be/GHS_OBAT_GPKG_BEL_E2020_R2024A_V1_0/GHS_OBAT_GPKG_BEL_E2020_R2024A_V1_0.gpkg", bbox=(W, S, E, N)) \
    if a.ems_country == "be" else None  # >>> other countries: obat_de / obat_nl paths
x, y = bld.geometry.x.values, bld.geometry.y.values
bc = ((x - tr.c) / tr.a).astype(int); br = ((y - tr.f) / tr.e).astype(int)
inside = (bc >= 0) & (bc < ncol) & (br >= 0) & (br < nrow)
bld = bld[inside].copy(); bc, br = bc[inside], br[inside]

# --- 3. GHS-POP (~1 km) shared out over residential buildings by volume (area x height) ---
# ASSUMPTION (check Annex 2): OBAT use == 1 means residential.
with rasterio.open(B + "ghs_pop/GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0/GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif") as s:
    pw = from_bounds(W, S, E, N, s.transform).round_offsets().round_lengths()
    pop = s.read(1, window=pw).astype(float); ptr = s.window_transform(pw)
pop[~np.isfinite(pop) | (pop < 0)] = 0
pr = ((bld.geometry.y.values - ptr.f) / ptr.e).astype(int); pc = ((bld.geometry.x.values - ptr.c) / ptr.a).astype(int)
okp = (pr >= 0) & (pr < pop.shape[0]) & (pc >= 0) & (pc < pop.shape[1])
vol = np.where((bld["use"].values == 1) & okp, bld["area"].fillna(0).values * bld["height"].fillna(3).values, 0.0)
key = np.where(okp, pr * pop.shape[1] + pc, -1)
tot = pd.Series(vol).groupby(key).transform("sum").values
bld["pop"] = np.where(tot > 0, vol / np.where(tot > 0, tot, 1) * pop.ravel()[np.clip(key, 0, None)], 0).round(2)
placed = bld["pop"].sum(); total = pop[pop > 0].sum()
print(f"residents in window {total:,.0f}; placed on buildings {placed:,.0f} ({placed/total:.0%}; the rest sits in 1 km cells without residential buildings or partly outside the window)")
cellpop = np.zeros((nrow, ncol)); np.add.at(cellpop, (br, bc), bld["pop"].values)

# --- 3b. ground height per cell: Copernicus DEM GLO-30 (public, AWS), lowest value in the cell (the DEM is a surface model:
#         roofs and trees are in it; the minimum stays closer to the ground) ---
from rasterio.warp import reproject, Resampling
elev = np.full((nrow, ncol), np.nan, dtype="float32")
tiles = {(int(np.floor(la)), int(np.floor(lo))) for la in (S, N) for lo in (W, E)}
for la, lo in sorted(tiles):
    u = f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N{la:02d}_00_E{lo:03d}_00_DEM/Copernicus_DSM_COG_10_N{la:02d}_00_E{lo:03d}_00_DEM.tif"
    part = np.full((nrow, ncol), np.nan, dtype="float32")
    with rasterio.open(u) as s:
        reproject(rasterio.band(s, 1), part, src_transform=s.transform, src_crs=s.crs, dst_transform=tr, dst_crs="EPSG:4326",
                  dst_nodata=np.nan, resampling=Resampling.min)
    elev = np.where(np.isnan(elev), part, elev)
print(f"ground height {np.nanmin(elev):.0f}-{np.nanmax(elev):.0f} m")

# --- 4. grid.geojson ---
rr, cc = np.nonzero(keep)
geoms = [box(tr.c + c * tr.a, tr.f + (r + 1) * tr.e, tr.c + (c + 1) * tr.a, tr.f + r * tr.e) for r, c in zip(rr, cc)]
grid = gpd.GeoDataFrame({**{f"depth_rp{rp}": d[rr, cc].round(2) for rp, d in depth.items()}, "pop": cellpop[rr, cc].round(1),
                         "elev": np.round(elev[rr, cc], 1)}, geometry=geoms, crs=4326)
grid.to_file(out / "grid.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)

# --- 5. buildings.geojson (only those in kept cells) ---
kb = keep[br, bc]
b = bld[kb][["height", "use", "area", "pop", "geometry"]].copy()
b["height"] = b["height"].fillna(3).round(1); b["area"] = b["area"].round(0)
b.to_file(out / "buildings.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)

# --- 6. observed_2021.geojson (EMS flooded area: first delineation + monitoring merged) ---
parts = []
for prod in ("PRODUCT", "MONIT01"):
    p = f"ems_{a.ems_country}/{a.ems}_DEL_{prod}_r1_VECTORS_v1_vector/{a.ems}_DEL_{prod}_observedEventA_r1_v1.json"
    try: parts.append(gpd.read_file(B + p).to_crs(4326)[["geometry"]].assign(product=prod))
    except Exception as e: print("EMS layer missing:", p, e)
obs = gpd.clip(pd.concat(parts), box(W, S, E, N)).explode(index_parts=False)
obs = obs[obs.geom_type == "Polygon"]
obs.to_file(out / "observed_2021.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)

# --- summary for the sanity check ---
summary = {"bbox": [W, S, E, N], "cells": int(keep.sum()), "cell_m": [round(cw), round(ch)],
  "buildings": int(kb.sum()), "residents_in_grid": round(float(cellpop[keep].sum())),
  **{f"rp{rp}": {"flooded_cells": int((d > 0).sum()), "residents_in_water": round(float(cellpop[d > 0].sum())),
                 "buildings_in_water": int((d[br, bc][kb] > 0).sum()), "max_depth_m": round(float(d.max()), 2)} for rp, d in depth.items()},
  "obs_polygons": len(obs)}
(out / "summary.json").write_text(json.dumps(summary, indent=1)); print(json.dumps(summary, indent=1))
for f in ("grid", "buildings", "observed_2021"): print(f, f"{(out / (f + '.geojson')).stat().st_size / 1e6:.1f} MB")
