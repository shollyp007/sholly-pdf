export type ToolType =
  | 'select' | 'eraser'
  | 'text' | 'edit-text' | 'image' | 'signature' | 'stamp'
  | 'highlight' | 'underline' | 'strikethrough'
  | 'draw' | 'rectangle' | 'ellipse' | 'line' | 'arrow'
  | 'redact' | 'sticky';

export interface Point { x: number; y: number; }

// ─── Annotation types ─────────────────────────────────────────────────────────
export interface TextAnnotation {
  id: string; type: 'text'; pageId: string;
  x: number; y: number;
  width?: number; height?: number;       // set when grouping a full line from existing PDF text
  content: string; fontSize: number; color: string;
  fontFamily: string; fontStack: string;
  detectedFontFamily?: string;           // CSS font-family read directly from the PDF via PDF.js
  originalContent?: string;             // original PDF text at click time; used to detect changes on commit
  bold: boolean; italic: boolean; underline: boolean;
  align: 'left' | 'center' | 'right';
  coverAnnId?: string; // id of paired CoverAnnotation (when created via edit-text tool)
}

export interface HighlightAnnotation {
  id: string; type: 'highlight'; pageId: string;
  x: number; y: number; width: number; height: number;
  color: string; opacity: number;
}

export interface UnderlineAnnotation {
  id: string; type: 'underline'; pageId: string;
  x: number; y: number; width: number; height: number;
  color: string; strokeWidth: number;
}

export interface StrikethroughAnnotation {
  id: string; type: 'strikethrough'; pageId: string;
  x: number; y: number; width: number; height: number;
  color: string; strokeWidth: number;
}

export interface DrawAnnotation {
  id: string; type: 'draw'; pageId: string;
  points: Point[]; color: string; strokeWidth: number;
  opacity: number;
}

export interface RectAnnotation {
  id: string; type: 'rectangle'; pageId: string;
  x: number; y: number; width: number; height: number;
  strokeColor: string; fillColor: string; strokeWidth: number;
  filled: boolean; radius: number; opacity: number;
}

export interface EllipseAnnotation {
  id: string; type: 'ellipse'; pageId: string;
  cx: number; cy: number; rx: number; ry: number;
  strokeColor: string; fillColor: string; strokeWidth: number;
  filled: boolean; opacity: number;
}

export interface LineAnnotation {
  id: string; type: 'line'; pageId: string;
  x1: number; y1: number; x2: number; y2: number;
  color: string; strokeWidth: number;
}

export interface ArrowAnnotation {
  id: string; type: 'arrow'; pageId: string;
  x1: number; y1: number; x2: number; y2: number;
  color: string; strokeWidth: number;
}

export interface ImageAnnotation {
  id: string; type: 'image'; pageId: string;
  x: number; y: number; width: number; height: number;
  dataUrl: string; opacity: number;
}

export interface StickyAnnotation {
  id: string; type: 'sticky'; pageId: string;
  x: number; y: number;
  content: string; color: string;
  collapsed: boolean; author: string;
}

export interface StampAnnotation {
  id: string; type: 'stamp'; pageId: string;
  x: number; y: number; width: number; height: number;
  text: string; color: string; borderColor: string;
  rotation: number;
}

export interface RedactAnnotation {
  id: string; type: 'redact'; pageId: string;
  x: number; y: number; width: number; height: number;
}

export interface CoverAnnotation {
  id: string; type: 'cover'; pageId: string;
  x: number; y: number; width: number; height: number;
}

export interface SignatureAnnotation {
  id: string; type: 'signature'; pageId: string;
  x: number; y: number; width: number; height: number;
  dataUrl: string;
}

export type Annotation =
  | TextAnnotation | HighlightAnnotation | UnderlineAnnotation | StrikethroughAnnotation
  | DrawAnnotation | RectAnnotation | EllipseAnnotation | LineAnnotation | ArrowAnnotation
  | ImageAnnotation | StickyAnnotation | StampAnnotation | RedactAnnotation | SignatureAnnotation
  | CoverAnnotation;

// ─── Document / Page ──────────────────────────────────────────────────────────
export type PageSize = 'letter' | 'a4' | 'legal' | 'a3' | 'a5' | 'tabloid' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  letter:  { width: 612,  height: 792,  label: 'Letter (8.5 × 11 in)' },
  a4:      { width: 595,  height: 842,  label: 'A4 (210 × 297 mm)' },
  legal:   { width: 612,  height: 1008, label: 'Legal (8.5 × 14 in)' },
  a3:      { width: 842,  height: 1191, label: 'A3 (297 × 420 mm)' },
  a5:      { width: 420,  height: 595,  label: 'A5 (148 × 210 mm)' },
  tabloid: { width: 792,  height: 1224, label: 'Tabloid (11 × 17 in)' },
  custom:  { width: 612,  height: 792,  label: 'Custom' },
};

export interface DocPage {
  id: string;
  source: 'original' | 'blank';
  originalIndex?: number;
  pdfWidth: number;
  pdfHeight: number;
  rotation: 0 | 90 | 180 | 270;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export type AppTab = 'comment' | 'edit' | 'pages' | 'tools';
export type LeftPanelTab = 'pages' | 'bookmarks' | 'comments';
