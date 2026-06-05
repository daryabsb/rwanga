# Print Contract V1 — Architecture & Doctrine

> **A doctrine + architecture decision, implemented.** Establishes the permanent
> ownership of print truth in the `.rga`. Not a Print Preview redesign.
> Date: 2026-06-05 · Grounded in: `PRINT_TRUTH_DOCTRINE_V1.md` (the *relationship*
> question) — this doc answers the *ownership* question underneath it.

---

## 1. The problem (doctrine, not rendering)

A screenplay is a print-oriented production document. Its print truth — paper,
orientation, reading direction, numbering — must **travel with the document**,
not be reconstructed by whatever surface happens to render it.

The investigation found the codebase already *mostly* does this: print values
live in the `.rga`, and a single resolver (`Rga.ManuscriptGeometry.resolve(doc)`
→ `Rga.LayoutProfile.compose`) is consumed by **both** Print Preview and PDF
Export. What was missing was not storage — it was **ownership as a contract**:

- The owned values were **scattered and unnamed** across `settings.pageSetup.*`,
  `metadata.screenplayProfile.direction`, and `settings.show_scene_numbers`.
- There was **no contract version**.
- There was **no guarantee of presence** — a brand-new document never wrote an
  explicit `screenplayProfile`, so its direction was implicit; numbering/
  orientation defaults were only resolved, never stored.
- There was **no single named API** a future consumer (the web Platform) could
  call to get "the print truth of this `.rga`" without re-deriving it.

## 2. The ownership chain

```
App Defaults  →  User Profile Defaults  →  Document Template  →  .rga Print Contract  →  Renderers
```

| Tier | Status today | Print Contract V1 |
|---|---|---|
| **App Defaults** | `HOLLYWOOD_DEFAULTS` (geometry) | + `PrintContract.DEFAULTS` (the owned set) |
| **User Profile Defaults** | absent by Settings doctrine (print is per-script, never shadowed by user prefs) | unchanged — the resolver leaves the seam; no behavior added |
| **Document Template** | no template system exists | unchanged — out of scope; seeding plays the template role for now |
| **.rga Print Contract** | scattered, unnamed, unversioned, not guaranteed | **`resolvePrintContract(doc)` — named, versioned, guaranteed-present** |
| **Renderers** | consume `ManuscriptGeometry.resolve` | consume the contract through that same single seam + the export payload |

Renderers (Print Preview, PDF Export, future Django Platform, future production
tooling) are **consumers only**. They never invent print values.

## 3. The key architectural decision — projection, not parallel storage

We deliberately **did not** introduce a new top-level `print_contract` storage
block holding copies of paper/orientation/direction/numbering.

Doing so would **split-brain** against the Settings Store, which constitutionally
owns `pageSetup.*` (`persistsTo:'script'` → `doc.settings.pageSetup`). The
Settings Constitution names the registry as the single source of truth; a parallel
copy would drift the moment Page Setup wrote one home and not the other.

Instead, **the Print Contract is a named, versioned resolver projection** over the
document's existing owned homes:

- **Storage stays where it already lives.** The Settings Store write-path is
  untouched (no constitution violation, no warehouse rebuild).
- **One genuinely-new stored field:** `metadata.printContractVersion` (the
  "print profile version"). It versions the *contract schema*, independent of the
  `.rga` file format version (`rga_version`).
- **The contract is the resolver + the guarantee** (seeding + migration) **+ the
  version + the API** — not a competing data copy.

This is "minimal but real": it establishes ownership without building a settings
warehouse.

## 4. The contract (intentionally small)

`Rga.PrintContract.resolve(doc)` returns a frozen, normalized object:

```js
{
  version: 1,                                  // metadata.printContractVersion
  paperSize: 'Letter',                         // 'Letter' | 'A4' | 'Legal' (name)
  orientation: 'portrait',                     // 'portrait' | 'landscape'
  direction: 'ltr',                            // 'ltr' | 'rtl'
  pageNumbering: { enabled: true, position: 'top_right' },
  sceneNumbering: { enabled: true }
}
```

Only values that **materially affect rendering** and that are **document-level
decisions** (not typographic derivation). Margins, font, block-column widths, and
leading remain owned by the geometry layer (`LayoutProfile`/`HOLLYWOOD_DEFAULTS`) —
they are *derivation*, not *contract*, and already persist via `pageSetup`.

Resolution precedence per field: **document owned home → `PrintContract.DEFAULTS`
(App Defaults)**. Reads are defensive: a `null` doc, a missing `screenplayProfile`,
or a missing `pageSetup` all resolve to the App Defaults without throwing.

| Contract field | Owned home in the `.rga` |
|---|---|
| `version` | `metadata.printContractVersion` |
| `paperSize` | `settings.pageSetup.paperSize` (legacy `size` alias honored) |
| `orientation` | `settings.pageSetup.orientation` |
| `direction` | `metadata.screenplayProfile.direction` |
| `pageNumbering.enabled` / `.position` | `settings.pageSetup.pageNumbers` / `.pageNumberPosition` |
| `sceneNumbering.enabled` | `settings.show_scene_numbers` |

> `sceneNumbering` is owned but **not yet wired to rendering** (the normalizer
> emits scene numbers; the print renderer does not paint them today). The contract
> canonicalizes the value for the future Platform and future wiring — it does not
> invent new rendering, per the non-goals.

## 5. Guaranteed presence

A document must *carry* its contract, not merely have it resolved on the fly.

- **New documents (seeding).** `Doc.create` now seeds `metadata.screenplayProfile`
  (direction derived from language, consistent with the v2→v3 migration),
  `metadata.printContractVersion`, and completes `settings.pageSetup`
  (`orientation` / `pageNumbers` / `pageNumberPosition`). A screenplay created
  today stores its full, explicit print contract.
- **Old documents (migration).** `rga_version` bumps **4.0 → 5.0**. The
  `v4-to-v5` step (pure JSON, idempotent, preserves unknown fields) stamps
  `printContractVersion`, ensures `screenplayProfile` exists (direction derived
  from `metadata.language`), and ensures the `pageSetup` numbering/orientation
  fields + `show_scene_numbers` are present. Old docs thus gain an explicit,
  versioned contract on load.
- **Belt-and-suspenders.** The deserialize escape-hatch path (`opts.schema`,
  which bypasses migration — used by tests and future doc-types) backfills the
  same fields, so every load path produces a complete contract.

## 6. How renderers consume it (single seam)

Every doc-path renderer already flows through `Rga.ManuscriptGeometry.resolve(doc)`
— Print Preview, PDF Export, the Page Setup live preview, and the Flow paper view.
So the contract is wired in at exactly that one seam:

- `ManuscriptGeometry.resolve(doc)` resolves the contract and passes it as an
  optional third argument to `LayoutProfile.compose`.
- `compose(screenplayProfile, settings, contract?)` sources the **owned enums**
  (`orientation`, `direction`, `pageNumbering`) from the contract when present,
  and **attaches the resolved contract on the output** as `profile.printContract`.
  Geometry math (margins, font, paper dims, lines-per-page, block widths) is
  **unchanged**. When no contract is passed (`resolveFrom`, the default constant,
  direct test calls), behavior is **byte-identical** to before — the identity rule
  `resolveFrom(p,s) === compose(p,s)` is preserved.
- Because the contract reads the same owned homes the geometry layer already read,
  the resolved values are identical → **Print Preview and PDF output are
  byte-identical** to pre-contract behavior. This is an ownership change, not a
  pixel change.
- **PDF Export** additionally attaches the resolved contract to its export payload
  (`{ geometry, printContract }`), so the exported artifact carries the canonical
  contract for the main process and the future Platform.

## 7. Future Platform (architecture only, not built)

The web Platform will later read the same `.rga` and call the same
`resolvePrintContract(document)` (or its server-side port) to obtain **identical
print truth without inventing new settings**. Because the contract is a pure
projection over stored fields + documented defaults, a server-side resolver in
Django reproduces it from the same JSON. No Platform code is added here — the
architecture simply supports it.

## 8. Success criteria (and how they're met)

1. A screenplay created today **stores** its print contract inside the `.rga`. →
   seeding (§5).
2. It **saves** with the document. → existing `serialize` writes `metadata` +
   `settings` verbatim (no allow-list drops it).
3. It **reopens** with the same contract. → round-trip + migration (§5).
4. It produces **identical Print Preview**. → byte-identical geometry (§6).
5. It produces **identical PDF output**. → same single render path (§6).
6. It can later be consumed by the web Platform **without inventing new print
   settings**. → the resolver is the API; the contract is a projection over stored
   truth (§7).

## 9. Non-goals (held)

No Print Preview redesign, no Flow change, no Inspector / Timeline / Character
Profile / Semantic Entity S2 contact, no Settings Store rewiring, no new chrome.
Scene-number *rendering* is not added. RTL leading / vocabulary remain their own
campaigns.
