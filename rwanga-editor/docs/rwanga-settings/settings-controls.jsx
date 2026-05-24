/*
 * settings-controls.jsx — Form control components for Settings UI
 * Each control renders with label, helper text, scope badge, and reset
 */

// ── Scope Badge ──
function ScopeBadge({ scope }) {
  const meta = SCOPE_META[scope];
  if (!meta) return null;
  const badgeStyles = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 7px', borderRadius: '3px', fontSize: '10px',
    fontWeight: 600, letterSpacing: '0.04em', lineHeight: '16px',
    background: meta.color + '18', color: meta.color, whiteSpace: 'nowrap',
    userSelect: 'none', flexShrink: 0,
  };
  const dotStyles = {
    width: '6px', height: '6px', borderRadius: '50%',
    background: meta.color, flexShrink: 0,
  };
  return (
    <span style={badgeStyles} title={meta.desc}>
      <span style={dotStyles}></span>
      {meta.label}
    </span>
  );
}

// ── Setting Row wrapper ──
function SettingRow({ setting, value, onChange, isModified, onReset, compact }) {
  const rowStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '8px',
    padding: compact ? '10px 0' : '14px 0',
    borderBottom: '1px solid var(--border-secondary)',
    alignItems: 'start',
  };
  const labelRowStyles = {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px',
  };
  const labelStyles = {
    fontSize: 'var(--font-size-base)', fontWeight: 500,
    color: 'var(--text-primary)', lineHeight: '1.3',
  };
  const helperStyles = {
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
    lineHeight: '1.4', maxWidth: '480px',
  };
  const controlColStyles = {
    display: 'flex', alignItems: 'center', gap: '6px',
    justifyContent: 'flex-end', paddingTop: '2px',
  };
  const resetBtnStyles = {
    background: 'none', border: 'none', color: 'var(--text-tertiary)',
    fontSize: '11px', cursor: 'pointer', padding: '2px 4px',
    borderRadius: 'var(--radius-sm)', opacity: isModified ? 1 : 0,
    pointerEvents: isModified ? 'auto' : 'none',
    transition: 'opacity var(--transition-fast)',
  };

  return (
    <div style={rowStyles}>
      <div>
        <div style={labelRowStyles}>
          <span style={labelStyles}>{setting.label}</span>
          <ScopeBadge scope={setting.scope} />
        </div>
        <div style={helperStyles}>{setting.helper}</div>
      </div>
      <div style={controlColStyles}>
        <SettingControl setting={setting} value={value} onChange={onChange} />
        <button style={resetBtnStyles} onClick={onReset} title="Reset to default">↺</button>
      </div>
    </div>
  );
}

// ── Control dispatcher ──
function SettingControl({ setting, value, onChange }) {
  switch (setting.ctrl) {
    case CTRL.TOGGLE:
      return <ToggleControl value={value} onChange={onChange} />;
    case CTRL.SELECT:
      return <SelectControl options={setting.options} value={value} onChange={onChange} />;
    case CTRL.NUMBER:
      return <NumberControl value={value} onChange={onChange} min={setting.min} max={setting.max} unit={setting.unit} />;
    case CTRL.TEXT:
      return <TextControl value={value} onChange={onChange} placeholder={setting.placeholder} />;
    case CTRL.SLIDER:
      return <SliderControl value={value} onChange={onChange} min={setting.min} max={setting.max} step={setting.step} unit={setting.unit} />;
    case CTRL.RADIO:
      return <RadioControl options={setting.options} value={value} onChange={onChange} />;
    case CTRL.COLOR:
      return <ColorControl options={setting.options} value={value} onChange={onChange} />;
    case CTRL.SHORTCUT:
      return <ShortcutControl value={value} onChange={onChange} />;
    case CTRL.MARGIN_GROUP:
      return <MarginGroupControl value={value} onChange={onChange} />;
    default:
      return <span style={{color:'var(--text-tertiary)', fontSize:'12px'}}>—</span>;
  }
}

// ── Toggle ──
function ToggleControl({ value, onChange }) {
  const trackStyles = {
    width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
    background: value ? 'var(--accent-primary)' : 'var(--bg-quaternary)',
    position: 'relative', transition: 'background var(--transition-normal)',
    flexShrink: 0, border: 'none',
  };
  const thumbStyles = {
    position: 'absolute', top: '2px',
    left: value ? '18px' : '2px',
    width: '16px', height: '16px', borderRadius: '50%',
    background: '#fff', transition: 'left var(--transition-normal)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
  };
  return (
    <button style={trackStyles} onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <span style={thumbStyles}></span>
    </button>
  );
}

// ── Select dropdown ──
function SelectControl({ options, value, onChange }) {
  const selStyles = {
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    padding: '5px 28px 5px 8px', fontSize: 'var(--font-size-base)',
    cursor: 'pointer', minWidth: '160px', maxWidth: '240px',
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239e9e9e' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  };
  return (
    <select style={selStyles} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Number input ──
function NumberControl({ value, onChange, min, max, unit }) {
  const wrapStyles = {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', padding: '0 2px', overflow: 'hidden',
  };
  const inputStyles = {
    width: '56px', border: 'none', background: 'transparent',
    color: 'var(--text-primary)', fontSize: 'var(--font-size-base)',
    textAlign: 'center', padding: '5px 4px', outline: 'none',
  };
  const btnStyles = {
    background: 'none', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', padding: '4px 6px', fontSize: '14px', lineHeight: 1,
    borderRadius: 'var(--radius-sm)',
  };
  const unitStyles = {
    fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)',
    paddingRight: '6px', userSelect: 'none',
  };
  const clamp = (v) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <div style={wrapStyles}>
      <button style={btnStyles} onClick={() => onChange(clamp((value || 0) - 1))}>−</button>
      <input style={inputStyles} type="number" value={value} min={min} max={max}
        onChange={e => onChange(clamp(Number(e.target.value)))} />
      {unit && <span style={unitStyles}>{unit}</span>}
      <button style={btnStyles} onClick={() => onChange(clamp((value || 0) + 1))}>+</button>
    </div>
  );
}

// ── Text input ──
function TextControl({ value, onChange, placeholder }) {
  const inputStyles = {
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    padding: '5px 8px', fontSize: 'var(--font-size-base)',
    minWidth: '200px', maxWidth: '280px',
  };
  return (
    <input style={inputStyles} type="text" value={value || ''} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} />
  );
}

// ── Slider ──
function SliderControl({ value, onChange, min, max, step, unit }) {
  const wrapStyles = { display: 'flex', alignItems: 'center', gap: '8px' };
  const valStyles = {
    fontSize: 'var(--font-size-base)', color: 'var(--text-primary)',
    minWidth: '40px', textAlign: 'end', userSelect: 'none',
  };
  return (
    <div style={wrapStyles}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '120px', accentColor: 'var(--accent-primary)' }} />
      <span style={valStyles}>{value}{unit || ''}</span>
    </div>
  );
}

// ── Radio (segmented) ──
function RadioControl({ options, value, onChange }) {
  const wrapStyles = {
    display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden',
    border: '1px solid var(--border-primary)',
  };
  return (
    <div style={wrapStyles}>
      {options.map((o, i) => {
        const active = o.value === value;
        const btnS = {
          padding: '5px 12px', fontSize: 'var(--font-size-base)',
          background: active ? 'var(--accent-primary)' : 'var(--bg-primary)',
          color: active ? '#fff' : 'var(--text-secondary)',
          cursor: 'pointer', border: 'none', fontWeight: active ? 600 : 400,
          borderRight: i < options.length - 1 ? '1px solid var(--border-primary)' : 'none',
          transition: 'background var(--transition-fast), color var(--transition-fast)',
        };
        return <button key={o.value} style={btnS} onClick={() => onChange(o.value)}>{o.label}</button>;
      })}
    </div>
  );
}

// ── Color swatches ──
function ColorControl({ options, value, onChange }) {
  const wrapStyles = { display: 'flex', gap: '6px', alignItems: 'center' };
  return (
    <div style={wrapStyles}>
      {options.map(o => {
        const active = o.value === value;
        const swatchS = {
          width: '24px', height: '24px', borderRadius: '50%',
          background: o.value, cursor: 'pointer',
          border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
          transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
          transform: active ? 'scale(1.1)' : 'scale(1)',
        };
        return <button key={o.value} style={swatchS} onClick={() => onChange(o.value)} title={o.label}></button>;
      })}
    </div>
  );
}

// ── Shortcut display ──
function ShortcutControl({ value, onChange }) {
  const wrapStyles = {
    display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
  };
  const keyStyles = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '2px 6px', minWidth: '22px', height: '22px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
    borderRadius: '3px', fontSize: '11px', fontWeight: 500,
    color: 'var(--text-primary)', fontFamily: 'var(--font-ui, system-ui)',
  };
  const keys = (value || '').split('+');
  return (
    <div style={wrapStyles} title="Click to rebind">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          <span style={keyStyles}>{k.trim()}</span>
          {i < keys.length - 1 && <span style={{color:'var(--text-tertiary)', fontSize:'11px'}}>+</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Margin group (4 fields) ──
function MarginGroupControl({ value, onChange }) {
  const val = value || { top: 1, bottom: 1, left: 1.5, right: 1 };
  const groupStyles = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', padding: '6px 8px', minWidth: '160px',
  };
  const fieldStyles = {
    display: 'flex', alignItems: 'center', gap: '4px',
  };
  const labelS = {
    fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '32px',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };
  const inputS = {
    width: '48px', border: '1px solid var(--border-secondary)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '12px', padding: '3px 4px',
    textAlign: 'center',
  };
  const update = (key, v) => onChange({ ...val, [key]: parseFloat(v) || 0 });
  return (
    <div style={groupStyles}>
      {['top', 'right', 'bottom', 'left'].map(k => (
        <div key={k} style={fieldStyles}>
          <span style={labelS}>{k}</span>
          <input style={inputS} type="number" step="0.1" min="0" max="3"
            value={val[k]} onChange={e => update(k, e.target.value)} />
          <span style={{fontSize:'10px', color:'var(--text-tertiary)'}}>in</span>
        </div>
      ))}
    </div>
  );
}

window.ScopeBadge = ScopeBadge;
window.SettingRow = SettingRow;
window.SettingControl = SettingControl;
