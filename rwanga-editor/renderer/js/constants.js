// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.Constants = {
    CURRENT_RGA_VERSION: '3.0',
    // Older versions (1.x, 2.x) load through the migration chain in
    // Rga.Migrations.migrate and are saved back as v3.
    SUPPORTED_RGA_VERSIONS: ['1.0', '1.1', '2.0', '3.0'],

    PRODUCTION_TYPES: [
      { value: 'feature',     label_en: 'Feature',       label_ku: 'فیلمی درێژ' },
      { value: 'short',       label_en: 'Short',          label_ku: 'فیلمی کورت' },
      { value: 'episode',     label_en: 'TV Episode',     label_ku: 'ئەپیۆدی تەلەفزیۆن' },
      { value: 'music_video', label_en: 'Music Video',    label_ku: 'ڤیدیۆی گۆرانی' },
      { value: 'commercial',  label_en: 'Commercial',     label_ku: 'ڕیکلام' },
      { value: 'untyped',     label_en: 'Not set',        label_ku: 'دیاری نەکراوە' },
    ],

    DEFAULT_PRODUCTION_TYPE: 'untyped',

    SCRIPT_LANGUAGES: [
      { value: 'en', label: 'English (LTR)' },
      { value: 'ku', label: 'Kurdish / کوردی (RTL)' },
      { value: 'ar', label: 'Arabic / العربية (RTL)' },
    ],

    DEFAULT_SCRIPT_LANGUAGE: 'en',

    // Paper dimensions in inches { width, height }.
    // A4 is ISO 216 (210mm x 297mm); the inch values are 210/25.4 and
    // 297/25.4 to 4 decimal places — kept precise so this table agrees
    // exactly with LayoutProfile's paper resolution (Recovery Step 1).
    PAPER_SIZES: {
      Letter: { width: 8.5,    height: 11 },
      A4:     { width: 8.2677, height: 11.6929 },
      Legal:  { width: 8.5,    height: 14 }
    },

    DEFAULT_VOCABULARY: {
      settings: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
      times: ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'],
      sceneWord: 'SCENE'
    },

    AUTOSAVE_DEBOUNCE_MS: 2000,
    AUTOSAVE_MAX_INTERVAL_MS: 10000,
    WORKSPACE_WRITE_DEBOUNCE_MS: 1000,
    RECENT_FILES_MAX: 10,
    STORAGE_PILL_THRESHOLD_BYTES: 50 * 1024 * 1024,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.Constants;
  }
})();
