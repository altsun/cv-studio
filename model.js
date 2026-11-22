export const emptyEntry = () => ({ title: '', date: '', organization: '', location: '', body: '' });
export const emptyCV = () => ({
  name: '', role: '', contacts: '', summary: '',
  sections: ['Work Experience', 'Projects', 'Skills', 'Certifications', 'Education', 'Languages']
    .map(title => ({ title, hidden: false, entries: [] })),
});

export function createDocument(label, draft = emptyCV(), versions = []) {
  return { id: crypto.randomUUID(), label, draft: structuredClone(draft), versions: structuredClone(versions) };
}

export function matchesLatestVersion(document, cv = document.draft) {
  const latest = document.versions[0];
  if (!latest) return false;
  const sortKeys = (_, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
    : value;
  return JSON.stringify(cv, sortKeys) === JSON.stringify(latest.cv, sortKeys);
}

export function saveVersion(document, label, note, draft = document.draft) {
  label = label.trim();
  if (!label || label.length > 60) throw new Error('Nhập số phiên bản từ 1 đến 60 ký tự.');
  if (document.versions.some(version => version.label.toLowerCase() === label.toLowerCase())) {
    throw new Error('Số phiên bản này đã có trong CV đang mở.');
  }
  const version = { label, note, date: new Date().toISOString(), cv: structuredClone(draft) };
  document.versions.unshift(version);
  return version;
}

export function suggestVersion(versions) {
  if (!versions.length) return '';
  const match = /^(.*?)(\d+)$/u.exec(versions[0].label);
  if (!match) return '';
  let number = BigInt(match[2]);
  let suggestion;
  do {
    suggestion = match[1] + String(++number).padStart(match[2].length, '0');
  } while (versions.some(version => version.label.toLowerCase() === suggestion.toLowerCase()));
  return suggestion;
}

const hasStrings = (object, keys) => object && keys.every(key => typeof object[key] === 'string');

export function isCV(cv) {
  return hasStrings(cv, ['name', 'role', 'contacts', 'summary']) && (cv.sourcePDF === undefined || (typeof cv.sourcePDF === 'string'
      && cv.sourcePDF.startsWith('data:application/pdf;base64,'))) && Array.isArray(cv.sections)
    && cv.sections.every(section => hasStrings(section, ['title']) && typeof section.hidden === 'boolean'
      && Array.isArray(section.entries) && section.entries.every(entry => hasStrings(entry, Object.keys(emptyEntry()))));
}

export function isBackup(backup) {
  return backup?.format === 'cv-studio-v1' && Array.isArray(backup.documents) && backup.documents.length > 0
    && backup.documents.every(doc => hasStrings(doc, ['label']) && isCV(doc.draft) && Array.isArray(doc.versions)
      && doc.versions.every(v => hasStrings(v, ['label', 'note', 'date']) && Number.isFinite(Date.parse(v.date)) && isCV(v.cv))
      && new Set(doc.versions.map(v => v.label.trim().toLowerCase())).size === doc.versions.length);
}

export function fromText(text, pdfLayout = false) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const cv = emptyCV();
  if (pdfLayout) cv.pdfLayout = true;
  [cv.name, cv.role = ''] = (lines.shift() || '').trim().replace(/^\*\*(.+)\*\*$/u, '$1').split(/\s+[-–|]\s+(.+)/u, 2);
  cv.sections = [];
  const headings = /^(work experience|experience|professional experience|projects|skills|technical skills|certifications|education|languages|awards|kinh nghiệm|dự án|kỹ năng|chứng chỉ|học vấn|ngoại ngữ|kinh nghiệm làm việc)$/iu;
  let section;
  const summary = [];
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.replace(/^\*\*(.+)\*\*$/u, '$1');
    if (headings.test(heading) && (!pdfLayout || raw === raw.trimStart())) {
      section = { title: heading, hidden: false, entries: pdfLayout ? [] : [emptyEntry()] };
      cv.sections.push(section);
    } else if (section && pdfLayout) {
      section.entries.push({ ...emptyEntry(), body: raw });
    } else if (section) {
      const entry = section.entries[0];
      entry.body += (entry.body ? '\n' : '') + line.replace(/^[•●]\s*/u, '- ');
    } else if (!summary.length && /[@]|(?:https?:\/\/|linkedin\.com|github\.com)|\b\d{8,}\b/u.test(line)) {
      cv.contacts += (cv.contacts ? '\n' : '') + line;
    } else {
      summary.push(line);
    }
  }
  cv.summary = summary.join('\n');
  return cv;
}
