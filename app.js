import { createDocument, emptyEntry, fromText, isBackup, saveVersion, suggestVersion } from './model.js';

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
  if (isBackup({ ...stored, format: storageKey }) && stored.documents.some(doc => doc.id === stored.active)) state = stored;
} catch {
  // Start with the sample if local storage is unavailable or contains invalid data.
}

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

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    status('Đã tự lưu trên trình duyệt');
  } catch {
    status('Không thể tự lưu. Hãy tải tệp sao lưu trước khi đóng trang.', true);
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
    renderPreview(active().draft);
  });
  wrapper.append(input);
  return wrapper;
}

function bind(label, object, property, multiline = false) {
  return field(label, object[property], value => { object[property] = value; }, multiline);
}

function renderEditor(openSections = []) {
  const doc = active();
  const cv = doc.draft;
  $('documents').replaceChildren(...state.documents.map(item => new Option(item.label, item.id)));
  $('documents').value = doc.id;
  const fields = $('fields');
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
      refresh([target]);
    };
    const up = button('Lên', () => move(-1));
    const down = button('Xuống', () => move(1));
    up.disabled = index === 0;
    down.disabled = index === cv.sections.length - 1;
    controls.append(up, down, button(section.hidden ? 'Hiện mục' : 'Ẩn mục', () => {
      section.hidden = !section.hidden;
      refresh([index]);
    }), button('Xóa mục', () => {
      if (confirm('Xóa mục này khỏi bản nháp?')) {
        cv.sections.splice(index, 1);
        refresh();
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
            refresh([index]);
          }
        }));
      card.append(item);
    });
    card.append(node('p', 'Dùng “- ” cho gạch đầu dòng, **chữ** để in đậm và [tên](https://…) cho liên kết.', 'muted'),
      button('+ Thêm dòng', () => { section.entries.push(emptyEntry()); refresh([index]); }));
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
      const link = node('a', match[1] || match[4]);
      link.href = match[2] || (/^https?:/i.test(match[4]) ? match[4] : 'mailto:' + match[4]);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      element.append(link);
    }
    cursor = match.index + match[0].length;
  }
  element.append(text.slice(cursor));
}

function renderPreview(cv) {
  const paper = $('paper');
  const head = node('div', undefined, 'cv-head');
  const contact = node('div', undefined, 'contacts');
  inline(contact, cv.contacts);
  head.append(node('h1', [cv.name, cv.role].filter(Boolean).join(' - ') || 'Họ tên'), contact);
  const summary = node('p', undefined, 'summary');
  inline(summary, cv.summary);
  paper.replaceChildren(head, summary);
  for (const section of cv.sections) {
    const entries = section.entries.filter(entry => Object.values(entry).some(value => value.trim()));
    if (section.hidden || !entries.length) continue;
    const block = node('section', undefined, 'cv-section');
    block.append(node('h2', section.title));
    for (const entry of entries) {
      const item = node('div', undefined, 'cv-entry');
      for (const [left, right] of [[entry.title, entry.date], [entry.organization, entry.location]]) {
        if (!left && !right) continue;
        const row = node('div', undefined, 'cv-line');
        const label = node('strong');
        inline(label, left);
        row.append(label, node('span', right));
        item.append(row);
      }
      let list;
      for (const line of entry.body.split('\n')) {
        const bullet = /^\s*[-•]\s+/u.test(line);
        if (bullet && !list) {
          list = node('ul');
          item.append(list);
        }
        if (!bullet) list = null;
        if (!line.trim()) continue;
        const paragraph = node(bullet ? 'li' : 'p', undefined, bullet ? '' : 'item-text');
        inline(paragraph, bullet ? line.replace(/^\s*[-•]\s+/u, '') : line);
        (bullet ? list : item).append(paragraph);
      }
      block.append(item);
    }
    paper.append(block);
  }
}

function refresh(openSections) {
  persist();
  renderEditor(openSections);
  renderPreview(active().draft);
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

function exportPDF(version) {
  $('dialog').close();
  const originalTitle = document.title;
  const filename = [version.cv.name, version.cv.role, version.label].filter(Boolean).join('-');
  document.title = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').replace(/\s+/gu, '_');
  renderPreview(version.cv);
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
    renderPreview(active().draft);
  }, { once: true });
  window.print();
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
  form.append(label, noteLabel, error, save);
  form.addEventListener('submit', event => {
    event.preventDefault();
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
    actions.append(button('Xuất PDF', () => exportPDF(version)));
    item.append(actions);
    return item;
  });
  showDialog(print ? 'Xuất PDF' : 'Lịch sử phiên bản',
    ...(print ? [node('p', 'Chọn “Lưu dưới dạng PDF” trong hộp thoại in và tắt đầu trang, chân trang nếu đang bật.', 'muted'),
      versionForm('Lưu phiên bản và xuất PDF', version => { persist(); exportPDF(version); })] : []),
    ...(versions.length ? versions : [node('p', 'Chưa có phiên bản đã lưu.', 'muted')]));
}

async function pdfText(file) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      pages.push(items.map(item => (item.str ?? '') + (item.hasEOL ? '\n' : '')).join(''));
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

function reviewImport(file, text) {
  if (!text.trim()) throw new Error('Không tìm thấy văn bản trong tệp. PDF scan cần OCR trước khi nhập.');
  let source = text;
  const title = file.name.replace(/\.[^.]+$/u, '');
  const review = field('Rà soát văn bản trích xuất', source, value => { source = value; }, true);
  review.querySelector('textarea').rows = 9;
  showDialog('Rà soát CV nhập',
    node('p', 'Kiểm tra tiêu đề mục, xuống dòng và ngày tháng. Bạn có thể sắp xếp lại các trường sau khi nhập.', 'muted'),
    review,
    button('Tạo CV riêng từ tệp', () => {
      $('dialog').close();
      addDocument(createDocument(title, fromText(source)));
    }, true),
    button('Thêm phiên bản vào CV đang mở', () => {
      const doc = active();
      showDialog('Đặt số cho phiên bản nhập', versionForm('Lưu phiên bản nhập', () => refresh(), doc, fromText(source)));
    }));
}

$('documents').addEventListener('change', event => { state.active = event.target.value; refresh(); });
$('new').onclick = () => addDocument(createDocument('CV mới'));
$('duplicate').onclick = () => addDocument(createDocument((active().label || 'CV') + ' (bản sao)', active().draft, active().versions));
$('history').onclick = () => showVersions();
$('export').onclick = () => showVersions(true);
$('save').onclick = () => showDialog('Lưu phiên bản', versionForm('Lưu phiên bản', persist));
$('add-section').onclick = () => {
  const sections = active().draft.sections;
  sections.push({ title: 'Mục mới', hidden: false, entries: [emptyEntry()] });
  refresh([sections.length - 1]);
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
      reviewImport(file, isPDF ? await pdfText(file) : await file.text());
      status('Đã đọc tệp. Nội dung sẵn sàng để rà soát.');
    }
  } catch (failure) {
    showDialog('Không thể nhập tệp', node('p', failure.message));
    persist();
  }
};

renderEditor();
renderPreview(active().draft);
persist();
