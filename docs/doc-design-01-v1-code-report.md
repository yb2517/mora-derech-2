# DESIGN-01 v1: the report on the code tasks of gaps 73, 75 and 77

Status: **approved by the owner on 27.09.2026; the merge is on hold until stage 9 is merged** (section 7). Date: 2026-09-27.
Type: build mechanism prompt 3, closing section 5 of `doc-design-01-v1-gap-decisions.md`.
Branch: `claude/light-theme-design-module-iswaxn`, on top of main with stage 8 (`d0ea6fe`). Not merged to main.
Verified against the repository, not the conversation: every result below comes from a command or a browser run on the branch.

## 1. What ran, in order

| Step | Commit | What |
|---|---|---|
| Revert | `95c35d1` | The first application of the prompt 4 wording as map 3.12 and build document 2.11 was reverted: stage 8 held those numbers with other approved content. Nothing of it reached main |
| Merge | `b41dc3a` | Main, with stage 8 merged, into this branch. One conflict, in the gap registry, resolved by keeping both lines' entries |
| Documents | `1496fc0` | The approved wording applied as **map 3.15** and **build document 2.14**, after stage 8's 3.14 and 2.13. Gaps 70, 72 and 79 closed |
| Task 1 | `828f74b` | Gap 77: selection marked with `aria-pressed`, not clay |
| Task 2 | `e22dc18` | Gap 73: the question button is a 96px disc |
| Task 3 | `8c1fc73` | Gap 75: numbers left to right inside Hebrew text |

## 2. The tasks and their acceptance checks

| # | Gap | Acceptance check | Result |
|---|---|---|---|
| 1 | 77 | On the admin screen, at most one clay element per view; a screen reader announces the chosen option; suite green | **Pass for the selection, with one gap opened.** The role switch, the agreement scope and the content contribution toggle now mark the choice with `aria-pressed="true"` inside a `.btn-group` rail. Measured in Chromium, owner role: before, three clay buttons ("מכסה גם תרומת תוכן", "רישום הסכם", "נעילת המסלול"); after, two ("רישום הסכם", "נעילת המסלול"), with "בעלת הפרויקט" and "מכסה גם תרומת תוכן" pressed. The two left are both primary actions in separate panels, which the decision kept on clay. "At most one per view" is therefore not met, and gap 89 records it |
| 2 | 73 | The Ask button is a 96 by 96 circle, End stays at least 72px; suite green | **Pass.** Measured in Chromium at 390px: Ask 96x96, radius 999px; End 72px high |
| 3 | 75 | No template string under `/screens/` puts a number in a Hebrew sentence without `num`; "M-06: 0" reads in order; suite and isolation test green | **Pass.** The only template strings left carry names and labels, not numbers. The gate strip reads "M-06: 0". A browser check showed that a coordinate pair in a Hebrew line displayed reversed before this change ("35.2167 ,31.7823") and now reads "31.7823, 35.2167" |

A first version of task 3 wrapped only the digit, and the gate strip read "0 :M-06". It was corrected before the commit: an expression that is left to right as a whole (an identifier with its value, a coordinate pair) is wrapped as one unit. The rule is written in `screens/view.js`.

## 3. The test suite, by level

Run: `node tests/run-all.js` on `8c1fc73`.

| Level | Files | Assertions passed | Failed |
|---|---|---|---|
| Unit | 22 | 1265 | 0 |
| Interfaces | 8 | 156 | 0 |
| Structure | 12 | 157 | 0 |
| System | 12 | 365 | 0 |
| **Total** | **54** | **1943** | **0** |

The eight structure tests of the map 6.4: 8 of 8 pass. The three red tests hold. `document-versions.test.js`: 12 passed, map 3.15 and build document 2.14 agree. `design-isolation.test.js`: 10 passed, 10 design files, 4 screen files; no hex colour or px value under `/screens/`.

No test changed. The system tests read the screens by text content, and the wrapped numbers leave the text content as it was.

## 4. Files and changes

| File | Change |
|---|---|
| `docs/doc-module-map-v3.md` | Version 3.15: the design system documents in the sources; the DESIGN-01 row points to them |
| `CLAUDE.md` | Version 2.14: the design documents as a binding source for design; the font row; the screen root in the `index.html` line; the next step line |
| `design/components/button.css` | `.btn-group`, the `aria-pressed` selected state, the empty rail hidden; `.btn--disc` takes `body-large` bold |
| `screens/view.js` | `num()`, with the rule for wrapping an expression as one unit |
| `screens/admin/index.js` | Three choices on `aria-pressed`; numbers wrapped |
| `screens/traveler/index.js` | The Ask button on `.btn--disc`; numbers wrapped |
| `screens/veto/index.js` | Numbers wrapped |
| `docs/doc-gap-registry.md`, `docs/doc-design-01-v1-gap-decisions.md`, this report | Records |

No core, service, connector, automation, registry, test or tool file changed.

## 5. Maintenance and technical debt

1. **The metrics table overflows its panel** on the admin screen at 1280px: the "לא עובר" chips sit outside the panel edge. Present in the screenshots before this work; it comes from the table's width in a narrow side column.
2. **Two spacing gaps from the screen markup**, reported before and still present: the no-voice notice sits directly on the privacy line, and the exit point button touches the message above it.
3. **The current role stays disabled** in the role switch, as before. It now shows as selected rather than greyed out.

## 6. The gaps

| # | Gap | Reference | State |
|---|---|---|---|
| 70, 72, 79 | Font route, screen root, binding design sources | map 3.15, build document 2.14 | Closed |
| 73, 75, 77 | Disc, LTR numbers, selection without clay | commits `e22dc18`, `8c1fc73`, `828f74b` | Closed |
| **89** | **New.** The admin screen still shows two clay primary actions in one view: "רישום הסכם" and "נעילת המסלול" for the owner (measured), "יצירת פריט" and "אומת בשטח במיקום המכשיר" for the content team when an item is open (from the code). The design system allows one clay element per view, and the gap 77 decision kept `btn--primary` for primary actions without saying which is primary when a screen has several panels | `screens/admin/index.js` lines 339, 404, 509, 575; README of the design system, "One clay element per view" | **Open, not blocking.** Needs an owner decision: one primary per role view (and which), or each panel counts as a view on the wide admin screen |

A report with a gap runs prompt 4 before more code. Gap 89 is the only one.

## 7. Decisions, 27.09.2026

1. The report and the merge are approved. The merge is **on hold**: the stage-8 branch, now carrying stage 9, used map 3.15, build document 2.14 and gap 89 for other approved content, and neither line is in main yet.
2. Numbering: by the owner's decision, **stage 9 keeps those numbers**. After stage 9 is merged to main, this branch merges main, its map and build document become the next versions after stage 9's, its gap 89 takes the next free registry number, the overlaps in `design/components/button.css`, `design/tokens.css` and the traveler screen are resolved, the suite and the screenshots are re-run, and the branch is merged.
3. Gap 89: **one clay element per panel**. The owner view keeps both "רישום הסכם" and "נעילת המסלול" on clay, since they sit in separate panels. No code change; the rule goes into the documents with the renumbering.
4. The map "3.15", build document "2.14" and gap decisions copies were taken out of `prd-update-inbox` and moved to the archive, so the PRD process does not receive two different 3.15 maps. They are uploaded again after the renumbering.
