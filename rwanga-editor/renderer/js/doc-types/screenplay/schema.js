// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay ProseMirror schema per spec §2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;
  if (!PM) {
    console.error('[Rga.DocTypes.Screenplay.Schema] ProseMirror bundle not loaded');
    return;
  }

  // ============================================================
  // NODES
  // ============================================================

  const nodes = {

    // Root document: optional titleStrip followed by body
    doc: {
      content: 'titleStrip? body',
    },

    // Title strip — sticky at top of page 1, has × remove button
    titleStrip: {
      content: 'text*',
      attrs: { removable: { default: true } },
      parseDOM: [{ tag: 'div.rga-title-strip' }],
      toDOM(node) {
        return ['div', { class: 'rga-title-strip', 'data-removable': String(node.attrs.removable) }, 0];
      }
    },

    // Body — container for all editable content
    body: {
      content: 'block*',
      parseDOM: [{ tag: 'div.rga-body' }],
      toDOM() { return ['div', { class: 'rga-body' }, 0]; }
    },

    // ----- BODY-LEVEL NODES (group "block") -----

    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0]; }
    },

    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } }
      ],
      toDOM(node) { return ['h' + node.attrs.level, 0]; }
    },

    quote: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0]; }
    },

    bulletList: {
      content: 'listItem+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() { return ['ul', 0]; }
    },

    orderedList: {
      content: 'listItem+',
      group: 'block',
      attrs: { start: { default: 1 } },
      parseDOM: [{ tag: 'ol', getAttrs(dom) { return { start: +dom.getAttribute('start') || 1 }; } }],
      toDOM(node) {
        return node.attrs.start === 1
          ? ['ol', 0]
          : ['ol', { start: node.attrs.start }, 0];
      }
    },

    listItem: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() { return ['li', 0]; }
    },

    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr']; }
    },

    pageBreak: {
      group: 'block',
      attrs: { manual: { default: true } },
      parseDOM: [{ tag: 'div.rga-page-break' }],
      toDOM() { return ['div', { class: 'rga-page-break' }]; }
    },

    // ----- SCENE (group "block"; container with restricted children) -----

    scene: {
      content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
      group: 'block',
      attrs: {
        id: { default: null },
        number: { default: null },
        notes: { default: '' },
        revisionFlag: { default: null }
      },
      parseDOM: [{ tag: 'div.rga-scene' }],
      toDOM(node) {
        return ['div', {
          class: 'rga-scene',
          'data-scene-id': node.attrs.id || '',
          'data-scene-number': node.attrs.number || ''
        }, 0];
      }
    },

    // ----- SCENE CHILDREN (group "screenplay") -----

    sceneLine: {
      content: 'inline*',
      group: 'screenplay',
      attrs: {
        setting: { default: 'INT' },     // INT | EXT | INT/EXT | EXT/INT
        location: { default: '' },
        time: { default: 'DAY' }
      },
      parseDOM: [{ tag: 'div.rga-scene-line' }],
      toDOM(node) {
        return ['div', {
          class: 'rga-scene-line',
          'data-setting': node.attrs.setting,
          'data-location': node.attrs.location,
          'data-time': node.attrs.time
        }, 0];
      }
    },

    action: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-action' }],
      toDOM() { return ['div', { class: 'rga-action' }, 0]; }
    },

    character: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-character' }],
      toDOM() { return ['div', { class: 'rga-character' }, 0]; }
    },

    dialogue: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-dialogue' }],
      toDOM() { return ['div', { class: 'rga-dialogue' }, 0]; }
    },

    parenthetical: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-parenthetical' }],
      toDOM() { return ['div', { class: 'rga-parenthetical' }, 0]; }
    },

    transition: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-transition' }],
      toDOM() { return ['div', { class: 'rga-transition' }, 0]; }
    },

    shot: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-shot' }],
      toDOM() { return ['div', { class: 'rga-shot' }, 0]; }
    },

    inlineFreeText: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-inline-free-text' }],
      toDOM() { return ['div', { class: 'rga-inline-free-text' }, 0]; }
    },

    text: { group: 'inline' }
  };

  // ============================================================
  // MARKS
  // ============================================================

  // Given a #RRGGBB hex color, return '#000000' or '#ffffff' for readable contrast.
  function _contrastColor(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const h = hex.replace('#', '');
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // Perceived luminance (ITU-R BT.601)
    return (0.299 * r + 0.587 * g + 0.114 * b) > 128 ? '#000000' : '#ffffff';
  }

  const marks = {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM() { return ['strong', 0]; }
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM() { return ['em', 0]; }
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM() { return ['u', 0]; }
    },
    strikethrough: {
      parseDOM: [{ tag: 's' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }],
      toDOM() { return ['s', 0]; }
    },
    color: {
      attrs: { value: {} },
      parseDOM: [{ style: 'color', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'color: ' + mark.attrs.value }, 0]; }
    },
    highlight: {
      attrs: { value: {} },
      parseDOM: [{ style: 'background-color', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) {
        const bg = mark.attrs.value;
        const fg = _contrastColor(bg);
        return ['span', { style: 'background-color: ' + bg + (fg ? '; color: ' + fg : '') }, 0];
      }
    },
    fontFamily: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-family', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'font-family: ' + mark.attrs.value }, 0]; }
    },
    fontSize: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-size', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'font-size: ' + mark.attrs.value }, 0]; }
    },
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs(dom) {
        return { href: dom.getAttribute('href'), title: dom.getAttribute('title') };
      } }],
      toDOM(mark) { return ['a', { href: mark.attrs.href, title: mark.attrs.title }, 0]; }
    },
    annotation: {
      attrs: {
        id: {},
        text: { default: '' },
        color: { default: '#FFE08A' },
        createdAt: { default: null },
        author: { default: null }
      },
      inclusive: false,
      excludes: 'tag revisionFlag',   // writer marks are mutually exclusive
      parseDOM: [{ tag: 'span.rga-annotation', getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id'),
          text: dom.getAttribute('data-text') || '',
          color: dom.getAttribute('data-color') || '#FFE08A',
          createdAt: dom.getAttribute('data-created-at'),
          author: dom.getAttribute('data-author')
        };
      } }],
      toDOM(mark) {
        const bg = mark.attrs.color;
        const fg = _contrastColor(bg);
        return ['span', {
          class: 'rga-annotation',
          'data-id': mark.attrs.id,
          'data-text': mark.attrs.text,
          'data-color': bg,
          'data-created-at': mark.attrs.createdAt || '',
          'data-author': mark.attrs.author || '',
          style: 'background-color: ' + bg + (fg ? '; color: ' + fg : '')
        }, 0];
      }
    },
    tag: {
      attrs: {
        tagType: {},        // character | prop | wardrobe | location | sfx | vfx | vehicle | animal | custom
        entityId: {}
      },
      inclusive: false,
      excludes: 'annotation revisionFlag',   // writer marks are mutually exclusive
      parseDOM: [{ tag: 'span.rga-tag', getAttrs(dom) {
        return {
          tagType: dom.getAttribute('data-tag-type'),
          entityId: dom.getAttribute('data-entity-id')
        };
      } }],
      toDOM(mark) {
        return ['span', {
          class: 'rga-tag rga-tag-' + mark.attrs.tagType,
          'data-tag-type': mark.attrs.tagType,
          'data-entity-id': mark.attrs.entityId
        }, 0];
      }
    },
    revisionFlag: {
      attrs: {
        id: { default: null },
        reason: { default: '' },
        color: { default: '#F44747' },   // red | #F5A623 yellow | #4EC9B0 green
        createdAt: { default: null },
        status: { default: 'open' }      // open | resolved
      },
      inclusive: false,
      excludes: 'annotation tag',   // writer marks are mutually exclusive
      parseDOM: [{ tag: 'span.rga-revision-flag', getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id') || null,
          reason: dom.getAttribute('data-reason') || '',
          color: dom.getAttribute('data-color') || '#F44747',
          createdAt: dom.getAttribute('data-created-at'),
          status: dom.getAttribute('data-status') || 'open'
        };
      } }],
      toDOM(mark) {
        return ['span', {
          class: 'rga-revision-flag rga-revision-' + mark.attrs.status,
          'data-id': mark.attrs.id || '',
          'data-reason': mark.attrs.reason,
          'data-color': mark.attrs.color,
          'data-created-at': mark.attrs.createdAt || '',
          'data-status': mark.attrs.status,
          style: 'border-bottom-color: ' + mark.attrs.color
        }, 0];
      }
    }
  };

  const screenplaySchema = new PM.Schema({ nodes, marks });

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.schema = screenplaySchema;
})();
