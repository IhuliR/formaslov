import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api/api';
import LabelsPage from './LabelsPage';

jest.mock('../api/api', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('../components/Header', () => () => <div>Header</div>);

beforeEach(() => {
  api.delete.mockReset();
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({
    data: [{ id: 1, name: 'зло', color: '#ff0000' }],
  });
});

test('shows the API detail and keeps a label after a 409 response', async () => {
  const detail =
    'Нельзя удалить метку «зло»: она используется в 7 аннотациях. ' +
    'Сначала удалите или измените эти аннотации.';
  api.delete.mockRejectedValue({
    response: {
      status: 409,
      data: { detail, code: 'label_in_use', annotations_count: 7 },
    },
  });

  render(<LabelsPage />);

  expect(await screen.findByText('зло')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

  expect(await screen.findByText(detail)).toBeInTheDocument();
  expect(screen.getByText('зло')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeEnabled()
  );
});

test('shows a short fallback when a 409 response has no detail', async () => {
  api.delete.mockRejectedValue({
    response: {
      status: 409,
      data: '<html>technical error</html>',
    },
  });

  render(<LabelsPage />);

  await screen.findByText('зло');
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

  expect(
    await screen.findByText(
      'Нельзя удалить метку: она используется в аннотациях.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(/technical error/i)).not.toBeInTheDocument();
});
