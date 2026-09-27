# Stage 9 plan: theme switcher and route progress

Status: **approved by the owner on 27.09.2026**, with D1 to D5 as recommended. Work runs on the branch `stage-8`, the branch assigned to this session, restarted from main at ea15bcb.
Date: 27.09.2026
Type: build mechanism prompt 2. It is returned for approval before any code is written.
Base: main at ea15bcb. The full suite is green: 54 files, 1954 assertions, 8 of 8 structure tests, and the red tests hold.

## 1. What you asked for, and where it already exists

| Request | What already exists | What is missing |
|---|---|---|
| **A light / dark / night-vision switch** | The approved design system (`doc-design-system-v1.md`) already defines **three themes on one token set**, and a **ThemeSwitcher** component. Only the light theme was approved and applied, in DESIGN-01 v1. Dark and night vision are marked "awaiting approval". The v1 report says the other two blocks can be added to `tokens.css` "without touching a component" | The dark and night values in `tokens.css`, the switcher itself, and your approval of the two themes |
| **A progress bar for the route** | The design system has a **RouteProgress** component: dots along the route in right-to-left order, with the text "נקודה 3 מתוך 5" underneath so it still reads in night vision. The route's 14 stops are in the data (`site.stops`), and the geofence already knows the current stop | A place for it in the traveler screen, and a way for the screen to learn the list of stops. `screen-traveler` has no action that reads the route today |

The exact colour values for all three themes come from the design system's `tokens.json`: 23 colours per theme. Nothing will be invented. Night vision uses red and near-black only, with one documented contrast exception: secondary text at 3.8:1, for large or non-essential text.

## 2. Why this is stage 9 and needs documents first

Neither feature has a row in the map. DESIGN-01 in map 3.3 does not mention themes, and FE-05 does not mention progress. By the build rules, the map changes before the code. So task 0 is prompt 4: map 3.15 and build document 2.14, with a stage-9 row. The same task also closes the gaps from my stop report (89, 90 and 91).

## 3. Decisions I need from you

| # | Decision | My recommendation | Why |
|---|---|---|---|
| D1 | Approve the **dark and night-vision themes** exactly as they are in the design system | **Approve as is** | They were built and checked for contrast together with the light theme. Changing values now would mean a new design round |
| D2 | **Where the switch appears** | **On all three screens**, in the shared page frame that the entry point builds. On the traveler screen, show it **before the session starts and after it ends**, not during the walk | The design system rule is "offer it at session start, not during the walk" (the zero-touch walk). Its assumption A-4 is "all three modes apply to all screens". One place in the frame means no screen file changes to get the switch |
| D3 | **Remembering the choice** | **(a)** The first look follows the phone's own light or dark setting. Night vision only when chosen. The choice lasts for the visit | Remembering it across visits needs browser storage. Iron rule 3 and structure test 01 allow **only the repository** to touch storage. The alternatives are **(b)** a URL parameter, `?theme=night`, like `mode=test`, or **(c)** remembering it on the phone, which needs your written exception to iron rule 3 for a display preference |
| D4 | **What "progress" counts** | **Distinct stops reached in this session, out of the route's 14**, shown as dots plus "נקודה 5 מתוך 14" | Stops, not items: the route has 14 stops and 19 items. Distinct, so walking back to a stop does not count twice. The last stop is what the completion metric (M-02) already uses |
| D5 | **How the traveler screen learns the route** | **The entry point hands the screen the list of stops**, as it already hands it the current stop and the battery level. No new allow-list row | This follows gaps 52 and 55: connections made at assembly, not new actions. The alternative is adding `getSite` for `screen-traveler` to the allow list, which grows the production list from 46 to 47 rows and changes map 4.2, 4.3 and 4.4 |

## 4. Tasks, in order

| # | Task | Module and files | Acceptance: what we do and what we must see |
|---|---|---|---|
| 0 | Prompt 4: map 3.15 (3.3 DESIGN-01: three themes and the switcher; FE-05: route progress; 7: the stage-9 row) and build document 2.14 (section 6 row, the "next stage" line). Register the gaps | `docs/` | The drafts are approved by you. `document-versions.test.js` is green |
| 1 | Add the dark and night blocks to the tokens, with the values verbatim from `tokens.json` | DESIGN-01: `design/tokens.css` | Every value matches the design system character for character. A new check: every night colour is red or near-black, with no white, blue, green or yellow. The design-isolation test is green. **No component file changes** |
| 2 | The theme switcher: a three-way control (אור, כהה, ראיית לילה) that only sets `data-theme` on the page root. Default and memory per D3 | DESIGN-01: a switcher class in `design/components/`; the entry point: `index.html` | Switching changes only `data-theme`. **No screen file changes** for the look to change. The traveler screen hides the switch while walking (D2). Structure tests 01 (storage) and 03 (screens) stay green |
| 3 | Route progress on the traveler screen: dots in right-to-left order, and the text "נקודה k מתוך 14" | FE-05: `screens/traveler/index.js`; DESIGN-01: a progress class; `index.html` hands over the stops (D5) | In test mode, arriving at points in order moves the bar one stop at a time. Arriving twice at the same stop does not move it. Two items at the same stop count once. Before the session starts the bar is empty. The screen still sends envelopes only (structure test 03) |
| 4 | Check in the real browser: all three screens in all three themes, and the bundle | none (screenshots go to the report) | The same screen in the three themes differs in colour only. Night vision shows nothing white. The bundle is built and opens |
| 5 | Full regression, stage report (prompt 3), and the merge on your word | `docs/doc-stage-09-report.md` | `node tests/run-all.js` is green, 8 of 8, and the red tests hold |

## 5. Explicitly out of scope

- The Heebo font (gap 70, still open).
- The other design components with no markup yet: NowPlaying, AnswerBubble, the question counter, BatteryBlock, the disc button (gap 73) and the LTR number wrapping (gap 75).
- Wayfinding and "you are off route" (F-14, deferred).
- Any new field, error code, reference key or entity. Remembering the theme stays within the D3 choice.
- Place photos. Night vision would hide them, but there are none in the app today.

## 6. Gates

- **Your approval of this plan and of D1 to D5.**
- **Prompt 4** (task 0) is approved before task 1.
- The merge to main is also the deployment, and it waits for your word.

A reply of "approved" accepts D1 to D5 as recommended. Or give a different choice for any of them.
