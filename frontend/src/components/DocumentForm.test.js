import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api/api';
import DocumentForm from './DocumentForm';

jest.mock('../api/api', () => ({
  post: jest.fn(),
}));

beforeEach(() => {
  api.post.mockReset();
  api.post.mockResolvedValue({ data: { id: 1 } });
});

test('creates a document from a selected txt file and gives the file priority', async () => {
  const onCreated = jest.fn();
  render(<DocumentForm onCreated={onCreated} />);

  fireEvent.change(screen.getByLabelText('Содержимое'), {
    target: { value: 'Ручной текст' },
  });
  const file = new File(['Добра\r\nи\rзла'], 'example.txt', {
    type: 'text/plain',
  });
  userEvent.upload(screen.getByLabelText('TXT-файл (опционально)'), file);
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

  const [url, formData] = api.post.mock.calls[0];
  expect(url).toBe('documents/');
  expect(formData.get('title')).toBe('example');
  expect(formData.get('original_filename')).toBe('example.txt');
  expect(formData.get('content')).toBe('Добра\nи\nзла');
  expect(onCreated).toHaveBeenCalledTimes(1);
});

test('fills an empty title from the selected Russian filename', () => {
  render(<DocumentForm />);

  const file = new File(['Текст'], 'Тёзка.txt', {
    type: 'text/plain',
  });
  userEvent.upload(screen.getByLabelText('TXT-файл (опционально)'), file);

  expect(screen.getByLabelText('Название')).toHaveValue('Тёзка');
});

test('does not replace a manually entered title when a file is selected', () => {
  render(<DocumentForm />);

  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: 'Моё название' },
  });
  const file = new File(['Текст'], 'Тёзка.txt', {
    type: 'text/plain',
  });
  userEvent.upload(screen.getByLabelText('TXT-файл (опционально)'), file);

  expect(screen.getByLabelText('Название')).toHaveValue('Моё название');
});

test('creates a document from manual content without a file', async () => {
  render(<DocumentForm />);

  const contentInput = screen.getByLabelText('Содержимое');
  expect(contentInput).not.toBeRequired();
  fireEvent.change(contentInput, {
    target: { value: 'Текст вручную' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1].get('content')).toBe('Текст вручную');
});

test('shows a validation error when neither a file nor content is provided', () => {
  render(<DocumentForm />);

  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

  expect(
    screen.getByText('Выберите .txt файл или введите содержимое')
  ).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
