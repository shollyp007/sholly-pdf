import type { PDFDocumentProxy } from 'pdfjs-dist';

export const pdfDocCache = new WeakMap<File, PDFDocumentProxy>();
