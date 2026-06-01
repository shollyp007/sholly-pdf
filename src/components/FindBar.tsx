import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEditorStore } from '../store/editorStore';

interface Match { pageIndex: number; pageId: string; text: string; }

export default function FindBar() {
  const { findQuery, setFindQuery, setShowFindBar, pages, originalPdfBytes } = useEditorStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load PDF for text extraction
  useEffect(() => {
    if (!originalPdfBytes) return;
    pdfjsLib.getDocument({ data: originalPdfBytes.slice(0) }).promise.then((pdf) => {
      pdfRef.current = pdf;
    });
  }, [originalPdfBytes]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setMatches([]); return; }
    setSearching(true);
    const found: Match[] = [];
    const lower = q.toLowerCase();

    if (pdfRef.current) {
      for (let i = 0; i < pdfRef.current.numPages; i++) {
        const page = pages[i];
        const pageId = page?.id ?? '';
        try {
          const pdfPage = await pdfRef.current.getPage(i + 1);
          const content = await pdfPage.getTextContent();
          const text = content.items.filter((it): it is { str: string } & typeof it => 'str' in it && typeof (it as any).str === 'string').map((it) => (it as any).str as string).join(' ');
          if (text.toLowerCase().includes(lower)) {
            found.push({ pageIndex: i, pageId, text });
          }
        } catch { /* skip */ }
      }
    } else {
      // No PDF — just return no results
    }

    setMatches(found);
    setMatchIndex(0);
    if (found.length > 0) scrollToMatch(found[0]);
    setSearching(false);
  }, [pages]);

  function scrollToMatch(m: Match) {
    const el = document.getElementById(`page-wrap-${m.pageId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function next() {
    if (!matches.length) return;
    const idx = (matchIndex + 1) % matches.length;
    setMatchIndex(idx);
    scrollToMatch(matches[idx]);
  }

  function prev() {
    if (!matches.length) return;
    const idx = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(idx);
    scrollToMatch(matches[idx]);
  }

  function close() {
    setShowFindBar(false);
    setFindQuery('');
    setMatches([]);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
      background: 'var(--panel2)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>🔍</span>
      <input
        ref={inputRef}
        className="sp-input"
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.shiftKey ? prev() : doSearch(findQuery); }
          if (e.key === 'Escape') close();
        }}
        placeholder="Find text in document…"
        style={{ width: 280 }}
      />
      <button className="sp-btn sp-btn-primary" onClick={() => doSearch(findQuery)} disabled={searching}
        style={{ padding: '4px 14px', fontSize: 12 }}>
        {searching ? '…' : 'Find'}
      </button>
      <button className="sp-btn" onClick={prev} disabled={matches.length === 0} style={{ padding: '4px 10px' }}>◀</button>
      <button className="sp-btn" onClick={next} disabled={matches.length === 0} style={{ padding: '4px 10px' }}>▶</button>

      {/* Results */}
      <span style={{ fontSize: 11.5, color: matches.length > 0 ? '#7eb3ff' : 'var(--text-dim)', minWidth: 90, flexShrink: 0 }}>
        {searching ? 'Searching…' :
         matches.length === 0 && findQuery ? 'No results' :
         matches.length > 0 ? `${matchIndex + 1} of ${matches.length} page${matches.length !== 1 ? 's' : ''}` :
         'Enter text to search'}
      </span>

      {/* Match list */}
      {matches.length > 0 && (
        <div style={{ display: 'flex', gap: 4, overflow: 'hidden', flex: 1 }}>
          {matches.map((m, i) => (
            <button key={i} onClick={() => { setMatchIndex(i); scrollToMatch(m); }}
              style={{
                padding: '2px 8px', borderRadius: 4, border: '1px solid', fontSize: 11,
                borderColor: i === matchIndex ? '#4f7bff' : 'var(--border)',
                background: i === matchIndex ? 'var(--accent-light)' : 'var(--panel2)',
                color: i === matchIndex ? '#7eb3ff' : 'var(--text-dim)', cursor: 'pointer',
              }}>
              p.{m.pageIndex + 1}
            </button>
          ))}
        </div>
      )}

      <button onClick={close} className="sp-btn"
        style={{ marginLeft: 'auto', padding: '3px 8px', flexShrink: 0 }}>✕</button>
    </div>
  );
}
