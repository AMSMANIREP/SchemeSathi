# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Indian citizens looking for Central Government benefit schemes for themselves, on their own. Confirmed: the citizen is the only user the product designs for — not CSC operators, NGO field staff, or family members entering someone else's details.

The citizen is assumed to be unfamiliar with government programme terminology, ministry names, and eligibility language. This is infrequent use: someone arrives with a life situation ("I farm two acres", "my daughter is starting college"), not with a scheme name in mind.

**Confirmed constraint: desktop only.** The product is designed for desktop screens. Mobile layout is explicitly out of scope for this phase. (Recorded as the user's decision. Worth revisiting later given the audience, but not a design consideration now.)

Interface languages: English, Hindi, Kannada.

## Product Purpose

A citizen describes their own situation in their own words; the product finds the Central Government schemes they are likely eligible for and gives them a report with concrete next steps — documents to gather, where to go, what to do in what order.

Success is a citizen leaving with a report they can act on: printed, in hand, correct about what they personally need to do next.

This is a **working demonstration release, not a completed production eligibility service.** No claim of final eligibility is ever made — final eligibility and approval rest with the responsible government authority.

## Positioning

**Scheme Sathi is a private service standing above government service delivery, not a government product.** Its reason to exist is that official channels are, in the user's words, apathetic at best. The citizen should feel *more secure and more assisted here than they do dealing with the government directly*. That contrast is the product's core promise — being visibly on the citizen's side is the differentiator, not a tone preference.

This has a direct consequence: the product must never imitate a government portal, and must never be mistaken for an official government service. It is an advocate for the citizen, not an arm of the bureaucracy.

Eligibility is decided by a **deterministic rules engine**, not a language model. Rules produce PASS / FAIL / UNKNOWN with nested AND/OR, resolving to four outcomes: `LIKELY_ELIGIBLE`, `POSSIBLY_ELIGIBLE`, `LIKELY_NOT_ELIGIBLE`, `UNABLE_TO_DETERMINE`.

Two commitments a neighboring product could not truthfully copy:

- **UNKNOWN is never interpreted as false.** Missing information produces an honest "we cannot determine this" and names the missing field, rather than a confident wrong denial.
- **No decision before explicit confirmation.** The citizen reviews and confirms their extracted details before any eligibility evaluation runs.

Every rule outcome carries a source citation. Schemes carry `reviewStatus` (`DRAFT` / `VERIFIED`), a version, and a source-checked date, so freshness is visible rather than assumed.

## Operating Context

Confirmed user flow — four separated surfaces, replacing the current single crowded page:

Confirmed: these are **real routes** (`/`, `/explore`, `/applications`, `/settings`), not tabs on one page — so the back button works, a citizen can bookmark or return to their report, and each surface is its own file rather than one 1330-line page.

1. **Chat — the landing surface.** Just the chat. This is where a citizen describes their situation and where they land on every return visit.
2. **Explore schemes** — browse and search the catalogue independently of the conversation.
3. **My applications and reports** — saved schemes, preparation checklists, manual status, notes, and generated reports.
4. **Privacy and settings** — language, data, feedback, deletion.

**First-visit explainer:** a new citizen gets an introduction explaining what the tool is and what it does for them. Once they begin, chat is the landing surface on every subsequent visit. Returning citizens do not see the explainer again.

**The report is printed and carried.** Citizens take it to a government office or CSC as a physical checklist. Print output is a first-class requirement, not an afterthought — a print stylesheet and a durable, offline-readable format are real product requirements, not enhancements.

## Capabilities and Constraints

Confirmed working:

- 50 unique Central Government programme references across ten categories, with official links, benefits, and preparation guidance.
- Guided text intake and an editable profile, with age / income / land / disability validation and optimistic concurrency to prevent invalid or stale updates.
- Saved schemes, preparation checkboxes, manual status and notes.
- One-hour cookie sessions, database persistence across refresh, session-specific data isolation, language preference, feedback, and explicit deletion.

Hard constraints future work must not violate:

- **No government submission and no live government status integration.** The product prepares citizens; it never files anything.
- Application reference numbers retain only the **last four characters**.
- Official programme summaries, names, and criteria remain in English even in Hindi and Kannada interfaces. Native-language expert review is pending and must not be implied as complete.
- Azure OpenAI (extraction) and ElevenLabs (audio) have real adapters but are **unavailable until configured**. Text and forms work fully without them; no UI may depend on them being present.
- An optional Python FastAPI/LangGraph parity service may be required via config; disagreement or failure forces abstention rather than a guess.

Terminology used throughout and worth preserving: *scheme*, *programme*, *eligibility*, *preparation*, *tracker*, *ministry*, *category*.

## Brand Commitments

- Name: **Scheme Sathi**. "Sathi" means companion — the existing tagline is "Your benefits companion" (`आपका योजना साथी` / `ನಿಮ್ಮ ಯೋಜನಾ ಸಂಗಾತಿ`).
- User-volunteered and binding: the product should **feel friendly and warm** to the citizen. Recorded as stated; the visual expression of it is not decided here.

## Evidence on Hand

Real and usable:

- 50 genuine Central Government programme records with official source URLs, ministry attribution, source-checked dates, benefits, required documents, and application steps (`lib/catalogue.ts`, `data/`).
- Working deterministic rules with per-rule source citations (`lib/rules.ts`).
- Three-language interface strings (`lib/i18n.ts`).

Explicitly absent — future work must not fabricate these:

- No testimonials, named citizens, case studies, success stories, or user counts.
- No benchmarks, accuracy claims, or approval-rate statistics.
- No press coverage, government endorsement, or official partnership.
- No connected Azure or ElevenLabs credentials, so no claim of live voice or AI extraction in the deployed app.

## Product Principles

1. **Honesty over confidence.** UNKNOWN is a real answer. Never let a clean interface imply certainty the rules engine did not produce.
2. **The citizen confirms before the system decides.** Extraction is a draft for review, never an accepted fact.
3. **Every claim is traceable.** Outcomes cite their rule and source; schemes show review status and freshness.
4. **Prepare, never promise.** The product readies a citizen to apply and states plainly that the authority decides.
5. **Dignity for someone who does not know the jargon.** Government language is translated into the citizen's situation, never the reverse.

## Accessibility & Inclusion

- Three interface languages (English, Hindi, Kannada), with the honest limitation that official programme text remains English pending native-language expert review.
- Users are assumed unfamiliar with bureaucratic vocabulary; plain language is an accessibility requirement, not a style preference.
- Print output must remain legible and complete when carried into an office, independent of the screen experience.
- Desktop-only is a recorded product decision for this phase, not an accessibility judgment.
