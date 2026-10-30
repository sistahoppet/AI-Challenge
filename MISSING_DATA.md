# Missing data: what the tool still needs

Status on 30 Oct 2026, 11:45. Each line: what is missing · why it matters · where to get it · file it goes into (see data/README.md) · what the app does meanwhile.
All fallbacks are shown in the app (Data tab "Assumptions and sources", amber "capacity to be checked", report tags).

## 1. Challenge data not exported yet (data pipeline)
| Missing | Why | Where | File | Meanwhile |
|---|---|---|---|---|
| Copernicus EMS July 2021 main flood outline (DEL_PRODUCT), all AOIs of EMSR518 (BE), EMSR517 (DE), NL activation | Q1 baseline: the brief asks to count people/buildings inside the **observed** 2021 water | challenge bucket `ems_be/`, `ems_de/`, `ems_nl/` (Annex 2) | observed_2021.geojson | only 2 small monitoring polygons: 2021 check "incomplete" |
| Meuse valley, Dutch Limburg, Region Aachen grids | Anna's mandate is cross-border; cross-border shelter sharing needs both sides in one area | `scripts/export_area.py --bbox …` with GHS-OBAT DE/NL | grid / buildings per area in data/cities/ | Vesdre (BE) and Ahr (DE) as separate areas |
| GHS-OBAT `use` codes checked against Annex 2 | residents are placed on use=1 (residential); shelter floor area uses use=2 | Annex 2 | – | assumption 1 = residential, 2 = non-residential |

## 2. Public data identified but not loaded
| Missing | Why | Where | File | Meanwhile |
|---|---|---|---|---|
| Municipality boundaries | our unit of analysis; per-municipality ranking | Statbel / IGN open data | municipalities.geojson | nearest OSM place name |
| River lines | "riverbank homes: upstairs unreliable" | OSM waterways (scripts/export_rivers.py; tile server blocked here) | rivers.geojson | grid proxy, ~80 m from the channel |
| Age per statistical sector (65+, 80+) | people with reduced mobility need assisted evacuation | Statbel "Population par secteur statistique" (check age columns) | prm.csv | not modelled (gap) |
| Nursing-home beds per commune | care homes need early evacuation (Valkenburg, Eschweiler 2021) | IWEPS WalStat (AVIQ) | prm.csv | care homes from OSM only (few) |
| SPW July 2021 water depth (field survey) | real 2021 depth; severity of riverbank damage | geoservices.wallonie.be ZONES_INONDEES_IDW | new layer | EFAS model depth |
| Walloon flood hazard maps | official zones used in local plans | geoservices3.wallonie.be APP_ALINO | new layer | EFAS zones |
| OSM parking capacity / lanes tags | parking at shelters; road capacity at clog points | OSM (Overpass) | roads.geojson (lanes), places (parking) | lanes by road class (assumption); parking not counted |
| Q2 measures since 2021 as data | "what changed since 2021" in the tool and report | Drive doc "Policies since the flood 2021" | q2_measures.json | report says "not documented yet" |

## 3. Data that is not public (ask the authorities)
| Missing | Ask | File | Meanwhile |
|---|---|---|---|
| Capacity of schools / sports halls / reception centres (21 candidate sites unknown) | communes' emergency plans (PGUI/PPUI), governor's emergency planning service, Red Cross | shelter_capacity.csv | floor area ÷ 3.5 m² (Sphere) where size is known; else not counted |
| Designated reception centres and evacuation sectors (e.g. Verviers 3 × 200 beds) | Verviers / Pepinster / Limbourg emergency planning | shelter_capacity.csv | app-chosen shelters |
| Registers of vulnerable people | communes (confidential: aggregate counts only) | prm.csv | not modelled |
| Rescue capacity (boats, teams, people/h) of the Vesdre-Hoëgne & Plateau and Liège zones; Civil Protection | rescue zones, Civil Protection Crisnée | params.json | placeholder 60 people/h, ×3 national (unsourced) |
| Cross-border sheltering agreements | EMRIC, Veiligheidsregio Zuid-Limburg, StädteRegion Aachen | – | none found: recommended action |

## 4. No published value found (stay placeholders in params.json)
Door-to-door effect (set to 0) · squeeze-in +30% · time between the order and departure in a European flash flood (US curve used) ·
persons per car in an evacuation (1.4 everyday occupancy) · lanes per road class · rescue rate and national support factor · Vesdre peak discharge (gauges destroyed; ~600–700 m³/s modelled).
