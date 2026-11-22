import { examples, exampleCV } from './examples.js';
import { createDocument, isCV } from './model.js';
import { translate, setLanguage, language } from './translations.js';

const $ = id => document.getElementById(id);
const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: translate(text) });
function button(text, action) {
  const control = element('button', text);
  control.type = 'button';
  control.onclick = action;
  return control;
}

const defaults = { template: 'classic', color: '#214c92', size: 11, spacing: 1.43, margin: 13 };
const templates = { classic: 'Đơn giản', modern: 'Hiện đại', columns: 'Hai cột', ats: 'Tối ưu ATS' };
const metrics = { size: [9, 15, 0.5], spacing: [1.1, 1.9, 0.05], margin: [7, 24, 1] };

function appearance(cv) {
  const options = { ...defaults, ...cv?.appearance };
  if (!Object.hasOwn(templates, options.template)) options.template = defaults.template;
  if (!/^#[a-f0-9]{6}$/i.test(options.color)) options.color = defaults.color;
  for (const [key, [min, max]] of Object.entries(metrics)) {
    if (!Number.isFinite(options[key]) || options[key] < min || options[key] > max) options[key] = defaults[key];
  }
  return options;
}

export function applyAppearance(paper, cv) {
  const options = appearance(cv);
  paper.dataset.template = options.template;
  paper.style.setProperty('--accent', options.color);
  paper.style.setProperty('--cv-size', options.size);
  paper.style.setProperty('--cv-spacing', options.spacing);
  paper.style.setProperty('--cv-margin', options.margin);
}

export function addAppearance(cv, update) {
  const panel = element('div', '');
  panel.className = 'card appearance';
  panel.append(element('h2', 'Bố cục CV'));
  const options = appearance(cv);
  const controls = {
    template: ['Mẫu CV', element('select', '')],
    color: ['Màu chủ đạo', Object.assign(element('input', ''), { type: 'color' })],
  };
  for (const [value, name] of Object.entries(templates)) controls.template[1].add(new Option(translate(name), value));
  for (const [key, title] of Object.entries({ size: 'Cỡ chữ (pt)', spacing: 'Giãn dòng', margin: 'Lề (mm)' })) {
    const [min, max, step] = metrics[key];
    controls[key] = [title, Object.assign(element('input', ''), { type: 'number', min, max, step })];
  }
  for (const [key, [title, control]] of Object.entries(controls)) {
    const label = element('label', title);
    control.value = options[key];
    control.onchange = () => {
      if (!control.checkValidity() || !control.value) {
        control.value = options[key];
        return;
      }
      options[key] = Object.hasOwn(metrics, key) ? control.valueAsNumber : control.value;
      cv.appearance = { ...options };
      if (key === 'template') track('template');
      update();
    };
    label.append(control);
    panel.append(label);
  }
  return panel;
}

export function compareCV(saved, draft) {
  const comparison = element('div', '');
  comparison.className = 'comparison';
  const groups = cv => [
    [cv.name, cv.role, cv.contacts, cv.summary].filter(Boolean).join('\n'),
    ...cv.sections.map(section => [
      section.title + (section.hidden ? ' (' + translate('Đã ẩn') + ')' : ''),
      ...section.entries.map(entry => [entry.title, entry.date, entry.organization, entry.location, entry.body].filter(Boolean).join('\n')),
    ].join('\n')),
    Object.entries(appearance(cv)).map(([key, value]) => key + ': ' + value).join('\n'),
  ];
  const before = groups(saved);
  const after = groups(draft);
  for (const [heading, values, other] of [['Phiên bản đã lưu', before, after], ['Bản nháp', after, before]]) {
    const column = element('section', '');
    column.append(element('h3', heading));
    values.forEach((value, index) => {
      const block = document.createElement('pre');
      block.textContent = value;
      if (value !== other[index]) block.className = 'changed';
      column.append(block);
    });
    comparison.append(column);
  }
  return comparison;
}

const analyticsKey = 'cv-studio-metrics';
const events = ['create', 'export', 'template'];
let analyticsScript;
function sendMetric(event) {
  const { analyticsScript: source, analyticsEndpoint } = document.documentElement.dataset;
  if (!source) return;
  if (!analyticsScript) {
    globalThis.va ??= (...args) => { (globalThis.vaq ??= []).push(args); };
    globalThis.va('beforeSend', entry => {
      if (entry.type !== 'event') return null;
      return { ...entry, url: new URL(location.pathname, location.origin).href };
    });
    analyticsScript = document.createElement('script');
    analyticsScript.src = source;
    analyticsScript.defer = true;
    if (analyticsEndpoint) analyticsScript.dataset.eventEndpoint = analyticsEndpoint;
    document.head.append(analyticsScript);
  }
  globalThis.va('event', { name: 'resume_' + event });
}
export function track(event) {
  try {
    const metrics = JSON.parse(localStorage.getItem(analyticsKey));
    if (metrics && events.includes(event)) {
      metrics[event] = (metrics[event] || 0) + 1;
      localStorage.setItem(analyticsKey, JSON.stringify(metrics));
      sendMetric(event);
    }
  } catch {
    // Optional metrics must never interrupt editing.
  }
}

function shareURL(cv) {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...cv, sourcePDF: undefined }));
  if (bytes.length > 12000) throw new Error(translate('CV quá dài để tạo liên kết. Hãy chia sẻ tệp PDF.'));
  const url = new URL(location.href);
  url.search = '';
  url.hash = 'cv=' + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return url.href;
}

const words = text => new Set(text.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu)?.filter(word => word.length > 2) ?? []);
const stop = words('and the with for from you your our have about will are this that can các của cho trong một với việc được tại theo cần yêu cầu và hoặc');
function jobMatch(cv, description) {
  const target = [...words(description)].filter(word => !stop.has(word));
  const source = words([cv.role, cv.summary, ...cv.sections.filter(section => !section.hidden)
    .flatMap(section => [section.title, ...section.entries.flatMap(entry => Object.values(entry))])].join(' '));
  const missing = target.filter(word => !source.has(word));
  return { count: target.length, score: Math.round((1 - missing.length / target.length) * 100), missing };
}

export function installExtras({ active, addDocument, showDialog, render }) {
  $('language').value = language();
  $('language').onchange = () => { setLanguage($('language').value); render(); };
  const layout = $('workspace');
  for (const tab of ['editor', 'preview']) {
    const control = $('tab-' + tab);
    control.onclick = () => {
      layout.dataset.panel = tab;
      for (const name of ['editor', 'preview']) $('tab-' + name).setAttribute('aria-pressed', String(name === tab));
    };
  }
  $('share').onclick = () => {
    if (!active()) return;
    try {
      const input = element('input', '');
      Object.assign(input, { value: shareURL(active().draft), readOnly: true });
      const label = element('label', 'Liên kết CV');
      label.append(input);
      showDialog('Chia sẻ CV', element('p', 'Ai có liên kết đều đọc được nội dung CV. Hãy kiểm tra thông tin cá nhân trước khi gửi.'), label);
      input.focus();
      input.select();
    } catch (error) {
      showDialog('Chia sẻ CV', element('p', error.message));
    }
  };

  const example = examples.find(item => item.slug === new URLSearchParams(location.search).get('mau'));
  if (example && !location.hash) {
    addDocument(createDocument(example.role, exampleCV(example)));
    history.replaceState(null, '', location.pathname);
  }

  const shared = location.hash.slice(4);
  if (location.hash.startsWith('#cv=')) {
    try {
      if (shared.length > 16000) throw new Error();
      const bytes = Uint8Array.from(atob(shared.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
      const cv = JSON.parse(new TextDecoder().decode(bytes));
      if (!isCV(cv) || cv.sourcePDF) throw new Error();
      showDialog('Liên kết CV', element('p', cv.name + ' · ' + cv.role), button('Mở bản sao', () => {
        addDocument(createDocument(cv.name || 'CV', cv));
        history.replaceState(null, '', location.pathname);
        $('dialog').close();
      }));
    } catch {
      showDialog('Liên kết CV', element('p', 'Liên kết không hợp lệ.'));
    }
  }

  $('job').onclick = () => {
    if (!active()) return;
    const description = element('textarea', '');
    const label = element('label', 'Mô tả công việc');
    label.append(description);
    const result = element('p', '');
    result.setAttribute('role', 'status');
    const score = button('Chấm theo từ khóa', () => {
      const match = jobMatch(active().draft, description.value);
      result.textContent = match.count
        ? match.score + '% · ' + translate('Từ khóa chưa có') + ' ' + (match.missing.slice(0, 20).join(', ') || '—')
        : translate('Nhập mô tả công việc để tính điểm.');
    });
    const role = element('input', '');
    const roleLabel = element('label', 'Vị trí ứng tuyển');
    roleLabel.append(role);
    const content = element('textarea', '');
    content.spellcheck = true;
    const contentLanguage = element('select', '');
    contentLanguage.append(new Option('Tiếng Việt', 'vi'), new Option('English', 'en'));
    contentLanguage.value = language();
    content.lang = contentLanguage.value;
    contentLanguage.onchange = () => { content.lang = contentLanguage.value; };
    const languageLabel = element('label', 'Ngôn ngữ nội dung');
    languageLabel.append(contentLanguage);
    const contentLabel = element('label', 'Gạch đầu dòng cần rà soát');
    contentLabel.append(content);
    const suggestion = element('p', '');
    suggestion.setAttribute('role', 'status');
    const suggest = async (control, api, options, run) => {
      const text = content.value.trim();
      if (!text) { content.focus(); return; }
      rewrite.disabled = proofread.disabled = true;
      suggestion.textContent = translate('Đang tạo gợi ý…');
      let session;
      try {
        if (!api || await api.availability(options) === 'unavailable') {
          suggestion.textContent = translate('AI trên thiết bị chưa hỗ trợ ngôn ngữ hoặc trình duyệt này. Bạn vẫn có thể dùng kiểm tra chính tả của trình duyệt.');
          return;
        }
        session = await api.create({
          ...options,
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', event => {
              suggestion.textContent = translate('Đang tải mô hình AI') + ' ' + Math.round(event.loaded * 100) + '%';
            });
          },
        });
        suggestion.textContent = await run(session, text);
      } catch {
        suggestion.textContent = translate('Không thể tạo gợi ý AI. Hãy thử lại.');
      } finally {
        session?.destroy?.();
        rewrite.disabled = proofread.disabled = false;
        if (control.isConnected) control.focus();
      }
    };
    const rewrite = button('Gợi ý viết lại bằng AI', () => suggest(rewrite, globalThis.Rewriter,
      { expectedInputLanguages: [content.lang], expectedContextLanguages: ['en'], outputLanguage: content.lang, tone: 'more-formal' },
      (session, text) => session.rewrite(text, { context: 'Rewrite as concise resume bullet points. Preserve all facts and do not invent metrics.' })));
    const proofread = button('Kiểm tra chính tả bằng AI', () => suggest(proofread, globalThis.Proofreader,
      { expectedInputLanguages: [content.lang] }, async (session, text) => (await session.proofread(text)).correctedInput));
    const aiActions = element('div', '');
    aiActions.className = 'actions';
    aiActions.append(rewrite, proofread);
    showDialog('Ứng tuyển', label, score, result, roleLabel, button('Tạo CV cho vị trí này', () => {
      if (!role.value.trim()) { role.focus(); return; }
      const cv = { ...active().draft, role: role.value.trim() };
      track('create');
      addDocument(createDocument(cv.role, cv));
      $('dialog').close();
    }), languageLabel, contentLabel, aiActions, suggestion);
  };

  $('metrics').onclick = () => {
    const open = () => {
      try {
        const metrics = JSON.parse(localStorage.getItem(analyticsKey));
        const summary = metrics
          ? [translate('Tạo CV') + ' ' + (metrics.create || 0), translate('Xuất PDF') + ' ' + (metrics.export || 0), translate('Đổi mẫu') + ' ' + (metrics.template || 0)].join(' · ')
          : translate('Đo lường đang tắt.');
        showDialog('Đo lường', element('p', document.documentElement.dataset.analyticsScript
          ? 'Khi bật, các sự kiện tạo CV, đổi mẫu và yêu cầu in được gửi ẩn danh. Nội dung CV không được gửi.'
          : 'Bộ đếm ẩn danh chỉ lưu trên trình duyệt này và không ghi nội dung CV.'), element('p', summary), button(metrics ? 'Tắt và xóa số liệu' : 'Bật đo lường', () => {
          if (metrics) localStorage.removeItem(analyticsKey);
          else localStorage.setItem(analyticsKey, '{}');
          open();
        }));
      } catch {
        showDialog('Đo lường', element('p', 'Trình duyệt không cho phép lưu số liệu.'));
      }
    };
    open();
  };
}
