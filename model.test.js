import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPDFPage } from './pdf-import.js';
import { createDocument, fromText, isBackup, matchesLatestVersion, saveVersion, suggestVersion } from './model.js';

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

test('PDF import retains indented subheadings and right-hand columns on the same row', async t => {
  const item = (str, x, y, width) => ({
    str, transform: [10, 0, 0, 10, x, y], width, height: 10, fontName: 'font', hasEOL: true,
  });
  const items = [
    item('An - Engineer', 220, 760, 100),
    item('Work Experience', 30, 720, 90),
    item('Oct 2022 - Present', 470, 700, 100),
    item('Software Engineer', 35, 700, 100),
    item('Hanoi, Vietnam', 490, 688, 80),
    item('Company', 35, 688, 50),
    item('Awards', 42.5, 676, 40),
    item('•', 45, 664, 4),
    item('Recognition', 55, 664, 60),
    item('continued', 55, 652, 50),
    item('Certifications', 30, 630, 75),
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
  assert.equal(cv.sections[0].entries[0].body, [
    '  Software Engineer\tOct 2022 - Present',
    '  Company\tHanoi, Vietnam',
    '     Awards',
    '          - Recognition continued',
  ].join('\n'));
  assert.equal(cv.sections[1].entries[0].body, '  Banking Fundamentals\tMay 2024');
});
