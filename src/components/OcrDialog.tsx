import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ocrPageImage } from '../lib/ocr';
import type { CanvasInfo } from './PDFViewer';

export default function OcrDialog({ onClose, canvasInfos }: { onClose: () => void; canvasInfos: CanvasInfo[] }) {
  const { pages, setPageOcr } = useEditorStore();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(0);
  const [pageProgress, setPageProgress] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false; // reset on (re)mount — StrictMode runs effects twice in dev
    return () => { cancelled.current = true; };
  }, []);

  async function run() {
    setRunning(true); setError(null); setWordCount(0);
    let total = 0;
    try {
      for (let i = 0; i < pages.length; i++) {
        if (cancelled.current) return;
        const info = canvasInfos[i];
        setPageNum(i + 1); setPageProgress(0);
        if (!info?.dataUrl) continue;
        const words = await ocrPageImage(info.dataUrl, info.width, info.height, (p) => setPageProgress(p));
        if (cancelled.current) return;
        setPageOcr(pages[i].id, words);
        total += words.length;
        setWordCount(total);
      }
      setDone(true);
      setRunning(false);
    } catch (e) {
      console.error(e);
      setError('Text recognition failed. Please try again.');
      setRunning(false);
    }
  }

  const overall = pages.length ? ((pageNum - 1) + pageProgress) / pages.length : 0;

  return (
    <div className="dialog-backdrop" onClick={running ? undefined : onClose}>
      <div className="dialog-card slide-in" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="dialog-title">Make Searchable (OCR)</div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✓</div>
            <span style={{ color: 'var(--text-bright)', fontWeight: 700, fontSize: 15 }}>Recognized {wordCount} words</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5, maxWidth: 360 }}>
              The document is now searchable. Saved or exported PDFs will include a selectable, searchable text layer over the scanned pages.
            </span>
            <button className="sp-btn sp-btn-primary" style={{ marginTop: 6, minWidth: 120 }} onClick={onClose}>Done</button>
          </div>
        ) : running ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0 6px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Recognizing text — page {pageNum} of {pages.length}…
            </div>
            <div style={{ height: 8, borderRadius: 5, background: 'var(--panel2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(overall * 100)}%`, background: 'var(--accent)', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {wordCount} words so far. This runs entirely on your device — no internet needed. Larger documents take a little longer.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 16 }}>
              Scan every page for text and add a searchable, selectable layer — ideal for scanned or photographed documents. Recognition runs offline on your device.
            </div>
            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                ⚠ {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sp-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="sp-btn sp-btn-primary" style={{ flex: 2 }} onClick={run} disabled={!pages.length}>
                Recognize text
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
