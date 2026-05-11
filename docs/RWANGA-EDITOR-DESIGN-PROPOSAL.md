# Project Rwanga: Design & Development Proposal
## Professionalizing Kurdish Cinema through Structured Scriptwriting

---

## 1. Executive Summary
**Rwanga** is a platform for directors, writers, and production studios, providing a bridge between creative storytelling and technical pre-production. Its mission is to reform the Kurdish film industry by introducing standardization, AI-assisted breakdowns, and a dedicated script editor that replaces generic tools like MS Word.

## 2. Problem Statement
* **Lack of Standardization:** No unified format for Kurdish/Arabic screenplays leads to communication gaps between writers and studios.
* **Manual Labor:** Pre-production (breakdowns, scheduling, prop lists) is currently done manually from unstructured Word documents.
* **Technology Gap:** Local creators lack access to AI tools optimized for Kurdish dialects (Slemani/Sorani).

## 3. The Proposed Solution: The Rwanga Ecosystem

### A. The Rwanga Platform (Manual Phase)
The initial release serves as a production command center.
* **Script Importer:** Django/Celery-based parser for .docx and .pdf.
* **Visual Logic:** Integration of **Mermaid.js** to generate flowcharts of story beats and character movements.
* **Production Dashboard:** Centralized tracking for locations, characters, and budget impact.

### B. The Rwanga Script Editor (Experimental Phase)
A cross-platform (Electron/PWA) writing tool designed for the Kurdish scriptwriter.
* **Non-negotiable Structure:** Enforced headers (e.g., **دیمەنی ١. ناوەوە. کافتریا**) to ensure 100% data accuracy.
* **Active Learning Tagging:** Directors tag props (e.g., **دەمانچە**) and characters in real-time, providing 'gold standard' data for the fine-tuning of the model.
* **RTL Optimization:** Built specifically for Sorani/Slemani script requirements, avoiding the formatting headaches of MS Word.

## 4. Technical Stack
* **Backend:** Python 3.12, Django 5.x, PostgreSQL.
* **Async Processing:** Celery & Redis (for AI translation and breakdown tasks).
* **Real-time:** WebSockets for live collaboration and on-set updates.
* **Frontend:** HTMX (Platform) and Vue.js/Electron (Desktop Editor).
* **AI Layer:** * **Architect/Worker Pattern:** Using high-level models for logic and smaller, fine-tuned models for extraction.
    * **MCP Server:** The editor acts as an MCP server, allowing AI companions to query structured script data directly.

## 5. Data & Fine-Tuning Strategy
The platform will utilize a **Human-in-the-Loop** approach to build the first comprehensive Kurdish Cinema Dataset:
1.  **Synthetic Start:** Use ScriptBase/MovieNet to train initial extraction logic.
2.  **User Correction:** As directors use the Rwanga Editor, their manual tags and corrections are anonymized and fed back into the training loop.
3.  **Dialect Focus:** Fine-tuning specifically for Slemani-style natural dialogue vs. formal narration.

## 6. Business Model: 'Reform-First'
* **Community Tier (Free):** Full access to the Editor and Platform for students and juniors. Exports carry 'Rwanga' branding.
* **Studio Tier (Professional):** Paid features for production houses (KAM Production, etc.).
    * Custom branding (Studio Logos).
    * API-heavy features (Auto-translation, mass export to Excel/Scheduling software).
    * Advanced production analytics and budget forecasting.

## 7. Implementation Roadmap
1.  **Platform V1.0 (Live Soon):** Manual breakdown tools, UI polish, and user onboarding.
2.  **Editor Alpha:** Internal testing of the Electron/PWA editor with key partners (Sarwar).
3.  **Public Beta:** Release of the experimental editor with 'Consent for Data' transparency.
4.  **AI Integration:** Rollout of auto-tagging and 'humanized' Kurdish translation assistance.

---
*Prepared for Development - May 2026*
