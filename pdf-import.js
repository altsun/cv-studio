const marker = /^\s*(?:[•●▪◦‣]|-\s)/u;
const boldFont = /bold|demi|heavy|black/iu;

// Some PDF generators draw list markers as paths outside the text layer.
function drawnBullet(context, viewport, item) {
  const [x, y] = viewport.convertToViewportPoint(...item.transform.slice(4));
  const size = Math.abs(item.transform[3]) * viewport.scale;
  const left = Math.floor(x - size * 1.35);
  const top = Math.floor(y - size * 0.85);
  const width = Math.floor(size * 1.2);
  const height = Math.ceil(y - top);
  if (left < 0 || top < 0 || width < 1 || height < 1) return false;
  const { data } = context.getImageData(left, top, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      if (data[i + 3] < 128 || data[i] + data[i + 1] + data[i + 2] > 510) continue;
      minX = Math.min(minX, col);
      minY = Math.min(minY, row);
      maxX = Math.max(maxX, col);
      maxY = Math.max(maxY, row);
    }
  }
  return maxX >= 0 && minX > 0 && maxX < width - 1 && minY > 0 && maxY < height - 1
    && maxX - minX + 1 <= size * 0.5 && maxY - minY + 1 <= size * 0.5;
}

function formatLine(items, links, fonts, context) {
  const runs = [];
  let end;
  for (const item of items) {
    const [x, y] = item.transform.slice(4);
    const font = fonts.get(item.fontName) || '';
    const bold = boldFont.test(font);
    const family = /times|serif/iu.test(font) && !/sans/iu.test(font) ? 'serif' : 'sans-serif';
    context.font = (bold ? 'bold ' : '') + Math.max(1, item.height) + 'px ' + family;
    const scale = item.width / (context.measureText(item.str).width || 1);
    const lastRun = runs.at(-1);
    if (lastRun && x - end > item.height * 0.15 && !/\s$/u.test(lastRun.text)
      && !/^\s/u.test(item.str)) lastRun.text += ' ';
    end = x + item.width;
    for (const part of item.str.matchAll(/\S+|\s+/gu)) {
      const midpoint = x + scale * (context.measureText(item.str.slice(0, part.index)).width + context.measureText(part[0]).width / 2);
      const link = links.find(({ rect }) => y >= rect[1] - 1 && y <= rect[3] + 1 && midpoint >= rect[0] && midpoint <= rect[2]);
      const url = link?.url;
      const last = runs.at(-1);
      if (last?.bold === bold && last.url === url) last.text += part[0];
      else runs.push({ text: part[0], bold, url });
    }
  }
  let formatted = '';
  for (let i = 0; i < runs.length;) {
    const url = runs[i].url;
    let label = '';
    do {
      const { text, bold } = runs[i++];
      label += bold ? text.replace(/\S(?:.*\S)?/u, '**$&**') : text;
    } while (url && runs[i]?.url === url);
    const target = url?.replace(/[()\s]/gu, char => '%' + char.charCodeAt(0).toString(16));
    formatted += target ? label.replace(/\S(?:.*\S)?/u, value => '[' + value + '](' + target + ')') : label;
  }
  return formatted.trim();
}

export async function extractPDFPage(page) {
  const [{ items }, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations()]);
  const textItems = items.filter(item => item.str?.trim());
  if (!textItems.length) return '';
  const links = annotations.filter(item => item.rect && /^(https?:\/\/|mailto:)/iu.test(item.url || ''));
  const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(page.view[2] - page.view[0], page.view[3] - page.view[1])), rotation: 0 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  await page.render({ canvas, viewport }).promise;
  const fonts = new Map();
  const lines = [];
  textItems.sort((a, b) => b.transform[5] - a.transform[5]);
  for (const item of textItems) {
    if (!fonts.has(item.fontName) && page.commonObjs.has(item.fontName)) {
      fonts.set(item.fontName, page.commonObjs.get(item.fontName).name);
    }
    const row = lines.at(-1);
    if (row && row[0].transform[5] - item.transform[5] <= 2) row.push(item);
    else lines.push([item]);
  }
  for (const line of lines) line.sort((a, b) => a.transform[4] - b.transform[4]);
  const left = lines.reduce((min, line) => Math.min(min, line[0].transform[4]), Infinity);

  const formatted = [];
  for (const line of lines) {
    const first = line.find(item => item.str.trim());
    if (!first) continue;
    const [x, y] = first.transform.slice(4);
    const hasBullet = marker.test(first.str) || drawnBullet(context, viewport, first);
    // Separate a right-hand column from the text when the PDF leaves a wide gap.
    let column = -1;
    for (let i = 1; i < line.length; i++) {
      const previous = line[i - 1];
      const gap = line[i].transform[4] - previous.transform[4] - previous.width;
      if (gap > first.height * 3 && line[i].transform[4] > (page.view[0] + page.view[2]) / 2) column = i;
    }
    let text = formatLine(column < 0 ? line : line.slice(0, column), links, fonts, context);
    if (column >= 0) text += '\t' + formatLine(line.slice(column), links, fonts, context);
    const prior = formatted.at(-1);
    if (hasBullet) {
      text = '- ' + text.replace(/^(\*\*)?(?:[•●▪◦‣]|-\s)\s*(\*\*)?\s*/u,
        (_, opening, closing) => opening && !closing ? opening : '');
    }
    if (!text.includes('\t') && !hasBullet && prior?.bullet && Math.abs(x - prior.x) < 1.5 && prior.y - y > 0 && prior.y - y < first.height * 1.8) {
      prior.text += ' ' + text;
      prior.y = y;
    } else {
      const contentX = marker.test(first.str) && line[1] && !first.str.replace(marker, '').trim()
        ? line[1].transform[4] : x;
      const indent = Math.round((contentX - left) / (first.height * 0.25 || 2));
      formatted.push({ text: ' '.repeat(indent) + text, x: contentX, y, bullet: hasBullet });
    }
  }
  return formatted.map(line => line.text).join('\n');
}
