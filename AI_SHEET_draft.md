# AI sheet: draft to copy into the Annex 7 template

> Draft written by the AI from the work log of this project. **The team must check every line, change what does not
> match what you did, and fill the parts marked [TEAM].** No names or personal data: team number only.

**Team number:** [TEAM]

**AI tools used:** Claude (Anthropic), model Claude Opus 5.5, used in the Claude Code desktop app (code, data
scripts, analysis, web search for sources). [TEAM: add any other tool you used, e.g. the Claude API key in Colab]

---

## 1. How you used AI at each stage

| # | Stage | Level (tick one) | AI misled us here |
|---|---|---|---|
| 1 | Understanding the case and data | Team led, AI assisted or checked | ☐ |
| 2 | Loading and preparing data | AI and team together | ☐ |
| 3 | Analysis and code | AI did most of it | ☑ |
| 4 | Maps and charts | AI did most of it | ☑ |
| 5 | Desk research and sources | AI and team together | ☐ |
| 6 | Interpreting results | AI and team together | ☑ |
| 7 | Recommendations and brief | [TEAM: depends on how you write the brief] | ☐ |
| 8 | Policy tool | AI and team together | ☑ |

**1. Understanding the case and data.** The team set the direction: the Vesdre valley as study area, the mayor and
then Anna as the person the tool serves, and the rule "real data only, nothing random". We gave the AI the challenge
brief, Anna's framework and the four questions (Q1–Q4); the AI summarised what each dataset (EFAS, GHS-POP,
GHS-OBAT, Copernicus EMS) can and cannot answer. The team decided the scope; the AI flagged limits, e.g. that the
2021 satellite outline covers only part of the valley.

**2. Loading and preparing data.** The AI wrote the export scripts (cut the four datasets to the study area, add
ground height, roads, key sites, building outlines and town names from OpenStreetMap). The team chose the data access
method and ran the app on our machine. When the OpenStreetMap API was blocked, the AI proposed map tiles as a
fallback; we accepted it and its "external source" label.

**3. Analysis and code.** The AI wrote most of the code: flood depth per flood size, safety zones, shelter scoring,
car routing on streets, the evacuation model over time, costs and the "best actions" search. The team set the
requirements (cars, shelters filling up, next best shelter, choices before the run) and tested every version on
screen. Several errors were found this way (section 3).

**4. Maps and charts.** The AI built the map (2D/3D, real building outlines and heights, water animation), the
diagrams and the report. The team judged readability from screenshots and asked for many changes: less text, a
layer toolbox, icons, legends, titles and scale bars on map figures, buildings lower than the water shown submerged.

**5. Desk research and sources.** The AI searched for depth–damage curves (JRC), cost values, the Sphere shelter
standard (3.5 m² per person) and figures on 2021 damage; each value is shown with its source in the app.
[TEAM: say which sources you opened and checked yourselves, and add your own desk research for Q2.]

**6. Interpreting results.** The team and the AI read the results together. Key readings: the first shelters are full
before the water arrives, so next best sites must be agreed in advance; Pepinster, Chênée and Verviers have the most
residents in the water at 1-in-100. The AI first planned to show the 2021 satellite check as a headline score; on
checking, it was not meaningful (section 3).

**7. Recommendations and brief.** [TEAM: describe how you wrote the brief; who drafted, what the AI changed, what you kept.]

**8. Policy tool.** The tool is our main product. The team defined what Anna should see and do; the AI implemented it
and the team reviewed each version on screen. The team's screenshots caught errors the AI's own tests missed.

## 2. Biggest difference, and biggest letdown

AI made the biggest difference in speed: a working map with real data, routing and an evacuation model was possible in
two days, which our team could not have coded alone. It let us down most when it produced results that looked right
but were not: routes crossing flooded streets, and a model that showed 0 people in danger in every scenario. Both
were only caught because we looked at the screen and asked "does this make sense?". It also tended to add features
and text faster than a non-specialist can read, so we had to push for a simpler screen.

## 3. Where the AI got it wrong

| # | Stage | What went wrong (one line) | How you noticed (one line) |
|---|---|---|---|
| 1 | Policy tool | The safe A → B route crossed flooded streets: it read water per grid cell, wider than the water drawn. | Team screenshot of a route through the water in 3D. |
| 2 | Analysis and code | A rain scenario rarer than the maps gave 53,000 people in water (extrapolated beyond the data). | The number was far above the 1-in-500 map; capped at the rarest map. |
| 3 | Maps and charts | Merged building shapes gave one building 280,000 m², inflating shelter places. | Implausible capacity of one school in the shelter list. |
| 4 | Interpreting results | The evacuation model showed 0 people in danger in every case, because the water rise (21 h) is illustrative. | All choices gave the same result; we added a "water rises in" setting and say it is an assumption. |
| 5 | Interpreting results | The AI planned a "model vs 2021" headline score; the 2021 outline here is one 0.12 km² patch 2.7 km from the river. | Score came out 0%; the AI checked the data and we now report the check as inconclusive. |
| 6 | Analysis and code | Shelters with unknown size silently got a default of 500 places each, inflating capacity. | Reading the code against the brief: 116 schools/sports halls have no building outline. Now 0 places, shown in amber "capacity to be checked". |
| 7 | Policy tool | The Evacuate tab said shelters are "not flooded in 2021", but the code never checked it. | Comparing on-screen text with the code. Rule added. |
| 8 | Policy tool | A 30 km/h driving speed was labelled "on foot"; the decision card printed "walking speed 8.3 m/s". | Code review. Labels fixed; speed now 20 km/h average evacuation speed (FLOODsite, proxy). |
| 9 | Interpreting results | "Upstairs at home" counted as safe, so "best actions" could favour keeping people home. | The team questioned it; research found ~10 houses collapsed in Pepinster in 2021. Upstairs is now a last resort, counted as not evacuated; riverbank homes never count as safe upstairs. |
| 10 | Loading and preparing data | The 2021 satellite file held only 2 small monitoring polygons (main outline not exported), so "inconclusive" came from our export, not the data. | Opening the file contents. Logged as a pipeline gap. |
| 11 | Analysis and code | The app assumed every evacuee needs a public shelter; evidence shows ~4.5% went to public centres in Limburg 2021. | Desk research. Slider added (default 25%, large margin). |
| 12 | Desk research | Behaviour values (door-to-door +10 pts, rescue 60 people/h, ×3 national support, +30% squeeze-in) had no source. | Research found none: now marked "assumption" or "placeholder" in a parameter file (data/params.json) shown in the app. |
| 13 | Desk research | Sources disagreed (Pepinster deaths 7 / 6 / 1; one paper's text vs table; a summary listed Amblève/Ourthe gauges as Vesdre stations). | Cross-checking sources; disputed figures shown as a range or not used. |
| 14 | Analysis and code | The road-delay formula (BPR) gave only 2 min for 42 clogged road pieces, which looked reassuring but was misleading on short pieces. | Reading the result critically; added a queue estimate (≈22 min wait at the worst point) and said delays are not fed back into the run. |
| 15 | Analysis and code | Parallel AI code agents broke a function and guessed each other's names. | Syntax check (node --check) and a headless-browser test on our real data after every change. |

## 4. Three key prompts

| # | Prompt (lightly edited) | Tool | Why it worked (one line) |
|---|---|---|---|
| 1 | "In this app we use real data and real maps … things should not be random … if you have questions, ask me." | Claude Code | Set a hard rule: every number traced to data, a source or a marked assumption. |
| 2 | "First inspect the existing project … Do not replace real simulation calculations with fake values or decorative animations. Connect all controls to the actual simulation parameters." | Claude Code | Stopped cosmetic fixes; every slider now changes the model. |
| 3 | "This is wrong: you should not be able to go through a flood, and roads touched by water should not be used." (with screenshot) | Claude Code | A concrete visual counter-example made the AI find the real cause, not patch the symptom. |

## 5. How you verified the results

- Looked at every version on screen and compared it with what we know of the 2021 flood (where the water was, which towns).
- Checked numbers against the data: residents and buildings in the water per flood size, shelter places (3,903) against
  people to move (18,878), and against each other (rarer floods must not give fewer people).
- The AI ran an automatic test after each change: the app loaded on our real data in a headless browser, with no errors
  and the key numbers printed.
- Sources: each cost and standard has its reference shown in the app. [TEAM: list the ones you opened yourselves.]
- Sensitivity: each assumption moved up and down to see which one changes the result most (in the report).
- The 2021 satellite outline was compared with the model; the result (inconclusive) is reported, not hidden.
- After the AI code changes of 30 Oct: syntax check of every file and a headless-browser run on the real data (8 shelters, 3,903 places, 18,878 people to move, report page opens).
- Every research value was given a source link and a label (official, peer-reviewed, press, proxy); disputed values are not used. List in SOURCES.md.

## 6. Limits and uncertainty

- The timing of the water is illustrative (no hydraulic model): "how fast the water rises" is our assumption.
- EFAS maps are about 90 m: small streams, blocked bridges and new defences since 2021 are not represented.
- The 2021 satellite outline covers only a small part of the Vesdre, so the flood maps are not validated against 2021 here.
- Behaviour settings (people who follow the order, time to get ready, speeds, rescue rate) are assumptions.
- Shelter places (floor area ÷ 3.5 m²) are an upper bound; real capacity depends on beds, toilets and staff.
- Costs are proxies from European curves; GHS-OBAT building-use codes were not checked one by one.
- Towns are assigned to the closest OpenStreetMap place name, an approximation at the edges.
- Several parameters are placeholders until the data arrives (rescue rate, national support, squeeze-in, door-to-door): see the Data tab "Assumptions and sources".
- Mobilisation times and road capacities come from US studies (proxy); clog delays are estimated but not fed back into the run.
- "Riverbank" homes are estimated from the flood grid (~80 m), because the river lines could not be downloaded.
- Much of the code was written by AI: we tested it but cannot exclude errors we did not see.
