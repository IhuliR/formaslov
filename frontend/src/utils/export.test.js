import {
  buildDocumentExport,
  getDocumentExportFilename,
} from './export';

test('builds a self-contained schema v2 export from document content', () => {
  const content = 'Начало\nкраснокожих бесов\nконец';
  const start = content.indexOf('краснокожих');
  const end = start + 'краснокожих бесов'.length;

  const result = buildDocumentExport({
    documentData: {
      id: 5,
      title: 'Явление 2',
      slug: 'yavlenie-2',
      original_filename: 'Явление 2.txt',
      created_at: '2026-06-13T10:00:00Z',
      content,
    },
    labels: [{ id: 1, name: 'зло', color: '#ff0000' }],
    annotations: [{
      id: 6,
      document: 5,
      label: 1,
      start,
      end,
      text: 'stale text from API',
      created_at: '2026-06-13T10:05:00Z',
    }],
    exportedAt: '2026-06-13T11:00:00Z',
  });

  expect(result.schema_version).toBe(2);
  expect(result.document.content).toBe(content);
  expect(result.document.slug).toBe('yavlenie-2');
  expect(result.document.original_filename).toBe('Явление 2.txt');
  expect(result.annotations[0]).toEqual({
    id: 6,
    start,
    end,
    text: content.slice(start, end),
    label: { id: 1, name: 'зло', color: '#ff0000' },
    label_id: 1,
    created_at: '2026-06-13T10:05:00Z',
  });
});

test('uses the document slug for the export filename', () => {
  expect(getDocumentExportFilename({ id: 6, slug: 'tezka' }))
    .toBe('tezka_export.json');
  expect(getDocumentExportFilename({ id: 6 }))
    .toBe('document_6_export.json');
});
