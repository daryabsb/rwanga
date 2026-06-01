# Slug Truth Doctrine V1

> **A doctrine decision, not an implementation.** Answers the Phase 1 finding that Flow and Print compose scene headings in different orders. No CSS, no recognition packages, no page geometry, no sequencing.
> Date: 2026-06-01 · Scope: which surface owns the truth of a scene heading (the "slug"), and what the canonical slug *is*.
> Grounded in: the Phase 1 Flow-vs-Print finding, `PRINT_TRUTH_DOCTRINE_V1.md`, `RTL_SCREENPLAY_CONVENTION.md`, the CORE/Plugin/Platform doctrine (Law 4 flow-continuous, Law 11 `.rga` portability, Law 12 single-resolver page truth), schema-v3 (LOCKED).

---

## The reframe

The finding states the two orderings precisely:

- **Flow composes** `SETTING — TIME / LOCATION` → `INT. — DAY / KITCHEN`
- **Print composes** `SETTING LOCATION — TIME` → `INT. KITCHEN — DAY`

The question as handed — *"which surface owns slug truth, Flow or Print?"* — contains a hidden assumption that must be rejected before it can be answered: **that the truth of a slug is a string, and that a string must be owned by a surface.**

It is not. Under schema-v3 the scene heading is **already structured data** — that is the entire reason the picker exists. A writer does not type a sentence; they choose a setting token, name a location, choose a time-of-day token. The two "orderings" in the finding are not two truths competing to be canonical. **They are two *renderings* of one underlying record** — one ordering chosen for authoring ergonomics, one for screenplay convention. Neither `INT. — DAY / KITCHEN` nor `INT. KITCHEN — DAY` is the slug. They are both *the slug, written down two different ways.*

So the finding is correct that this is a doctrine decision and not a bug. But the doctrine it forces is not a new invention. It is the **single-resolver law (Law 12) applied to the slug**, exactly as `RTL_SCREENPLAY_CONVENTION.md` applied it to geometry and `PRINT_TRUTH_DOCTRINE_V1.md` applied it to the page. One canonical thing; surfaces are projections.

---

## The ruling — Option C, correctly understood

**Answer: Option C. The document owns slug truth. The canonical slug is a structured scene-heading record; Flow and Print are both projections of it. Neither rendered string is canonical.**

Option C is named in the question as a "third doctrine," but it is not novel — it is the platform's *existing* constitution, finally pointed at the slug. The other two options fail because each makes a *rendered string* the master:

- **Option A (Flow owns truth) is rejected.** It elevates an authoring-convenience ordering (`INT. — DAY / LOCATION`) to canonical status and forces Print — the truth lens — to reflect a non-conventional string. Worse, its stated implication is that *the Flow authoring model must change*. It sacrifices the picker (the writer's ergonomic input) to protect a string that was never the truth. It also re-couples the slug to one rendering and one language.

- **Option B (Print owns truth) is rejected.** It introduces a Flow→Print *translation step* — a second representation produced by transforming the first. A transform between two strings is a fork of logic and a lossy seam: it must re-derive which token is setting, which is location, which is time, every time it runs. That is precisely the re-parsing fragility Law 11 exists to forbid. "Print translates Flow" is a second resolver wearing a disguise.

> **The principle in one line:** *The slug is structure, not a sentence. The document owns it; Flow and Print each render it. Order is a projection rule, never the truth.*

This composes cleanly with the two doctrines already in force, and contradicts neither:

- **vs. Print Truth Doctrine V1 ("geometry is owned by Print").** Slug *token order* is not geometry. Geometry — where the heading sits on the page, full-body-width, alignment, pagination — remains owned by Print, untouched. Token *composition order* is a property of the canonical record, shared identically by both surfaces. The two doctrines partition cleanly: **Print owns where the slug lands; the document owns what the slug says and in what order its tokens read.**
- **vs. the RTL convention.** The RTL doctrine already proved this shape: one geometry, two directions, no forked model. The slug record carries *tokens* (`INT.`, `DAY`), and vocabulary localization (داخلي/خارجي, ليل/نهار) is layered at projection time. A structured record is the only representation that survives localization without re-parsing — a stored string `INT. KITCHEN — DAY` cannot be relocalized or remirrored without being torn apart and guessed at.

---

## The six required answers

### 1. Which surface owns slug truth?

**Neither.** The **document** owns slug truth — the canonical record lives in the `.rga` doc model (CORE), not in Flow and not in Print. Both surfaces are *projections* of that record, the same way both are projections of single-resolver page truth (Law 12). Asking whether Flow or Print owns the slug is the same category error as asking whether Flow or Print owns the page.

### 2. What is the canonical slug representation?

A **structured scene-heading record** — ordered, typed fields, not a string and not punctuation:

- **Setting** — a token from the controlled vocabulary (`INT.` / `EXT.` / `INT./EXT.`), language-independent.
- **Location** — the freeform location string, with optional sub-location (e.g. `KITCHEN`, or `APARTMENT — KITCHEN`).
- **Time-of-day** — a token from the controlled vocabulary (`DAY` / `NIGHT` / `CONTINUOUS` / `DAWN` / `DUSK` …), language-independent.
- **Modifiers** — optional, typed (e.g. scene number, `CONTINUOUS`, sub-scene markers).

There are **no separators, no casing, and no order stored in the record** — the em dash, the slash, the uppercase, and the sequence are all *projection rules*, applied per surface and per language at render time. The canonical record holds *which tokens, with which values*; a single resolver composes them into a slug string. This is the slug's equivalent of the single layout resolver: **one composition rule, all surfaces consume it.**

### 3. What should the writer see while writing?

In Flow, the writer should see the slug rendered in **true screenplay convention — `INT. KITCHEN — DAY`** — the *same* ordering Print uses. The current Flow rendering (`INT. — DAY / KITCHEN`) leaks the picker's internal field order onto the page as if it were the heading; that is exactly the "Flow drafts against a presentation that quietly lies" failure named in Print Truth Doctrine V1. Flow must not show one order while Print shows another.

This **does not require the Flow authoring model to change** (which is what made Option A unacceptable): the **picker remains the input**, in whatever field order is ergonomic for data entry. The picker is an *input affordance*; the composed slug on the page is a *projection of the record*. The writer authors through structured fields and sees the truthful convention slug compose live. Authoring ergonomics (Option B's legitimate concern) and at-the-desk truth (Option A's legitimate concern) are both preserved — because neither was ever about the stored data.

### 4. What should the writer see while printing?

The **identical screenplay-convention slug** — `INT. KITCHEN — DAY` (LTR), or its localized mirror for RTL (`...داخلي`, per `RTL_SCREENPLAY_CONVENTION.md`) — now placed and paginated under page-truth geometry. There is **nothing to translate**: Print composes the slug from the same canonical record with the same convention rule Flow uses. The only differences between the surfaces are the ones the existing doctrines already own — **geometry and pagination (Print) and continuity (Flow)** — never token order. Flow → Print should feel like *recognition*, not interpretation: the slug reads the same; only the page around it becomes true.

### 5. What best supports Filmustageation?

The **structured canonical record**, decisively. Filmustageation is the posture of a *living, production-aware* script. Breakdown, scheduling, stripboards, location grouping, INT/EXT tallies, day/night counts, sides — every one of these reads the slug's *components*: location, time, setting. If the slug is a flat string, each downstream tool must re-parse and guess; the script is dead text wearing a costume. If the slug is structured, the AD, scheduling, and breakdown plugins **query fields directly and reliably**. Only Option C turns the slug into queryable production data — which is the difference between a screenplay editor and a living creative workflow.

### 6. What best protects `.rga` as document memory?

The **structured canonical record**, again — and this is the decisive vote. Law 11 demands graceful-degrade portability: a `.rga` must remain readable when its plugin is missing or a version behind. A structured slug record is **unambiguous, language-independent, and reorderable into any convention without loss** — no re-parsing, no guessing which token was the location. A stored *rendered string* (`INT. KITCHEN — DAY`) couples the document's memory to one surface's convention and one language; relocalizing, remirroring for RTL, or re-ordering it later would require lossily tearing the string apart and inferring its parts. **Structure is durable memory; a rendered string is a snapshot that rots.** Option C is the only choice that lets a slug authored today be read, localized, and reformatted correctly by a tool that does not yet exist.

---

## The one-line doctrine

> **A scene heading is a structured record, not a sentence. The `.rga` document owns its truth; Flow and Print are two faithful renderings of the same record in the same convention order. Token order and punctuation are projection rules; the truth underneath them is fields, not a string.**

The visible consequence for the surfaces — stated only as the doctrine's direction, not as a plan — is that **Flow's composed slug moves to screenplay-convention order to match Print**, while the **picker stays as the authoring input**. The two surfaces converge on one slug; the writer authors through structure and reads the truth at both desks.

---

## STOP

Doctrine only. This decides *who owns the slug and what the slug is*. It does not implement, does not touch recognition packages, CSS, or page geometry, and does not redesign the picker, Flow, or Print. Schema-v3 (LOCKED), single-resolver page truth (Law 12), `.rga` portability (Law 11), the RTL convention, and the Print Truth Doctrine are immovable and are the ground this stands on. The next decision — authorize the convergence direction this doctrine names, or amend it — belongs to the user.
