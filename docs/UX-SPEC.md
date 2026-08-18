# Trajectory — UX Specification

**Status:** Proposed · v1 · design-ready
**Source of truth:** `docs/PRODUCT-ARCHITECTURE.md` v2. Where this document and the architecture disagree, the architecture wins and this document is wrong.
**Scope:** the complete interaction system for the core loop — every primary surface, every state, mobile, and accessibility.
**Audience:** whoever implements the UI, and whoever reviews whether it was implemented faithfully.
**Not in scope:** visual comps, a token file, component code. This defines behavior, hierarchy, and states — the things that are expensive to get wrong later.

**Annotation keys** (from Enterprise Intelligence `knowledge/pm/writing-standards.md`): `[ASSUMPTION]` unvalidated claim · `[DECISION NEEDED]` open question that blocks · `[OUT OF SCOPE — Reason]` deliberate exclusion.

---

## 0. Design foundations

### 0.1 The question every screen answers

> **What matters right now?**

This is not a slogan. It is a structural requirement with a component behind it: **the Standing Answer** (§0.5). Every primary surface opens with one sentence, set in the largest type on the page, that answers the question for that surface. Not a metric. Not a greeting. A sentence a person could say out loud.

| Surface | Standing Answer answers |
| --- | --- |
| Today | What is the single most important thing to do in the time you have? |
| This Week | What has to be true by Sunday? |
| Roadmap | What has to become true, and what is everything waiting on? |
| Progress | How far along are you, honestly, and where does that land you? |

A surface that cannot state its answer in one sentence is a surface that has not been designed yet.

### 0.2 What "calm, premium, intelligent" means operationally

These words are useless unless they constrain decisions. Here is what each one forbids.

**Calm** — the interface never competes for attention with the work.
- No badge counts, no red dots, no unread state, no notification bell.
- Nothing animates unless something changed.
- No modal interrupts the user except to confirm an irreversible or scope-changing action.
- At most **one** primary action is visible per screen. If two things look equally actionable, the screen is wrong.
- Bad news is delivered at the same volume as good news. The interface has one voice.

**Premium** — quality is expressed through restraint and precision, never decoration.
- Separation comes from **space and hairline rules**, not from cards with borders and drop shadows. This single rule does most of the work of not looking like a SaaS dashboard.
- Every number is set in tabular figures and aligned on its decimal. Numbers that jitter as they update read as cheap.
- No illustration, no mascot, no gradient mesh, no glassmorphism, no stock iconography.
- Text is typeset, not just placed: a real scale, real line height, a measure capped at ~68ch.
- Motion is 120–200ms, ease-out, and only ever on a state change.

**Intelligent** — the system demonstrates understanding rather than announcing it.
- The product never says "AI," "smart," "powered by," "analyzing," or "thinking."
- Intelligence shows up as *specificity*: naming the actual bottleneck, quoting the user's own constraint back, proposing the one change that matters.
- Every computed judgement can be opened to reveal what it was derived from (§13.4). A number you cannot interrogate is a number you cannot trust.
- The system says "I don't know yet" when data is thin, in those words, rather than rendering a confident zero.

### 0.3 What this product deliberately is not

Anti-references are more useful than references. Trajectory is **not**:

| Not this | Because |
| --- | --- |
| A KPI dashboard (grid of stat cards) | It answers "how are things?" — this product answers "what now?" A card grid is a refusal to prioritize. |
| A habit tracker (streaks, flames, rings) | Streaks convert a missed day into a loss. §12 R2 of the architecture makes non-punitive framing a critical mitigation, not a preference. |
| A kanban board | Columns imply throughput. This product is about a small number of consequential outcomes, not flow of tickets. |
| A chat interface | Conversation makes the user do the structuring work. The engine structures; the user executes. |
| A gamified goal app | Points reward engagement with the app. This product wants engagement with the *goal*, and ideally the user is in it for 90 seconds a day. |

**The success case is a user who opens Today, does the work, and closes it.** Time-in-app is an anti-metric.

### 0.4 Visual system

**Type.** One humanist sans for everything (system stack acceptable for v1: `ui-sans-serif, Inter, -apple-system…`). Tabular numerals mandatory on every metric, date, and duration.

| Role | Size / weight | Use |
| --- | --- | --- |
| Standing Answer | 28–32px / 400, tight leading | One per screen, top |
| Section | 13px / 500, +0.04em tracking, muted | Quiet labels above groups |
| Body | 16px / 400, 1.55 leading | Task titles, prose |
| Support | 14px / 400, muted | The `why` line, criteria, basis |
| Metric | 20–24px / 400 tabular | Numbers, always with a unit or label adjacent |

Prose measure caps at 68ch. Task titles wrap to two lines maximum, then truncate with the full text available on the detail surface.

**Color.** A warm near-neutral paper/ink base — not blue-grey, which reads as corporate SaaS. Exactly **one** accent.

- The accent appears at most three times on a screen: the primary action, the current-day marker, and the active navigation item. Nowhere else. Accent used for emphasis everywhere is accent used nowhere.
- **Health is never color-only.** The three-step scale pairs a shape with a word, always: `○ on track` · `◐ at risk` · `● off track` · `· unknown`. The interface must survive greyscale printing and be legible to a user with any form of color vision deficiency. (Architecture §6.4; AC-9.33.)
- Destructive actions are text, not red buttons. Red is reserved exclusively for genuine data-loss confirmation.
- Full light and dark palettes; dark is not an afterthought — daily check-ins happen at night.

**Space and structure.** 4px base unit. Hairline rules (1px at ~12% ink) separate groups. A screen is a single column on every viewport up to 900px; above that, a content column plus an optional narrow margin column for context. **There is no multi-pane dashboard layout anywhere in this product.**

**Motion.** 120ms for state changes (checkbox, selection), 200ms for surface entrance, 240ms for the replan diff reveal. Everything ease-out. Generation staging is the one place with sustained motion, and it is a progress narration (§15.3), not a spinner. All motion respects `prefers-reduced-motion: reduce` by collapsing to instant state change with opacity only.

**Icons.** Used only where a word would be slower to parse *and* the meaning is unambiguous: check, chevron, close, attach. Never an icon-only button on a primary action. Never decorative iconography.

### 0.5 The Standing Answer component

The most important component in the system. It appears once, at the top of every primary surface.

**Composition** — up to two lines:

```
Line 1  Deterministic.   Generated by lib/domain from stored signals and plan state.
Line 2  Optional. AI.    One clause of context, visually secondary, always omittable.
```

**Rules**

1. **Line 1 is never AI-authored.** It is a template filled from `goal_signals` and the active plan. This is what makes the surface work when the provider is down, the quota is exhausted, or the spend breaker has tripped (architecture §6.3, §5.12) — the answer to "what matters right now?" must never depend on a network call to a model.
2. **Line 2 may never contradict line 1**, and its absence must never be noticeable. If the AI narrative is unavailable, line 2 simply does not render; nothing shifts, no placeholder appears.
3. **It is a sentence**, with a verb and a period. Never a fragment, never a metric with a label.
4. **It states the fact, not a feeling.** "You have 25 minutes today" — not "Let's make today count."
5. **It has a defined form for every state**, including no plan, no data, off track, ahead, complete, and paused. A Standing Answer with no defined empty case is an empty state waiting to happen.
6. **When a bottleneck-clearing task is scheduled today, it is the one the Standing Answer names** — ahead of anything shorter, easier, or earlier in the list. The sentence's job is to name what *matters*, not what is next in sequence.

**Examples — Today**

| Situation | Line 1 | Line 2 (optional) |
| --- | --- | --- |
| Normal day | "Draft the teardown outline — 45 minutes." | "It's the last thing between you and publishing on Thursday." |
| Low capacity | "You have 20 minutes today. One thing: send the intro email." | — |
| Nothing scheduled | "Nothing is scheduled today. Week 3 resumes tomorrow." | — |
| Off track | "Week 3 is behind by about 90 minutes." | "Two sessions this week would close it." |
| No plan yet | "Your plan is being built." | — |

### 0.6 Copy voice

**Rules.** Second person. Present tense. Plain nouns. Numbers where numbers are meant. One idea per sentence. State the fact, then the option.

**Banned outright** — enforced by `tests/ui/no-forbidden-language.test.ts` (AC-9.36) which this spec extends:

- Systems vocabulary: `AI`, `prompt`, `token`, `LLM`, `model`, `agent`, `generate` (as a user-facing verb), `algorithm`.
- Motivational filler: `you've got this`, `crush`, `smash`, `unlock`, `journey`, `amazing`, `awesome`, `great job`, `keep it up`, any exclamation mark anywhere in the product.
- Guilt and gamification: `streak`, `failed`, `missed the mark`, `behind schedule!`, `don't break the chain`, `oops`, `uh-oh`, `sorry!`.
- Vagueness: `something went wrong`, `an error occurred`, `please try again later` without a stated reason and action.

**Required patterns.**

| Situation | Pattern | Example |
| --- | --- | --- |
| Bad news | Fact → consequence → one option | "Two of five sessions happened this week. At this pace the portfolio lands three weeks late. The smallest fix is dropping the case study." |
| Uncertainty | Name it | "Not enough data yet. After seven days of execution this becomes meaningful." |
| Refusal | Reason → alternative | "Twelve months isn't enough for this at five hours a week. Eighteen months is." |
| Completion | Register it, move on | "Done. Two left today." |
| Error | What happened → what to do | "We couldn't reach the planning service. Your work is saved. Retry, or keep going — today's plan still works." |

`[ASSUMPTION]` Users prefer plain honesty to encouragement in a goal-execution context. This is the product's core bet (architecture §1) and the single most valuable thing to test with real users in week one.

---

## 1. Information architecture

### 1.1 The shape of the product

One user → one active goal (free tier) → one active plan → one day. The IA must make the *day* the center of gravity and everything else a place you visit on purpose.

```
Landing  /                              ← unauthenticated, one input
  │
Start    /start                         ← intake → assessment → auth → generation
  │
  ▼
Goal     /goals/[id]                    PROGRESS  ── "how far along am I?"
  ├─ /today                             EXECUTE   ── default landing, daily
  ├─ /week                              COMMIT    ── weekly, outcomes + capacity
  │    └─ /reflect                      REFLECT   ── end of week, gated by week end
  ├─ /map                               UNDERSTAND ─ occasional, structure
  ├─ /history                           AUDIT     ── rare, plan versions + decisions
  ├─ /resume                            RE-ENTER  ── after ≥7 days away; intercepts
  └─ /settings                          ADJUST    ── capacity, constraints, dates

Account  /settings/account · /settings/ai · /settings/data
Goals    /goals                          ← list; single-goal users never see it
```

### 1.2 Frequency tiers — the rule that shapes navigation

| Tier | Surfaces | Expected use | Design consequence |
| --- | --- | --- | --- |
| **Daily** | Today | Every day, 60–120 seconds, often on a phone, often standing | Default route. Mobile-first. Reachable in zero taps. |
| **Weekly** | Week, Reflect | Once or twice a week, seated | One tap from Today. Denser. |
| **Occasional** | Progress, Map | When something feels off, or curiosity | Deliberately not in the persistent daily path. |
| **Rare** | History, Settings | After a replan, or on setup | Behind a quiet menu. |
| **Interceptive** | Resume, Replan proposal | System-initiated, at most a few times per goal | Takes over the surface; cannot be missed; never nags. |

**The load-bearing decision:** planning surfaces must be *reachable* but never *ambient*. Architecture §12 R3 names over-planning — tuning the plan instead of doing the work — as a High risk. An IA that gives Map and Progress equal standing with Today is an IA that invites it.

### 1.3 Depth budget

Nothing in the daily loop is more than one level deep. Completing a task, checking in, choosing a day tier, and seeing why a number says what it says are all **zero-navigation** actions — they happen in place on Today. Detail surfaces (a milestone, a plan version, a signal derivation) open as a panel over the current surface and return the user exactly where they were.

`[OUT OF SCOPE — Reason: single goal on free tier]` Cross-goal navigation, goal switching UI, and any portfolio/roll-up view. Architecture §13.4 makes multi-goal a BYOK affordance, not the mental model.

---

## 2. Navigation

### 2.1 Structure

**Persistent chrome is one bar, and it is thin.**

```
┌──────────────────────────────────────────────────────────────────┐
│  Product Manager at a top tech company             Today  Week  ⋯│
└──────────────────────────────────────────────────────────────────┘
   ↑ goal title → /goals/[id] (Progress)             ↑ two peers  ↑ menu
```

- **The goal title is the Progress link.** It is the largest element in the bar and doubles as orientation — the user always sees what they are working toward. This is why Progress needs no tab of its own.
- **Two peer destinations only: Today · Week.** Text labels, no icons, no pills, no filled backgrounds. The active item carries the accent and a 2px underline.
- **The Roadmap is not in the nav.** It is reached from Week ("the milestone this week serves"), from Progress (any milestone), and by `M` or the command palette. It is one tap away and zero taps ambient. §1.2 says planning surfaces must be reachable but never ambient, and architecture §12 R3 rates over-planning a High risk; a permanent Map tab is a standing invitation to tune the plan instead of executing it. **Revised in audit — see §22.**
- **The `⋯` menu** holds: Roadmap, Reflect (when a week has ended), History, Goal settings, Account, Sign out. Quiet by design.
- No search field, no notification bell, no avatar menu with 14 items, no breadcrumb trail.

### 2.2 Keyboard

Architecture §6.4 mandates `Cmd/Ctrl+K` plus `T`/`W`/`M`. Extended:

| Key | Action |
| --- | --- |
| `T` `W` `M` | Today · Week · Map |
| `P` | Progress |
| `G` | Goal list (only when >1 goal exists) |
| `C` | Check in |
| `Cmd/Ctrl+K` | Command palette — every action in the product, searchable |
| `Enter` / `Space` | Complete the focused task |
| `Cmd/Ctrl+Z` | Undo the last completion (within the undo window, §9.6) |
| `?` | Keyboard reference |
| `Esc` | Close panel / cancel generation |

Single-letter shortcuts are suppressed while focus is in a text input. The command palette is the discoverability mechanism for all of them and lists the binding beside each entry.

### 2.3 Routing rules

| Rule | Behavior |
| --- | --- |
| Default authenticated landing | `/goals/[id]/today` — always, for a user with an active goal |
| No goal | `/start` |
| Goal is `draft` (generation incomplete) | `/start` resumed at the last completed stage |
| ≥7 days since last activity | `/resume` intercepts once, then normal routing |
| Open replan proposal | Notice on Today and Week; never a forced redirect |
| Goal `paused` | `/goals/[id]` with the resume affordance; Today shows the paused state |
| Goal `achieved` | `/goals/[id]` completion state |
| Deep link into a stale plan version | `/history` context, marked "superseded", read-only |

### 2.4 Mobile navigation

**No bottom tab bar.** The header carries `Today · Week` as a compact pair on the right, with `⋯` beside it. Everything else lives in the menu.

The first draft of this spec specified a three-item bottom bar (Today · Week · Map). Two things killed it. First, a bottom bar is app-chrome that costs 56px of a 640px screen permanently, on the one surface that most needs vertical room. Second, and more importantly, destination-switching is a *weekly* action here, not a daily one — the daily action is completing a task, which lives in the content area under the thumb already. A persistent tab bar optimizes the wrong gesture and makes the product look like every other app it is trying not to be. **Revised in audit — see §22.**

---

## 3. Landing page (`/`)

**Purpose** — convert a person with an ambition into a person with an assessed, realistic plan, in under 90 seconds, without an account. The page's job is to earn one sentence of typing.

**Primary action** — type a goal into the input and press Enter.

**Secondary actions** — read the one honest paragraph about what the product does; pick an example to see the flow; sign in (quiet, top right).

**Information hierarchy**

```
┌──────────────────────────────────────────────────────────┐
│                                              Sign in     │
│                                                          │
│                                                          │
│   What do you want to accomplish?                        │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │ Become a product manager at a top tech company…  │   │
│   └──────────────────────────────────────────────────┘   │
│   Press Enter. No account needed yet.                    │
│                                                          │
│   Try: run a half marathon · ship a paid product ·       │
│        move into design                                  │
│                                                          │
│                                                          │
│   ─────────────────────────────────────────────────────  │
│                                                          │
│   Trajectory turns a goal into a plan you can actually   │
│   execute — and tells you when the timeline doesn't      │
│   work. Most goal apps won't.                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

1. **The input.** Occupies the optical center. Multi-line, auto-growing, no placeholder that disappears on focus (the prompt is a real heading above it).
2. **The permission line** — "Press Enter. No account needed yet." Removes the single largest hesitation.
3. **Three examples**, as clickable text, spanning different domains so the product doesn't read as career-only.
4. **One paragraph below the rule**, and it leads with the refusal — the honesty is the differentiator, so it is the pitch.

No feature grid. No logo wall. No pricing table. No testimonials. No screenshot carousel. `[OUT OF SCOPE — Reason: v1 has no marketing surface beyond this page]`

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Idle | Types ≥1 char | Enter affordance appears; examples fade |
| Idle | Clicks an example | Input fills, cursor at end, editable — never auto-submits |
| Idle | Submits <10 chars or unparseable | Inline: "Say a bit more — what would be true when you're done?" Focus stays. |
| Idle | Submits valid | → `/start`, clarify stage, input carried in a draft |
| Idle | Signed-in visitor with an active goal | Bar shows "Continue →" to Today; landing still accepts a new goal (free tier: one active, so this routes to the replace/archive decision) |
| Idle | Rate limit or bot check fails | Bot check inline (§16.6); the model is never called before it passes |

**Mobile** — the input is above the fold on a 360×640 screen with the keyboard open, which means the framing heading is at most two lines and the examples sit below the input. Submit is the keyboard's own return key; a visible "Continue" button appears once text exists, in the lower third, thumb-reachable.

---

## 4. Goal creation flow (`/start`)

**Purpose** — carry a raw sentence to a persisted, assessed, scheduled plan while spending as little of the user's patience as possible. This is the highest-stakes surface in the product: everything downstream is worthless if the user leaves here.

**Shape of the flow**

```
  [Landing input]
        │
        ▼
  ① Clarify        ~3s   restated outcome + ≤4 questions        §5
        │
        ▼
  ② Assess         ~4s   verdict, risks, alternative            §6
        │
        ├── realistic / ambitious ──► ③ Auth ──► ④ Generate ──► Today
        │
        └── unrealistic ──► fork: extend · narrow · proceed ──► ③
```

**Progress indication.** A single hairline rule under the header, filling across four segments. No numbered circles, no "Step 2 of 4" label, no wizard chrome. The user should feel motion, not process.

**Primary action** — advance. There is exactly one forward affordance per stage, always in the same position.

**Secondary actions** — edit the restated outcome; skip a question; go back one stage; abandon (with the draft preserved for 24 hours).

**Information hierarchy** — the same on every stage: what we understood → what we need → one way forward.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Clarify | Answers or skips | Assess (loading, §15.3) |
| Clarify | Edits the outcome statement | Re-runs clarify silently; questions may change; no flash of empty |
| Clarify | "That's not what I meant" | Back to raw input, prefilled, `raw_input` unchanged |
| Assess | Verdict realistic/ambitious | Auth gate |
| Assess | Verdict unrealistic | Fork (§6.4) |
| Assess | Verdict not plannable (safety, §5.11) | Decline state (§16.9) — no plan, no account prompt |
| Auth | Signed in | Generation |
| Auth | Abandons | Draft held 24h; returning with the cookie resumes exactly here |
| Generate | Success | `/goals/[id]/today`, first-run affordances on |
| Generate | Partial failure | Graph shown, week retried independently (§16.4) |
| Generate | Client disconnects | Server completes and persists; reopening resumes from `plans.status` |

**The auth gate.** It appears *after* the verdict and before persistence, and it says so: "Save this plan — we'll keep your assessment and pick up where you left off." Magic link and Google, nothing else. The pre-auth work is visible behind the gate, not replaced by it.

**Mobile** — one stage per screen, full height, forward action pinned to the bottom above the safe area. The keyboard never covers the active input. Back is a text link at top left, never a browser-only affordance.

---

## 5. Goal clarification flow

**Purpose** — establish that the system understood the goal, and collect only the facts that would change the plan. Cap: four questions (architecture AC-1.1).

**Primary action** — continue.

**Secondary actions** — edit the restated outcome inline; skip any question; expand "why we're asking".

**Information hierarchy**

```
Here's what we understood                        ← section label, quiet

Become a product manager at a top tech           ← restated outcome, 28px,
company within 12 months.                          inline-editable
                                       [edit]

Four things that change the plan                 ← section label

1  How much time can you give this each week?
   ( ) 2–3 h   (•) 4–6 h   ( ) 7–10 h   ( ) more
                                                 ← chips, not a dropdown
2  What's your closest experience so far?
   ┌────────────────────────────────────────┐
   │ Two years in customer support, some…   │
   └────────────────────────────────────────┘

3  Is any date fixed?
   ( ) No   ( ) Yes → [date]

4  Anything that has to stay untouched?
   ┌────────────────────────────────────────┐
   └────────────────────────────────────────┘

Skip the rest                          [ Continue → ]
```

**Design decisions and why**

1. **The restatement comes first and is editable.** This is the first moment the user can judge whether the system understood them. Editing it is the cheapest possible correction, and it protects `goals.raw_input` (immutable, architecture §3.3) while letting the normalized statement be the user's own words.
2. **All questions on one screen, not a wizard.** Four screens with one question each triples the perceived length and the abandonment surface. Everything visible means the user can see the end.
3. **Everything is skippable, and skipping is visible.** "Skip the rest" is a real affordance. When a question is skipped, the assumption the system made is shown on the assessment screen as plain text — "assuming 4–6 hours a week" — with a tap to change it. AC-1.2 requires that skipping everything still yields a plan; the UX requirement is that the user knows *what was assumed on their behalf*.
4. **Chips over dropdowns** for closed sets. One tap, no overlay, fully keyboard navigable as a radio group.
5. **No progress percentage, no question counter.** The four questions are visible; counting them is the user's business.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Loaded | Edits outcome, blurs | Silent re-clarify; questions update in place with a 200ms crossfade; never a spinner |
| Loaded | Skips all | Continue enabled; assumptions recorded and surfaced on the next screen |
| Loaded | Continue | Assess (§15.3 loading) |
| Loaded | Clarify failed | §16.2 with "Retry" and "Change what I wrote" |
| Loaded | Not plannable | §16.9 |

**Mobile** — questions stack; text inputs use the appropriate keyboard and `enterkeyhint="next"`; the Continue affordance is pinned; tapping a chip never scrolls the page. Inline editing of the outcome opens a focused sheet rather than an inline caret on a 28px block, which is unusable at 360px.

---

## 6. Feasibility result

**Purpose** — deliver an honest verdict in a way that reads as counsel from someone competent, not as a rejection. This screen is where the product's central promise is either kept or broken.

**Primary action** — depends on verdict (below). Exactly one per state.

**Secondary actions** — see what the judgement is based on; adjust an answer; go back.

### 6.1 Shared structure

```
Realistic, but it will be tight.                 ← verdict as a sentence, 28px

Twelve months is enough to move into product      ← rationale, ≤3 sentences
management from a support role at 4–6 hours a
week — if the portfolio work starts in the
first month.

What makes it hard                                ← section label
  ◐  No PM experience yet          most common failure point
  ◐  Hiring cycles run 3–4 months  start applying by month 8
  ○  Time is adequate              4–6 h/week is enough here

Based on typical transitions from adjacent        ← comparable_basis, 14px muted
roles. Moderate confidence.

                                    [ Build the plan → ]
```

1. **Verdict as a sentence, never a badge.** A pill reading `AMBITIOUS` is a label; "Realistic, but it will be tight" is a judgement. The product is in the judgement business.
2. **Risks carry the same health marks** used everywhere else in the product (§0.4), so the vocabulary is learned once.
3. **`comparable_basis` and confidence are always shown**, in small muted text, as one line. Never a percentage ring, never a gauge. Architecture R10 requires that the limits of the judgement are visible; a confidence meter dramatizes it, a sentence discloses it.

### 6.2 `realistic`

Verdict line states it plainly. One primary action: **Build the plan**.

### 6.3 `ambitious_but_possible`

Adds a **"What this requires"** block above the action — the two or three commitments that make the difference, stated concretely ("Five hours a week, every week, for the first three months"). This is the honest version of enthusiasm.

### 6.4 `unrealistic_as_stated` — the fork

The most carefully designed screen in the product. No plan for the stated outcome is generated (AC-2.5).

```
Six months isn't enough for this.                ← the sentence, unhedged

Becoming a surgeon takes 10–15 years of          ← rationale, specific,
training that can't be compressed, and it          never condescending
can't start without medical school.

Three ways forward                               ← all three, equal weight

┌──────────────────────────────────────────────┐
│ Narrow the outcome                Recommended│
│ Get accepted to medical school in 18 months. │
│ That's a real, hard, achievable goal — and   │
│ it's the first step of the one you named.    │
│                              [ Choose this ] │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Extend the timeline                          │
│ Keep the outcome, plan across 12 years.      │
│                              [ Choose this ] │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Plan it anyway                               │
│ We'll build the strongest 6-month version    │
│ and track the gap honestly.                  │
│                              [ Choose this ] │
└──────────────────────────────────────────────┘
```

**Rules for this screen**

- **All three options are visually equal.** "Recommended" is a word on one of them, not a size, color, or elevation difference. Architecture R10 says the system's judgement may be wrong; the UI must not use visual force to win an argument it might lose.
- **"Plan it anyway" is never penalized** — no warning icon, no "not advised", no confirm-you're-sure dialog. It is a legitimate choice, recorded with its risks (architecture §5.6 and R10), and the plan that follows is the strongest achievable version with the gap stated on Progress.
- **The narrowed outcome is concrete**, not a category. "Get accepted to medical school in 18 months" — never "consider a related goal."
- No red, no warning triangle, no interstitial. The screen is the same temperature as every other screen.
- **Choosing "Plan it anyway" changes nothing about how the product then treats the user** *(added in audit — see §22)*. The gap between the stated outcome and the achievable one is stated **once**, on Progress, as a fact. It is never re-raised, never used as a recurring caveat, never attached to a warning mark, and the assessment is only re-run on a major replan (architecture §3.2). A system that keeps reminding you it disagreed is not honest — it is nagging, and it is exactly the guilt dynamic §11 exists to prevent.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Verdict | Chooses any option | Auth gate, choice recorded on the draft |
| Verdict | "What's this based on?" | Panel: rationale, risks with severity and mitigation, basis, confidence |
| Verdict | "Change my answers" | Back to clarify, answers preserved |
| Verdict | Assessment persisted | Viewable forever at `/history` (AC-2.6) |

**Mobile** — options stack full-width in the same order; each is a single tap target; the rationale collapses to three lines with "more". The three options must all be reachable without a scroll trap: if the viewport can't fit them, the first is fully visible and the rest are clearly cut, never hidden behind a fold with no signal.

---

## 7. Roadmap view (`/goals/[id]/map`)

**Purpose** — answer "what has to become true, in what order, and what is everything waiting on?" This is the structure surface: read occasionally, not daily.

**Primary action** — open a milestone or project to read its verification criterion and status.

**Secondary actions** — edit a node; change a target date; add or remove a dependency; jump to the week where a project is being worked.

**The representation decision.** The **list is the primary representation and is never optional.** The node-and-edge diagram is an enhancement shown beside it on wide viewports.

This is not only accessibility compliance (architecture v2, AC-58) — though a canvas-only DAG cannot honestly reach Lighthouse ≥95 (AC-9.33). It is that a force-directed graph of 5 milestones and 15 projects is *prettier* than a list and *worse* at answering the question. The list can state "waiting on: Portfolio site" in words. The graph makes you trace a line.

**Information hierarchy**

```
Everything depends on finishing the portfolio site.   ← Standing Answer

Milestone 1 · Portfolio                     ◐ at risk · due Mar 14
  Done when: three case studies published on a live site
  │
  ├─ Build the site                         ● complete
  ├─ Case study #1                          ● complete
  ├─ Case study #2                          ◐ in progress · this week
  └─ Case study #3                          ○ not started
                                              waiting on: Case study #2

Milestone 2 · Applications                  · not started · due Jun 1
  Done when: 20 applications sent, 3 first-round interviews
  waiting on: Milestone 1
  │
  ├─ Target list                            ○ not started
  └─ Referral outreach                      ○ not started
```

1. **Milestones are the spine**, projects nested beneath them, in dependency-respecting order.
2. **Verification criteria are shown, not hidden** — "Done when: …" is the anti-self-deception mechanism (architecture §3.2) and it belongs in the open.
3. **Dependencies read as English**: "waiting on: Case study #2". A `blocks` edge is stated on the *blocked* node, because that is where the user needs it.
4. **The longest dependency chain** (architecture §5.5, resource-constrained) is marked with a marginal rule in the left gutter and one line of text — "This chain sets the finish date." Never a red highlight.
5. **Health marks are the same three-step scale** as everywhere else.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| List | Opens a node | Detail panel: summary, verification, estimate vs. actual, evidence, edit |
| List | Marks a milestone complete | Evidence required, non-`self_attest` (AC-5.18) → evidence sheet (§9.7) |
| List | Edits a target date | Inline; if it breaks dependency ordering, the invariant message states which node conflicts and offers the nearest valid date |
| List | Adds a dependency creating a cycle | Rejected at the field with the specific cycle named — "Case study #3 already waits on this" |
| List | Node dropped by an accepted replan | Shown dimmed under "Dropped", with the reason and date. Never deleted from view (architecture: append-only graph) |
| Any | Graph toggle (desktop) | Diagram appears beside the list; list keeps focus and keyboard position |

**Mobile** — list only. `[OUT OF SCOPE — Reason: a node-edge diagram is unreadable at 360px and the list is strictly better there]` Milestones are collapsible; the current milestone is expanded by default and the rest collapsed, so the screen opens at "what's live now" rather than at the top of a long tree.

---

## 8. This Week view (`/goals/[id]/week`)

**Purpose** — answer "what has to be true by Sunday, and is the week still realistic?" The commitment surface.

**Primary action** — open Today (the week is for orientation; the work happens in the day).

**Secondary actions** — add a task; move a task to another day; adjust this week's capacity; reflect (when the week has ended); view the milestone this week serves.

**Information hierarchy**

```
This week: publish teardown #2.                    ← Standing Answer

Week 3 of 24 · Mar 3–9 · 4h 30m planned of 5h      ← one line of context

Outcomes                                           ← the hero, 1–3 items
  ◐  Teardown #2 published
     Done when: live on the site with a shareable link
  ○  Ten target companies identified
     Done when: a list with names and a reason for each

Days                                               ← secondary
  Mon  ● 45m   Outline the teardown
  Tue  ● 45m   Draft sections 1–3
  Wed  ○ 60m   Draft sections 4–6            ← today, accent marker
  Thu  ○ 45m   Edit and publish
  Fri  ○ 30m   Start the target list
  Sat  —       no work planned
  Sun  —       reflection

Not done this week                                 ← only if non-empty
  Tue  Draft sections 1–3   ·  carried to Wed
```

1. **Outcomes first, days second.** Architecture §3.2: "weeks are measured by outcomes, not task counts." The layout has to say that before the task list does.
2. **Success criteria are always visible** on each outcome — an outcome without a "done when" is an aspiration.
3. **Capacity as one line of text**, with a hairline bar beneath at most. Planned vs. available. Not a donut, not a chart.
4. **Days are a list, not a grid.** A 7-column calendar grid at this density is unreadable on mobile and implies a calendar product. `[OUT OF SCOPE — Reason: architecture §1.1 non-goals — no calendar replacement]`
5. **Empty days are shown as empty**, with an em dash. A blank cell reads as a bug; "no work planned" reads as a decision.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Week | Taps a day | Today, scrolled to that day if it is today; read-only day detail otherwise |
| Week | Drags/moves a task | Rescheduled within the week; if the target day exceeds its budget, the day states the overage and offers the nearest day with room |
| Week | Adds a task | Sheet: title, effort, which outcome it serves. Outcome is required — a task with no parent outcome violates an invariant (architecture §7) and the UI enforces it rather than letting the server reject it |
| Week | Week has ended, no reflection | Reflect affordance appears at the top of the outcomes block, once, non-modal |
| Week | Capacity edited | Confirmation that a change >25% will produce a proposal (architecture §5.6 `capacity_changed`) — stated before the save, not after |
| Week | Week is fully complete | Quiet summary line — "Both outcomes met, 4h 15m of 4h 30m planned" — then Reflect |

**Mobile** — outcomes stay full width; days collapse to a single-line row each, expanding on tap. The current day is expanded on load. Adding and moving tasks happen in sheets, never in drag-and-drop, which is unreliable at this size.

---

## 9. Today view (`/goals/[id]/today`)

**The flagship surface.** Used daily, often on a phone, often standing, often for 90 seconds. Everything else in this document is subordinate to this screen working.

**Purpose** — answer "what matters right now?" in under three seconds, and let the user record what happened in one tap.

**Primary action** — complete a task.

**Secondary actions** — change the day tier; check in; add evidence; carry a missed task; open the week; skip or defer a task.

### 9.1 Layout

```
┌────────────────────────────────────────────────┐
│  Product Manager at a top…   Today  Week  Map ⋯│
├────────────────────────────────────────────────┤
│                                                │
│  Draft sections 4–6 of the teardown.           │  ← Standing Answer
│  It's the last thing before Thursday's publish.│     line 2, muted
│                                                │
│  ┌──────────┬──────────┬──────────┐            │  ← tier selector
│  │  20 min  │  60 min  │  90 min  │            │
│  │ minimum  │  normal  │  ideal   │            │
│  └──────────┴──────────┴──────────┘            │
│                     ↑ selected                 │
│                                                │
│  ○  Draft sections 4–6                   45m   │  ← task rows
│     so teardown #2 can publish Thursday        │     with why-line
│                                                │
│  ○  Skim two competitor teardowns        15m   │
│     to sharpen the framing                     │
│                                                │
│  ─────────────────────────────────────────────│
│  Not done yesterday                            │  ← only if non-empty,
│  Draft sections 1–3            [ Carry over ]  │     below the plan
│                                                │
│  ─────────────────────────────────────────────│
│  Week 3 of 24 · publishing teardown #2         │  ← context, quiet
│  Check in                                      │
└────────────────────────────────────────────────┘
```

**Information hierarchy** — in strict order of what a person needs while standing on a train:

1. **The Standing Answer.** What to do, and how long it takes.
2. **The tier selector.** How much of today is realistically available.
3. **The tasks.** Two to five rows, each with a one-line `why`.
4. **Missed work** — below the plan, capped, never above it.
5. **Context and check-in** — the quiet footer.

**No charts, no progress ring, no streak, no score, no motivational line, no "good morning".** Today is a work surface.

**Block budget: four.** Today renders at most four blocks — Standing Answer, tier selector, tasks, and one contextual block (missed work *or* a proposal notice *or* a check-in prompt, whichever ranks highest, never two at once). Under pressure the collapse order is fixed: missed work collapses to one line first, then the context footer, then the Standing Answer drops its second line. The tasks and the tier selector never collapse. *(Added in audit — see §22: five stacked mechanisms on a 360px screen is how a calm surface becomes a busy one.)*

**First run.** The first time a user reaches Today with a new plan, one dismissible line sits above the tier selector: "Pick the version of today that fits the time you actually have." It disappears on first interaction with the selector and never returns. Not a tour, not coach marks, not a modal, not a checklist.

### 9.2 The tier selector

Three segments — minimum / normal / ideal — each labeled with **its actual minute total**, because "minimum" means nothing and "20 min" means everything.

- **Default:** the tier matching the day's capacity profile, unless a check-in today says otherwise, in which case the tier the check-in implies.
- Selecting a tier re-renders the task list in place (120ms), never navigates, never confirms.
- **The minimum tier is always one tap away and always visible** (architecture §6.3, "chaotic day"). It is never behind a menu, a long-press, or a settings toggle.
- The minimum tier always contains the day's highest-priority outcome-advancing task, never the cheapest (architecture §5.9 step 4). The UI must never present a minimum day of busywork — the copy for it is "One thing: …".
- Semantics: `radiogroup` with three `radio` children, labeled "Time available today".

### 9.3 The task row

```
○  Draft sections 4–6                                   45m
   so teardown #2 can publish Thursday                  ⋯
```

- **The whole row is the completion target** — minimum 56px tall on mobile, well above the 44px floor, because this is the single most-used control in the product.
- **The `why` line is not optional.** An invariant already forbids a task without one (architecture §7); the UI shows it always, at 14px muted. It is what makes a task feel like part of something.
- **When a task sits on the longest dependency chain, the `why` line says so** — "this unblocks the applications milestone" *(added in audit — see §22)*. Identifying bottlenecks is a stated product principle, and burying that insight on Progress — a surface §1.2 deliberately makes rare — meant the most behavior-changing fact in the system was on the screen users are told not to visit.
- **Effort is right-aligned in tabular figures**, so a column of durations reads as a column.
- `⋯` opens: skip (with an optional reason), defer to a date, attach evidence, edit, view the outcome it serves.
- No drag handles, no checkboxes that are 16px targets, no hover-only actions.

### 9.4 State transitions

| From | Trigger | To |
| --- | --- | --- |
| Day with work | Completes a task | Row settles to done (strike + dim, 120ms), count updates, **undo stays available all day** (§9.6) |
| Day with work | Completes the last task | Quiet closing line: "That's today. Two outcomes still open this week." No celebration, no confetti (architecture §6.3) |
| Day with work | Changes tier | List re-renders in place; completed tasks are never removed by a tier change |
| Day with work | Skips a task | Row moves to a "skipped" group at the bottom with the reason; stays visible today only |
| Day with work | Defers a task | Row leaves today; a line states where it went — "Moved to Friday" |
| Day, first open, no check-in | Load | Forward check-in offered inline above the tier selector, once, non-modal, dismissible |
| Day, after 6pm local, work was planned | — | Evening check-in offered inline in the footer, once, non-modal |
| No work today | Load | "Nothing is scheduled today." + what's next + optional "Pull something forward" (§14.4) |
| Provider unavailable | Load | Deterministic tiering; a single quiet line notes that framing is unavailable; **execution fully works** (AC-5.19) |
| Plan not started yet | Load | Pre-start state (§14.5) |
| ≥7 days inactive | Load | Redirect once to `/resume` (§19.2) |
| Open replan proposal | Load | One-line notice above the footer; never a modal, never a badge |
| Offline | Completes a task | Optimistic local state, queued; a line states "Saved on this device — will sync". On reconnect, conflicts surface (§16.7) |

### 9.5 Evidence on a task

Optional for tasks, required for milestones. `⋯ → Attach` opens a sheet with three inputs: a link, a note, or a file. One tap each. Attaching never blocks completion — a task can be completed first and evidenced later, because the alternative is users not completing tasks.

### 9.6 Undo

Completion is reversible on the row itself — **not a toast**. A toast steals focus, times out unpredictably, and is invisible to a screen reader user who has moved on. The row reads "Done · Undo".

**There is no time limit on undo** *(revised in audit — see §22)*. The first draft gave it a 10-second window, which contradicted this document's own §18.6 ("nothing times out") and WCAG 2.2 SC 2.2.1 — a countdown on a corrective action penalizes exactly the users least able to beat it. Instead: the inline "Undo" is prominent for about ten seconds and then fades to the row's `⋯` menu, where it stays available until the day rolls over. The affordance quiets down; the capability does not expire.

### 9.7 Mobile behavior

The design target. 360×640 with a keyboard, one hand, in motion.

- Single column, 16px gutters, content starts below a 52px bar.
- The tier selector is sticky under the bar as the task list scrolls, because "how much time do I have" is the question people re-ask mid-list.
- Task rows are ≥56px with the entire row tappable.
- The check-in affordance sits in the footer, within thumb reach.
- No hover states carry meaning. No drag-and-drop. No horizontal scroll anywhere.
- Safe-area insets respected top and bottom; no fixed element covers the last task row.

---

## 10. Check-in flow

**Purpose** — capture the one or two facts the system cannot infer, in under ten seconds (architecture §3.2), and visibly change the plan in response.

**Primary action** — save.

**Secondary actions** — dismiss without saving; add a note.

### 10.1 What it asks, and what it doesn't

The system already knows what was completed and how much planned effort that represents. Asking the user to re-enter it is friction that buys nothing.

| Field | Asked? | Why |
| --- | --- | --- |
| Minutes available | **Morning only** | Cannot be inferred, and it selects the day tier — which is useless after the day is over |
| Energy | **Yes** | Cannot be inferred; feeds reflection and replan diagnosis |
| Note | Optional | The only free-text field; often where the real blocker appears |
| Minutes spent | **No — derived** | Summed from completed task effort. Editable in the note if the user disagrees |

**Two check-ins, not one** *(revised in audit — see §22)*. A single form asked at a single time is either too early to reflect or too late to plan.

| | Forward check-in | Evening check-in |
| --- | --- | --- |
| When | First open of the day | Offered once after 6pm if the day had planned work |
| Asks | Minutes available, energy | Energy, note |
| Purpose | Selects today's tier | Records how it actually went |
| Effort | Two taps | One tap |

Asking "how much time do you have today?" at 9pm is asking a question whose answer cannot change anything — the fastest way to teach someone that inputs are ceremony.

### 10.2 Layout

```
How much time do you have today?

  [ 15m ] [ 30m ] [ 60m ] [ 90m ] [ other ]

How's your energy?

  low  ○──○──●──○──○  high

Anything worth noting?                    (optional)
  ┌──────────────────────────────────────┐
  └──────────────────────────────────────┘

                                    [ Save ]
```

- Chips, not a number input. One tap for the common cases.
- Energy is a five-point scale labeled only at the ends — a labeled midpoint invites deliberation over a question that should take one second.
- Save is enabled from the first interaction; every field is optional.

### 10.3 The payoff — the most important part of this flow

**Saving must visibly change something**, or the user will stop doing it by day four.

On save, the sheet closes and Today updates with one line stating the consequence:

> "Today is the 20-minute version. One thing: send the intro email."

If nothing changed, say that too — "Today's plan already fits." Silence after an input is how a product teaches people the input doesn't matter.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Closed | Footer tap, `C`, or 6pm-with-no-check-in | Sheet opens, focus on the first chip |
| Open | Save | Sheet closes; tier may change; consequence line renders on Today for ~6s then settles |
| Open | Dismiss | Nothing saved, nothing asked again today |
| Open | Save fails | Sheet stays open, values preserved, one line: "Not saved — retry" |
| Weekly variant | Sunday, from Week or Reflect | Same controls plus the week's realized totals shown above them |

**Mobile** — a bottom sheet, not a dialog. Opens to 40% height, chips reachable by thumb, keyboard only summoned if the note field is tapped. Dismissible by swipe-down, which must not discard a partially-filled state without saving it as a draft in memory.

---

## 11. Missed-task flow

**The guilt surface.** Architecture §12 R2 names week-2 abandonment as a Critical risk, and the mechanism is almost always the same: a product that accumulates undone work and shows it to you every day until you quit.

**Purpose** — record reality without punishing the user, and offer exactly one way to recover.

**Primary action** — carry one item into today (available once per task, architecture `lapse_count ≤ 1`).

**Secondary actions** — leave it; see it in the week's context.

### 11.1 Rules

1. **Missed work appears in one place: below today's plan.** Never above it, never in the nav, never as a count, never as a badge, never on a second surface.
2. **Capped at three items.** More than three and the section reads "and 4 more this week" linking to Week. A wall of undone work is the thing this rule exists to prevent.
3. **One action per item, once.** After a carry is used or declined, the item leaves Today permanently and lives in Week and History. It never re-appears.
4. **No red, no warning icon, no "overdue".** The word is "Not done". It is a fact, not an accusation.
5. **No cumulative counter anywhere in the product.** There is no "12 tasks behind" figure, because that number's only function is to make people quit.
6. **The system takes responsibility for the plan, not the user.** After two missed days the plan adapts (architecture §5.6 Level 2, day-4 in-week recovery) — and when it does, Today says so: "This week's plan was reduced to fit what's actually happening." That sentence is the product working.

### 11.2 Copy

```
Not done yesterday

Draft sections 1–3               45m      [ Carry into today ]
```

No preamble, no reassurance, no meta-commentary about how it's okay. Telling someone their feelings are valid is its own kind of pressure. State the fact, offer the action, move on.

When the carry is used:

> "Carried. Today is now 90 minutes — that's above your normal. Drop to normal?"

The system notices the overcommitment and offers the correction, which is the difference between a planner and a to-do list.

**State transitions**

| From | Trigger | To |
| --- | --- | --- |
| Missed section shown | Carry | Task appears in today's list, marked "carried"; section removes the row; tier may be re-suggested |
| Missed section shown | Ignored | Persists for today only; gone tomorrow |
| Missed section shown | `lapse_count` already 1 | No carry affordance — the row is informational only, with "not carried forward" stated |
| ≥4 missed items | Load | Three shown + "and N more this week →" |
| Whole week missed | Load | The section is suppressed entirely; `/resume` handles it (§19.2) |

**Mobile** — the section is collapsed to a single summary line by default when there is more than one item: "3 things weren't done yesterday ⌄". Expanding is one tap. On the smallest screen, the day's plan must be fully visible before any missed work is.

---

## 12. Replanning flow

**The differentiator** (architecture AC-8). Everything here exists to make an adaptation feel like counsel rather than an automated override.

**Purpose** — show the user what changed in reality, what the system proposes to do about it, what it would cost, and let them decide.

**Primary action** — accept the proposal.

**Secondary actions** — modify the ops; leave the plan as it is; see the full diff; see why this was raised.

### 12.1 Entry — the notice

A proposal never arrives as a modal, a badge, a red dot, or an email.

```
────────────────────────────────────────────────
The plan needs a change.                    →
Two weeks at about a third of planned effort.
────────────────────────────────────────────────
```

One notice, on Today and Week, below the day's plan. It states the deterministic trigger in plain language — the *reason* is computed, not narrated by a model (architecture §5.1). It waits. It does not nag, does not re-alert, does not escalate, and does not expire visibly (it expires at 14 days server-side, silently, §16.8).

### 12.2 The proposal screen

```
Two weeks at about a third of the planned effort.    ← what happened, computed

You've completed 2 of 9 planned sessions since       ← diagnosis, AI narrative,
Feb 24. The teardowns are taking roughly twice          clearly the system's reading
the estimated time, and the target date assumed
the original estimate.

What we'd change                                     ← the ops, readable

  Move  Portfolio milestone   Mar 14  →  Apr 4
        because three case studies at the real
        pace need three more weeks

  Drop  Case study #3
        because two published studies is enough
        evidence for the applications milestone

  Rebuild  Weeks 4–8
        to fit 3 hours a week instead of 5

What it costs                                        ← trade-offs, always stated

  · The portfolio finishes three weeks later
  · The application window narrows from 4 months to 3
  · Nothing changes about the final target date

┌─────────────────────┬─────────────────────┐        ← before / after
│ Now                 │ Proposed            │
│ Mar 14  Portfolio   │ Apr 4   Portfolio   │
│ 3 case studies      │ 2 case studies      │
│ 5 h/week            │ 3 h/week            │
│ Finish: Nov 30      │ Finish: Nov 30      │
└─────────────────────┴─────────────────────┘

        [ Accept ]   Modify   Leave the plan as it is
```

**Information hierarchy**

1. **What actually happened** — deterministic, first, because it is the only part that isn't a judgement.
2. **The diagnosis** — the system's reading, in prose, clearly interpretive.
3. **The ops** — each with its own reason. A change without a reason is an override.
4. **The trade-offs** — mandatory and explicit (architecture §5.6, AC-8.29). The system must name what the user loses, in the user's terms.
5. **The before/after diff.**
6. **The actions** — one primary, two secondary, no default selection, no timer.

### 12.3 Rules

- **Never auto-applied.** (AC-8.29–30.) The only exception is Level-2 in-week recovery, which changes no scope, no dates, and no structure — and which announces itself on Today rather than asking.
- **"Leave the plan as it is" is a first-class choice**, not a dismissal link in grey 12px text. The system says what happens next: "We won't raise this again for a week." The cooldown is disclosed, not hidden.
- **Modify** opens the op list with each op individually toggleable. Turning one off shows the effect on the trade-off list immediately — that immediate feedback is what makes "modify" real rather than decorative.
- **High-impact ops require verbatim confirmation** (architecture §5.6): `narrow_outcome`, `extend_horizon`, `rescope_milestone`, `drop_project` show the before and after text in full, side by side, in a confirm step. A goal is not something software may quietly shrink, and the UI must make shrinking it feel deliberate.
- **The diff never uses red and green.** Removals are struck and dimmed; additions are marked with a hairline rule in the gutter and the word "new". Color-blind users get identical information (AC-9.33).

### 12.4 State transitions

| From | Trigger | To |
| --- | --- | --- |
| Notice | Opens | Proposal screen; the AI diagnosis is fetched lazily here (architecture §8.3 — no AI in cron) |
| Proposal | Diagnosis unavailable | Deterministic trigger detail and ops render anyway; the prose paragraph is simply absent |
| Proposal | Accept | Plan version N+1 activates; a confirmation states what changed and what to expect: "Weeks 4–8 rebuilt. Today's plan updates tomorrow." (AC-8.32) |
| Proposal | Accept, base state drifted | Invalid ops are dropped and *shown* — "Two changes no longer applied: Case study #3 was already completed" (architecture v2 stale-patch guard, AC-46) |
| Proposal | Accept, >⅓ ops invalid | "This proposal is out of date." Regenerate offered; nothing applied |
| Proposal | Modify → accept | Only the enabled ops apply; the modification is recorded |
| Proposal | Leave as it is | Recorded as rejected; 7-day cooldown for that trigger, stated on screen (AC-8.31) |
| Proposal | Expired / superseded | §16.8 |
| Any | After acceptance | Prior plan version remains readable at `/history`, rendered against its own graph revision (AC-41) |

**Mobile** — the before/after diff stacks vertically with a "Now / Proposed" segmented toggle rather than two columns; ops are full-width rows; the primary action is pinned to the bottom. The verbatim confirmation for high-impact ops is a full screen, not a sheet, because it is the one place in the product where a mis-tap is genuinely costly.

---

## 13. Progress view (`/goals/[id]`)

**Purpose** — answer "how far along am I, honestly, and where does that land me?" without inviting the user to live here.

**Primary action** — return to Today. Progress is a reading surface; its best outcome is a user who reads it and goes back to work.

**Secondary actions** — open any number's derivation; open the roadmap; open history; adjust capacity.

### 13.1 Layout

```
22% of the work is done. On pace for Dec 14,        ← Standing Answer
two weeks past your target.

Outcomes                                            ← progress, evidence-backed
  1 of 4 milestones complete
  ███████░░░░░░░░░░░░░░░░░░░░░░░░  22%
  Portfolio ● complete · Applications ◐ at risk ·
  Interviews ○ · Offer ○

How it's going                                      ← process signals, quiet
  Execution rate      0.62      ⓘ    of planned effort, last 14 days
  Momentum            71        ⓘ    active days, last 21 days
  Plan confidence     0.58      ⓘ    moderate — limited data
  Projected finish    Dec 14    ⓘ    14 days past target

The bottleneck                                      ← one thing, named
  Case study #2 is three weeks old and blocks
  the whole applications milestone.
                                    [ Open in Today ]
```

**Information hierarchy**

1. **Outcome progress is the hero** — effort-weighted project completion plus milestones complete (architecture v2 §5.5). This is the number that means "how much of the goal is done." Everything else is process.
2. **Process signals are secondary and quiet** — a small aligned table, tabular figures, no sparklines, no cards.
3. **The bottleneck is named**, with an action. A progress screen that doesn't tell you what to do about it is a report.

### 13.2 What you've actually done

*(Added in audit — see §22.)* A block beneath the signals, listing the most recent completions with their evidence and, where both exist, estimate against actual:

```
What you've done                              last 14 days

  Mar 8   Case study #2 published    60m est · 95m actual   ↗ link
  Mar 6   Draft sections 4–6         45m est · 40m actual
  Mar 4   Outline the teardown       45m est · 45m actual

  Your estimates run about 30% short on writing tasks.
```

The architecture stores evidence and realized effort per node; nothing in the first draft of this spec ever showed either back to the user. Evidence collected and never surfaced is pure friction — the user pays the cost of attaching it and receives nothing. And "your estimates run 30% short on writing" is a genuinely useful thing to learn about yourself, derived entirely from stored data with no model involved. This is what "did the user make meaningful progress?" looks like as a surface: their own record, in their own evidence, not a percentage.

### 13.3 No dashboard

No stat-card grid. No chart wall. No time-series graph of momentum. Numbers live in an aligned table; the only graphic in the entire surface is a single hairline progress bar. Architecture §12 R3 (over-planning) applies to measuring as much as to planning.

### 13.4 Honesty about thin data

Under the sufficiency thresholds (architecture §5.5), the surface says so instead of rendering a confident zero:

> "Not enough data yet. After seven days of execution, these become meaningful."

Signals that are individually unknown render as `—` with the reason on focus and in the derivation panel — never hover-only. A zero that means "no data" is a lie the interface tells; this product cannot afford it (architecture AC-6.22).

### 13.5 "Why this number" — the ⓘ affordance

Every computed figure opens a panel built from `goal_signals.explanation` (architecture §5.5):

```
Execution rate · 0.62

What it means   Completed effort divided by effort planned
                for those days, over the last 14 days.
Where it comes  4h 40m completed of 7h 30m planned,
from            Feb 24 – Mar 9.
Caveat          Two days had no plan and are excluded.
```

**This panel must render with the AI provider disabled** (AC-6.21). It is database content, not narration. A product that computes a judgement about someone's life and cannot show its work is asking for trust it hasn't earned.

### 13.6 State transitions

| From | Trigger | To |
| --- | --- | --- |
| Progress | ⓘ on any signal | Derivation panel; `Esc` returns focus to the trigger |
| Progress | Milestone tapped | Roadmap, scrolled and focused on that node |
| Progress | <7 days of data | Sufficiency state (§13.4); outcome progress still shows if any project is complete |
| Progress | Goal `paused` | Signals frozen with the date of the last data; "Paused since Mar 2" |
| Progress | Target date passed, unachieved | §19.4 |
| Progress | Goal achieved | §19.5 |
| Progress | Off track | Standing Answer states it plainly; bottleneck block leads to the smallest fix; a proposal notice appears if one is open |

**Mobile** — the progress bar and milestone list stay full width; the signals table becomes a two-column list (label left, value right) that never scrolls horizontally; ⓘ opens a full-width sheet.

---

## 14. Empty states

**Principle.** An empty state is a designed state, never an absence. Every one of them: a sentence saying what is true, a sentence saying what happens next, and at most one action. No illustrations, no "Nothing here yet!", no empty tables with headers and no rows.

| # | Where | What it says | Action |
| --- | --- | --- | --- |
| 14.1 | No goal (`/goals`, or first sign-in) | "You don't have a goal yet. Start with the outcome, not the steps." | Landing-style input, inline |
| 14.2 | Signals, <7 days of data | "Not enough data yet. After seven days of execution, these become meaningful." | None — this is not a problem to solve |
| 14.3 | Progress, no completed project | "Nothing is complete yet. The first milestone is Portfolio, due Mar 14." | Open roadmap |
| 14.4 | Today, no work scheduled | "Nothing is scheduled today. Week 3 resumes Monday." | "Pull something forward" — offers the next task, respecting dependencies |
| 14.5 | Today, plan starts in the future | "Your plan starts Monday. Week 1 is about publishing teardown #1." | "Start now instead" — re-anchors week 1 to today (architecture v2 §6.3) |
| 14.6 | Week, no outcomes (should be impossible) | "This week has no outcomes — that's a fault on our side." | "Rebuild this week" |
| 14.7 | Roadmap, graph not generated | "The roadmap is still being built." | Progress narration (§15.3) |
| 14.8 | Reflection, no execution data | "There's nothing recorded for this week. Reflect anyway, or skip." | Both offered equally |
| 14.9 | History, one plan version | "One plan so far, created Mar 1. Changes will appear here." | None |
| 14.10 | Evidence, none attached | "No evidence attached." + what would count, from `verification` | "Attach" |
| 14.11 | Missed section, nothing missed | *Section does not render.* | — |
| 14.12 | Goal list, one goal (free tier) | *Route is not exposed.* Nav goes straight to the goal. | — |

**14.11 and 14.12 are the important ones.** The best empty state is frequently no state at all. A section that renders "nothing missed 🎉" teaches users to look for a section that will eventually say something bad.

---

## 15. Loading states

**Principle.** Match the wait to the mechanism. Three durations, three treatments, and a spinner is never one of them.

### 15.1 Instant (<300ms) — no treatment

Tier changes, task completion, panel opens. The state changes and that is all. Adding a loading treatment to a sub-300ms interaction makes the product feel slower.

### 15.2 Fast (300ms–2s) — skeletons

Route transitions, RSC payloads. Skeletons match the **final layout exactly** — same line count, same heights, same rhythm — so nothing reflows on arrival. Reflow is the thing that reads as cheap. Never a centered spinner on a blank page.

### 15.3 Generation (5–40s) — staged narration

The first plan build, and the only place in the product with sustained motion. This is where users abandon (architecture §12 R4), so the wait must feel like work being done, and must show real intermediate output.

```
Building your plan

  ● Understanding the goal              done
  ● Checking whether 12 months works    done
  ◐ Mapping the milestones              …
  ○ Finding what depends on what
  ○ Building week 1

  Portfolio                              ← partial results stream in
  Applications                              as they resolve
  ─
                                    Cancel
```

- **Stages are named in the user's vocabulary**, never the system's — "Mapping the milestones", never "Running decompose".
- **Partial results render as they arrive** (architecture §6.3, streaming partial). Milestones appear one at a time. This is the difference between a 25-second wait and a 25-second show.
- **Cancellable at any time**, and cancelling is honest about what happens: the server finishes and persists the work anyway (architecture §8.2), so the copy is "Leave this running" rather than implying destruction.
- **A `role="status"` live region** announces each stage transition once, politely, for screen reader users (§18.5).
- **Never a percentage** unless it is real. A fake progress bar that jumps to 90% and waits is the single most distrusted pattern in software.

### 15.4 Slow or stalled (>45s)

The stage list stays; one line is added: "This is taking longer than usual. Your work is saved — you can close this and come back." Leaving genuinely works (architecture §8.2), so the interface can honestly say so.

### 15.5 Optimistic states

Task completion, check-in save, and tier selection are optimistic: the UI updates immediately and reconciles. On failure, the row reverts with one line stating what happened and offering retry — never a silent revert, which trains users to distrust every tap they make.

---

## 16. Error states

**Principle.** Every error names what happened, what it means for the user's work, and exactly one thing to do. No raw error text, no codes, no "something went wrong", no dead ends (architecture AC-9.37).

**The load-bearing rule: execution never blocks.** Completing tasks, checking in, attaching evidence, and reading the plan work during every failure below. Only *generation* degrades. This is what separates a tool from a demo.

| # | Error | Copy | Action | Notes |
| --- | --- | --- | --- | --- |
| 16.1 | Provider unavailable | "Planning help is unavailable right now. Today's plan still works." | Dismiss; retry later | Deterministic tiering (AC-5.19); Standing Answer line 1 unaffected |
| 16.2 | Plan output failed validation | "We couldn't produce a plan we'd trust. Nothing was saved." | "Try again" · "Change my answers" | Never show a partial or broken plan (architecture §6.3) |
| 16.3 | Quota exceeded (free tier) | "You've used this month's plan rebuilds. Resets Apr 1." | "Use my own key" · "Keep going" | Read and execution paths fully intact (architecture §9) |
| 16.4 | Partial generation failure | "Your roadmap is ready. Week 1 didn't finish building." | "Build week 1" | The decomposition is never discarded (architecture v2) |
| 16.5 | Generation interrupted / lease expired | "The plan build stopped partway." | "Resume" (from `stages_completed`) · "Start over" | Resume is the default and listed first |
| 16.6 | Bot check required (unauthenticated) | "One quick check before we build this." | Turnstile inline | Before the first model call (architecture §5.12); no model call precedes it |
| 16.7 | Conflict (two tabs / offline sync) | "This changed somewhere else. We reloaded it — your completion is still recorded." | "Review" | Never silently discard the user's action |
| 16.8 | Proposal expired or superseded | "This proposal is out of date — the plan has moved on." | "Get a fresh read" | Stale patches are never applied (AC-46) |
| 16.9 | Goal declined (safety) | One sentence on why nothing was generated, plus a general resource pointer. | "Start a different goal" | No plan, no graph, no lecture (architecture §5.11) |
| 16.10 | BYOK credential invalid | "Your OpenAI key was rejected. We didn't use anyone else's — your data stayed with you." | "Update key" | Explicit no-fallback statement (architecture v2 §5.3) |
| 16.11 | Service at capacity | "Plan building is paused until 00:00 UTC. Everything else works." | Dismiss | Spend breaker (architecture §5.12) |
| 16.12 | Evidence upload failed | "That file didn't upload. The task is still marked done." | "Retry" · "Attach a link instead" | A completion is never lost to a failed upload |
| 16.13 | Offline | "You're offline. Today's plan is here, and completions will sync." | None | Cached RSC payload (architecture §6.3) |
| 16.14 | Not found / no access | "That isn't here." | "Go to today" | No detail about whether the resource exists — no enumeration surface |
| 16.15 | Unexpected failure | "Something on our side failed, and we've logged it. Your work is saved." | "Reload" · "Go to today" | Last resort only; never renders raw error text |

**Error placement.** Errors that concern one control render at that control. Errors that concern a surface render as one line at the top of it. Errors never render as toasts that disappear before they can be read, and never as modals unless the user's next action would otherwise destroy something.

---

## 17. Mobile behavior

**Frame.** Today is a mobile surface used standing up, one-handed, in under two minutes, possibly on a train with one bar of signal. Week and Progress are seated surfaces. The Roadmap is a desktop luxury with a working mobile fallback. Design in that order.

### 17.1 Global rules

| Rule | Detail |
| --- | --- |
| Baseline viewport | 360×640. Everything must work here (AC-9.35). |
| Layout | Single column, always. No responsive multi-pane, no horizontal scroll anywhere in the product. |
| Touch targets | ≥44px everywhere; ≥56px for task rows and the tier selector. |
| Thumb zone | Primary actions in the lower third. Destructive actions never there. |
| Text size | 16px minimum on inputs (prevents iOS zoom-on-focus); no text below 12px anywhere. |
| Safe areas | Respected top and bottom; no fixed element ever covers the last row of content. |
| Hover | Never load-bearing. Every hover affordance has a tap and a focus equivalent. |
| Drag | Never required. Reordering and moving happen through sheets. |
| Sheets over dialogs | Bottom sheets for check-in, evidence, task actions, and derivations. Dialogs only for destructive confirmation. |
| Wide content | Diffs and tables stack or toggle rather than scroll sideways. |

### 17.2 Per-surface behavior

| Surface | Mobile behavior |
| --- | --- |
| Landing | Input above the fold with the keyboard open; examples below; submit reachable by thumb |
| Start | One stage per screen; forward action pinned; keyboard never covers the active field |
| Feasibility | Options stack full width, equal weight; rationale collapses to three lines |
| Today | Sticky tier selector; 56px rows; check-in in the footer; missed work collapsed to one line |
| Week | Outcomes full width; days collapse to one row each, current day expanded |
| Roadmap | List only; current milestone expanded, others collapsed; no diagram |
| Progress | Two-column label/value list; ⓘ opens a full-width sheet |
| Replan | Before/after as a segmented toggle, not two columns; ops full width; verbatim confirm is full-screen |
| Check-in | Bottom sheet at 40% height; chips in the thumb zone |
| History | Reverse-chronological list; each version opens full screen |

### 17.3 Offline

Today renders from the cached payload. Completions queue locally and reconcile on reconnect, with conflicts surfaced (§16.7). The interface states which mode it is in, once, quietly — a user who doesn't know their taps aren't saved is a user about to lose work.

`[OUT OF SCOPE — Reason: v1 is a web app]` Native apps, push notifications, home-screen widgets, and background sync beyond the reconciliation above.

---

## 18. Accessibility behavior

**Target: WCAG 2.2 AA, verified, not asserted** (architecture AC-9.33–34, AC-58). Accessibility here is not a compliance exercise — a product used daily under time pressure by a distracted person benefits from every one of these.

### 18.1 Structure and semantics

- One `<h1>` per surface: the Standing Answer. Section labels are real headings in order, never skipped levels, never styled `<div>`s.
- Landmarks: `banner`, `navigation`, `main`, `contentinfo`. A skip link to `main` is the first focusable element on every page.
- The task list is a `<ul>`; each task row is one `<li>` with a single labeled control. The tier selector is a `radiogroup` labeled "Time available today". Health marks are `<span>`s with visible text, not `aria-label`-only icons.
- Data tables (signals, plan versions) use real `<th>` with scope.

### 18.2 Keyboard

- Every action is reachable by keyboard, in a logical order, with no traps (AC-9.34). The command palette (§2.2) exposes every action for users who cannot or prefer not to tab.
- Focus is **always visible**: 2px accent ring with a 2px offset, on every focusable element, in both themes. `:focus-visible` for pointer users, but never `outline: none` without a replacement.
- Panels and sheets trap focus while open, close on `Esc`, and **return focus to the element that opened them**. This is the most commonly broken rule in practice and the most disorienting when broken.
- Single-letter shortcuts are disabled while a text input has focus (WCAG 2.1.4).
- No keyboard-only or pointer-only feature exists anywhere.

### 18.3 Visual

- Contrast ≥4.5:1 for body text, ≥3:1 for large text and UI boundaries, in light and dark. The launch audit already caught one real 2.58:1 failure (`docs/LAUNCH-AUDIT.md` §3) — contrast is checked in CI, not by eye.
- **Status is never conveyed by color alone** (§0.4): shape + word, always.
- The diff (§12.2) uses strikethrough, dimming, and gutter rules — never red/green as the sole differentiator.
- Supports 200% zoom and 320px-equivalent reflow with no loss of function and no horizontal scrolling.
- Respects `prefers-reduced-motion`: all motion collapses to instant opacity changes, including the generation narration, which becomes a plain updating list.
- Supports `prefers-contrast` and forced-colors mode; nothing depends on a background image or a custom-property color that disappears there.

### 18.4 The roadmap, non-visually

The list representation is primary and complete (§7). The diagram is `aria-hidden` decorative enhancement, because a screen reader cannot usefully traverse an SVG DAG and pretending otherwise with `aria-label` soup is worse than not trying. Everything the diagram shows — nodes, statuses, dependencies, the longest chain — is stated in the list in words (AC-58).

### 18.5 Live regions — used sparingly and deliberately

| Event | Region | Announcement |
| --- | --- | --- |
| Generation stage change | `role="status"` (polite) | "Mapping the milestones" — once per stage, never re-announced |
| Task completed | `role="status"` (polite) | "Done. Two tasks left today." |
| Tier changed | `role="status"` (polite) | "Twenty-minute plan. One task." |
| Check-in consequence | `role="status"` (polite) | The consequence line verbatim (§10.3) |
| Validation error | `role="alert"` (assertive) | The specific message, once |
| Replan proposal appears | **None** | It is not urgent; it is discovered on the surface like everything else |

Over-announcing is its own accessibility failure. Nothing interrupts unless the user's action failed.

### 18.6 Forms and inputs

Every input has a persistent visible label — never a placeholder as a label. Errors are linked with `aria-describedby`, stated in text, and never color-only. Nothing times out. Nothing auto-submits. Nothing re-orders under focus.

### 18.7 Cognitive load

- One primary action per screen (§0.2).
- Plain language everywhere, no jargon (§0.6), no idioms that don't translate.
- Undo on the destructive-feeling action people take most (completion, §9.6).
- Confirmation only where recovery is genuinely impossible.
- The product never uses time pressure as a motivator: no countdowns, no expiring offers, no "act now" framing anywhere.

---

## 19. Surfaces the loop requires that were not in the brief

The eighteen sections above were the brief. The core loop cannot close without these five, so they are specified here rather than discovered during implementation.

### 19.1 Weekly reflection (`/goals/[id]/reflect`)

**Purpose** — convert a week of execution into a judgement the next week can use. Between EXECUTE and ADAPT in the loop; without it, adaptation runs on numbers alone.

**Primary action** — submit the reflection.
**Secondary actions** — skip this week; view the week's data; go straight to the proposal if one is open.

**Hierarchy** — the week's actual data *first* (outcomes met, effort realized vs. planned, what wasn't done), then three questions: what worked, what didn't, what's in the way. Showing the data before the questions is what makes the answers accurate rather than a mood reading (AC-7.23).

**Transitions** — submit → synthesis with at least one concrete recommendation and no motivational filler (AC-7.24) → if a trigger fired, the proposal notice appears beneath it, never as a redirect. Skipping is always allowed and never counted or mentioned again.

**Mobile** — questions stack; each field is optional; a partially-written reflection is preserved locally.

### 19.2 Re-entry (`/goals/[id]/resume`)

**The highest-leverage retention surface in the product** (architecture v2 §6.3). It intercepts once when a user returns after ≥7 days away.

**Purpose** — let someone come back without facing a wall of undone work.

**Primary action** — "Pick up where I left off" → the plan is recalculated forward and Today opens.
**Secondary action** — "My situation changed" → capacity update → proposal.

```
You've been away 12 days.                       ← fact, not a greeting

While you were gone
  · Week 4 and week 5 passed
  · 9 sessions weren't done
  · The portfolio milestone is now at risk

Nothing is lost. The plan can absorb this.      ← the reassurance is
                                                   structural, not emotional
  [ Pick up where I left off ]
  My situation changed →
```

**Rules** — no apology, no guilt, no "we missed you", no cumulative backlog, no red. Missed work is summarized as a count, never enumerated as a list to scroll past. The screen appears **once**; the next visit is normal. `[ASSUMPTION]` Seven days is the right threshold; worth tuning from `product_events`.

### 19.3 Plan history (`/goals/[id]/history`)

**Purpose** — answer "what did this used to say, and why did it change?" This is what makes the product's adaptation claim auditable rather than a promise.

**Primary action** — open a version.
**Secondary actions** — compare to current; read a past assessment; read a rejected proposal.

Reverse-chronological list of plan versions, replan events (accepted *and* rejected, with reasons), and assessments. A superseded plan renders against its own graph revision, including dropped projects, marked "superseded on Mar 22" (AC-41). Rejected proposals are shown with equal weight to accepted ones — a system that only records the advice you took is not a record.

### 19.4 Target date passed, unachieved

**Purpose** — handle the moment most goal products handle by going silent.

Progress and Today both state it plainly: "Your target date was Nov 30. Two of four milestones are complete." Then what actually got done, then an honest re-projection, then three equal options: extend, narrow, or archive. No red, no failure language, no "you didn't make it". The tone is identical to every other screen — which is the entire point of having one voice.

### 19.5 Goal achieved

Evidence-gated (AC-5.18). A quiet summary: what was accomplished, elapsed time, how the estimates compared to reality — the last one being genuinely useful information for the next goal. Then one question: "What's next?" with "Start a new goal" and "Extend this one" as equal options.

**No confetti, no share card, no badge** (architecture §6.3). The reward for finishing a hard thing is having finished it.

### 19.6 Settings

Goal settings (capacity, constraints, target date, pause, archive), account, AI/BYOK, and data (export, delete). Two rules: any change that would trigger a replan says so **before** the save, not after; and pause, archive, and delete each state exactly what happens to the data.

---

## 20. Component inventory

Fifteen components carry the entire product. If implementation grows a sixteenth, that is a signal to re-read §0.2.

| Component | Used by | Notes |
| --- | --- | --- |
| Standing Answer | Every primary surface | §0.5. Deterministic line 1, optional AI line 2 |
| Tier Selector | Today | Radiogroup, three segments, minute totals as labels |
| Task Row | Today, Week | 56px, whole row tappable, `why` line mandatory |
| Health Mark | Everywhere | Shape + word, never color alone |
| Signal Line | Progress, Week | Label · tabular value · ⓘ derivation |
| Derivation Panel | Progress | From `goal_signals.explanation`; renders with AI disabled |
| Verdict Panel | Feasibility | Sentence verdict, risks, basis, one action |
| Option Cards | Feasibility fork, target-passed, achieved | Equal visual weight, always |
| Question Set | Clarify, Reflect, Check-in | Chips, scales, optional text; all skippable |
| Stage Progress | Generation | Named stages, partial results, live region, cancel |
| Diff View | Replan | Struck/dimmed removals, gutter-ruled additions, no red/green |
| Notice | Today, Week | One line, one arrow, never a badge or modal |
| Evidence Sheet | Task, milestone | Link / note / file; never blocks completion |
| Confirm (verbatim) | High-impact replan ops, delete | Full text before and after; full-screen on mobile |
| Bottom Sheet | Check-in, task actions, derivations (mobile) | Focus-trapped, `Esc`-closable, returns focus |
| Record List | Progress §13.2 | Completions with evidence and estimate-vs-actual; no model involved |

---

## 21. Open questions

1. `[DECISION NEEDED]` **Where does the day tier default come from when there is no check-in?** Current spec: the capacity profile's normal day. Alternative: the trailing 7-day realized median, which would adapt silently to a user who consistently does less. The second is smarter and less predictable; predictability probably wins for v1, but this deserves a real decision.
2. `[DECISION NEEDED]` **Should Today show tomorrow?** A one-line preview may aid planning; it may also pull attention off today. Spec currently says no. Worth testing.
3. `[ASSUMPTION]` **Seven days is the right re-entry threshold** (§19.2).
4. `[ASSUMPTION]` **Users prefer honesty to encouragement** (§0.6) — the product's central bet, and the first thing to validate with real users.
5. `[ASSUMPTION]` **Three tiers is the right number.** Two (minimum / normal) may be enough; five would be too many.
6. `[OUT OF SCOPE — Reason: v1 non-goals, architecture §1.1]` Notifications and any re-engagement channel. Re-entry (§19.2) is the only recovery mechanism v1 has, which makes it carry more weight than it eventually should.

---

## 22. Audit against the product thesis

One pass, after the draft was complete, against the thesis in `CLAUDE.md` §8 and §13 and the commitments in `PRODUCT-ARCHITECTURE.md` §1. The test applied to every screen was the governing question — *did this help the user make meaningful progress?* — not *is this a nice screen?*

### 22.1 Where the draft held

| Thesis requirement | Verdict | Evidence |
| --- | --- | --- |
| Make the next meaningful action obvious | **Pass** | The Standing Answer (§0.5) is a structural component, not a slogan, and every surface has a defined form for every state |
| Favor realistic plans over aspirational ones | **Pass** | §6 treats the verdict as counsel, presents the fork as three equal options, and never blocks |
| Avoid guilt-oriented UX | **Pass** | §11: one placement, capped at three, one action, no counters, no red, no streaks anywhere in the product |
| Adapt rather than blame | **Pass** | §12 is built as a proposal with stated trade-offs; §19.2 handles the return-after-absence case as a first-class surface |
| Preserve historical state | **Partial → fixed** | §19.3 covered plan history, but the user's *own execution record* was stored and never shown. See R4 below |
| Minimize unnecessary complexity | **Partial → fixed** | 15 components and one column everywhere is disciplined; Today itself had drifted to five stacked mechanisms. See R7 |
| Reduce abandonment | **Partial → fixed** | Loading, error, and re-entry states were thorough; the first 30 seconds on Today were unspecified. See R8 |

### 22.2 What the audit found and what changed

Eight revisions, all applied in place above.

| # | Finding | Why it mattered | Change |
| --- | --- | --- | --- |
| **R1** | **The navigation contradicted the IA.** §1.2 argued that planning surfaces must be reachable but never ambient, citing architecture R3 (over-planning, High). §2.1 then gave Map a permanent tab with equal weight to Today. | This is the specific failure mode the architecture warns about: users tuning the plan instead of executing it. A spec that argues against itself resolves in favor of whichever section the implementer reads second. | Two peers — Today · Week. Roadmap moves to the `⋯` menu, `M`, and contextual links from Week and Progress. Mobile drops the bottom tab bar entirely (§2.4): it costs 56px permanently on the surface that most needs height, and it optimizes weekly destination-switching over the daily action, which is completing a task. |
| **R2** | **The check-in asked the wrong question at the wrong time.** One form, offered after 6pm, led with "how much time do you have today?" | An input that cannot change anything teaches the user that inputs are ceremony — and the check-in is the product's only source of capacity truth. Under-ten-seconds was also unreachable while asking four things. | Split into a forward check-in (first open: minutes, energy — sets the tier) and an evening check-in (energy, note). Minutes spent stays derived. §10.1. |
| **R3** | **The bottleneck was named only on Progress.** Identifying bottlenecks and dependencies is an explicit product principle, and §1.2 deliberately makes Progress a rare surface. | The single most behavior-changing fact the system computes was placed on the screen users are told not to visit — the daily surface knew about it and stayed silent. | Tasks on the longest dependency chain say so in the `why` line, and the Standing Answer names the bottleneck-clearing task ahead of anything shorter or easier. §0.5, §9.3. |
| **R4** | **The user's own execution record was invisible.** Evidence and realized effort are stored per the architecture; nothing in the draft ever showed either back. | Evidence the user attaches and never sees again is pure friction: they pay the cost and receive nothing, so they stop attaching it — and evidence is the anti-self-deception mechanism the whole progress model rests on. "22% complete" is also a weaker answer to *did I make progress* than a list of what you actually did. | New "What you've done" block on Progress: recent completions, their evidence, and estimate-vs-actual, with a derived observation. No model involved. §13.2. |
| **R5** | **Undo had a countdown, and the same document banned countdowns.** §9.6 gave undo a 10-second window; §18.6 says nothing times out. | A direct contradiction with WCAG 2.2 SC 2.2.1, and a time limit on a *corrective* action penalizes precisely the users least able to beat it — motor-impaired, screen reader, distracted, which is most people using this product on a train. | The prominent affordance fades after ~10s; the capability moves to the row's `⋯` menu and stays until the day rolls. Quiet down, don't expire. §9.6. |
| **R6** | **"Plan it anyway" had no defined downstream treatment.** The screen was carefully non-punitive; nothing said whether the product would keep bringing it up. | Unspecified means it gets specified by whoever builds it, and the tempting build is a persistent caveat on the plan — which converts an honest disagreement into a recurring reproach, the exact dynamic §11 exists to prevent. Architecture R10 also says the system's judgement may simply be wrong. | The gap is stated once on Progress and never re-raised; no warning mark; the assessment re-runs only on a major replan. §6.4. |
| **R7** | **Today had drifted to five stacked mechanisms** — answer, tier selector, tasks, missed work, check-in prompt, plus a possible proposal notice. | On a 360px screen that is a busy surface, and Today is the one screen whose calmness is load-bearing. "At most one primary action" (§0.2) was being honored while the *reading* load crept up. | Explicit four-block budget with a fixed collapse order: missed work collapses first, then the footer, then the Standing Answer's second line. Tasks and the tier selector never collapse. Only one contextual block renders at a time. §9.1. |
| **R8** | **The first 30 seconds on Today were unspecified.** A brand-new user lands on a screen with an unexplained three-segment control. | Abandonment is a Critical risk (architecture R2) and this is the moment the product is least understood and most easily dismissed as another planner. | One dismissible line above the tier selector on first run, gone on first interaction. No tour, no coach marks, no checklist. §9.1. |

### 22.3 What the audit deliberately did not change

- **The Standing Answer stays deterministic-first.** It was tempting to let the model write the whole sentence — it would read better. It would also mean the answer to "what matters right now?" depends on a network call to a provider that architecture §5.12 can deliberately switch off. The line stays computed; the model may only add a second line that is always safe to drop.
- **Progress keeps no charts.** A momentum time-series would be easy and would look impressive in a screenshot. It also invites exactly the behavior R3 warns about, and momentum's own definition (§5.5, binary per day) makes a trend line more precise-looking than it is.
- **No notifications, and re-entry carries that weight.** Architecture §13.10 defers notifications; §19.2 is therefore the only recovery mechanism v1 has for a lapsed user. That is a known structural gap, not an oversight, and it is why §19.2 is specified in more detail than its screen count would suggest.

**Status after revision:** the spec is internally consistent, every screen in the brief has purpose, primary action, secondary actions, hierarchy, transitions, and mobile behavior defined, and every state in `PRODUCT-ARCHITECTURE.md` §6.3 — including the sixteen added in v2 — has a designed treatment here.
