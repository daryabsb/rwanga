/*
 * settings-json.jsx — JSON Preview panel and Advanced section
 */

function JsonPreviewPanel({ values, visible }) {
  if (!visible) return null;
  
  const json = buildSettingsJson(values);
  const jsonStr = JSON.stringify(json, null, 2);
  
  const panelStyles = {
    width: '320px', minWidth: '320px', flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-secondary)',
    display: 'flex', flexDirection: 'column',
    height: '100%', overflow: 'hidden',
  };
  const headerStyles = {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-secondary)',
    flexShrink: 0,
  };
  const titleStyles = {
    fontSize: 'var(--font-size-sm)', fontWeight: 600,
    color: 'var(--text-secondary)', textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };
  const codeStyles = {
    flex: 1, overflow: 'auto', padding: '12px 16px', margin: 0,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: '11px', lineHeight: '1.5',
    color: 'var(--text-primary)', background: 'transparent',
    whiteSpace: 'pre', tabSize: 2,
  };
  const badgeStyles = {
    fontSize: '10px', padding: '2px 6px', borderRadius: '3px',
    background: 'var(--bg-quaternary)', color: 'var(--text-tertiary)',
  };

  return (
    <aside style={panelStyles}>
      <div style={headerStyles}>
        <span style={titleStyles}>JSON Preview</span>
        <span style={badgeStyles}>Read-only</span>
      </div>
      <pre style={codeStyles}>
        <JsonSyntax json={jsonStr} />
      </pre>
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--border-secondary)',
        flexShrink: 0,
      }}>
        <button style={{
          width: '100%', padding: '5px 10px', fontSize: 'var(--font-size-sm)',
          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }} onClick={() => {
          navigator.clipboard?.writeText(jsonStr);
        }}>Copy JSON</button>
      </div>
    </aside>
  );
}

// Simple JSON syntax highlighting
function JsonSyntax({ json }) {
  const lines = json.split('\n');
  return lines.map((line, i) => {
    const highlighted = line
      .replace(/"([^"]+)":/g, (m, key) => `<span style="color:var(--tag-character)">"${key}"</span>:`)
      .replace(/: "([^"]*)"/g, (m, val) => `: <span style="color:var(--accent-success)">"${val}"</span>`)
      .replace(/: (true|false)/g, (m, val) => `: <span style="color:var(--accent-warning)">${val}</span>`)
      .replace(/: (\d+\.?\d*)/g, (m, val) => `: <span style="color:var(--tag-music)">${val}</span>`);
    return <div key={i} dangerouslySetInnerHTML={{__html: highlighted}} />;
  });
}

window.JsonPreviewPanel = JsonPreviewPanel;
