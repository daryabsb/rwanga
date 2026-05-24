/*
 * settings-nav.jsx — Left navigation sidebar for Settings sections
 */

const NAV_ICONS = {
  settings: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5"/>
      <path d="M9 2v1.5M9 14.5V16M3.4 3.4l1.06 1.06M13.54 13.54l1.06 1.06M2 9h1.5M14.5 9H16M3.4 14.6l1.06-1.06M13.54 4.46l1.06-1.06"/>
    </svg>
  ),
  editor: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="14" height="14" rx="1.5"/>
      <path d="M5 6h8M5 9h6M5 12h4"/>
    </svg>
  ),
  screenplay: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h7l3 3v10a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 013 15V3.5A1.5 1.5 0 014.5 2z"/>
      <path d="M11 2v3.5h3"/>
      <path d="M6 8h6M7 11h4"/>
    </svg>
  ),
  page: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1.5" width="12" height="15" rx="1"/>
      <path d="M6 5h6M6 8h6M6 11h3"/>
      <path d="M3 13.5h12"/>
    </svg>
  ),
  export: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v9M6 8l3 3 3-3"/>
      <path d="M3 12v3a1 1 0 001 1h10a1 1 0 001-1v-3"/>
    </svg>
  ),
  autosave: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6.5"/>
      <path d="M9 5.5V9l2.5 1.5"/>
    </svg>
  ),
  appearance: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7"/>
      <path d="M9 2v14" strokeDasharray="2 2"/>
      <path d="M9 2a7 7 0 010 14" fill="currentColor" opacity="0.15"/>
    </svg>
  ),
  keyboard: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="4" width="15" height="10" rx="1.5"/>
      <path d="M5 8h1M8.5 8h1M12 8h1M6 11h6"/>
    </svg>
  ),
  advanced: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v12M9 3v12M13 3v12"/>
      <circle cx="5" cy="7" r="2" fill="var(--bg-tertiary)"/>
      <circle cx="9" cy="11" r="2" fill="var(--bg-tertiary)"/>
      <circle cx="13" cy="5" r="2" fill="var(--bg-tertiary)"/>
    </svg>
  ),
};

function SettingsNav({ sections, activeId, onSelect, searchQuery, onSearchChange }) {
  const navStyles = {
    width: '220px', minWidth: '220px', flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-secondary)',
    display: 'flex', flexDirection: 'column',
    height: '100%', overflow: 'hidden',
  };
  const headerStyles = {
    padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: '8px',
    borderBottom: '1px solid var(--border-secondary)', flexShrink: 0,
  };
  const titleStyles = {
    fontSize: 'var(--font-size-lg)', fontWeight: 600,
    color: 'var(--text-primary)', letterSpacing: '-0.01em',
  };
  const searchWrapStyles = {
    padding: '8px 12px', flexShrink: 0,
  };
  const searchStyles = {
    width: '100%', background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    padding: '6px 10px', fontSize: 'var(--font-size-sm)',
    color: 'var(--text-primary)', outline: 'none',
  };
  const listStyles = {
    flex: 1, overflowY: 'auto', padding: '4px 0',
  };

  return (
    <nav style={navStyles}>
      <div style={headerStyles}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="3"/>
          <path d="M11 2v2M11 18v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M2 11h2M18 11h2M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42"/>
        </svg>
        <span style={titleStyles}>Settings</span>
      </div>
      <div style={searchWrapStyles}>
        <input style={searchStyles} type="text" placeholder="Search settings..."
          value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={listStyles}>
        {sections.map(section => (
          <NavItem key={section.id} section={section} active={section.id === activeId}
            onClick={() => onSelect(section.id)} />
        ))}
      </div>
      <div style={{padding: '12px 16px', borderTop: '1px solid var(--border-secondary)', flexShrink: 0}}>
        <div style={{display: 'flex', gap: '8px'}}>
          <button style={{
            flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-sm)',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', transition: 'background var(--transition-fast)',
          }}>Reset All</button>
          <button style={{
            flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-sm)',
            background: 'var(--accent-primary)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', fontWeight: 500,
          }}>Save</button>
        </div>
      </div>
    </nav>
  );
}

function NavItem({ section, active, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  const itemStyles = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 16px', cursor: 'pointer',
    background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-base)', fontWeight: active ? 500 : 400,
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    userSelect: 'none',
  };
  const iconStyles = {
    width: '18px', height: '18px', flexShrink: 0,
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    transition: 'color var(--transition-fast)',
  };
  const countStyles = {
    marginLeft: 'auto', fontSize: '10px', color: 'var(--text-tertiary)',
    background: 'var(--bg-quaternary)', padding: '1px 6px', borderRadius: '8px',
  };

  return (
    <div style={itemStyles} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span style={iconStyles}>{NAV_ICONS[section.icon]}</span>
      <span>{section.label}</span>
      <span style={countStyles}>{section.settings.length}</span>
    </div>
  );
}

window.SettingsNav = SettingsNav;
