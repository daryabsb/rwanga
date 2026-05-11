# Technical Specification: Rwanga Script Editor (V1 Alpha)

## 1. Project Vision
The Rwanga Script Editor is a "standard-setting" writing tool designed to professionalize Kurdish and Arabic cinema. It enforces a structural blueprint on the creative process, turning raw text into structured data (JSON/Relational) for downstream production use.

## 2. Core Tech Stack
* **Shell:** Electron (Desktop wrapper for Windows/Mac).
* **Frontend:** Pure HTML5, Vanilla JavaScript (ES6+), CSS3.
* **Backend:** Python 3.12+ / Django 5.x.
* **Communication:** HTMX (for dynamic UI updates) and WebSockets (for live sync/background tasks).
* **Database:** PostgreSQL (Cloud) / SQLite (Local-first cache).
* **Async Tasks:** Celery + Redis.

## 3. Frontend Specifications (Pure HTML/JS/CSS)

### A. The "Smart" Writing Surface
* **ContentEditable Implementation:** A customized `div` with `contenteditable="true"` designed for RTL (Right-to-Left) text flow.
* **The "Non-Negotiable" Standard:**
    * **Scene Header (Slugline):** Must start with `دیمەنی` followed by integer. 
    * **Metadata Pattern:** `[دیمەنی] [ژمارە] - [ناوەوە/دەرەوە] - [شوێن] - [کات]`.
* **Keyboard Intercepts (Vanilla JS):**
    * `Enter`: Detect context. If previous block was "Character", set next block to "Dialogue".
    * `Tab`: Cycle through element types (Scene -> Action -> Character -> Dialogue -> Parenthetical).
* **Styling (CSS):**
    * Strict Screenplay Typography: 12pt Courier New (or Kurdish equivalent).
    * Specific Indentation: Action (0), Character (3.7"), Dialogue (2.5"), Parenthetical (3.1").

### B. HTMX Integration
* **Auto-Save:** Use `hx-post="/editor/save/"` triggered by `keyup` with a `delay:2000ms`.
* **Element Tagging:** When a user finishes a line, HTMX sends the fragment to Django. Django returns the "Augmented" HTML with recognized entities (Characters/Props) highlighted.

## 4. Backend Specifications (Django 5+)

### A. Data Models
* **Script:** Title, Version, Author, Full Text.
* **Scene:** Script_FK, Scene_Number, Setting (INT/EXT), Location, Time_of_Day.
* **Entity:** Name, Type (Character/Prop/Wardrobe).
* **Script_Fragment:** Mapping scenes to specific entities for the breakdown.

### B. Logic & Extraction
* **Regex Parser:** A Django utility to parse the "Rwanga Standard" headers into the `Scene` model.
* **Dialect Guard:** Middleware to check for Slemani-style natural language patterns in Dialogue blocks.

## 5. Electron/Local-First Strategy
* **Local Proxy:** Electron serves the HTML/JS frontend.
* **Hybrid Storage:**
    * Writers work locally (SQLite via Electron).
    * On "Sync" or "Cloud Export," HTMX pushes local state to the Django Production server.

## 6. Functional Specs for Agents/Designers

### Web Designer (Frontend)
1.  Ensure the `contenteditable` div handles Cursor Positioning for RTL languages without jumping.
2.  Implement a "Production Sidebar" that populates via HTMX as the user writes (showing detected Props/Characters).
3.  Create a "Status Bar" showing sync status with the Django backend.

### Backend Developer (Django)
1.  Build a REST/HTMX endpoint that accepts partial script HTML and returns structured JSON.
2.  Implement the Character/Prop detection logic (using the Character Ledger discussed).
3.  Set up Celery workers for PDF generation (Industry Standard layout) and Kurdish-to-Arabic translation tasks.

## 7. Implementation Roadmap
1.  **Skeleton:** Setup Electron shell with Django 5 backend and basic HTML writing surface.
2.  **Standardization:** Implement the regex-based scene detection for `دیمەنی`.
3.  **Active Learning:** Build the "Highlighter" UI where users confirm suggested tags for characters/props.
4.  **Export:** Develop the PDF generator (Pure HTML to PDF via WeasyPrint/Django).

---
**Note:** Mermaid flowcharting is excluded from this phase. Focus purely on structural text integrity and data extraction.
