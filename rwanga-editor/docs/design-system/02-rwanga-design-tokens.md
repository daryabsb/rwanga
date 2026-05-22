# Rwanga — Design Tokens

Status: **FORENSIC EXTRACTION** — 2026-05-17
Source: `renderer/css/tokens.css` (9208 bytes) + scattered inline values

Every token below is tagged:
- **EXISTING** — present in tokens.css, actively consumed
- **PROMOTED** — was informal/scattered, now formalized as doctrine
- **NEW** — introduced during V1/V1.1/v3, not in original design kit
- **DEPRECATED** — present in design kit, removed from production

---

## 1. Layout Dimensions

| Token | Dark | Light | Status |
|---|---|---|---|
| `--menu-bar-height` | `32px` | — | **DEPRECATED** — #menu-bar deleted in V1 T1. Token still in CSS but no consumer. |
| `--status-bar-height` | `24px` | — | EXISTING |
| `--activity-bar-width` | `48px` | — | EXISTING |
| `--sidebar-width` | `260px` | — | EXISTING |
| `--inspector-width` | `280px` | — | EXISTING |
| `--bottom-panel-height` | `200px` | — | EXISTING |
| `--tab-bar-height` | `36px` | — | EXISTING |
| `--toolbar-height` | `40px` | — | **NEW** — format toolbar, not in design kit |
| `--gutter-width` | `52px` | — | EXISTING (legacy editor.css gutter; not consumed by ProseMirror page surface) |

### Contradictions
- `--menu-bar-height` is **dead**. The `#app` grid now uses `auto` for the titlebar row, not this token. Should be removed.
- `--gutter-width` is consumed only by the legacy `#gutter` element in `editor.css`. ProseMirror pages don't use it. The flow-line-gutter uses hardcoded `width: 44px`.

---

## 2. Background Layers

| Token | Dark | Light | Status |
|---|---|---|---|
| `--bg-base` | `#181818` | `#f0f0f0` | EXISTING |
| `--bg-primary` | `#1e1e1e` | `#ffffff` | EXISTING |
| `--bg-secondary` | `#252526` | `#f3f3f3` | EXISTING |
| `--bg-tertiary` | `#2d2d30` | `#e8e8e8` | EXISTING |
| `--bg-quaternary` | `#333337` | `#dcdcdc` | EXISTING |
| `--bg-hover` | `#2a2d2e` | `#e8e8e8` | EXISTING |
| `--bg-active` | `#37373d` | `#d4d4d4` | EXISTING |
| `--bg-selected` | `#04395e` | `#c8ddf1` | EXISTING |

### Editor Surface (separate from chrome)

| Token | Dark | Light | Status |
|---|---|---|---|
| `--editor-bg` | `#141414` | `#d6d6d6` | **MODIFIED** — was `#1e1e1e`/`#ffffff` in design kit. Now darker/greyer to create desk-vs-page contrast. |
| `--editor-page-bg` | `#262626` | `#ffffff` | **MODIFIED** — was `#1a1a1a`/`#fafafa`. Now the visible "paper" surface. |
| `--editor-page-shadow` | `0 8px 28px rgba(0,0,0,0.6)` | `0 6px 20px rgba(0,0,0,0.18)` | **NEW** — paper shadow. Not in design kit. |
| `--editor-line-highlight` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)` | EXISTING |

### Removed
| Token | Status |
|---|---|
| `--scene-header-bg` | **DEPRECATED** — comment says "removed in Phase 0 — scene widget deleted" |
| `--scene-header-border` | **DEPRECATED** — same |

---

## 3. Text Hierarchy

| Token | Dark | Light | Status |
|---|---|---|---|
| `--text-primary` | `#cccccc` | `#333333` | EXISTING |
| `--text-secondary` | `#9e9e9e` | `#616161` | EXISTING |
| `--text-tertiary` | `#6e6e6e` | `#999999` | EXISTING |
| `--text-disabled` | `#4e4e4e` | `#bdbdbd` | EXISTING |
| `--text-inverse` | `#1e1e1e` | `#ffffff` | EXISTING |
| `--text-link` | `#4FC1FF` | `#0066bf` | EXISTING |

### Contradiction
- `--text-muted` is referenced in `.rga-shell-titlebar` CSS as `var(--text-muted, #9a9a9a)` but **never defined in tokens.css**. It falls back to hardcoded `#9a9a9a`. Should be either aliased to `--text-secondary` or formally defined.

---

## 4. Border Tokens

| Token | Dark | Light | Status |
|---|---|---|---|
| `--border-primary` | `#3c3c3c` | `#d4d4d4` | EXISTING |
| `--border-secondary` | `#2b2b2b` | `#e8e8e8` | EXISTING |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | **NEW** — V1 Visual Stabilization |
| `--border-focus` | `#007acc` | `#0066bf` | EXISTING |

---

## 5. Chrome Surface Tokens

These are **NEW** — introduced in V1 Visual Stabilization (T2). They enforce the principle that action-accent tokens (`--accent-primary`) are never used as surface fills.

| Token | Dark | Light | Status |
|---|---|---|---|
| `--statusbar-bg` | `#2d2d30` | `#e8e8e8` | **NEW — PROMOTED** to doctrine |
| `--statusbar-fg` | `#9e9e9e` | `#616161` | **NEW** |
| `--statusbar-fg-hover` | `#cccccc` | `#333333` | **NEW** |
| `--statusbar-segment-hover-bg` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | **NEW** |
| `--tab-active-indicator` | `#cccccc` | `#333333` | **NEW** — breaks bottom-panel/status-bar twinning |

---

## 6. Accent Colors

| Token | Dark | Light | Status |
|---|---|---|---|
| `--accent-primary` | `#007acc` | `#0066bf` | EXISTING — interaction only, never surface fill |
| `--accent-primary-hover` | `#1a8ad4` | `#005bb0` | EXISTING |
| `--accent-gold` | `#FFC107` | — | EXISTING — screenplay accent |
| `--accent-success` | `#4EC9B0` | — | EXISTING |
| `--accent-warning` | `#FFB347` | — | EXISTING |
| `--accent-error` | `#F44747` | — | EXISTING |
| `--accent-info` | `#4FC1FF` | — | EXISTING |
| `--accent-rwanga` | `#C2185B` | `#AD1457` | **NEW** — brand identifier. Scene heading underlines. |

---

## 7. Tag Colors (10 types)

All EXISTING. Dark and light values defined. Background variants at 18% (dark) / 12% (light) opacity.

| Tag Type | Dark | Light |
|---|---|---|
| `--tag-character` | `#4FC1FF` | `#0070C0` |
| `--tag-prop` | `#FFB347` | `#D48000` |
| `--tag-wardrobe` | `#C586C0` | `#9B30FF` |
| `--tag-location` | `#4EC9B0` | `#008060` |
| `--tag-sfx` | `#F44747` | `#CC0000` |
| `--tag-vfx` | `#FF79C6` | `#D63384` |
| `--tag-vehicle` | `#56B6C2` | `#0D6EFD` |
| `--tag-animal` | `#D19A66` | `#8B5E3C` |
| `--tag-makeup` | `#E06C9F` | `#C71585` |
| `--tag-music` | `#7C6EF6` | `#5B21B6` |

### Contradiction — editor-prosemirror.css overrides
The ProseMirror mark styles in `editor-prosemirror.css` define **different** fallback values for some tag types:
- `.rga-tag-vfx` uses `#C586C0` (wardrobe colour!) not `#FF79C6`
- `.rga-tag-vehicle` uses `#DCDCAA` not `#56B6C2`
- `.rga-tag-animal` uses `#B5CEA8` not `#D19A66`

These inline fallbacks diverge from `tokens.css`. The `var()` will resolve correctly at runtime, but the fallback chain is misleading.

---

## 8. Typography Scale

| Token | Value | Status |
|---|---|---|
| `--font-size-xs` | `10px` | EXISTING |
| `--font-size-sm` | `11px` | EXISTING |
| `--font-size-base` | `13px` | EXISTING |
| `--font-size-md` | `14px` | EXISTING |
| `--font-size-lg` | `16px` | EXISTING |
| `--font-size-xl` | `20px` | EXISTING |

### Missing
- **No line-height tokens.** Line heights are hardcoded per-component (`1.4` in reset, `1.5` in ProseMirror, `1.3` in scene blocks, `2` in legacy gutter, `1.0` in print sheets).
- **No font-weight tokens.** Weights are literal (`400`, `500`, `600`, `700`) throughout.
- **No `--editor-font-size` in tokens.css.** It's consumed as `var(--editor-font-size, 12pt)` in ProseMirror CSS but never declared. Relies on fallback.

---

## 9. Shadows

| Token | Dark | Light | Status |
|---|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.4)` | `0 1px 3px rgba(0,0,0,0.1)` | EXISTING |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.5)` | `0 4px 12px rgba(0,0,0,0.12)` | EXISTING |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.6)` | `0 8px 24px rgba(0,0,0,0.15)` | EXISTING |
| `--shadow-overlay` | `0 12px 40px rgba(0,0,0,0.7)` | `0 12px 40px rgba(0,0,0,0.2)` | EXISTING |

---

## 10. Border Radius

| Token | Value | Status |
|---|---|---|
| `--radius-sm` | `2px` | EXISTING |
| `--radius-md` | `4px` | EXISTING |
| `--radius-lg` | `6px` | EXISTING |

---

## 11. Transitions

| Token | Value | Status |
|---|---|---|
| `--transition-fast` | `0.1s ease` | EXISTING |
| `--transition-normal` | `0.2s ease` | EXISTING |
| `--transition-slow` | `0.3s ease` | EXISTING |

### Doctrine constraint
Activity Rail Doctrine Rule 5 caps rail transitions at 120ms. Rail CSS uses literal `120ms ease` — does NOT consume `--transition-fast` (which is `100ms`). This is intentional per doctrine.

---

## 12. Screenplay-Specific Variables

Defined in `editor-prosemirror.css` `:root` block (NOT in `tokens.css`):

| Variable | Value | Status |
|---|---|---|
| `--dialogue-side-margin` | `1in` | **NEW** — screenplay layout |
| `--parenthetical-side-margin` | `1.6in` | **NEW** — screenplay layout |

### Should be PROMOTED
These belong in `tokens.css` alongside the other layout dimensions. Currently orphaned in a `:root` block inside `editor-prosemirror.css`.

---

## 13. Undefined but Referenced Tokens

Tokens consumed via `var()` with fallbacks but **never formally declared**:

| Reference | Fallback | Where | Action |
|---|---|---|---|
| `--text-muted` | `#9a9a9a` | shell.css (titlebar) | Define or alias to `--text-secondary` |
| `--editor-font-size` | `12pt` | editor-prosemirror.css | Define in tokens.css |
| `--font-sans` | `system-ui, sans-serif` | shell.css (titlebar) | Define or alias to `--font-ui` |
| `--font-mono` | `ui-monospace, Menlo, Consolas, monospace` | editor-prosemirror.css | Define in tokens.css |
| `--accent-secondary` | (none) | ProseMirror blockquote | Dead reference — no consumer builds blockquotes |
| `--accent-hover` | (none) | empty-state buttons | Dead reference — only in one `.empty-state-btn--primary:hover` |
| `--tag-custom` | `#888` | editor-prosemirror.css | Define in tokens.css for both themes |

End of token audit.
