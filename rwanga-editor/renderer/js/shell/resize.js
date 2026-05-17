// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Resize — drag-to-resize handles for sidebar / inspector / bottom panel.
//
// Extracted from app-shell.js in Runtime Ownership Stab. Slice 8 §A.
// No engine consumers; only the init script in renderer/index.html
// calls Rga.Resize.init().
//
// Architecture (preserved from Slice 4 §A):
//   • Drag mid-move writes the CSS variable directly (live feel).
//   • Drag-end COMMITS the final size to Rga.Shell.Layout. The
//     WorkspaceState subscriber persists. Layout subscriber re-applies
//     to CSS when state arrives via fromJSON (workspace restore).
//   • init() hydrates CSS vars from Layout on first paint (covers the
//     post-WorkspaceState-restore initial paint), then subscribes.
//
// Mapping (CSS var ↔ Layout path):
//   --sidebar-width        ↔ Layout.sidebar.width
//   --inspector-width      ↔ Layout.inspector.width
//   --bottom-panel-height  ↔ Layout.studioPanel.height
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.Resize = {
    _SIZE_MAP: [
      { target: 'sidebar',      cssVar: '--sidebar-width',       zone: 'sidebar',     field: 'width'  },
      { target: 'inspector',    cssVar: '--inspector-width',     zone: 'inspector',   field: 'width'  },
      { target: 'bottom-panel', cssVar: '--bottom-panel-height', zone: 'studioPanel', field: 'height' }
    ],

    init: function() {
      var handles = Rga.$$('.resize-handle');
      handles.forEach(function(handle) {
        handle.addEventListener('mousedown', function(e) {
          Rga.Resize._startDrag(e, handle);
        });
      });
      Rga.Resize._applyLayoutToCss();
      if (Rga.Shell && Rga.Shell.Layout && typeof Rga.Shell.Layout.subscribe === 'function') {
        Rga.Shell.Layout.subscribe(function() { Rga.Resize._applyLayoutToCss(); });
      }
    },

    _findMapByTarget: function(target) {
      for (var i = 0; i < Rga.Resize._SIZE_MAP.length; i += 1) {
        if (Rga.Resize._SIZE_MAP[i].target === target) return Rga.Resize._SIZE_MAP[i];
      }
      return null;
    },

    _applyLayoutToCss: function() {
      if (!Rga.Shell || !Rga.Shell.Layout) return;
      var snap = Rga.Shell.Layout.get();
      Rga.Resize._SIZE_MAP.forEach(function(m) {
        var zone = snap[m.zone];
        if (!zone) return;
        var val = zone[m.field];
        if (typeof val !== 'number') return;
        document.documentElement.style.setProperty(m.cssVar, val + 'px');
      });
    },

    _startDrag: function(e, handle) {
      e.preventDefault();
      handle.classList.add('dragging');
      document.body.style.cursor = handle.dataset.resize === 'bottom-panel' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';

      var target = handle.dataset.resize;
      var map = Rga.Resize._findMapByTarget(target);
      var prop = map ? map.cssVar : '--sidebar-width';
      var isVertical = target === 'bottom-panel';
      var startPos = isVertical ? e.clientY : e.clientX;

      var startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 0;
      var lastSize = startSize;

      function onMove(e2) {
        var delta;
        if (isVertical) {
          delta = startPos - e2.clientY;
        } else if (target === 'inspector') {
          delta = startPos - e2.clientX;
        } else {
          delta = e2.clientX - startPos;
        }

        var newSize = startSize + delta;
        var minSize = isVertical ? 100 : 180;
        var collapseThreshold = 60;

        if (newSize < collapseThreshold) {
          newSize = 0;
        } else {
          newSize = Math.max(newSize, minSize);
        }

        lastSize = newSize;
        document.documentElement.style.setProperty(prop, newSize + 'px');
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // Slice 4 §A: commit on drag-end. Layout subscriber (WorkspaceState)
        // persists. Mousemove-rate writes would hammer localStorage.
        if (map && Rga.Shell && Rga.Shell.Layout) {
          var patch = {};
          patch[map.zone] = {};
          patch[map.zone][map.field] = lastSize;
          Rga.Shell.Layout.set(patch);
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
  };
})();
