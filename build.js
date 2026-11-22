import { cp, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { examples } from './examples.js';

const domain = 'https://cv-studio-phi.vercel.app';
const assets = ['style.css', 'app.js', 'model.js', 'pdf-import.js', 'studio.js', 'translations.js', 'examples.js', 'og.png'];
const pages = ['vi', 'en'].flatMap(lang => {
  const english = lang === 'en';
  const library = english ? '/en/mau-cv/' : '/mau-cv/';
  const alternateLibrary = english ? '/mau-cv/' : '/en/mau-cv/';
  const editor = '/?lang=' + lang;
  const industry = examples.map(example => {
    const content = english ? example.en : example;
    const suffix = example.slug + '/';
    const title = english ? content.title + ' Resume Example' : 'Mẫu CV ' + content.title;
    const experience = english ? 'Experience' : 'Kinh nghiệm';
    const useSample = english ? 'Use this example in CV Studio' : 'Dùng mẫu này trong CV Studio';
    const allSamples = english ? 'See all examples' : 'Xem tất cả mẫu';
    return {
      lang, path: library + suffix, alternate: alternateLibrary + suffix, title, description: content.tips,
      body: '<p>' + content.summary + '</p><section class="card"><h2>' + experience + '</h2><p><strong>' + content.role + '</strong> · ' + content.organization + '</p><ul>'
        + content.body.split('\n').map(line => '<li>' + line.slice(2) + '</li>').join('')
        + '</ul></section><p>' + content.tips + '</p><p><a href="' + editor + '&amp;mau=' + example.slug + '">' + useSample + '</a></p><p><a href="' + library + '">' + allSamples + '</a></p>',
    };
  });
  const intro = english ? 'Choose an example to see sample experience and open a copy in the editor.' : 'Chọn một mẫu để xem ví dụ kinh nghiệm và mở bản sao trong trình chỉnh sửa.';
  const openEditor = english ? 'Open the resume editor' : 'Mở trình chỉnh sửa CV';
  return [{
    lang, path: library, alternate: alternateLibrary,
    title: english ? 'Resume Examples by Industry' : 'Tạo CV theo ngành với CV Studio',
    description: english ? 'Explore technology, marketing, and accounting resume examples. Edit an example and export it as an A4 PDF.' : 'Tham khảo mẫu CV công nghệ, marketing và kế toán. Chỉnh sửa mẫu rồi xuất PDF A4.',
    body: '<p>' + intro + '</p><ul>'
      + industry.map(page => '<li><a href="' + page.path + '">' + page.title + '</a></li>').join('')
      + '</ul><p><a href="' + editor + '">' + openEditor + '</a></p>',
  }, ...industry];
});

let analytics = null;
try {
  analytics = JSON.parse(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG || '{}').analytics;
} catch {
  // Static builds work without Vercel Analytics configuration.
}
const analyticsPath = path => typeof path === 'string' && /^\/[a-zA-Z0-9_./-]+$/u.test(path) ? path : '';
const production = process.env.VERCEL_ENV === 'production';
const script = production ? analyticsPath(analytics?.scriptSrc) || '/_vercel/insights/script.js' : '';
const endpoint = analyticsPath(analytics?.eventEndpoint);
const viewEndpoint = analyticsPath(analytics?.viewEndpoint);
const html = await readFile('index.html', 'utf8');
await mkdir('dist/vendor', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', html.replace('<html lang="vi">', '<html lang="vi" data-analytics-script="' + script + '" data-analytics-endpoint="' + endpoint + '" data-analytics-view="' + viewEndpoint + '">')),
  cp('ai-icons', 'dist/ai-icons', { recursive: true }),
  ...assets.map(file => copyFile(file, 'dist/' + file)),
  copyFile('node_modules/pdfjs-dist/build/pdf.min.mjs', 'dist/vendor/pdf.mjs'),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/vendor/pdf.worker.mjs'),
  copyFile('node_modules/pdfjs-dist/LICENSE', 'dist/vendor/LICENSE.txt'),
  ...pages.map(async ({ lang, path, alternate, title, description, body }) => {
    const otherLanguage = lang === 'en' ? 'vi' : 'en';
    const directory = 'dist' + path;
    await mkdir(directory, { recursive: true });
    await writeFile(directory + 'index.html', `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | CV Studio</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${domain + path}">
<link rel="alternate" hreflang="${lang}" href="${domain + path}">
<link rel="alternate" hreflang="${otherLanguage}" href="${domain + alternate}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${domain + path}">
<meta property="og:image" content="${domain}/og.png">
<link rel="icon" href="/og.png" type="image/png">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="bar"><a class="brand" href="/?lang=${lang}"><span aria-hidden="true">CV</span> CV Studio</a><a href="${alternate}" hreflang="${otherLanguage}" lang="${otherLanguage}">${lang === 'en' ? 'Tiếng Việt' : 'English'}</a></header>
<main class="landing"><h1>${title}</h1>${body}</main>
</body>
</html>`);
  }),
  writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + ['/', ...pages.map(page => page.path)].map(path => '<url><loc>' + domain + path + '</loc></url>').join('') + '</urlset>\n'),
  writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + domain + '/sitemap.xml\n'),
]);
