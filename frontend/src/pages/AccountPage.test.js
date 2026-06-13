import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { changePassword } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import Layout from '../components/Layout';
import AccountPage from './AccountPage';

jest.mock('../api/api', () => ({
  changePassword: jest.fn(),
}));

jest.mock('../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

beforeEach(() => {
  changePassword.mockReset();
  useAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    logout: jest.fn(),
    user: { id: 1, username: 'account-user' },
  });
});

test('shows the username and rejects mismatched passwords before the request', () => {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getAllByText('account-user')).toHaveLength(2);
  expect(
    screen.getByRole('heading', { name: 'Смена пароля' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Сменить пароль' })
  ).toHaveAttribute('href', '/account');

  fireEvent.change(screen.getByLabelText('Текущий пароль'), {
    target: { value: 'current-password' },
  });
  fireEvent.change(screen.getByLabelText('Новый пароль'), {
    target: { value: 'new-password-one' },
  });
  fireEvent.change(screen.getByLabelText('Повторите новый пароль'), {
    target: { value: 'new-password-two' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Изменить пароль' }));

  expect(screen.getByText('Пароли не совпадают.')).toBeInTheDocument();
  expect(changePassword).not.toHaveBeenCalled();
});
