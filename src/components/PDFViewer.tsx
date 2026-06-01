import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEditorStore, generateId } from '../store/editorStore';
import { pdfDocCache } from '../lib/pdfCache';
import AnnotationLayer from './AnnotationLayer';
import FormFieldLayer from './FormFieldLayer';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface CanvasInfo { width: number; height: number; dataUrl?: string; }
export interface PDFViewerHandle { getCanvasInfos: () => CanvasInfo[]; }

interface PageState { pageId: string; canvasWidth: number; canvasHeight: number; }
interface TextItem { str: string; x: number; y: number; w: number; h: number; fontSize: number; fontFamily: string; bold: boolean; italic: boolean; }

// ── Text layer for a single page ─────────────────────────────────────────────
function TextLayer({ pageId, pdfPage, scale, rotation, width, height }: {
  pageId: string; pdfPage: pdfjsLib.PDFPageProxy | null;
  scale: number; rotation: number; width: number; height: number;
}) {
  const [items, setItems] = useState<TextItem[]>([]);
  const { activeTool, highlightColor, strokeColor, highlightOpacity, addAnnotation, setPendingEditTextId } = useEditorStore();

  useEffect(() => {
    if (!pdfPage) { setItems([]); return; }
    pdfPage.getTextContent().then((content) => {
      const vp = pdfPage.getViewport({ scale, rotation: rotation as 0|90|180|270 });
      const list: TextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
        const x = tx[4];
        const h = Math.abs(tx[3]) || 12;
        const y = tx[5] - h;
        const w = (item as any).width * scale;
        // Detect the CSS font family that PDF.js maps this font to, and infer bold/italic
        const fontNameKey = (item as any).fontName as string || '';
        const fontStyle = (content.styles as any)?.[fontNameKey] as { fontFamily?: string; fontSubstitution?: string } | undefined;
        const fontFamily = fontStyle?.fontFamily || 'sans-serif';
        // Check font name and mapped family for bold/italic descriptors
        const boldSrc = fontNameKey + ' ' + (fontStyle?.fontFamily ?? '') + ' ' + (fontStyle?.fontSubstitution ?? '');
        const isBold = /bold/i.test(boldSrc);
        const isItalic = /italic|oblique/i.test(boldSrc);
        list.push({ str: item.str, x, y, w, h, fontSize: h * 0.85, fontFamily, bold: isBold, italic: isItalic });
      }
      setItems(list);
    }).catch(() => setItems([]));
  }, [pdfPage, scale]);

  const canApplyMarkup = activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikethrough';
  const isEditText = activeTool === 'edit-text';

  function onTextMouseUp() {
    if (!canApplyMarkup) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    if (!rects.length) return;

    const layerEl = document.getElementById(`text-layer-${pageId}`);
    if (!layerEl) return;
    const base = layerEl.getBoundingClientRect();

    for (const r of rects) {
      const x = r.left - base.left, y = r.top - base.top;
      const w = r.width, h = r.height;
      if (w < 2) continue;
      const common = { id: generateId(), pageId };
      if (activeTool === 'highlight')
        addAnnotation({ ...common, type: 'highlight', x, y: y - 2, width: w, height: h + 4, color: highlightColor, opacity: highlightOpacity });
      else if (activeTool === 'underline')
        addAnnotation({ ...common, type: 'underline', x, y, width: w, height: h, color: strokeColor, strokeWidth: 2 });
      else if (activeTool === 'strikethrough')
        addAnnotation({ ...common, type: 'strikethrough', x, y, width: w, height: h, color: strokeColor, strokeWidth: 2 });
    }
    sel.removeAllRanges();
  }

  function onSpanClick(e: React.MouseEvent, clickedItem: TextItem) {
    if (!isEditText) return;
    e.stopPropagation();
    e.preventDefault();

    // Group all text items on the same visual line (within half a line-height vertically)
    // and sort left-to-right so the text reads naturally
    const lineItems = items
      .filter((other) => Math.abs(other.y - clickedItem.y) < clickedItem.h * 0.6)
      .sort((a, b) => a.x - b.x);

    const minX = Math.min(...lineItems.map((i) => i.x));
    const maxX = Math.max(...lineItems.map((i) => i.x + i.w));
    const minY = Math.min(...lineItems.map((i) => i.y));
    const maxH = Math.max(...lineItems.map((i) => i.h));
    const lineText = lineItems.map((i) => i.str).join(' ');
    const fontFamily = clickedItem.fontFamily || 'sans-serif';
    const lineW = maxX - minX;

    const textId = generateId();

    // Create the editable text overlay matching the original line's font + position.
    // The cover rect (white rectangle to hide original text) is NOT created here — it is
    // created lazily by InlineEditor on the first keystroke, so clicking text shows no box.
    addAnnotation({
      id: textId, type: 'text', pageId,
      x: minX, y: minY,
      width: lineW, height: maxH,
      content: lineText,
      originalContent: lineText,   // remembered so blur can detect whether anything changed
      fontSize: clickedItem.fontSize,
      color: '#000000',
      fontFamily,
      fontStack: fontFamily,
      detectedFontFamily: fontFamily,
      bold: clickedItem.bold, italic: clickedItem.italic, underline: false,
      align: 'left',
    } as any);

    // Store click coordinates so the editor can place cursor at the exact click position
    useEditorStore.getState().setPendingEditClickPos({ x: e.clientX, y: e.clientY });
    // Signal AnnotationLayer to enter edit mode, then switch back to select tool
    setPendingEditTextId(textId);
    useEditorStore.getState().setActiveTool('select');
  }

  // Fallback: clicking on empty space in edit-text mode creates a blank text box.
  // Span clicks call stopPropagation so this only fires when no text span was hit.
  function onLayerClick(e: React.MouseEvent) {
    if (!isEditText) return;
    const layerEl = document.getElementById(`text-layer-${pageId}`);
    if (!layerEl) return;
    const base = layerEl.getBoundingClientRect();
    const x = e.clientX - base.left;
    const y = e.clientY - base.top;
    const textId = generateId();
    addAnnotation({
      id: textId, type: 'text', pageId,
      x, y, width: 200, height: 16,
      content: '',
      fontSize: 14, color: '#000000',
      fontFamily: 'sans-serif', fontStack: 'sans-serif',
      bold: false, italic: false, underline: false,
      align: 'left',
    } as any);
    useEditorStore.getState().setPendingEditClickPos({ x: e.clientX, y: e.clientY });
    setPendingEditTextId(textId);
    useEditorStore.getState().setActiveTool('select');
  }

  const isMarkupOrSelect = activeTool === 'highlight' || activeTool === 'underline' ||
                           activeTool === 'strikethrough' || activeTool === 'select';

  return (
    <div
      id={`text-layer-${pageId}`}
      onMouseUp={onTextMouseUp}
      onClick={onLayerClick}
      style={{
        position: 'absolute', top: 0, left: 0, width, height,
        userSelect: isMarkupOrSelect ? 'text' : 'none',
        // edit-text needs pointer events too (AnnotationLayer is set to none when edit-text is active)
        pointerEvents: (isMarkupOrSelect || isEditText) ? 'auto' : 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          onClick={(e) => onSpanClick(e, item)}
          style={{
            position: 'absolute',
            left: item.x, top: item.y,
            width: item.w, height: item.h,
            fontSize: item.fontSize,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            whiteSpace: 'pre',
            color: 'transparent',
            cursor: isEditText ? 'text' : (isMarkupOrSelect ? 'text' : 'default'),
            overflow: 'hidden',
          }}
        >
          {item.str}
        </span>
      ))}
    </div>
  );
}

// ── Main PDF Viewer ───────────────────────────────────────────────────────────
const PDFViewer = forwardRef<PDFViewerHandle>(function PDFViewer(_, ref) {
  const { pages, pdfFile, originalPdfBytes, scale, currentPageId, setCurrentPageId } = useEditorStore();
  const [pageStates, setPageStates] = useState<PageState[]>([]);
  const [pdfPages, setPdfPages] = useState<Map<string, pdfjsLib.PDFPageProxy>>(new Map());
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const renderGen = useRef(0); // generation counter to cancel stale renders
  const renderTasks = useRef<Map<string, pdfjsLib.RenderTask>>(new Map()); // in-flight render per page

  useImperativeHandle(ref, () => ({
    getCanvasInfos: () => pageStates.map((ps) => ({
      width: ps.canvasWidth,
      height: ps.canvasHeight,
      dataUrl: canvasRefs.current.get(ps.pageId)?.toDataURL('image/jpeg', 0.92),
    })),
  }));

  // ── Load PDF document (use cache from App.tsx to avoid re-parsing) ──────────
  useEffect(() => {
    if (!originalPdfBytes || !pdfFile) { setPdfDoc(null); setPdfPages(new Map()); return; }
    const cached = pdfDocCache.get(pdfFile);
    if (cached) { setPdfDoc(cached); return; }
    // Fallback: parse if not cached (e.g. Electron menu open)
    let active = true;
    pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise.then((pdf) => {
      if (!active) return;
      pdfDocCache.set(pdfFile, pdf);
      setPdfDoc(pdf);
    });
    return () => { active = false; };
  }, [originalPdfBytes, pdfFile]);

  // ── Compute page canvas sizes ───────────────────────────────────────────────
  useEffect(() => {
    if (!pages.length) { setPageStates([]); return; }
    let cancelled = false;
    async function compute() {
      const states: PageState[] = [];
      const newPdfPages = new Map<string, pdfjsLib.PDFPageProxy>();
      for (const page of pages) {
        if (cancelled) return;
        let w: number, h: number;
        if (page.source === 'original' && pdfDoc && page.originalIndex !== undefined) {
          const pdfPage = await pdfDoc.getPage(page.originalIndex + 1);
          if (cancelled) return;
          const vp = pdfPage.getViewport({ scale, rotation: page.rotation });
          w = vp.width; h = vp.height;
          newPdfPages.set(page.id, pdfPage);
        } else {
          const rotated = page.rotation === 90 || page.rotation === 270;
          w = (rotated ? page.pdfHeight : page.pdfWidth) * scale;
          h = (rotated ? page.pdfWidth : page.pdfHeight) * scale;
        }
        states.push({ pageId: page.id, canvasWidth: Math.round(w), canvasHeight: Math.round(h) });
      }
      if (!cancelled) {
        setPageStates(states);
        setPdfPages(newPdfPages);
      }
    }
    compute();
    return () => { cancelled = true; };
  }, [pages, scale, pdfDoc]);

  // ── Render pages onto canvas ────────────────────────────────────────────────
  const renderPages = useCallback(async () => {
    const gen = ++renderGen.current;
    // Render at device pixel ratio so text is sharp on Retina / HiDPI displays.
    // pageStates stores CSS pixel dimensions; the canvas element is larger internally
    // but displayed at CSS size via canvas.style.width/height.
    const dpr = window.devicePixelRatio || 1;
    for (const ps of pageStates) {
      if (gen !== renderGen.current) break; // cancelled
      const page = pages.find((p) => p.id === ps.pageId);
      if (!page || page.source !== 'original' || page.originalIndex === undefined) continue;
      const canvas = canvasRefs.current.get(ps.pageId);
      if (!canvas) continue;
      if (!pdfDoc) continue;
      // Cancel any in-flight render targeting this same canvas before starting a new one.
      // Two concurrent render() calls on one canvas corrupt pdf.js's transform state and
      // can leave the page mirrored/rotated 180°, so renders must be serialized per canvas.
      const prev = renderTasks.current.get(ps.pageId);
      if (prev) {
        prev.cancel();
        try { await prev.promise; } catch { /* RenderingCancelledException expected */ }
        if (gen !== renderGen.current) break;
      }
      try {
        const pdfPage = await pdfDoc.getPage(page.originalIndex + 1);
        if (gen !== renderGen.current) break;
        // Guard against stale pageStates using CSS-pixel viewport
        const vpCss = pdfPage.getViewport({ scale, rotation: page.rotation });
        if (Math.round(vpCss.width) !== ps.canvasWidth || Math.round(vpCss.height) !== ps.canvasHeight) continue;
        // Render at full physical resolution
        const vpHiDpi = pdfPage.getViewport({ scale: scale * dpr, rotation: page.rotation });
        canvas.width = Math.round(vpHiDpi.width);
        canvas.height = Math.round(vpHiDpi.height);
        canvas.style.width = ps.canvasWidth + 'px';
        canvas.style.height = ps.canvasHeight + 'px';
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const task = pdfPage.render({ canvasContext: ctx, viewport: vpHiDpi, canvas });
        renderTasks.current.set(ps.pageId, task);
        await task.promise;
        renderTasks.current.delete(ps.pageId);
      } catch { /* render cancelled or failed — ignore */ }
    }
  }, [pageStates, scale, pages, pdfDoc]);

  useEffect(() => { renderPages(); }, [renderPages]);

  // ── Scroll to current page ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPageId) return;
    document.getElementById(`page-wrap-${currentPageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentPageId]);

  if (!pages.length) return null;

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '28px 40px' }}
    >
      {pageStates.map((ps, idx) => {
        const page = pages.find((p) => p.id === ps.pageId);
        if (!page) return null;
        const isCurrent = ps.pageId === currentPageId;
        const pdfPage = pdfPages.get(ps.pageId) ?? null;

        return (
          <div
            key={ps.pageId}
            id={`page-wrap-${ps.pageId}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            onClick={() => setCurrentPageId(ps.pageId)}
          >
            {/* Page label */}
            <div style={{ fontSize: 11, color: isCurrent ? '#7eb3ff' : '#555', userSelect: 'none', fontWeight: isCurrent ? 600 : 400, transition: 'color 0.15s' }}>
              Page {idx + 1}
            </div>

            {/* Page wrapper */}
            <div
              className="pdf-page-wrap"
              style={{
                width: ps.canvasWidth, height: ps.canvasHeight,
                outline: isCurrent ? '2px solid #4f7bff' : '1px solid rgba(0,0,0,0.15)',
                outlineOffset: isCurrent ? 2 : 0,
                transition: 'outline 0.15s',
              }}
            >
              {/* PDF canvas (original pages) or blank white (new pages) */}
              {page.source === 'blank' ? (
                <div style={{ width: ps.canvasWidth, height: ps.canvasHeight, background: 'white' }} />
              ) : (
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(ps.pageId, el);
                    else canvasRefs.current.delete(ps.pageId);
                  }}
                  style={{ display: 'block', width: ps.canvasWidth, height: ps.canvasHeight }}
                />
              )}

              {/* Text layer — for text selection → markup */}
              {page.source === 'original' && pdfPage && (
                <TextLayer
                  pageId={ps.pageId}
                  pdfPage={pdfPage}
                  scale={scale}
                  rotation={page.rotation}
                  width={ps.canvasWidth}
                  height={ps.canvasHeight}
                />
              )}

              {/* Form field layer — renders AcroForm widgets */}
              {page.source === 'original' && pdfPage && (
                <FormFieldLayer pdfPage={pdfPage} scale={scale} />
              )}

              {/* Annotation interaction layer — above text and form layers */}
              <AnnotationLayer
                pageId={ps.pageId}
                width={ps.canvasWidth}
                height={ps.canvasHeight}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default PDFViewer;
