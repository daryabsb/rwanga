// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — sample-data.js
   Sample screenplay data for testing and prototyping.
   Load this to populate the editor with realistic content.
   Depends on: scene-manager.js, tag-system.js, editor-engine.js
   ============================================================ */

window.Rga = window.Rga || {};

Rga.SampleData = {
  metadata: {
    title: 'The Last Light',
    author: 'Dara Rashid',
    version: 1,
    language: 'en',
    genre: 'Drama / Thriller',
    logline: 'A journalist discovers an envelope that could expose a city-wide conspiracy — but trusting the wrong person may cost her everything.'
  },

  scenes: [
    {
      number: 1,
      setting: 'INT',
      location: 'CAFÉ',
      time: 'NIGHT',
      notes: 'Opening scene — establish mood, rain, isolation.',
      elements: [
        { type: 'action', text: 'A dimly lit café. Rain streaks the windows. JAZZ drifts from a corner speaker. A half-empty cup of tea sits on a worn wooden table.' },
        { type: 'character', text: 'SARAH' },
        { type: 'parenthetical', text: '(checking her watch)' },
        { type: 'dialogue', text: "I've been waiting for an hour. You know I can't keep doing this." },
        { type: 'character', text: 'JOHN' },
        { type: 'dialogue', text: 'Traffic. You know how it is. The whole city shuts down when it rains.' },
        { type: 'action', text: 'Sarah pushes the ENVELOPE across the table. John stares at it but doesn\'t touch it.' },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: "It's all there. Every last page. I want nothing to do with it anymore." },
        { type: 'action', text: 'John picks up the ENVELOPE, weighs it in his hand. He looks out the window at the RAIN.' },
        { type: 'character', text: 'JOHN' },
        { type: 'parenthetical', text: '(quietly)' },
        { type: 'dialogue', text: 'You know what happens if they find out.' },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: 'That\'s your problem now.' },
        { type: 'action', text: 'She stands, grabs her JACKET from the chair back, and walks toward the door without looking back.' }
      ]
    },
    {
      number: 2,
      setting: 'EXT',
      location: 'STREET',
      time: 'NIGHT',
      notes: 'Transition scene — John alone, commitment moment.',
      elements: [
        { type: 'action', text: 'John steps out into the rain. He holds the ENVELOPE under his JACKET. A BLACK CAR idles at the curb, headlights cutting through the downpour.' },
        { type: 'shot', text: 'CLOSE UP — JOHN\'S FACE' },
        { type: 'action', text: 'Doubt. Fear. Resolution. All passing in a single breath.' },
        { type: 'character', text: 'JOHN' },
        { type: 'parenthetical', text: '(to himself)' },
        { type: 'dialogue', text: 'No turning back now.' },
        { type: 'action', text: 'He crosses the wet street toward the BLACK CAR. A FIGURE in the driver seat watches him approach.' },
        { type: 'transition', text: 'CUT TO:' }
      ]
    },
    {
      number: 3,
      setting: 'INT',
      location: 'POLICE STATION',
      time: 'DAY',
      notes: 'Introduce Detective Hana. Contrast: harsh daylight vs. noir night.',
      elements: [
        { type: 'action', text: 'Harsh fluorescent lights. DETECTIVE HANA sits behind a cluttered desk, a COFFEE MUG in one hand, a CASE FILE in the other. A PHONE rings somewhere in the background, unanswered.' },
        { type: 'character', text: 'DETECTIVE HANA' },
        { type: 'dialogue', text: 'So let me get this straight. You found the envelope, in a café, at two in the morning. And you just... opened it.' },
        { type: 'character', text: 'JOHN' },
        { type: 'dialogue', text: 'Wouldn\'t you?' },
        { type: 'action', text: 'Hana leans back, studying him. She drops the CASE FILE on the desk with a THUD.' },
        { type: 'character', text: 'DETECTIVE HANA' },
        { type: 'dialogue', text: 'No. I would have called the police. Which is exactly what a normal person does when they find classified documents in a public place.' },
        { type: 'character', text: 'JOHN' },
        { type: 'parenthetical', text: '(shifting uncomfortably)' },
        { type: 'dialogue', text: 'I\'m a journalist. Finding things is what I do.' },
        { type: 'action', text: 'Hana opens a desk drawer and pulls out a PHOTOGRAPH — grainy surveillance still. She slides it across the desk.' },
        { type: 'character', text: 'DETECTIVE HANA' },
        { type: 'dialogue', text: 'Recognize anyone?' },
        { type: 'action', text: 'John looks at the PHOTOGRAPH. His face goes white.' },
        { type: 'transition', text: 'SMASH CUT TO:' }
      ]
    },
    {
      number: 4,
      setting: 'INT',
      location: 'JOHN\'S APARTMENT',
      time: 'NIGHT',
      notes: 'Paranoia scene. John alone with the evidence.',
      elements: [
        { type: 'action', text: 'A small, messy apartment. Papers everywhere. John sits at a desk with a LAPTOP open, the ENVELOPE\'s contents spread around him. His PHONE buzzes — he ignores it.' },
        { type: 'action', text: 'He picks up one of the documents. His hands are shaking.' },
        { type: 'character', text: 'JOHN' },
        { type: 'parenthetical', text: '(reading aloud, barely audible)' },
        { type: 'dialogue', text: 'Authorization to proceed with Phase Two... signed by...' },
        { type: 'action', text: 'He stops. Stares at the signature. Looks at his PHONE. Looks back at the document.' },
        { type: 'action', text: 'A KNOCK at the door. Loud. Insistent.' },
        { type: 'action', text: 'John freezes. The KNOCK comes again — three sharp raps.' },
        { type: 'transition', text: 'FADE TO BLACK.' }
      ]
    }
  ],

  tagRegistry: {
    characters: [
      { id: 'tag-sarah', name: 'SARAH', notes: 'Journalist, mid-30s. Cynical but principled.' },
      { id: 'tag-john', name: 'JOHN', notes: 'Freelance journalist, late 30s. In over his head.' },
      { id: 'tag-hana', name: 'DETECTIVE HANA', notes: 'Police detective. Sharp, patient, unreadable.' }
    ],
    props: [
      { id: 'tag-envelope', name: 'ENVELOPE', notes: 'Contains classified documents. The MacGuffin.' },
      { id: 'tag-casefile', name: 'CASE FILE', notes: '' },
      { id: 'tag-coffeemug', name: 'COFFEE MUG', notes: '' },
      { id: 'tag-phone', name: 'PHONE', notes: 'John\'s mobile phone.' },
      { id: 'tag-photograph', name: 'PHOTOGRAPH', notes: 'Surveillance still — reveals a connection.' },
      { id: 'tag-laptop', name: 'LAPTOP', notes: '' }
    ],
    wardrobe: [
      { id: 'tag-jacket', name: 'JACKET', notes: 'Sarah\'s jacket in Scene 1; John uses it to shield envelope.' }
    ],
    vehicles: [
      { id: 'tag-blackcar', name: 'BLACK CAR', notes: 'Mysterious vehicle. Driver not yet identified.' }
    ],
    sfx: [
      { id: 'tag-jazz', name: 'JAZZ', notes: 'Background music in café.' },
      { id: 'tag-thud', name: 'THUD', notes: 'Case file hitting desk.' },
      { id: 'tag-knock', name: 'KNOCK', notes: 'Door knock — end of Act 1.' },
      { id: 'tag-rain', name: 'RAIN', notes: 'Persistent rain sound through Scenes 1-2.' }
    ],
    locations: [
      { id: 'tag-loc-cafe', name: 'CAFÉ', notes: '' },
      { id: 'tag-loc-street', name: 'STREET', notes: '' },
      { id: 'tag-loc-police', name: 'POLICE STATION', notes: '' },
      { id: 'tag-loc-apartment', name: "JOHN'S APARTMENT", notes: '' }
    ]
  },

  /**
   * Load the sample data into the editor.
   * Call after all modules are initialized.
   */
  load: function() {
    // Load tag registry first
    if (Rga.TagSystem) {
      Rga.TagSystem.loadRegistry(this.tagRegistry);
    }

    // Load scenes into editor
    if (Rga.SceneManager) {
      Rga.SceneManager.load(this.scenes);
    }

    // Auto-highlight: scan editor text for known tag names and apply highlights
    this._autoHighlightTags();

    // Refresh insert zones after all scenes are loaded
    if (Rga.SceneManager) {
      Rga.SceneManager.refreshInsertZones();
    }

    // Set tab title
    if (Rga.Tabs && Rga.Tabs.activeTabId) {
      var tabEl = Rga.$('.tab[data-tab-id="' + Rga.Tabs.activeTabId + '"]');
      if (tabEl) {
        var title = Rga.$('.tab-title', tabEl);
        if (title) title.textContent = this.metadata.title + '.rga';
      }
    }

    // Run validation
    if (Rga.Problems) {
      Rga.Problems.run();
    }

    // Update everything
    Rga.StatusBar.update();
  },

  /**
   * Scan all editor blocks and wrap known tag entity names in highlight spans.
   * This bridges the gap between the tag registry (which knows names)
   * and the editor text (which is plain text after load).
   */
  _autoHighlightTags: function() {
    if (!Rga.TagSystem || !Rga.TagSystem.registry) return;

    var editor = Rga.$('#editor');
    if (!editor) return;

    // Build a lookup: uppercase name → { id, type }
    var tagLookup = [];
    Rga.TagSystem.registry.forEach(function(entity) {
      tagLookup.push({
        name: entity.name,
        nameUpper: entity.name.toUpperCase(),
        id: entity.id,
        type: entity.type
      });
    });

    // Sort by name length descending so longer names match first
    // (e.g. "DETECTIVE HANA" before "HANA")
    tagLookup.sort(function(a, b) {
      return b.name.length - a.name.length;
    });

    // Process each action/dialogue block (not character blocks — those ARE the name)
    var blocks = Rga.$$('.editor-block', editor);
    blocks.forEach(function(block) {
      var type = block.dataset.blockType;
      // Only highlight in action blocks (where props, characters, SFX appear in prose)
      if (type !== 'action') return;

      var text = block.textContent;
      if (!text || !text.trim()) return;

      // Find all tag matches in this text
      var matches = [];
      tagLookup.forEach(function(tag) {
        var searchText = text.toUpperCase();
        var startPos = 0;
        var idx;
        while ((idx = searchText.indexOf(tag.nameUpper, startPos)) !== -1) {
          // Verify it's a whole-word match (surrounded by non-alpha or at boundaries)
          var before = idx > 0 ? text[idx - 1] : ' ';
          var after = idx + tag.name.length < text.length ? text[idx + tag.name.length] : ' ';
          var isWordBoundary = /[^A-Za-z']/.test(before) && /[^A-Za-z']/.test(after);

          if (isWordBoundary) {
            // Check no overlap with existing matches
            var overlaps = matches.some(function(m) {
              return idx < m.end && (idx + tag.name.length) > m.start;
            });
            if (!overlaps) {
              matches.push({
                start: idx,
                end: idx + tag.name.length,
                tagId: tag.id,
                type: tag.type,
                name: tag.name
              });
            }
          }
          startPos = idx + 1;
        }
      });

      if (matches.length === 0) return;

      // Sort matches by start position
      matches.sort(function(a, b) { return a.start - b.start; });

      // Rebuild block innerHTML with highlight spans
      var html = '';
      var lastEnd = 0;
      matches.forEach(function(m) {
        // Text before this match
        html += _escHtml(text.substring(lastEnd, m.start));
        // The highlighted span
        var typeLabel = Rga.TAG_TYPES[m.type] ? Rga.TAG_TYPES[m.type].label : m.type;
        html += '<span class="tag-highlight" data-tag-id="' + m.tagId +
                '" data-tag-type="' + m.type +
                '" title="' + typeLabel + ': ' + _escHtml(m.name) + '">' +
                _escHtml(text.substring(m.start, m.end)) + '</span>';
        lastEnd = m.end;
      });
      // Remaining text after last match
      html += _escHtml(text.substring(lastEnd));

      block.innerHTML = html;
    });

    // Update tag manager panel with occurrence counts
    Rga.TagSystem.updateManagerPanel();

    function _escHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
};
