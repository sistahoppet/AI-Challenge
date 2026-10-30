# Gaps: Flood Scenario Explorer vs the task statement

Checked on 30 Oct 2026 against the challenge brief ("From Data to Policy", pages 1–3) and the code at commit 3d1fefc.
Tags: [data] challenge data · [ext] external source · [as] assumption · [code] app behaviour.

## A. Scope of the task

| # | The brief asks | The app does | Gap | Priority |
|---|---|---|---|---|
| A1 | Whole cross-border area: Liège, Dutch Limburg, Region Aachen; Meuse **and** Vesdre | One bbox in the Vesdre valley, BE (5.60–5.96 E, 50.55–50.64 N) | No Meuse, no NL, no DE. Export only reads BE GHS-OBAT | High |
| A2 | "Present-state assessment ... what would happen **if the same event returned tomorrow**" | Uses EFAS return-period maps; the 2021 event is just a check | The event the brief means is 2021 (CEMS extent), not the EFAS 1-in-100 map | High |
| A3 | "Name the areas" (towns and villages) | OSM place names, closest point | Not municipalities (our chosen unit); edges are approximate | Medium |

## B. Per question

**Q1 – What did the 2021 floods cover?** (brief: clip the CEMS Rapid Mapping extent against GHS-POP and GHS-OBAT; count people, buildings, towns)
- B1 [data] `observed_2021.geojson` holds only 2 tiny MONIT01 polygons. The main delineation (`..._DEL_PRODUCT_...`) was **not loaded** ("EMS layer missing" path in `export_area.py`), and only EMSR518 AOI01 was tried. So the app reports the 2021 check as "inconclusive" because of our export, not because the data does not exist. **Fix first:** list the real files in the bucket (`ems_be/`, plus DE/NL activations) and re-export.
- B2 [code] There is no Q1 table based on the 2021 extent (people, buildings, towns *inside the observed water*). Today the report's Q1 uses the EFAS map.

**Q2 – What has been done since?** (desk research: defences, rebuilt/abandoned land, critical infrastructure, evacuation/shelter plans, campaigns, volunteer networks; be honest about what can't be verified)
- B3 [code] Q2 is a free-text box saved in the browser only (localStorage). It is lost on another computer and isn't shared across the team.
- B4 [code] There is no structured evidence: no list of measures with place, date, source and "verified / not verified", and nothing on the map.
- B5 [code] Q2 does not change any number. The model maps are pre-2021 ground, so "would we do better tomorrow" isn't answered. At least, mark the areas where a measure exists.

**Q3 – Shelter the exposed people in buildings standing today** (OSM candidates; cross-check with GHS-OBAT and official lists; outside the flood zone; capacity; within reach; flag hospitals/schools in the zone)
- B6 [code] **Bug:** the Evacuate hint says shelters are "not flooded in 2021", but `shelterCandidates()` never checks `c.obs`. Text and code disagree.
- B7 [code] **Silent capacity:** a site with no floor area gets the default of 500 places (`E.cap`) in `capOf()` and `extraShelters()`. 116 shelter sites in `places.geojson` have no OSM footprint (95 schools, 21 sports halls); those also without a nearby GHS-OBAT use=2 building get 500 each. This can inflate places.
- B8 [ext] Official lists (designated emergency shelters, school/hospital registers) aren't used. Say so, or add one source.
- B9 [code] "Critical sites in the water" lists hospitals, fire, police and town halls, but **not schools**. The brief names schools explicitly. Only the PDF report includes schools.
- B10 [code] There is no cross-border sharing (our stated angle). Nearest safe shelter across a border can't appear while the area is BE-only (A1).

**Q4 – Where do we still stand exposed?** (name areas, shelter gaps, first actions, "still exposed and under-covered after five years")
- B11 [code] The ranking is per OSM place, built from the drill. There is no simple "exposed vs shelter places per area" gap table on screen (only in the PDF).
- B12 [code] "After five years of recovery" needs Q2 (B5); it's missing today.

## C. Policy tool checks from the brief (p. 3)

| Brief question | Status |
|---|---|
| 1. Single action for Anna after seeing it | The report gives "First action", but the screen doesn't show it. Add one headline. |
| 2. What the tool does that a brief can't | Strong: live water, routes, shelters filling, best actions. |
| 3. Format serves the message | At risk: 6 tabs, 24 diagrams, costs, framework, CAP, dispatch. Most aren't Q1–Q4. |
| 4. Non-specialist understands in under a minute | At risk. Needs a 1-screen "Anna view" (Q1–Q4 answers + one action). |

## D. Credibility issues (responsible-AI criterion)

- D1 [code] Speed: driving speed (30 km/h) is labelled "on foot" / "walking" (Evacuate stats, routes list, sitrep, Impact, decision card shows "walking speed 8.3 m/s").
- D2 [as] Impact table uses invented numbers (alert reach 60%→90%, follow 70%→80%, decision 6 h→2 h, €2M / €30M / €18M). They're labelled "assumption", but they drive the "for the mayor" sentence. Move them out of the main view or source them.
- D3 [as] Drill choices hide assumptions: door-to-door = +10 pts compliance, "squeeze in" = +30% places, national support = ×3 rescue, rescue starts 30 min after first danger. Show them next to the choice.
- D4 [as] "Upstairs" isn't counted as unsafe. "Best actions" can therefore favour vertical evacuation. In 2021 some Vesdre homes collapsed (to verify with a source); add a caveat or a weight.
- D5 [code] Stale text: "Training mode" (removed); "Place shelters at the green safest places (Safety tab)" (the tab is now Evacuate); "needs a building-use layer" (places exist now).
- D6 [code] Dead handlers: candidate add, capacity edit, shelter delete.

## E. Status update (30 Oct, late morning)
Fixed: speed labels (B/D1), hidden 500 places (B7, now amber "capacity to be checked"), 2021 shelter rule (B6), schools in the critical list (B9),
upstairs = last resort + riverbank homes (D4), stale text (D5), parameter registry with sources (D2/D3 now labelled), public-shelter slider,
report page 1 = Anna's one-minute summary (C1/C4), clog points (BPR + queue).
Still open (data pipeline, see data/README.md):
- 2021 EMS main delineation + DE/NL activations (B1) · Meuse, Dutch Limburg, Region Aachen (A1) · municipalities.geojson (A3)
- rivers.geojson (export script written, tile server blocked here: riverbank uses a grid proxy ~80 m)
- shelter_capacity.csv (no open per-school or sports-hall capacity found; WalStat gives pupils per commune only)
- PRM: no public register of vulnerable people; usable proxies: Statbel age by statistical sector (prm.csv), WalStat nursing-home beds per commune
- q2_measures.json (structured Q2 from the Drive doc "Policies since the flood 2021")
- Rescue rate, national support, squeeze-in, door-to-door: no published values (placeholders)
- Clog delays are not fed back into travel times; phased (wave) departures are recommended in text, not simulated
- Parking capacity at shelters: OSM capacity tags not exported yet
