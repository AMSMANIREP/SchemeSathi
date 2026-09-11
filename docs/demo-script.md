# Demo script

Verified against the running build on 11 September 2026. Every line below was
executed end to end; the responses quoted are what the system actually
returned, not what it is expected to return.

**Total runtime: about four minutes.** Three conversation turns.

---

## The persona

**Lakshmi, 61, rural Karnataka.** Widowed last year. Grows vegetables on a
small plot behind the house, stitches blouses for neighbours, cooks on
firewood, has no bank account.

She is chosen because **nothing about her situation is straightforward**:

- "grows vegetables" and "stitches blouses" are two different occupations, and
  the profile holds only one — so the system has to ask rather than assume.
- Four of the six authored schemes are live for her at once (Vishwakarma,
  Ujjwala, Old Age Pension, ADIP), so the conversation has to narrow.
- She is the product's actual user: someone arriving with a life, not a scheme
  name.

The single fact that makes the ending land is **no bank account** — entered on
the profile page, never mentioned in the conversation, and surfacing three
turns later as a highlighted step in her printed report.

---

## Before you start

Reset to a signed-out state. In the browser console on the app's origin:

```js
localStorage.clear();
await fetch('/api/v1/me/data', {
  method: 'DELETE',
  credentials: 'same-origin',
  headers: { 'X-Requested-With': 'SchemeSathi' },
});
location.href = '/welcome';
```

Then make one throwaway request so the outbound connection is warm — the first
call to a provider after an idle gap is slower than the rest. Sending any
message and discarding the conversation is enough.

---

## 1 · Landing → login  *(20 seconds)*

Open `/welcome`.

Worth saying out loud: this page makes exactly one claim, and it is not
"you may be owed money". It is **we will not waste your trip** — the honest
mechanism, because the product refuses to promise an outcome it does not
control.

Click **Log in**. Type anything — `lakshmi@example.com`, any password.

> The dialog says it checks nothing, sends nothing, and stores no password.
> That is true: the password field is never read. Say so; it is a better look
> than pretending.

## 2 · Profile first  *(45 seconds)*

You land on **My profile**, not the chat. That is deliberate: the agent starts
with facts instead of interrogating.

Fill in **only these five**, and leave everything else blank:

| Field | Value |
| --- | --- |
| Age in completed years | `61` |
| State or union territory | `Karnataka` |
| Gender | `female` |
| Residence | `rural` |
| Bank account available | `no` |

Leave occupation, land, income, BPL, LPG and tax blank — a real person fills
the easy demographics and skips the rest. **Point at "Bank account: no" and
move on without explaining it.** It pays off in step 5.

> **Leaving LPG blank is deliberate, and the demo changes if you fill it.**
> Ujjwala needs only age, gender and "no LPG connection". Set LPG to `no` here
> and all three are satisfied before she says a word, so the first turn skips
> the question and goes straight to *Ujjwala Yojana — likely eligible*.
>
> That is correct behaviour — the agent does not ask a question when it can
> already tell her something definite — and it is a perfectly good demo, just
> a shorter one. Leaving it blank keeps the disambiguation below, which is the
> more interesting thing to show.

Click **Next**.

## 3 · The conversation  *(90 seconds)*

### Turn 1 — spoken

Press **Record** and say:

> "My husband passed away last year and I manage on my own now. There is a
> small piece of land behind the house where I grow vegetables, and I stitch
> blouses for the neighbours to make ends meet. I still cook on firewood."

The transcript appears **in the composer, not in the chat**. Nothing is sent
until you press send. Worth pausing on: a misheard "two acres" as "ten acres"
would change a verdict, so the citizen reads it first.

Press send. What comes back:

```
SATHI: What kind of work do you do?
       [chips] farmer · student · self employed · salaried ·
               unorganised worker · unemployed · retired · artisan
       · Added to your profile: Occupation — Not confirmed
```

**This is the moment to stop and explain.** It heard both the vegetables and
the blouses, wrote down a guess, and marked it **unconfirmed** — then asked
rather than deciding. An inference never reaches the rules engine. Open
`/profile` in another tab if you want to show the yellow "Not confirmed" edge.

### Turn 2 — she answers

Click the **artisan** chip (or type it).

```
SATHI: Here is what your details point to so far.
       · PM Vishwakarma            LIKELY ELIGIBLE
       · Ujjwala Yojana            POSSIBLY ELIGIBLE
       · National Old Age Pension  POSSIBLY ELIGIBLE
       · ADIP Assistive Devices    POSSIBLY ELIGIBLE
       · Added to your profile: Occupation — You told us
```

Two things to point at:

- The provenance flipped from *Not confirmed* to **You told us**. A direct
  answer to a direct question is a stronger confirmation than a ticked form.
- Four verdicts, not one. The three "possibly" cards are honest: they each
  still need a fact she has not given.

### Turn 3 — she narrows

Type:

> `Tell me more about PM Vishwakarma`

```
SATHI: Here is what your details point to so far. Would you like to keep this
       one in My applications, so you have the next steps to hand?
       · [an unissued pass]  PM Vishwakarma
         "You work in one of the recognised traditional trades"
```

**The offer only appears now.** Say why: it needs a single scheme in focus, a
verdict of likely or possibly eligible, and at least one rule already passing.
Four cards on screen is not a choice — she had not chosen anything yet. The
reason on the card is the rule's own label, not a sentence written for the
occasion.

*(If you want to show the restraint: reply `no thanks` instead. The offer
disappears and stays gone for three turns, even if you name the scheme again.
Then start over for the save.)*

## 4 · Save  *(10 seconds)*

Click **Add to my applications**. A receipt lands in the transcript:

```
✓ Added to applications: PM Vishwakarma        Open next steps →
```

## 5 · The report — the payoff  *(60 seconds)*

Click **Open next steps**.

```
PM VISHWAKARMA                                    LIKELY ELIGIBLE
Ministry of Micro Small and Medium Enterprises

AGE 61 · KARNATAKA · RURAL · BANK no · OCCUPATION artisan

WHY THIS APPLIES TO YOU
  ✓ You work in one of the recognised traditional trades
  ✓ You are at least 18

HOW TO TAKE THE NEXT STEP
  1  Check that your trade is one of the recognised ones
  2  Confirm your mobile number is linked to your Aadhaar
▸ 3  Open a bank account in your own name          ← FOR YOU
      because: No bank account yet
  4  Register at a Common Service Centre
  5  Complete the skill assessment
  6  Keep your own record of what you submitted
```

**Land on step 3.** She never mentioned a bank account in the conversation —
she ticked it on the profile page four minutes ago. The step is shown to her
and not to someone who already banks, and it says which fact put it there.

That filtering runs through **the same rule engine as eligibility**. No model
decides which steps a citizen sees. A model cannot invent a step, reorder one,
or write the reason on it.

Then scroll and point at:

- **WHERE / WHO / TYPICAL WAIT** under each step — the three questions someone
  actually has standing in a queue.
- **Cost** — stated plainly, including what is not covered.
- The **demonstration-data notice** at the top. Read it out. These six schemes
  were drafted for this build and are not independently verified; the product
  says so on the citizen's own sheet rather than in a footnote.

Press **Print**. The masthead inverts so it does not burn toner, links print
their full URLs, ticked documents stay distinguishable without background
printing, and the chrome disappears. It is meant to be carried into an office.

---

## If something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| First message is slow or fails | Cold outbound connection | Send one throwaway message before the demo |
| No save offer appears | No single scheme in focus, or nothing has passed a rule yet | Name the scheme explicitly: "Tell me more about PM Vishwakarma" |
| It asks about something she just said | Inferred facts are unconfirmed by design | This is the honest behaviour — explain it rather than avoiding it |
| Turn 1 shows cards instead of asking | Something already reached *likely eligible*, so there was nothing worth asking | Check LPG is blank on the profile; see the note in step 2 |
| Mic does nothing | `capabilities.voice` is false | Check `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are both set, with no stray spaces |
| Everything says "cannot determine" | Only six schemes are authored | Stay inside the six: Vishwakarma, Ujjwala, PM-KISAN, Old Age Pension, ADIP, College Scholarships |

---

## Variants

**Kannada.** Switch the language picker before turn 1 and say:
`ನಾನು ಕರ್ನಾಟಕದ ರೈತ. ನನಗೆ 45 ವರ್ಷ.` Extraction scores 100% on Kannada in
`pnpm eval:extraction`, so this is safe to do live.

**A farmer instead.** Profile: age 44, Karnataka, occupation farmer, land 0.8,
taxpayer no, bank no. Ask about PM-KISAN. The report's first step is
"Check that your land record carries your own name" — the slowest real-world
step, and the one most applications actually fail on.

**Show a refusal.** Reply `no thanks` to the save offer. Nothing nags. That is
the product's whole posture in one interaction.
