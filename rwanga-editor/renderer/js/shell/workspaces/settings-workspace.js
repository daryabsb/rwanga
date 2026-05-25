// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace skeleton — Slice 5A.
//
// First real Settings workspace tab. Registers with Rga.Workspaces
// under kind='settings' and binds Ctrl+, (view.openSettings command)
// to open it. Singleton behavior comes from
// Rga.TabManager.openWorkspace.
//
// Renderer scope (intentionally narrow for Slice 5A):
//   - left nav rail: one item per section from Rga.Settings.Layout
//   - right content area: section title, description, setting count
//   - click a nav item: swaps the content area; moves .is-active
//
// Slice 5A explicitly does NOT ship:
//   - controls (toggles / inputs / selects / buttons / save)
//   - search box (substrate exists per Slice 3B; binding waits for 5B+)
//   - Pro gates / onboarding / restart-required handling
//   - any visual polish beyond skeleton geometry
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Workspaces || typeof Rga.Workspaces.register !== 'function') return;

  function _activeSectionId(el) {
    return el.getAttribute('data-active-section-id') || null;
  }

  function _renderContent(el, section) {
    if (!section) return;
    const content = el.querySelector('.rga-settings-content');
    if (!content) return;
    // Skeleton scope: title + description + setting count only.
    // textContent (not innerHTML) prevents the (currently English)
    // strings from being treated as markup.
    content.querySelector('.rga-settings-content-title').textContent       = section.label;
    content.querySelector('.rga-settings-content-description').textContent = section.description;
    content.querySelector('.rga-settings-content-count').textContent =
      section.settingIds.length + ' setting' + (section.settingIds.length === 1 ? '' : 's');
    el.setAttribute('data-active-section-id', section.id);
    // Move .is-active.
    const items = el.querySelectorAll('.rga-settings-nav-item');
    items.forEach(function(li) {
      li.classList.toggle('is-active', li.getAttribute('data-section-id') === section.id);
    });
  }

  function _buildSkeleton(el) {
    const sections = (Rga.Settings && Rga.Settings.Layout &&
                      typeof Rga.Settings.Layout.sections === 'function')
      ? Rga.Settings.Layout.sections()
      : [];
    el.classList.add('rga-settings-workspace');

    // Left nav rail.
    const nav = document.createElement('nav');
    nav.className = 'rga-settings-nav';
    sections.forEach(function(section) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'rga-settings-nav-item';
      item.setAttribute('data-section-id', section.id);
      item.textContent = section.label;
      item.addEventListener('click', function() {
        _renderContent(el, section);
      });
      nav.appendChild(item);
    });

    // Right content area — placeholder shape (title, description, count).
    const content = document.createElement('section');
    content.className = 'rga-settings-content';
    const title = document.createElement('h1');
    title.className = 'rga-settings-content-title';
    const desc = document.createElement('p');
    desc.className = 'rga-settings-content-description';
    const count = document.createElement('p');
    count.className = 'rga-settings-content-count';
    content.appendChild(title);
    content.appendChild(desc);
    content.appendChild(count);

    el.appendChild(nav);
    el.appendChild(content);

    // Seed: first section active.
    if (sections.length > 0) _renderContent(el, sections[0]);
  }

  Rga.Workspaces.register({
    kind: 'settings',
    title: 'Settings',
    icon: 'settings',
    restoreOnSession: false,
    mount: function(el) {
      _buildSkeleton(el);
    },
    unmount: function(el) {
      el.innerHTML = '';
      el.removeAttribute('data-active-section-id');
      el.classList.remove('rga-settings-workspace');
    }
  });

  // Ctrl+, opens the workspace. The handler routes through
  // TabManager.openWorkspace which already enforces singleton
  // behavior — a second Ctrl+, focuses the existing tab.
  const KR = Rga.KeyboardRegistry;
  if (KR && typeof KR.registerCommand === 'function') {
    KR.registerCommand({
      command: 'view.openSettings',
      label:   'Open Settings',
      key:     ',',
      mods:    { ctrl: true },
      handler: function() {
        if (Rga.TabManager && typeof Rga.TabManager.openWorkspace === 'function') {
          Rga.TabManager.openWorkspace('settings');
        }
      },
      source:  'Slice 5A settings workspace'
    });
  }

  // Expose internals for debug / future tests. NOT part of the
  // public renderer API — workspaces talk to the host via mount /
  // unmount only.
  Rga.Settings = Rga.Settings || {};
  Rga.Settings._workspaceInternals = { _renderContent: _renderContent };
})();
