const content = [
  'Анна приехала в Санкт-Петербург ранним утром.',
  'На Дворцовой площади она почувствовала радость и удивление.',
  'Вечером Анна записала впечатления и подготовила текст к анализу.',
].join('\n\n');

export const demoDocument = {
  id: 1,
  title: 'Демо: путешествие по Петербургу',
  slug: 'demo-puteshestvie-po-peterburgu',
  original_filename: '',
  created_at: '2026-06-13T09:00:00Z',
  content,
};

export const demoLabels = [
  { id: 1, name: 'персонаж', color: '#f59e0b' },
  { id: 2, name: 'место', color: '#2563eb' },
  { id: 3, name: 'эмоция', color: '#db2777' },
];

const annotation = (id, fragment, label, occurrence = 0) => {
  let start = -1;
  let searchFrom = 0;

  for (let index = 0; index <= occurrence; index += 1) {
    start = content.indexOf(fragment, searchFrom);
    searchFrom = start + fragment.length;
  }

  return {
    id,
    document: demoDocument.id,
    label,
    start,
    end: start + fragment.length,
    text: fragment,
    created_at: '2026-06-13T09:05:00Z',
  };
};

export const demoAnnotations = [
  annotation(1, 'Анна', 1),
  annotation(2, 'Санкт-Петербург', 2),
  annotation(3, 'Дворцовой площади', 2),
  annotation(4, 'радость', 3),
  annotation(5, 'удивление', 3),
  annotation(6, 'Анна', 1, 1),
];
