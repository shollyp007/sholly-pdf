import React, { useRef, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore, newPageId } from './store/editorStore';
import { pdfDocCache } from './lib/pdfCache';
import ToolRibbon from './components/ToolRibbon';
import PDFViewer, { type PDFViewerHandle } from './components/PDFViewer';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import FindBar from './components/FindBar';
import NewDocDialog from './components/NewDocDialog';
import SaveDialog from './components/SaveDialog';
import UpdateDialog from './components/UpdateDialog';
import LicenseGate from './components/LicenseGate';
import RulerArea from './components/Rulers';
import type { DocPage, AppTab } from './types';

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', flexShrink: 0 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg, #3b6fd4 0%, #7c3aed 100%)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 3px 12px rgba(10,132,255,0.4)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 17, color: 'white', fontWeight: 900, letterSpacing: -0.5 }}>S</span>
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-bright)', letterSpacing: -0.4 }}>Sholly</div>
        <div style={{ fontSize: 8.5, background: 'linear-gradient(90deg,#4f7bff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2.5, fontWeight: 700 }}>PDF</div>
      </div>
    </div>
  );
}

// ─── Shared menu helpers ──────────────────────────────────────────────────────
interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: string;
  fn: () => void;
  disabled?: boolean;
}

function MenuBtn({ label, open, btnRef, onClick }: { label: string; open: boolean; btnRef: React.RefObject<HTMLButtonElement | null>; onClick: () => void }) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      style={{
        padding: '4px 12px',
        background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: '1px solid ' + (open ? 'rgba(255,255,255,0.12)' : 'transparent'),
        color: open ? 'var(--text-bright)' : 'var(--text-dim)', cursor: 'pointer',
        borderRadius: 6, fontSize: 12.5, fontWeight: 500, transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget).style.color = 'var(--text-bright)'; (e.currentTarget).style.background = 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={(e) => { if (!open) { (e.currentTarget).style.color = 'var(--text-dim)'; (e.currentTarget).style.background = 'transparent'; } }}>
      {label}
    </button>
  );
}

/** Renders a solid menu panel via portal — bypasses backdrop-filter stacking context */
function MenuPortal({ open, btnRef, panelRef, children }: {
  open: boolean;
  btnRef: React.RefObject<HTMLButtonElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 238);
      setPos({ top: r.bottom + 4, left });
    }
  }, [open, btnRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div ref={panelRef} style={{
      position: 'fixed', top: pos.top, left: pos.left, width: 234,
      background: 'var(--panel)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 12,
      boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)',
      zIndex: 9999, padding: '6px',
    }}>
      {children}
    </div>,
    document.body
  );
}

function MenuItems({ items, close }: { items: Array<MenuItem | null>; close: () => void }) {
  return (
    <>
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.09)', margin: '4px 0' }} />
        ) : (
          <button key={item.label} disabled={item.disabled}
            onClick={() => { item.fn(); close(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8,
              color: item.disabled ? 'var(--text-muted)' : 'var(--text)',
              cursor: item.disabled ? 'default' : 'pointer', fontSize: 12.5, gap: 8, textAlign: 'left',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { if (!item.disabled) { (e.currentTarget).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget).style.color = '#fff'; } }}
            onMouseLeave={(e) => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = item.disabled ? 'var(--text-muted)' : 'var(--text)'; }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {item.icon && <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: 0.75 }}>{item.icon}</span>}
              {item.label}
            </span>
            {item.shortcut && (
              <kbd style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'inherit' }}>{item.shortcut}</kbd>
            )}
          </button>
        )
      )}
    </>
  );
}

function useMenuClose(
  btnRef: React.RefObject<HTMLButtonElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>,
  setOpen: (v: boolean) => void
) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [btnRef, panelRef, setOpen]);
}

// ─── File menu ────────────────────────────────────────────────────────────────
function FileDropdown({ onNew, onOpen, onSave, canSave }: { onNew: () => void; onOpen: () => void; onSave: () => void; canSave: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useMenuClose(btnRef, panelRef, setOpen);

  const items: Array<MenuItem | null> = [
    { label: 'New Document…', shortcut: '⌘N', fn: onNew, icon: '✦' },
    { label: 'Open PDF…',     shortcut: '⌘O', fn: onOpen, icon: '⬆' },
    null,
    { label: 'Save…', shortcut: '⌘S', fn: onSave, icon: '📁', disabled: !canSave },
    { label: 'Print…', shortcut: '⌘P', fn: () => window.print(), icon: '⎙', disabled: !canSave },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <MenuBtn label="File" open={open} btnRef={btnRef} onClick={() => setOpen((v) => !v)} />
      <MenuPortal open={open} btnRef={btnRef} panelRef={panelRef}>
        <MenuItems items={items} close={() => setOpen(false)} />
      </MenuPortal>
    </div>
  );
}

// ─── Edit menu ────────────────────────────────────────────────────────────────
function EditDropdown({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useMenuClose(btnRef, panelRef, setOpen);
  // Read live state for disabled checks — re-evaluated on every render
  const { historyIndex, history, selectedIds, clipboard } = useEditorStore();
  const hasSelection = selectedIds.length > 0;
  const hasClipboard = clipboard.length > 0;

  const items: Array<MenuItem | null> = [
    {
      label: 'Undo', shortcut: '⌘Z', icon: '↩',
      fn: () => useEditorStore.getState().undo(),
      disabled: !canEdit || historyIndex <= 0,
    },
    {
      label: 'Redo', shortcut: '⌘Y', icon: '↪',
      fn: () => useEditorStore.getState().redo(),
      disabled: !canEdit || historyIndex >= history.length - 1,
    },
    null,
    {
      label: 'Cut', shortcut: '⌘X', icon: '✂',
      fn: () => useEditorStore.getState().cutSelected(),
      disabled: !canEdit || !hasSelection,
    },
    {
      label: 'Copy', shortcut: '⌘C', icon: '⧉',
      fn: () => useEditorStore.getState().copySelected(),
      disabled: !canEdit || !hasSelection,
    },
    {
      label: 'Paste', shortcut: '⌘V', icon: '⎘',
      fn: () => useEditorStore.getState().pasteAnnotations(),
      disabled: !canEdit || !hasClipboard,
    },
    null,
    {
      label: 'Select Tool', shortcut: 'V', icon: '↖',
      fn: () => useEditorStore.getState().setActiveTool('select'),
      disabled: !canEdit,
    },
    {
      label: 'Delete Selected', shortcut: 'Del', icon: '⌫',
      fn: () => useEditorStore.getState().deleteSelected(),
      disabled: !canEdit || !hasSelection,
    },
    null,
    {
      label: 'Find Text…', shortcut: '⌘F', icon: '🔍',
      fn: () => {
        const s = useEditorStore.getState();
        s.setShowFindBar(!s.showFindBar);
      },
      disabled: !canEdit,
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <MenuBtn label="Edit" open={open} btnRef={btnRef} onClick={() => setOpen((v) => !v)} />
      <MenuPortal open={open} btnRef={btnRef} panelRef={panelRef}>
        <MenuItems items={items} close={() => setOpen(false)} />
      </MenuPortal>
    </div>
  );
}

// ─── View menu ────────────────────────────────────────────────────────────────
function ViewDropdown({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useMenuClose(btnRef, panelRef, setOpen);
  // Read live values for label display only — all fns use getState() for fresh values
  const { scale, leftPanelOpen, rightPanelOpen, showRulers } = useEditorStore();

  const items: Array<MenuItem | null> = [
    {
      label: `Zoom In  (${Math.round(scale * 100)}% → ${Math.round(Math.min(300, scale * 100 + 10))}%)`,
      shortcut: '⌘+', icon: '🔎',
      fn: () => useEditorStore.getState().setScale(Math.min(3, useEditorStore.getState().scale + 0.1)),
    },
    {
      label: `Zoom Out  (${Math.round(scale * 100)}% → ${Math.round(Math.max(25, scale * 100 - 10))}%)`,
      shortcut: '⌘−', icon: '🔍',
      fn: () => useEditorStore.getState().setScale(Math.max(0.25, useEditorStore.getState().scale - 0.1)),
    },
    { label: 'Actual Size (100%)',  shortcut: '⌘0', icon: '⊡', fn: () => useEditorStore.getState().setScale(1) },
    { label: 'Fit Page (75%)',                      icon: '⊞', fn: () => useEditorStore.getState().setScale(0.75) },
    { label: 'Reset View',                          icon: '↺', fn: () => { useEditorStore.getState().setScale(1); useEditorStore.getState().setLeftPanelOpen(true); useEditorStore.getState().setRightPanelOpen(true); } },
    null,
    {
      label: leftPanelOpen  ? 'Hide Page Panel'  : 'Show Page Panel',
      icon: '◀',
      fn: () => useEditorStore.getState().setLeftPanelOpen(!useEditorStore.getState().leftPanelOpen),
      disabled: !canEdit,
    },
    {
      label: rightPanelOpen ? 'Hide Properties'  : 'Show Properties',
      icon: '▶',
      fn: () => useEditorStore.getState().setRightPanelOpen(!useEditorStore.getState().rightPanelOpen),
      disabled: !canEdit,
    },
    null,
    {
      label: showRulers ? 'Hide Rulers' : 'Show Rulers',
      shortcut: '⌘R', icon: '📐',
      fn: () => useEditorStore.getState().toggleRulers(),
      disabled: !canEdit,
    },
    {
      label: 'Clear Guides',
      icon: '✕', fn: () => useEditorStore.getState().clearGuides(),
      disabled: !canEdit,
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <MenuBtn label="View" open={open} btnRef={btnRef} onClick={() => setOpen((v) => !v)} />
      <MenuPortal open={open} btnRef={btnRef} panelRef={panelRef}>
        <MenuItems items={items} close={() => setOpen(false)} />
      </MenuPortal>
    </div>
  );
}

// ─── Window menu ─────────────────────────────────────────────────────────────
function WindowDropdown() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useMenuClose(btnRef, panelRef, setOpen);
  const eApi = () => (window as any).electronAPI as any;

  const items: Array<MenuItem | null> = [
    { label: 'Minimize',    shortcut: '⌘M', icon: '−', fn: () => eApi()?.minimizeWindow?.() },
    { label: 'Zoom',                         icon: '⊡', fn: () => eApi()?.maximizeWindow?.() },
    null,
    { label: 'Close Window', shortcut: '⌘W', icon: '✕', fn: () => eApi()?.closeWindow?.() ?? window.close() },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <MenuBtn label="Window" open={open} btnRef={btnRef} onClick={() => setOpen((v) => !v)} />
      <MenuPortal open={open} btnRef={btnRef} panelRef={panelRef}>
        <MenuItems items={items} close={() => setOpen(false)} />
      </MenuPortal>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'comment', label: 'Comment' },
  { id: 'edit',    label: 'Edit PDF' },
  { id: 'pages',   label: 'Organize Pages' },
  { id: 'tools',   label: 'Tools' },
];

// ─── Icon button helper ────────────────────────────────────────────────────────
function IconBtn({ onClick, disabled, title, children, active }: { onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent-light)' : 'transparent',
        border: '1px solid ' + (active ? 'rgba(10,132,255,0.3)' : 'transparent'),
        borderRadius: 6, color: disabled ? 'var(--border)' : (active ? 'var(--accent-hover)' : 'var(--text-dim)'),
        cursor: disabled ? 'default' : 'pointer', fontSize: 16, transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget).style.background = 'var(--panel2)'; (e.currentTarget).style.color = 'var(--text-bright)'; } }}
      onMouseLeave={(e) => { (e.currentTarget).style.background = active ? 'var(--accent-light)' : 'transparent'; (e.currentTarget).style.color = disabled ? 'var(--border)' : (active ? 'var(--accent-hover)' : 'var(--text-dim)'); }}>
      {children}
    </button>
  );
}

// ─── Doc name display (header) ────────────────────────────────────────────────
function DocNameDisplay({ name, isDirty, onEdit }: { name: string; isDirty: boolean; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to rename"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: '1px solid ' + (hovered ? 'rgba(255,255,255,0.1)' : 'transparent'),
        color: isDirty ? 'var(--text)' : 'var(--text-dim)',
        fontSize: 12.5, cursor: 'pointer', padding: '3px 7px', borderRadius: 5,
        maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </span>
      {isDirty && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>}
      <span style={{ fontSize: 10, opacity: hovered ? 0.6 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>✎</span>
    </button>
  );
}

// ─── Document tab bar ─────────────────────────────────────────────────────────
function DocTabBar({ onOpen }: { onOpen: () => void }) {
  const { tabs, activeTabId, switchTab, closeTab, setDocName } = useEditorStore();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(tabId: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTabId(tabId);
    setEditingValue(currentName);
    // If not the active tab, switch first so setDocName targets the right tab
    if (tabId !== activeTabId) switchTab(tabId);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  }

  function commitRename() {
    if (editingTabId) {
      const trimmed = editingValue.trim() || 'Untitled';
      // If renaming the active tab, update store; the store also updates tabs[]
      if (editingTabId === useEditorStore.getState().activeTabId) {
        setDocName(trimmed);
      }
    }
    setEditingTabId(null);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 34, flexShrink: 0,
      background: 'var(--panel)', borderBottom: '1px solid var(--border)',
      paddingLeft: 8, gap: 2, overflowX: 'auto',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = editingTabId === tab.id;
        const name = tab.docName || 'Untitled';
        const displayName = name.length > 22 ? name.slice(0, 20) + '…' : name;

        return (
          <div
            key={tab.id}
            onClick={() => { if (!isEditing) switchTab(tab.id); }}
            onDoubleClick={(e) => startRename(tab.id, name, e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 6px 0 10px', height: 28, borderRadius: 6, flexShrink: 0,
              background: isActive ? 'rgba(10,132,255,0.12)' : 'transparent',
              border: '1px solid ' + (isActive ? 'rgba(10,132,255,0.35)' : 'transparent'),
              cursor: isEditing ? 'default' : 'pointer', transition: 'all 0.12s', maxWidth: 220,
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingTabId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 130, fontSize: 11, background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(10,132,255,0.5)', borderRadius: 4,
                  color: 'var(--text-bright)', padding: '1px 5px', outline: 'none',
                }}
              />
            ) : (
              <span style={{ fontSize: 11, color: isActive ? 'var(--accent-hover)' : 'var(--text-dim)', whiteSpace: 'nowrap', userSelect: 'none' }}
                title="Double-click to rename">
                {tab.pdfFile ? '📄 ' : '✦ '}{displayName}
                {tab.isDirty && <span style={{ color: '#f59e0b', marginLeft: 3 }}>●</span>}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{
                width: 16, height: 16, borderRadius: 3, border: 'none',
                background: 'transparent', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, padding: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget).style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--text-muted)'; }}
              title="Close tab"
            >✕</button>
          </div>
        );
      })}

      {/* New tab / open file button */}
      <button
        onClick={onOpen}
        title="Open file in new tab (⌘T)"
        style={{
          width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
          background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.12s', marginLeft: 2,
        }}
        onMouseEnter={(e) => { (e.currentTarget).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget).style.color = 'var(--text-bright)'; }}
        onMouseLeave={(e) => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--text-dim)'; }}
      >+</button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── License gate + free trial ────────────────────────────────────────────────
  // Entitlement = paid license OR within the 7-day free trial. Browser builds skip
  // the gate entirely (no electron bridge). When the trial is active but unlicensed
  // we still run the app and show a countdown banner; once it expires we show the
  // activation wall (LicenseGate), which both links to purchase and accepts a key.
  const isElectron = !!(window as any).electronAPI?.isElectron;
  const [gate, setGate] = useState<'loading' | 'ok' | 'locked'>(isElectron ? 'loading' : 'ok');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const refreshEntitlement = useCallback(() => {
    if (!isElectron) { setGate('ok'); return; }
    (window as any).electronAPI.license.status().then((s: any) => {
      if (s?.licensed) { setGate('ok'); setTrialDaysLeft(null); }
      else if (s?.trial?.active) { setGate('ok'); setTrialDaysLeft(s.trial.daysLeft); }
      else { setGate('locked'); setTrialDaysLeft(null); }
    }).catch(() => { setGate('ok'); }); // fail open so a bug never bricks the app
  }, [isElectron]);

  useEffect(() => { refreshEntitlement(); }, [refreshEntitlement]);

  const {
    docName, setDocName, pages, isDirty, scale, setScale,
    openPdf, undo, redo, deleteSelected,
    activeTab, setActiveTab,
    leftPanelOpen, setLeftPanelOpen,
    rightPanelOpen, setRightPanelOpen,
    showFindBar,
    historyIndex, history,
    setActiveTool,
    tabs,
  } = useEditorStore();

  const viewerRef = useRef<PDFViewerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const hasDoc = pages.length > 0;

  const openFile = useCallback(async (file: File) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    pdfDocCache.set(file, pdf); // cache so PDFViewer doesn't re-parse
    const docPages: DocPage[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const p = await pdf.getPage(i + 1);
      // Read the page's inherent /Rotate value and store it as the starting rotation.
      // getViewport without explicit rotation uses p.rotate automatically for dimensions.
      const rotation = p.rotate as 0 | 90 | 180 | 270;
      const vp = p.getViewport({ scale: 1 });
      docPages.push({ id: newPageId(), source: 'original', originalIndex: i, pdfWidth: vp.width, pdfHeight: vp.height, rotation });
    }
    openPdf(file, bytes, docPages);
  }, [openPdf]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') openFile(f);
  }

  const getCanvasInfos = () => viewerRef.current?.getCanvasInfos() ?? [];

  // Keyboard shortcuts
  useEffect(() => {
    const TOOL_KEYS: Record<string, string> = {
      'v': 'select', 'Escape': 'select',
      'h': 'highlight', 'u': 'underline',
      'd': 'draw', 'f': 'draw',
      't': 'text',
      'r': 'rectangle',
      'e': 'ellipse',
      'l': 'line',
      'a': 'arrow',
      'x': 'eraser',
      'i': 'image',
    };

    function onKey(e: KeyboardEvent) {
      const m = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      // File / history shortcuts (always active)
      if (m && e.key === 'z') { e.preventDefault(); undo(); }
      if (m && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
      if (m && e.key === 'n') { e.preventDefault(); setShowNewDoc(true); }
      if (m && e.key === 'o') { e.preventDefault(); fileInputRef.current?.click(); }
      if (m && e.key === 's') { e.preventDefault(); if (hasDoc) setShowSave(true); }
      if (m && e.key === 'p') { e.preventDefault(); window.print(); }
      if (m && e.key === 'f') { e.preventDefault(); if (hasDoc) useEditorStore.getState().setShowFindBar(!useEditorStore.getState().showFindBar); }
      if (m && e.key === 'r') { e.preventDefault(); if (hasDoc) useEditorStore.getState().toggleRulers(); }
      if (m && e.key === 't') { e.preventDefault(); fileInputRef.current?.click(); }

      // Copy / cut / paste (skip when typing in an input)
      if (m && e.key === 'c' && !inInput) { e.preventDefault(); useEditorStore.getState().copySelected(); }
      if (m && e.key === 'x' && !inInput) { e.preventDefault(); useEditorStore.getState().cutSelected(); }
      if (m && e.key === 'v' && !inInput) { e.preventDefault(); useEditorStore.getState().pasteAnnotations(); }

      // Zoom shortcuts
      if (m && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(Math.min(3, useEditorStore.getState().scale + 0.1)); }
      if (m && e.key === '-') { e.preventDefault(); setScale(Math.max(0.25, useEditorStore.getState().scale - 0.1)); }
      if (m && e.key === '0') { e.preventDefault(); setScale(1); }

      // Delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) deleteSelected();

      // Tool activation (single key, not in input fields)
      if (!m && !inInput && hasDoc && e.key in TOOL_KEYS) {
        e.preventDefault();
        setActiveTool(TOOL_KEYS[e.key] as any);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, hasDoc, deleteSelected, setActiveTool, setScale]);

  // ── Unsaved changes warning ──────────────────────────────────────────────────
  // Keep a ref so the close handler always reads current isDirty without stale closure
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  // Expose isDirty to Electron main process (read via executeJavaScript)
  useEffect(() => { (window as any).__shollyIsDirty = isDirty; }, [isDirty]);

  useEffect(() => {
    // Browser fallback: warn on tab/window close
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Electron: main process sends this when the window X is clicked
    const eAPI = (window as any).electronAPI;
    eAPI?.onBeforeClose?.(() => {
      if (!isDirtyRef.current) { eAPI.confirmClose(); return; }
      setShowCloseWarning(true);
    });

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []); // mount once — uses ref for isDirty

  // Electron native menu integration
  useEffect(() => {
    const eAPI = (window as any).electronAPI;
    if (!eAPI) return;
    eAPI.onMenuNew?.(() => setShowNewDoc(true));
    eAPI.onMenuOpenFile?.((data: { name: string; filePath: string; buffer: number[] }) => {
      const bytes = new Uint8Array(data.buffer).buffer;
      const file = new File([bytes], data.name, { type: 'application/pdf' });
      openFile(file);
    });
    eAPI.onMenuSave?.(() => { if (hasDoc) setShowSave(true); });
    eAPI.onMenuZoomIn?.(() => setScale(Math.min(3, useEditorStore.getState().scale + 0.15)));
    eAPI.onMenuZoomOut?.(() => setScale(Math.max(0.25, useEditorStore.getState().scale - 0.15)));
    eAPI.onMenuZoomReset?.(() => setScale(1));
    eAPI.onMenuToggleLeft?.(() => setLeftPanelOpen(!leftPanelOpen));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDoc]);

  if (gate === 'loading') return null; // brief flicker guard while checking entitlement
  if (gate === 'locked') return <LicenseGate onActivated={refreshEntitlement} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--app-bg)' }}>

      {/* ── Free-trial countdown banner ── */}
      {trialDaysLeft != null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          height: 30, flexShrink: 0, fontSize: 12,
          background: 'var(--accent)', color: '#fff',
        }}>
          <span>
            {trialDaysLeft === 1 ? 'Last day of your free trial' : `${trialDaysLeft} days left in your free trial`}
          </span>
          <button
            onClick={() => (window as any).electronAPI?.license.openPurchase()}
            style={{
              background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff', borderRadius: 5, padding: '2px 12px', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600,
            }}>
            Buy now
          </button>
          <button
            onClick={() => setGate('locked')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 11.5, textDecoration: 'underline' }}>
            Enter key
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 46,
        background: 'linear-gradient(180deg, #16192300 0%, var(--toolbar) 100%)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, gap: 2,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>

        {/* macOS traffic lights spacer */}
        <div style={{ width: 72, flexShrink: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties} />

        <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', flex: 1, gap: 2, minWidth: 0 } as React.CSSProperties}>
          <Logo />
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

          {/* Menus */}
          <FileDropdown onNew={() => setShowNewDoc(true)} onOpen={() => fileInputRef.current?.click()} onSave={() => setShowSave(true)} canSave={hasDoc} />
          <EditDropdown canEdit={hasDoc} />
          <ViewDropdown canEdit={hasDoc} />
          <WindowDropdown />

          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={onFileChange} />

          {/* Doc name */}
          {hasDoc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, minWidth: 0 }}>
              {editingName ? (
                <input
                  autoFocus
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
                  onClick={(e) => e.stopPropagation()}
                  className="sp-input"
                  style={{ width: 200, fontSize: 12.5 }}
                />
              ) : (
                <DocNameDisplay
                  name={docName}
                  isDirty={isDirty}
                  onEdit={() => setEditingName(true)}
                />
              )}
            </div>
          )}

          {/* Right side */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, paddingRight: 14, flexShrink: 0 }}>
            {hasDoc && (
              <>
                <IconBtn onClick={undo} disabled={historyIndex === 0} title="Undo (⌘Z)">↩</IconBtn>
                <IconBtn onClick={redo} disabled={historyIndex === history.length - 1} title="Redo (⌘Y)">↪</IconBtn>
                <div className="sp-sep" />

                {/* Zoom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button onClick={() => setScale(Math.max(0.25, scale - 0.1))}
                    style={{ width: 24, height: 24, background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <select value={Math.round(scale * 100)} onChange={(e) => setScale(Number(e.target.value) / 100)}
                    className="sp-select" style={{ width: 66, textAlign: 'center', fontSize: 12, padding: '3px 4px' }}>
                    {[25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300].map((z) => (
                      <option key={z} value={z}>{z}%</option>
                    ))}
                  </select>
                  <button onClick={() => setScale(Math.min(3, scale + 0.1))}
                    style={{ width: 24, height: 24, background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div className="sp-sep" />

                {/* Panel toggles */}
                <IconBtn onClick={() => setLeftPanelOpen(!leftPanelOpen)} title="Toggle pages panel" active={leftPanelOpen}>◀</IconBtn>
                <IconBtn onClick={() => setRightPanelOpen(!rightPanelOpen)} title="Toggle properties" active={rightPanelOpen}>▶</IconBtn>
                <div className="sp-sep" />
              </>
            )}

            {/* Save button */}
            {hasDoc ? (
              <button className="sp-btn sp-btn-primary" onClick={() => setShowSave(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ fontSize: 13 }}>↓</span> Save
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="sp-btn" onClick={() => setShowNewDoc(true)} style={{ fontSize: 12.5 }}>New</button>
                <button className="sp-btn sp-btn-primary" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12.5 }}>Open PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Document tabs (always visible when >1 tab or any tab has a doc) ── */}
      {(tabs.length > 1 || tabs.some((t) => t.pages.length > 0)) && (
        <DocTabBar onOpen={() => fileInputRef.current?.click()} />
      )}

      {/* ── Ribbon tab bar ── */}
      {hasDoc && (
        <div style={{
          display: 'flex', alignItems: 'center', height: 36,
          background: 'var(--panel)', borderBottom: '1px solid var(--border)', flexShrink: 0,
          paddingLeft: 8,
        }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tool Ribbon ── */}
      {hasDoc && <ToolRibbon />}

      {/* ── Find bar ── */}
      {hasDoc && showFindBar && <FindBar />}

      {/* ── Main body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {hasDoc && leftPanelOpen && <Sidebar />}

        {hasDoc ? (
          <RulerArea onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <PDFViewer ref={viewerRef} />
          </RulerArea>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--canvas-bg)' }} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <Landing onNew={() => setShowNewDoc(true)} onOpen={() => fileInputRef.current?.click()} onDrop={onDrop} />
          </div>
        )}

        {hasDoc && rightPanelOpen && <PropertiesPanel />}
      </div>

      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, height: 22, padding: '0 14px',
        background: 'var(--toolbar)', borderTop: '1px solid var(--border)',
        flexShrink: 0, fontSize: 11, color: 'var(--text-muted)',
      }}>
        {hasDoc ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 5px rgba(34,197,94,0.5)' }} />
              {pages.length} page{pages.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{useEditorStore.getState().annotations.length} annotations</span>
            <span>·</span>
            <span>{Math.round(scale * 100)}%</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              {isDirty ? (
                <><span style={{ color: '#f59e0b' }}>●</span> Unsaved changes</>
              ) : (
                <><span style={{ color: 'var(--accent-green)' }}>●</span> All changes saved</>
              )}
            </span>
            <span style={{ color: 'var(--border)', marginLeft: 8 }}>⌘S save · Del remove</span>
          </>
        ) : (
          <span style={{ margin: '0 auto', letterSpacing: 0.3 }}>Sholly PDF — Open or create a document to begin</span>
        )}
      </div>

      {/* ── Dialogs ── */}
      {showNewDoc && <NewDocDialog onClose={() => setShowNewDoc(false)} />}
      {showSave   && <SaveDialog   onClose={() => setShowSave(false)}   canvasInfos={getCanvasInfos()} />}
      <UpdateDialog />

      {/* ── Unsaved-changes close warning ── */}
      {showCloseWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border-light)',
            borderRadius: 12, padding: '28px 32px', width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 10 }}>Unsaved Changes</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 22 }}>
              You have unsaved changes. If you close now, your edits will be lost.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="sp-btn"
                onClick={() => setShowCloseWarning(false)}
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                className="sp-btn"
                onClick={() => { setShowCloseWarning(false); setShowSave(true); }}
                style={{ fontSize: 13 }}
              >
                Save First…
              </button>
              <button
                className="sp-btn"
                onClick={() => {
                  setShowCloseWarning(false);
                  (window as any).electronAPI?.confirmClose?.();
                }}
                style={{ fontSize: 13, background: '#dc2626', color: '#fff', border: 'none' }}
              >
                Close Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────
function Landing({ onNew, onOpen, onDrop }: { onNew: () => void; onOpen: () => void; onDrop: (e: React.DragEvent) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 36, padding: 24, position: 'relative', overflow: 'hidden' }}
      onDrop={(e) => { setDragging(false); onDrop(e); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}>

      {/* Ambient glow blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '15%', left: '25%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(10,132,255,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
          background: 'linear-gradient(145deg, #3b6fd4 0%, #7c3aed 100%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(10,132,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 36, color: 'white', fontWeight: 900 }}>S</span>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-bright)', margin: '0 0 10px', letterSpacing: -0.8, lineHeight: 1 }}>Sholly PDF</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14.5, margin: 0, letterSpacing: 0.1 }}>Professional PDF creation and annotation</p>
      </div>

      {/* Action cards */}
      <div style={{ display: 'flex', gap: 14, zIndex: 1 }}>
        {[
          { icon: '✦', title: 'New Document', sub: 'Start from a blank page', fn: onNew, shortcut: '⌘N', grad: 'var(--panel2)' },
          { icon: '⬆', title: 'Open PDF',     sub: 'Edit an existing PDF file', fn: onOpen, shortcut: '⌘O', grad: 'var(--panel2)' },
        ].map((c) => (
          <button key={c.title} onClick={c.fn}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 36px',
              background: c.grad, border: '1px solid var(--border-glow)', borderRadius: 18,
              cursor: 'pointer', transition: 'all 0.18s', width: 188, color: 'inherit',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.borderColor = 'rgba(10,132,255,0.55)';
              (e.currentTarget).style.transform = 'translateY(-3px)';
              (e.currentTarget).style.boxShadow = '0 12px 36px rgba(0,0,0,0.4), 0 0 20px rgba(10,132,255,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.borderColor = 'var(--border-glow)';
              (e.currentTarget).style.transform = 'none';
              (e.currentTarget).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
            }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', border: '1px solid rgba(10,132,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--accent-hover)' }}>{c.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: 14 }}>{c.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 5 }}>{c.sub}</div>
            </div>
            <kbd style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--panel2)', padding: '2px 9px', borderRadius: 5, border: '1px solid var(--border)', fontFamily: 'inherit' }}>{c.shortcut}</kbd>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 14, padding: '18px 56px', textAlign: 'center',
        color: dragging ? 'var(--accent)' : 'var(--text-dim)', fontSize: 13,
        background: dragging ? 'var(--accent-light)' : 'transparent',
        transition: 'all 0.18s', cursor: 'default', zIndex: 1,
      }}>
        <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.6 }}>⬆</div>
        Drop a PDF here to open it
      </div>

      {/* Feature grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 620, zIndex: 1 }}>
        {[
          { icon: 'T',  col: '#60a5fa', title: 'Rich Text',    desc: '50+ fonts, bold, italic' },
          { icon: '▬',  col: '#fbbf24', title: 'Highlights',   desc: 'Highlight, underline, strikethrough' },
          { icon: '✏',  col: '#a78bfa', title: 'Drawing',      desc: 'Freehand pen tool' },
          { icon: '▭',  col: '#34d399', title: 'Shapes',       desc: 'Rect, ellipse, line, arrow' },
          { icon: '🖼',  col: '#f87171', title: 'Images',       desc: 'Insert photos anywhere' },
          { icon: '📝', col: '#fcd34d', title: 'Sticky Notes', desc: 'Comments & reviews' },
          { icon: '🔖', col: '#818cf8', title: 'Stamps',       desc: 'Approved, Draft, Void…' },
          { icon: '↓',  col: '#4ade80', title: 'Save Options', desc: 'Save As, Copy, Export' },
        ].map((f) => (
          <div key={f.title} style={{
            background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget).style.borderColor = 'var(--border-glow)'}
          onMouseLeave={(e) => (e.currentTarget).style.borderColor = 'var(--border)'}>
            <div style={{ fontSize: 20, color: f.col, marginBottom: 7 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)' }}>{f.title}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
