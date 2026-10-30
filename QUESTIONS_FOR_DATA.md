# Questions from the front end to the flood API (for the data person's Claude)

**Context.** The front end (repo `sistahoppet/AI-Challenge`, PR #2) now loads every July 2021 Copernicus EMS area from the
public API `https://dev.nsrddyn.com/api`:
1. `GET /impact` → list of 19 AOIs (code = `activation_aoi_product`, e.g. `EMSR517_AOI15_GRA`);
2. `POST /flood {name, region:{type:"aoi", aoi:code}, floods:[rp10,rp100,rp500]}` (async + `/jobs/{id}`);
3. box = min/max lon/lat of `danger_rp100.csv` + 800 m, then `POST /region {name, bbox, top_n:20}`;
   `cells.geojson` (d10/d100/d500, pop, elev, r) becomes the map grid; `facilities.geojson` the places.
   When `/region` refuses the box (> 3000 km², "x% outside the study region", "corrupt deflate stream"),
   the front end retries smaller boxes around the 1 km cell with most people (20 → 3 km).
4. The water animation uses the EFAS depths per cell, but the **timing is our own assumption** (slider "water rises in").
   We want to drive it from your `/timeline` model instead.

Results: 18/19 AOIs load. EMSR517_AOI06_DEL fails even at 3 km ("18% of the region lies outside the study region").
Under load, some requests return a gateway error without CORS headers (the browser sees a network error); we now retry 3 times.

**Please answer each question below with: yes/no, the exact request and response shape (an example JSON),
and the route or file to use. If something needs a code change on your side, say how long it would take.
Do not change existing routes or field names: the front end depends on them.**

## Water over time (the upgrade we want to make)
1. `/timeline` returns `files.cells` as `cells.gpkg`, which a browser cannot read. Can it also write **GeoJSON** (or JSON:
   one depth per cell per step, same cell ids/geometry as `/region` cells.geojson)? What are the fields per step?
2. Which `driver` types does `/timeline` accept besides `{"type":"whatif", peak_rp, rise_h, fall_h, step_h}`? Is there an
   observed July 2021 driver (river discharge) or a GloFAS forecast driver? The `discharge` field in `steps` is always null.
3. How is depth computed for a return period T between the EFAS maps (10/100/500)? Interpolation in log T? Is it capped at
   1-in-500? Below 1-in-10, is it 0?
4. Does `/timeline` accept `region:{type:"aoi"}` and `bbox` alike, with the same limits as `/flood`?

## Models
5. Risk score `r` (0–1): has it been checked against the 2021 outlines as a threshold, e.g. "cells with r ≥ 0.5 were flooded
   in X% of held-out cases"? If yes, give the numbers, so we can show "likely wet" with a stated hit rate instead of a ranking.
6. `/models` lists `roads` (road damage and closure timeline) and `interp` (flood extent between two CEMS dates) as
   precomputed for CEMS AOIs, but no route serves them. Can they get routes (or files under `/files/...`)? Paths and shapes?

## Areas and limits
7. Can the server publish the **study region** as GeoJSON (e.g. `/files/region/study_region.geojson`) and accept
   `region:{type:"aoi"}` on `/region`? Then the front end stops guessing boxes, and AOI06 can work (or tell us why it can't).
8. The error "corrupt deflate stream" appeared for `POST /region {"bbox":[5.31,50.13,5.58,50.40]}` (Belgian AOI02) while
   `[5.38,50.20,5.51,50.33]` worked. Which input file is damaged?
9. How many jobs can run at once, and what is the nginx proxy timeout? We will run a live 5-minute demo: should we warm the
   cache first (which runs), and are results reused when the same `name` is sent again?
10. Is there a route for town names or building footprints per area (the front end has neither for server areas: building
    counts show 0 on the map, and car routes and shelter sizes are missing)? If not, is it simple to add from the GHS-OBAT /
    OSM data already on the server?

## For the jury (criterion 1, evidence)
11. For each model the front end shows (risk, access, timeline, evacuation, impact): one sentence on what it was
    trained or checked on, and the held-out score. We print these on the app's "Data sources" page.
