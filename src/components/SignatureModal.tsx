import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

const CANVAS_W = 440;
const CANVAS_H = 180;

export default function SignatureModal({ onInsert, onClose }: Props) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedText, setTypedText] = useState('');
  const [typedFont, setTypedFont] = useState('cursive');
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;
    initCanvas(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initCanvas(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(16, CANVAS_H * 0.7);
    ctx.lineTo(CANVAS_W - 16, CANVAS_H * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onCanvasDown(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  }

  function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPosRef.current || !ctxRef.current) return;
    const ctx = ctxRef.current;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPosRef.current = pos;
    setHasDrawing(true);
  }

  function onCanvasUp() {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }

  function clearCanvas() {
    if (!ctxRef.current) return;
    initCanvas(ctxRef.current);
    setHasDrawing(false);
  }

  function handleUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setUploadDataUrl(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function handleInsert() {
    if (tab === 'draw') {
      onInsert(canvasRef.current!.toDataURL('image/png'));
    } else if (tab === 'type' && typedText.trim()) {
      const off = document.createElement('canvas');
      off.width = Math.round(CANVAS_W * dpr);
      off.height = Math.round(120 * dpr);
      const ctx = off.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CANVAS_W, 120);
      ctx.font = `70px ${typedFont}`;
      ctx.fillStyle = '#111';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(typedText, CANVAS_W / 2, 65);
      onInsert(off.toDataURL('image/png'));
    } else if (tab === 'upload' && uploadDataUrl) {
      onInsert(uploadDataUrl);
    }
  }

  const canInsert =
    (tab === 'draw' && hasDrawing) ||
    (tab === 'type' && typedText.trim().length > 0) ||
    (tab === 'upload' && !!uploadDataUrl);

  const TABS = [
    { id: 'draw' as const, label: '✍ Draw' },
    { id: 'type' as const, label: 'Aa Type' },
    { id: 'upload' as const, label: '⬆ Upload' },
  ];

  const FONTS = [
    { label: 'Script', stack: 'cursive' },
    { label: 'Serif', stack: 'Georgia, serif' },
    { label: 'Sans', stack: 'Arial, sans-serif' },
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border-light)',
        borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        width: 500, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-bright)' }}>Add Signature</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '12px 20px 0', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '7px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 500,
                color: tab === t.id ? 'var(--text-bright)' : 'var(--text-dim)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.12s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px' }}>
          {tab === 'draw' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Draw your signature</span>
                <button onClick={clearCanvas}
                  style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-light)', borderRadius: 5, cursor: 'pointer', padding: '2px 10px' }}>
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                onMouseDown={onCanvasDown}
                onMouseMove={onCanvasMove}
                onMouseUp={onCanvasUp}
                onMouseLeave={onCanvasUp}
                style={{
                  display: 'block', width: '100%', height: CANVAS_H,
                  borderRadius: 8, cursor: 'crosshair',
                  border: '1px solid var(--border-light)', background: '#fff',
                  userSelect: 'none', touchAction: 'none',
                }}
              />
            </div>
          )}

          {tab === 'type' && (
            <div>
              <input
                autoFocus
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Type your name…"
                className="sp-input"
                style={{ width: '100%', marginBottom: 12, fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {FONTS.map((f) => (
                  <button key={f.stack} onClick={() => setTypedFont(f.stack)}
                    style={{
                      fontSize: 11, padding: '4px 12px', cursor: 'pointer', borderRadius: 5,
                      border: typedFont === f.stack ? '1px solid rgba(10,132,255,0.6)' : '1px solid var(--border-light)',
                      background: typedFont === f.stack ? 'rgba(10,132,255,0.1)' : 'var(--panel2)',
                      color: typedFont === f.stack ? 'var(--accent-hover)' : 'var(--text-dim)',
                      fontFamily: f.stack, transition: 'all 0.12s',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{
                height: 110, borderRadius: 8, background: '#fff',
                border: '1px solid var(--border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {typedText ? (
                  <span style={{ fontSize: 52, fontFamily: typedFont, color: '#111', userSelect: 'none' }}>
                    {typedText}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: '#bbb', fontFamily: 'system-ui' }}>
                    Your signature preview
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div>
              {uploadDataUrl ? (
                <div>
                  <div style={{
                    height: CANVAS_H, borderRadius: 8, background: '#fff',
                    border: '1px solid var(--border-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                  }}>
                    <img src={uploadDataUrl} alt="Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <button onClick={handleUpload}
                    style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-light)', borderRadius: 5, cursor: 'pointer', padding: '3px 12px' }}>
                    Change Image
                  </button>
                </div>
              ) : (
                <div
                  onClick={handleUpload}
                  style={{
                    height: CANVAS_H, borderRadius: 8,
                    border: '2px dashed var(--border-light)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', gap: 10, color: 'var(--text-dim)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(10,132,255,0.5)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
                >
                  <span style={{ fontSize: 28, opacity: 0.5 }}>⬆</span>
                  <span style={{ fontSize: 12 }}>Click to upload a signature image</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>PNG, JPG, GIF supported</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 20px 18px' }}>
          <button onClick={onClose} className="sp-btn" style={{ fontSize: 12.5 }}>Cancel</button>
          <button
            onClick={handleInsert}
            disabled={!canInsert}
            className="sp-btn sp-btn-primary"
            style={{ fontSize: 12.5, opacity: canInsert ? 1 : 0.4, cursor: canInsert ? 'pointer' : 'default' }}>
            Insert Signature
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
