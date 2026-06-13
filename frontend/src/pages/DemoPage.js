import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LabelPill from '../components/LabelPill';
import {
  demoAnnotations,
  demoDocument,
  demoLabels,
} from '../data/demoDocument';
import {
  buildDocumentExport,
  getDocumentExportFilename,
} from '../utils/export';

const toRgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const number = Number.parseInt(value, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const labelsById = Object.fromEntries(
  demoLabels.map((label) => [label.id, label])
);

const buildSegments = () => {
  const segments = [];
  let cursor = 0;

  [...demoAnnotations]
    .sort((left, right) => left.start - right.start)
    .forEach((annotation) => {
      if (cursor < annotation.start) {
        segments.push({
          key: `text-${cursor}`,
          text: demoDocument.content.slice(cursor, annotation.start),
        });
      }

      segments.push({
        key: `annotation-${annotation.id}`,
        text: demoDocument.content.slice(annotation.start, annotation.end),
        annotation,
      });
      cursor = annotation.end;
    });

  if (cursor < demoDocument.content.length) {
    segments.push({
      key: `text-${cursor}`,
      text: demoDocument.content.slice(cursor),
    });
  }

  return segments;
};

const segments = buildSegments();
const demoExport = buildDocumentExport({
  documentData: demoDocument,
  labels: demoLabels,
  annotations: demoAnnotations,
  exportedAt: '2026-06-13T09:10:00Z',
});

function DemoPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(demoExport, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getDocumentExportFilename(demoDocument);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <main className="container demo-page">
        <section className="demo-notice" aria-label="Ограничения демо-режима">
          <strong>Демо-режим только для просмотра.</strong>
          {isLoading ? (
            <span>Проверяем авторизацию...</span>
          ) : isAuthenticated ? (
            <>
              <span>
                Чтобы работать со своими документами, перейдите в рабочую зону.
              </span>
              <Link to="/documents" className="btn small button-link">
                К моим документам
              </Link>
            </>
          ) : (
            <span>
              Чтобы загрузить свой текст и создать разметку, зарегистрируйтесь
              или войдите.
            </span>
          )}
        </section>

        <section className="card demo-document">
          <p className="eyebrow">Пример размеченного документа</p>
          <h1 className="page-title">{demoDocument.title}</h1>

          <div className="labels-row demo-labels" aria-label="Пример меток">
            {demoLabels.map((label) => (
              <LabelPill key={label.id} label={label} />
            ))}
          </div>

          <div className="document-content-box demo-content">
            {segments.map((segment) => {
              const label = segment.annotation
                ? labelsById[segment.annotation.label]
                : null;

              return segment.annotation ? (
                <mark
                  key={segment.key}
                  className="highlighted-text"
                  style={{ backgroundColor: toRgba(label.color, 0.35) }}
                  title={label.name}
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={segment.key}>{segment.text}</span>
              );
            })}
          </div>

          <div className="section">
            <h2 className="section-title">Аннотации</h2>
            <ul className="demo-annotation-list">
              {demoAnnotations.map((annotation) => (
                <li key={annotation.id}>
                  <span>«{annotation.text}»</span>
                  <span aria-hidden="true">→</span>
                  <LabelPill label={labelsById[annotation.label]} />
                  <code>
                    {annotation.start}:{annotation.end}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="demo-grid">
          <article className="card demo-description">
            <p className="eyebrow">Полный режим</p>
            <h2>Работа со своими текстами</h2>
            <p>
              После входа можно загружать UTF-8 `.txt`, создавать собственные
              метки, выделять фрагменты и экспортировать результат.
            </p>
            <div className="landing-actions">
              {isAuthenticated ? (
                <Link to="/documents" className="btn button-link">
                  К моим документам
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn button-link">
                    Зарегистрироваться
                  </Link>
                  <Link to="/login" className="btn ghost button-link">
                    Войти
                  </Link>
                </>
              )}
            </div>
          </article>

          <article className="card demo-export">
            <div className="demo-export-heading">
              <div>
                <p className="eyebrow">Экспорт JSON</p>
                <h2>Структура результата</h2>
              </div>
              <button type="button" className="btn ghost" onClick={handleExport}>
                Скачать пример JSON
              </button>
            </div>
            <pre>
              <code>{JSON.stringify(demoExport, null, 2)}</code>
            </pre>
          </article>
        </section>
      </main>
    </div>
  );
}

export default DemoPage;
