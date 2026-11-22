import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { examples } from './examples.js';

const domain = 'https://cv-studio-phi.vercel.app';
const assets = [ 'style.css', 'app.js', 'model.js', 'pdf-import.js', 'studio.js', 'translations.js', 'examples.js', 'og.png'];
const industry = examples.map(example => {
  const path = '/mau-cv/' + example.slug + '/';
  const title = 'Mẫu CV ' + example.title;
  return {
    path, title, description: example.tips,
    body: '<p>' + example.summary + '</p><section class="card"><h2>Kinh nghiệm</h2><p><strong>' + example.role + '</strong> · ' + example.organization + '</p><ul>'
      + example.body.split('\n').map(line => '<li>' + line.slice(2) + '</li>').join('')
      + '</ul></section><p>' + example.tips + '</p><p><a href="/?mau=' + example.slug + '">Dùng mẫu này trong CV Studio</a></p><p><a href="/mau-cv/">Xem tất cả mẫu</a></p>',
  };
});
const pages = [{
  path: '/mau-cv/', title: 'Tạo CV theo ngành với CV Studio',
  description: 'Tham khảo mẫu CV công nghệ, marketing và kế toán. Chỉnh sửa mẫu rồi xuất PDF A4.',
  body: '<p>Chọn một mẫu để xem ví dụ kinh nghiệm và mở bản sao trong trình chỉnh sửa.</p><ul>'
    + industry.map(page => '<li><a href="' + page.path + '">' + page.title + '</a></li>').join('')
    + '</ul><p><a href="/">Mở trình chỉnh sửa CV</a></p>',
}, ...industry];

let analytics = null;
try {
  analytics = JSON.parse(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG || '{}').analytics;
} catch {
  // Static builds work without Vercel Analytics configuration.
}
const analyticsPath = path => typeof path === 'string' && /^\/[a-zA-Z0-9_./-]+$/u.test(path) ? path : '';
const script = analyticsPath(analytics?.scriptSrc);
const endpoint = analyticsPath(analytics?.eventEndpoint);
const html = await readFile('index.html', 'utf8');
await mkdir('dist/vendor', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', html.replace('<html lang="vi">', '<html lang="vi" data-analytics-script="' + script + '" data-analytics-endpoint="' + endpoint + '">')),
  ...assets.map(file => copyFile(file, 'dist/' + file)),
  copyFile('node_modules/pdfjs-dist/build/pdf.min.mjs', 'dist/vendor/pdf.mjs'),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/vendor/pdf.worker.mjs'),
  copyFile('node_modules/pdfjs-dist/LICENSE', 'dist/vendor/LICENSE.txt'),
  ...pages.map(async ({ path, title, description, body }) => {
    const directory = 'dist' + path;
    await mkdir(directory, { recursive: true });
    await writeFile(directory + 'index.html', `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | CV Studio</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${domain + path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${domain + path}">
<meta property="og:image" content="${domain}/og.png">
<link rel="icon" href="/og.png" type="image/png">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="bar"><a class="brand" href="/"><span aria-hidden="true">CV</span> CV Studio</a></header>
<main class="landing"><h1>${title}</h1>${body}</main>
</body>
</html>`);
  }),
  writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + ['/', ...pages.map(page => page.path)].map(path => '<url><loc>' + domain + path + '</loc></url>').join('') + '</urlset>\n'),
  writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + domain + '/sitemap.xml\n'),
]);
