import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { useEditorStore, generateId } from '../store/editorStore';
import { FONT_CATEGORIES, ALL_FONTS } from '../lib/fonts';

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '14px 0 8px',
      borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 10,
    }}>
      <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>
      <span style={{
        fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1.1, color: 'var(--text-dim)',
      }}>{title}</span>
    </div>
  );
}

function PropRow({ label, children, vertical = false }: { label: string; children: ReactNode; vertical?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      alignItems: vertical ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: vertical ? 6 : 8,
      marginBottom: 10,
    }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-dim)', flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: vertical ? 'wrap' : 'nowrap' }}>
        {children}
      </div>
    </div>
  );
}

function SliderRow({ label, min, max, step = 1, value, onChange, format }: {
  label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: 10, color: 'var(--text)', background: 'var(--panel3, #1e2535)',
          padding: '1px 7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.07)',
          minWidth: 36, textAlign: 'center',
        }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
    </div>
  );
}

const PALETTE = [
  '#000000', '#374151', '#6b7280', '#ffffff',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

function ColorGrid({ value, onChange, showNone = false, noneActive = false, onNone }: {
  value: string; onChange: (c: string) => void;
  showNone?: boolean; noneActive?: boolean; onNone?: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 6 }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: '100%', aspectRatio: '1', borderRadius: 5, cursor: 'pointer',
              background: c,
              border: value === c && !noneActive ? '2px solid #60a5fa' : '1.5px solid rgba(255,255,255,0.12)',
              boxShadow: value === c && !noneActive ? '0 0 0 1px rgba(96,165,250,0.4)' : 'none',
              transition: 'border 0.1s, box-shadow 0.1s',
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flex: 1,
          background: 'var(--panel3, #1e2535)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, padding: '4px 8px', fontSize: 10.5, color: 'var(--text-dim)',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 3, background: value,
            border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
            display: 'inline-block',
          }} />
          Custom
          <input type="color" value={value.startsWith('#') ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          />
          <input type="color" value={value.startsWith('#') ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 20, height: 20, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0, background: 'none', marginLeft: 'auto' }} />
        </label>
        {showNone && (
          <button
            onClick={onNone}
            title="No fill"
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid',
              borderColor: noneActive ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
              background: noneActive ? 'rgba(239,68,68,0.12)' : 'var(--panel3, #1e2535)',
              color: noneActive ? '#f87171' : 'var(--text-dim)',
              fontSize: 10.5, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.1s',
            }}>
            ✕ None
          </button>
        )}
      </div>
    </div>
  );
}

function StyleToggle({ label, active, onClick, style }: {
  label: string; active: boolean; onClick: () => void; style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 12,
        cursor: 'pointer', transition: 'all 0.12s',
        borderColor: active ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)',
        background: active ? 'rgba(96,165,250,0.15)' : 'var(--panel3, #1e2535)',
        color: active ? '#60a5fa' : 'var(--text-dim)',
        ...style,
      }}>
      {label}
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function PropertiesPanel() {
  const {
    annotations, selectedIds, pages, currentPageId,
    updateAnnotation,
    watermarkText, setWatermarkText,
    watermarkOpacity, setWatermarkOpacity,
    watermarkSize, setWatermarkSize,
    addAnnotation,
  } = useEditorStore();

  const [watermarkOpen, setWatermarkOpen] = useState(false);

  const selected = selectedIds.length === 1 ? annotations.find((a) => a.id === selectedIds[0]) : null;
  const currentPage = pages.find((p) => p.id === currentPageId);

  function applyWatermark() {
    for (const page of pages) {
      const cw = page.pdfWidth * 1.2;
      const ch = page.pdfHeight * 1.2;
      addAnnotation({
        id: generateId(), type: 'text', pageId: page.id,
        x: cw * 0.1, y: ch * 0.35,
        content: watermarkText, fontSize: watermarkSize,
        color: `rgba(80,80,80,${Math.round(watermarkOpacity * 255).toString(16).padStart(2, '0')})`,
        fontFamily: 'Arial', fontStack: 'Arial, sans-serif',
        bold: true, italic: false, underline: false, align: 'left',
      });
    }
  }

  return (
    <div style={{
      width: 230, flexShrink: 0,
      background: 'var(--panel)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '0 14px 20px', minHeight: 0 }}>

        {/* ── Document info ── */}
        <SectionHeader icon="📄" title="Document" />
        <div style={{
          background: 'var(--panel2)', borderRadius: 8, padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.05)', marginBottom: 4,
        }}>
          {currentPage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Page size</span>
              <span style={{ fontSize: 10.5, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(currentPage.pdfWidth)} × {Math.round(currentPage.pdfHeight)} pt
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Pages</span>
            <span style={{
              fontSize: 10.5, color: '#60a5fa', background: 'rgba(96,165,250,0.1)',
              padding: '0 6px', borderRadius: 4,
            }}>{pages.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Annotations</span>
            <span style={{
              fontSize: 10.5, color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
              padding: '0 6px', borderRadius: 4,
            }}>{annotations.length}</span>
          </div>
        </div>

        {/* ── Selected annotation ── */}
        {selected ? (
          <>
            <SectionHeader icon="✏" title={`${selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}`} />

            {/* Rectangle / Ellipse */}
            {(selected.type === 'rectangle' || selected.type === 'ellipse') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Stroke */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 7 }}>Stroke color</div>
                  <ColorGrid
                    value={selected.strokeColor}
                    onChange={(c) => updateAnnotation(selected.id, { strokeColor: c } as any)}
                  />
                </div>
                <SliderRow
                  label="Stroke width" min={1} max={20} value={selected.strokeWidth}
                  onChange={(v) => updateAnnotation(selected.id, { strokeWidth: v } as any)}
                  format={(v) => `${v}px`}
                />
                {selected.type === 'rectangle' && (
                  <SliderRow
                    label="Corner radius" min={0} max={50} value={selected.radius}
                    onChange={(v) => updateAnnotation(selected.id, { radius: v } as any)}
                    format={(v) => `${v}px`}
                  />
                )}

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0 12px' }} />

                {/* Fill */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>Fill color</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Enabled</span>
                      <div
                        onClick={() => updateAnnotation(selected.id, { filled: !selected.filled } as any)}
                        style={{
                          width: 30, height: 16, borderRadius: 8, cursor: 'pointer',
                          background: selected.filled ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                        <div style={{
                          position: 'absolute', top: 1, left: selected.filled ? 13 : 1,
                          width: 12, height: 12, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </div>
                    </label>
                  </div>
                  <ColorGrid
                    value={selected.fillColor}
                    onChange={(c) => updateAnnotation(selected.id, { fillColor: c, filled: true } as any)}
                    showNone
                    noneActive={!selected.filled}
                    onNone={() => updateAnnotation(selected.id, { filled: false } as any)}
                  />
                </div>

                <SliderRow
                  label="Fill opacity" min={0.05} max={1} step={0.05}
                  value={(selected as any).opacity ?? 1}
                  onChange={(v) => updateAnnotation(selected.id, { opacity: v } as any)}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </div>
            )}

            {/* Line / Arrow / Draw / Underline / Strikethrough */}
            {(selected.type === 'line' || selected.type === 'arrow' || selected.type === 'draw' ||
              selected.type === 'underline' || selected.type === 'strikethrough') && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 7 }}>Color</div>
                  <ColorGrid
                    value={selected.color}
                    onChange={(c) => updateAnnotation(selected.id, { color: c } as any)}
                  />
                </div>
                {'strokeWidth' in selected && (
                  <SliderRow
                    label="Stroke width" min={1} max={20} value={(selected as any).strokeWidth}
                    onChange={(v) => updateAnnotation(selected.id, { strokeWidth: v } as any)}
                    format={(v) => `${v}px`}
                  />
                )}
                {'opacity' in selected && (
                  <SliderRow
                    label="Opacity" min={0.05} max={1} step={0.05}
                    value={(selected as any).opacity ?? 1}
                    onChange={(v) => updateAnnotation(selected.id, { opacity: v } as any)}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                )}
              </div>
            )}

            {/* Highlight */}
            {selected.type === 'highlight' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 7 }}>Highlight color</div>
                  <ColorGrid
                    value={selected.color}
                    onChange={(c) => updateAnnotation(selected.id, { color: c } as any)}
                  />
                </div>
                <SliderRow
                  label="Opacity" min={0.05} max={1} step={0.05} value={selected.opacity}
                  onChange={(v) => updateAnnotation(selected.id, { opacity: v } as any)}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </div>
            )}

            {/* Text */}
            {selected.type === 'text' && (
              <div>
                <PropRow label="Font" vertical>
                  <select className="sp-select" value={selected.fontFamily}
                    onChange={(e) => {
                      const name = e.target.value;
                      const font = ALL_FONTS.find((f) => f.name === name);
                      updateAnnotation(selected.id, { fontFamily: name, fontStack: font?.stack ?? name } as any);
                    }}
                    style={{ width: '100%', fontFamily: selected.fontFamily }}>
                    {Object.entries(FONT_CATEGORIES).map(([cat, fonts]) => (
                      <optgroup key={cat} label={cat}>
                        {fonts.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </PropRow>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 4 }}>Size</div>
                    <input type="number" value={selected.fontSize} min={6} max={400} className="sp-input"
                      style={{ width: '100%' }}
                      onChange={(e) => updateAnnotation(selected.id, { fontSize: Number(e.target.value) } as any)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 4 }}>Style</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <StyleToggle label="B" active={selected.bold} onClick={() => updateAnnotation(selected.id, { bold: !selected.bold } as any)} style={{ fontWeight: 'bold', flex: 1, padding: '4px 0' }} />
                      <StyleToggle label="I" active={selected.italic} onClick={() => updateAnnotation(selected.id, { italic: !selected.italic } as any)} style={{ fontStyle: 'italic', flex: 1, padding: '4px 0' }} />
                      <StyleToggle label="U" active={selected.underline} onClick={() => updateAnnotation(selected.id, { underline: !selected.underline } as any)} style={{ textDecoration: 'underline', flex: 1, padding: '4px 0' }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 7 }}>Text color</div>
                  <ColorGrid
                    value={selected.color}
                    onChange={(c) => updateAnnotation(selected.id, { color: c } as any)}
                  />
                </div>
              </div>
            )}

            {/* Image */}
            {selected.type === 'image' && (
              <SliderRow
                label="Opacity" min={0.1} max={1} step={0.05}
                value={(selected as any).opacity ?? 1}
                onChange={(v) => updateAnnotation(selected.id, { opacity: v } as any)}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            )}

            {/* Stamp */}
            {selected.type === 'stamp' && (
              <div>
                <PropRow label="Text">
                  <input className="sp-input" value={selected.text} style={{ flex: 1 }}
                    onChange={(e) => updateAnnotation(selected.id, { text: e.target.value } as any)} />
                </PropRow>
                <SliderRow
                  label="Rotation" min={-45} max={45} value={selected.rotation}
                  onChange={(v) => updateAnnotation(selected.id, { rotation: v } as any)}
                  format={(v) => `${v}°`}
                />
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 7 }}>Color</div>
                  <ColorGrid
                    value={selected.color}
                    onChange={(c) => updateAnnotation(selected.id, { color: c, borderColor: c } as any)}
                  />
                </div>
              </div>
            )}

            {/* Sticky */}
            {selected.type === 'sticky' && (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 8 }}>Note color</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { color: '#fef08a', label: 'Yellow' },
                      { color: '#bbf7d0', label: 'Green' },
                      { color: '#bfdbfe', label: 'Blue' },
                      { color: '#fecaca', label: 'Red' },
                    ].map(({ color, label }) => (
                      <button
                        key={color}
                        onClick={() => updateAnnotation(selected.id, { color } as any)}
                        title={label}
                        style={{
                          width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                          background: color, border: selected.color === color
                            ? '2.5px solid #60a5fa'
                            : '1.5px solid rgba(255,255,255,0.15)',
                          boxShadow: selected.color === color ? '0 0 0 1px rgba(96,165,250,0.4)' : 'none',
                          transition: 'all 0.1s',
                        }} />
                    ))}
                  </div>
                </div>
                <PropRow label="Author">
                  <input className="sp-input" value={selected.author} style={{ flex: 1 }}
                    onChange={(e) => updateAnnotation(selected.id, { author: e.target.value } as any)} />
                </PropRow>
              </div>
            )}

            {/* Redact */}
            {selected.type === 'redact' && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
              }}>
                Redacted area — content will be permanently blacked out when exported.
              </div>
            )}
          </>
        ) : (
          <div style={{
            marginTop: 4, background: 'var(--panel2)', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)', padding: '16px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, opacity: 0.3, marginBottom: 8 }}>↖</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Select an annotation to<br />edit its properties
            </div>
          </div>
        )}

        {/* ── Watermark ── */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setWatermarkOpen((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--panel2)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer', transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,123,255,0.3)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
              <span style={{ opacity: 0.7 }}>≋</span> Watermark
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: watermarkOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>

          {watermarkOpen && (
            <div style={{
              background: 'var(--panel2)', border: '1px solid rgba(255,255,255,0.07)',
              borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px',
            }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 4 }}>Text</div>
                <input className="sp-input" value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  style={{ width: '100%' }} placeholder="CONFIDENTIAL" />
              </div>
              <SliderRow
                label="Opacity" min={0.03} max={0.5} step={0.01} value={watermarkOpacity}
                onChange={setWatermarkOpacity}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <SliderRow
                label="Size" min={20} max={120} value={watermarkSize}
                onChange={setWatermarkSize}
                format={(v) => `${v}pt`}
              />
              <button className="sp-btn sp-btn-primary" style={{ width: '100%', marginTop: 4, fontSize: 11 }} onClick={applyWatermark}>
                Apply to All Pages
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
