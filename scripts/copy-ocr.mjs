// Copies the on-device text-reading engine (Tesseract.js) into public/ so the app
// serves it itself: photos are read on the phone and never sent to a server.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'tesseract');
const files = [
  [require.resolve('tesseract.js/dist/worker.min.js'), 'worker.min.js'],
  [join(dirname(require.resolve('tesseract.js-core/package.json')), 'tesseract-core-lstm.wasm.js'), 'core/tesseract-core-lstm.wasm.js'],
  [join(dirname(require.resolve('tesseract.js-core/package.json')), 'tesseract-core-simd-lstm.wasm.js'), 'core/tesseract-core-simd-lstm.wasm.js'],
  [join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int', 'eng.traineddata.gz'), 'lang/eng.traineddata.gz'],
];
for (const [from, to] of files) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest)) copyFileSync(from, dest);
}
console.log('OCR assets ready in public/tesseract');
