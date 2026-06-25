import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockLogin = jest.fn();

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

beforeEach(() => {
  mockLogin.mockReset();
});

test('shows a user-friendly message for invalid credentials', async () => {
  mockLogin.mockRejectedValueOnce({
    response: {
      data: {
        detail: 'No active account found with the given credentials',
      },
    },
  });

  render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('Имя пользователя'), {
    target: { value: 'wrong-user' },
  });
  fireEvent.change(screen.getByLabelText('Пароль'), {
    target: { value: 'wrong-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

  expect(
    await screen.findByText('Неверное имя пользователя или пароль.')
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      '{"detail":"No active account found with the given credentials"}'
    )
  ).not.toBeInTheDocument();
});
