---
version: 1
slug: "app-welcome-page-tsx"
primary_target: "app/welcome/page.tsx"
related_targets: ["app/landing.tsx","app/gate.tsx"]
---

## Scope

New surface: the pre-sign-in landing at `/welcome`, plus the simulated sign-in that enters the product. Visitor mode: **Persuade** — the only Persuade surface in an otherwise Operate product. Desktop only, per PRODUCT.md.

This is a whole surface inside an established world, not a new visual identity. DESIGN.md ("The Gate Board and the Pass") is inherited unchanged: no new colours, no illustration, no second typeface.

## Direction contract

**THESIS:** We will not waste your trip. Most services guess and send a citizen to an office to find out they were wrong; this one checks fifty programmes against fixed rules, says plainly what it cannot determine, and hands over the documents and the order before anyone travels. That honesty mechanism is the single claim the page leads with, chosen over discovery ("you may be owed something") because discovery is the closest thing to a promise this product refuses to make.

**WARMTH:** PRODUCT.md records "feel friendly and warm" as binding; DESIGN.md is deliberately unglamorous and explicitly refuses the friendly-govtech page. Resolved in favour of **warmth within the world**: warmth comes from scale, air and voice — a 3.5rem display line, a 62ch lede, plain second-person copy — never from new colour, rounded illustration or a softened palette. The page a citizen signs in from looks like the page they sign into.

**FIRST VIEWPORT:** Two columns. Left, the display line "You describe your life. We find what you are owed.", the lede stating the mechanism, then the sign-in: one name field and a Continue button, with the privacy line beneath. Right, a real **pass** rendered oversized and rotated a degree off true — a document set down on a desk, not a card in a grid. The artifact the citizen leaves with is shown rather than described.

**PROOF:** Only product truth is available — PRODUCT.md forbids testimonials, user counts, accuracy statistics, press and endorsement. So the proof section is the four verdicts as real status pills, with the plain statement that a missing fact produces an honest "we cannot determine this" naming the fact, never a confident no. The four-pill row is the product's actual mechanism used as its own evidence.

**SIGN-IN:** Simulated for the demo. A display name in `localStorage`, no credential, nothing sent anywhere. It gates presentation only — every API route still runs on the anonymous session cookie. The landing is a **real route** rather than a conditional render, because deciding page structure from client-only state guarantees a hydration mismatch.

**FLOW:** `/welcome` → sign in → `/profile` (the first thing after entering, so the agent starts with facts instead of interrogating) → `/` chat. Both redirects run in effects against real routes.

## Constraints carried from PRODUCT.md

- No testimonials, counts, benchmarks, press, or government endorsement.
- Must never read as a government portal or imply official endorsement.
- UNKNOWN shown at full weight alongside the other three verdicts, never dimmed.
- Three languages: every string in `lib/i18n.ts`.

## Refused

- A hero-metric band ("50 schemes · 10 categories · 3 languages"). The counts are true but they are the category's reflex, and the page's claim is honesty, not scale.
- Same-size feature cards as the page structure. The how-it-works row is four hairline-topped columns, not four boxes.
- An eyebrow above the display line.
- Any illustration or photograph. The pass is the image.
