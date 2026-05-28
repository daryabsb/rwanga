// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.Toolbar — Filmustageation F1A.6.
//
// Neutral toolbar contribution registry. CORE owns the frame (the
// Row 3 #rga-shell-toolbar element, its inner band, the text /
// writing / mode static groups, the mode toggle, the
// data-command click delegation); plugins own their content groups
// via registerGroup(controller).
//
// F1A.6 ships the API + migrates ONE group (the Scene group:
// block-type select + Insert Scene button) into the screenplay
// plugin. Tag/writing/text/mode groups stay in CORE for now.
//
// Plugin groups mount inside a dedicated slot in the toolbar's inner
// band — see renderer/index.html's
// `.rga-shell-toolbar-content-slot[data-toolbar-slot="content"]`
// element. The slot sits between the text group and the writing
// group; plugin groups land there in `order` ascending, each with a
// leading separator so the visible chrome matches the pre-F1A.6
// hardcoded layout.
//
// Controller shape (per the F1A.1A audit's minimal-contract pattern,
// parallel to Rga.Shell.Inspector.registerPanel):
//
//   {
//     id:        string,                       // unique
//     order:     number,                       // sort key (Scene = 200)
//     dataGroup?: string,                      // data-group attr (default id)
//     className?: string,                      // extra CSS class
//     mount:     function(groupEl) → cleanupFn?,
//     unmount?:  function(groupEl)
//   }
//
// Defensive: invalid controllers are rejected without throwing;
// duplicate ids are rejected; mount + cleanup throws are contained;
// pre-init registrations are queued and mounted at setHost time;
// post-init registrations are mounted immediately.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.Toolbar = Rga.Shell.Toolbar || {};

  // Registered groups (id → controller). Map preserves insertion order
  // for tie-breaking when two groups declare the same numeric order.
  const _groups = new Map();
  // Mounted DOM + cleanups (populated at init / register-after-init).
  const _groupEls = new Map();   // id → group <div>
  const _sepEls   = new Map();   // id → leading separator <div>
  const _cleanups = new Map();   // id → cleanup fn from mount()
  // The .rga-shell-toolbar-content-slot host element. Captured by
  // setHost; null until format-toolbar.js wires it.
  let _slot = null;
  // false until setHost runs. Pre-init registrations queue; post-init
  // registrations mount immediately.
  let _initialized = false;

  // ==========================================================================
  // Public API
  // ==========================================================================

  function setHost(slotEl) {
    _slot = slotEl || null;
    if (!_slot) { _initialized = false; return; }
    _initialized = true;
    // Mount every controller registered BEFORE the host arrived, in
    // (order, insertion) sequence.
    _orderedControllers().forEach(_mountGroupNow);
  }

  function getHost() { return _slot; }

  function registerGroup(controller) {
    if (!_isValidController(controller)) return false;
    if (_groups.has(controller.id)) return false;
    _groups.set(controller.id, controller);
    if (_initialized) _mountGroupNow(controller);
    return true;
  }

  function unregisterGroup(id) {
    if (typeof id !== 'string' || !_groups.has(id)) return false;
    // Run cleanup first.
    const cleanup = _cleanups.get(id);
    if (typeof cleanup === 'function') {
      try { cleanup(); }
      catch (err) { console.error('[Rga.Shell.Toolbar] cleanup threw for "' + id + '":', err); }
    }
    const ctrl = _groups.get(id);
    const groupEl = _groupEls.get(id);
    if (ctrl && typeof ctrl.unmount === 'function' && groupEl) {
      try { ctrl.unmount(groupEl); }
      catch (err) { console.error('[Rga.Shell.Toolbar] unmount threw for "' + id + '":', err); }
    }
    // Remove the group's DOM (leading sep + group div).
    const sepEl = _sepEls.get(id);
    if (sepEl && sepEl.parentNode) sepEl.parentNode.removeChild(sepEl);
    if (groupEl && groupEl.parentNode) groupEl.parentNode.removeChild(groupEl);
    _groupEls.delete(id);
    _sepEls.delete(id);
    _cleanups.delete(id);
    _groups.delete(id);
    return true;
  }

  function registered() {
    return Array.from(_groups.keys());
  }

  function getController(id) {
    if (typeof id !== 'string') return null;
    return _groups.get(id) || null;
  }

  // Test helper. Soft reset — drops mounted DOM + cleanups; leaves the
  // registry intact so the screenplay plugin's IIFE-registered Scene
  // group survives boot cycles in tests (same pattern as F1A.4 status-
  // bar contribution API).
  function _reset() {
    _cleanups.forEach(function(fn, id) {
      try { fn(); }
      catch (err) { console.error('[Rga.Shell.Toolbar] cleanup threw on reset for "' + id + '":', err); }
    });
    _cleanups.clear();
    // Strip every plugin-mounted DOM node out of the slot. Leaves
    // _groups untouched so a subsequent setHost re-mounts.
    _groupEls.forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });
    _sepEls.forEach(function(el)   { if (el.parentNode) el.parentNode.removeChild(el); });
    _groupEls.clear();
    _sepEls.clear();
    _slot = null;
    _initialized = false;
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  function _isValidController(c) {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.id !== 'string' || c.id.length === 0) return false;
    if (typeof c.mount !== 'function') return false;
    if (c.order != null && typeof c.order !== 'number') return false;
    return true;
  }

  function _orderedControllers() {
    return Array.from(_groups.values()).sort(function(a, b) {
      const oa = (typeof a.order === 'number') ? a.order : 0;
      const ob = (typeof b.order === 'number') ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return 0;  // insertion-order tie-breaker handled by Map iteration
    });
  }

  function _mountGroupNow(ctrl) {
    if (!_slot) return;
    // Build the leading separator.
    const sep = document.createElement('div');
    sep.className = 'rga-shell-toolbar-group-sep';
    sep.setAttribute('role', 'separator');
    sep.setAttribute('aria-hidden', 'true');

    // Build the group container with the standard chrome.
    const groupEl = document.createElement('div');
    groupEl.className = 'rga-shell-toolbar-group' +
      (ctrl.className ? ' ' + ctrl.className : '');
    groupEl.setAttribute('data-group', ctrl.dataGroup || ctrl.id);
    groupEl.setAttribute('data-toolbar-group-id', ctrl.id);

    // Insert into the slot in the right position relative to other
    // plugin groups (recompute each time so post-init registrations
    // land in the correct spot).
    _insertGroupInSlotOrder(ctrl, sep, groupEl);

    _groupEls.set(ctrl.id, groupEl);
    _sepEls.set(ctrl.id, sep);

    // mount() runs after the DOM is in place. A throw is caught so a
    // buggy plugin never blocks the rest of the toolbar — the group
    // div stays in the DOM as an empty placeholder.
    let cleanup = null;
    try { cleanup = ctrl.mount(groupEl); }
    catch (err) {
      console.error('[Rga.Shell.Toolbar] mount threw for "' + ctrl.id + '":', err);
    }
    if (typeof cleanup === 'function') _cleanups.set(ctrl.id, cleanup);
  }

  function _insertGroupInSlotOrder(ctrl, sep, groupEl) {
    if (!_slot) return;
    const ordered = _orderedControllers().map(function(c) { return c.id; });
    const myIdx = ordered.indexOf(ctrl.id);
    // Walk existing CHILDREN of the slot in DOM order, looking for the
    // first plugin-group whose controller order is greater than mine.
    // Insert our (sep + groupEl) PAIR before that.
    const children = _slot.children;
    for (let i = 0; i < children.length; i += 1) {
      const candidate = children[i];
      const candidateId = candidate.getAttribute &&
        candidate.getAttribute('data-toolbar-group-id');
      if (!candidateId) continue;
      const candidateIdx = ordered.indexOf(candidateId);
      if (candidateIdx > myIdx) {
        // Insert sep + group BEFORE the candidate's leading separator.
        const candidateSep = _sepEls.get(candidateId);
        const insertBefore = (candidateSep && candidateSep.parentNode === _slot)
          ? candidateSep : candidate;
        _slot.insertBefore(sep, insertBefore);
        _slot.insertBefore(groupEl, insertBefore);
        return;
      }
    }
    _slot.appendChild(sep);
    _slot.appendChild(groupEl);
  }

  Rga.Shell.Toolbar.setHost          = setHost;
  Rga.Shell.Toolbar.getHost          = getHost;
  Rga.Shell.Toolbar.registerGroup    = registerGroup;
  Rga.Shell.Toolbar.unregisterGroup  = unregisterGroup;
  Rga.Shell.Toolbar.registered       = registered;
  Rga.Shell.Toolbar.getController    = getController;
  Rga.Shell.Toolbar._reset           = _reset;
})();
