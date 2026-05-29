import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useEditorStore, generateId } from '../store/editorStore';
import SignatureModal from './SignatureModal';
import type {
  Annotation, DrawAnnotation, TextAnnotation, EllipseAnnotation,
  LineAnnotation, ArrowAnnotation, Point,
} from '../types';

interface Props { pageId: string; width: number; height: number; }

type Handle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

interface ActiveSession {
  phase: 'idle' | 'drawing' | 'dragging' | 'resizing';
  startX: number; startY: number;
  lastX: number; lastY: number;
  drawId: string | null;
  drawPoints: Point[];
  dragTarget: { id: string; orig: Annotation } | null;
  resizeTarget: { id: string; handle: Handle; orig: Annotation } | null;
  // When a selected text annotation is mousedown'd, pend edit mode; cancel if user actually drags.
  textPendingEditId: string | null;
}

export default function AnnotationLayer({ pageId, width, height }: Props) {
  const {
    activeTool, strokeColor, fillColor, highlightColor, strokeWidth,
    fontSize, fontFamily, fontStack, highlightOpacity, drawOpacity,
    filled, bold, italic, underline: textUnderline, textAlign, cornerRadius,
    stampText, stampColor, authorName,
    annotations, selectedIds,
    addAnnotation, updateAnnotation, deleteAnnotation, deleteSelected,
    setSelectedIds, pushHistory, reorderAnnotation,
    copySelected, cutSelected, pasteAnnotations, clipboard,
    pendingEditTextId, setPendingEditTextId,
  } = useEditorStore();

  const wrapRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const session = useRef<ActiveSession>({
    phase: 'idle', startX: 0, startY: 0, lastX: 0, lastY: 0,
    drawId: null, drawPoints: [],
    dragTarget: null, resizeTarget: null,
    textPendingEditId: null,
  });
  const [openSticky, setOpenSticky] = useState<string | null>(null);
  const [, forceUpdate] = useState(0); // used to trigger re-render for preview rect
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; annId: string } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [signatureModalPos, setSignatureModalPos] = useState<Point | null>(null);

  const pageAnnots = annotations.filter((a) => a.pageId === pageId);

  // Auto-enter edit mode when a text annotation was just created via the edit-text tool
  useEffect(() => {
    if (!pendingEditTextId) return;
    const ann = pageAnnots.find((a) => a.id === pendingEditTextId);
    if (ann && ann.type === 'text') {
      setEditingTextId(pendingEditTextId);
      setSelectedIds([pendingEditTextId]);
      setPendingEditTextId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditTextId, pageAnnots]);

  // ── Redraw "finalized" draw/arrow/line on the draw canvas ──────────────────
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    for (const ann of pageAnnots) {
      if (ann.type === 'draw')   renderDraw(ctx, ann);
      if (ann.type === 'arrow')  renderArrow(ctx, ann);
      if (ann.type === 'line')   renderLine(ctx, ann);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, pageId, width, height]);

  function renderDraw(ctx: CanvasRenderingContext2D, ann: DrawAnnotation) {
    if (ann.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = ann.opacity ?? 1;
    ctx.strokeStyle = ann.color; ctx.lineWidth = ann.strokeWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x, ann.points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function renderArrow(ctx: CanvasRenderingContext2D, ann: ArrowAnnotation) {
    ctx.save();
    ctx.strokeStyle = ann.color; ctx.lineWidth = ann.strokeWidth; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2); ctx.stroke();
    const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
    const hl = Math.max(10, ann.strokeWidth * 5);
    ctx.beginPath();
    ctx.moveTo(ann.x2, ann.y2);
    ctx.lineTo(ann.x2 - hl * Math.cos(angle - Math.PI / 6), ann.y2 - hl * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(ann.x2, ann.y2);
    ctx.lineTo(ann.x2 - hl * Math.cos(angle + Math.PI / 6), ann.y2 - hl * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
    ctx.restore();
  }

  function renderLine(ctx: CanvasRenderingContext2D, ann: LineAnnotation) {
    ctx.save();
    ctx.strokeStyle = ann.color; ctx.lineWidth = ann.strokeWidth; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2); ctx.stroke();
    ctx.restore();
  }

  // ── Get mouse position relative to this layer ──────────────────────────────
  function getPosFromEvent(e: MouseEvent | React.MouseEvent): Point {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Hit testing ──────────────────────────────────────────────────────────────
  function findAt(pos: Point): Annotation | null {
    for (let i = pageAnnots.length - 1; i >= 0; i--) {
      if (pageAnnots[i].type === 'cover') continue; // cover rects are background-only, not selectable
      if (hitTest(pageAnnots[i], pos)) return pageAnnots[i];
    }
    return null;
  }

  function hitTest(ann: Annotation, pos: Point): boolean {
    const pad = 8;
    if (ann.type === 'text')     return pos.x >= ann.x - pad && pos.y >= ann.y - pad && pos.x <= ann.x + 400 && pos.y <= ann.y + ann.fontSize * 2 + pad;
    if (ann.type === 'ellipse')  return ((pos.x - ann.cx) / (ann.rx + pad)) ** 2 + ((pos.y - ann.cy) / (ann.ry + pad)) ** 2 <= 1;
    if (ann.type === 'draw')     return ann.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < Math.max(8, ann.strokeWidth / 2 + 4));
    if (ann.type === 'line' || ann.type === 'arrow') return distSeg(pos, { x: ann.x1, y: ann.y1 }, { x: ann.x2, y: ann.y2 }) < Math.max(8, ann.strokeWidth / 2 + 4);
    if (ann.type === 'sticky')   return pos.x >= ann.x && pos.x <= ann.x + 28 && pos.y >= ann.y && pos.y <= ann.y + 28;
    if ('x' in ann && 'y' in ann && 'width' in ann && 'height' in ann) {
      const a = ann as any;
      return pos.x >= a.x - pad && pos.x <= a.x + a.width + pad && pos.y >= a.y - pad && pos.y <= a.y + a.height + pad;
    }
    return false;
  }

  function distSeg(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // ── Resize handle hit test ──────────────────────────────────────────────────
  function findResizeHandle(ann: Annotation, pos: Point): Handle | null {
    const b = getBounds(ann);
    if (!b) return null;
    const S = 7;
    const handles: Array<[Handle, number, number]> = [
      ['tl', b.x,           b.y          ], ['tc', b.x + b.w / 2, b.y          ], ['tr', b.x + b.w,     b.y          ],
      ['ml', b.x,           b.y + b.h / 2], ['mr', b.x + b.w,     b.y + b.h / 2],
      ['bl', b.x,           b.y + b.h    ], ['bc', b.x + b.w / 2, b.y + b.h    ], ['br', b.x + b.w,     b.y + b.h    ],
    ];
    for (const [h, hx, hy] of handles) {
      if (Math.abs(pos.x - hx) <= S && Math.abs(pos.y - hy) <= S) return h;
    }
    return null;
  }

  // ── Resize apply ─────────────────────────────────────────────────────────────
  function applyResize(id: string, handle: Handle, orig: Annotation, dx: number, dy: number) {
    const b = getBounds(orig);
    if (!b) return;
    let { x, y, w, h } = { x: b.x, y: b.y, w: b.w, h: b.h };
    if (handle.includes('l')) { x += dx; w -= dx; }
    if (handle.includes('r')) { w += dx; }
    if (handle.includes('t')) { y += dy; h -= dy; }
    if (handle.includes('b')) { h += dy; }
    w = Math.max(10, w); h = Math.max(10, h);

    if (orig.type === 'ellipse') {
      updateAnnotation(id, { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 } as any);
    } else if (orig.type === 'line' || orig.type === 'arrow') {
      const o = orig as LineAnnotation;
      if (handle === 'tl' || handle === 'ml' || handle === 'bl') updateAnnotation(id, { x1: o.x1 + dx, y1: o.y1 + dy } as any);
      else updateAnnotation(id, { x2: o.x2 + dx, y2: o.y2 + dy } as any);
    } else if (orig.type === 'text') {
      updateAnnotation(id, { x, y } as any);
    } else {
      updateAnnotation(id, { x, y, width: w, height: h } as any);
    }
  }

  // ── Image/signature insert ──────────────────────────────────────────────────
  function insertImage(pos: Point, forSignature = false) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxW = Math.min(280, width * 0.5);
          const ratio = img.height / img.width;
          const w = Math.min(maxW, img.width), h = w * ratio;
          addAnnotation({ id: generateId(), type: forSignature ? 'signature' : 'image', pageId,
            x: Math.max(0, pos.x - w / 2), y: Math.max(0, pos.y - h / 2), width: w, height: h,
            dataUrl, ...(forSignature ? {} : { opacity: 1 }) } as any);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // ── Preview canvas drawing ──────────────────────────────────────────────────
  function clearPreview() {
    const cv = previewCanvasRef.current; if (!cv) return;
    cv.getContext('2d')!.clearRect(0, 0, width, height);
  }

  function drawPreview(sx: number, sy: number, ex: number, ey: number) {
    const cv = previewCanvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    const x = Math.min(sx, ex), y = Math.min(sy, ey);
    const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1.5;

    switch (activeTool) {
      case 'highlight':
        ctx.fillStyle = highlightColor; ctx.globalAlpha = highlightOpacity;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#60a5fa'; ctx.strokeRect(x, y, w, h);
        break;
      case 'underline':
        ctx.fillStyle = 'rgba(59,130,246,0.06)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#60a5fa'; ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]); ctx.strokeStyle = strokeColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
        break;
      case 'strikethrough':
        ctx.fillStyle = 'rgba(239,68,68,0.06)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#f87171'; ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]); ctx.strokeStyle = strokeColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
        break;
      case 'rectangle':
        ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth;
        if (filled) { ctx.fillStyle = fillColor; ctx.globalAlpha = 0.15; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
        ctx.strokeRect(x, y, w, h);
        break;
      case 'ellipse': {
        ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth;
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (filled) { ctx.fillStyle = fillColor; ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.stroke();
        break;
      }
      case 'line': case 'arrow':
        ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        if (activeTool === 'arrow') {
          const angle = Math.atan2(ey - sy, ex - sx);
          const hl = Math.max(12, strokeWidth * 4);
          ctx.beginPath();
          ctx.moveTo(ex, ey); ctx.lineTo(ex - hl * Math.cos(angle - Math.PI/6), ey - hl * Math.sin(angle - Math.PI/6));
          ctx.moveTo(ex, ey); ctx.lineTo(ex - hl * Math.cos(angle + Math.PI/6), ey - hl * Math.sin(angle + Math.PI/6));
          ctx.stroke();
        }
        break;
      case 'redact':
        ctx.fillStyle = '#111'; ctx.globalAlpha = 0.75; ctx.fillRect(x, y, w, h);
        break;
    }
    ctx.restore();
  }

  // ── Global mouse move/up during active session ────────────────────────────
  useEffect(() => {
    function onWindowMove(e: MouseEvent) {
      const s = session.current;
      if (s.phase === 'idle') return;
      const pos = getPosFromEvent(e);
      s.lastX = pos.x; s.lastY = pos.y;

      if (s.phase === 'drawing') {
        if (activeTool === 'draw' && s.drawId) {
          s.drawPoints.push(pos);
          updateAnnotation(s.drawId, { points: [...s.drawPoints] } as any);
        } else {
          drawPreview(s.startX, s.startY, pos.x, pos.y);
        }
      } else if (s.phase === 'dragging' && s.dragTarget) {
        const dx = pos.x - s.startX, dy = pos.y - s.startY;
        const { id, orig } = s.dragTarget;
        if (orig.type === 'draw') {
          updateAnnotation(id, { points: (orig as DrawAnnotation).points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as any);
        } else if (orig.type === 'line' || orig.type === 'arrow') {
          const o = orig as LineAnnotation;
          updateAnnotation(id, { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy } as any);
        } else if (orig.type === 'ellipse') {
          const o = orig as EllipseAnnotation;
          updateAnnotation(id, { cx: o.cx + dx, cy: o.cy + dy } as any);
        } else if ('x' in orig && 'y' in orig) {
          updateAnnotation(id, { x: (orig as any).x + dx, y: (orig as any).y + dy } as any);
        }
      } else if (s.phase === 'resizing' && s.resizeTarget) {
        const dx = pos.x - s.startX, dy = pos.y - s.startY;
        applyResize(s.resizeTarget.id, s.resizeTarget.handle, s.resizeTarget.orig, dx, dy);
      }
    }

    function onWindowUp(e: MouseEvent) {
      const s = session.current;
      if (s.phase === 'idle') return;
      const pos = getPosFromEvent(e);

      if (s.phase === 'drawing') {
        clearPreview();
        if (activeTool !== 'draw') {
          // Finalize shape annotation
          const sx = s.startX, sy = s.startY, ex = pos.x, ey = pos.y;
          const x = Math.min(sx, ex), y = Math.min(sy, ey);
          const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
          if (w > 3 || h > 3) {
            const common = { id: generateId(), pageId };
            if (activeTool === 'highlight')      addAnnotation({ ...common, type: 'highlight',      x, y, width: w, height: h, color: highlightColor, opacity: highlightOpacity });
            else if (activeTool === 'underline') addAnnotation({ ...common, type: 'underline',      x, y, width: w, height: h, color: strokeColor, strokeWidth: 2 });
            else if (activeTool === 'strikethrough') addAnnotation({ ...common, type: 'strikethrough', x, y, width: w, height: h, color: strokeColor, strokeWidth: 2 });
            else if (activeTool === 'rectangle') addAnnotation({ ...common, type: 'rectangle', x, y, width: w, height: h, strokeColor, fillColor, strokeWidth, filled, radius: cornerRadius, opacity: 1 });
            else if (activeTool === 'ellipse')   addAnnotation({ ...common, type: 'ellipse',   cx: x + w/2, cy: y + h/2, rx: w/2, ry: h/2, strokeColor, fillColor, strokeWidth, filled, opacity: 1 });
            else if (activeTool === 'line')      addAnnotation({ ...common, type: 'line',  x1: sx, y1: sy, x2: ex, y2: ey, color: strokeColor, strokeWidth });
            else if (activeTool === 'arrow')     addAnnotation({ ...common, type: 'arrow', x1: sx, y1: sy, x2: ex, y2: ey, color: strokeColor, strokeWidth });
            else if (activeTool === 'redact')    addAnnotation({ ...common, type: 'redact', x, y, width: w, height: h });
          }
        }
      } else if (s.phase === 'dragging' || s.phase === 'resizing') {
        const dragDist = Math.hypot(pos.x - s.startX, pos.y - s.startY);
        if (s.textPendingEditId !== null && dragDist < 4) {
          // Tiny click on an already-selected text box → enter edit mode
          setEditingTextId(s.textPendingEditId);
        } else {
          pushHistory();
        }
      }

      s.phase = 'idle';
      s.drawId = null;
      s.drawPoints = [];
      s.dragTarget = null;
      s.resizeTarget = null;
      s.textPendingEditId = null;
      forceUpdate((n) => n + 1); // refresh resize handle UI
    }

    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, pageId, strokeColor, fillColor, highlightColor, strokeWidth, filled, cornerRadius, highlightOpacity, drawOpacity]);

  // ── Double-click to enter text edit mode ────────────────────────────────────
  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'select') return;
    const pos = getPosFromEvent(e.nativeEvent);
    const hit = findAt(pos);
    if (hit?.type === 'text') {
      setSelectedIds([hit.id]);
      setEditingTextId(hit.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, pageAnnots]);

  // ── Right-click context menu ─────────────────────────────────────────────────
  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPosFromEvent(e.nativeEvent);
    const hit = findAt(pos);
    if (hit) {
      setSelectedIds([hit.id]);
      // Position relative to the layer element
      setCtxMenu({ x: pos.x, y: pos.y, annId: hit.id });
    } else {
      setCtxMenu(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageAnnots, selectedIds]);

  // ── Mouse down on the layer ──────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (ctxMenu) { setCtxMenu(null); }
    if (e.button !== 0) return;
    const pos = getPosFromEvent(e.nativeEvent);
    e.stopPropagation();

    const s = session.current;
    s.startX = pos.x; s.startY = pos.y; s.lastX = pos.x; s.lastY = pos.y;

    // ── Select / drag / resize mode ─────────────────────────────────────────
    if (activeTool === 'select') {
      // Check resize handles on selected annotation first (text annotations don't use resize handles)
      if (selectedIds.length === 1) {
        const selAnn = pageAnnots.find((a) => a.id === selectedIds[0]);
        if (selAnn && selAnn.type !== 'text') {
          const h = findResizeHandle(selAnn, pos);
          if (h) {
            s.phase = 'resizing';
            s.resizeTarget = { id: selAnn.id, handle: h, orig: { ...selAnn } as Annotation };
            return;
          }
        }
      }
      // Helper: delete text box if it's empty and currently being edited
      function maybeDeleteEmptyEditing() {
        if (!editingTextId) return;
        const editingAnn = pageAnnots.find((a) => a.id === editingTextId);
        if (editingAnn && editingAnn.type === 'text' && !editingAnn.content.trim()) {
          deleteAnnotation(editingTextId);
        }
      }

      // Check if hitting an annotation → drag
      const hit = findAt(pos);
      if (hit) {
        const wasAlreadySelected = selectedIds.includes(hit.id);
        if (!wasAlreadySelected) setSelectedIds([hit.id]);

        // Clicking a different annotation exits text edit mode (delete if empty)
        if (editingTextId && hit.id !== editingTextId) {
          maybeDeleteEmptyEditing();
          setEditingTextId(null);
        }

        // Don't start a drag while already editing this text box
        if (editingTextId === hit.id) return;

        s.phase = 'dragging';
        s.dragTarget = { id: hit.id, orig: { ...hit } as Annotation };

        // For a selected text annotation: start a drag optimistically. If the mouse
        // barely moves, onWindowUp will switch to edit mode instead (click-to-edit).
        if (hit.type === 'text' && wasAlreadySelected) {
          s.textPendingEditId = hit.id;
        }
      } else {
        // Clicking empty canvas — exit edit mode, delete text box if empty
        maybeDeleteEmptyEditing();
        setSelectedIds([]);
        setEditingTextId(null);
      }
      return;
    }

    // ── Eraser ───────────────────────────────────────────────────────────────
    if (activeTool === 'eraser') {
      const hit = findAt(pos);
      if (hit) deleteAnnotation(hit.id);
      return;
    }

    // ── One-click tools ──────────────────────────────────────────────────────
    if (activeTool === 'image')     { insertImage(pos); return; }
    if (activeTool === 'signature') { setSignatureModalPos(pos); return; }

    if (activeTool === 'sticky') {
      addAnnotation({ id: generateId(), type: 'sticky', pageId, x: pos.x, y: pos.y, content: '', color: '#fef08a', collapsed: false, author: authorName });
      return;
    }
    if (activeTool === 'stamp') {
      const w = 170, h = 54;
      addAnnotation({ id: generateId(), type: 'stamp', pageId, x: pos.x - w/2, y: pos.y - h/2, width: w, height: h, text: stampText, color: stampColor, borderColor: stampColor, rotation: -15 });
      return;
    }
    if (activeTool === 'text') {
      const ann: TextAnnotation = {
        id: generateId(), type: 'text', pageId, x: pos.x, y: pos.y,
        content: '', fontSize, color: strokeColor, fontFamily, fontStack,
        bold, italic, underline: textUnderline, align: textAlign,
      };
      addAnnotation(ann);
      setEditingTextId(ann.id); // immediately enter edit mode
      // Switch to select tool, then restore selection (setActiveTool clears selectedIds)
      useEditorStore.getState().setActiveTool('select');
      useEditorStore.getState().setSelectedIds([ann.id]);
      return;
    }

    // ── Draw-drag tools ──────────────────────────────────────────────────────
    s.phase = 'drawing';
    if (activeTool === 'draw') {
      const ann: DrawAnnotation = { id: generateId(), type: 'draw', pageId, points: [pos], color: strokeColor, strokeWidth, opacity: drawOpacity };
      s.drawId = ann.id;
      s.drawPoints = [pos];
      addAnnotation(ann);
    }
    // For shape tools, drawing starts; preview happens in onWindowMove via drawPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedIds, pageAnnots, pageId, strokeColor, fillColor, highlightColor,
      strokeWidth, filled, cornerRadius, highlightOpacity, drawOpacity,
      fontSize, fontFamily, fontStack, bold, italic, textUnderline, textAlign,
      stampText, stampColor, authorName, ctxMenu, editingTextId]);

  // ── Cursor ──────────────────────────────────────────────────────────────────
  const cursor =
    activeTool === 'select'   ? 'default' :
    activeTool === 'text'     ? 'text' :
    activeTool === 'eraser'   ? 'cell' :
    activeTool === 'draw'     ? 'crosshair' :
    'crosshair';

  // ── Resize handles SVG ───────────────────────────────────────────────────────
  function ResizeHandles({ ann }: { ann: Annotation }) {
    const b = getBounds(ann);
    if (!b) return null;
    const handles: Array<[Handle, number, number, string]> = [
      ['tl', b.x,           b.y,           'nw-resize'],
      ['tc', b.x + b.w / 2, b.y,           'n-resize'],
      ['tr', b.x + b.w,     b.y,           'ne-resize'],
      ['ml', b.x,           b.y + b.h / 2, 'w-resize'],
      ['mr', b.x + b.w,     b.y + b.h / 2, 'e-resize'],
      ['bl', b.x,           b.y + b.h,     'sw-resize'],
      ['bc', b.x + b.w / 2, b.y + b.h,     's-resize'],
      ['br', b.x + b.w,     b.y + b.h,     'se-resize'],
    ];
    return (
      <>
        {handles.map(([h, hx, hy, cur]) => (
          <rect key={h} x={hx - 5} y={hy - 5} width={10} height={10}
            fill="#fff" stroke="#0a84ff" strokeWidth={1.5} rx={2}
            style={{ cursor: cur, pointerEvents: 'all' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const s = session.current;
              const pos = getPosFromEvent(e.nativeEvent);
              s.phase = 'resizing';
              s.startX = pos.x; s.startY = pos.y;
              s.resizeTarget = { id: ann.id, handle: h, orig: { ...ann } as Annotation };
            }}
          />
        ))}
      </>
    );
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute', top: 0, left: 0, width, height, zIndex: 2,
        // Pass through clicks to TextLayer when edit-text tool is active so spans are clickable
        pointerEvents: activeTool === 'edit-text' ? 'none' : 'all',
        cursor, userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* ── Finalized annotations SVG ── */}
      <svg width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {pageAnnots.map((ann) => {
          const sel = selectedIds.includes(ann.id);
          const glow = sel ? { filter: 'drop-shadow(0 0 3px rgba(10,132,255,0.6))' } : {};

          if (ann.type === 'highlight') return (
            <rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height}
              fill={ann.color} opacity={ann.opacity} style={{ pointerEvents: 'all', ...glow }} />
          );
          if (ann.type === 'underline') return (
            <g key={ann.id} style={glow as any}>
              <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="transparent" style={{ pointerEvents: 'all' }} />
              <line x1={ann.x} y1={ann.y + ann.height} x2={ann.x + ann.width} y2={ann.y + ann.height}
                stroke={ann.color} strokeWidth={ann.strokeWidth} />
            </g>
          );
          if (ann.type === 'strikethrough') return (
            <g key={ann.id} style={glow as any}>
              <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="transparent" style={{ pointerEvents: 'all' }} />
              <line x1={ann.x} y1={ann.y + ann.height / 2} x2={ann.x + ann.width} y2={ann.y + ann.height / 2}
                stroke={ann.color} strokeWidth={ann.strokeWidth} />
            </g>
          );
          if (ann.type === 'rectangle') return (
            <rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height}
              rx={ann.radius} ry={ann.radius}
              fill={ann.filled ? ann.fillColor : 'none'} fillOpacity={ann.filled ? 0.3 : 0}
              stroke={ann.strokeColor} strokeWidth={ann.strokeWidth}
              style={{ pointerEvents: 'all', ...glow }} />
          );
          if (ann.type === 'ellipse') return (
            <ellipse key={ann.id} cx={ann.cx} cy={ann.cy} rx={ann.rx} ry={ann.ry}
              fill={ann.filled ? ann.fillColor : 'none'} fillOpacity={ann.filled ? 0.3 : 0}
              stroke={ann.strokeColor} strokeWidth={ann.strokeWidth}
              style={{ pointerEvents: 'all', ...glow }} />
          );
          if (ann.type === 'image') return (
            <g key={ann.id} style={glow as any}>
              <image href={ann.dataUrl} x={ann.x} y={ann.y} width={ann.width} height={ann.height} opacity={(ann as any).opacity ?? 1} style={{ pointerEvents: 'all' }} />
              {sel && <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="none" stroke="#0a84ff" strokeWidth={1.5} strokeDasharray="5 3" />}
            </g>
          );
          if (ann.type === 'signature') return (
            <g key={ann.id} style={glow as any}>
              <image href={ann.dataUrl} x={ann.x} y={ann.y} width={ann.width} height={ann.height} style={{ pointerEvents: 'all' }} />
              {sel && <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="none" stroke="#0a84ff" strokeWidth={1.5} strokeDasharray="5 3" />}
            </g>
          );
          if (ann.type === 'redact') return (
            <rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height}
              fill="#0a0a0a" stroke={sel ? '#0a84ff' : 'none'} strokeWidth={1.5}
              style={{ pointerEvents: 'all' }} />
          );
          if (ann.type === 'cover') return (
            // White opaque rectangle that hides the original PDF text underneath an edited text annotation
            <rect key={ann.id} x={ann.x} y={ann.y} width={ann.width} height={ann.height}
              fill="white" stroke="none"
              style={{ pointerEvents: 'none' }} />
          );
          if (ann.type === 'stamp') return (
            <g key={ann.id}
              transform={`rotate(${ann.rotation}, ${ann.x + ann.width / 2}, ${ann.y + ann.height / 2})`}
              style={{ pointerEvents: 'all', ...glow }}>
              <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height}
                fill="none" stroke={ann.borderColor} strokeWidth={2.5} rx={5} />
              <text x={ann.x + ann.width / 2} y={ann.y + ann.height / 2 + 6}
                textAnchor="middle" fill={ann.color} fontSize={17} fontWeight="bold"
                fontFamily="Arial" letterSpacing={2}>{ann.text}</text>
            </g>
          );
          if (ann.type === 'sticky') return (
            <g key={ann.id} style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setOpenSticky(openSticky === ann.id ? null : ann.id); }}>
              <rect x={ann.x} y={ann.y} width={28} height={28} rx={5}
                fill={ann.color} stroke="#ca8a04" strokeWidth={1.5}
                filter={openSticky === ann.id ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' : undefined} />
              <text x={ann.x + 14} y={ann.y + 20} textAnchor="middle" fontSize={15}>📝</text>
              {openSticky === ann.id && (
                <foreignObject x={ann.x + 32} y={ann.y - 4} width={240} height={140}>
                  <StickyPopup ann={ann}
                    onUpdate={(c) => updateAnnotation(ann.id, { content: c } as any)}
                    onClose={() => setOpenSticky(null)}
                    onDelete={() => { deleteAnnotation(ann.id); setOpenSticky(null); }} />
                </foreignObject>
              )}
            </g>
          );
          if (ann.type === 'text') {
            // Text annotations are rendered as HTML elements outside the SVG
            // (see below) to avoid SVG foreignObject focus/keyboard issues.
            return null;
          }
          return null;
        })}

        {/* ── Selection outlines + resize handles ── */}
        {selectedIds.map((id) => {
          const ann = pageAnnots.find((a) => a.id === id);
          if (!ann) return null;
          const b = getBounds(ann);
          if (!b) return null;

          if (ann.type === 'text') {
            const isEditing = editingTextId === id;
            return (
              <g key={`sel-${id}`}>
                <rect
                  x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8}
                  fill="transparent"
                  stroke={isEditing ? 'var(--accent)' : '#0a84ff'}
                  strokeWidth={isEditing ? 2 : 1.5}
                  strokeDasharray={isEditing ? '0' : '5 3'}
                  rx={2}
                  style={{ pointerEvents: 'none' }}
                />
                {activeTool === 'select' && !isEditing && ann.type !== 'text' && <ResizeHandles ann={ann} />}
              </g>
            );
          }

          return (
            <g key={`sel-${id}`}>
              <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8}
                fill="none" stroke="#0a84ff" strokeWidth={1.5} strokeDasharray="5 3" rx={2}
                style={{ pointerEvents: 'none' }} />
              {activeTool === 'select' && <ResizeHandles ann={ann} />}
            </g>
          );
        })}
      </svg>

      {/* ── Text annotations (HTML, outside SVG for reliable focus/keyboard support) ── */}
      {pageAnnots.filter((a) => a.type === 'text').map((ann) => {
        const textAnn = ann as TextAnnotation;
        const isEditing = editingTextId === ann.id;
        const sel = selectedIds.includes(ann.id);
        const pe = activeTool === 'select' && !isEditing ? 'none' : 'all';
        return (
          <div
            key={ann.id}
            style={{
              position: 'absolute',
              left: textAnn.x,
              top: textAnn.y - RESERVE,
              zIndex: 5,
              pointerEvents: pe,
            }}
          >
            <InlineEditor
              ann={textAnn}
              selected={sel}
              editing={isEditing}
              pageHeight={height}
              pageId={pageId}
              onDelete={() => { deleteAnnotation(ann.id); setEditingTextId(null); }}
              onUpdate={(u) => updateAnnotation(ann.id, u as any)}
              onSelect={() => setSelectedIds([ann.id])}
              onBlurEmpty={() => { deleteAnnotation(ann.id); setEditingTextId(null); }}
            />
          </div>
        );
      })}

      {/* ── Draw canvas (finalized draw/arrow/line strokes) ── */}
      <canvas ref={drawCanvasRef} width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />

      {/* ── Preview canvas (live shape while dragging) ── */}
      <canvas ref={previewCanvasRef} width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />

      {/* ── Delete button for selection ── */}
      {selectedIds.length > 0 && activeTool === 'select' && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 20, pointerEvents: 'all', display: 'flex', gap: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); deleteSelected(); }}
            style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.4)' }}>
            ✕ Delete
          </button>
        </div>
      )}

      {/* ── Signature modal ── */}
      {signatureModalPos && (
        <SignatureModal
          onInsert={(dataUrl) => {
            const pos = signatureModalPos;
            setSignatureModalPos(null);
            const img = new Image();
            img.onload = () => {
              const maxW = Math.min(280, width * 0.5);
              const ratio = img.height / img.width;
              const w = Math.min(maxW, img.width);
              const h = w * ratio;
              addAnnotation({
                id: generateId(), type: 'signature', pageId,
                x: Math.max(0, pos.x - w / 2), y: Math.max(0, pos.y - h / 2),
                width: w, height: h, dataUrl,
              } as any);
            };
            img.src = dataUrl;
          }}
          onClose={() => setSignatureModalPos(null)}
        />
      )}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          pageW={width} pageH={height}
          hasClipboard={clipboard.length > 0}
          onClose={() => setCtxMenu(null)}
          onAction={(action) => {
            if (action === 'delete') {
              deleteAnnotation(ctxMenu.annId);
            } else if (action === 'copy') {
              copySelected();
            } else if (action === 'cut') {
              cutSelected();
            } else if (action === 'paste') {
              pasteAnnotations(pageId);
            } else {
              reorderAnnotation(ctxMenu.annId, action);
            }
            setCtxMenu(null);
          }}
        />
      )}
    </div>
  );
}

// ── Bounds helper ────────────────────────────────────────────────────────────
export function getBounds(ann: Annotation): { x: number; y: number; w: number; h: number } | null {
  if (ann.type === 'ellipse') return { x: ann.cx - ann.rx, y: ann.cy - ann.ry, w: ann.rx * 2, h: ann.ry * 2 };
  if (ann.type === 'draw') {
    if (!ann.points.length) return null;
    const xs = ann.points.map((p) => p.x), ys = ann.points.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (ann.type === 'line' || ann.type === 'arrow') {
    const x = Math.min(ann.x1, ann.x2), y = Math.min(ann.y1, ann.y2);
    return { x, y, w: Math.abs(ann.x2 - ann.x1) || 1, h: Math.abs(ann.y2 - ann.y1) || 1 };
  }
  if (ann.type === 'text')   return { x: ann.x, y: ann.y, w: ann.width ?? 200, h: ann.height ?? ann.fontSize * 1.6 };
  if (ann.type === 'sticky') return { x: ann.x, y: ann.y, w: 28, h: 28 };
  if ('x' in ann && 'width' in ann) return { x: (ann as any).x, y: (ann as any).y, w: (ann as any).width, h: (ann as any).height };
  return null;
}

// ── Inline text editor (contenteditable) ─────────────────────────────────────
// Positioned so the editing div sits exactly at ann.y.
// The wrapper div starts RESERVE px above so the floating toolbar has room.
const RESERVE = 42;

function placeCursorAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

function caretRangeAt(x: number, y: number): Range | null {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }
  // Firefox
  const pos = (document as any).caretPositionFromPoint?.(x, y);
  if (pos) {
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

function InlineEditor({ ann, selected, editing, onDelete, onUpdate, onSelect, onBlurEmpty, pageHeight, pageId }: {
  ann: TextAnnotation; selected: boolean; editing: boolean;
  onDelete: () => void; onUpdate: (u: Partial<TextAnnotation>) => void;
  onSelect: () => void; onBlurEmpty: () => void;
  pageHeight: number; pageId: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const autoPagedRef = useRef(false);
  const hasTypedRef = useRef(false);
  const coverCreatedRef = useRef(!!(ann as any).coverAnnId);
  // textVisible: false = transparent (for native PDF edits before first keystroke)
  const [textVisible, setTextVisible] = useState(true);
  const { addBlankPage } = useEditorStore();

  // On entering edit mode: set content once, place cursor at click position.
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;

    if (editing && !initializedRef.current) {
      initializedRef.current = true;
      autoPagedRef.current = false;
      hasTypedRef.current = false;
      coverCreatedRef.current = !!(ann as any).coverAnnId;
      el.innerText = ann.content;

      // For native PDF text edits: keep text invisible until first keystroke so
      // the original PDF canvas text remains visible (no visual change on click).
      // Cover rect is also created lazily on first keystroke only.
      const isNativeEdit = (ann as any).originalContent !== undefined;
      if (isNativeEdit && !coverCreatedRef.current) {
        setTextVisible(false);
      } else {
        setTextVisible(true);
      }

      el.focus();

      // Place cursor at click position or end
      const store = useEditorStore.getState();
      const clickPos = store.pendingEditClickPos;
      if (clickPos) {
        store.setPendingEditClickPos(null);
        const range = caretRangeAt(clickPos.x, clickPos.y);
        if (range && el.contains(range.startContainer)) {
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        } else {
          placeCursorAtEnd(el);
        }
      } else {
        placeCursorAtEnd(el);
      }
    } else if (!editing) {
      initializedRef.current = false;
      el.blur();
    }
  }, [editing]);

  // Auto-add a blank page when the editor content overflows the page bottom.
  useEffect(() => {
    if (!editing || !divRef.current) return;
    const el = divRef.current;
    const observer = new ResizeObserver(() => {
      if (autoPagedRef.current) return;
      if (ann.y + el.offsetHeight > pageHeight - 10) {
        autoPagedRef.current = true;
        addBlankPage(pageId);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [editing, ann.y, pageHeight, pageId, addBlankPage]);

  function handleInput() {
    if (!divRef.current) return;
    const content = divRef.current.innerText;
    onUpdate({ content });

    // On first keystroke: reveal text and lazily create the cover rect to hide
    // the underlying PDF canvas text (now that the overlay has different content).
    if (!hasTypedRef.current) {
      hasTypedRef.current = true;
      setTextVisible(true);
      if (!coverCreatedRef.current) {
        coverCreatedRef.current = true;
        const store = useEditorStore.getState();
        const coverId = generateId();
        store.addAnnotation({
          id: coverId, type: 'cover', pageId,
          x: ann.x - 2, y: ann.y - 2,
          width: (ann.width ?? 200) + 4,
          height: (ann.height ?? ann.fontSize * 1.6) + 4,
        });
        store.updateAnnotation(ann.id, { coverAnnId: coverId } as any);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!ann.content.trim()) onBlurEmpty();
      else divRef.current?.blur();
    }
    // Enter is handled natively by contenteditable — inserts a line break at the cursor
  }

  function handleBlur() {
    const content = divRef.current?.innerText ?? '';
    const original = (ann as any).originalContent as string | undefined;
    // Delete if empty, or if the user clicked a native PDF text line but made no changes
    if (!content.trim() || (original !== undefined && content === original)) {
      onBlurEmpty();
    }
  }

  const fontToUse = (ann as any).detectedFontFamily || ann.fontStack || ann.fontFamily || 'sans-serif';

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', minWidth: 10, marginTop: RESERVE, userSelect: editing ? 'text' : 'none' }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {editing && (
        <div
          style={{
            position: 'absolute', top: -(RESERVE - 4), left: 0,
            display: 'flex', gap: 3, zIndex: 30,
            background: 'var(--panel2)', borderRadius: 8, padding: '4px 6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(10,132,255,0.2)',
            whiteSpace: 'nowrap',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[
            { label: 'B', style: { fontWeight: 'bold' as const }, active: ann.bold, fn: () => onUpdate({ bold: !ann.bold }) },
            { label: 'I', style: { fontStyle: 'italic' as const }, active: ann.italic, fn: () => onUpdate({ italic: !ann.italic }) },
            { label: 'U', style: { textDecoration: 'underline' as const }, active: ann.underline, fn: () => onUpdate({ underline: !ann.underline }) },
          ].map(({ label, style, active, fn }) => (
            <button key={label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); fn(); }}
              style={{ ...style, fontSize: 12, color: active ? 'var(--accent-hover)' : 'var(--text-dim)', border: 'none', cursor: 'pointer', padding: '1px 5px', borderRadius: 4,
                background: active ? 'rgba(10,132,255,0.15)' : 'none' } as React.CSSProperties}>{label}</button>
          ))}
          <div style={{ width: 1, background: '#2a3244', margin: '0 2px' }} />
          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            style={{ fontSize: 11, color: '#f87171', border: 'none', background: 'none', cursor: 'pointer', padding: '1px 4px' }}>✕</button>
        </div>
      )}
      <div
        ref={divRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={{
          display: 'block',
          fontSize: ann.fontSize,
          color: textVisible ? ann.color : 'transparent',
          fontFamily: fontToUse,
          fontWeight: ann.bold ? 'bold' : 'normal',
          fontStyle: ann.italic ? 'italic' : 'normal',
          textDecoration: ann.underline ? 'underline' : 'none',
          textAlign: ann.align || 'left',
          // Zero visible border — the blinking cursor is the only edit indicator
          outline: 'none',
          border: selected && !editing ? '1px dashed rgba(10,132,255,0.25)' : '1px solid transparent',
          background: 'transparent',
          caretColor: '#2563eb',
          borderRadius: 2,
          padding: '0 1px',
          minWidth: 10,
          minHeight: ann.fontSize * 1.3,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.3,
          cursor: editing ? 'text' : 'default',
          userSelect: editing ? 'text' : 'none',
          pointerEvents: editing ? 'all' : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────
type CtxAction = 'front' | 'back' | 'forward' | 'backward' | 'copy' | 'cut' | 'paste' | 'delete';

function ContextMenu({ x, y, pageW, pageH, hasClipboard, onClose, onAction }: {
  x: number; y: number; pageW: number; pageH: number;
  hasClipboard: boolean;
  onClose: () => void;
  onAction: (action: CtxAction) => void;
}) {
  const menuW = 190, menuH = 270;
  const left = x + menuW > pageW ? x - menuW : x;
  const top  = y + menuH > pageH ? y - menuH : y;

  React.useEffect(() => {
    function dismiss(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') onClose(); return; }
      onClose();
    }
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', dismiss); };
  }, [onClose]);

  type Item = { label: string; icon: string; action: CtxAction; shortcut?: string; danger?: boolean; disabled?: boolean };
  type Separator = null;

  const items: Array<Item | Separator> = [
    { label: 'Cut',   icon: '✂', action: 'cut',   shortcut: '⌘X' },
    { label: 'Copy',  icon: '⧉', action: 'copy',  shortcut: '⌘C' },
    { label: 'Paste', icon: '⎘', action: 'paste', shortcut: '⌘V', disabled: !hasClipboard },
    null,
    { label: 'Bring to Front', icon: '⬆⬆', action: 'front' },
    { label: 'Bring Forward',  icon: '⬆',   action: 'forward' },
    { label: 'Send Backward',  icon: '⬇',   action: 'backward' },
    { label: 'Send to Back',   icon: '⬇⬇', action: 'back' },
    null,
    { label: 'Delete', icon: '✕', action: 'delete', danger: true },
  ];

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute', left, top, zIndex: 100, width: menuW,
        background: 'var(--panel)',
        border: '1px solid rgba(10,132,255,0.25)',
        borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(10,132,255,0.1)',
        padding: '4px 0', pointerEvents: 'all',
      }}
    >
      {items.map((item, i) => {
        if (item === null) return (
          <div key={`sep-${i}`} style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        );
        const { label, icon, action, shortcut, danger, disabled } = item;
        return (
          <div
            key={action}
            onClick={() => { if (!disabled) onAction(action); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px', cursor: disabled ? 'default' : 'pointer', fontSize: 12,
              color: disabled ? 'rgba(255,255,255,0.2)' : danger ? '#f87171' : 'var(--text-bright, #e2e8f0)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(239,68,68,0.1)' : 'rgba(10,132,255,0.12)'; }}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <span style={{ width: 18, textAlign: 'center', fontSize: 11, opacity: disabled ? 0.3 : 0.8 }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {shortcut && (
              <kbd style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'inherit' }}>
                {shortcut}
              </kbd>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sticky note popup ─────────────────────────────────────────────────────────
function StickyPopup({ ann, onUpdate, onClose, onDelete }: {
  ann: any; onUpdate: (c: string) => void; onClose: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#fefce8,#fef9c3)', border: '1px solid #ca8a04', borderRadius: 8,
      padding: '8px 10px', boxShadow: '2px 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'all', minWidth: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#78350f', fontWeight: 700, letterSpacing: 0.3 }}>{ann.author || 'Comment'}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onDelete} style={{ fontSize: 11, color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
          <button onClick={onClose}  style={{ fontSize: 11, color: '#78350f', border: 'none', background: 'none', cursor: 'pointer' }}>−</button>
        </div>
      </div>
      <textarea autoFocus value={ann.content} onChange={(e) => onUpdate(e.target.value)}
        placeholder="Add a comment…"
        style={{ width: '100%', minHeight: 80, fontSize: 11.5, color: '#1c1917', background: 'transparent',
          border: 'none', outline: 'none', resize: 'both', fontFamily: 'inherit', lineHeight: 1.5 }} />
    </div>
  );
}
