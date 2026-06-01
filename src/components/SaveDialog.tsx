import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { buildPdfBytes, pickSaveTarget, writeToTarget, saveToHandle } from '../lib/pdfExport';
import { encryptPdf } from '../lib/pdfEncrypt';
import type { CanvasInfo } from './PDFViewer';
import type { SaveTarget } from '../lib/pdfExport';

type Mode = 'save' | 'saveAs' | 'export' | 'copy';

// Whether the browser supports the File System Access API (lets user pick folder)
const hasFSAPI = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
const hasElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
const canPickLocation = hasFSAPI || hasElectron;

export default function SaveDialog({ onClose, canvasInfos }: { onClose: () => void; canvasInfos: CanvasInfo[] }) {
  const {
    docName, setDocName, pages, annotations, originalPdfBytes,
    lastSavedHandle, setLastSavedHandle, markSaved, formFieldValues,
  } = useEditorStore();

  const [mode, setMode] = useState<Mode>(lastSavedHandle ? 'save' : 'saveAs');
  const [filename, setFilename] = useState(docName || 'document');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [savedLocation, setSavedLocation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState('');
  const [restrict, setRestrict] = useState(false);

  // Build the PDF bytes, applying password encryption when requested.
  async function buildBytes(): Promise<Uint8Array> {
    const bytes = await buildPdfBytes({ originalBytes: originalPdfBytes, pages, annotations, canvasInfos, formFieldValues });
    if (protect && password.trim()) {
      return encryptPdf(bytes, { password: password.trim(), restrict });
    }
    return bytes;
  }

  async function handleSave() {
    setError(null);

    // ── Plain Save (overwrite existing handle) ────────────────────────────────
    if (mode === 'save' && lastSavedHandle) {
      setLoading(true);
      try {
        const bytes = await buildBytes();
        await saveToHandle(bytes, lastSavedHandle);
        markSaved();
        const loc = lastSavedHandle.name.split('/').pop() ?? lastSavedHandle.name;
        setSavedLocation(lastSavedHandle.name.startsWith('/') ? lastSavedHandle.name : `📥 Downloads → ${loc}`);
        setDone(true);
        setTimeout(onClose, 3500);
      } catch (e) {
        console.error(e);
        setError('Save failed. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Save As (pick location) ────────────────────────────────────────────────
    if (mode === 'saveAs') {
      // IMPORTANT: call pickSaveTarget FIRST while still in the click gesture
      let target: SaveTarget | null;
      try {
        target = await pickSaveTarget(filename + '.pdf');
      } catch {
        setError('Could not open the save dialog. Try "Export PDF" to download instead.');
        return;
      }
      if (!target) return; // user cancelled

      setLoading(true);
      try {
        const bytes = await buildBytes();
        const path = await writeToTarget(bytes, target, filename + '.pdf');

        if (target.kind === 'fsapi') setLastSavedHandle(target.handle);
        else if (target.kind === 'electron') setLastSavedHandle({ name: target.path } as unknown as FileSystemFileHandle);
        setDocName(filename);
        markSaved();
        setSavedLocation(path);
        setDone(true);
        setTimeout(onClose, 3500);
      } catch (e) {
        console.error(e);
        setError('Failed to write the file. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Export PDF (pick location if available, otherwise download) ──────────
    if (mode === 'export') {
      const exportName = filename.replace(/\.pdf$/i, '') + '.pdf';
      let target: SaveTarget | null = null;
      if (canPickLocation) {
        try {
          target = await pickSaveTarget(exportName);
        } catch { /* ignore — fall back to download */ }
        if (target === null) return; // user cancelled
      }

      setLoading(true);
      try {
        const bytes = await buildBytes();
        if (target) {
          const path = await writeToTarget(bytes, target, exportName);
          setSavedLocation(path);
        } else {
          triggerDownload(bytes, exportName);
          setSavedLocation('Downloads folder');
        }
        setDone(true);
        setTimeout(onClose, 3500);
      } catch (e) {
        console.error(e);
        setError('Export failed. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Save a Copy (pick location if available, otherwise download) ──────────
    if (mode === 'copy') {
      const copyName = filename.replace(/\.pdf$/i, '') + ' (copy).pdf';
      let target: SaveTarget | null = null;
      if (canPickLocation) {
        try {
          target = await pickSaveTarget(copyName);
        } catch { /* ignore — fall back to download */ }
        if (target === null) return; // user cancelled
      }

      setLoading(true);
      try {
        const bytes = await buildBytes();
        if (target) {
          const path = await writeToTarget(bytes, target, copyName);
          setSavedLocation(path);
        } else {
          triggerDownload(bytes, copyName);
          setSavedLocation('Downloads folder');
        }
        setDone(true);
        setTimeout(onClose, 3500);
      } catch (e) {
        console.error(e);
        setError('Save a Copy failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  }

  const opts: Array<{ id: Mode; icon: string; title: string; desc: string }> = [
    ...(lastSavedHandle
      ? [{ id: 'save' as Mode, icon: '💾', title: 'Save', desc: `Overwrite  "${lastSavedHandle.name.split('/').pop()}"` }]
      : []),
    {
      id: 'saveAs',
      icon: '📁',
      title: 'Save As…',
      desc: canPickLocation
        ? 'Choose a folder and filename on your computer'
        : 'Name your file and download it',
    },
    { id: 'export', icon: '⬇', title: 'Export PDF',    desc: 'Download a copy with a custom filename' },
    { id: 'copy',   icon: '⧉', title: 'Save a Copy',   desc: 'Download as "filename (copy).pdf"' },
  ];

  // Destination hint shown before saving
  const destHint = (canPickLocation && (mode === 'saveAs' || mode === 'export' || mode === 'copy'))
    ? '📁 A folder picker will open so you can choose exactly where to save the file.'
    : (mode === 'saveAs' || mode === 'export' || mode === 'copy')
      ? '📥 Your browser will save the file to your Downloads folder. To choose a specific location, use Chrome or Edge.'
      : null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card slide-in" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <div className="dialog-title">Save Document</div>

        {done ? (
          /* ── Success state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✓</div>
            <span style={{ color: 'var(--text-bright)', fontWeight: 700, fontSize: 15 }}>Saved successfully</span>
            {savedLocation && (
              <div style={{ width: '100%', padding: '0 8px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center', marginBottom: 6 }}>File location</div>
                <div style={{
                  fontSize: 12, color: '#93c5fd',
                  background: 'rgba(79,123,255,0.1)', border: '1px solid rgba(79,123,255,0.25)',
                  borderRadius: 8, padding: '8px 14px', wordBreak: 'break-all', textAlign: 'center',
                  lineHeight: 1.5,
                }}>
                  {savedLocation === 'Downloads folder'
                    ? '📥 Downloads folder — check your browser\'s download bar'
                    : `📄 ${savedLocation}`}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mode selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {opts.map((opt) => (
                <button key={opt.id} onClick={() => setMode(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '10px 14px', borderRadius: 10,
                    border: '1px solid', cursor: 'pointer', textAlign: 'left', transition: 'all 0.13s',
                    borderColor: mode === opt.id ? 'rgba(79,123,255,0.5)' : 'var(--border)',
                    background: mode === opt.id ? 'rgba(79,123,255,0.1)' : 'var(--panel2)',
                  }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: mode === opt.id ? 'rgba(79,123,255,0.15)' : 'var(--panel3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: mode === opt.id ? '#7eb3ff' : 'var(--text-dim)', flexShrink: 0 }}>{opt.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: mode === opt.id ? '#93c5fd' : 'var(--text-bright)' }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{opt.desc}</div>
                  </div>
                  {mode === opt.id && <span style={{ color: '#60a5fa', fontSize: 14, flexShrink: 0 }}>✓</span>}
                </button>
              ))}
            </div>

            {/* Filename input */}
            {(mode === 'saveAs' || mode === 'export' || mode === 'copy') && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Filename</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="sp-input" value={filename} onChange={(e) => setFilename(e.target.value)}
                    style={{ flex: 1 }} placeholder="document" />
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>.pdf</span>
                </div>
              </div>
            )}

            {/* Password protection */}
            <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', background: protect ? 'rgba(79,123,255,0.07)' : 'var(--panel2)' }}>
                <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>🔒 Password protect</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>Encrypt this PDF</span>
              </label>
              {protect && (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)' }}>
                  <input
                    className="sp-input" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password to open the document"
                    autoComplete="new-password"
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />
                    Also prevent copying &amp; editing
                  </label>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Recipients will need this password to open the file. Keep it safe — it can't be recovered.
                  </div>
                </div>
              )}
            </div>

            {/* Destination hint */}
            {destHint && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(79,123,255,0.07)', border: '1px solid rgba(79,123,255,0.18)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                {destHint}
              </div>
            )}

            {/* Warn if protection is on but no password typed */}
            {protect && !password.trim() && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, fontSize: 12, color: '#eab308' }}>
                Enter a password, or uncheck “Password protect” to save without encryption.
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sp-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="sp-btn sp-btn-primary" style={{ flex: 2, gap: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={handleSave} disabled={loading || (protect && !password.trim())}>
                {loading
                  ? <><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> {protect ? 'Encrypting…' : 'Saving…'}</>
                  : (protect ? '🔒 ' : '') + (opts.find((o) => o.id === mode)?.title ?? 'Save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  // Use a base64 data URL instead of a blob: URL — works universally including
  // old Safari versions that append a .download extension to blob: URL downloads.
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, Math.min(i + chunk, bytes.length)) as any));
  }
  const dataUrl = 'data:application/pdf;base64,' + btoa(binary);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
