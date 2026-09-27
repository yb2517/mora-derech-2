# DESIGN-01 v1: the plan for applying the light theme

Status: **draft, awaiting approval**. Date: 2026-09-27.
Type: build mechanism prompt 2, returned for approval before any code is written, as `doc-design-01-v1-apply-light.md` requires.
Branch: `claude/light-theme-design-module-iswaxn`.
Sources: `doc-design-01-v1-apply-light.md` (the instruction and its appendix), `doc-design-system-v1.md` (the build record), the Smart Guide design system artifact (README, tokens.json, bundle.css), CLAUDE.md (build document 2.10), `doc-build-03-interfaces.md` 1.1, `doc-approvals-log.md` 14, and the repository itself as of commit `a1e09cb`.
Baseline: the full suite is green before any change: 53 test files, 1824 assertions, 8 of 8 structure tests, the three red tests hold.

**No code has been written.** Seven gaps below block a literal application of the appendix. Each needs a decision before task 1 starts.

## 1. The current design module

### 1.1 /design/tokens.css (the `:root` block, verbatim; the Hebrew header comment is left out)

```css
:root {
  --color-ink: #1f2a44;
  --color-ink-soft: #3a4766;
  --color-page: #edeff3;
  --color-surface: #ffffff;
  --color-surface-sunken: #faf8f3;
  --color-text: #1b1f2a;
  --color-text-muted: #5c6478;
  --color-text-inverse: #ffffff;
  --color-line: #d8cfbf;
  --color-line-strong: #b9ad98;
  --color-line-faint: #eee9df;
  --color-approved: #4f6b3a;
  --color-approved-bg: #e9f0e2;
  --color-rejected: #9b3b2e;
  --color-rejected-bg: #f5e5e1;
  --color-pending: #b07a1a;
  --color-pending-bg: #fbf0da;
  --color-draft: #5c6478;
  --color-draft-bg: #e6e8ee;
  --color-focus: #2c5aa0;
  --space-3xs: 0.125rem;
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --font-family: "Segoe UI", "Noto Sans Hebrew", "Arial Hebrew", Arial, sans-serif;
  --font-xs: 0.8rem;
  --font-sm: 0.875rem;
  --font-md: 1rem;
  --font-lg: 1.125rem;
  --font-xl: 1.375rem;
  --weight-regular: 400;
  --weight-medium: 600;
  --weight-bold: 700;
  --line-tight: 1.3;
  --line-body: 1.55;
  --line-reading: 1.7;
  --measure: 72ch;
  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-pill: 999px;
  --border-width: 1px;
  --border-width-focus: 3px;
  --focus-offset: 2px;
  --shadow-panel: 0 1px 2px rgba(31, 42, 68, 0.06);
  --motion-fast: 120ms;
  --motion-ease: ease-out;
}
```

### 1.2 /design/components/

| File | What it holds |
|---|---|
| `index.css` | The entry point: imports the six files below, in order |
| `base.css` | Page defaults, headings, paragraphs, focus ring, `.text-muted`, `.text-sm`, `.text-xs`, `.visually-hidden`, reduced motion |
| `panel.css` | `.panel`, `.app-bar`, `.layout`, `.layout--split`, `.quote`, `.panel__counts` |
| `button.css` | `.btn`, `.btn--primary`, `.btn--approve`, `.btn--reject`, `.btn--touch`, `.btn-row` |
| `field.css` | `.field`, `.field__label`, `.field__control`, `.field__error`, `.field__hint` |
| `status.css` | `.status--{draft,pending,approved,rejected}`, `.status-dot--*`, `.gate`, `.gate__lock` |
| `message.css` | `.message--{error,done,warn}`, `.notice-screen` |
| `table.css` | `.table`, `.list`, `.log`, `.empty` |

The entry point `index.html` loads `design/tokens.css` and `design/components/index.css`, and nothing else.

## 2. The token mapping

### 2.1 Existing tokens with a match

| Existing token | New token | New value | Note |
|---|---|---|---|
| `--color-page` | `--canvas` | `#F3E6DA` | |
| `--color-surface` | `--surface` | `#FBF4EE` | |
| `--color-surface-sunken` | `--surface-sunk` | `#EADBCE` | |
| `--color-text` | `--ink` | `#3B2A22` | |
| `--color-text-muted` | `--ink-muted` | `#6E574A` | Never on `surface-sunk` (design README); components that put muted text on a sunk ground switch to `--ink` |
| `--color-text-inverse` | `--on-clay` | `#FFF8F3` | Only on clay |
| `--color-ink` (primary fill) | `--clay` | `#8A4B3A` | Primary button fill |
| `--color-ink-soft` (primary hover) | `--clay-pressed` | `#6F3A2C` | |
| `--color-line` | `--line` | `#DCC8B8` | |
| `--color-line-faint` | `--line` | `#DCC8B8` | The new system has one divider colour |
| `--color-line-strong` | `--line-strong` | `#8F7464` | |
| `--color-approved`, `-bg` | `--signal-ok`, `-bg` | `#3F5E2E`, `#E1E8D3` | |
| `--color-rejected`, `-bg` | `--signal-danger`, `-bg` | `#96291F`, `#F3D8D1` | |
| `--color-pending`, `-bg` | `--signal-info`, `-bg` | `#35526F`, `#DDE4EC` | The design README gives "submitted" the info pair; the map's canonical name stays `pending`. See gap G-8 |
| `--color-draft`, `-bg` | `--ink` on `--surface-sunk` | | Draft chip: dashed `line-strong` border, as in StatusChip |
| `--color-focus` | `--focus` | `#8A4B3A` | |
| `--font-family` | `--font-sans` | `"Heebo", "Assistant", "Arial Hebrew", system-ui, sans-serif` | See gap G-2 |
| `--space-2xs` | `--space-1` | `4px` | |
| `--space-xs` | `--space-2` | `8px` | |
| `--space-sm` | `--space-3` | `12px` | |
| `--space-md` | `--space-4` | `16px` | |
| `--space-lg` | `--space-5` | `24px` | |
| `--space-xl` | `--space-6` | `32px` | |
| `--space-2xl` | `--space-7` | `48px` | |
| `--radius-sm` | `--radius-sm` | `6px` | Same value |
| `--radius-md` | `--radius-md` | `12px` | Was 10px |
| `--radius-pill` | `--radius-full` | `999px` | |
| `--border-width` | `--border-hair` | `1px` | Dividers |
| `--border-width` (on controls) | `--border-control` | `2px` | Buttons and inputs, per the design README |
| `--border-width-focus` | `--border-control` | `2px` | The ring is 2px in the new system |
| `--measure` | `--measure` | `34em` | Reading text only. See gap G-6 |
| `--font-xs`, `--font-sm` | caption | 14px | See gap G-3 for how type reaches components |
| `--font-md` | body | 17px | |
| `--font-lg` | body-large | 20px | |
| `--font-xl` | heading | 22px | |
| `--line-tight`, `--line-body`, `--line-reading` | the line height of each type style | | Each style carries its own line height |

### 2.2 Existing tokens with no match

| Existing token | Proposal | Why |
|---|---|---|
| `--space-3xs` (2px) | Remove | Chips move to the StatusChip shape (`space-1` and `space-2`) |
| `--weight-regular`, `--weight-medium`, `--weight-bold` | Keep, with `--weight-medium` changed from 600 to 500 | The approved type uses 400, 500 and 700 only; components need the weights as tokens |
| `--focus-offset` (2px) | Keep | The design README fixes a 2px offset; a component file may not hold a px value (see G-1) |
| `--shadow-panel` | Remove | "Shadows only on floating elements"; panels are not floating |
| `--motion-fast`, `--motion-ease` | Remove, with the button transition | "The only transition is the listening ring on the question button" |

### 2.3 New tokens with no existing match (all added, as the appendix has them)

`--stone`, `--ink-disabled`, `--clay-edge`, `--signal-warn`, `--signal-warn-bg`, `--scrim`, `--shadow-raised`, `--space-8`, `--radius-lg`, `--touch-min`, `--touch-walk`, `--question-disc`, `--icon-md`. The warn pair takes over the message warn style (battery 20% warning, crossing silence), which used the pending colour until now.

## 3. The scan of /screens/

Searched `screens/endpoint.js`, `screens/view.js`, `screens/veto/index.js`, `screens/traveler/index.js`, `screens/admin/index.js` for hex and rgb colours, px, rem and em sizes, font declarations, `style=` attributes, `<style>` blocks, `.style` assignments, and `left` or `right`.

| File and line | Hit | Is it styling? |
|---|---|---|
| `screens/veto/index.js:36` to `:39`, `:256` | A field named `style` in the action table (`style: 'btn btn--approve'`) | No. It holds a DESIGN-01 class name, which `createElement` writes to `class` |

**No styling is defined outside DESIGN-01.** The screens hold class names only, and the existing structure check `design-isolation.test.js` already enforces that. The screens do carry behaviours that the new component look cannot reach without a screen change; those are gaps G-4, G-5, G-7 and G-9 below.

Inside `/design/` there is no `left` or `right` property. Three files use physical block properties (`border-bottom`, `border-top`, `margin-bottom`); task 3 converts them to logical ones (`border-block-end`, `border-block-start`, `margin-block-end`).

## 4. The gaps (decisions needed before task 1)

| # | Gap | Where | Proposal | Needs |
|---|---|---|---|---|
| G-1 | **The appendix breaks structure test 05 if pasted literally.** The test forbids any multi digit value of the reference table in a code file, CSS included. The appendix holds `20px` four times (`--radius-lg`, body-large size, label and caption line heights), `40px` (display size) and `15px` (label size); 20, 40 and 15 are reference values (`delivery_gap_s`, `battery_warn_percent`, `geofence_radius_m`, `sample_min` and others) | `tests/structure/reference-values.test.js`, appendix | Write only those three values in rem: `1.25rem`, `2.5rem`, `0.9375rem`. At the browser default of 16px they render exactly 20px, 40px and 15px, so nothing is re-tinted. The page root font size stays at the browser default for this to hold. The test is not changed | Owner approval of the notation |
| G-2 | **Heebo cannot load in the deployed file.** `tools/bundle.js` rejects any `url()` in CSS and any `<link>` left in the bundle (the decision-04 single file rule), and `design-isolation.test.js` rejects an `@import` that leaves `/design/`. A Google Fonts link needs a change to `index.html` and `tools/bundle.js`, both outside `/design/` | `tools/bundle.js:74`, `:370`; `design-isolation.test.js` part 4 | Apply the approved stack only: `"Heebo", "Assistant", "Arial Hebrew", system-ui, sans-serif`. Heebo renders where it is installed; elsewhere the fallback renders, which the instruction already accepts. Loading Heebo from Google Fonts on GitHub Pages becomes a separate decision | Owner decision on the font route |
| G-3 | **The seven type classes hold px values**, and a component file may not hold a length (`design-isolation.test.js` part 1). Components also cannot read a class; they need the sizes as tokens | appendix, `design-isolation.test.js` | Add 21 type tokens to `tokens.css` (`--type-display-size`, `--type-display-line`, `--type-display-weight`, and the same for title, heading, body-large, body, label, caption), holding the appendix values exactly. A new file `design/components/type.css` defines the seven classes from those tokens, and components read the same tokens | Owner approval of 21 token names not in the appendix |
| G-4 | **"Every screen root has dir and lang."** No screen sets them on its own element. All screens mount inside `index.html`, whose `<html lang="he" dir="rtl">` covers them, in the repository and in the bundle | `index.html:2` | Treat the document root as the screen root: acceptance check 5 is verified on `index.html` and on the bundle. No screen file changes | Owner confirmation |
| G-5 | **The 96px question disc needs a screen change.** The traveler screen gives Start, Ask and End the same classes (`btn btn--touch`, with `btn--primary` on Start and Ask). CSS cannot make one of them a disc without a class only that button carries | `screens/traveler/index.js:475`, `:554`, `:557` | Now: `.btn--touch` gets `min-height: var(--touch-walk)`, so all three meet 72px. Later, as its own approved change: the ask button gets a disc class, which DESIGN-01 defines in this task and no screen uses yet | Owner approval of the deferral |
| G-6 | **`--measure` has two meanings in the repository.** `.layout` uses it as the screen width, and paragraphs, quotes and messages use it as the reading line. At the new 34em the admin two column layout collapses to about 580px | `design/components/panel.css` (`.layout`) | `--measure` becomes the reading line only (34em). `.layout` reads a new token `--layout-max` that keeps today's 72ch. The design README allows the veto and admin screens to go wider, with reading text capped at `measure` | Owner approval of one token not in the appendix |
| G-7 | **Numbers LTR inside Hebrew text** needs a wrapper around each number, which is screen markup | the three screens | Add `.num` to `base.css` now (LTR, isolated, tabular figures, as `.sg-num` in the design system). Wrapping the numbers in the screens is a later, separate change. Plain numbers already render correctly under the Unicode bidi rules | Owner approval of the deferral |
| G-8 | **Pending changes colour family.** Today `pending` is amber. The design system gives "submitted" the info pair (blue) and keeps amber for warnings | `status.css`, `message.css` | Follow the design system: `pending` uses `signal-info`, and `message--warn` uses `signal-warn` | Owner confirmation, since it changes meaning by colour |
| G-9 | **More than one clay element per view on the admin screen.** Admin uses `btn--primary` to mark the chosen option in the role switch and in two choice rows, besides its real primary actions. The design README allows one clay element per view | `screens/admin/index.js:293`, `:475`, `:498` | Report only. The fix is the RoleSwitch pattern in the admin screen, which is a screen change and out of scope here | Recorded for a later change |

## 5. The tasks, in execution order

| # | Task | Files | Acceptance: what we do and what we must see |
|---|---|---|---|
| 1 | Replace the values in `tokens.css` with the appendix, in one `:root` block, with the G-1 notation, the G-3 type tokens, the kept weights and focus offset, and `--layout-max` (G-6). Update the header comment | `design/tokens.css` | We run `design-isolation.test.js` and `reference-values.test.js`: both green. We diff the colour values against the appendix: identical, character for character |
| 2 | Add the seven type classes from the type tokens | `design/components/type.css` (new), `design/components/index.css` | We open any screen and apply `.display` in the inspector: 40px, line 48px, weight 700. The isolation test stays green |
| 3 | Move every component to the new token names and the design system look: page on canvas, cards on surface, buttons (primary on clay, secondary with a 2px `line-strong` border, disabled on `surface-sunk`), status chips (draft dashed, pending solid, approved plain, rejected double), gate strip, notices, tables, fields. Controls get `min-height: var(--touch-min)`, walking buttons `var(--touch-walk)`. Physical block properties become logical. Add `.num` (G-7) and the unused disc class (G-5) | `design/components/base.css`, `panel.css`, `button.css`, `field.css`, `status.css`, `message.css`, `table.css` | We search `/design/` for `--color-`, `--space-xs`, `--font-`, `--radius-pill` and `--border-width`: nothing. We search for `left`, `right`, `-top`, `-bottom`: nothing. The isolation test finds every used token defined |
| 4 | Verify the screens: render veto, traveler and admin in Chromium before and after, and build the bundle | none (screenshots go to the report) | We see the stone canvas, clay primary and the new chips on all three screens. `git diff --stat` lists files under `/design/` and `docs/` only. A search for hex colours and px font sizes under `/screens/` returns nothing. `index.html` and the bundle carry `dir="rtl"` and `lang="he"` |
| 5 | Run the full suite, then write the stage report (prompt 3) with its gap table | `docs/doc-design-01-v1-report.md` | `node tests/run-all.js`: all green, 8 of 8 structure tests, the three red tests hold. The report copied to Drive drafts |

## 6. Out of scope

- The dark and night vision themes, and the ThemeSwitcher. Not approved.
- Any change to a screen file, `index.html`, `tools/`, `core/`, `services/`, `connectors/`, `automation/`, `registry/`, the module map or CLAUDE.md. Gaps G-2, G-4, G-5, G-7 and G-9 each need one; none is made here.
- The design system components that have no class in the repository today and need new screen markup: Icon, NowPlaying, AnswerBubble, QuestionInput counter, RouteProgress, BatteryBlock layout, ContentItemCard, AuditRow, Toggle, RoleSwitch, KpiTile.
- Loading Heebo from Google Fonts (G-2).
- The sample Hebrew copy in the design previews, and the locked fallback text, which stays exactly where and as it is.
- Updating the approvals log (open item 2 of the instruction).

## 7. What I need from you

One word per gap is enough: approve the proposal, or give a different one. With G-1 to G-8 approved as proposed, tasks 1 to 5 run on this branch and the change stays inside `/design/` and `docs/`.
