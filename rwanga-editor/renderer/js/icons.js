// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — icons.js
   Inline SVG icon strings for the entire application.
   Usage: element.innerHTML = Rga.Icons.explorer;
   ============================================================ */

window.Rga = window.Rga || {};

Rga.Icons = {
  /* ---- Activity Bar ---- */
  explorer: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 4.5V17a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0019 17V7.5A1.5 1.5 0 0017.5 6H11L9 4H4.5A1.5 1.5 0 003 5.5z"/>
  </svg>`,

  scenes: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="16" height="12" rx="1.5"/>
    <path d="M3 9h16"/>
    <path d="M7 5V3.5M11 5V3.5M15 5V3.5"/>
    <path d="M7 5l4 4M11 5L7 9"/>
  </svg>`,

  tags: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 3h6.5l8 8a1.5 1.5 0 010 2.12l-4.38 4.38a1.5 1.5 0 01-2.12 0l-8-8V3z"/>
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
  </svg>`,

  sync: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 8a6 6 0 0111.36-1"/>
    <path d="M17 14a6 6 0 01-11.36 1"/>
    <polyline points="5 4 5 8 9 8"/>
    <polyline points="17 18 17 14 13 14"/>
  </svg>`,

  extensions: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="10" width="6" height="6" rx="1"/>
    <rect x="10" y="10" width="6" height="6" rx="1"/>
    <rect x="10" y="3" width="6" height="6" rx="1"/>
    <rect x="3" y="3" width="6" height="6" rx="1"/>
  </svg>`,

  settings: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="3"/>
    <path d="M11 2v2M11 18v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M2 11h2M18 11h2M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42"/>
  </svg>`,

  /* ---- File Type Icons (16x16) ---- */
  fileRga: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" fill="#FFC107" opacity="0.15" stroke="#FFC107" stroke-width="1"/>
    <text x="4.5" y="11.5" font-size="5.5" font-weight="bold" fill="#FFC107" font-family="sans-serif">RG</text>
  </svg>`,

  fileTxt: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" opacity="0.5"/>
    <path d="M5 7h6M5 9.5h4" stroke-width="0.8" opacity="0.4"/>
  </svg>`,

  fileMd: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" fill="#519ABA" opacity="0.15" stroke="#519ABA" stroke-width="1"/>
    <text x="3.5" y="11.5" font-size="5" font-weight="bold" fill="#519ABA" font-family="sans-serif">MD</text>
  </svg>`,

  filePdf: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" fill="#E5574F" opacity="0.15" stroke="#E5574F" stroke-width="1"/>
    <text x="2.8" y="11.5" font-size="4.8" font-weight="bold" fill="#E5574F" font-family="sans-serif">PDF</text>
  </svg>`,

  folder: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 3.5h4l1.5 1.5H14v8.5a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5z" fill="currentColor" opacity="0.12"/>
  </svg>`,

  folderOpen: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 3.5h4l1.5 1.5H14v2H4L2 13.5V3.5z" fill="currentColor" opacity="0.12"/>
  </svg>`,

  /* ---- UI Action Icons (14x14) ---- */
  close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M4 4l6 6M10 4l-6 6"/>
  </svg>`,

  plus: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M7 3v8M3 7h8"/>
  </svg>`,

  search: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="6" cy="6" r="4"/>
    <path d="M9 9l3 3"/>
  </svg>`,

  chevronDown: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 3.5l3 3 3-3"/>
  </svg>`,

  chevronRight: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 2l3 3-3 3"/>
  </svg>`,

  ellipsis: `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <circle cx="3" cy="7" r="1.2"/>
    <circle cx="7" cy="7" r="1.2"/>
    <circle cx="11" cy="7" r="1.2"/>
  </svg>`,

  /* ---- Window Controls (14x14) ---- */
  minimize: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 7h8"/>
  </svg>`,

  maximize: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="3" y="3" width="8" height="8" rx="0.5"/>
  </svg>`,

  windowClose: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M4 4l6 6M10 4l-6 6"/>
  </svg>`,

  /* ---- Arrow Navigation (12x12) ---- */
  arrowUp: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 10V2M2.5 5.5L6 2l3.5 3.5"/>
  </svg>`,

  arrowDown: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2v8M2.5 6.5L6 10l3.5-3.5"/>
  </svg>`,

  /* ---- Status Bar Icons ---- */
  moon: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M10 7.5A5 5 0 114.5 2a4 4 0 005.5 5.5z"/>
  </svg>`,

  sun: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
    <circle cx="6" cy="6" r="2.5"/>
    <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.75 2.75l1.06 1.06M8.19 8.19l1.06 1.06M2.75 9.25l1.06-1.06M8.19 3.81l1.06-1.06"/>
  </svg>`,

  warning: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
    <path d="M7 1.5L1 12h12L7 1.5z"/>
    <path d="M7 5.5v3M7 10.5v.01"/>
  </svg>`,

  check: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7l3 3 5-6"/>
  </svg>`,

  info: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
    <circle cx="7" cy="7" r="5.5"/>
    <path d="M7 6.5v4M7 4.5v.01"/>
  </svg>`,

  /* ---- Rwanga Logo (simplified clapperboard) ---- */
  rwangaLogo: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="6" width="16" height="12" rx="1.5" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.2"/>
    <path d="M2 10h16" stroke="currentColor" stroke-width="1"/>
    <path d="M5 6L8 2M10 6l3-4M15 6l3-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <text x="5.5" y="15.5" font-size="5" font-weight="bold" fill="currentColor" font-family="sans-serif">R</text>
  </svg>`
};
