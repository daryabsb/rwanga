// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.SessionBoundary — the canonical manifest of which fields
// belong to which session-side owner.
//
// Runtime Ownership Stab. Slice 7 §A. This module is a SOURCE OF
// TRUTH, not a runtime mechanism: it does not subscribe, mutate, or
// notify. Other modules (drift guards in tests/, audit docs) consult
// it to verify field ownership.
//
// The rule each owner must obey:
//
//   Rga.ScriptSession  → writer-context fields ONLY
//                        (activeScript / currentScene / currentPage /
//                         currentView / currentSelection /
//                         openPanels / activePanel)
//
//   Rga.ScriptMetrics  → derived-analytics fields ONLY
//                        (wordCount / currentBlockType + reserved
//                         dialogueWords / actionWords / sceneCount /
//                         estimatedRuntime)
//
//   Rga.ViewManager    → view-mode runtime SSOT
//                        (current view id; body classes)
//
//   Rga.WorkspaceState → workspace persistence
//                        (Layout zones: sidebar / studioPanel /
//                         inspector / titleBar / statusBar)
//
// Goal: a contributor who tries to add an analytics field to
// ScriptSession (or a writer-context field to ScriptMetrics) fails
// the drift guards at CI with a message naming the correct owner.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  const MANIFEST = {
    ScriptSession: {
      semantic: 'writer-context',
      module:   'renderer/js/shell/script-session.js',
      fields:   [
        'activeScript',
        'currentScene',
        'currentPage',
        'currentView',
        'currentSelection',
        'openPanels',
        'activePanel'
      ]
    },
    ScriptMetrics: {
      semantic: 'derived-analytics',
      module:   'renderer/js/shell/script-metrics.js',
      fields:   [
        'wordCount',
        'currentBlockType',
        // Reserved (always null today; computed by future slices).
        'dialogueWords',
        'actionWords',
        'sceneCount',
        'estimatedRuntime'
      ]
    },
    ViewManager: {
      semantic: 'view-mode',
      module:   'renderer/js/framework/view-manager.js',
      // ViewManager doesn't expose a snapshot; its "field" is the
      // active view id available via .current(). Listed here for
      // ownership-matrix completeness.
      fields:   ['current']
    },
    WorkspaceState: {
      semantic: 'workspace-persistence',
      module:   'renderer/js/shell/workspace-state.js',
      // WorkspaceState persists Layout's full state. Listed fields
      // are the top-level Layout zones it serializes.
      fields:   ['sidebar', 'studioPanel', 'inspector', 'titleBar', 'statusBar']
    }
  };

  // Reverse index: field → owner. Built once. Two owners owning the
  // same field name is a hard error — fail loudly so the contributor
  // sees it during boot.
  const _OWNER_OF = Object.create(null);
  Object.keys(MANIFEST).forEach(function(owner) {
    MANIFEST[owner].fields.forEach(function(field) {
      if (Object.prototype.hasOwnProperty.call(_OWNER_OF, field)) {
        const prev = _OWNER_OF[field];
        // Special case: ScriptSession's `currentView` legitimately
        // mirrors ViewManager's `current` — both own a logical view
        // field but with different names. The duplicate guard below
        // expects identical NAMES; since they differ we never collide.
        // If a real duplicate ever shows up, fail loud.
        if (prev !== owner) {
          throw new Error(
            '[Rga.SessionBoundary] duplicate field "' + field +
            '" owned by both ' + prev + ' and ' + owner +
            '. Each session-side field name must have exactly one owner.'
          );
        }
      }
      _OWNER_OF[field] = owner;
    });
  });

  function ownerOf(field) {
    return Object.prototype.hasOwnProperty.call(_OWNER_OF, field) ? _OWNER_OF[field] : null;
  }

  function fieldsOf(owner) {
    return MANIFEST[owner] ? MANIFEST[owner].fields.slice() : [];
  }

  function isFieldOf(owner, field) {
    return MANIFEST[owner] && MANIFEST[owner].fields.indexOf(field) >= 0;
  }

  function owners() {
    return Object.keys(MANIFEST);
  }

  function semanticOf(owner) {
    return MANIFEST[owner] ? MANIFEST[owner].semantic : null;
  }

  function moduleOf(owner) {
    return MANIFEST[owner] ? MANIFEST[owner].module : null;
  }

  Rga.SessionBoundary = {
    ownerOf:    ownerOf,
    fieldsOf:   fieldsOf,
    isFieldOf:  isFieldOf,
    owners:     owners,
    semanticOf: semanticOf,
    moduleOf:   moduleOf,
    _MANIFEST:  MANIFEST     // exposed for tests / audits
  };
  Rga.Shell.SessionBoundary = Rga.SessionBoundary;
})();
