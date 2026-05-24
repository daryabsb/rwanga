/*
 * settings-app.jsx — Main Settings application component
 * Composes nav, content area, page setup preview, JSON panel
 */

function SettingsApp() {
  // Tweaks
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const compact = tweaks.density === 'compact';
  const showJson = tweaks.jsonPreview;
  const showPagePreview = tweaks.pagePreview;

  // Settings state
  const defaults = React.useMemo(() => buildDefaults(), []);
  const [values, setValues] = React.useState(() => ({ ...defaults }));
  const [activeSection, setActiveSection] = React.useState('general');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [theme, setTheme] = React.useState('dark');

  // Theme handling
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleChange = (id, val) => {
    setValues(prev => ({ ...prev, [id]: val }));
    if (id === 'theme' && (val === 'dark' || val === 'light')) {
      setTheme(val);
    }
  };
  const handleReset = (id) => {
    setValues(prev => ({ ...prev, [id]: defaults[id] }));
  };
  const isModified = (id) => {
    const v = values[id];
    const d = defaults[id];
    if (typeof v === 'object' && v !== null) return JSON.stringify(v) !== JSON.stringify(d);
    return v !== d;
  };

  // Filter settings by search
  const filteredSections = React.useMemo(() => {
    if (!searchQuery.trim()) return SETTINGS_SECTIONS;
    const q = searchQuery.toLowerCase();
    return SETTINGS_SECTIONS.map(section => ({
      ...section,
      settings: section.settings.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.helper.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        SCOPE_META[s.scope]?.label.toLowerCase().includes(q)
      )
    })).filter(section => section.settings.length > 0);
  }, [searchQuery]);

  // If search active, show all matching results; else show active section
  const visibleSections = searchQuery.trim()
    ? filteredSections
    : filteredSections.filter(s => s.id === activeSection);

  const activeIsPageSetup = activeSection === 'pageSetup' && !searchQuery.trim();

  // Count modified settings
  const modifiedCount = Object.keys(values).filter(id => isModified(id)).length;

  // Shell styles — full editor tab appearance
  const shellStyles = {
    display: 'flex', flexDirection: 'column',
    height: '100vh', width: '100vw',
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    fontFamily: "var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif)",
    fontSize: 'var(--font-size-base, 13px)', lineHeight: '1.4',
    overflow: 'hidden',
  };
  const tabBarStyles = {
    display: 'flex', alignItems: 'stretch',
    height: '36px', flexShrink: 0,
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-secondary)',
  };
  const activeTabStyles = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '0 14px', fontSize: 'var(--font-size-base)',
    color: 'var(--text-primary)', background: 'var(--bg-primary)',
    borderRight: '1px solid var(--border-secondary)',
    position: 'relative', cursor: 'default', userSelect: 'none',
  };
  const tabIndicator = {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '1px', background: 'var(--bg-primary)',
  };
  const ghostTabStyles = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '0 12px', fontSize: 'var(--font-size-base)',
    color: 'var(--text-tertiary)', cursor: 'default', userSelect: 'none',
    borderRight: '1px solid var(--border-secondary)',
  };
  const bodyStyles = {
    display: 'flex', flex: 1, overflow: 'hidden',
  };
  const contentStyles = {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minWidth: 0,
  };
  const contentInner = {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
  };
  const contentPadding = {
    maxWidth: '680px', padding: compact ? '16px 24px' : '24px 32px',
  };
  const sectionHeaderStyles = {
    fontSize: 'var(--font-size-lg)', fontWeight: 600,
    color: 'var(--text-primary)', marginBottom: compact ? '4px' : '8px',
    display: 'flex', alignItems: 'center', gap: '8px',
  };
  const sectionDescStyles = {
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
    marginBottom: compact ? '12px' : '16px', lineHeight: '1.5',
  };

  // Doctrine banner
  const doctrineBanner = {
    padding: '10px 14px', margin: '0 0 16px',
    background: 'var(--accent-gold)' + '10',
    border: '1px solid var(--accent-gold)' + '30',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
    lineHeight: '1.5',
  };

  // Status bar
  const statusBarStyles = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: '24px', flexShrink: 0,
    background: 'var(--statusbar-bg, var(--bg-tertiary))',
    borderTop: '1px solid var(--border-secondary)',
    padding: '0 12px', fontSize: '11px',
    color: 'var(--statusbar-fg, var(--text-secondary))',
  };

  // Page setup content area with side-by-side preview
  const pageSetupBodyStyles = {
    display: 'flex', gap: '0',
    flex: 1, overflow: 'hidden',
  };

  const sectionDescriptions = {
    general: 'Application-wide preferences that affect your overall experience.',
    editor: 'Writing surface configuration — fonts, spacing, and editing behavior.',
    screenplay: 'Industry formatting standards, scene numbering, and page break rules.',
    pageSetup: 'Paper dimensions, margins, headers and footers for printed output.',
    printExport: 'Export formats, branding, and output options for PDF and DOCX.',
    autosave: 'Automatic save intervals, version history, and file management.',
    appearance: 'UI chrome, layout options, and visual preferences for the workspace.',
    shortcuts: 'Keyboard shortcuts for common actions. Click a binding to rebind.',
    advanced: 'Developer tools, debug overlays, and experimental features.',
  };

  return (
    <div style={shellStyles}>
      {/* Tab bar — simulates being an editor tab */}
      <div style={tabBarStyles}>
        <div style={ghostTabStyles}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" fill="#FFC107" opacity="0.2" stroke="#FFC107" strokeWidth="1"/>
            <text x="5" y="11" fontSize="5" fontWeight="bold" fill="#FFC107" fontFamily="sans-serif">R</text>
          </svg>
          <span>The Last Light.rga</span>
        </div>
        <div style={activeTabStyles}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="2.5"/>
            <path d="M9 2v1.5M9 14.5V16M3.4 3.4l1.06 1.06M13.54 13.54l1.06 1.06M2 9h1.5M14.5 9H16M3.4 14.6l1.06-1.06M13.54 4.46l1.06-1.06"/>
          </svg>
          <span>Settings</span>
          {modifiedCount > 0 && (
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
              background: 'var(--accent-primary)', color: '#fff', fontWeight: 600,
            }}>{modifiedCount}</span>
          )}
          <span style={tabIndicator}></span>
        </div>
        <div style={{flex:1}}></div>
      </div>

      {/* Main body: nav + content + optional JSON panel */}
      <div style={bodyStyles}>
        <SettingsNav
          sections={SETTINGS_SECTIONS}
          activeId={activeSection}
          onSelect={setActiveSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Content area */}
        <div style={contentStyles}>
          {/* Doctrine banner — shown once at top */}
          {activeSection === 'general' && !searchQuery && (
            <div style={{padding: compact ? '16px 24px 0' : '24px 32px 0', maxWidth: '680px'}}>
              <div style={doctrineBanner}>
                <strong style={{color: 'var(--accent-gold)'}}>Design Doctrine:</strong>{' '}
                Flow View is a writing comfort surface. Print Preview owns page truth.
                Export follows Print Preview, not Flow. Each setting's{' '}
                <ScopeBadge scope={SCOPE.FLOW} /> <ScopeBadge scope={SCOPE.PRINT} /> <ScopeBadge scope={SCOPE.EXPORT} />{' '}
                badge indicates which surface it controls.
              </div>
            </div>
          )}

          {/* Page Setup has side-by-side layout */}
          {activeIsPageSetup && showPagePreview ? (
            <div style={pageSetupBodyStyles}>
              <div style={{flex: 1, overflowY: 'auto'}}>
                <div style={contentPadding}>
                  {visibleSections.map(section => (
                    <SettingsSection key={section.id} section={section} values={values}
                      onChange={handleChange} onReset={handleReset}
                      isModified={isModified} compact={compact}
                      description={sectionDescriptions[section.id]} />
                  ))}
                </div>
              </div>
              <div style={{
                width: '240px', minWidth: '240px', flexShrink: 0,
                borderLeft: '1px solid var(--border-secondary)',
                background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PageSetupPreview values={values} />
              </div>
            </div>
          ) : (
            <div style={contentInner}>
              <div style={contentPadding}>
                {searchQuery && (
                  <div style={{
                    fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)',
                    marginBottom: '12px',
                  }}>
                    {filteredSections.reduce((sum, s) => sum + s.settings.length, 0)} results for "{searchQuery}"
                  </div>
                )}
                {visibleSections.map(section => (
                  <SettingsSection key={section.id} section={section} values={values}
                    onChange={handleChange} onReset={handleReset}
                    isModified={isModified} compact={compact}
                    description={sectionDescriptions[section.id]} />
                ))}
                {visibleSections.length === 0 && (
                  <div style={{
                    padding: '48px 0', textAlign: 'center',
                    color: 'var(--text-tertiary)', fontSize: 'var(--font-size-base)',
                  }}>
                    No settings match your search.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* JSON Preview panel */}
        <JsonPreviewPanel values={values} visible={showJson} />
      </div>

      {/* Status bar */}
      <div style={statusBarStyles}>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <span>Settings</span>
          {modifiedCount > 0 && (
            <span style={{color: 'var(--accent-warning)'}}>
              {modifiedCount} modified
            </span>
          )}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <span>Rwanga Script Editor</span>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio label="Density" prop="density" options={[
            {value: 'comfortable', label: 'Comfortable'},
            {value: 'compact', label: 'Compact'},
          ]} />
          <TweakToggle label="JSON Preview Panel" prop="jsonPreview" />
          <TweakToggle label="Page Setup Preview" prop="pagePreview" />
        </TweakSection>
        <TweakSection label="Theme">
          <TweakRadio label="Mode" prop="themeMode" options={[
            {value: 'dark', label: 'Dark'},
            {value: 'light', label: 'Light'},
          ]} onChange={(val) => {
            setTheme(val);
          }} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function SettingsSection({ section, values, onChange, onReset, isModified, compact, description }) {
  const headerStyles = {
    fontSize: 'var(--font-size-lg)', fontWeight: 600,
    color: 'var(--text-primary)', marginBottom: '4px',
    display: 'flex', alignItems: 'center', gap: '8px',
  };
  const descStyles = {
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
    marginBottom: compact ? '8px' : '12px', lineHeight: '1.5',
  };
  return (
    <div style={{marginBottom: compact ? '20px' : '28px'}}>
      <div style={headerStyles}>{section.label}</div>
      {description && <div style={descStyles}>{description}</div>}
      <div>
        {section.settings.map(setting => (
          <SettingRow key={setting.id} setting={setting}
            value={values[setting.id]}
            onChange={(val) => onChange(setting.id, val)}
            isModified={isModified(setting.id)}
            onReset={() => onReset(setting.id)}
            compact={compact} />
        ))}
      </div>
    </div>
  );
}

window.SettingsApp = SettingsApp;
