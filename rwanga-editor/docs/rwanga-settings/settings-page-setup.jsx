/*
 * settings-page-setup.jsx — Page Setup section with live preview
 */

function PageSetupPreview({ values }) {
  const paperSize = values['pageSetup.paperSize'] || 'letter';
  const orientation = values['pageSetup.orientation'] || 'portrait';
  const margins = values['pageSetup.margins'] || { top: 1, bottom: 1, left: 1.5, right: 1 };
  const pageNumbers = values['pageSetup.pageNumbers'] !== false;
  const pageNumPos = values['pageSetup.pageNumberPosition'] || 'top_right';
  const headerText = values['pageSetup.headerText'] || '';
  const footerText = values['pageSetup.footerText'] || '';

  // Dimensions in inches
  const dims = paperSize === 'a4'
    ? { w: 8.27, h: 11.69 }
    : { w: 8.5, h: 11 };
  const isLandscape = orientation === 'landscape';
  const pw = isLandscape ? dims.h : dims.w;
  const ph = isLandscape ? dims.w : dims.h;

  // Scale to fit preview area (max 220px wide)
  const scale = 200 / pw;
  const dispW = pw * scale;
  const dispH = ph * scale;

  const mTop = margins.top * scale;
  const mBottom = margins.bottom * scale;
  const mLeft = margins.left * scale;
  const mRight = margins.right * scale;

  const containerStyles = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '12px', padding: '16px',
  };
  const pageStyles = {
    width: dispW + 'px', height: dispH + 'px',
    background: '#ffffff', borderRadius: '2px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    position: 'relative', overflow: 'hidden',
  };
  const marginOverlay = {
    position: 'absolute',
    top: mTop + 'px', left: mLeft + 'px',
    right: mRight + 'px', bottom: mBottom + 'px',
    border: '1px dashed rgba(0,120,204,0.35)',
    borderRadius: '1px',
  };
  const lineStyles = (top) => ({
    position: 'absolute', left: mLeft + 4 + 'px', right: mRight + 4 + 'px',
    top: top + 'px', height: '2px', background: '#e0e0e0', borderRadius: '1px',
  });
  const thinLineStyles = (top) => ({
    position: 'absolute', left: mLeft + 4 + 'px',
    right: mRight + (top % 3 === 0 ? 20 : 4) + 'px',
    top: top + 'px', height: '1.5px', background: '#ececec', borderRadius: '1px',
  });

  // Generate faux text lines
  const contentTop = mTop + 12;
  const contentBottom = dispH - mBottom - 8;
  const lineSpacing = 7;
  const lines = [];
  for (let y = contentTop; y < contentBottom; y += lineSpacing) {
    lines.push(y);
  }

  // Page number position
  const pageNumStyles = {
    position: 'absolute', fontSize: '6px', color: '#999', fontFamily: 'serif',
  };
  if (pageNumPos === 'top_right') Object.assign(pageNumStyles, { top: mTop / 2 - 3 + 'px', right: mRight + 4 + 'px' });
  else if (pageNumPos === 'top_center') Object.assign(pageNumStyles, { top: mTop / 2 - 3 + 'px', left: '50%', transform: 'translateX(-50%)' });
  else if (pageNumPos === 'bottom_right') Object.assign(pageNumStyles, { bottom: mBottom / 2 - 3 + 'px', right: mRight + 4 + 'px' });
  else if (pageNumPos === 'bottom_center') Object.assign(pageNumStyles, { bottom: mBottom / 2 - 3 + 'px', left: '50%', transform: 'translateX(-50%)' });

  const headerStyles = {
    position: 'absolute', top: mTop / 2 - 3 + 'px', left: mLeft + 4 + 'px',
    fontSize: '5px', color: '#bbb', fontFamily: 'sans-serif',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  };
  const footerStyles = {
    position: 'absolute', bottom: mBottom / 2 - 3 + 'px', left: mLeft + 4 + 'px',
    fontSize: '5px', color: '#bbb', fontFamily: 'sans-serif',
  };

  const dimLabelStyles = {
    fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center',
    fontFamily: 'var(--font-ui, system-ui)',
  };

  return (
    <div style={containerStyles}>
      <div style={{fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>
        Page Preview
      </div>
      <div style={pageStyles}>
        <div style={marginOverlay}></div>
        {/* Faux text lines */}
        {lines.slice(0, 3).map((y, i) => <div key={'b'+i} style={lineStyles(y)}></div>)}
        {lines.slice(3).map((y, i) => <div key={'t'+i} style={thinLineStyles(y)}></div>)}
        {/* Page number */}
        {pageNumbers && <span style={pageNumStyles}>1.</span>}
        {/* Header / footer */}
        {headerText && <span style={headerStyles}>{headerText.slice(0, 20)}</span>}
        {footerText && <span style={footerStyles}>{footerText.slice(0, 20)}</span>}
        {/* Margin labels */}
        <div style={{position:'absolute',top:'2px',left:'50%',transform:'translateX(-50%)',fontSize:'5px',color:'rgba(0,120,204,0.5)'}}>
          {margins.top}"
        </div>
        <div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',fontSize:'5px',color:'rgba(0,120,204,0.5)'}}>
          {margins.bottom}"
        </div>
        <div style={{position:'absolute',left:'2px',top:'50%',transform:'translateY(-50%) rotate(-90deg)',fontSize:'5px',color:'rgba(0,120,204,0.5)'}}>
          {margins.left}"
        </div>
        <div style={{position:'absolute',right:'2px',top:'50%',transform:'translateY(-50%) rotate(90deg)',fontSize:'5px',color:'rgba(0,120,204,0.5)'}}>
          {margins.right}"
        </div>
      </div>
      <div style={dimLabelStyles}>
        {paperSize === 'a4' ? 'A4' : 'Letter'} · {isLandscape ? 'Landscape' : 'Portrait'}
        <br/>{pw}" × {ph}"
      </div>
    </div>
  );
}

window.PageSetupPreview = PageSetupPreview;
