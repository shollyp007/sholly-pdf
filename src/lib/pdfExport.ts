import { PDFDocument, rgb, StandardFonts, LineCapStyle, PDFTextField, PDFCheckBox, PDFDropdown } from 'pdf-lib';
import type { Annotation, DocPage } from '../types';

function blendWithWhite(color: ReturnType<typeof rgb>, alpha: number) {
  return rgb(
    color.red * alpha + (1 - alpha),
    color.green * alpha + (1 - alpha),
    color.blue * alpha + (1 - alpha),
  );
}

function hexToRgb(hex: string) {
  // Handle rgba(...) format
  const rgbaMatch = hex.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return rgb(
      Math.min(1, Number(rgbaMatch[1]) / 255),
      Math.min(1, Number(rgbaMatch[2]) / 255),
      Math.min(1, Number(rgbaMatch[3]) / 255),
    );
  }
  const clean = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(
    isNaN(r) ? 0 : Math.min(1, r),
    isNaN(g) ? 0 : Math.min(1, g),
    isNaN(b) ? 0 : Math.min(1, b),
  );
}

export interface ExportOptions {
  originalBytes: ArrayBuffer | null;
  pages: DocPage[];
  annotations: Annotation[];
  canvasInfos: Array<{ width: number; height: number; dataUrl?: string }>;
  formFieldValues?: Record<string, string | boolean>;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * TRUE REDACTION: bakes opaque black boxes directly into the page's rendered
 * image so the pixels (and any text) under each box are physically destroyed —
 * not merely covered by a removable overlay. Returns a JPEG data URL of the
 * flattened page, or null if it can't be produced.
 */
async function bakeRedactions(
  dataUrl: string,
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  canvasW: number,
  canvasH: number,
): Promise<string | null> {
  try {
    const img = await loadImg(dataUrl);
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth || img.width;
    cv.height = img.naturalHeight || img.height;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    // Map annotation coords (canvas CSS space) to the snapshot's pixel space.
    const sx = cv.width / canvasW;
    const sy = cv.height / canvasH;
    ctx.fillStyle = '#000';
    for (const r of rects) {
      ctx.fillRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    }
    return cv.toDataURL('image/jpeg', 0.92);
  } catch (e) {
    console.warn('Could not bake redactions into page image:', e);
    return null;
  }
}

export async function buildPdfBytes(opts: ExportOptions): Promise<Uint8Array> {
  const { originalBytes, pages, annotations, canvasInfos, formFieldValues } = opts;

  // Base document: load original or create new
  let srcDoc: PDFDocument | null = null;
  if (originalBytes) {
    try {
      srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    } catch (e) {
      console.warn('pdf-lib could not parse original PDF, annotations will be overlaid on blank pages:', e);
    }
  }

  // Fill AcroForm fields in the source document before copying
  if (srcDoc && formFieldValues && Object.keys(formFieldValues).length > 0) {
    try {
      const form = srcDoc.getForm();
      for (const [name, value] of Object.entries(formFieldValues)) {
        try {
          const field = form.getField(name);
          if (field instanceof PDFTextField) {
            field.setText(value as string);
          } else if (field instanceof PDFCheckBox) {
            (value as boolean) ? field.check() : field.uncheck();
          } else if (field instanceof PDFDropdown) {
            if (typeof value === 'string' && value) field.select(value);
          }
        } catch { /* field not found or type mismatch — skip */ }
      }
    } catch { /* PDF has no form — skip */ }
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const docPage = pages[i];
    const canvasInfo = canvasInfos[i] ?? { width: docPage.pdfWidth, height: docPage.pdfHeight };

    const pageAnnots = annotations.filter((a) => a.pageId === docPage.id);
    const redactRects = pageAnnots.filter((a) => a.type === 'redact') as Array<{ x: number; y: number; width: number; height: number }>;

    // Secure redaction: when a page has redactions, replace its original
    // (text-bearing) content with a flattened image that has the redaction
    // boxes burned into the pixels, so nothing under a box can be recovered.
    let redactedBg: string | null = null;
    if (redactRects.length > 0 && canvasInfo.dataUrl) {
      redactedBg = await bakeRedactions(canvasInfo.dataUrl, redactRects, canvasInfo.width, canvasInfo.height);
    }

    let page;
    let rasterized = false;
    if (redactedBg) {
      page = pdfDoc.addPage([docPage.pdfWidth, docPage.pdfHeight]);
      page.drawRectangle({ x: 0, y: 0, width: docPage.pdfWidth, height: docPage.pdfHeight, color: rgb(1, 1, 1) });
      await embedCanvasBackground(pdfDoc, page, { width: canvasInfo.width, height: canvasInfo.height, dataUrl: redactedBg });
      rasterized = true;
    } else if (docPage.source === 'original' && srcDoc && docPage.originalIndex !== undefined) {
      try {
        const [copied] = await pdfDoc.copyPages(srcDoc, [docPage.originalIndex]);
        page = pdfDoc.addPage(copied);
      } catch (e) {
        console.warn('Could not copy PDF page, falling back to canvas image:', e);
        page = pdfDoc.addPage([docPage.pdfWidth, docPage.pdfHeight]);
        page.drawRectangle({ x: 0, y: 0, width: docPage.pdfWidth, height: docPage.pdfHeight, color: rgb(1, 1, 1) });
        await embedCanvasBackground(pdfDoc, page, canvasInfo);
      }
    } else if (!srcDoc && docPage.source === 'original') {
      // Original PDF failed to load — render canvas snapshot as background
      page = pdfDoc.addPage([docPage.pdfWidth, docPage.pdfHeight]);
      page.drawRectangle({ x: 0, y: 0, width: docPage.pdfWidth, height: docPage.pdfHeight, color: rgb(1, 1, 1) });
      await embedCanvasBackground(pdfDoc, page, canvasInfo);
    } else {
      page = pdfDoc.addPage([docPage.pdfWidth, docPage.pdfHeight]);
      page.drawRectangle({ x: 0, y: 0, width: docPage.pdfWidth, height: docPage.pdfHeight, color: rgb(1, 1, 1) });
    }

    const { width: pdfW, height: pdfH } = page.getSize();
    const scaleX = pdfW / canvasInfo.width;
    const scaleY = pdfH / canvasInfo.height;

    for (const ann of pageAnnots) {
      try {
        if (ann.type === 'text') {
          const font = await pdfDoc.embedFont(
            ann.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
          );
          const lines = (ann.content || 'Text').split('\n');
          const lineHeight = ann.fontSize * scaleY * 1.2;
          lines.forEach((line, li) => {
            page.drawText(line, {
              x: ann.x * scaleX,
              y: pdfH - (ann.y + ann.fontSize + li * lineHeight) * scaleY,
              size: ann.fontSize * scaleY,
              font,
              color: hexToRgb(ann.color),
            });
          });
        } else if (ann.type === 'cover') {
          // White opaque rectangle that covers original PDF text (paired with an edit-text TextAnnotation)
          page.drawRectangle({
            x: ann.x * scaleX,
            y: pdfH - (ann.y + ann.height) * scaleY,
            width: ann.width * scaleX,
            height: ann.height * scaleY,
            color: rgb(1, 1, 1),
          });
        } else if (ann.type === 'redact') {
          // On rasterized pages the box is already burned into the image. This
          // branch only fires as a fallback when no page snapshot was available;
          // it draws an opaque box (less secure — original text stream remains).
          if (!rasterized) {
            page.drawRectangle({
              x: ann.x * scaleX,
              y: pdfH - (ann.y + ann.height) * scaleY,
              width: ann.width * scaleX,
              height: ann.height * scaleY,
              color: rgb(0, 0, 0),
            });
          }
        } else if (ann.type === 'highlight') {
          page.drawRectangle({
            x: ann.x * scaleX,
            y: pdfH - (ann.y + ann.height) * scaleY,
            width: ann.width * scaleX,
            height: ann.height * scaleY,
            color: blendWithWhite(hexToRgb(ann.color), ann.opacity),
          });
        } else if (ann.type === 'rectangle') {
          page.drawRectangle({
            x: ann.x * scaleX,
            y: pdfH - (ann.y + ann.height) * scaleY,
            width: ann.width * scaleX,
            height: ann.height * scaleY,
            borderColor: hexToRgb(ann.strokeColor),
            borderWidth: ann.strokeWidth,
            color: ann.filled ? blendWithWhite(hexToRgb(ann.fillColor), 0.3) : undefined,
          });
        } else if (ann.type === 'ellipse') {
          page.drawEllipse({
            x: ann.cx * scaleX,
            y: pdfH - ann.cy * scaleY,
            xScale: ann.rx * scaleX,
            yScale: ann.ry * scaleY,
            borderColor: hexToRgb(ann.strokeColor),
            borderWidth: ann.strokeWidth,
            color: ann.filled ? blendWithWhite(hexToRgb(ann.fillColor), 0.3) : undefined,
          });
        } else if (ann.type === 'line') {
          page.drawLine({
            start: { x: ann.x1 * scaleX, y: pdfH - ann.y1 * scaleY },
            end: { x: ann.x2 * scaleX, y: pdfH - ann.y2 * scaleY },
            color: hexToRgb(ann.color),
            thickness: ann.strokeWidth,
            lineCap: LineCapStyle.Round,
          });
        } else if (ann.type === 'arrow') {
          const x1 = ann.x1 * scaleX, y1 = pdfH - ann.y1 * scaleY;
          const x2 = ann.x2 * scaleX, y2 = pdfH - ann.y2 * scaleY;
          page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: hexToRgb(ann.color), thickness: ann.strokeWidth });
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const hl = 12;
          page.drawLine({ start: { x: x2, y: y2 }, end: { x: x2 - hl * Math.cos(angle - Math.PI / 6), y: y2 - hl * Math.sin(angle - Math.PI / 6) }, color: hexToRgb(ann.color), thickness: ann.strokeWidth });
          page.drawLine({ start: { x: x2, y: y2 }, end: { x: x2 - hl * Math.cos(angle + Math.PI / 6), y: y2 - hl * Math.sin(angle + Math.PI / 6) }, color: hexToRgb(ann.color), thickness: ann.strokeWidth });
        } else if (ann.type === 'draw') {
          for (let j = 1; j < ann.points.length; j++) {
            const p1 = ann.points[j - 1], p2 = ann.points[j];
            page.drawLine({
              start: { x: p1.x * scaleX, y: pdfH - p1.y * scaleY },
              end: { x: p2.x * scaleX, y: pdfH - p2.y * scaleY },
              color: hexToRgb(ann.color),
              thickness: ann.strokeWidth,
              lineCap: LineCapStyle.Round,
            });
          }
        } else if (ann.type === 'image') {
          const base64 = ann.dataUrl.split(',')[1];
          const isJpeg = ann.dataUrl.startsWith('data:image/jpeg');
          const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const img = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
          page.drawImage(img, {
            x: ann.x * scaleX,
            y: pdfH - (ann.y + ann.height) * scaleY,
            width: ann.width * scaleX,
            height: ann.height * scaleY,
          });
        }
      } catch (e) {
        console.warn('Failed to export annotation', ann.type, e);
      }
    }
  }

  return pdfDoc.save();
}

// Embed a canvas snapshot as the page background (fallback for encrypted/unloadable PDFs)
async function embedCanvasBackground(pdfDoc: PDFDocument, page: ReturnType<PDFDocument['addPage']>, canvasInfo: { width: number; height: number; dataUrl?: string }) {
  if (!canvasInfo.dataUrl) return;
  try {
    const base64 = canvasInfo.dataUrl.split(',')[1];
    if (!base64) return;
    const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const img = await pdfDoc.embedJpg(imgBytes);
    const { width: pdfW, height: pdfH } = page.getSize();
    page.drawImage(img, { x: 0, y: 0, width: pdfW, height: pdfH });
  } catch (e) {
    console.warn('Could not embed canvas background image:', e);
  }
}

const eAPI = () => (window as any).electronAPI as {
  showSaveDialog: (opts: any) => Promise<{ canceled: boolean; filePath?: string }>;
  writeFile: (filePath: string, buffer: number[]) => Promise<boolean>;
} | undefined;

// ── Save target (resolved before heavy PDF building) ─────────────────────────
export type SaveTarget =
  | { kind: 'electron'; path: string }
  | { kind: 'fsapi';    handle: FileSystemFileHandle }
  | { kind: 'download' };

/**
 * Call this IMMEDIATELY in a click handler (before any awaits) so the browser
 * treats it as a direct user-gesture response. It opens the OS save dialog or
 * the File System Access picker and returns a SaveTarget you can write to later.
 */
export async function pickSaveTarget(suggestedName: string): Promise<SaveTarget | null> {
  const api = eAPI();

  // ── Electron native dialog ────────────────────────────────────────────────
  if (api) {
    const result = await api.showSaveDialog({ defaultPath: suggestedName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (result.canceled || !result.filePath) return null;
    return { kind: 'electron', path: result.filePath };
  }

  // ── Browser File System Access API ───────────────────────────────────────
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
      });
      return { kind: 'fsapi', handle };
    } catch (e: any) {
      if (e?.name === 'AbortError') return null;
      // Any other error (SecurityError etc.) → fall through to download
      console.warn('showSaveFilePicker failed:', e);
    }
  }

  // ── Fallback: browser download to Downloads folder ────────────────────────
  return { kind: 'download' };
}

/** Write already-built PDF bytes to a previously resolved SaveTarget. */
export async function writeToTarget(bytes: Uint8Array, target: SaveTarget, filename: string): Promise<string> {
  const api = eAPI();
  if (target.kind === 'electron') {
    await api!.writeFile(target.path, Array.from(bytes));
    return target.path;
  }
  if (target.kind === 'fsapi') {
    const writable = await target.handle.createWritable();
    await writable.write(toBlob(bytes));
    await writable.close();
    return target.handle.name;
  }
  // download fallback
  downloadBlob(toBlob(bytes), filename.endsWith('.pdf') ? filename : filename + '.pdf');
  return 'Downloads folder';
}

// Save to existing handle (used for plain "Save" overwrite)
export async function saveToHandle(bytes: Uint8Array, handle: FileSystemFileHandle): Promise<void> {
  const api = eAPI();
  const name = handle.name;
  if (api && name.startsWith('/')) {
    await api.writeFile(name, Array.from(bytes));
    return;
  }
  const blob = toBlob(bytes);
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

// Save a Copy — always downloads
export function saveCopy(bytes: Uint8Array, name: string) {
  downloadBlob(toBlob(bytes), name.replace(/\.pdf$/i, '') + ' (copy).pdf');
}

// Export — download with given name
export function exportDownload(bytes: Uint8Array, name: string) {
  downloadBlob(toBlob(bytes), name.endsWith('.pdf') ? name : name + '.pdf');
}

function toBlob(bytes: Uint8Array): Blob {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buf], { type: 'application/pdf' });
}

function downloadBlob(blob: Blob, name: string) {
  // Use a base64 data URL instead of a blob: URL — works universally including
  // old Safari versions that append a .download extension to blob: URL downloads.
  blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...(bytes.subarray(i, Math.min(i + chunk, bytes.length)) as any));
    }
    const dataUrl = 'data:application/pdf;base64,' + btoa(binary);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}
