import { useRef, useEffect, useState, useCallback, type ReactNode, type DragEvent } from 'react';
import { useEditorStore, generateId, type Guide } from '../store/editorStore';

const R = 20; // ruler thickness in pixels
const GUIDE_COLOR = '#4f9bff';
const RULER_BG = '#1a1c2e';
const RULER_BORDER = '#2e3150';
const TICK_MAJOR = '#6b7280';
const TICK_MINOR = '#374151';
const LABEL_COLOR = '#9ca3af';

// ── Pick a "nice" document-unit interval so screen ticks are ~50-100 px apart ──
function niceInterval(scale: number): number {
  const target = 80 / scale; // target doc-unit gap
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  return steps.find((s) => s >= target) ?? 2000;
}

// ── Draw one ruler onto a canvas element ──────────────────────────────────────
function drawRuler(
  canvas: HTMLCanvasElement,
  orientation: 'h' | 'v',
  scrollOffset: number,
  visibleSize: number,
  scale: number,
  mouseDocPos: number | null,
) {
  if (visibleSize <= 0) return;
  const dpr = window.devicePixelRatio || 1;

  if (orientation === 'h') {
    canvas.width = Math.round(visibleSize * dpr);
    canvas.height = Math.round(R * dpr);
    canvas.style.width = visibleSize + 'px';
    canvas.style.height = R + 'px';
  } else {
    canvas.width = Math.round(R * dpr);
    canvas.height = Math.round(visibleSize * dpr);
    canvas.style.width = R + 'px';
    canvas.style.height = visibleSize + 'px';
  }

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  // Background
  ctx.fillStyle = RULER_BG;
  ctx.fillRect(0, 0, W, H);

  // Edge border
  ctx.strokeStyle = RULER_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (orientation === 'h') { ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); }
  else                     { ctx.moveTo(W - 0.5, 0); ctx.lineTo(W - 0.5, H); }
  ctx.stroke();

  const interval = niceInterval(scale);
  const screenInterval = interval * scale;

  // First major tick before viewport
  const startDoc = scrollOffset / scale;
  const first = Math.floor(startDoc / interval) * interval;
  const endDoc = (scrollOffset + visibleSize) / scale + interval;

  ctx.font = `9px -apple-system, BlinkMacSystemFont, sans-serif`;

  for (let doc = first; doc <= endDoc; doc += interval) {
    const screen = doc * scale - scrollOffset;
    if (screen < -screenInterval || screen > visibleSize + screenInterval) continue;

    // Major tick
    ctx.strokeStyle = TICK_MAJOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (orientation === 'h') {
      ctx.moveTo(screen, H);
      ctx.lineTo(screen, H - 9);
    } else {
      ctx.moveTo(W, screen);
      ctx.lineTo(W - 9, screen);
    }
    ctx.stroke();

    // Label
    const label = Math.round(doc).toString();
    ctx.fillStyle = LABEL_COLOR;
    if (orientation === 'h') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, screen + 2, 2);
    } else {
      ctx.save();
      ctx.translate(R - 11, screen - 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // 4 minor ticks per interval
    for (let m = 1; m < 5; m++) {
      const minorScreen = (doc + (interval / 5) * m) * scale - scrollOffset;
      if (minorScreen < 0 || minorScreen > visibleSize) continue;
      ctx.strokeStyle = TICK_MINOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (orientation === 'h') {
        ctx.moveTo(minorScreen, H);
        ctx.lineTo(minorScreen, H - 4);
      } else {
        ctx.moveTo(W, minorScreen);
        ctx.lineTo(W - 4, minorScreen);
      }
      ctx.stroke();
    }
  }

  // Mouse position indicator
  if (mouseDocPos !== null) {
    const screen = mouseDocPos * scale - scrollOffset;
    if (screen >= 0 && screen <= visibleSize) {
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (orientation === 'h') { ctx.moveTo(screen, 0); ctx.lineTo(screen, H); }
      else                     { ctx.moveTo(0, screen); ctx.lineTo(W, screen); }
      ctx.stroke();
    }
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  children: ReactNode;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RulerArea({ children, onDrop, onDragOver }: Props) {
  const { scale, showRulers, guides, addGuide, updateGuide, deleteGuide } = useEditorStore();

  const scrollRef  = useRef<HTMLDivElement>(null);
  const hRulerRef  = useRef<HTMLCanvasElement>(null);
  const vRulerRef  = useRef<HTMLCanvasElement>(null);

  const [scroll,        setScroll       ] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  // Mouse position in document coordinates (scale=1 px)
  const [mouseDoc,      setMouseDoc     ] = useState<{ x: number; y: number } | null>(null);

  // Drag state: dragging a NEW guide from ruler, or MOVING an existing one
  const [dragging, setDragging] = useState<{
    type: 'new-h' | 'new-v' | 'move-h' | 'move-v';
    guideId?: string;
    previewDocPos: number;
    insideCanvas: boolean;
  } | null>(null);

  // ── Observe scroll container size ───────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Redraw H ruler ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hRulerRef.current || containerSize.w <= 0) return;
    const docX = mouseDoc?.x ?? null;
    drawRuler(hRulerRef.current, 'h', scroll.x, containerSize.w, scale, docX);
  }, [scroll.x, containerSize.w, scale, mouseDoc?.x]);

  // ── Redraw V ruler ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vRulerRef.current || containerSize.h <= 0) return;
    const docY = mouseDoc?.y ?? null;
    drawRuler(vRulerRef.current, 'v', scroll.y, containerSize.h, scale, docY);
  }, [scroll.y, containerSize.h, scale, mouseDoc?.y]);

  // ── Mouse move over the scroll content area ──────────────────────────────────
  const onContentMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = scrollRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const docX = (screenX + scroll.x) / scale;
    const docY = (screenY + scroll.y) / scale;
    setMouseDoc({ x: docX, y: docY });

    if (dragging) {
      const pos = dragging.type.endsWith('h') ? docY : docX;
      const inside = screenX >= 0 && screenY >= 0 && screenX <= containerSize.w && screenY <= containerSize.h;
      setDragging((d) => d ? { ...d, previewDocPos: pos, insideCanvas: inside } : d);
    }
  }, [scroll, scale, dragging, containerSize]);

  const onContentMouseLeave = useCallback(() => {
    setMouseDoc(null);
  }, []);

  // ── Mouse move during ruler drag (moves over the rulers themselves) ──────────
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = scrollRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const docX = (screenX + scroll.x) / scale;
      const docY = (screenY + scroll.y) / scale;
      const isH = dragging.type.endsWith('h');
      const pos = isH ? docY : docX;
      const inside = screenX >= 0 && screenY >= 0;
      setMouseDoc({ x: docX, y: docY });
      setDragging((d) => d ? { ...d, previewDocPos: pos, insideCanvas: inside } : d);
    };
    const onUp = () => {
      if (dragging.insideCanvas) {
        if (dragging.type.startsWith('new')) {
          addGuide({ id: generateId(), type: dragging.type === 'new-h' ? 'h' : 'v', position: dragging.previewDocPos });
        } else if (dragging.guideId) {
          updateGuide(dragging.guideId, dragging.previewDocPos);
        }
      } else if (dragging.guideId && dragging.type.startsWith('move')) {
        // Dragged back onto ruler — delete guide
        deleteGuide(dragging.guideId);
      }
      setDragging(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, scroll, scale, addGuide, updateGuide, deleteGuide]);

  // ── Start dragging a NEW guide from a ruler ──────────────────────────────────
  const onHRulerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const docY = (e.clientY - rect.top + scroll.y) / scale;
    setDragging({ type: 'new-h', previewDocPos: docY, insideCanvas: false });
  }, [scroll.y, scale]);

  const onVRulerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const docX = (e.clientX - rect.left + scroll.x) / scale;
    setDragging({ type: 'new-v', previewDocPos: docX, insideCanvas: false });
  }, [scroll.x, scale]);

  // ── Start moving an existing guide ──────────────────────────────────────────
  const onGuideMouseDown = useCallback((e: React.MouseEvent, g: Guide) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging({ type: g.type === 'h' ? 'move-h' : 'move-v', guideId: g.id, previewDocPos: g.position, insideCanvas: true });
  }, []);

  // ── Shared guide line style builder ──────────────────────────────────────────
  function guideStyle(g: Guide): React.CSSProperties {
    if (g.type === 'h') return {
      position: 'absolute', left: 0, right: 0,
      top: g.position * scale - 0.5,
      height: 1, background: GUIDE_COLOR,
      cursor: 'ns-resize', zIndex: 200,
      pointerEvents: 'all',
      boxShadow: `0 0 0 0.5px ${GUIDE_COLOR}44`,
    };
    return {
      position: 'absolute', top: 0, bottom: 0,
      left: g.position * scale - 0.5,
      width: 1, background: GUIDE_COLOR,
      cursor: 'ew-resize', zIndex: 200,
      pointerEvents: 'all',
      boxShadow: `0 0 0 0.5px ${GUIDE_COLOR}44`,
    };
  }

  // ── If rulers are off, render just the plain scroll area ─────────────────────
  if (!showRulers) {
    return (
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', background: 'var(--canvas-bg)' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {children}
      </div>
    );
  }

  // Active drag guide preview position in screen coords
  const previewScreen = dragging
    ? dragging.previewDocPos * scale - (dragging.type.endsWith('h') ? scroll.y : scroll.x)
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Top row: corner square + horizontal ruler ── */}
      <div style={{ display: 'flex', height: R, flexShrink: 0, zIndex: 10 }}>
        {/* Corner */}
        <div
          title="Clear all guides"
          onClick={() => useEditorStore.getState().clearGuides()}
          style={{
            width: R, height: R, flexShrink: 0,
            background: RULER_BG,
            borderRight: `1px solid ${RULER_BORDER}`,
            borderBottom: `1px solid ${RULER_BORDER}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <line x1="0" y1="4" x2="8" y2="4" stroke="#6b7280" strokeWidth="1"/>
            <line x1="4" y1="0" x2="4" y2="8" stroke="#6b7280" strokeWidth="1"/>
          </svg>
        </div>

        {/* Horizontal ruler */}
        <canvas
          ref={hRulerRef}
          style={{ flex: 1, cursor: 's-resize', display: 'block' }}
          onMouseDown={onHRulerMouseDown}
        />
      </div>

      {/* ── Bottom row: vertical ruler + scroll container ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Vertical ruler */}
        <canvas
          ref={vRulerRef}
          style={{ width: R, flexShrink: 0, cursor: 'e-resize', display: 'block' }}
          onMouseDown={onVRulerMouseDown}
        />

        {/* Scroll container */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: 'auto', background: 'var(--canvas-bg)', position: 'relative' }}
          onScroll={(e) => setScroll({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
          onMouseMove={onContentMouseMove}
          onMouseLeave={onContentMouseLeave}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          {/* Content wrapper — guides are positioned inside this */}
          <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%', minHeight: '100%' }}>
            {children}

            {/* Saved guides */}
            {guides.map((g) => {
              const isDraggingThis = dragging?.guideId === g.id;
              if (isDraggingThis) return null; // show preview instead while dragging
              return (
                <div
                  key={g.id}
                  style={guideStyle(g)}
                  title={`${g.type === 'h' ? 'Y' : 'X'}: ${Math.round(g.position)}px  —  Double-click to delete, drag back to ruler to remove`}
                  onMouseDown={(e) => onGuideMouseDown(e, g)}
                  onDoubleClick={() => deleteGuide(g.id)}
                />
              );
            })}

            {/* Drag preview guide */}
            {dragging && dragging.insideCanvas && previewScreen !== null && (
              <div
                style={dragging.type.endsWith('h') ? {
                  position: 'absolute', left: 0, right: 0,
                  top: previewScreen - 0.5, height: 1,
                  background: GUIDE_COLOR, opacity: 0.75,
                  pointerEvents: 'none', zIndex: 201,
                } : {
                  position: 'absolute', top: 0, bottom: 0,
                  left: previewScreen - 0.5, width: 1,
                  background: GUIDE_COLOR, opacity: 0.75,
                  pointerEvents: 'none', zIndex: 201,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Position tooltip while dragging ── */}
      {dragging && dragging.insideCanvas && mouseDoc && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#e2e8f0', fontSize: 11,
          padding: '3px 10px', borderRadius: 5, border: '1px solid #334155',
          pointerEvents: 'none', zIndex: 9999, letterSpacing: 0.3,
        }}>
          {dragging.type.endsWith('h')
            ? `Y: ${Math.round(dragging.previewDocPos)}px`
            : `X: ${Math.round(dragging.previewDocPos)}px`}
        </div>
      )}
    </div>
  );
}
