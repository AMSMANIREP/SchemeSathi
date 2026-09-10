---
name: Scheme Sathi
description: A travel-document interface for public benefits — a live gate board of schemes and a printable pass of next steps.
colors:
  ink: "#0b0d10"
  slate: "#1c2127"
  steel: "#5c6269"
  mist: "#9aa0a6"
  panel: "#e6e8eb"
  rule: "#dcdfe3"
  surface: "#ffffff"
  paper: "#f2f2f0"
  alert: "#ffd400"
  alert-ink: "#4a3c00"
  go: "#10614a"
  go-field: "#e3f0ea"
  hold: "#7a5510"
  hold-field: "#f8eed6"
  stop: "#8f2b21"
  stop-field: "#f6e4e1"
  unknown: "#5b6169"
  unknown-field: "#e8e9ea"
  changed-field: "#fffdf2"
typography:
  display:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.45rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.014em"
  subtitle:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.008em"
  lede:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-small:
    fontFamily: "Google Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Google Sans Code, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.16em"
  control-label:
    fontFamily: "Google Sans Code, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.13em"
  board-title:
    fontFamily: "Google Sans Code, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.18em"
  data:
    fontFamily: "Google Sans Code, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
rounded:
  hairline: "3px"
  chip: "4px"
  control-sm: "5px"
  control: "7px"
  field: "8px"
  surface: "10px"
  composer: "12px"
  pill: "99px"
spacing:
  hair: "2px"
  xxs: "6px"
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  xxl: "28px"
  section: "44px"
  page-top: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-ghost-hover:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.stop}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-danger-hover:
    backgroundColor: "{colors.stop}"
    textColor: "{colors.surface}"
  button-small:
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.steel}"
    rounded: "{rounded.control}"
    width: "34px"
    height: "34px"
  icon-button-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.alert}"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.steel}"
    typography: "{typography.label}"
    rounded: "{rounded.control-sm}"
    padding: "7px 11px"
  filter-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "18px 20px"
  board-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.board-title}"
    padding: "12px 18px"
  board-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0 18px"
    height: "58px"
  board-row-changed:
    backgroundColor: "{colors.changed-field}"
  pass-head:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    padding: "12px 18px"
  pass-segment:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    padding: "12px 14px"
  status-go:
    backgroundColor: "{colors.go-field}"
    textColor: "{colors.go}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  status-hold:
    backgroundColor: "{colors.hold-field}"
    textColor: "{colors.hold}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  status-stop:
    backgroundColor: "{colors.stop-field}"
    textColor: "{colors.stop}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  status-unknown:
    backgroundColor: "{colors.unknown-field}"
    textColor: "{colors.unknown}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  changed-tag:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.alert-ink}"
    rounded: "{rounded.hairline}"
    padding: "2px 6px"
---

# Design System: Scheme Sathi

## Overview

**Creative North Star: "The Gate Board and the Pass"**

Scheme Sathi is built from two physical objects a traveller already trusts. The **board** is the departures display: every scheme is a row, the columns are fixed, the verdict that all rows share is stated once at the head instead of repeated fifty times, and a change holds a mark on the row until it has been seen. The **pass** is the segmented travel document: an ink header, a body, dashed cells that each carry one labelled figure, a perforated edge, and a stub. It is meant to leave the screen — a citizen prints it and carries it into an office.

The register is ink on paper and deliberately unglamorous. The ground is a warm-grey paper (`paper`), every readable surface is white with a single hairline border, and the reading field is achromatic top to bottom. Colour is not atmosphere here; it is signal. One alert yellow is held back for change and attention, and the four status colours are confined to pills, small marks and a 3px row edge. Nothing in the system dramatises. The seriousness is in the alignment, the tabular figures, and the fact that every figure carries a mono uppercase label above it.

The world deliberately refuses the govtech default it was designed against: the white page of rounded cards with a blue call-to-action and a friendly illustration. That arrangement makes every scheme look equally plausible. It also refuses any resemblance to an official government portal — this is a private advocate standing beside the citizen, and the visual register says so by being a travel document rather than a seal.

**Key Characteristics:**
- Ink-on-paper, light theme, achromatic reading field
- Two structural objects — the board (rows) and the pass (segmented cells)
- Hairline borders and flat surfaces; no drop shadows anywhere
- Mono uppercase labels above every figure; tabular numerals for all data
- One alert yellow, reserved; four status colours confined to pills and edges
- Print treated as a shipping surface, not a fallback
- Desktop-only geometry: a single 1180px workspace, no breakpoints

## Colors

An achromatic ink-on-paper palette with one held-back yellow and a four-value status set that never touches running text.

### Primary
- **Ink** (`ink`): The near-black that carries every primary surface: button fills, the board bar, the pass header, the intro header, active nav underline, focus rings, and all body text. When something in this system is emphatic, it is ink, not a colour.
- **Alert Yellow** (`alert`): Held for change and attention only — the left edge and tinted field of a changed board row, the CHANGED tag, the saved-state icon button, the signal block on a notice, text selection, and the ink-fill button on hover. It is never used to decorate a surface, tint a panel, or brighten a heading.
- **Alert Ink** (`alert-ink`): The only text colour permitted on an alert-yellow ground; it clears contrast where black-on-yellow would glare.
- **Accent Green** (`accent-go`, `#1a8767`, with `accent-go-soft` `#d7ece3`): The affirmative accent, drawn from the `go` tonal ramp. It marks progress and the citizen's own position — the preparation progress fill, the active nav underline, the voice button, the underline beneath an official source link, the privacy shield. Where yellow means *something changed, look*, green means *this is moving, and it is yours*. Like yellow it is a mark, never a field: it never fills a panel or tints a row.

### Secondary — Status
Four verdicts, each a paired text/field couple so the pill reads at 10px.
- **Go** (`go` on `go-field`): LIKELY_ELIGIBLE pills and PASS rule marks.
- **Hold** (`hold` on `hold-field`): POSSIBLY_ELIGIBLE. Amber-brown, not yellow — status must not be confused with the alert.
- **Stop** (`stop` on `stop-field`): LIKELY_NOT_ELIGIBLE, FAIL rule marks, and the destructive button's stroke and text.
- **Unknown** (`unknown` on `unknown-field`): UNABLE_TO_DETERMINE and UNKNOWN rule marks. Deliberately a neutral grey at full label weight — an honest "we cannot determine this" is a first-class state, never dimmed, greyed-out or styled as a soft failure.

### Neutral
- **Paper** (`paper`): The page ground, and the recessive fill for a composer bar, pass stub, board condition strip, intro foot and source box — the parts of a surface that are furniture rather than content.
- **Surface** (`surface`): Every readable card, panel, board, pass, field and top bar.
- **Panel** (`panel`): Filled chips and counters — nav counts, step numbers, the progress track.
- **Rule** (`rule`): The universal hairline. Every border in the system defaults to it, including the dashed perforations.
- **Steel** (`steel`): All labels and secondary text. **Recorded as a deliberate deviation:** the reference world names STEEL `#6B7178`; this build ships one step darker so 10px mono labels and secondary body clear 4.5:1 on the paper ground as well as on white. The build's value is normative.
- **Mist** (`mist`): The lightest legible grey — scrollbar thumb, empty-state glyphs, blank-pass placeholder figures, and the timestamp on the ink board bar.
- **Slate** (`slate`): Reserved for the example chips on the chat landing, which sit a half-step back from full ink.

### Named Rules
**The Achromatic Field Rule.** Status colour never enters the reading field. It rides pills, 20px rule marks and a 3px row edge — nothing else. Headings, body copy, links and panel grounds stay ink, steel or white. A results page must never become a traffic light.

**The Reserved Yellow Rule.** Alert yellow means *this changed* or *look here now*. If a proposed yellow is neither, it is wrong. The only standing exception in the build is the 26px brand mark, which carries an alert glyph on ink; do not extend that exception to any other surface.

**The Honest Grey Rule.** UNKNOWN is styled at the same size, weight and letter-spacing as every other verdict. It is never faded, never italicised, never smaller.

**The Marked Word Rule.** Both accents may underline a word, and only underline it — a stroke sitting behind the baseline (`background-image` on the text, sized in `em`), never a filled highlight and never coloured type. Yellow marks a thing you can act on: a scheme name draws its stroke in on hover. Green marks a thing that is already true: the official-source link carries a standing green rule. The word keeps full ink contrast in both cases, so the accent adds emphasis without ever costing legibility.

## Typography

**Display / Body Font:** Google Sans (with `ui-sans-serif`, `system-ui`, `-apple-system`, "Segoe UI", sans-serif)
**Label / Data Font:** Google Sans Code (with `ui-monospace`, "SF Mono", Menlo, monospace)

**Recorded as a deliberate deviation:** the reference world specifies Inter. This build ships Google Sans and Google Sans Code, pinned by the user and serving PRODUCT.md's binding commitment that the product feel warm to the citizen. Both are loaded through `next/font` with `display: swap` and exposed as CSS variables on `<html>`.

**Character:** A humanist sans that stays friendly at 15px doing all the talking, and a monospace doing all the *stating* — labels, verdicts, counts, references, column headings, nav. The pairing is what makes the interface read as a document rather than a page: warm where it addresses a person, mechanical where it reports a fact.

### Hierarchy
- **Display** (700, 2.45rem, 1.15, `-0.022em`): The chat landing's single question. One per site.
- **Headline** (700, 2.1rem, 1.15, `-0.022em`): Route titles. `text-wrap: balance`.
- **Title** (600, 1.25rem, 1.25, `-0.014em`): Panel and section headings. `text-wrap: balance`.
- **Subtitle** (600, 1rem, `-0.008em`): Dialog sub-sections; also the weight and tracking a board row's programme name borrows.
- **Lede** (400, 16.5px, steel, max 60ch): The one paragraph under the landing question.
- **Body** (400, 15px, 1.55): Everything else. Prose is capped at 68ch (`.measure`); page-head descriptions at 62ch; the board's shared-verdict sentence at 78ch.
- **Body Small** (400, 13.5px): List rows, rule rows, dialog document and step lists.
- **Caption** (400, 12.5px): The smallest sans step — board benefit cells, ministry sublines, panel footnotes, the board's shared-verdict sentence, the print notice. Distinct from Body Small, not a loose variant of it.
- **Label** (mono, 500, 10px, `0.16em`, uppercase, steel): The system's connective tissue. Sits above every figure in a pass cell, above every list, beside every field.
- **Control Label** (mono, 500, 11px, `0.13em`, uppercase): Buttons and nav items.
- **Board Title** (mono, 700, 11px, `0.18em`, uppercase, white on ink): The board bar only — the widest tracking in the system.
- **Data** (mono, 600, tabular numerals): Pass-cell figures (15px), page-head counts (1.7rem/700), footer stamp, nav counts.

### Named Rules
**The Labelled Figure Rule.** No number ships bare. Every figure sits under a mono uppercase label naming what it counts, and every figure uses tabular numerals so columns of them align down the page.

**The Two-Voice Rule.** Google Sans addresses the citizen; Google Sans Code reports the machine's facts. A sentence written to a person is never set in mono, and a status, count, reference, column heading or control label is never set in the sans.

## Layout

**Desktop only.** PRODUCT.md records mobile as explicitly out of scope for this phase, and the build ships **no media queries for viewport width** — only `@media print` and `prefers-reduced-motion`. Do not add breakpoints, mobile nav variants, or stacked-column fallbacks without a product decision to reopen the scope.

The chrome is three fixed horizontal bands on white: a 58px top bar (brand, privacy pill, language picker), a nav strip of four mono uppercase route labels with a 2px ink underline on the current page, and then the workspace. The workspace is a single centred column, **max 1180px**, padded `30px 28px 70px`; the footer matches its width and gutters. The chat landing narrows further to **760px** with 64px of top air — the only route that changes the measure.

Content grids are all `auto-fill`/`auto-fit` with fixed minimums, so they reflow with the window rather than at breakpoints: applications at `minmax(440px, 1fr)`, settings at `minmax(310px, 1fr)`, profile forms at two equal columns. The board is an explicit five-column grid (`minmax(190px,1.15fr) 140px minmax(200px,1.5fr) 168px 56px`) that collapses to four when every row shares one verdict and the status column is dropped.

Spacing runs on a coarse rhythm rather than a strict multiple: 6/8/10/14/18/22/28 inside components, 44 between major bands, 64–70 for page air. Rows are 58px minimum; the board head is 34px; icon buttons are 34px square.

### Named Rules
**The One Column Rule.** There is one workspace column at one width. Depth comes from stacking bands and rows inside it, never from a sidebar or a second rail.

## Elevation & Depth

Depth is carried first by **stacking bands** (ink bar over white body over paper stub), **tonal recession** (paper for furniture, white for content), and **the hairline** in `rule`, including its dashed variant for anything meant to be torn or printed. Those still do most of the work, and they are what survives printing.

On top of that sits a two-step shadow scale used sparingly, so a document surface reads as a sheet resting on the paper ground rather than a shape drawn onto it. Every shadow carries a vertical offset and a soft blur; there are no zero-offset glows in the system.

### Shadow Vocabulary
- **`shadow-sm`** (`0 1px 2px rgb(11 13 16 / 0.04), 0 2px 6px -1px rgb(11 13 16 / 0.05)`): The resting state of a document surface — panel, board, pass, intro panel, composer. Barely visible, and that is the point.
- **`shadow-md`** (`0 2px 4px rgb(11 13 16 / 0.04), 0 10px 22px -8px rgb(11 13 16 / 0.13)`): The lifted state — a hovered pass, a focused composer, the history popover. Always paired with a movement of at most 2px.
- **Focus wash** (`box-shadow: 0 0 0 3px rgb(11 13 16 / 0.07)`): A state response, not elevation. Fires on `:focus-within` for the search box, alongside `border-color: ink`.

### Named Rules
**The Resting Sheet Rule.** A shadow says a surface is a sheet on a ground; it never says a surface is important. `shadow-sm` at rest, `shadow-md` only under the pointer or focus, nothing heavier. Print drops all of it — depth in this world still has to survive a laser printer.

## Shapes

Corners are small and consistent, scaled to what the element is: 3–4px on tags and status pills, 5px on filter chips and the brand mark, 7px on buttons and icon buttons, 8px on fields and notices, 10px on every panel, board, pass and card, 12px on the composer, and full 99px only on the progress track and nav counter. Nothing in the system is a circle except a pill-ended progress bar.

Borders are the form language. Everything is a 1px `rule` stroke; the only variations are meaningful:
- **Dashed hairline** — the pass's segment dividers and the intro panel's step grid. Dashed means *this cell is a field on a document*.
- **Perforation** — a 1px repeating gradient (`6px on, 6px off`) drawn as a horizontal element, marking the tear line above a pass stub.
- **3px left edge** — the board row's change mark, transparent at rest and alert yellow when the row has changed.
- **2px bottom edge** — the active nav item.

Board and pass containers clip their children (`overflow: hidden`) so the ink header meets the rounded corner cleanly.

### Named Rules
**The Hairline-First Rule.** Structure is drawn with 1px `rule`, not with fills, spacing alone, or shadow. A dashed hairline is reserved for document cells; a solid one for everything else.

## Components

### Buttons
- **Shape:** Softly squared (7px), or 5px at the small size.
- **Primary:** Ink fill, white text, mono uppercase at 11px/`0.13em`, `10px 17px`. Icons are 14–15px Lucide SVG set inline before the label.
- **Hover / Focus:** Fill flips ink → alert yellow with ink text over 0.14s ease; border flips with it so the silhouette never moves. Focus is the global 2px ink ring at 2px offset.
- **Disabled:** 40% opacity, `not-allowed`. No colour change.
- **Ghost:** Transparent on a `rule` stroke with ink text; hover fills `panel` and darkens the stroke to steel. Used for secondary and print actions.
- **Danger:** Transparent on a `stop` stroke with stop text; hover inverts to a solid stop fill with white text. The only button that carries status colour.
- **Icon button:** 34px square, white on a `rule` stroke with a steel glyph; hover goes ink. Its **on** state is the world's saved-marker — ink fill with an alert-yellow glyph.

### Chips
- **Filter chips:** Mono uppercase 10px/`0.11em`, white on a hairline, 5px corners, steel text. Active is a solid ink fill with white text; there is no intermediate selected style.
- **Row category tag:** The same mono uppercase treatment at 4px with ink text — a label, not a control.
- **Status pill:** Mono uppercase 10px/`0.10em` at weight 700, 4px corners, `4px 8px`, always a status text colour on its paired field colour, `white-space: nowrap`.
- **Privacy pill:** Steel mono uppercase on a hairline in the top bar; informational only.

### Cards / Containers
- **Corner style:** 10px.
- **Background:** White (`surface`), on the paper page ground.
- **Shadow strategy:** None; see Elevation & Depth.
- **Border:** 1px `rule` all round; the head is separated by a hairline, not by a colour change.
- **Internal padding:** `11px 16px` for a panel head, `18px 20px` for a body.

### Inputs / Fields
- **Style:** White on a 1px `rule` stroke, 7–8px corners, inheriting the body font at 14–15px. A field's caption is a 10px mono uppercase steel label above it.
- **Placeholder:** Always mono (12.5px, steel) — a placeholder is machine text, so it takes the machine voice. The composer's placeholder is the exception at `mist`, because it sits in a 16px reading textarea.
- **Focus:** Border goes ink; composer and search box add the 3px focus wash. Native outline is suppressed only where the wash replaces it.
- **Caret:** Ink, explicitly set. Selection is alert yellow with ink text.

### Navigation
Four routes, mono uppercase 11px/`0.13em` in steel with a 15px Lucide icon, `13px 16px 12px`. Hover goes ink; the current page (`aria-current="page"`) goes ink **and** grows a 2px ink bottom border that sits on the nav's own hairline. A route with saved items carries a `panel`-filled 99px count. No dropdowns, no mobile drawer.

### The Board (signature)
The gate display. An ink bar states the board title in the widest tracking in the system with a right-aligned mono count. When every row carries the same verdict, a paper-ground **condition strip** states that verdict once — status pill plus one sentence — and the row grid drops its status column entirely. A 34px head row of 9.5px mono uppercase column names follows, then rows: 58px minimum, hairline-separated, programme name at 600 weight with the ministry beneath it in 11.5px steel, a benefit cell clamped to two lines, a status pill, and a save control. Hover tints the row to `paper`. A **changed** row takes the 3px alert left edge and a `#fffdf2` field and holds it until the citizen has seen it.

### The Pass (signature)
The printable travel document. Ink header carrying a mist-coloured label and a status pill; white body; then `pass-seg` — an auto-flow column grid where each cell is one labelled figure (10px mono uppercase label, 15px mono tabular value, ellipsised) separated by **dashed** hairlines. A `perforate` line marks the tear, and a paper-ground `pass-stub` sits below it. The blank variant (`pass-blank`) keeps the full structure and sets its figures in mist — an unfilled pass, not a hidden one.

### Notice
A full-bleed signal block rather than a tinted callout: a 16px icon on a solid alert-yellow ground stretched to the notice's full height at the left edge, white body, hairline border, 8px corners, a dismiss or retry affordance at the right. The error variant swaps the block to solid `stop` with a white glyph and turns the text stop-coloured.

### Print
Print is a shipping surface. The top bar, nav, footer and anything marked `.no-print` are removed. The page ground goes pure white, panels/boards/passes take a `#999` border and `break-inside: avoid`, the pass header **inverts** from ink-on-white to white-with-a-2px-black-rule so it does not burn toner, and every link appends its `href` in 10px grey so a printed report survives being carried into an office.

## Do's and Don'ts

### Do:
- **Do** put a mono uppercase label above every figure, and set every figure in tabular numerals.
- **Do** keep status colour on pills, 20px rule marks and the 3px row edge only; the reading field stays ink, steel and white.
- **Do** state a shared verdict once at the head of the board and drop the repeated column, rather than printing the same pill fifty times.
- **Do** use the darker steel (`#5c6269`) for labels and secondary text; it is the accessible value this build ships, and it supersedes the reference world's STEEL.
- **Do** draw structure with 1px `rule` hairlines, and reserve dashed hairlines and the perforation gradient for document cells and tear lines.
- **Do** treat print as a real output: mark screen-only chrome `.no-print`, invert ink headers, and set `break-inside: avoid` on any new card.
- **Do** keep every user-facing string in `lib/i18n.ts`; the interface ships in English, Hindi and Kannada.
- **Do** style UNKNOWN at full weight and full size, exactly like the other three verdicts.

### Don't:
- **Don't** add drop shadows, offset shadows, or glows. The only shadow in this system is the 3px ink focus wash.
- **Don't** spend alert yellow on decoration, panel tints, headings or brand flourish. It marks change and attention.
- **Don't** introduce a third typeface, or set a sentence addressed to a person in the mono face.
- **Don't** add viewport breakpoints, mobile navigation, or stacked-column fallbacks; desktop-only is a recorded product decision for this phase.
- **Don't** let a surface read as an official government portal — no seals, emblems, tricolour, or ministry-style chrome. This is a private advocate.
- **Don't** stack a second sidebar or rail beside the 1180px workspace.
- **Don't** use rounded-card-plus-blue-button govtech default composition; the board and the pass are the two structural objects.
