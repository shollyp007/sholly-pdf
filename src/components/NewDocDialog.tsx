import { useState } from 'react';
import { PAGE_SIZES, type PageSize, type PageOrientation } from '../types';
import { useEditorStore } from '../store/editorStore';

export default function NewDocDialog({ onClose }: { onClose: () => void }) {
  const { newDocument } = useEditorStore();
  const [size, setSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [customW, setCustomW] = useState(612);
  const [customH, setCustomH] = useState(792);

  function create() {
    newDocument(size, orientation, size === 'custom' ? customW : undefined, size === 'custom' ? customH : undefined);
    onClose();
  }

  const preview = (() => {
    const base = PAGE_SIZES[size];
    let w = size === 'custom' ? customW : base.width;
    let h = size === 'custom' ? customH : base.height;
    if (orientation === 'landscape') [w, h] = [h, w];
    const maxD = 116;
    const sc = maxD / Math.max(w, h);
    return { w: Math.round(w * sc), h: Math.round(h * sc), pw: Math.round(w), ph: Math.round(h) };
  })();

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card slide-in" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <div className="dialog-title">New Document</div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Page preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ position: 'relative' }}>
              {/* Shadow */}
              <div style={{ position: 'absolute', top: 4, left: 4, width: preview.w, height: preview.h, borderRadius: 3, background: 'rgba(0,0,0,0.4)', filter: 'blur(6px)' }} />
              <div style={{
                position: 'relative', width: preview.w, height: preview.h,
                background: 'linear-gradient(160deg, #ffffff 0%, #f0f2f8 100%)',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 6,
              }}>
                <div style={{ width: '60%', height: 2, borderRadius: 2, background: '#d0d4de' }} />
                <div style={{ width: '75%', height: 2, borderRadius: 2, background: '#d0d4de' }} />
                <div style={{ width: '55%', height: 2, borderRadius: 2, background: '#d0d4de' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.3 }}>{preview.pw} × {preview.ph} pt</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Size */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 7, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>Page Size</div>
              <select className="sp-select" value={size} onChange={(e) => setSize(e.target.value as PageSize)} style={{ width: '100%', maxWidth: '100%' }}>
                {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {size === 'custom' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>Width (pt)</div>
                  <input type="number" className="sp-input" value={customW} min={72} max={5000}
                    onChange={(e) => setCustomW(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>Height (pt)</div>
                  <input type="number" className="sp-input" value={customH} min={72} max={5000}
                    onChange={(e) => setCustomH(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {/* Orientation */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 7, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>Orientation</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['portrait', 'landscape'] as const).map((o) => (
                  <button key={o} onClick={() => setOrientation(o)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 10px',
                      borderRadius: 9, border: '1px solid', cursor: 'pointer', transition: 'all 0.13s',
                      borderColor: orientation === o ? 'rgba(79,123,255,0.5)' : 'var(--border)',
                      background: orientation === o ? 'rgba(79,123,255,0.1)' : 'var(--panel2)',
                      color: orientation === o ? '#93c5fd' : 'var(--text)', fontSize: 12, fontWeight: 500,
                    }}>
                    <span style={{ fontSize: 20, opacity: 0.85 }}>{o === 'portrait' ? '▯' : '▭'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{o}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="sp-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="sp-btn sp-btn-primary" style={{ flex: 1 }} onClick={create}>Create Document</button>
        </div>
      </div>
    </div>
  );
}
