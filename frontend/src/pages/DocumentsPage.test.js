import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../api/api';
import DocumentsPage from './DocumentsPage';

jest.mock('../api/api', () => ({
  get: jest.fn(),
}));
jest.mock('../components/DocumentForm', () => () => <div />);
jest.mock('../components/Header', () => () => <div />);

test('shows the document title and slug instead of an id-based title', async () => {
  api.get.mockResolvedValue({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [{
        id: 6,
        title: 'Тёзка',
        slug: 'tezka',
        created_at: '2026-06-13T09:00:00Z',
      }],
    },
  });

  render(
    <MemoryRouter>
      <DocumentsPage />
    </MemoryRouter>
  );

  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByRole('link', { name: 'Тёзка' })
  ).toBeInTheDocument();
  expect(screen.getByText(/tezka/)).toBeInTheDocument();
  expect(screen.queryByText('Документ #6')).not.toBeInTheDocument();
});
