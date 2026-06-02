// Copies the Tesseract worker + LSTM engine cores from node_modules into
// public/tesseract/ so OCR assets are bundled for offline use. The language
// data (eng.traineddata.gz) is committed separately. Runs before dev/build.
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const out = join(root, 'public/tesseract');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
];

let copied = 0;
for (const [src, name] of files) {
  const from = join(root, src);
  if (!existsSync(from)) { console.error(`[tesseract] missing ${src} — run npm install`); process.exit(1); }
  copyFileSync(from, join(out, name));
  copied++;
}
console.log(`[tesseract] copied ${copied} engine files to public/tesseract/`);
