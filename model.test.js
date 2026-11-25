import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPDFPage } from './pdf-import.js';
import { createDocument, fromText, isBackup, jobMatch, matchesLatestVersion, saveVersion, suggestVersion } from './model.js';

test('custom versions stay independent of drafts and copies', () => {
  const doc = createDocument('Software Engineer');
  doc.draft.name = 'An';
  const original = saveVersion(doc, ' v4.7.0 ', 'Gốc');
  assert.equal(suggestVersion(doc.versions), 'v4.7.1');
  assert.throws(() => saveVersion(doc, 'V4.7.0', ''), /đã có/u);
  doc.draft.name = 'Nguyễn An';
  saveVersion(doc, 'v4.8.0', '');
  assert.equal(original.cv.name, 'An');
  const copy = createDocument('Bản sao', original.cv, doc.versions);
  copy.draft.name = 'Bản sao';
  assert.equal(original.cv.name, 'An');
  assert.equal(isBackup({ format: 'cv-studio-v1', documents: [doc, copy] }), true);
  assert.equal(isBackup({ format: 'cv-studio-v1', documents: [{}] }), false);
});

test('matches the latest saved CV by content', () => {
  const doc = createDocument('CV');
  assert.equal(matchesLatestVersion(doc), false);
  const first = saveVersion(doc, 'v1', '');
  doc.draft = Object.fromEntries(Object.entries(doc.draft).reverse());
  assert.equal(matchesLatestVersion(doc), true);
  const duplicate = saveVersion(doc, 'v2', '');
  assert.deepEqual(duplicate.cv, first.cv);
  doc.draft.sections.reverse();
  assert.equal(matchesLatestVersion(doc), false);
  saveVersion(doc, 'v3', '');
  assert.equal(matchesLatestVersion(doc, first.cv), false);
});

test('repairs layout settings in saved drafts and versions without discarding CV content', async t => {
  globalThis.document = { documentElement: { dataset: {} } };
  t.after(() => { delete globalThis.document; });
  const { applyAppearance, repairDocumentAppearance } = await import('./studio.js');

  const doc = createDocument('CV');
  doc.draft.name = 'An';
  doc.draft.appearance = { template: 'nodeflair', color: '#123abc', margin: 12 };
  const version = saveVersion(doc, 'v1', '');
  doc.draft.appearance.color = ['#123abc'];
  version.cv.appearance.template = ['nodeflair'];
  const stored = JSON.parse(JSON.stringify({ format: 'cv-studio-v1', documents: [doc] }));
  assert.equal(isBackup(stored), true);

  const repaired = repairDocumentAppearance(stored.documents[0]);
  assert.equal(repaired.draft.name, 'An');
  assert.deepEqual(repaired.draft.appearance, { template: 'nodeflair', margin: 12 });
  assert.deepEqual(repaired.versions[0].cv.appearance, { color: '#123abc', margin: 12 });

  const styles = new Map();
  const paper = { dataset: {}, style: { setProperty: (name, value) => styles.set(name, value) } };
  applyAppearance(paper, repaired.draft);
  assert.equal(paper.dataset.template, 'nodeflair');
  assert.equal(styles.get('--accent'), '#202c3c');
});

test('text import preserves headings, contact information and bullets', () => {
  const cv = fromText('Nguyễn An - Software Engineer\nan@example.com\nGiới thiệu\nWORK EXPERIENCE\n• Built APIs');
  assert.equal(cv.name, 'Nguyễn An');
  assert.equal(cv.role, 'Software Engineer');
  assert.equal(cv.contacts, 'an@example.com');
  assert.equal(cv.sections[0].entries[0].body, '- Built APIs');
});

test('formatted import keeps rich text inside editable CV sections', () => {
  const cv = fromText([
    '**An - Engineer**',
    '[GitHub](https://github.com/example)',
    '**WORK EXPERIENCE**',
    '**Project**',
    '- Built [**the API**](https://example.com/api).',
  ].join('\n'));
  assert.equal(cv.name, 'An');
  assert.equal(cv.role, 'Engineer');
  assert.equal(cv.contacts, '[GitHub](https://github.com/example)');
  assert.equal(cv.sections[0].title, 'WORK EXPERIENCE');
  assert.equal(cv.sections[0].entries[0].body, '**Project**\n- Built [**the API**](https://example.com/api).');
});

test('PDF import groups each job with its organization, projects and bullets', async t => {
  const item = (str, x, y, width) => ({
    str, transform: [10, 0, 0, 10, x, y], width, height: 10, fontName: 'font', hasEOL: true,
  });
  const items = [
    item('An - Engineer', 220, 760, 100),
    item('Work Experience', 30, 720, 90),
    item('Oct 2022 - Present', 470, 700, 100),
    item('Software Engineer', 35, 700, 100),
    item('Hanoi, Vietnam', 490, 688, 80),
    item('NAB Vietnam', 35, 688, 60),
    item('Project: NAB Connect', 42.5, 682, 100),
    item('Awards', 42.5, 676, 40),
    item('•', 45, 664, 4),
    item('Recognition', 55, 664, 60),
    item('continued', 55, 652, 50),
    item('Engineer', 35, 642, 45),
    item('Dec 2020 - Oct 2022', 470, 642, 100),
    item('Boydens Engineering', 35, 630, 100),
    item('Hanoi, Vietnam', 490, 630, 80),
    item('- Designed Dynamo scripts', 55, 620, 120),
    item('Certifications', 30, 616, 75),
    item('May 2024', 520, 610, 50),
    item('Banking Fundamentals', 35, 610, 110),
  ];
  const context = {
    measureText: text => ({ width: text.length * 5 }),
    getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  t.after(() => { delete globalThis.document; });
  const pdf = {
    getTextContent: async () => ({ items }),
    getAnnotations: async () => [],
    getViewport: ({ scale }) => ({ scale, width: 600, height: 800, convertToViewportPoint: (x, y) => [x, 800 - y] }),
    view: [0, 0, 600, 800],
    render: () => ({ promise: Promise.resolve() }),
    commonObjs: new Map([['font', { name: 'Arial' }]]),
  };
  const cv = fromText(await extractPDFPage(pdf), true);
  assert.equal(cv.pdfLayout, true);
  assert.deepEqual(cv.sections.map(section => section.title), ['Work Experience', 'Certifications']);
  assert.deepEqual(cv.sections[0].entries, [
    {
      title: 'Software Engineer', date: 'Oct 2022 - Present',
      organization: 'NAB Vietnam', location: 'Hanoi, Vietnam',
      body: '     Project: NAB Connect\n     Awards\n          - Recognition continued',
    },
    {
      title: 'Engineer', date: 'Dec 2020 - Oct 2022',
      organization: 'Boydens Engineering', location: 'Hanoi, Vietnam',
      body: '          - Designed Dynamo scripts',
    },
  ]);
  assert.equal(cv.sections[1].entries[0].title, 'Banking Fundamentals');
  assert.equal(cv.sections[1].entries[0].date, 'May 2024');
});


test('job matching recognizes short technology names without trailing punctuation', () => {
  const cv = { role: 'Platform engineer', summary: 'Go, R, C++, C#, .NET, Node.js, SQL.', sections: [] };
  assert.deepEqual(jobMatch(cv, 'Go. R, C++! C#; .NET and Node.js. SQL and Rust.'), {
    count: 8, score: 88, missing: ['rust'],
  });
});

test('job matching deduplicates NFC terms and ignores hidden sections and empty descriptions', () => {
  const cv = { role: 'Vận hành', summary: '', sections: [
    { title: 'Skills', hidden: false, entries: [{ body: 'CI/CD' }] },
    { title: 'Python', hidden: true, entries: [{ body: 'Rust' }] },
  ] };
  assert.deepEqual(jobMatch(cv, 'HÀNH hành CI/CD python rust'.normalize('NFD')), {
    count: 5, score: 60, missing: ['python', 'rust'],
  });
  assert.deepEqual(jobMatch(cv, 'and the'), { count: 0, score: 0, missing: [] });
});

test('job matching does not count ordinary English go or Vietnamese ai in a description', () => {
  const cv = { role: '', summary: 'ability design production biết làm việc', sections: [] };
  assert.deepEqual(jobMatch(cv, 'ability to go from design to production. ai biết làm việc'), {
    count: 5, score: 100, missing: [],
  });
  assert.deepEqual(jobMatch(cv, 'go ai'), { count: 0, score: 0, missing: [] });
});

test('ordinary words in the CV do not satisfy explicit Go and AI requirements', () => {
  const cv = { role: '', summary: 'ability to go from design to production. ai biết làm việc', sections: [] };
  assert.deepEqual(jobMatch(cv, 'Go, AI, GO, AI.'), {
    count: 2, score: 0, missing: ['go', 'ai'],
  });
});

test('conventional Go and AI spellings match without changing other technology matching', () => {
  const cv = { role: '', summary: 'Go AI ci/cd c# .NET node.js', sections: [] };
  assert.deepEqual(jobMatch(cv, 'GO AI CI/CD C# .net Node.js. go ai'), {
    count: 7, score: 100, missing: [],
  });
});


test('share links allowlist visible fields without changing original CV or backups', async t => {
  globalThis.document = { documentElement: { dataset: {} } };
  t.after(() => { delete globalThis.document; });
  const { sharePayload, shareURL, decodeSharedCV } = await import('./studio.js');
  const entry = {
    title: 'Kỹ sư thử nghiệm', date: '2025', organization: 'Example Inc',
    location: 'Test city', body: '- Synthetic project 🚀',
  };
  const doc = createDocument('PRIVATE_DOCUMENT_LABEL', {
    name: 'Fictional Person', role: 'Engineer', contacts: 'test@example.invalid', summary: 'Sample summary',
    sections: [
      { title: 'Visible', hidden: false, entries: [{ ...entry, sourcePDF: 'PRIVATE_ENTRY_METADATA' }, {
        title: '', date: '', organization: '', location: '', body: ' ', note: 'PRIVATE_EMPTY_ENTRY',
      }], privateNote: 'PRIVATE_SECTION_METADATA' },
      { title: 'PRIVATE_HIDDEN_TITLE', hidden: true, entries: [{ ...entry, body: 'PRIVATE_HIDDEN_BODY' }] },
      { title: 'PRIVATE_EMPTY_SECTION', hidden: false, entries: [] },
    ],
    sourcePDF: 'data:application/pdf;base64,UFJJVkFURV9QREY=',
    appearance: { template: 'nodeflair', color: '#123abc', margin: 12, privateNote: 'PRIVATE_APPEARANCE' },
    pdfLayout: true,
    versions: [{ cv: { name: 'PRIVATE_DRAFT_METADATA' } }],
    privateNote: 'PRIVATE_TOP_LEVEL',
  });
  saveVersion(doc, 'PRIVATE_VERSION_LABEL', 'PRIVATE_VERSION_NOTE');
  doc.draft.summary = 'Updated synthetic summary';
  const backup = { format: 'cv-studio-v1', version: 1, documents: [doc] };
  const before = JSON.stringify(backup);
  const payload = sharePayload(doc.draft);
  const url = new URL(shareURL(doc.draft, 'https://example.invalid/?lang=en#previous'));
  const decoded = JSON.parse(Buffer.from(url.hash.slice(4), 'base64url').toString('utf8'));
  assert.equal(url.search, '');
  assert.deepEqual(decoded, payload);
  assert.deepEqual(decodeSharedCV(url.hash), payload);
  assert.deepEqual(decoded, {
    name: 'Fictional Person', role: 'Engineer', contacts: 'test@example.invalid', summary: 'Updated synthetic summary',
    sections: [{ title: 'Visible', hidden: false, entries: [entry] }],
    appearance: { template: 'nodeflair', color: '#123abc', size: 8.4, spacing: 1.43, margin: 12 },
    pdfLayout: true,
  });
  assert.doesNotMatch(JSON.stringify(decoded), /PRIVATE_|sourcePDF|versions/);
  assert.equal(JSON.stringify(backup), before);
  assert.equal(isBackup(JSON.parse(before)), true);
  assert.match(before, /PRIVATE_HIDDEN_BODY/);
  assert.match(before, /data:application\/pdf;base64,/);
  assert.match(before, /PRIVATE_VERSION_NOTE/);
  payload.sections[0].entries[0].body = 'Changed copy';
  assert.equal(doc.draft.sections[0].entries[0].body, entry.body);
});

test('legacy links still open, including previously encoded hidden sections', async t => {
  globalThis.document = { documentElement: { dataset: {} } };
  t.after(() => { delete globalThis.document; });
  const { decodeSharedCV, shareURL } = await import('./studio.js');
  const cv = createDocument('Fictional CV').draft;
  cv.name = 'Ví dụ';
  cv.sections[0].hidden = true;
  cv.sections[0].entries = [{ title: '', date: '', organization: '', location: '', body: 'old hidden content' }];
  const hash = '#cv=' + Buffer.from(JSON.stringify(cv)).toString('base64url');
  assert.deepEqual(decodeSharedCV(hash), cv);
  const reshared = new URL(shareURL(decodeSharedCV(hash), 'https://example.invalid/'));
  assert.deepEqual(decodeSharedCV(reshared.hash).sections, []);
  assert.throws(() => decodeSharedCV('#cv=invalid'));
  assert.throws(() => decodeSharedCV('#cv=' + 'a'.repeat(16001)));
  const pdfHash = '#cv=' + Buffer.from(JSON.stringify({ ...cv, sourcePDF: 'data:application/pdf;base64,AA==' })).toString('base64url');
  assert.throws(() => decodeSharedCV(pdfHash));
  assert.throws(() => shareURL({ ...cv, summary: 'a'.repeat(12001) }, 'https://example.invalid/'), /CV quá dài|too long/);
});

test('sharing previews the exact snapshot before creating a link and blocks original PDF view', async t => {
  const fakeElement = tag => ({
    tag, children: [], append(...children) { this.children.push(...children); },
    focus() {}, select() {},
  });
  globalThis.document = { documentElement: { dataset: {} }, createElement: fakeElement };
  globalThis.location = { href: 'https://example.invalid/' };
  t.after(() => { delete globalThis.document; delete globalThis.location; });
  const { showSharePreview, decodeSharedCV } = await import('./studio.js');
  const doc = createDocument('Synthetic');
  doc.draft.name = 'Saved view';
  doc.draft.sections[0].entries = [{ title: 'Visible job', date: '', organization: '', location: '', body: 'Visible body' }];
  doc.draft.sections[1].hidden = true;
  doc.draft.sections[1].entries = [{ title: 'Private job', date: '', organization: '', location: '', body: 'Private body' }];
  const saved = saveVersion(doc, 'v1', 'Synthetic history');
  doc.draft.name = 'Different draft';
  let dialog;
  const showDialog = (title, ...nodes) => { dialog = { title, nodes }; };
  const all = nodes => nodes.flatMap(node => [node, ...all(node.children)]);
  showSharePreview({ cv: saved.cv, original: true }, showDialog);
  assert.equal(all(dialog.nodes).some(node => node.tag === 'button' || node.tag === 'input'), false);
  showSharePreview({ cv: saved.cv, original: false }, showDialog);
  let nodes = all(dialog.nodes);
  assert.equal(nodes.some(node => node.tag === 'input'), false);
  const areas = nodes.filter(node => node.tag === 'textarea');
  assert.equal(areas.length, 2);
  assert.ok(areas.every(node => node.readOnly));
  assert.match(areas[0].value, /Saved view/);
  assert.doesNotMatch(areas[0].value, /Private body|Different draft/);
  const exact = JSON.parse(areas[1].value);
  assert.equal(exact.name, 'Saved view');
  saved.cv.name = 'Changed after review';
  nodes.find(node => node.tag === 'button').onclick();
  nodes = all(dialog.nodes);
  const link = new URL(nodes.find(node => node.tag === 'input').value);
  assert.deepEqual(decodeSharedCV(link.hash), exact);
  assert.equal(doc.draft.name, 'Different draft');
});
