import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/vendor', { recursive: true });
await Promise.all([
  ...['index.html', 'style.css', 'app.js', 'model.js'].map(file => copyFile(file, 'dist/' + file)),
  copyFile('node_modules/pdfjs-dist/build/pdf.min.mjs', 'dist/vendor/pdf.mjs'),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/vendor/pdf.worker.mjs'),
  copyFile('node_modules/pdfjs-dist/LICENSE', 'dist/vendor/LICENSE.txt'),
]);
