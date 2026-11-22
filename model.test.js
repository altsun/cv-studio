import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDocument, fromText, isBackup, saveVersion, suggestVersion } from './model.js';

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

test('text import preserves headings, contact information and bullets', () => {
  const cv = fromText('Nguyễn An - Software Engineer\nan@example.com\nGiới thiệu\nWORK EXPERIENCE\n• Built APIs');
  assert.equal(cv.name, 'Nguyễn An');
  assert.equal(cv.role, 'Software Engineer');
  assert.equal(cv.contacts, 'an@example.com');
  assert.equal(cv.sections[0].entries[0].body, '- Built APIs');
});
