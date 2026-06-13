import { useRef, useState } from 'react';
import api from '../api/api';
import ErrorMessage from './ErrorMessage';
import { normalizeNewlines } from '../utils/text';

const getErrorMessage = (error) => {
  if (error?.response?.data) {
    return JSON.stringify(error.response.data);
  }
  return 'Network or server error';
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file, 'UTF-8');
  });

const getFilenameTitle = (filename) => filename.replace(/\.txt$/i, '');

function DocumentForm({ onCreated }) {
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedFile && !content.trim()) {
      setError('Выберите .txt файл или введите содержимое');
      return;
    }

    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.txt')) {
      setError('Поддерживаются только .txt файлы');
      return;
    }

    setLoading(true);

    try {
      const documentContent = selectedFile
        ? await readFileAsText(selectedFile)
        : content;
      const documentTitle =
        title.trim() || (selectedFile ? getFilenameTitle(selectedFile.name) : '');
      const formData = new FormData();
      formData.append('title', documentTitle);
      if (selectedFile) {
        formData.append('original_filename', selectedFile.name);
      }
      formData.append('content', normalizeNewlines(documentContent));

      const response = await api.post('documents/', formData);
      if (response.data) {
        setTitle('');
        setContent('');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (typeof onCreated === 'function') {
          onCreated();
        }
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Название</span>
        <input
          type="text"
          value={title}
          maxLength={255}
          placeholder="Например, Тёзка"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="field">
        <span>TXT-файл (опционально)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setSelectedFile(file);
            if (file) {
              setTitle((currentTitle) => (
                currentTitle.trim()
                  ? currentTitle
                  : getFilenameTitle(file.name)
              ));
            }
            setError('');
          }}
        />
      </label>
      <label className="field">
        <span>Содержимое</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
        />
      </label>
      <div className="actions-row">
        <button type="submit" className="btn" disabled={loading}>
          Создать
        </button>
      </div>
      <ErrorMessage message={error} />
    </form>
  );
}

export default DocumentForm;
