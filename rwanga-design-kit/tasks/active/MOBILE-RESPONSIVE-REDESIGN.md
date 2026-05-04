# Mobile Responsive Redesign — Use Bootstrap 5, Not Custom CSS

> **Priority:** HIGH — the platform is completely unusable on mobile.
> **Assigned to:** Claude Design
> **Rule:** Do NOT invent custom responsive CSS. Bootstrap 5 RTL already solves this.

---

## The Problem You Found (All 7 Are Real)

1. `overflow: hidden` on `html, body` kills all scrolling
2. `.rw-app` is a rigid `100vh` flex container with no mobile fallback
3. `.rw-rail` (68px sidebar) never collapses on mobile
4. Only 8 lines of responsive CSS for a 1,400-line stylesheet
5. `.rw-topnav` overflows and clips on small screens
6. Touch targets are below 44px minimum
7. Scene view is a 3-panel layout with no mobile restructuring

## Why Your Previous Fix Was Wrong

You diagnosed the problems correctly but prescribed the wrong medicine. You wrote 200+ lines of custom responsive CSS — custom breakpoints, custom flex rewiring, custom bottom bar, custom scroll overrides. This is exactly the pattern that caused the problems in the first place.

**Bootstrap 5 RTL is already in the stack.** It handles responsive layout, mobile scrolling, navbar collapse, offcanvas panels, grid breakpoints, and touch-friendly sizing out of the box. The entire app shell should have been built on BS5 components, not a parallel custom system.

---

## What To Do

### Step 1 — Remove the damage

Delete these rules from `rwanga.css`:

```css
/* DELETE — BS5 handles body scroll */
html, body {
  height: 100%;
  overflow: hidden;
}

/* DELETE — BS5 handles layout */
.rw-app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
```

### Step 2 — Refactor the app shell using BS5

| Current Custom Component | Replace With |
|--------------------------|-------------|
| `.rw-rail` (68px sidebar) | BS5 `offcanvas-start` on mobile, visible sidebar on `d-none d-lg-flex` |
| `.rw-topnav` (custom flex bar) | BS5 `navbar navbar-expand-lg` with `navbar-collapse` for section tabs |
| `.rw-section-tabs` (custom tabs) | Inside the `navbar-collapse` — collapses into hamburger on mobile |
| `.rw-scene-panel` (248px side panel) | BS5 `offcanvas-end` on mobile, visible panel on `d-none d-lg-block` |
| `.rw-topnav-end` (avatar, buttons) | Inside navbar, use BS5 `d-none d-md-flex` to hide username on small screens |

### Step 3 — Use BS5 responsive utilities

Instead of writing custom `@media` rules, use BS5 classes in the HTML:

- `d-none d-lg-flex` — hide rail on mobile, show on desktop
- `d-lg-none` — show hamburger only on mobile
- `navbar-collapse` — auto-collapse section tabs
- `offcanvas offcanvas-end` — scene panel as slide-out on mobile
- BS5 `.btn` already has proper touch target sizing — don't override with custom `.rw-btn` dimensions

### Step 4 — Keep custom CSS only for what BS5 can't do

Your custom CSS should ONLY cover:

- **Design tokens**: `var(--rw-*)` colors, spacing, radii
- **Brand typography**: Cairo + Inter font stacks
- **Brand colors**: Pink #F72585, Amber #D4A574, dark/light theme tokens
- **Component-specific styling**: amber accents, pink active states, the flat aesthetic, scrollbar styling
- **Rwanga-unique components**: bible viewer, chain viewer, review workbench internals

Everything else — layout, grid, responsive breakpoints, navigation collapse, offcanvas, modal, toast positioning — BS5 handles it.

### Step 5 — Test

After refactoring, verify on:
- Desktop (1440px+): looks the same as before
- Tablet (768px): rail collapses to offcanvas or bottom bar, topnav tabs collapse to hamburger
- Phone (375px): everything scrolls, touch targets are 44px+, no content clipped

---

## The Rule

**Do not invent or guess. If Bootstrap 5 already provides a component or utility for it, use that. Only write custom CSS for things BS5 genuinely cannot do (brand tokens, custom component internals). If you're unsure whether BS5 covers something, check the BS5 docs first — do not write custom CSS "just in case."**

This rule exists because custom CSS overrides have caused 10+ rounds of UI regressions on this project. Every time custom CSS was written for something BS5 already handles, it broke something else.
