import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEditorStore } from '../store/editorStore';

export default function Sidebar() {
  const {
    pages, currentPageId, setCurrentPageId, originalPdfBytes,
    leftPanelTab, setLeftPanelTab, annotations,
    addBlankPage, deletePage, duplicatePage, rotatePage, movePage,
  } = useEditorStore();

  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!originalPdfBytes) return;
    pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise.then((pdf) => {
      pdfRef.current = pdf;
      renderThumbs();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalPdfBytes]);

  useEffect(() => { renderThumbs(); }, [pages]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function renderThumbs() {
    const dpr = window.devicePixelRatio || 1;
    const thumbScale = 0.18;
    const map = new Map<string, string>();
    for (const page of pages) {
      if (page.source === 'original' && pdfRef.current && page.originalIndex !== undefined) {
        try {
          const p = await pdfRef.current.getPage(page.originalIndex + 1);
          const vpHiDpi = p.getViewport({ scale: thumbScale * dpr, rotation: page.rotation });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(vpHiDpi.width);
          canvas.height = Math.round(vpHiDpi.height);
          await p.render({ canvasContext: canvas.getContext('2d')!, viewport: vpHiDpi, canvas }).promise;
          map.set(page.id, canvas.toDataURL());
        } catch { /* skip */ }
      }
    }
    setThumbs(map);
  }

  const commentAnnots = annotations.filter((a) => a.type === 'sticky' || a.type === 'text' || a.type === 'highlight');

  const TABS = [
    { id: 'pages'     as const, icon: '📄', label: 'Pages',     count: pages.length },
    { id: 'bookmarks' as const, icon: '🔖', label: 'Bookmarks', count: 0 },
    { id: 'comments'  as const, icon: '💬', label: 'Comments',  count: commentAnnots.length },
  ];

  return (
    <div style={{
      width: 210, background: 'var(--panel)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'var(--panel2)',
      }}>
        {TABS.map((tab) => {
          const isActive = leftPanelTab === tab.id;
          return (
            <button key={tab.id}
              onClick={() => setLeftPanelTab(tab.id)}
              title={tab.label}
              style={{
                flex: 1, padding: '8px 4px 6px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--text-bright)' : 'var(--text-muted)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget).style.color = 'var(--text-dim)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget).style.color = 'var(--text-muted)'; }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 9.5, fontWeight: isActive ? 600 : 400, letterSpacing: 0.2, lineHeight: 1 }}>
                {tab.label}
              </span>
              {tab.count > 0 && (
                <span style={{
                  fontSize: 8.5, background: isActive ? 'var(--accent)' : 'var(--border)',
                  color: isActive ? '#fff' : 'var(--text-dim)',
                  borderRadius: 8, padding: '0 4px', minWidth: 14, textAlign: 'center', lineHeight: '14px',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Pages panel ─────────────────────────────────────────────────────── */}
      {leftPanelTab === 'pages' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pages.map((page, idx) => {
              const thumb = thumbs.get(page.id);
              const isActive = page.id === currentPageId;
              const isDragOver = page.id === dragOverId;
              const ratio = page.pdfHeight / page.pdfWidth;
              const thumbW = 118;
              const thumbH = Math.min(Math.round(thumbW * ratio), 170);

              return (
                <div
                  key={page.id}
                  draggable
                  onDragStart={(e) => { setDraggingId(page.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(page.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId && draggingId !== page.id) movePage(draggingId, page.id);
                    setDragOverId(null); setDraggingId(null);
                  }}
                  onClick={() => {
                    setCurrentPageId(page.id);
                    document.getElementById(`page-wrap-${page.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  onMouseEnter={(e) => {
                    const overlay = e.currentTarget.querySelector<HTMLElement>('.thumb-actions');
                    if (overlay) overlay.style.display = 'flex';
                  }}
                  onMouseLeave={(e) => {
                    const overlay = e.currentTarget.querySelector<HTMLElement>('.thumb-actions');
                    if (overlay) overlay.style.display = 'none';
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    cursor: 'pointer', padding: '6px', borderRadius: 8,
                    border: isDragOver ? '2px dashed rgba(10,132,255,0.6)' : '2px solid transparent',
                    background: isActive ? 'rgba(10,132,255,0.12)' : 'transparent',
                    outline: isActive ? '1px solid rgba(10,132,255,0.35)' : 'none',
                    transition: 'background 0.12s',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: thumbW, height: thumbH,
                    background: 'white', borderRadius: 3, overflow: 'hidden',
                    border: isActive ? '1.5px solid rgba(10,132,255,0.7)' : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isActive ? '0 0 0 2px rgba(10,132,255,0.2)' : '0 2px 6px rgba(0,0,0,0.3)',
                    position: 'relative', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {thumb
                      ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'white' }} />
                    }
                    {page.rotation !== 0 && (
                      <div style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(10,132,255,0.85)', color: '#fff', fontSize: 8, borderRadius: 3, padding: '1px 4px' }}>
                        {page.rotation}°
                      </div>
                    )}
                    {/* Hover actions */}
                    <div className="thumb-actions" style={{
                      display: 'none', position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.55)',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <button onClick={(e) => { e.stopPropagation(); rotatePage(page.id, 'cw'); }}
                        style={{ fontSize: 18, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '2px 8px' }} title="Rotate CW">↻</button>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }}
                          style={{ fontSize: 13, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#94a3b8', cursor: 'pointer', padding: '2px 6px' }} title="Duplicate">⧉</button>
                        <button onClick={(e) => { e.stopPropagation(); if (pages.length > 1) deletePage(page.id); }}
                          style={{ fontSize: 13, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#f87171', cursor: 'pointer', padding: '2px 6px' }} title="Delete">✕</button>
                      </div>
                    </div>
                  </div>

                  {/* Page number */}
                  <span style={{ fontSize: 10.5, color: isActive ? '#409cff' : 'var(--text-dim)', fontWeight: isActive ? 600 : 400 }}>
                    {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Add page button */}
          <div style={{ padding: '8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => addBlankPage(currentPageId ?? undefined)}
              style={{
                width: '100%', padding: '7px', border: '1px dashed rgba(255,255,255,0.12)',
                borderRadius: 7, background: 'transparent', color: 'var(--text-dim)',
                cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = 'var(--text-bright)'; (e.currentTarget).style.borderColor = 'rgba(10,132,255,0.4)'; (e.currentTarget).style.background = 'rgba(10,132,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = 'var(--text-dim)'; (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget).style.background = 'transparent'; }}
            >
              + Add Page
            </button>
          </div>
        </>
      )}

      {/* ── Bookmarks panel ─────────────────────────────────────────────────── */}
      {leftPanelTab === 'bookmarks' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }}>
          <span style={{ fontSize: 36, opacity: 0.4 }}>🔖</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
            No bookmarks in this document
          </span>
        </div>
      )}

      {/* ── Comments panel ──────────────────────────────────────────────────── */}
      {leftPanelTab === 'comments' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {commentAnnots.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: 20 }}>
              <span style={{ fontSize: 36, opacity: 0.4 }}>💬</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
                No comments yet.<br />Use the Highlight or Sticky Note tools to add comments.
              </span>
            </div>
          ) : (
            commentAnnots.map((a) => {
              const pageIdx = pages.findIndex((p) => p.id === a.pageId);
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setCurrentPageId(a.pageId);
                    document.getElementById(`page-wrap-${a.pageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  style={{
                    background: 'var(--panel2)', borderRadius: 8, padding: '8px 10px',
                    fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(10,132,255,0.4)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>
                      {a.type === 'sticky' ? '📝' : a.type === 'highlight' ? '▬' : 'T'}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 500 }}>
                      {a.type === 'sticky' ? 'Sticky Note' : a.type === 'highlight' ? 'Highlight' : 'Text'}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 9.5 }}>
                      p.{pageIdx + 1}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {(a as any).content || (a as any).color || '(no text)'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
