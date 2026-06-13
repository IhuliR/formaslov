import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import api, { getCurrentUser, verifyAccessToken } from '../api/api';

jest.mock('../api/api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
  createTokenPair: jest.fn(),
  getCurrentUser: jest.fn(),
  refreshAccessToken: jest.fn(),
  registerUser: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('access_token', 'access');
  localStorage.setItem('refresh_token', 'refresh');
  window.history.pushState({}, '', '/labels');
  api.get.mockReset();
  getCurrentUser.mockReset();
  verifyAccessToken.mockReset();
  verifyAccessToken.mockResolvedValue({});
  getCurrentUser.mockResolvedValue({
    id: 1,
    username: 'account-user',
  });
  api.get.mockResolvedValue({
    data: [{ id: 1, name: 'Личная метка', color: '#ff0000' }],
  });
});

test('logout removes labels from the UI and clears user tokens', async () => {
  render(<App />);

  expect(await screen.findByText('Личная метка')).toBeInTheDocument();
  expect(screen.getByText('account-user')).not.toHaveAttribute('href');
  expect(
    screen.getByRole('link', { name: 'Сменить пароль' })
  ).toHaveAttribute('href', '/account');
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

  await waitFor(() => {
    expect(screen.queryByText('Личная метка')).not.toBeInTheDocument();
  });
  expect(
    await screen.findByRole('heading', { name: 'Formaslov' })
  ).toBeInTheDocument();
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(localStorage.getItem('refresh_token')).toBeNull();
});
