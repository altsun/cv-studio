import { extractPDFPage } from './pdf-import.js';
import { createDocument, emptyEntry, fromText, isBackup, matchesLatestVersion, saveVersion, suggestVersion } from './model.js';

const $ = id => document.getElementById(id);
const storageKey = 'cv-studio-v1';
const sample = createDocument('CV của tôi');
Object.assign(sample.draft, {
  name: 'Alex Nguyen', role: 'Software Engineer', contacts: 'Hà Nội • alex@example.com',
  summary: 'Software engineer focusing on backend systems and developer tooling.',
});
sample.draft.sections[0].entries.push({
  ...emptyEntry(), title: 'Software Engineer', date: '2022 – Present',
  organization: 'Example Studio', location: 'Hà Nội',
  body: '**Backend Platform**\n- Built APIs and improved automated test coverage.',
});
let state = { documents: [sample], active: sample.id };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored?.documents?.length === 0 && stored.active === null) state = stored;
  else if (isBackup({ ...stored, format: storageKey }) && stored.documents.some(doc => doc.id === stored.active)) state = stored;
} catch {
  // Start with the sample if local storage is unavailable or contains invalid data.
}

const editablePreviews = new WeakSet();
const active = () => state.documents.find(doc => doc.id === state.active);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const button = (text, click, primary = false) => {
  const element = node('button', text, primary ? 'primary' : '');
  element.type = 'button';
  element.addEventListener('click', click);
  return element;
};

function persist(nextState = state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    status('Đã tự lưu trên trình duyệt');
    return true;
  } catch {
    status('Không thể tự lưu. Hãy tải tệp sao lưu trước khi đóng trang.', true);
    return false;
  }
}

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

function field(label, value, update, multiline = false) {
  const wrapper = node('label', label);
  const input = node(multiline ? 'textarea' : 'input');
  input.value = value;
  input.addEventListener('input', () => {
    update(input.value);
    persist();
    if (!wrapper.closest('dialog')) {
      editablePreviews.add(active().draft);
      renderPreview(active().draft);
    }
  });
  wrapper.append(input);
  return wrapper;
}

function bind(label, object, property, multiline = false) {
  return field(label, object[property], value => { object[property] = value; }, multiline);
}

function renderEditor(openSections = []) {
  const doc = active();
  const documents = $('documents');
  documents.replaceChildren(...state.documents.map(item => new Option(item.label || 'CV chưa đặt tên', item.id)));
  for (const id of ['documents', 'duplicate', 'delete', 'backup', 'history', 'save', 'export', 'add-section']) {
    $(id).disabled = !doc;
  }
  const fields = $('fields');
  if (!doc) {
    documents.add(new Option('Chưa có CV', ''));
    fields.replaceChildren();
    return;
  }
  documents.value = doc.id;
  const cv = doc.draft;
  const basic = node('div', undefined, 'card');
  const identity = node('div', undefined, 'row');
  identity.append(bind('Họ tên', cv, 'name'), bind('Vị trí', cv, 'role'));
  basic.append(bind('Tên CV', doc, 'label'), identity, bind('Liên hệ', cv, 'contacts', true),
    bind('Giới thiệu', cv, 'summary', true));
  basic.firstChild.querySelector('input').addEventListener('input', () => {
    $('documents').selectedOptions[0].textContent = doc.label || 'CV chưa đặt tên';
  });
  fields.replaceChildren(basic);

  cv.sections.forEach((section, index) => {
    const card = node('details', undefined, 'card');
    card.open = openSections.includes(index);
    const heading = node('summary', section.title || 'Mục chưa đặt tên');
    const title = field('Tên mục', section.title, value => {
      section.title = value;
      heading.textContent = value || 'Mục chưa đặt tên';
    });
    const controls = node('div', undefined, 'actions');
    const move = offset => {
      const target = index + offset;
      [cv.sections[index], cv.sections[target]] = [cv.sections[target], cv.sections[index]];
      refreshEdit([target]);
    };
    const up = button('Lên', () => move(-1));
    const down = button('Xuống', () => move(1));
    up.disabled = index === 0;
    down.disabled = index === cv.sections.length - 1;
    controls.append(up, down, button(section.hidden ? 'Hiện mục' : 'Ẩn mục', () => {
      section.hidden = !section.hidden;
      refreshEdit([index]);
    }), button('Xóa mục', () => {
      if (confirm('Xóa mục này khỏi bản nháp?')) {
        cv.sections.splice(index, 1);
        refreshEdit();
      }
    }));
    card.append(heading, title, controls);
    section.entries.forEach((entry, entryIndex) => {
      const item = node('div', undefined, 'entry');
      const titleRow = node('div', undefined, 'row');
      titleRow.append(bind('Tiêu đề', entry, 'title'), bind('Thời gian', entry, 'date'));
      const organization = node('div', undefined, 'row');
      organization.append(bind('Đơn vị', entry, 'organization'), bind('Địa điểm', entry, 'location'));
      item.append(titleRow, organization, bind('Nội dung', entry, 'body', true),
        button('Xóa dòng', () => {
          if (confirm('Xóa dòng này khỏi bản nháp?')) {
            section.entries.splice(entryIndex, 1);
            refreshEdit([index]);
          }
        }));
      card.append(item);
    });
    card.append(node('p', 'Dùng “- ” cho gạch đầu dòng, **chữ** để in đậm và [tên](https://…) cho liên kết.', 'muted'),
      button('+ Thêm dòng', () => { section.entries.push(emptyEntry()); refreshEdit([index]); }));
    fields.append(card);
  });
}

function inline(element, text) {
  const tokens = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|\*\*([^*\n]+)\*\*|((?:https?:\/\/)[^\s<]+|[\w.%+-]+@[\w.-]+\.[a-z]{2,})/giu;
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    element.append(text.slice(cursor, match.index));
    if (match[3]) {
      element.append(node('strong', match[3]));
    } else {
      const link = node('a');
      for (const [index, part] of (match[1] || match[4]).split(/\*\*([^*\n]+)\*\*/gu).entries()) {
        link.append(index % 2 ? node('strong', part) : part);
      }
      link.href = match[2] || (/^https?:/i.test(match[4]) ? match[4] : 'mailto:' + match[4]);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      element.append(link);
    }
    cursor = match.index + match[0].length;
  }
  element.append(text.slice(cursor));
}

let reflowPreview;
let previewWidth;
new ResizeObserver(() => {
  const width = $('paper').clientWidth;
  if (width !== previewWidth) {
    previewWidth = width;
    reflowPreview?.();
  }
}).observe($('paper'));

function paginatePreview(paper, content) {
  let page;
  let body;
  let parents;
  let copies;
  const addPage = () => {
    page = node('div', undefined, 'preview-page');
    body = node('div', undefined, 'preview-page-content');
    page.append(body);
    paper.append(page);
    parents = [];
    copies = [body];
  };
  const append = (path, element) => {
    let depth = 0;
    while (depth < parents.length && parents[depth] === path[depth]) depth++;
    copies.length = depth + 1;
    for (const parent of path.slice(depth)) {
      const copy = parent.cloneNode(false);
      copies.at(-1).append(copy);
      copies.push(copy);
    }
    const copy = element.cloneNode(true);
    copies.at(-1).append(copy);
    parents = path;
    return copy;
  };
  // shortcut: a single oversized text block can grow a page; split inside text if needed.
  const place = parts => {
    const hadContent = body.hasChildNodes();
    const added = parts.map(([path, element]) => append(path, element));
    if (hadContent && page.offsetHeight > page.clientWidth * 297 / 210 + 1) {
      for (const element of added.reverse()) {
        let parent = element.parentNode;
        element.remove();
        while (parent !== body && !parent.hasChildNodes()) {
          const empty = parent;
          parent = empty.parentNode;
          empty.remove();
        }
      }
      addPage();
      for (const [path, element] of parts) append(path, element);
    }
  };

  paper.replaceChildren();
  addPage();
  for (const block of content.children) {
    if (!block.matches('.cv-section')) {
      place([[[], block]]);
      continue;
    }
    let pending = [[[block], block.firstElementChild]];
    for (const entry of Array.from(block.children).slice(1)) {
      for (const child of entry.children) {
        const path = [block, entry];
        if (child.matches('div.cv-line') && child.nextElementSibling) {
          pending.push([path, child]);
          continue;
        }
        for (const part of child.matches('ul') ? child.children : [child]) {
          const partPath = part === child ? path : [...path, child];
          place([...pending, [partPath, part]]);
          pending = [];
        }
      }
    }
  }
}

function renderPreview(cv, original = Boolean(cv?.sourcePDF) && !editablePreviews.has(cv), paginate = true) {
  reflowPreview = undefined;
  const paper = $('paper');
  paper.classList.toggle('paginated-paper', Boolean(cv) && !original && paginate);

  const controls = $('preview-controls');
  controls.replaceChildren();
  paper.classList.toggle('pdf-paper', original);
  if (!cv) {
    paper.replaceChildren(node('p', 'Tạo hoặc nhập CV để xem trước.', 'muted'));
    return;
  }
  if (cv.sourcePDF) {
    controls.append(button(original ? 'Bản chỉnh sửa' : 'PDF gốc', () => {
      if (original) editablePreviews.add(cv);
      else editablePreviews.delete(cv);
      renderPreview(cv);
    }));
  }
  if (original) {
    const download = node('a', 'Tải PDF gốc');
    download.href = cv.sourcePDF;
    download.download = (cv.name || 'CV') + '.pdf';
    controls.append(download);
    const pages = node('div');
    paper.replaceChildren(pages);
    renderPDF(cv.sourcePDF, pages).catch(() => {
      pages.replaceChildren(node('p', 'Không thể hiển thị PDF. Bạn có thể tải PDF gốc để xem.'));
    });
    return;
  }
  const head = node('div', undefined, 'cv-head');
  const contact = node('div', undefined, 'contacts');
  inline(contact, cv.contacts);
  head.append(node('h1', [cv.name, cv.role].filter(Boolean).join(' - ') || 'Họ tên'), contact);
  const summary = node('p', undefined, 'summary');
  inline(summary, cv.summary);
  const content = node('div');
  content.append(head, summary);
  for (const section of cv.sections) {
    const entries = section.entries.filter(entry => Object.values(entry).some(value => value.trim()));
    if (section.hidden || !entries.length) continue;
    const block = node('section', undefined, 'cv-section');
    block.append(node('h2', section.title));
    for (const entry of entries) {
      const item = node('div', undefined, cv.pdfLayout ? 'cv-entry pdf-entry' : 'cv-entry');
      block.append(item);
      for (const [left, right] of [[entry.title, entry.date], [entry.organization, entry.location]]) {
        if (!left && !right) continue;
        const row = node('div', undefined, 'cv-line');
        const label = node('strong');
        inline(label, left);
        const value = node('span');
        if (cv.pdfLayout) inline(value, right);
        else value.textContent = right;
        row.append(label, value);
        item.append(row);
      }
      let list;
      let listIndent;
      for (const line of entry.body.split('\n')) {
        const indent = cv.pdfLayout ? /^ */u.exec(line)[0].length : 0;
        const bullet = /^\s*[-•]\s+/u.test(line);
        if (bullet && (!list || listIndent !== indent)) {
          list = node('ul');
          if (cv.pdfLayout) list.style.paddingInlineStart = indent * 0.25 + 'em';
          listIndent = indent;
          item.append(list);
        }
        if (!bullet) list = null;
        if (!line.trim()) continue;
        const paragraph = node(bullet ? 'li' : 'p', undefined, bullet ? '' : 'item-text');
        const content = bullet ? line.replace(/^\s*[-•]\s+/u, '') : line;
        const tab = cv.pdfLayout ? content.indexOf('\t') : -1;
        if (cv.pdfLayout && !bullet) paragraph.style.paddingInlineStart = indent * 0.25 + 'em';
        if (tab >= 0 && !bullet) {
          paragraph.classList.add('cv-line');
          const left = node('span');
          const right = node('span');
          inline(left, content.slice(0, tab).trim());
          inline(right, content.slice(tab + 1));
          paragraph.append(left, right);
        } else {
          inline(paragraph, cv.pdfLayout ? content.trimStart() : content);
        }
        (bullet ? list : item).append(paragraph);
      }
    }
    content.append(block);
  }
  if (paginate) {
    reflowPreview = () => paginatePreview(paper, content);
    reflowPreview();
  } else {
    paper.replaceChildren(...content.children);
  }
}

function refreshEdit(openSections) {
  editablePreviews.add(active().draft);
  refresh(openSections);
}

function refresh(openSections) {
  persist();
  render(openSections);
}

function render(openSections) {
  renderEditor(openSections);
  renderPreview(active()?.draft);
}

function addDocument(doc) {
  state.documents.push(doc);
  state.active = doc.id;
  refresh();
}

function showDialog(title, ...content) {
  $('dialog-body').replaceChildren(node('h2', title), ...content, button('Đóng', () => $('dialog').close()));
  if (!$('dialog').open) $('dialog').showModal();
}

function exportPDF(cv) {
  $('dialog').close();
  const filename = (active().label.trim() || 'CV').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').replace(/[. ]+$/u, '') || 'CV';
  const frame = node('iframe', undefined, 'print-frame');
  frame.title = 'Bản in CV';
  frame.tabIndex = -1;
  renderPreview(cv, false, false);
  const paper = $('paper').cloneNode(true);
  renderPreview(active()?.draft);

  frame.addEventListener('load', () => {
    const originalTitle = document.title;
    frame.contentDocument.title = filename;
    frame.contentDocument.querySelector('main').append(paper);
    frame.contentWindow.addEventListener('afterprint', () => {
      document.title = originalTitle;
      frame.remove();
    }, { once: true });
    // Chrome uses the top-level title to suggest the PDF filename.
    document.title = filename;
    frame.contentWindow.print();
  }, { once: true });
  frame.srcdoc = '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="style.css"><title></title></head><body>' +
    '<main></main></body></html>';
  document.body.append(frame);
}

function versionForm(title, onSave, target = active(), cv = target.draft) {
  const form = node('form');
  const label = node('label', 'Số phiên bản');
  const number = node('input');
  number.required = true;
  number.maxLength = 60;
  number.placeholder = 'Ví dụ v4.7.0';
  number.value = suggestVersion(target.versions);
  label.append(number);
  const noteLabel = node('label', 'Ghi chú');
  const note = node('input');
  noteLabel.append(note);
  const error = node('p', '', 'error');
  error.setAttribute('role', 'alert');
  const save = node('button', title, 'primary');
  save.type = 'submit';
  const unchanged = matchesLatestVersion(target, cv);
  save.formNoValidate = unchanged;
  form.append(label, noteLabel, error, save);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (unchanged && !window.confirm('Nội dung giống phiên bản lưu gần nhất. Bạn có muốn tạo phiên bản mới không?')) {
      $('dialog').close();
      return;
    }
    try {
      const version = saveVersion(target, number.value, note.value.trim(), cv);
      $('dialog').close();
      onSave(version);
    } catch (failure) {
      error.textContent = failure.message;
    }
  });
  return form;
}

function showVersions(print = false) {
  const doc = active();
  const versions = doc.versions.map(version => {
    const item = node('div', undefined, 'entry');
    const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(version.date));
    item.append(node('strong', version.label), node('p', [date, version.note].filter(Boolean).join(' · '), 'muted'));
    const actions = node('div', undefined, 'actions');
    if (!print) actions.append(button('Xem', () => {
      $('dialog').close();
      renderPreview(version.cv);
      status('Đang xem ' + version.label);
      $('status').append(' ', button('Về bản nháp', () => {
        renderPreview(doc.draft);
        persist();
      }));
    }), button('Khôi phục', () => {
      const restore = () => {
        doc.draft = structuredClone(version.cv);
        $('dialog').close();
        refresh();
      };
      const current = JSON.stringify(doc.draft);
      if (doc.versions.some(saved => JSON.stringify(saved.cv) === current)) restore();
      else showDialog('Bản nháp có thay đổi',
        versionForm('Lưu bản nháp rồi khôi phục', restore),
        button('Khôi phục ngay', restore));
    }));
    actions.append(button('Xuất PDF', () => exportPDF(version.cv)));
    item.append(actions);
    return item;
  });
  showDialog(print ? 'Xuất PDF' : 'Lịch sử phiên bản',
    ...(print ? [node('p', 'Chọn “Lưu dưới dạng PDF” trong hộp thoại in và tắt đầu trang, chân trang nếu đang bật.', 'muted'),
      versionForm('Lưu phiên bản và xuất PDF', version => { persist(); exportPDF(version.cv); })] : []),
    ...(versions.length ? versions : [node('p', 'Chưa có phiên bản đã lưu.', 'muted')]));
}

async function loadPDF(data, fontExtraProperties = false) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  return pdfjs.getDocument({ data, isEvalSupported: false, fontExtraProperties });
}

async function renderPDF(source, container) {
  const task = await loadPDF(await (await fetch(source)).arrayBuffer());
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages && container.isConnected; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = node('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Trang ' + number);
      await page.render({ canvas, viewport }).promise;
      container.append(canvas);
    }
  } finally {
    await task.destroy();
  }
}

function readPDFSource(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve('data:application/pdf;base64,' + reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function pdfText(file) {
  const task = await loadPDF(await file.arrayBuffer(), true);
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      pages.push(await extractPDFPage(page));
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

function reviewImport(file, text, sourcePDF, isPDF = false) {
  if (!text.trim() && !sourcePDF) throw new Error('Không tìm thấy văn bản trong tệp.');
  const importedCV = () => {
    const cv = fromText(source, isPDF && Boolean(source.trim()));
    if (sourcePDF && !source.trim()) cv.sourcePDF = sourcePDF;
    return cv;
  };
  let source = text;
  const title = file.name.replace(/\.[^.]+$/u, '');
  const review = field('Rà soát văn bản trích xuất', source, value => { source = value; }, true);
  review.querySelector('textarea').rows = 9;
  showDialog('Rà soát CV nhập',
    node('p', isPDF
      ? (text.trim() ? 'Rà soát dấu đầu dòng, chữ đậm và liên kết trước khi lưu thành CV Studio.'
        : 'Ứng dụng giữ bố cục PDF gốc. Tệp này cần OCR để trích văn bản có thể chỉnh sửa.')
      : 'Kiểm tra tiêu đề mục, xuống dòng và ngày tháng. Bạn có thể sắp xếp lại các trường sau khi nhập.', 'muted'),
    review,
    button('Tạo CV riêng từ tệp', () => {
      $('dialog').close();
      addDocument(createDocument(title, importedCV()));
    }, true),
    ...(active() ? [button('Thêm phiên bản vào CV đang mở', () => {
      const doc = active();
      showDialog('Đặt số cho phiên bản nhập', versionForm('Lưu phiên bản nhập', () => refresh(), doc, importedCV()));
    })] : []));
}

$('documents').addEventListener('change', event => { state.active = event.target.value; refresh(); });
$('new').onclick = () => addDocument(createDocument('CV mới'));
$('duplicate').onclick = () => addDocument(createDocument((active().label || 'CV') + ' (bản sao)', active().draft, active().versions));
$('delete').onclick = () => {
  const doc = active();
  if (!confirm('Xóa “' + (doc.label || 'CV chưa đặt tên') + '” và tất cả phiên bản đã lưu?')) return;
  const index = state.documents.indexOf(doc);
  const documents = state.documents.filter(item => item !== doc);
  const nextState = { documents, active: (documents[index] ?? documents[index - 1])?.id ?? null };
  if (!persist(nextState)) return;
  state = nextState;
  render();
  status('Đã xóa CV');
  (active() ? $('documents') : $('new')).focus();
};
$('history').onclick = () => showVersions();
$('export').onclick = () => {
  const doc = active();
  if (matchesLatestVersion(doc)) exportPDF(doc.draft);
  else showVersions(true);
};
$('save').onclick = () => showDialog('Lưu phiên bản', versionForm('Lưu phiên bản', () => persist()));
$('add-section').onclick = () => {
  const sections = active().draft.sections;
  sections.push({ title: 'Mục mới', hidden: false, entries: [emptyEntry()] });
  refreshEdit([sections.length - 1]);
  $('fields').lastElementChild.scrollIntoView({ block: 'nearest' });
};
$('backup').onclick = () => {
  const blob = new Blob([JSON.stringify({ format: storageKey, documents: state.documents }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = node('a');
  link.href = url;
  link.download = 'cv-studio-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('import').onclick = () => $('file').click();
$('file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 24 * 1024 * 1024) throw new Error('Chọn tệp nhỏ hơn 24 MB.');
    if (/\.json$/iu.test(file.name)) {
      const backup = JSON.parse((await file.text()).replace(/^\uFEFF/u, ''));
      if (!isBackup(backup)) throw new Error('Tệp sao lưu CV Studio không hợp lệ.');
      const documents = backup.documents.map(doc => createDocument(doc.label, doc.draft, doc.versions));
      state.documents.push(...documents);
      state.active = documents[0].id;
      refresh();
    } else {
      const isPDF = /\.pdf$/iu.test(file.name);
      status('Đang đọc tệp…');
      if (isPDF) {
        const text = await pdfText(file);
        reviewImport(file, text, text.trim() ? undefined : await readPDFSource(file), true);
      } else {
        reviewImport(file, await file.text());
      }
      status('Đã đọc tệp. Nội dung sẵn sàng để rà soát.');
    }
  } catch (failure) {
    showDialog('Không thể nhập tệp', node('p', failure.message));
    persist();
  }
};

refresh();
