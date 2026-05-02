# Design Audit Report — 2026-05-02

---

## Verification Pass — 2026-05-02 (Round 2)

**Verified by:** Claude Design Agent  
**Repo ref at time of check:** `4bb4e8363bd0`  
**Files inspected:** `src/reviews/templates/reviews/` (all), `src/community/templates/community/` (all), `templates/components/_sidebar.html`, `templates/components/_topnav.html`, `templates/components/_empty_state.html`, `static/css/rwanga.css`, `src/core/context_processors.py`, `src/projects/templates/projects/list.html`

---

### ✅ Fixed Issues (confirmed resolved)

| Original Issue | File | Status |
|---------------|------|--------|
| `reviews/index.html` title in English | `src/reviews/templates/reviews/list.html` line 14 | ✅ Now `{% trans "پێداچوونەوەکان" %}` |
| Header button uses POST form | `list.html` lines 35–38 | ✅ Now `hx-get` + `hx-target="#rw-modal-container"` |
| Missing page header block (purple icon tile, h1, subtitle) | `list.html` lines 22–31 | ✅ Implemented correctly |
| Missing status filter strip | `list.html` lines 44–52 | ✅ `rw-filter-row` with 4 Kurdish filter buttons present |
| Wrong badge classes (`rw-badge-a/g/d`) in reviews list | `list.html` lines 65–78 | ✅ Replaced with correct inline badge styles per design |
| Missing decision stats row | `list.html` lines 84–100 | ✅ Present: decisions.count, locked_decisions_count, rejected_decisions_count, evaluations.count |
| Missing author avatar + date right column | `list.html` lines 103–113 | ✅ `rw-avatar` + author name + timesince implemented |
| Missing status accent border | `list.html` line 60 | ✅ `border-inline-start:4px solid transparent` + `rv-row-{{ review.status }}` class present |
| Missing version badge chip | `list.html` line 82 | ✅ Styled mono chip |
| Missing `#rw-modal-container` | `list.html` line 133 | ✅ Present |
| `reviews/detail.html` title in English | `detail.html` line 19 | ✅ Now `{{ review.title }} — {% trans "پێداچوونەوە" %}` |
| No topbar / review header | `detail.html` lines 23–85 | ✅ Full 72px topbar with back button, title, version chip, status badge, "گۆڕینی بار" dropdown |
| No stats strip | `detail.html` lines 88–104 | ✅ `rw-stats` with 5 stats implemented |
| No tab navigation | `detail.html` lines 107–127 | ✅ 4-tab `rw-mod-tabs` with HTMX loading |
| Inline create forms in detail | `detail.html` | ✅ Gone — no inline forms |
| English "Approve"/"Reject" action labels | `_decision_card.html` | ✅ Replaced with Kurdish (see garbled text issue below) |
| Decision action URL `'approve'` | `_decision_card.html` lines 33, 39 | ✅ Changed to `reviews:lock_decision` and `reviews:reject_decision` (separate URLs) |
| `_decision_card.html` not implemented | `src/reviews/templates/reviews/_decision_card.html` | ✅ File exists, correct structure with HTMX swap |
| `_evaluation_card.html` not implemented | `src/reviews/templates/reviews/_evaluation_card.html` | ✅ Implemented: scene header, tension score bar, analysis, recommendations — matches design exactly |
| `_create_modal.html` not implemented | `src/reviews/templates/reviews/_create_modal.html` | ✅ Implemented correctly: modal pattern, HTMX, project selector, auto-title JS, bible textarea |
| `community/list.html` not implemented | `src/community/templates/community/list.html` | ✅ Correct: teal header tile, filter strip, grid layout, status badges, stats footer |
| Community inline form exposed | `community/list.html` | ✅ Uses `hx-get` button → modal pattern |
| Community wrong badge classes | `community/list.html` lines 59, 62 | ✅ Correct inline badge styles |
| Community no grid layout | `community/list.html` line 52 | ✅ `display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))` |
| `community/detail.html` no topbar | `detail.html` lines 23–52 | ✅ 64px topbar with back link, title, status badge, manage dropdown |
| Two-column layout missing | `detail.html` lines 56–95 | ✅ Flex two-column: left content + right 380px comment panel |
| Admin forms exposed to all | `detail.html` line 44 | ✅ Gated with `{% if can_manage %}` |
| Community English labels | `detail.html`, `_comment_thread.html` | ✅ All Kurdish, `{% trans %}` used throughout |
| `_comment_thread.html` not implemented | `src/community/templates/community/_comment_thread.html` | ✅ Full implementation: avatars, threaded replies, reply forms, reactions, compose box, empty state |
| Reviews + Community tiles missing from `projects/list.html` | `src/projects/templates/projects/list.html` lines 93–147 | ✅ Both tiles present with correct purple/teal colours and count display |
| Sidebar reviews/community icons missing | `templates/components/_sidebar.html` lines 46–63 | ✅ Both `📋` and `💬` icons with badge counts and `nav_mode` active states |
| Topnav secondary nav mode missing | `templates/components/_topnav.html` lines 29–50 | ✅ `{% if nav_mode == 'reviews' or nav_mode == 'community' %}` branch implemented |
| Topnav section tabs used `window.location.href` | `_topnav.html` lines 56–88 | ✅ Now use `hx-get` + `hx-target="#rw-content"` + `hx-push-url="true"` |
| No `nav_mode` context | `src/core/context_processors.py` | ✅ `navigation_context()` provides `nav_mode`, `pending_decisions_count`, `active_sessions_count` |

---

### 🔴 Still Open — Critical (must fix before next release)

---

#### OPEN-1: `_decision_card.html` — Kurdish text garbled as `???????` throughout
**File:** `src/reviews/templates/reviews/_decision_card.html`  
**Lines:** 15, 17, 19, 26, 35, 36, 41, 42, 61

The entire file has Kurdish strings corrupted to `?` sequences — a UTF-8 encoding failure when the agent wrote the file. Every user-visible string is broken:

| Line | Current (broken) | Expected |
|------|-----------------|----------|
| 15 | `{% trans "???????" %}` | `{% trans "پێشنیاز" %}` |
| 17 | `{% trans "?????????" %}` | `{% trans "جێگیرکراو" %}` |
| 19 | `{% trans "????????" %}` | `{% trans "ڕەتکراوە" %}` |
| 26 | `{% trans "???????????? ???????" %}` | `{% trans "پێشنیازکراوە لەلایەن" %}` |
| 35 textarea | `placeholder="{% trans '?????? (??????????????)...' %}"` | `placeholder="{% trans 'تێبینی (ئارەزووی)...' %}"` |
| 36 button | `? {% trans "??????????" %}` | `✓ {% trans "جێگیرکردن" %}` |
| 41 textarea | `placeholder="{% trans '?????? ?????????? (???????)...' %}"` | `placeholder="{% trans 'هۆکاری ڕەتکردنەوە (پێویستە)...' %}"` |
| 42 button | `? {% trans "??????????" %}` | `✕ {% trans "ڕەتکردنەوە" %}` |
| 61 button | `? {% trans "??????? ???????????" %}` | `↺ {% trans "دووبارە پێشنیازکردن" %}` |

**Fix:** Re-save the file with UTF-8 encoding. Replace all `?` sequences with the correct Kurdish strings above. The structure and CSS of the card is otherwise correct.

---

#### OPEN-2: `_topnav.html` — Dropdown menu items garbled as `???????`
**File:** `templates/components/_topnav.html`  
**Lines:** 124, 125, 127, 131

| Line | Current (broken) | Expected |
|------|-----------------|----------|
| 124 | `{% trans "???????" %}` (Profile link) | `{% trans "پرۆفایل" %}` |
| 125 | `{% trans "???????" %}` (Settings link) | `{% trans "ڕێکخستن" %}` |
| 127 | `{% trans "???????" %}` (Logout link) | `{% trans "دەرچوون" %}` |
| 131 | `{% trans "????????????" %}` (Login link) | `{% trans "چوونەژوورەوە" %}` |

**Fix:** Re-save the file with UTF-8 encoding. Replace all `?` sequences. The rest of the topnav (secondary nav mode, HTMX production tabs, AI button) is correct.

---

#### OPEN-3: `_comments.html` — Still a stub, not replaced
**File:** `src/reviews/templates/reviews/_comments.html`  
**Line 1–12:** Unchanged from original audit. Still:
```
<div class="rw-card">
  <h3>{% trans "Inline Comments" %}</h3>
  <ul>{% for comment in comments %}<li>{{ comment.body }}</li>{% endfor %}</ul>
</div>
```
**Issues:**
- Line 3: `<h3>` tag — should be `<div class="rw-section-hdr">`
- Line 3: `"Inline Comments"` — English hardcoded, should be `{% trans "لێدوانەکانی ناوخۆیی" %}`
- Line 5: `<ul><li>` — no avatar, no author name, no date, no reactions
- Line 7: `"No comments"` — English, should be `{% trans "هێشتا لێدوانێک نییە" %}`

**Fix:** Replace entire file with a proper threaded comment display matching the `community/_comment_thread.html` pattern (avatars, author name, date, body, reaction buttons).

---

#### OPEN-4: `_bible_tab.html` — English fallback text
**File:** `src/reviews/templates/reviews/_bible_tab.html`  
**Line 6:** `{% trans "No bible content provided." %}` — English hardcoded  
**Fix:** Replace with `{% trans "هیچ ناوەڕۆکی بایبڵێک نییە." %}`

Additionally, the bible tab only renders raw `pre-wrap` text. The design specifies formatted sections with headings (`<h2>`/`<h3>`), character table grid, and amber-highlighted notes block. The agent implemented a minimal stub.  
**Fix:** Extend `_bible_tab.html` to render structured sections when `bible_sections` context is available, with fallback to raw text display.

---

#### OPEN-5: `_decision_card.html` — Wrong field name `decision.decision_text`
**File:** `src/reviews/templates/reviews/_decision_card.html`  
**Line 24:** `{{ decision.decision_text }}`  
**Design specifies:** `{{ decision.body }}` — the design used `body` as the field name throughout  
**Impact:** Will render blank if model field is named `body`; will work if model uses `decision_text`. Needs verification against `src/reviews/models.py`.  
**Fix:** Confirm model field name and align template accordingly. If model uses `decision_text`, also update design kit templates for consistency.

---

#### OPEN-6: `_decision_card.html` — `border-radius:4px` used (breaks flat design rule)
**File:** `src/reviews/templates/reviews/_decision_card.html`  
**Lines 50, 54:** `border-radius:4px` on locked/rejected metadata blocks  
**Design rule:** `--rw-r: 2px` max; no arbitrary radius values  
**Fix:** Replace `border-radius:4px` with `border-radius:var(--rw-r)` or remove (flat containers have no radius by default in rwanga.css)

---

#### OPEN-7: `_decision_card.html` — `rgba(16,185,129,...)` and `rgba(239,68,68,...)` hardcoded colours
**File:** `src/reviews/templates/reviews/_decision_card.html`  
**Line 50:** `background:rgba(16,185,129,0.1)` — not a design token (Tailwind green)  
**Line 54:** `background:rgba(239,68,68,0.1)` — not a design token (Tailwind red)  
**Fix:**
- Line 50: Replace with `background:rgba(0,168,150,.1)` (uses `--rw-vis` value)
- Line 54: Replace with `background:var(--rw-pink-dim)` (uses design token)

---

#### OPEN-8: `_empty_state.html` param mismatch — still broken
**File:** `templates/components/_empty_state.html` line 6: uses `cta_label`  
**Callers still passing `cta_text`:**
- `src/projects/templates/projects/list.html` line 94: `cta_text=_("دەستپێکردن")`
- `src/reviews/templates/reviews/list.html` line 121: `cta_text=_("پێداچوونەوەی نوێ")`
- `src/community/templates/community/list.html` line 104: `cta_text=_("دانیشتنی نوێ")`

All 3 callers pass `cta_text` but the component checks `{% if cta_label %}` — the CTA button **never renders** on any empty state page.  
**Fix:** Change line 6 of `templates/components/_empty_state.html` from `{% if cta_label %}` to `{% if cta_text %}` and line 12/16 from `{{ cta_label }}` to `{{ cta_text }}`. This is the correct fix since the design kit and all callers consistently use `cta_text`.

---

#### OPEN-9: CSS — `--rv-purple`, `--cm-teal` and all related classes still missing
**File:** `static/css/rwanga.css`  
**Confirmed missing** (grep returned 0 matches for all of):
- `--rv-purple`, `--rv-purple-dim`
- `--cm-teal`, `--cm-teal-dim`
- `.rv-active`, `.cm-active`
- `.active-rv`, `.active-cm`
- `.rw-badge-status-*`

The sidebar uses hardcoded `color:#7C3AED` and `color:#0D9488` inline styles as a workaround, which will work visually but is fragile. The `.rv-active::before` pink accent line on the rail icon will NOT appear because the CSS class is missing — instead the existing `.rw-rail-icon.active::before { background: var(--rw-pink) }` fires due to the `active` class also being applied, giving the wrong (pink) colour.

**Fix:** Add to `static/css/rwanga.css` after the existing `:root` block:
```css
/* ── Reviews & Community tokens ─────────────────────── */
:root {
  --rv-purple:     #7C3AED;
  --rv-purple-dim: rgba(124,58,237,.10);
  --cm-teal:       #0D9488;
  --cm-teal-dim:   rgba(13,148,136,.10);
}

/* Rail icon states for reviews/community */
.rw-rail-icon.rv-active             { color: var(--rv-purple) !important; }
.rw-rail-icon.rv-active::before     { background: var(--rv-purple) !important; }
.rw-rail-icon.cm-active             { color: var(--cm-teal) !important; }
.rw-rail-icon.cm-active::before     { background: var(--cm-teal) !important; }

/* Topnav secondary mode tab accents */
.rw-sec-tab.active-rv  { color: var(--rv-purple); border-bottom-color: var(--rv-purple); }
.rw-sec-tab.active-cm  { color: var(--cm-teal);   border-bottom-color: var(--cm-teal); }

/* Status badge variants */
.rw-badge-status-draft    { background:var(--rw-surface-3);        color:var(--rw-text-2); border:1px solid var(--rw-border); }
.rw-badge-status-active   { background:var(--rw-amber-dim);        color:var(--rw-amber);  border:1px solid rgba(212,165,116,.3); }
.rw-badge-status-locked   { background:rgba(0,168,150,.10);        color:#00A896;          border:1px solid rgba(0,168,150,.3); }
.rw-badge-status-rejected { background:var(--rw-pink-dim);         color:var(--rw-shoot);  border:1px solid rgba(247,37,133,.25); }
.rw-badge-status-open     { background:rgba(13,148,136,.10);       color:#0D9488;          border:1px solid rgba(13,148,136,.3); }
.rw-badge-status-closed   { background:var(--rw-surface-3);        color:var(--rw-text-3); border:1px solid var(--rw-border); }
```

---

#### OPEN-10: `context_processors.py` — `nav_mode` value `"project"` doesn't match template expectations
**File:** `src/core/context_processors.py` line 20  
**Current:** `nav_mode = "project"` (for non-reviews/community paths)  
**Expected by templates:** `nav_mode == 'production'` OR `nav_mode` is falsy/absent  
**Impact:** The sidebar condition `{% if request.resolver_match.app_name == 'projects' and not nav_mode %}` will always fail because `nav_mode` is always set (never falsy). The projects rail icon will never show as `active`.  
**Fix:** Change line 20 to `nav_mode = None` (or `"production"`) so the `not nav_mode` check in the sidebar works for non-reviews/community pages.

---

#### OPEN-11: `context_processors.py` — Wrong model import `ReviewSession` instead of `CommunitySession`
**File:** `src/core/context_processors.py` line 1  
**Current:** `from src.community.models import ReviewSession`  
**Expected:** The community model is `CommunitySession` (or `ReviewSession` — verify in `src/community/models.py`). The model name matters for the `active_sessions_count` query on line 27.  
**Fix:** Verify the actual class name in `src/community/models.py` and correct the import. If the class is `ReviewSession`, the import is correct but the naming is confusing — consider aliasing: `from src.community.models import ReviewSession as CommunitySession`.

---

#### OPEN-12: `_topnav.html` — `reviews:project_list` and `community:project_list` URLs likely don't exist
**File:** `templates/components/_topnav.html` lines 41, 47  
**Current:**
```
href="{% url 'reviews:project_list' active_project.pk %}"
href="{% url 'community:project_list' active_project.pk %}"
```
These project-scoped URL names were included in the design but have not been confirmed to exist in `src/reviews/urls.py` or `src/community/urls.py`. If they don't exist, the topnav will raise `NoReverseMatch` on any page with `active_project` set while in reviews/community nav mode.  
**Fix:** Either:  
- Add `reviews:project_list` and `community:project_list` URL patterns, OR  
- Fall back to `reviews:list` and `community:list` (remove the `{% if active_project %}` conditional for the href)

---

### 🟡 Still Open — Minor

| # | Issue | File | Line | Fix |
|---|-------|------|------|-----|
| M-1 | `base.html` `htmx-config` meta in `<body>` not `<head>` | `templates/base.html` | end of body | Move to `<head>` |
| M-2 | `base.html` duplicate commented-out bootstrap script | `templates/base.html` | line after bootstrap bundle | Remove commented duplicate |
| M-3 | `accounts/login.html` script load order wrong (rwanga.js before htmx) | `src/accounts/templates/accounts/login.html` | bottom of body | Reorder: htmx → bootstrap → rwanga.js |
| M-4 | `accounts/login.html` English dev note hardcoded | same | `"Email sending is not configured..."` | Wrap in `{% if DEBUG %}` |
| M-5 | SortableJS not loaded for stripboard | `src/scheduling/templates/scheduling/stripboard.html` | bottom | Add SortableJS to vendor + load |
| M-6 | `community/index.html` (old stub) still exists alongside new `list.html` | `src/community/templates/community/index.html` | — | Delete `index.html`; update `views.py` `template_name` to `community/list.html` |
| M-7 | `reviews/index.html` (old stub) still exists alongside new `list.html` | `src/reviews/templates/reviews/index.html` | — | Delete `index.html`; update `views.py` `template_name` to `reviews/list.html` |

---

### Verification Summary

| Category | Original Count | Now Fixed | Still Open |
|----------|---------------|-----------|------------|
| Critical | 23 issues across 2 templates | 16 ✅ | 7 🔴 (OPEN 1–7) |
| Moderate | 22 issues across 6 templates | 20 ✅ | 2 🔴 (OPEN 8–9) |
| Minor | 6 issues | 0 ✅ | 6 🟡 (M-1–M-6 + OPEN 10–12) |
| Missing templates | 10 | 9 ✅ | 1 🔴 (`_comments.html` stub) |

**Priority order for engineering agent:**
1. **OPEN-1** — Fix UTF-8 encoding corruption in `_decision_card.html` (all Kurdish text broken)
2. **OPEN-2** — Fix UTF-8 encoding corruption in `_topnav.html` (dropdown menu broken)
3. **OPEN-8** — Fix `_empty_state.html` `cta_label` → `cta_text` (all empty state CTAs broken)
4. **OPEN-10** — Fix `nav_mode = "project"` → `None` in context processor (projects rail icon never active)
5. **OPEN-11** — Verify `ReviewSession` vs `CommunitySession` model name in context processor
6. **OPEN-12** — Verify `reviews:project_list` / `community:project_list` URLs exist or remove
7. **OPEN-3** — Implement `_comments.html` properly (currently a stub)
8. **OPEN-9** — Add CSS tokens and classes to `rwanga.css`
9. **OPEN-4** — Fix `_bible_tab.html` English fallback + add structured rendering
10. **OPEN-5,6,7** — Minor fixes in `_decision_card.html` (field name, border-radius, hardcoded colours)
11. **M-6, M-7** — Delete old `index.html` stubs for reviews and community

---

*Verification pass completed by Claude Design Agent — 2026-05-02*

---



**Auditor:** Claude Design Agent  
**Design source:** `rwanga-design-kit/templates/` + `rwanga-design-kit/static/css/rwanga.css`  
**Implementation source:** `src/*/templates/` + `templates/` (Django app)  
**Scope:** All templates compared class-by-class, variable-by-variable, pattern-by-pattern.

---

## Summary

| Category | Count |
|----------|-------|
| Templates audited | 28 |
| **Critical issues** (broken layout, wrong structure, English text) | **2** |
| **Moderate issues** (wrong classes, missing components, badge mismatches) | **8** |
| **Minor issues** (small deviations, missing optional features) | **6** |
| Fully acceptable | 12 |

---

## Critical Issues (fix immediately)

---

### `reviews/index.html` (implemented as `src/reviews/templates/reviews/index.html`)

**Original:** `rwanga-design-kit/templates/reviews/list.html`  
**Implemented:** `src/reviews/templates/reviews/index.html`

| # | Issue | Expected (Design) | Actual (Implemented) | Fix |
|---|-------|-------------------|----------------------|-----|
| 1 | **Page title in English** | `{% trans "پێداچوونەوەکان" %}` | `{% trans "Reviews" %}` | Replace with Kurdish |
| 2 | **Header button uses POST form** | HTMX `hx-get` to load modal into `#rw-modal-container` | `<form method="post" action="{% url 'reviews:create' %}">` — full page form | Change to `hx-get`/`hx-target="#rw-modal-container"` per design |
| 3 | **Missing page header block** | Full header section with purple icon tile (44×44px, bg `#7C3AED`), title h1, subtitle, create button at `margin-inline-start:auto` | Just `<h1>` + inline form, no icon, no subtitle | Rebuild to match `reviews/list.html` header structure |
| 4 | **Missing status filter strip** | `rw-filter-row` with 4 filter buttons (هەموو / لە پێداچوونەوەدا / پێشنووس / گەیشتووە) | Not present | Add filter row below header |
| 5 | **Wrong badge class names** | `background:var(--rw-amber-dim);color:var(--rw-amber)` for `in_review`; `background:rgba(0,168,150,.1);color:#00A896` for `delivered` | `rw-badge-a`, `rw-badge-g`, `rw-badge-d` — these classes don't exist in `rwanga.css` | Replace with correct inline badge styles per design |
| 6 | **Missing decision stats row** | Each review row shows `20 بڕیار`, `18 جێگیرکراو`, `1 ڕەتکراوە`, `12 هەڵسەنگاندنی دیمەن` | Not rendered at all | Add stats using `review.decisions.count`, `review.locked_decisions_count`, etc. |
| 7 | **Missing author avatar + date column** | Right column: `rw-avatar` (36px), author name, timesince date | Only shows `review.author.user.get_full_name` inline in the row body | Add right column with avatar and date |
| 8 | **Missing status accent border** | `border-inline-start:4px solid` colour-coded per status | Not present | Add `border-inline-start` to each row |
| 9 | **Wrong author accessor** | `review.author.get_full_name` | `review.author.user.get_full_name` — double-indirection suggests model mismatch | Confirm model field; design uses `review.author.get_full_name` directly |
| 10 | **Missing version badge** | `<span>v{{ review.version }}</span>` styled as mono chip | Version appended raw in title: `v{{ review.version }}` with no chip styling | Separate into styled version chip |

---

### `reviews/detail.html` (implemented as `src/reviews/templates/reviews/detail.html`)

**Original:** `rwanga-design-kit/templates/reviews/detail.html`  
**Implemented:** `src/reviews/templates/reviews/detail.html`

| # | Issue | Expected (Design) | Actual (Implemented) | Fix |
|---|-------|-------------------|----------------------|-----|
| 1 | **Page title in English** | `{% trans "Review Detail" %}` should be `{{ review.title }} — {% trans "پێداچوونەوە" %}` | `{% trans "Review Detail" %}` | Fix title block |
| 2 | **No topbar / review header** | 68px topbar with back button, title, version chip, status badge, "گۆڕینی بار" dropdown | Just `<h1>` with title | Full topbar missing — implement per design |
| 3 | **No stats strip** | `rw-stats` bar: 5 stats (decisions, locked, rejected, evaluations, comments) | Not present | Add `rw-stats` strip below topbar |
| 4 | **No tab navigation** | `rw-mod-tabs` with 4 tabs: بڕیارەکان / هەڵسەنگاندنی دیمەنەکان / لێدوانەکان / بایبڵ; HTMX tab loading | Everything on one scrollable page, no tabs | Implement tabbed layout per design |
| 5 | **Add Decision form inlined at top** | No inline form — decisions come from DB via context, managed via modal/separate view | `<form>` for creating decisions is inlined at top of page | Remove inline form; decisions should be pre-populated from context |
| 6 | **Add Evaluation form inlined** | Same — evaluations via context, not inline form | Second inline form for evaluations | Remove inline evaluation form |
| 7 | **Wrong decision card structure** | `_decision_card.html` partial: topic (bold), body text in `rw-surface-2` block, scene reference, status badge, locked/rejected by metadata, action buttons | `<div class="rw-card">` with `font-weight:700` topic and `font-size:12px` body; no left border accent, no locked/rejected metadata | Implement `_decision_card.html` per design; use HTMX inline swap |
| 8 | **Lock/reject action label wrong** | `{% trans "جێگیرکردن" %}` (lock) and `{% trans "ڕەتکردنەوە" %}` (reject) | `Approve` and `Reject` — English hardcoded, wrong term ("Approve" ≠ "lock") | Fix labels + translate |
| 9 | **Decision action URL wrong** | `{% url 'reviews:decision_action' decision.pk 'lock' %}` | `{% url 'reviews:decision_action' decision.pk 'approve' %}` | Change `'approve'` → `'lock'` throughout |
| 10 | **Scene evaluation display too sparse** | `_evaluation_card.html`: scene header, tension score bar (coloured 0-10), analysis, recommendations block | Just `Scene {{ ev.scene.number }} · {{ ev.tension_score }}` with plain text analysis | Implement `_evaluation_card.html` per design; add tension score bar |
| 11 | **Comments section not designed** | `_comments.html` partial referenced for inline comments on decisions | `_comments.html` is a stub: `<div class="rw-card"><h3>{% trans "Inline Comments" %}</h3><ul>...</ul>` — `<h3>` tag, `<ul>/<li>`, English heading | Implement full comment thread per `community/_comment_thread.html` pattern |
| 12 | **Missing bible tab** | Tab 4 renders bible content as formatted sections | Not implemented at all | Add bible tab content |
| 13 | **Missing `#rw-modal-container`** | Present at bottom of page | Not present | Add `<div id="rw-modal-container"></div>` |

---

## Moderate Issues (fix in next round)

---

### `community/index.html` → `src/community/templates/community/index.html`

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Inline create form in header** | `hx-get` button loading modal | Inline form with title input + session_type select exposed raw | Replace with button → modal pattern |
| 2 | **Session type selector exposed** | Not a user-facing control on list page | `<select name="session_type">` with raw values `screenplay`, `bible`, `scene_selection` | Remove from list view; belongs in create modal |
| 3 | **Missing page header structure** | Teal icon tile (44×44, bg `#0D9488`), h1, subtitle, create button | Just `<h1>` | Rebuild header per community list design |
| 4 | **Missing filter row** | `rw-filter-row`: هەموو / کراوەیە / داخراوە | Not present | Add filter row |
| 5 | **Missing status + project pill per row** | Each card: teal status badge, project name, session title, description, stats footer | Just title + date + status badge with wrong class | Rebuild card layout |
| 6 | **Wrong badge class** | `background:rgba(13,148,136,.1);color:var(--cm-teal)` | `rw-badge-g` / `rw-badge-d` — undefined classes | Fix badge styles |
| 7 | **Grid layout missing** | 2-col grid for cards | Single column list | Change to `display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))` |
| 8 | **Stats footer missing per card** | Comment count + participant count + timesince | Only `contents.count items` (English) | Add proper stats row |

---

### `community/detail.html` → `src/community/templates/community/detail.html`

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **No topbar** | 60px topbar with back button, title, status badge, manage dropdown | Just `<h1>` + action buttons | Add topbar |
| 2 | **Two-column layout missing** | Left: content blocks; Right: fixed 380px comment thread panel | Single column, all cards stacked | Implement two-column flex layout |
| 3 | **Admin forms exposed to all** | "Add Content Snapshot" + "Invite Participant" only for `can_manage` | Always shown, no permission gating | Gate with `{% if can_manage %}` |
| 4 | **Comment thread not implemented** | `_comment_thread.html` partial with avatars, reactions, reply forms, compose box | "Notes" section: plain `<div>` list, reaction counts as raw text, English labels | Implement `_comment_thread.html` per design |
| 5 | **English labels throughout** | All UI text in Kurdish via `{% trans %}` | `"Notes"`, `"Add Content Snapshot"`, `"Snapshot Scenes"`, `"Participants"`, `"No participants yet."`, `"Post"`, `"Agree"`, `"Disagree"`, `"Question"` are English hardcoded | Replace all English strings with `{% trans %}` Kurdish |
| 6 | **Reaction UI broken** | Emoji reaction buttons with count | `+Agree` / `+Disagree` / `+Question` as plain buttons, reaction counts as text | Redesign reactions per comment thread pattern |
| 7 | **Missing `#rw-modal-container`** | Present | Not present | Add |

---

### `projects/list.html` — Missing Reviews/Community Tiles

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Reviews + Community tiles missing** | After owned_projects grid: `rw-section-hdr` "هاوکاری و کۆمیونیتی" + 2-col tile grid with purple Reviews tile and teal Community tile | Not present — page ends after member_projects | Add tiles section per updated `projects/list.html` design |
| 2 | **Empty state uses wrong param** | `cta_label` (implemented `_empty_state.html` uses `cta_label`) | `cta_text` passed: `{% include "components/_empty_state.html" with ... cta_text=_("دەستپێکردن") %}` | Change `cta_text` → `cta_label` throughout all callers |

---

### `components/_sidebar.html` — Missing Reviews/Community Icons

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Reviews icon missing** | `📋` icon linking to `{% url 'reviews:list' %}` with `rv-active` state and `pending_decisions_count` badge | Not present | Add reviews rail icon |
| 2 | **Community icon missing** | `💬` icon linking to `{% url 'community:list' %}` with `cm-active` state and `active_sessions_count` badge | Not present | Add community rail icon |
| 3 | **Badge styles missing from rwanga.css** | `.rv-active` and `.cm-active` modifier classes for purple/teal accent | Not in `rwanga.css` | Add to CSS (see CSS Diff section) |
| 4 | **No `nav_mode` context** | Sidebar reads `nav_mode` to set active states | Context never passed from views | Add `nav_mode` to base context processor or each view |

---

### `components/_topnav.html` — Missing Secondary Nav Mode

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Secondary nav mode not implemented** | When `nav_mode == 'reviews'` or `'community'`: show Project / پێداچوونەوە / کۆمیونیتی tabs with correct colour accents | Only production mode (5-tab) exists | Add `{% if nav_mode == 'reviews' or nav_mode == 'community' %}` branch per design |
| 2 | **Section tabs use `window.location.href` onclick** | `hx-get` + `hx-target="#rw-content"` + `hx-push-url="true"` for HTMX navigation | `onclick="window.location.href='...'"` — full page reload | Replace with HTMX attributes |

---

### `accounts/login.html` — Script Load Order

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Script load order wrong** | Bootstrap JS before rwanga.js; htmx before body content | `rwanga.js` first, then `bootstrap.bundle.min.js`, then `htmx.min.js` — htmx after rwanga.js means HTMX form on login page may not initialise | Reorder: htmx first, then bootstrap, then rwanga.js |
| 2 | **English dev note hardcoded** | Dev notes should not appear in production templates | `"Email sending is not configured in development mode. Use email/password login instead."` — hardcoded English | Wrap in `{% if DEBUG %}{% trans "..." %}{% endif %}` |

---

### `reviews/_comments.html` — Stub Not Implemented

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Complete stub** | Full threaded comment display per design | `<div class="rw-card"><h3>{% trans "Inline Comments" %}</h3><ul><li>{{ comment.body }}</li></ul>` | Implement full comment thread: avatar + author + date + body + reactions |
| 2 | **English heading** | Kurdish: `{% trans "لێدوانەکانی ناوخۆیی" %}` | `Inline Comments` — English hardcoded | Replace |
| 3 | **`<h3>` tag** | No heading tags — use `rw-field-label` or `rw-section-hdr` | `<h3>` with no class | Replace with `<div class="rw-section-hdr">` |

---

## Minor Issues (nice to have)

---

### `base.html` — htmx-config placement

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **`htmx-config` meta in body** | HTMX config `<meta>` should be in `<head>` | Placed at end of `<body>` after all scripts | Move `<meta name="htmx-config">` into `<head>` |
| 2 | **Duplicate comment** | No duplicate code | Bootstrap bundle script has a commented-out duplicate of itself directly below | Remove the commented duplicate line |

---

### `accounts/team.html` — Minor Deviations (mostly acceptable)

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Role-access checkboxes missing from invite modal** | Invitation modal should show checkboxes for: Production Team / Reviewer / Community Member / Full Access | Not implemented — `accounts:invite_modal` view/template not in repo | Add access-level checkboxes to invite modal per DESIGN-REVIEWS-UX.md Task 1 |

---

### `scheduling/stripboard.html` — Minor (acceptable, 1 note)

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **SortableJS not loaded** | `Sortable.create(...)` called but SortableJS is not in `static/vendor/` and not loaded in template | `if (typeof Sortable !== 'undefined')` guard prevents crash but drag is silently disabled | Add SortableJS to `static/vendor/` and load in `{% block extra_js %}` |

---

### `shots/list.html` — Minor (good implementation)

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **`rw-badge-d` / `rw-badge-i` used but undefined** | Badge classes `rw-badge-d` and `rw-badge-i` are used in shot type cells | These classes exist in design CSS (`rwanga.css`) but the implemented `static/css/rwanga.css` is the same file — no issue here if CSS is synced | Verify CSS sync (see CSS Diff) |

---

### `progress/dashboard.html` — Acceptable with 1 note

| # | Issue | Expected | Actual | Fix |
|---|-------|----------|--------|-----|
| 1 | **Uses `progress_filters` templatetag** | Loaded but not used visibly in template | `{% load progress_filters %}` at top | Either use it or remove the load |

---

## CSS Diff

### Classes used in design templates but **missing** from implemented `static/css/rwanga.css`

The implemented `static/css/rwanga.css` appears to be identical to `rwanga-design-kit/static/css/rwanga.css` (same 41331 bytes). **However**, the following classes are used in the new Reviews/Community templates and the updated sidebar/topnav that were designed but not yet added to CSS:

| Class | Used In | Status | Add to rwanga.css |
|-------|---------|--------|-------------------|
| `.rv-active` | `_sidebar.html`, nav mode | **Missing** | `.rw-rail-icon.rv-active { color:#7C3AED !important; } .rw-rail-icon.rv-active::before { background:#7C3AED !important; }` |
| `.cm-active` | `_sidebar.html`, nav mode | **Missing** | `.rw-rail-icon.cm-active { color:#0D9488 !important; } .rw-rail-icon.cm-active::before { background:#0D9488 !important; }` |
| `.active-rv` | `_topnav.html` secondary mode | **Missing** | `.rw-sec-tab.active-rv { color:#7C3AED; border-bottom-color:#7C3AED; }` |
| `.active-cm` | `_topnav.html` secondary mode | **Missing** | `.rw-sec-tab.active-cm { color:#0D9488; border-bottom-color:#0D9488; }` |
| `--rv-purple` | Reviews templates | **Missing from `:root`** | `--rv-purple: #7C3AED; --rv-purple-dim: rgba(124,58,237,.10);` |
| `--cm-teal` | Community templates | **Missing from `:root`** | `--cm-teal: #0D9488; --cm-teal-dim: rgba(13,148,136,.10);` |

### Classes used by engineering agent that **do not exist** in design CSS

| Class | Where Used | Issue |
|-------|-----------|-------|
| `rw-badge-a` | `reviews/index.html`, `community/index.html` | Undefined — design has no `rw-badge-a` |
| `rw-badge-g` | Same | Undefined — design has no `rw-badge-g` |
| `rw-badge-d` (as status) | `reviews/index.html` | `rw-badge-d` exists but means "Dialogue" (for shot types), not a generic "default/dark" badge |

**Fix:** Replace all `rw-badge-a`, `rw-badge-g`, `rw-badge-d` status usages with correct inline badge styles per design tokens. Alternatively, add explicit named badge variants to `rwanga.css`:

```css
/* Add to rwanga.css — Status badge variants */
.rw-badge-status-draft    { background:var(--rw-surface-3); color:var(--rw-text-2); border:1px solid var(--rw-border); }
.rw-badge-status-active   { background:var(--rw-amber-dim); color:var(--rw-amber); border:1px solid rgba(212,165,116,.3); }
.rw-badge-status-locked   { background:rgba(0,168,150,.10); color:#00A896; border:1px solid rgba(0,168,150,.3); }
.rw-badge-status-rejected { background:var(--rw-pink-dim); color:var(--rw-shoot); border:1px solid rgba(247,37,133,.25); }
.rw-badge-status-open     { background:rgba(13,148,136,.10); color:#0D9488; border:1px solid rgba(13,148,136,.3); }
.rw-badge-status-closed   { background:var(--rw-surface-3); color:var(--rw-text-3); border:1px solid var(--rw-border); }
```

---

## Missing Templates

The following templates were **designed** in `rwanga-design-kit/templates/` but were **never implemented** in the Django app:

| Template | Design File | Status |
|----------|-------------|--------|
| `reviews/list.html` | `rwanga-design-kit/templates/reviews/list.html` | ❌ Not implemented — agent created `reviews/index.html` instead (wrong filename + minimal content) |
| `reviews/_decision_card.html` | `rwanga-design-kit/templates/reviews/_decision_card.html` | ❌ Not implemented — decision cards are inlined in `detail.html` |
| `reviews/_evaluation_card.html` | `rwanga-design-kit/templates/reviews/_evaluation_card.html` | ❌ Not implemented — evaluations inlined |
| `reviews/_create_modal.html` | `rwanga-design-kit/templates/reviews/_create_modal.html` | ❌ Not implemented — no modal, uses POST form instead |
| `community/list.html` | `rwanga-design-kit/templates/community/list.html` | ❌ Not implemented — agent created `community/index.html` instead |
| `community/detail.html` (full) | `rwanga-design-kit/templates/community/detail.html` | ⚠ Partially implemented — wrong structure, missing comment thread, English text |
| `community/_comment_thread.html` | `rwanga-design-kit/templates/community/_comment_thread.html` | ❌ Not implemented |
| `projects/list.html` (with tiles) | `rwanga-design-kit/templates/projects/list.html` (updated) | ⚠ Old version used — missing Reviews/Community tiles section |
| `components/_topnav.html` (secondary nav) | `rwanga-design-kit/templates/components/_topnav.html` (updated) | ⚠ Old version used — missing `nav_mode` branch |
| `components/_sidebar.html` (with icons) | `rwanga-design-kit/templates/components/_sidebar.html` (updated) | ⚠ Old version used — missing reviews/community icons + badges |

---

## Template Filename Mismatch

The engineering agent used different filenames to what the design specifies. This must be fixed so URL reversals and `{% include %}` references work correctly:

| Design Filename | Implemented Filename | Action |
|----------------|---------------------|--------|
| `reviews/list.html` | `reviews/index.html` | Rename `index.html` → `list.html`, update view `template_name` |
| `community/list.html` | `community/index.html` | Rename `index.html` → `list.html`, update view `template_name` |

---

## `_empty_state.html` Parameter Mismatch

**Critical:** The implemented `_empty_state.html` uses `cta_label` but **every caller** passes `cta_text`. This silently breaks the CTA button on all empty states.

| Location | Passed Param | Expected Param |
|----------|-------------|----------------|
| `src/projects/templates/projects/list.html` line 96 | `cta_text` | `cta_label` |
| `src/scripts/templates/scripts/index.html` | `cta_text` | `cta_label` |
| Multiple others | `cta_text` | `cta_label` |

**Fix (choose one):**
- Option A: Rename `cta_label` → `cta_text` in `templates/components/_empty_state.html`
- Option B: Replace all `cta_text=` with `cta_label=` in all callers

**Recommendation:** Option A (change the component to accept `cta_text`) since that is what the design kit uses throughout.

---

## Acceptable Templates (no action needed)

These implementations closely match the design originals:

| Template | Notes |
|----------|-------|
| `templates/base.html` | ✅ Correct structure, CSS variables, Bootstrap RTL, HTMX, dark mode |
| `templates/components/_modal.html` | ✅ Correct pattern, size variants, rwCloseModal, ESC key |
| `templates/components/_breadcrumb.html` | ✅ Matches design |
| `templates/components/_toast.html` | ✅ Matches design |
| `templates/components/_ai_progress.html` | ✅ Matches design |
| `src/projects/templates/projects/scene_view.html` | ✅ Matches design; bonus: `#rw-scene-comments` HTMX strip added |
| `src/projects/templates/projects/list.html` | ⚠ Acceptable but missing tiles (see above) |
| `src/accounts/templates/accounts/login.html` | ✅ Correct classes, RTL, standalone page; minor script order issue |
| `src/accounts/templates/accounts/team.html` | ✅ Good implementation, correct HTMX patterns |
| `src/scripts/templates/scripts/index.html` | ✅ Correct table pattern, badges, HTMX-free navigation |
| `src/shots/templates/shots/list.html` | ✅ Correct `rw-shot-table`, badge classes, HTMX filters |
| `src/scheduling/templates/scheduling/stripboard.html` | ✅ Correct strip row structure, HTMX save, badge classes |
| `src/progress/templates/progress/dashboard.html` | ✅ Correct stats strip, warn boxes, section headers |

---

## Prioritised Fix Order for Engineering Agent

### Round 1 — Critical (blocking UX)

1. **Rename** `reviews/index.html` → `reviews/list.html`; **rename** `community/index.html` → `community/list.html`; update `template_name` in both views.
2. **Rebuild** `reviews/list.html` from `rwanga-design-kit/templates/reviews/list.html` (copy verbatim, wire context).
3. **Rebuild** `reviews/detail.html` from `rwanga-design-kit/templates/reviews/detail.html` — implement 4-tab layout, stats strip, topbar.
4. **Create** `reviews/_decision_card.html` from `rwanga-design-kit/templates/reviews/_decision_card.html`; fix action URL `'approve'` → `'lock'`.
5. **Create** `reviews/_evaluation_card.html` from `rwanga-design-kit/templates/reviews/_evaluation_card.html`.
6. **Create** `reviews/_create_modal.html` from `rwanga-design-kit/templates/reviews/_create_modal.html`; update create view to return modal HTML on GET.
7. **Implement** `reviews/_comments.html` — replace stub with full threaded comment display.

### Round 2 — Moderate (broken community section)

8. **Rebuild** `community/index.html` (`list.html`) from `rwanga-design-kit/templates/community/list.html`.
9. **Rebuild** `community/detail.html` from `rwanga-design-kit/templates/community/detail.html` — two-column layout, content blocks, topbar.
10. **Create** `community/_comment_thread.html` from `rwanga-design-kit/templates/community/_comment_thread.html`.
11. **Copy** updated `rwanga-design-kit/templates/projects/list.html` → `src/projects/templates/projects/list.html` (adds Reviews + Community tiles).
12. **Copy** updated `rwanga-design-kit/templates/components/_topnav.html` → `templates/components/_topnav.html` (adds secondary nav mode; change onclick→HTMX on tabs).
13. **Copy** updated `rwanga-design-kit/templates/components/_sidebar.html` → `templates/components/_sidebar.html` (adds reviews/community icons + badges).

### Round 3 — CSS + Minor

14. **Add** to `static/css/rwanga.css`: CSS variables `--rv-purple`, `--rv-purple-dim`, `--cm-teal`, `--cm-teal-dim`; classes `.rv-active`, `.cm-active`, `.active-rv`, `.active-cm`; status badge variants `.rw-badge-status-*`.
15. **Fix** `_empty_state.html`: rename `cta_label` → `cta_text` (or update all callers).
16. **Fix** `base.html`: move `<meta name="htmx-config">` to `<head>`.
17. **Fix** `accounts/login.html`: reorder scripts (htmx → bootstrap → rwanga.js); wrap dev note in `{% if DEBUG %}`.
18. **Add** `nav_mode`, `pending_decisions_count`, `active_sessions_count` to base context processor (or each relevant view).
19. **Add** SortableJS to `static/vendor/` and load in `scheduling/stripboard.html`.

---

*Report generated by Claude Design Agent — 2026-05-02*
