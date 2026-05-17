# Rwanga — Activity Rail Visual Doctrine

Status: **LOCKED 2026-05-17**  
Authority: shell maintainer / user-stated visual direction  
Scope: the left-side activity rail (`#activity-bar` / `.rga-shell-rail-item`)  
Successor docs: any future implementation slice that touches the rail must
reference this doctrine and satisfy all five rules. Any deviation requires
an explicit doctrine amendment in a new doc; silent drift is rejected.

---

## 1. Purpose

The current rail uses mixed icon styles (full-colour emoji, monochrome
emoji, OS-default glyphs) and reads as **prototype / placeholder**. This
doctrine locks the visual rules so that the next implementation pass
produces a rail that reads as a finished product surface, not a
work-in-progress.

This document is **doctrine only — no implementation is scheduled
yet**. It is the binding spec the implementation slice will be
measured against when it is opened.

---

## 2. Locked rules

### Rule 1 — Single icon system only

**Prohibited:**
- Emoji glyphs of any kind (full-colour or monochrome).
- Mixed icon packs (no Feather + Lucide + custom SVG together).
- OS-default icons mixed with app-owned icons.

**Required:** one coherent icon family for all rail items. The
*choice* of family is an open decision (see §6) — but once chosen,
**every** rail icon is sourced from it and no other rail icon may use
a different family.

### Rule 2 — Icon style

Every rail icon must satisfy **all** of:

- **Monochrome.** No gradients, no multi-colour fills. A single
  current-colour `<svg>` driven by a CSS `color` token.
- **Calm.** No animation. No bright accent fills. The rail is not
  trying to attract attention to itself; it is trying to disappear
  into the chrome.
- **Same stroke weight.** Every icon uses the same stroke-width
  (e.g. 1.5px or 2px — picked once, applied everywhere).
- **Same visual size.** Every icon renders at the same effective
  optical size on the rail (e.g. 18×18 viewBox at 18×18 rendered),
  irrespective of glyph density.
- **Screenplay-first aesthetic.** Icons should evoke creative writing
  / paper / draft / outline / production — not VS Code's developer
  pictograms, not file-manager dropbox-style flat icons, not
  Discord/Slack chat icons.

### Rule 3 — Rail spacing (three-group layout)

The rail is **not** evenly distributed top-to-bottom. Icons cluster
into three explicit groups separated by visual space:

```
┌──────────────┐
│ Top group    │   Scene Navigator
│              │   Script Workspace
│              │   Outline
│              │   Search
│              │
│ (gap)        │   ← deliberate vertical space
│              │
│ Middle group │   Characters
│              │   Revisions
│              │
│ (gap)        │   ← deliberate vertical space
│              │
│ Bottom group │   Settings
└──────────────┘
```

- **Top group** = navigation surfaces a writer reaches for during
  active writing (where am I? what files? what's the structure? where
  is X?).
- **Middle group** = production / craft surfaces a writer reaches for
  during script review / refinement (who's in this? what changed?).
- **Bottom group** = configuration. Anchored to the bottom of the
  rail via flex push, not via even distribution.

Implementations **must not** use `justify-content: space-around` or
`space-between` across the full rail height. The grouping is part of
the doctrine; collapsing it into uniform spacing fails the doctrine.

### Rule 4 — Active state design (four-state model)

The current single-state treatment ("tiny black line on the left") is
**rejected**. The rail icon must carry **four** distinct visual states,
and every implementation must declare all four:

| State | Trigger | Visual treatment |
|---|---|---|
| **Idle** | Default | Muted icon colour; no background; no left-rule. Disappears into the rail. |
| **Hover** | Mouse-over | Slightly brighter icon colour + a *subtle* background pill (low-opacity surface tint). Pill is rounded, inset from the rail edges. No left-rule. |
| **Selected** | Panel is the currently-active sidebar panel | Icon colour at full primary text colour + the subtle background pill (more visible than hover) + a **left accent bar** (2–3px, calm accent — *not* the bright `--accent-primary`). |
| **Current** *(reserved)* | A panel needs to signal "you are here" beyond simple selection (e.g. Scene Navigator marking the active script's editor cursor scene). For Rule 4's purposes, "current" is a strict superset of "selected" — when both apply, render selected's left bar but with a slightly stronger colour. |

Pattern in short: **background pill (intensity scales with state) +
left accent bar (only on selected) + icon colour (idle → hover →
selected progression)**.

The pill is the carrier of the hover/selected progression because a
floating background reads as a tactile surface — closer to a paper /
creative-tool feel than a bare colour swap.

### Rule 5 — Visual feeling target

**Not:**
- Discord (rounded coloured tiles, animated transitions, bright accent
  fills).
- AI playground / chatbot UI (neon accents, gradient pills, "magic"
  glow).
- Random Electron app (default-looking flat icons, no curation).

**Closer to:**
- **VS Code discipline** — restrained palette, monochrome icons, two
  states (idle/active), zero ornamentation. *But* without VS Code's
  developer-toolbar feel.
- **Creative-tool calmness** — Procreate, Figma, Linear-at-rest: the
  chrome stays out of the way. The product is the document, not the
  shell.
- **Paper / writer atmosphere** — the rail should feel like the edge
  of a notebook, not the edge of a code editor.

The three reference points combine: **VS Code's restraint, creative-
tool calm, screenplay paper warmth.** Any treatment that pulls toward
Discord / AI playground / Electron-default is rejected.

---

## 3. What this doctrine LOCKS

- Icon family unity (Rule 1)
- Icon visual properties (Rule 2)
- Rail item order **and** the three-group layout (Rule 3)
- Four-state interaction model (Rule 4)
- Visual feeling target (Rule 5)

These are non-negotiable for any rail-touching implementation. A future
slice that proposes to violate one of these requires a doctrine
amendment in writing before implementation begins.

---

## 4. What this doctrine does NOT specify

Deferred to the implementation slice:

- **Which icon family** (see §6 OD-A).
- **Exact pixel sizes** for icon viewBox, rail width, pill radius,
  pill inset, left-accent bar width, group gaps.
- **Exact colour tokens** for the four states (idle / hover / selected /
  current). The implementation slice picks tokens that satisfy Rule 5;
  if no existing token works, a new `--rail-*` scoped token may be
  added.
- **Animation timing** (or absence of animation — Rule 2 says calm; if
  any transition is added, it must be ≤120ms and never overshoot /
  bounce).
- **Keyboard focus state.** Inherits from existing
  `Cmd-Shift-{S,E,O,C,F,R}` and `Cmd-,` shortcuts; visual treatment for
  keyboard focus is the implementation slice's call (must not violate
  Rule 5).
- **Tooltip / label rendering** when the user hovers (current
  implementation has no tooltip; doctrine doesn't require one but
  doesn't forbid it).
- **Reduced-motion handling** — must respect
  `prefers-reduced-motion: reduce` if any transition is added.

---

## 5. Acceptance criteria for any future rail-touching slice

An implementation passes doctrine review when **all** of the following
are true:

1. **Rule 1:** A grep for emoji glyphs (U+1F300–U+1FAFF, U+2600–U+26FF,
   and the Segoe/Apple emoji ranges) in any rail-rendering path returns
   nothing. All rail icons resolve to one named icon family.
2. **Rule 2:** Every rail icon shares the same SVG viewBox dimensions
   and the same stroke-width. No `fill` other than `currentColor`.
3. **Rule 3:** The rail DOM has three sibling groups in the documented
   order. The bottom group is anchored to the bottom of the rail (flex
   push or grid auto-row at end), not floated by even-distribution.
4. **Rule 4:** CSS / JS exposes four distinct states for every rail
   item. A regression test asserts hover, selected, and current
   states each declare a different background-or-border-or-colour
   treatment from idle.
5. **Rule 5:** A maintainer review can point at the result and say
   "VS Code discipline + creative-tool calm + paper warmth" without
   pulling in Discord / AI-playground / Electron-default references.
   (Subjective, but the three forbidden references are concrete enough
   to fail a result that drifts.)

---

## 6. Open decisions (deferred to implementation)

### OD-A — Which icon family?

Candidates (none chosen):

- **Lucide** — open-source, monochrome, screenplay-adjacent glyphs
  available (FileText, Layers, Users, Search, Settings, GitBranch).
- **Phosphor** — open-source, multiple weights; pick one weight and
  freeze it.
- **Custom SVG set** — commission a small set sized to Rwanga's seven
  rail items (and future additions). Higher cost, full control over
  screenplay-first aesthetic.
- **Heroicons** — Tailwind ecosystem, monochrome, simple. Less
  screenplay-feel than Lucide.

The choice is binding once made — Rule 1 forbids mixing.

### OD-B — Icon vendoring

Whichever family wins, icons must be **vendored locally** under
`renderer/static/vendor/icons/` per the existing project memory rule
("Local assets only — no CDN"). No SVG sprite fetched from the network.

### OD-C — Glyph mapping

A 1:1 mapping from rail item → icon name must be authored once and
recorded in the implementation slice plan:

| Item | Group | Glyph (TBD) |
|---|---|---|
| Scene Navigator | Top | (TBD — e.g. `list`, `panel-left`, `clapperboard`) |
| Script Workspace | Top | (TBD — e.g. `folder-open`, `files`) |
| Outline | Top | (TBD — e.g. `align-left`, `network`) |
| Search | Top | (TBD — `search`) |
| Characters | Middle | (TBD — e.g. `users`, `user-square`) |
| Revisions | Middle | (TBD — e.g. `history`, `git-branch`) |
| Settings | Bottom | (TBD — `settings` / `gear`) |

The glyph TBD column gets filled when OD-A is decided.

---

## 7. Cross-references

- **Visual debt report** (`docs/rwanga-shell-visual-debt-after-slice2.md`)
  item #4 originally classified rail emoji as P2 polish. With this
  doctrine, the rail's overall treatment is now governed here; the
  debt report's #4 row is upgraded to "**governed by doctrine — see
  rwanga-activity-rail-doctrine.md**".
- **V1 plan** (`docs/rwanga-visual-stabilization-v1-plan.md`) §10
  explicitly listed the activity rail emoji as out-of-scope for V1.
  V1 did not violate this doctrine because V1 made no rail changes.
- **V1.1 open decisions** (`docs/rwanga-visual-stabilization-v1-1-open-decisions.md`)
  OD-1 (menu strategy) is independent of this doctrine.

---

## 8. Status & next steps

| Item | Status |
|---|---|
| Doctrine drafted | ✅ 2026-05-17 |
| User sign-off | pending |
| OD-A icon family chosen | pending |
| Implementation slice planned | not yet — do not open until OD-A is settled |
| Implementation slice implemented | blocked on the above |

When OD-A is decided, the implementation slice can be planned. The
slice's plan must reference this doctrine and demonstrate adherence
to all five rules before sign-off.

End of doctrine.
