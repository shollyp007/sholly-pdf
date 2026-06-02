import { createWorker } from 'tesseract.js';

export interface OcrWord {
  text: string;
  x: number; y: number; width: number; height: number; // in page/canvas CSS coords
  confidence: number;
}

// All Tesseract assets are bundled under public/tesseract/ so OCR runs fully
// offline. Resolve them relative to the document so it works in both the dev
// server (http://localhost) and the packaged app (file://).
function asset(p: string): string {
  return new URL('tesseract/' + p, document.baseURI).href;
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
 * Recognize text in a rendered page image and return words with bounding boxes
 * mapped into the page's CSS coordinate space (same space annotations use).
 * `onProgress` reports 0..1 during recognition.
 */
export async function ocrPageImage(
  dataUrl: string,
  canvasW: number,
  canvasH: number,
  onProgress?: (p: number) => void,
): Promise<OcrWord[]> {
  const img = await loadImg(dataUrl);
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  const worker = await createWorker('eng', 1, {
    workerPath: asset('worker.min.js'),
    corePath: asset(''),   // directory — worker picks the SIMD/LSTM core
    langPath: asset(''),   // directory containing eng.traineddata.gz
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });

  try {
    const { data } = await worker.recognize(dataUrl);
    const sx = canvasW / imgW;
    const sy = canvasH / imgH;
    return (data.words || [])
      .filter((w) => w.text.trim() && w.confidence > 40)
      .map((w) => ({
        text: w.text,
        x: w.bbox.x0 * sx,
        y: w.bbox.y0 * sy,
        width: (w.bbox.x1 - w.bbox.x0) * sx,
        height: (w.bbox.y1 - w.bbox.y0) * sy,
        confidence: w.confidence,
      }));
  } finally {
    await worker.terminate();
  }
}
