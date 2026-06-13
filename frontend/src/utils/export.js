export const getDocumentExportFilename = (documentData) => {
  const slug = typeof documentData?.slug === 'string'
    ? documentData.slug.trim()
    : '';

  if (slug) {
    return `${slug}_export.json`;
  }

  const id = documentData?.id;
  return id === null || id === undefined
    ? 'document_export.json'
    : `document_${id}_export.json`;
};

export const buildDocumentExport = ({
  documentData,
  labels,
  annotations,
  exportedAt = new Date().toISOString(),
}) => {
  const content =
    typeof documentData?.content === 'string' ? documentData.content : '';
  const normalizedLabels = labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
  }));
  const labelsById = new Map(
    normalizedLabels.map((label) => [Number(label.id), label])
  );

  return {
    schema_version: 2,
    exported_at: exportedAt,
    document: {
      id: documentData?.id ?? null,
      title: documentData?.title || '',
      slug: documentData?.slug || '',
      original_filename: documentData?.original_filename || '',
      created_at: documentData?.created_at || null,
      content,
    },
    labels: normalizedLabels,
    annotations: annotations.map((annotation) => {
      const start = Number(annotation.start);
      const end = Number(annotation.end);
      const labelId = Number(
        typeof annotation.label === 'object'
          ? annotation.label?.id
          : annotation.label
      );

      return {
        id: annotation.id,
        start,
        end,
        text: content.slice(start, end),
        label: labelsById.get(labelId) || null,
        label_id: labelId,
        created_at: annotation.created_at ?? null,
      };
    }),
  };
};
