# Coherence check: policy documents vs the app

Checked 30 Oct 2026 ~11:45: Drive docs "Policy Brief" and "Mayor's recommendations" compared with what the app does and shows.
Only app coherence is checked here (the documents themselves were not edited). Jury criterion: the tool and the brief say the same thing.

## Policy Brief vs the app
| Brief says | App does | Coherent? |
|---|---|---|
| Timely preventive evacuation saves lives; early evacuation of vulnerable people | Score = people not evacuated at the peak; upstairs is a last resort; riverbank homes must leave early | ✅ same message |
| Communication: "stay at home" in some scenarios | App treats staying upstairs as a last resort, unreliable near the river | ⚠ different message |
| Tool assesses damage area, shelters, roads, best route, evacuation area, diagrams, 2D/3D | All present (flood map, shelters, safe route A→B, evacuation plan, Diagrams tab, 2D/3D) | ✅ |
| Apps show shelter capacity and occupancy in real time | App **simulates** shelter filling; no live data | ⚠ say "simulates" |
| Inclusive crisis management: help physically challenged and older people | People with reduced mobility not modelled (no data) | ⚠ gap (MISSING_DATA.md) |
| Efficient evacuation of care home residents | Care homes flagged in the water (OSM, few); no separate evacuation time | ⚠ partial |
| Depth–damage functions convert depth to damage | Costs in the Policy tab use JRC curves (Huizinga 2017) | ✅ |
| Cost of action vs avoided damage → probability threshold | Cost–loss diagram, **hypothetical €** (placeholders) | ✅ if labelled hypothetical |
| Evacuation tested on whether the slowest residents reach safety before routes become unsafe | Drill: cohorts, routes closing as water rises, clog queues fed back; slowest (PRM) groups not separate | ⚠ partial |
| Relief distribution monitored by share of demand met per area | Fill-rate diagram for emergency teams (Alert tab dispatch) | ✅ |
| Sewage system modernisation | App only has a "removed by drains" % in the rain scenario (index, not a sewer model) | ⚠ not modelled |
| No tool numbers in the brief yet | App gives (1-in-100): ~18,900 residents and ~7,950 buildings in water; 3,903 + 2,841 places vs ~4,700 needing a public place (25%); 18 schools in the flood; 2,380 riverbank homes; 42 clog points; no cross-border agreement | ⚠ add if the team wants one story |

## Policy Brief Tab 2 (flood drivers) vs the app
| Tab 2 says | App does | Coherent? |
|---|---|---|
| "We reproduced the 2021 flood as a baseline" | Uses the EFAS 1-in-100 map as the closest scenario; 2021 satellite outline incomplete | ⚠ not yet |
| Varied rainfall intensity, soil moisture, bridge clogging, land use | Varies rain intensity and duration, soil soaking, drains, water already in the river, wave speed, people present. **No bridge clogging, no land use** | ⚠ align the list |
| Rainfall intensity +3–19% (attribution) | Rain slider; rain turned into a flood size with 37 years of ERA5 records | ✅ (ERA5 underestimates local rain: 90 mm vs 275 mm at Jalhay) |

## Mayor's recommendations vs the app
| Doc says | App does | Coherent? |
|---|---|---|
| AAL, JRC depth–damage, cost–loss, clearance time, fill rate, NPV/BCR | All exist as diagrams (Diagrams → Policy framework / Costs) | ✅ |
| Hypothetical €30M / €18M / €2M | Same values as placeholders in params.json | ✅ labelled hypothetical |
| "Safe evacuation coverage must not be confused with G-6" | Diagram was titled "UNDRR G-6" → **renamed** "Safe evacuation coverage (inspired by UNDRR G-6)" | ✅ fixed in app |
| Critique of "Evacuated = Population × Reach × Compliance" | Used only in the Impact table (placeholders); the drill is time-based | ✅ consistent with the critique |
| Clearance time must consider congestion and slowest groups | Clog points with queues fed back; slow groups not modelled | ⚠ partial |
| Decision-time reduction 6 h → 2 h is hypothetical | Same placeholder in the Impact table | ✅ |
| SAIDI, Scorecard, fake-news precision/recall, max–min allocation | Not in the app (only listed in the framework diagram as not built) | ⚠ not in app |
