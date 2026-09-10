---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

## Scope

Full replacement of the single 1330-line `app/page.tsx` with four real routes: `/` (chat landing), `/explore`, `/applications`, `/settings`, plus a first-visit explainer. Visitor mode: **Operate** (the landing explainer is a Persuade moment inside an Operate product). Desktop only, per PRODUCT.md.

## Direction contract

**THESIS:** Your eligibility is a live board, and your next steps are a pass you can hold. The product refuses the govtech default — a white page of rounded cards with a blue button and a friendly illustration — because that arrangement makes every scheme look equally plausible and hides which fact is missing. Here, status is the primary object and a change holds its mark until the citizen has seen it.

**OWN-WORLD:** Travel-document surfaces. INK `#0B0D10`, SLATE `#1C2127`, STEEL `#6B7178`, PANEL `#E6E8EB`, SURFACE `#FFFFFF`, on a light paper ground; ALERT `#FFD400` is reserved for change and attention, never decoration. Status colour rides pills and row edges only — the reading field stays achromatic so a results page never becomes a traffic light. Google Sans for body and headings (warmth), Google Sans Code for every label, code, reference and figure, uppercase and letterspaced for labels, tabular for data. Components: black-filled primary buttons that flip to alert-yellow when active, hairline-bordered panels, segmented cards with labelled cells, dashed perforation on anything printable.

**STORY:** The citizen understands within one viewport that they can describe their life in plain words and get back a ranked, reasoned board rather than a search result. They believe it because every row names the rule and source that decided it, and says UNKNOWN rather than guessing. They act by answering the one missing fact, then printing the pass.

**FIRST VIEWPORT:** `/` is only the chat. Centred column on paper ground, max ~760px. A mono uppercase kicker, one warm Google Sans line asking them to describe their situation in their own words, and a bordered composer with a mono placeholder and a black send button. Below it, three example situations as quiet bordered chips. The four-route nav sits in a thin top bar with mono uppercase labels, active item underlined in ink. No cards, no hero image, no dashboard.

**FORM:** Boarding pass and live gate board (catalog `vernacular-ephemera-boarding-pass-and-gate-board`), dealt as a challenger with verdict `competitive` against assigned candidate 6 of 7 (India Post). The user chose it over the assignment and pinned light theme, a clean neat register, accent colour, and Google Sans. Seed key `50f67861`. Code-led: no image generation in this session.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints carried from PRODUCT.md

- UNKNOWN is a first-class visible state, never styled as a soft failure.
- Nothing may imply a government endorsement or read as a government portal.
- Print is a first-class path: the report must survive being carried into an office.
- Azure and ElevenLabs are unconfigured; no UI may depend on them.
- Reference numbers show last four characters only.

## Unresolved

- Whether the explainer is a full-screen first-run interstitial or an inline panel above the composer; resolve during build, favouring the lighter one.
