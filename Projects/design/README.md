# ڕوانگە — Design Package

## Phase 0 Prototype

**File:** `Platform Prototype.html` — open in any browser, no build step needed.

### What's in it
- Dark/light mode toggle (☀ in topnav)
- RTL default (Kurdish Sorani), LTR-ready via `dir` attribute flip
- Project dashboard with 5 color-coded sections (Script, Breakdown, Visualize, Plan, Shoot)
- Scene 12 view with 10 module tabs: Shots, Storyboard, Floor Plan SVG, Schedule, Lighting, Sound, Props, Wardrobe, Continuity
- Real Scene 12 data — 15 shots, 13 setups, schedule, lighting notes
- Cairo font for Kurdish/Arabic, Inter for Latin/numeric
- CSS custom properties for all color tokens (dark + light)
- Logical CSS properties throughout (border-inline-start etc) — LTR flip works with zero template changes

### Color tokens
| Variable | Dark | Light |
|---|---|---|
| `--accent` | `#D4A574` | `#9E5E2A` |
| `--col-s` (Script) | `#E07F3A` | same |
| `--col-b` (Breakdown) | `#4B7BE5` | same |
| `--col-v` (Visualize) | `#18A88C` | same |
| `--col-p` (Plan) | `#8B5CF6` | same |
| `--col-sh` (Shoot) | `#E5456A` | same |

### Next steps
- Phase 1: Django scaffold + Shot List + Floor Plan editor + Scene Viewer export
- See `design-plan.md` for full architecture
