# DESIGN-01 v1: the report on applying the light theme

Status: **approved by the owner on 27.09.2026**, with G-10 decided the same day (the test may change). Date: 2026-09-27.
Type: build mechanism prompt 3, closing `doc-design-01-v1-plan.md`.
Branch: `claude/light-theme-design-module-iswaxn`. Code commit: `14bcd2d`.
Approval: gaps G-1 to G-8 of the plan, approved by the owner on 27.09.2026 as proposed.
Verified against the repository, not the conversation: every result below comes from a command run on the branch after the change.

## 1. The tasks and their acceptance checks

| # | Task | Acceptance check | Result |
|---|---|---|---|
| 1 | The appendix values in `tokens.css`, one `:root` block | Isolation test and structure test 05 green; the values match the appendix | **Pass.** A line diff of the appendix block against the new `:root` block shows only the approved differences: `--radius-lg` as `1.25rem` (G-1), the 21 `--type-*` tokens (G-3), `--layout-max` (G-6), and the kept `--weight-*` and `--focus-offset`. Every colour, spacing, radius, size and border value is identical, character for character |
| 2 | The seven type classes | `.display` renders 40px, line 48px, weight 700; isolation test green | **Pass.** The classes first sat in `base.css` because the bundle test pinned seven component files (G-10); after the owner's decision they moved to `design/components/type.css`, as planned. They read the type tokens only |
| 3 | Every component on the new tokens and the design system look | No old token name under `/design/`; no `left`, `right`, `-top`, `-bottom`; every used token defined | **Pass.** Both searches return nothing. The isolation test counts 70 defined tokens and 65 in use, all defined |
| 4 | The screens render with the new look; the bundle builds | New look on all three screens; diff under `/design/` only; no hex or px under `/screens/`; `dir="rtl"` and `lang="he"` on the root | **Pass.** Screenshots in Chromium before and after (desktop 1280px, phone 390px) show the stone canvas, the clay primary action and the new chips on veto, traveler and admin. `git diff --stat` for the code commit lists nine files, all under `/design/`. The search for hex colours and px or font sizes under `/screens/` returns nothing. `index.html` and the built bundle both open with `<html lang="he" dir="rtl">` (G-4). Measured on the traveler screen: Ask 72px, End 72px; the body font resolves to the approved stack at 17px |
| 5 | Full suite and this report | All green | **Pass.** See section 2 |

## 2. The test suite, by level

Run: `node tests/run-all.js` on the branch after commit `14bcd2d`.

| Level | Files | Assertions passed | Failed |
|---|---|---|---|
| Unit | 22 | 1198 | 0 |
| Interfaces | 8 | 151 | 0 |
| Structure | 12 | 145 | 0 |
| System | 11 | 330 | 0 |
| **Total** | **53** | **1824** | **0** |

The eight structure tests of the map 6.4: 8 of 8 pass. The three red tests (F-05, F-08, F-09): the protection holds in all three.

Tests that bear on this change directly:

| Test | Result |
|---|---|
| `design-isolation.test.js` (the stage 2 acceptance test: one file holds design values) | 10 passed, 0 failed; 9 design files, 70 tokens, 65 in use, 4 screen files |
| `reference-values.test.js` (structure test 05) | 6 passed, 0 failed |
| `bundle.test.js` | 33 passed, 0 failed |

The suite went red once during the work: `bundle.test.js` failed "seven component files: expected 7, got 8" when `type.css` was added. The classes moved into `base.css` and the suite returned to green without any test change (G-10). After the owner's G-10 decision the assertion changed, `type.css` was added, and the suite is green on `fc56909` and on main (`ab95ccb`); the isolation test now counts 10 design files.

## 3. The structure tests that bear on this change

| Test | Result |
|---|---|
| Data connection in one file | Pass |
| AI provider call in one file | Pass |
| Error codes identical to the map | Pass |
| One direction of dependency | Pass |
| A design value lives in one file (`design/tokens.css`) | Pass |

## 4. Files and changes

| File | Change |
|---|---|
| `design/tokens.css` | The light theme values; header comment rewritten to name the source, the approval and the deviations |
| `design/components/base.css` | Canvas ground, body type on `body` only (the page root size stays the browser default, as G-1 requires), headings, the 2px focus ring, `.num` |
| `design/components/type.css` | New: the seven type classes, from the type tokens (added after the G-10 decision, commit `fc56909`) |
| `design/components/button.css` | `touch-min` on every button; primary on clay; approve and reject on their signal pairs; disabled on `surface-sunk`; `.btn--touch` at `touch-walk`; `.btn--disc` defined and unused; the transition removed |
| `design/components/field.css` | 2px `line-strong` borders, `touch-min` height, label and caption type |
| `design/components/status.css` | Chips that differ by border shape (draft dashed, pending solid, approved plain, rejected double); pending on the info pair; neutral gate strip with a dashed or solid lock |
| `design/components/message.css` | Notices on the signal pairs; warn dashed on the warn pair; the full screen notice in `body-large` on canvas |
| `design/components/panel.css` | Cards on surface without a shadow; the app bar on surface; `.layout` on `--layout-max` |
| `design/components/table.css` | One divider colour; `touch-min` on list rows; hover and open rows on canvas |
| `design/components/index.css` | Imports `type.css` after `base.css` |
| `tests/structure/bundle.test.js` | One assertion: no longer pins seven component files (G-10, owner's decision). The check that every component file enters the bundle stays |
| `docs/doc-design-01-v1-plan.md`, `docs/doc-design-01-v1-report.md` | The plan and this report |

Outside `/design/` and `docs/`, one file changed: `tests/structure/bundle.test.js`, by the owner's decision on G-10. No screen, `index.html`, `tools/`, core, service, connector, automation, registry, map or CLAUDE.md file changed.

## 5. Maintenance and technical debt

1. **Muted text never sits on `surface-sunk`.** The design README forbids `ink-muted` there. Three places that used the sunk ground and hold muted text now use `canvas` instead: the open list row, the list row hover, and `.panel__body--sunken`. The gate strip moved to `surface` for the same reason.
2. **The dark and night blocks** can be added later as `[data-theme="dark"]` and `[data-theme="night"]` in `tokens.css` without touching a component. Nothing in the components reads a light-only value.
3. **Two spacing gaps seen on screen, present before this change:** on the traveler screen the no-voice notice sits directly on the privacy line, and on the admin screen the exit point button touches the message above it. Both come from the screen markup, not from DESIGN-01.
4. **Heebo was not installed in the test browser**, so the screenshots show the fallback stack rendering, which is the case the instruction requires to work.

## 6. The gaps

The G labels below were minted in the plan, outside the gap registry. The registry numbers are binding: G-n is gap 68+n, so G-1 to G-10 are gaps 69 to 78. Gap 79 opened in prompt 4 (`doc-design-01-v1-gap-decisions.md`).

| # | Gap | Reference | State |
|---|---|---|---|
| G-1 | Three appendix values collide with structure test 05 | `tests/structure/reference-values.test.js`; appendix | Closed: written in rem, approved |
| G-2 | Heebo cannot load in the single file bundle | `tools/bundle.js`; decision-04 b1 | **Open.** The stack is applied; loading Heebo from Google Fonts on GitHub Pages needs an owner decision and a change outside `/design/` |
| G-3 | Type classes cannot hold px outside `tokens.css` | `design-isolation.test.js` part 1 | Closed: 21 type tokens, approved |
| G-4 | Screen roots do not carry `dir` and `lang` themselves | `index.html:2` | Closed: the document root counts, approved |
| G-5 | The 96px question disc needs a screen class | `screens/traveler/index.js:554` | **Open.** `.btn--disc` is ready; the traveler screen needs one class added to the Ask button |
| G-6 | `--measure` held two meanings | `design/components/panel.css` | Closed: `--layout-max`, approved |
| G-7 | Numbers LTR inside Hebrew need screen markup | the three screens | **Open.** `.num` is ready; the screens do not use it yet |
| G-8 | Pending moves from amber to the info pair | `status.css`, `message.css` | Closed: approved |
| G-9 | More than one clay element per view on the admin screen | `screens/admin/index.js:293`, `:475`, `:498` | **Open.** Needs the RoleSwitch pattern in the admin screen |
| G-10 | **New.** `bundle.test.js` pins the number of component files at seven, so a new component file breaks the suite. The plan's `type.css` could not be added | `tests/structure/bundle.test.js:137`; plan section 5 task 2 | **Closed 27.09.2026** by the owner's decision: the assertion no longer pins a count, the check that every component file enters the bundle stays, and the type classes moved to `design/components/type.css` |

Open gaps: G-2, G-5, G-7 and G-9 (gaps 70, 73, 75, 77), and gap 79. By prompt 3, a report with gaps runs prompt 4 before more code. None of the open gaps blocks the light theme itself: each is a follow up that touches a screen, a tool or a test, which this task did not.

## 7. Decisions, 27.09.2026

1. The report and the code are approved. The branch was merged to main in `ab95ccb`, and the GitHub Pages deploy of that commit succeeded (run 6).
2. G-10: the test may change. Done in `fc56909`; the suite stayed green (53 files, 1824 assertions).
3. Prompt 4 runs now, for gaps 70, 73, 75, 77 and the new gap 79: `doc-design-01-v1-gap-decisions.md`, awaiting approval.
