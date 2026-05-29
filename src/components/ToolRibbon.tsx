import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types';
import { FONT_CATEGORIES, ALL_FONTS } from '../lib/fonts';

// ─── Stamp presets ─────────────────────────────────────────────────────────────
const STAMPS = [
  { text: 'APPROVED',     color: '#16a34a' },
  { text: 'REJECTED',     color: '#dc2626' },
  { text: 'DRAFT',        color: '#d97706' },
  { text: 'CONFIDENTIAL', color: '#7c3aed' },
  { text: 'FINAL',        color: '#0284c7' },
  { text: 'VOID',         color: '#6b7280' },
  { text: 'PAID',         color: '#059669' },
  { text: 'NOT APPROVED', color: '#dc2626' },
];

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#99f6e4', '#fbcfe8'];
const STROKE_COLORS = ['#000000', '#ffffff', '#1e3a5f', '#e11d48', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#6b7280'];

// ─── Shared dropdown panel style ──────────────────────────────────────────────
const COLOR_PANEL_STYLE: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
  background: 'var(--panel2)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, padding: '10px',
  boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
  zIndex: 300, minWidth: 140,
};

// ─── Color picker dropdown (portal — avoids toolbar overflow clipping) ────────
function ColorPickerDropdown({
  label, value, colors, onChange, showCustom = false, showOpacity = false,
  opacity, onOpacity, noneActive = false, showNone = false, onNone,
}: {
  label: string; value: string; colors: string[]; onChange: (c: string) => void;
  showCustom?: boolean; showOpacity?: boolean; opacity?: number; onOpacity?: (v: number) => void;
  noneActive?: boolean; showNone?: boolean; onNone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // keep panel on screen horizontally
      const panelW = 168;
      const left = Math.min(r.left, window.innerWidth - panelW - 8);
      setPos({ top: r.bottom + 4, left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const panel = open ? createPortal(
    <div ref={panelRef} style={{ ...COLOR_PANEL_STYLE, position: 'fixed', top: pos.top, left: pos.left, minWidth: 160 }}>
      {showNone && (
        <div
          onClick={() => { onNone?.(); setOpen(false); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginBottom: 8,
            padding: '3px 8px', borderRadius: 5,
            border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)',
            color: '#f87171', fontSize: 10, transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
          title="No fill"
        >✕ No Fill</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
        {colors.map((c) => (
          <div
            key={c}
            onClick={() => { onChange(c); setOpen(false); }}
            style={{
              width: 20, height: 20, borderRadius: 5, background: c, cursor: 'pointer',
              border: value === c ? '2px solid var(--accent-hover)' : '1px solid rgba(255,255,255,0.18)',
              boxSizing: 'border-box', transition: 'transform 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
          />
        ))}
      </div>
      {showCustom && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Custom</span>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ width: 32, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
        </div>
      )}
      {showOpacity && opacity !== undefined && onOpacity && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Opacity</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(opacity * 100)}%</span>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <button
        ref={btnRef}
        onClick={toggle}
        title={label}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          background: open ? 'rgba(255,255,255,0.07)' : 'transparent',
          border: '1px solid ' + (open ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'),
          borderRadius: 6, padding: '4px 7px', cursor: 'pointer', minWidth: 36,
          transition: 'all 0.12s',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {noneActive ? (
            <div style={{
              width: 22, height: 10, borderRadius: 3, position: 'relative',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundImage: 'repeating-linear-gradient(45deg, #555 0px, #555 2px, transparent 2px, transparent 8px)',
              backgroundColor: '#1a1a1a',
            }}>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 8, lineHeight: 1 }}>✕</span>
            </div>
          ) : (
            <div style={{ width: 22, height: 10, borderRadius: 3, background: value, border: '1px solid rgba(255,255,255,0.25)' }} />
          )}
          <span style={{ fontSize: 7, color: 'var(--text-muted)', lineHeight: 1 }}>▼</span>
        </div>
      </button>
      {panel}
    </div>
  );
}

interface ToolBtnProps {
  id: ToolType;
  icon: string;
  label: string;
  onClick?: () => void;
}

export default function ToolRibbon() {
  const {
    activeTab, activeTool, setActiveTool,
    strokeColor, setStrokeColor,
    fillColor, setFillColor,
    highlightColor, setHighlightColor,
    strokeWidth, setStrokeWidth,
    highlightOpacity, setHighlightOpacity,
    filled, setFilled,
    stampText, setStampText, stampColor, setStampColor,
    addBlankPage, deletePage, duplicatePage, rotatePage, currentPageId,
    undo, redo,
    setShowFindBar, showFindBar,
    selectedIds, annotations, updateAnnotation,
  } = useEditorStore();

  // Apply a property update to all currently-selected text annotations.
  function applyTextUpdate(update: Record<string, unknown>) {
    selectedIds.forEach((id) => {
      const ann = annotations.find((a) => a.id === id);
      if (ann?.type === 'text') updateAnnotation(id, update as any);
    });
  }

  function ToolBtn({ id, icon, label, onClick }: ToolBtnProps) {
    return (
      <button
        className={`tool-btn ${activeTool === id ? 'active' : ''}`}
        onClick={() => { setActiveTool(id); onClick?.(); }}
        title={label}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  function ActionBtn({ icon, label, onClick, active = false }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
    return (
      <button className={`tool-btn ${active ? 'active' : ''}`} onClick={onClick} title={label}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="ribbon-group">
        <div className="ribbon-tools">{children}</div>
        <div className="ribbon-group-title">{title}</div>
      </div>
    );
  }

  // ─── Comment tab ──────────────────────────────────────────────────────────────
  if (activeTab === 'comment') return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', flexShrink: 0 }}
      className="sp-toolbar px-1">
      <Group title="Select">
        <ToolBtn id="select" icon="↖" label="Select" />
        <ToolBtn id="eraser" icon="⌫" label="Erase" />
      </Group>
      <Group title="Text">
        <ToolBtn id="text" icon="T" label="Text Box" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 4px' }}>
          <FontPicker applyTextUpdate={applyTextUpdate} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <FontSizeInput applyTextUpdate={applyTextUpdate} />
            <FormatButtons applyTextUpdate={applyTextUpdate} />
            <AlignButtons applyTextUpdate={applyTextUpdate} />
          </div>
        </div>
        <ColorPickerDropdown
          label="Color"
          value={strokeColor}
          colors={STROKE_COLORS}
          onChange={(c) => { setStrokeColor(c); applyTextUpdate({ color: c }); }}
          showCustom
        />
      </Group>
      <Group title="Comments">
        <ToolBtn id="sticky" icon="📝" label="Sticky Note" />
      </Group>
      <Group title="Text Markup">
        <ToolBtn id="highlight"     icon="▬" label="Highlight" />
        <ToolBtn id="underline"     icon="U̲" label="Underline" />
        <ToolBtn id="strikethrough" icon="S̶" label="Strike" />
        <ColorPickerDropdown
          label="Color"
          value={highlightColor}
          colors={HIGHLIGHT_COLORS}
          onChange={setHighlightColor}
          showOpacity
          opacity={highlightOpacity}
          onOpacity={setHighlightOpacity}
        />
      </Group>
      <Group title="Drawing">
        <ToolBtn id="draw" icon="✏" label="Freehand" />
        <ColorPickerDropdown
          label="Color"
          value={strokeColor}
          colors={STROKE_COLORS}
          onChange={setStrokeColor}
          showCustom
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2px 4px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Width</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="range" min={1} max={24} value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width: 58 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 16 }}>{strokeWidth}</span>
          </div>
        </div>
      </Group>
      <Group title="Shapes">
        <ToolBtn id="line"      icon="╱" label="Line" />
        <ToolBtn id="arrow"     icon="↗" label="Arrow" />
        <ToolBtn id="rectangle" icon="▭" label="Rect" />
        <ToolBtn id="ellipse"   icon="◯" label="Ellipse" />
        <ColorPickerDropdown
          label="Stroke"
          value={strokeColor}
          colors={STROKE_COLORS}
          onChange={setStrokeColor}
          showCustom
        />
        <ColorPickerDropdown
          label="Fill"
          value={fillColor}
          colors={STROKE_COLORS}
          onChange={(c) => { setFillColor(c); setFilled(true); }}
          showCustom
          showNone
          noneActive={!filled}
          onNone={() => setFilled(false)}
        />
      </Group>
    </div>
  );

  // ─── Edit tab ─────────────────────────────────────────────────────────────────
  if (activeTab === 'edit') return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', flexShrink: 0 }}
      className="sp-toolbar px-1">
      <Group title="Select">
        <ToolBtn id="select" icon="↖" label="Select" />
        <ToolBtn id="eraser" icon="⌫" label="Erase" />
      </Group>
      <Group title="Edit Content">
        <ToolBtn id="edit-text" icon="✎" label="Edit Text" />
        <div style={{ padding: '2px 4px', maxWidth: 130 }}>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>
            Click any text on the PDF to edit it
          </div>
        </div>
      </Group>
      <Group title="Add Text">
        <ToolBtn id="text" icon="T" label="Text Box" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 4px' }}>
          <FontPicker applyTextUpdate={applyTextUpdate} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <FontSizeInput applyTextUpdate={applyTextUpdate} />
            <FormatButtons applyTextUpdate={applyTextUpdate} />
            <AlignButtons applyTextUpdate={applyTextUpdate} />
          </div>
        </div>
        <ColorPickerDropdown
          label="Color"
          value={strokeColor}
          colors={STROKE_COLORS}
          onChange={(c) => { setStrokeColor(c); applyTextUpdate({ color: c }); }}
          showCustom
        />
      </Group>
      <Group title="Insert">
        <ToolBtn id="image" icon="🖼" label="Image" />
        <ToolBtn id="signature" icon="✍" label="Signature" />
      </Group>
      <Group title="Stamps">
        <ToolBtn id="stamp" icon="🔖" label="Stamp" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 4px' }}>
          <select className="sp-select" value={stampText} onChange={(e) => setStampText(e.target.value)} style={{ maxWidth: 140 }}>
            {STAMPS.map((s) => <option key={s.text} value={s.text}>{s.text}</option>)}
          </select>
          <ColorPickerDropdown
            label="Stamp Color"
            value={stampColor}
            colors={STAMPS.map((s) => s.color)}
            onChange={(c) => {
              setStampColor(c);
              const match = STAMPS.find((s) => s.color === c);
              if (match) setStampText(match.text);
            }}
          />
        </div>
      </Group>
      <Group title="Drawing">
        <ToolBtn id="draw"      icon="✏" label="Freehand" />
        <ToolBtn id="line"      icon="╱" label="Line" />
        <ToolBtn id="arrow"     icon="↗" label="Arrow" />
        <ToolBtn id="rectangle" icon="▭" label="Rect" />
        <ToolBtn id="ellipse"   icon="◯" label="Ellipse" />
        <ColorPickerDropdown
          label="Stroke"
          value={strokeColor}
          colors={STROKE_COLORS}
          onChange={setStrokeColor}
          showCustom
        />
        <ColorPickerDropdown
          label="Fill"
          value={fillColor}
          colors={STROKE_COLORS}
          onChange={(c) => { setFillColor(c); setFilled(true); }}
          showCustom
          showNone
          noneActive={!filled}
          onNone={() => setFilled(false)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2px 4px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Width</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="range" min={1} max={24} value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))} style={{ width: 52 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 16 }}>{strokeWidth}</span>
          </div>
        </div>
      </Group>
      <Group title="Redact">
        <ToolBtn id="redact" icon="⬛" label="Redact" />
      </Group>
    </div>
  );

  // ─── Pages tab ────────────────────────────────────────────────────────────────
  if (activeTab === 'pages') return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', flexShrink: 0 }}
      className="sp-toolbar px-1">
      <Group title="Insert">
        <ActionBtn icon="➕" label="Add Page" onClick={() => addBlankPage(currentPageId ?? undefined)} />
        <ActionBtn icon="⧉" label="Duplicate" onClick={() => currentPageId && duplicatePage(currentPageId)} />
      </Group>
      <Group title="Rotate">
        <ActionBtn icon="↻" label="Rotate CW" onClick={() => currentPageId && rotatePage(currentPageId, 'cw')} />
        <ActionBtn icon="↺" label="Rotate CCW" onClick={() => currentPageId && rotatePage(currentPageId, 'ccw')} />
      </Group>
      <Group title="Remove">
        <ActionBtn icon="🗑" label="Delete" onClick={() => currentPageId && deletePage(currentPageId)} />
      </Group>
      <Group title="History">
        <ActionBtn icon="↩" label="Undo" onClick={undo} active={false} />
        <ActionBtn icon="↪" label="Redo" onClick={redo} active={false} />
      </Group>
    </div>
  );

  // ─── Tools tab ────────────────────────────────────────────────────────────────
  if (activeTab === 'tools') return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', flexShrink: 0 }}
      className="sp-toolbar px-1">
      <Group title="Find">
        <ActionBtn icon="🔍" label="Find Text" onClick={() => setShowFindBar(!showFindBar)} active={showFindBar} />
      </Group>
      <Group title="Print">
        <ActionBtn icon="🖨" label="Print" onClick={() => window.print()} />
      </Group>
      <Group title="History">
        <ActionBtn icon="↩" label="Undo" onClick={undo} />
        <ActionBtn icon="↪" label="Redo" onClick={redo} />
      </Group>
      <Group title="Watermark">
        <WatermarkGroup />
      </Group>
    </div>
  );

  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FontPicker({ applyTextUpdate }: { applyTextUpdate: (u: Record<string, unknown>) => void }) {
  const { fontFamily, setFont } = useEditorStore();
  return (
    <select
      className="sp-select"
      value={fontFamily}
      onChange={(e) => {
        const name = e.target.value;
        const font = ALL_FONTS.find((f) => f.name === name);
        const stack = font?.stack ?? name;
        setFont(name, stack);
        applyTextUpdate({ fontFamily: name, fontStack: stack });
      }}
      style={{ maxWidth: 160, fontFamily }}
    >
      {Object.entries(FONT_CATEGORIES).map(([cat, fonts]) => (
        <optgroup key={cat} label={cat}>
          {fonts.map((f) => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>{f.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function FontSizeInput({ applyTextUpdate }: { applyTextUpdate: (u: Record<string, unknown>) => void }) {
  const { fontSize, setFontSize } = useEditorStore();
  const PRESETS = [6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96, 120];
  const [inputVal, setInputVal] = useState(String(fontSize));

  // Keep local input in sync when store changes externally
  useEffect(() => { setInputVal(String(fontSize)); }, [fontSize]);

  function commit(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 999) { setFontSize(n); applyTextUpdate({ fontSize: n }); }
    else setInputVal(String(fontSize)); // revert invalid
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: 5, overflow: 'hidden', background: 'var(--panel2)' }}>
      {/* Free-type input */}
      <input
        type="number"
        min={1} max={999}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); e.stopPropagation(); }}
        style={{
          width: 38, padding: '2px 4px', border: 'none', background: 'transparent',
          color: 'var(--text)', fontSize: 12, textAlign: 'center', outline: 'none',
          MozAppearance: 'textfield',
        } as React.CSSProperties}
      />
      {/* Preset dropdown arrow */}
      <select
        value={fontSize}
        onChange={(e) => { const n = Number(e.target.value); setFontSize(n); setInputVal(e.target.value); applyTextUpdate({ fontSize: n }); }}
        style={{
          width: 18, padding: 0, border: 'none', borderLeft: '1px solid var(--border-light)',
          background: 'var(--panel3, #1e2535)', color: 'var(--text-dim)',
          cursor: 'pointer', fontSize: 10, outline: 'none', appearance: 'none',
          WebkitAppearance: 'none', textAlign: 'center',
        }}
        title="Font size presets"
      >
        {PRESETS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

function FormatButtons({ applyTextUpdate }: { applyTextUpdate: (u: Record<string, unknown>) => void }) {
  const { bold, setBold, italic, setItalic, underline: ul, setUnderline } = useEditorStore();
  const style = (active: boolean): React.CSSProperties => ({
    padding: '2px 6px', borderRadius: 4, border: '1px solid',
    borderColor: active ? '#60a5fa' : 'var(--border-light)',
    background: active ? 'rgba(96,165,250,0.15)' : 'var(--panel2)',
    color: active ? '#60a5fa' : 'var(--text)',
    cursor: 'pointer', fontSize: 12,
  });
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <button style={{ ...style(bold), fontWeight: 'bold' }} onClick={() => { const next = !bold; setBold(next); applyTextUpdate({ bold: next }); }}>B</button>
      <button style={{ ...style(italic), fontStyle: 'italic' }} onClick={() => { const next = !italic; setItalic(next); applyTextUpdate({ italic: next }); }}>I</button>
      <button style={{ ...style(ul), textDecoration: 'underline' }} onClick={() => { const next = !ul; setUnderline(next); applyTextUpdate({ underline: next }); }}>U</button>
    </div>
  );
}

function AlignButtons({ applyTextUpdate }: { applyTextUpdate: (u: Record<string, unknown>) => void }) {
  const { textAlign, setTextAlign } = useEditorStore();
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['left', 'center', 'right'] as const).map((a) => (
        <button key={a}
          style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid',
            borderColor: textAlign === a ? '#60a5fa' : 'var(--border-light)',
            background: textAlign === a ? 'rgba(96,165,250,0.15)' : 'var(--panel2)',
            color: textAlign === a ? '#60a5fa' : 'var(--text)', cursor: 'pointer', fontSize: 12 }}
          onClick={() => { setTextAlign(a); applyTextUpdate({ align: a }); }} title={`Align ${a}`}
        >
          {a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥'}
        </button>
      ))}
    </div>
  );
}

function WatermarkGroup() {
  const { watermarkText, setWatermarkText, watermarkOpacity, setWatermarkOpacity,
          pages, addAnnotation } = useEditorStore();

  function applyWatermark() {
    if (!watermarkText.trim()) return;
    pages.forEach((page) => {
      const cx = page.pdfWidth / 2, cy = page.pdfHeight / 2;
      const id = Math.random().toString(36).slice(2) + Date.now();
      addAnnotation({
        id, type: 'stamp', pageId: page.id,
        x: cx - 160, y: cy - 40, width: 320, height: 80,
        text: watermarkText, color: `rgba(100,100,100,${watermarkOpacity})`,
        borderColor: 'transparent', rotation: -30,
      } as any);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '2px 4px', minWidth: 130 }}>
      <input className="sp-input" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
        placeholder="Watermark text" style={{ fontSize: 11 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Opacity</span>
        <input type="range" min={0.05} max={0.5} step={0.01} value={watermarkOpacity}
          onChange={(e) => setWatermarkOpacity(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 26 }}>{Math.round(watermarkOpacity * 100)}%</span>
      </div>
      <button className="sp-btn sp-btn-primary" onClick={applyWatermark} style={{ fontSize: 10, padding: '2px 8px' }}>
        Apply to All Pages
      </button>
    </div>
  );
}
