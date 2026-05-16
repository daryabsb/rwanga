// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Base outer-schema marks. Same set works for every doc-type for now.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Framework = Rga.Framework || {};

  function _contrastColor(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const h = hex.replace('#', '');
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
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
        author: { default: null },
        status: { default: 'open' }
      },
      inclusive: false,
      excludes: 'tag revisionFlag',
      parseDOM: [{ tag: 'span.rga-annotation', getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id'),
          text: dom.getAttribute('data-text') || '',
          color: dom.getAttribute('data-color') || '#FFE08A',
          createdAt: dom.getAttribute('data-created-at'),
          author: dom.getAttribute('data-author'),
          status: dom.getAttribute('data-status') || 'open'
        };
      } }],
      toDOM(mark) {
        const resolved = mark.attrs.status === 'resolved';
        const bg = mark.attrs.color;
        const fg = _contrastColor(bg);
        return ['span', {
          class: resolved ? 'rga-annotation rga-annotation-resolved' : 'rga-annotation',
          'data-id': mark.attrs.id,
          'data-text': mark.attrs.text,
          'data-color': bg,
          'data-created-at': mark.attrs.createdAt || '',
          'data-author': mark.attrs.author || '',
          'data-status': mark.attrs.status,
          style: resolved ? '' : 'background-color: ' + bg + (fg ? '; color: ' + fg : '')
        }, 0];
      }
    },
    tag: {
      attrs: {
        tagType: {},
        entityId: {}
      },
      inclusive: false,
      excludes: 'annotation revisionFlag',
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
        color: { default: '#F44747' },
        createdAt: { default: null },
        status: { default: 'open' }
      },
      inclusive: false,
      excludes: 'annotation tag',
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

  Rga.Framework.baseOuterMarks = marks;
  Rga.Framework._contrastColor = _contrastColor;
})();
