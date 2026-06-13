export const normalizeNewlines = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

const getNodeTextLength = (node) => {
  if (node.nodeType === 3) {
    return node.data.length;
  }

  return Array.from(node.childNodes).reduce(
    (length, child) => length + getNodeTextLength(child),
    0
  );
};

const getOffsetWithinNode = (node, offset) => {
  if (node.nodeType === 3) {
    if (offset < 0 || offset > node.data.length) {
      throw new Error('Selection offset is outside a text node');
    }
    return offset;
  }

  if (offset < 0 || offset > node.childNodes.length) {
    throw new Error('Selection offset is outside an element');
  }

  return Array.from(node.childNodes)
    .slice(0, offset)
    .reduce((length, child) => length + getNodeTextLength(child), 0);
};

const getBoundaryTextOffset = (container, boundaryNode, boundaryOffset) => {
  if (!container || !boundaryNode || !container.contains(boundaryNode)) {
    throw new Error('Selection is outside the document text');
  }

  let offset = getOffsetWithinNode(boundaryNode, boundaryOffset);
  let currentNode = boundaryNode;

  while (currentNode !== container) {
    let sibling = currentNode.previousSibling;
    while (sibling) {
      offset += getNodeTextLength(sibling);
      sibling = sibling.previousSibling;
    }
    currentNode = currentNode.parentNode;
  }

  return offset;
};

export const getRangeTextOffsets = (container, range) => {
  if (!container || !range) {
    throw new Error('Document text and selection range are required');
  }

  const start = getBoundaryTextOffset(
    container,
    range.startContainer,
    range.startOffset
  );
  const end = getBoundaryTextOffset(
    container,
    range.endContainer,
    range.endOffset
  );

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
};
