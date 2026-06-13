import { getRangeTextOffsets, normalizeNewlines } from './text';

test('normalizes Windows and old Mac newlines', () => {
  expect(normalizeNewlines('one\r\ntwo\rthree')).toBe('one\ntwo\nthree');
});

test('calculates offsets across nested highlighted text nodes', () => {
  const container = document.createElement('div');
  const plain = document.createTextNode('Alpha\n');
  const highlight = document.createElement('span');
  const highlightedText = document.createTextNode('Beta');
  const tail = document.createTextNode(' gamma');
  highlight.appendChild(highlightedText);
  container.append(plain, highlight, tail);
  document.body.appendChild(container);

  const range = document.createRange();
  range.setStart(plain, 2);
  range.setEnd(highlightedText, 2);

  expect(getRangeTextOffsets(container, range)).toEqual({
    start: 2,
    end: 8,
  });
  expect(container.textContent.slice(2, 8)).toBe('pha\nBe');

  container.remove();
});

test('supports range boundaries placed on the container element', () => {
  const container = document.createElement('div');
  const first = document.createElement('span');
  const second = document.createElement('span');
  first.textContent = 'first';
  second.textContent = 'second';
  container.append(first, second);
  document.body.appendChild(container);

  const range = document.createRange();
  range.setStart(container, 1);
  range.setEnd(container, 2);

  expect(getRangeTextOffsets(container, range)).toEqual({
    start: 5,
    end: 11,
  });

  container.remove();
});

test('rejects a range outside the document container', () => {
  const container = document.createElement('div');
  const outside = document.createTextNode('outside');
  container.textContent = 'inside';
  document.body.append(container, outside);

  const range = document.createRange();
  range.setStart(outside, 0);
  range.setEnd(outside, 3);

  expect(() => getRangeTextOffsets(container, range)).toThrow(
    'Selection is outside the document text'
  );

  container.remove();
  outside.remove();
});
