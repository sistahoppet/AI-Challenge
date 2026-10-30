# Coherence check: policy documents vs the tool and the evidence

Checked 30 Oct 2026 ~11:45 against the Drive docs "Policy Brief" (edited 10:28 UTC) and "Mayor's recommendations" (09:36 UTC).
Jury criteria (Annex 4): evidence, policy usefulness, clarity (tool and brief say the same thing), responsible AI.

## Policy Brief: must fix before 13:30
1. **Template leftovers**: "What science tells us" still contains template instructions ("Research RESULTS: paint a general picture…", "Box text", "Figure 1: Name of illustration", Tips). References [1]–[4] are template examples (animal emotions, modular farming, energy prices, Brexit): delete them and renumber.
2. **Wrong area**: intro says "the Belgian provinces of Liège and Limburg". The task is the province of Liège, **Dutch** Limburg and the German Region Aachen.
3. **Death figures**: "at least 243 … 196 in Germany and 39 in Belgium" cites Le Soir / NBC News, which are not in the reference list. 39 in Wallonia matches the Walloon government review (SOURCES.md); check the German figure and add the source.
4. **Care homes**: "early evacuation of care homes, where casualty concentrated in 2021" overstates the evidence. The sources say **older people** (two thirds over 60 in NRW, Thieken 2023; 72% over 60, Thieken 2026). Suggest: "especially older and less mobile residents, including care-home residents".
5. **Contradiction with the tool**: Policy implications suggest telling people to "stay at home". The tool and the evidence say evacuate early; staying upstairs is a last resort and unreliable near the river (~10 houses collapsed in Pepinster, 15/07/2021).
6. **No tool findings in the brief** (clarity criterion: tool and brief must say the same thing). Add 3–4 numbers from the tool, tagged:
   - 1-in-100 flood (≈ July 2021 rain in this valley): ~18,900 residents and ~7,950 buildings in the water; most in Pepinster, Chênée, Verviers [challenge data]
   - shelters: 3,903 places in 8 chosen sites + 2,841 in next best sites vs ~4,700 needing a public place at 25% [assumption, evidence 4.5–13%]; 21 sites capacity unknown; 18 schools inside the flood
   - 2,380 riverbank homes where going upstairs is unreliable [proxy]
   - 42 clog points on minor roads (worst 2.5× capacity, ~22 min queue) → stagger departures by wave
   - no cross-border sheltering agreement found → first action for Anna
7. **Named actor**: recommendations are generic ("crisis management", "awareness"). Address them to Anna (cross-border coordinator) with who/when: e.g. "Before the season: Anna agrees cross-border sheltering through EMRIC; pre-agree next best shelters; tell riverbank homes to leave at the first warning; ask rescue zones for real capacity figures."
8. **Weak links**: "modernisation of the (old) sewage system": no source shows sewers mattered in the 2021 Vesdre river flood (Stucky 2021, Dessers 2023). Keep only as a measure for smaller pluvial floods, or drop. "Help A Friend" app and fake-news detection are not in the tool or the evidence: drop or mark as ideas.
9. **Real-time claims**: "apps indicate the capacity and occupation rate of each shelter": the tool simulates this; it has no live data. Say "simulates".
10. **€ figures**: "Quantifying key decisions" relies on cost–loss and BCR; in the tool these use hypothetical € (placeholders). Say so.

## Tab 2 (flood drivers)
- "we reproduced the 2021 flood as a baseline": not true yet. The tool uses the EFAS 1-in-100 map as the closest scenario; the 2021 outline is incomplete.
- Factors the tool really varies: rain intensity and duration, soil soaking, drains, water already in the river, wave speed, people present. **Bridge clogging is not modelled**: remove it or list it as a limit. Replace the Korean placeholder "[실제 사용한 요인]" with this list.
- Vesdre peak "~600 m³/s" vs ~700 m³/s modelled by ULiège (Erpicum et al. 2022): give a range; gauges were destroyed.

## Mayor's recommendations
- Coherent with the tool's framework (AAL, JRC depth–damage, cost–loss, clearance time, fill rate). The hypothetical €30M / €18M / €2M match the tool's placeholders: keep the "hypothetical" label.
- Its own critique says "Safe Evacuation Coverage must not be confused with G-6": the tool's diagram was titled "UNDRR G-6" → **renamed in the tool** to "Safe evacuation coverage (inspired by UNDRR G-6)".
- Its critique of "Evacuated = Population × Reach × Compliance" applies to the tool's Impact table (placeholders); the drill itself is time-based (closer to HEC-FIA logic).
- Clearance-time critique (slowest groups, congestion): the tool now has clog points with queues fed back; people with reduced mobility are still not modelled (MISSING_DATA.md).
- Tab 3 and Tab 4 are duplicates; Korean notes at the end and the Korean review prompt in the brief should not be in final documents.
