import { create } from 'zustand';
import type { Annotation, ToolType, DocPage, PageSize, PageOrientation, AppTab, LeftPanelTab } from '../types';
import { PAGE_SIZES } from '../types';

let _id = 0;
export const newPageId = () => `pg-${++_id}-${Date.now()}`;
export const generateId = () => Math.random().toString(36).slice(2, 9) + (++_id);

// ─── Per-document tab snapshot ────────────────────────────────────────────────
export interface TabSnap {
  id: string;
  docName: string;
  pdfFile: File | null;
  originalPdfBytes: ArrayBuffer | null;
  pages: DocPage[];
  currentPageId: string | null;
  annotations: Annotation[];
  selectedIds: string[];
  history: Annotation[][];
  historyIndex: number;
  isDirty: boolean;
  lastSavedHandle: FileSystemFileHandle | null;
  formFieldValues: Record<string, string | boolean>;
}

function makeEmptyTab(id: string): TabSnap {
  return {
    id, docName: 'Untitled', pdfFile: null, originalPdfBytes: null,
    pages: [], currentPageId: null,
    annotations: [], selectedIds: [], history: [[]], historyIndex: 0,
    isDirty: false, lastSavedHandle: null, formFieldValues: {},
  };
}

function captureTab(s: EditorState): TabSnap {
  return {
    id: s.activeTabId,
    docName: s.docName, pdfFile: s.pdfFile, originalPdfBytes: s.originalPdfBytes,
    pages: s.pages, currentPageId: s.currentPageId,
    annotations: s.annotations, selectedIds: s.selectedIds,
    history: s.history, historyIndex: s.historyIndex,
    isDirty: s.isDirty, lastSavedHandle: s.lastSavedHandle, formFieldValues: s.formFieldValues,
  };
}

function snapToState(snap: TabSnap): Omit<TabSnap, 'id'> {
  const { id: _id, ...rest } = snap; void _id;
  return rest;
}

const INIT_TAB_ID = 'tab-init';

interface EditorState {
  // Document
  docName: string;
  pdfFile: File | null;
  originalPdfBytes: ArrayBuffer | null;
  pages: DocPage[];
  currentPageId: string | null;

  // Tabs
  tabs: TabSnap[];
  activeTabId: string;

  // Viewport
  scale: number;
  fitMode: 'free' | 'page' | 'width';

  // UI state
  activeTab: AppTab;
  leftPanelTab: LeftPanelTab;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  showFindBar: boolean;
  findQuery: string;

  // Tool
  activeTool: ToolType;
  strokeColor: string;
  fillColor: string;
  highlightColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontStack: string;
  highlightOpacity: number;
  drawOpacity: number;
  filled: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: 'left' | 'center' | 'right';
  cornerRadius: number;
  stampText: string;
  stampColor: string;
  authorName: string;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkSize: number;

  // Annotations
  annotations: Annotation[];
  selectedIds: string[];
  history: Annotation[][];
  historyIndex: number;

  // Save
  isDirty: boolean;
  lastSavedHandle: FileSystemFileHandle | null;

  // Actions — Document
  newDocument: (size: PageSize, orientation: PageOrientation, cw?: number, ch?: number) => void;
  openPdf: (file: File, bytes: ArrayBuffer, pages: DocPage[]) => void;
  openNewTab: (file: File, bytes: ArrayBuffer, pages: DocPage[]) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  setDocName: (n: string) => void;
  setScale: (s: number) => void;
  setFitMode: (m: 'free' | 'page' | 'width') => void;

  // Actions — UI
  setActiveTab: (t: AppTab) => void;
  setLeftPanelTab: (t: LeftPanelTab) => void;
  setLeftPanelOpen: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setShowFindBar: (v: boolean) => void;
  setFindQuery: (q: string) => void;
  setCurrentPageId: (id: string) => void;

  // Actions — Pages
  addBlankPage: (afterId?: string, size?: PageSize) => void;
  deletePage: (id: string) => void;
  movePage: (fromId: string, toId: string) => void;
  duplicatePage: (id: string) => void;
  rotatePage: (id: string, dir: 'cw' | 'ccw') => void;
  extractPage: (id: string) => void;

  // Actions — Tools
  setActiveTool: (t: ToolType) => void;
  setStrokeColor: (c: string) => void;
  setFillColor: (c: string) => void;
  setHighlightColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setFontSize: (s: number) => void;
  setFont: (name: string, stack: string) => void;
  setHighlightOpacity: (o: number) => void;
  setDrawOpacity: (o: number) => void;
  setFilled: (v: boolean) => void;
  setBold: (v: boolean) => void;
  setItalic: (v: boolean) => void;
  setUnderline: (v: boolean) => void;
  setTextAlign: (a: 'left' | 'center' | 'right') => void;
  setCornerRadius: (r: number) => void;
  setStampText: (t: string) => void;
  setStampColor: (c: string) => void;
  setAuthorName: (n: string) => void;
  setWatermarkText: (t: string) => void;
  setWatermarkOpacity: (o: number) => void;
  setWatermarkSize: (s: number) => void;

  // Clipboard
  clipboard: Annotation[];

  // Actions — Annotations
  addAnnotation: (a: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  deleteSelected: () => void;
  setSelectedIds: (ids: string[]) => void;
  reorderAnnotation: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteAnnotations: (targetPageId?: string) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Save
  setLastSavedHandle: (h: FileSystemFileHandle | null) => void;
  markSaved: () => void;

  // Form fields (AcroForm filling)
  formFieldValues: Record<string, string | boolean>;
  setFormFieldValue: (name: string, value: string | boolean) => void;

  // Edit-text tool: signals AnnotationLayer to enter edit mode for a newly-created text annotation
  pendingEditTextId: string | null;
  setPendingEditTextId: (id: string | null) => void;

  // Viewport click coordinates from the edit-text click; used to place cursor at exact position
  pendingEditClickPos: { x: number; y: number } | null;
  setPendingEditClickPos: (pos: { x: number; y: number } | null) => void;

  // Ruler guides (view-only, not saved to PDF)
  showRulers: boolean;
  guides: Guide[];
  toggleRulers: () => void;
  addGuide: (g: Guide) => void;
  updateGuide: (id: string, position: number) => void;
  deleteGuide: (id: string) => void;
  clearGuides: () => void;
}

export interface Guide {
  id: string;
  type: 'h' | 'v'; // h = horizontal line (fixed y), v = vertical line (fixed x)
  position: number; // document coordinate in CSS px at scale=1
}

export const useEditorStore = create<EditorState>((set, get) => ({
  docName: 'Untitled',
  pdfFile: null,
  originalPdfBytes: null,
  pages: [],
  currentPageId: null,
  tabs: [makeEmptyTab(INIT_TAB_ID)],
  activeTabId: INIT_TAB_ID,
  scale: 1.2,
  fitMode: 'free',
  activeTab: 'comment',
  leftPanelTab: 'pages',
  leftPanelOpen: true,
  rightPanelOpen: true,
  showFindBar: false,
  findQuery: '',
  activeTool: 'select',
  strokeColor: '#1e293b',
  fillColor: '#fef08a',
  highlightColor: '#fef08a',
  strokeWidth: 2,
  fontSize: 16,
  fontFamily: 'Arial',
  fontStack: 'Arial, sans-serif',
  highlightOpacity: 0.5,
  drawOpacity: 1,
  filled: false,
  bold: false,
  italic: false,
  underline: false,
  textAlign: 'left',
  cornerRadius: 0,
  stampText: 'APPROVED',
  stampColor: '#16a34a',
  authorName: 'Author',
  watermarkText: 'CONFIDENTIAL',
  watermarkOpacity: 0.15,
  watermarkSize: 60,
  annotations: [],
  selectedIds: [],
  clipboard: [],
  history: [[]],
  historyIndex: 0,
  isDirty: false,
  lastSavedHandle: null,
  formFieldValues: {},
  pendingEditTextId: null,
  pendingEditClickPos: null,

  showRulers: true,
  guides: [],

  // ── Document actions ───────────────────────────────────────────────────────
  newDocument: (size, orientation, cw, ch) => {
    const state = get();
    const base = PAGE_SIZES[size];
    let w = cw ?? base.width, h = ch ?? base.height;
    if (orientation === 'landscape') [w, h] = [h, w];
    const page: DocPage = { id: newPageId(), source: 'blank', pdfWidth: w, pdfHeight: h, rotation: 0 };
    const docFields = {
      docName: 'Untitled', pdfFile: null, originalPdfBytes: null,
      pages: [page], currentPageId: page.id,
      annotations: [], selectedIds: [], history: [[]] as Annotation[][], historyIndex: 0,
      isDirty: false, lastSavedHandle: null, formFieldValues: {} as Record<string, string | boolean>,
    };
    // Replace current tab if empty, otherwise open new tab
    if (state.pages.length === 0) {
      const snap: TabSnap = { ...docFields, id: state.activeTabId };
      set({ ...docFields, tabs: state.tabs.map((t) => t.id === state.activeTabId ? snap : t) });
    } else {
      const newId = `tab-${Date.now()}`;
      const snap: TabSnap = { ...docFields, id: newId };
      set({
        ...docFields,
        activeTabId: newId,
        tabs: [...state.tabs.map((t) => t.id === state.activeTabId ? captureTab(state) : t), snap],
      });
    }
  },

  openPdf: (file, bytes, pages) => get().openNewTab(file, bytes, pages),

  openNewTab: (file, bytes, pages) => {
    const state = get();
    const docFields = {
      docName: file.name.replace(/\.pdf$/i, ''), pdfFile: file, originalPdfBytes: bytes,
      pages, currentPageId: pages[0]?.id ?? null,
      annotations: [], selectedIds: [], history: [[]] as Annotation[][], historyIndex: 0,
      isDirty: false, lastSavedHandle: null, formFieldValues: {} as Record<string, string | boolean>,
    };
    // Replace current tab if it has no document, otherwise open new tab
    if (state.pages.length === 0) {
      const snap: TabSnap = { ...docFields, id: state.activeTabId };
      set({ ...docFields, tabs: state.tabs.map((t) => t.id === state.activeTabId ? snap : t) });
    } else {
      const newId = `tab-${Date.now()}`;
      const snap: TabSnap = { ...docFields, id: newId };
      set({
        ...docFields,
        activeTabId: newId,
        tabs: [...state.tabs.map((t) => t.id === state.activeTabId ? captureTab(state) : t), snap],
      });
    }
  },

  closeTab: (id) => {
    const state = get();
    if (state.tabs.length === 1) {
      // Reset to empty rather than removing last tab
      const emptySnap = makeEmptyTab(id);
      set({ ...snapToState(emptySnap), tabs: [emptySnap] });
      return;
    }
    const idx = state.tabs.findIndex((t) => t.id === id);
    const newTabs = state.tabs.filter((t) => t.id !== id);
    if (id === state.activeTabId) {
      const next = newTabs[Math.max(0, idx - 1)];
      set({ ...snapToState(next), activeTabId: next.id, tabs: newTabs });
    } else {
      set({ tabs: newTabs });
    }
  },

  switchTab: (id) => {
    const state = get();
    if (id === state.activeTabId) return;
    const target = state.tabs.find((t) => t.id === id);
    if (!target) return;
    const updatedTabs = state.tabs.map((t) => t.id === state.activeTabId ? captureTab(state) : t);
    set({ ...snapToState(target), activeTabId: id, tabs: updatedTabs });
  },

  setDocName: (docName) => {
    const { activeTabId, tabs } = get();
    set({ docName, tabs: tabs.map((t) => t.id === activeTabId ? { ...t, docName } : t) });
  },
  setScale: (scale) => set({ scale, fitMode: 'free' }),
  setFitMode: (fitMode) => set({ fitMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setShowFindBar: (showFindBar) => set({ showFindBar }),
  setFindQuery: (findQuery) => set({ findQuery }),
  setCurrentPageId: (currentPageId) => set({ currentPageId }),

  addBlankPage: (afterId, _size = 'a4') => {
    const { pages } = get();
    const ref = afterId ? pages.find((p) => p.id === afterId) : pages[pages.length - 1];
    const page: DocPage = { id: newPageId(), source: 'blank', pdfWidth: ref?.pdfWidth ?? 595, pdfHeight: ref?.pdfHeight ?? 842, rotation: 0 };
    const newPages = afterId ? pages.flatMap((p) => p.id === afterId ? [p, page] : [p]) : [...pages, page];
    set({ pages: newPages, currentPageId: page.id, isDirty: true });
  },

  deletePage: (id) => {
    const { pages, currentPageId, annotations } = get();
    if (pages.length <= 1) return;
    const idx = pages.findIndex((p) => p.id === id);
    const newPages = pages.filter((p) => p.id !== id);
    set({ pages: newPages, annotations: annotations.filter((a) => a.pageId !== id),
      currentPageId: currentPageId === id ? (newPages[Math.max(0, idx - 1)]?.id ?? null) : currentPageId,
      isDirty: true });
  },

  movePage: (fromId, toId) => {
    const { pages } = get();
    const fi = pages.findIndex((p) => p.id === fromId);
    const ti = pages.findIndex((p) => p.id === toId);
    if (fi < 0 || ti < 0) return;
    const np = [...pages];
    const [m] = np.splice(fi, 1);
    np.splice(ti, 0, m);
    set({ pages: np, isDirty: true });
  },

  duplicatePage: (id) => {
    const { pages, annotations } = get();
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const newPage: DocPage = { ...page, id: newPageId() };
    const newAnnots = annotations.filter((a) => a.pageId === id).map((a) => ({ ...a, id: generateId(), pageId: newPage.id }));
    const idx = pages.findIndex((p) => p.id === id);
    set({ pages: [...pages.slice(0, idx + 1), newPage, ...pages.slice(idx + 1)],
      annotations: [...annotations, ...newAnnots], currentPageId: newPage.id, isDirty: true });
  },

  rotatePage: (id, dir) => {
    const { pages } = get();
    const deltas: Record<'cw' | 'ccw', number> = { cw: 90, ccw: -90 };
    const newPages = pages.map((p) => p.id !== id ? p : { ...p, rotation: (((p.rotation + deltas[dir]) % 360) + 360) % 360 as 0 | 90 | 180 | 270 });
    set({ pages: newPages, isDirty: true });
  },

  extractPage: (_id) => { /* Triggers export for single page — handled in App */ },

  setActiveTool: (activeTool) => set({ activeTool, selectedIds: [] }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setHighlightColor: (highlightColor) => set({ highlightColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFont: (fontFamily, fontStack) => set({ fontFamily, fontStack }),
  setHighlightOpacity: (highlightOpacity) => set({ highlightOpacity }),
  setDrawOpacity: (drawOpacity) => set({ drawOpacity }),
  setFilled: (filled) => set({ filled }),
  setBold: (bold) => set({ bold }),
  setItalic: (italic) => set({ italic }),
  setUnderline: (underline) => set({ underline }),
  setTextAlign: (textAlign) => set({ textAlign }),
  setCornerRadius: (cornerRadius) => set({ cornerRadius }),
  setStampText: (stampText) => set({ stampText }),
  setStampColor: (stampColor) => set({ stampColor }),
  setAuthorName: (authorName) => set({ authorName }),
  setWatermarkText: (watermarkText) => set({ watermarkText }),
  setWatermarkOpacity: (watermarkOpacity) => set({ watermarkOpacity }),
  setWatermarkSize: (watermarkSize) => set({ watermarkSize }),

  addAnnotation: (annotation) => {
    const { annotations, history, historyIndex } = get();
    const n = [...annotations, annotation];
    const h = [...history.slice(0, historyIndex + 1), n];
    set({ annotations: n, history: h, historyIndex: h.length - 1, isDirty: true });
  },

  updateAnnotation: (id, updates) => {
    const { annotations } = get();
    set({ annotations: annotations.map((a) => a.id === id ? ({ ...a, ...updates } as Annotation) : a), isDirty: true });
  },

  deleteAnnotation: (id) => {
    const { annotations, history, historyIndex } = get();
    const ann = annotations.find((a) => a.id === id);
    // When deleting a text annotation with a paired cover, also delete the cover
    const pairedCoverId = ann?.type === 'text' ? (ann as any).coverAnnId as string | undefined : undefined;
    // When deleting a cover annotation, also delete its paired text annotation
    const pairedTextId = ann?.type === 'cover'
      ? annotations.find((a) => a.type === 'text' && (a as any).coverAnnId === id)?.id
      : undefined;
    const toDelete = new Set([id, ...(pairedCoverId ? [pairedCoverId] : []), ...(pairedTextId ? [pairedTextId] : [])]);
    const n = annotations.filter((a) => !toDelete.has(a.id));
    const h = [...history.slice(0, historyIndex + 1), n];
    set({ annotations: n, selectedIds: [], history: h, historyIndex: h.length - 1, isDirty: true });
  },

  deleteSelected: () => {
    const { annotations, selectedIds, history, historyIndex } = get();
    // Also delete cover annotations paired with selected text annotations
    const pairedCoverIds = annotations
      .filter((a) => selectedIds.includes(a.id) && a.type === 'text' && (a as any).coverAnnId)
      .map((a) => (a as any).coverAnnId as string);
    // Also delete text annotations paired with selected cover annotations
    const pairedTextIds = annotations
      .filter((a) => selectedIds.includes(a.id) && a.type === 'cover')
      .map((coverAnn) => annotations.find((a) => a.type === 'text' && (a as any).coverAnnId === coverAnn.id)?.id)
      .filter(Boolean) as string[];
    const toDelete = new Set([...selectedIds, ...pairedCoverIds, ...pairedTextIds]);
    const n = annotations.filter((a) => !toDelete.has(a.id));
    const h = [...history.slice(0, historyIndex + 1), n];
    set({ annotations: n, selectedIds: [], history: h, historyIndex: h.length - 1, isDirty: true });
  },

  setSelectedIds: (selectedIds) => set({ selectedIds }),

  reorderAnnotation: (id, direction) => {
    const { annotations } = get();
    const idx = annotations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const ann = annotations[idx];
    const pageId = ann.pageId;
    // Collect indices of annotations on the same page (in order)
    const pageIdxs = annotations.reduce<number[]>((acc, a, i) => { if (a.pageId === pageId) acc.push(i); return acc; }, []);
    const posInPage = pageIdxs.indexOf(idx);
    const n = [...annotations];

    if (direction === 'front') {
      // Move to after the last annotation on this page
      const lastPageIdx = pageIdxs[pageIdxs.length - 1];
      n.splice(idx, 1);
      const insertAt = direction === 'front' ? (lastPageIdx >= idx ? lastPageIdx : lastPageIdx + 1) : 0;
      n.splice(insertAt, 0, ann);
    } else if (direction === 'back') {
      // Move to before the first annotation on this page
      const firstPageIdx = pageIdxs[0];
      n.splice(idx, 1);
      n.splice(firstPageIdx <= idx ? firstPageIdx : firstPageIdx - 1, 0, ann);
    } else if (direction === 'forward' && posInPage < pageIdxs.length - 1) {
      // Swap with next annotation on this page
      const nextIdx = pageIdxs[posInPage + 1];
      n.splice(idx, 1);
      n.splice(nextIdx, 0, ann);
    } else if (direction === 'backward' && posInPage > 0) {
      // Swap with previous annotation on this page
      const prevIdx = pageIdxs[posInPage - 1];
      n.splice(idx, 1);
      n.splice(prevIdx, 0, ann);
    } else {
      return; // nothing to do
    }
    set({ annotations: n, isDirty: true });
  },

  copySelected: () => {
    const { annotations, selectedIds } = get();
    const copied = annotations.filter((a) => selectedIds.includes(a.id));
    if (copied.length) set({ clipboard: copied });
  },

  cutSelected: () => {
    const { annotations, selectedIds, history, historyIndex } = get();
    const copied = annotations.filter((a) => selectedIds.includes(a.id));
    if (!copied.length) return;
    const n = annotations.filter((a) => !selectedIds.includes(a.id));
    const h = [...history.slice(0, historyIndex + 1), n];
    set({ clipboard: copied, annotations: n, selectedIds: [], history: h, historyIndex: h.length - 1, isDirty: true });
  },

  pasteAnnotations: (targetPageId) => {
    const { clipboard, currentPageId, annotations, history, historyIndex } = get();
    if (!clipboard.length) return;
    const pageId = targetPageId ?? currentPageId;
    if (!pageId) return;
    const OFFSET = 18;
    const pasted: Annotation[] = clipboard.map((a) => {
      const newId = generateId();
      const base = { ...a, id: newId, pageId };
      // Shift position so paste is visually distinct from original
      if (base.type === 'ellipse') return { ...base, cx: (base as any).cx + OFFSET, cy: (base as any).cy + OFFSET };
      if (base.type === 'line' || base.type === 'arrow') return { ...base, x1: (base as any).x1 + OFFSET, y1: (base as any).y1 + OFFSET, x2: (base as any).x2 + OFFSET, y2: (base as any).y2 + OFFSET };
      if (base.type === 'draw') return { ...base, points: (base as any).points.map((p: any) => ({ x: p.x + OFFSET, y: p.y + OFFSET })) };
      if ('x' in base) return { ...base, x: (base as any).x + OFFSET, y: (base as any).y + OFFSET };
      return base;
    });
    const n = [...annotations, ...pasted];
    const h = [...history.slice(0, historyIndex + 1), n];
    set({ annotations: n, selectedIds: pasted.map((p) => p.id), history: h, historyIndex: h.length - 1, isDirty: true });
  },

  pushHistory: () => {
    const { annotations, history, historyIndex } = get();
    const h = [...history.slice(0, historyIndex + 1), [...annotations]];
    set({ history: h, historyIndex: h.length - 1 });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex > 0) set({ historyIndex: historyIndex - 1, annotations: history[historyIndex - 1] });
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) set({ historyIndex: historyIndex + 1, annotations: history[historyIndex + 1] });
  },

  setLastSavedHandle: (lastSavedHandle) => set({ lastSavedHandle }),
  markSaved: () => set({ isDirty: false }),

  setFormFieldValue: (name, value) => set((s) => ({
    formFieldValues: { ...s.formFieldValues, [name]: value },
    isDirty: true,
  })),

  setPendingEditTextId: (pendingEditTextId) => set({ pendingEditTextId }),
  setPendingEditClickPos: (pendingEditClickPos) => set({ pendingEditClickPos }),

  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  addGuide: (g) => set((s) => ({ guides: [...s.guides, g] })),
  updateGuide: (id, position) => set((s) => ({ guides: s.guides.map((g) => g.id === id ? { ...g, position } : g) })),
  deleteGuide: (id) => set((s) => ({ guides: s.guides.filter((g) => g.id !== id) })),
  clearGuides: () => set({ guides: [] }),
}));
