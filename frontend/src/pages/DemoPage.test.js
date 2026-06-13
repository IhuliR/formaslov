import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Layout from '../components/Layout';
import DemoPage from './DemoPage';

jest.mock('../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const renderDemo = () =>
  render(
    <MemoryRouter initialEntries={['/demo']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/demo" element={<DemoPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

test('shows login and registration actions to an anonymous user', () => {
  useAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    logout: jest.fn(),
    user: null,
  });

  renderDemo();

  expect(
    screen.getAllByRole('link', { name: 'Зарегистрироваться' }).length
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByRole('link', { name: 'Войти' }).length
  ).toBeGreaterThan(0);
  expect(screen.queryByRole('link', { name: 'Документы' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Метки' })).not.toBeInTheDocument();
});

test('shows workspace navigation and no auth CTA to an authenticated user', () => {
  useAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    logout: jest.fn(),
    user: { id: 1, username: 'account-user' },
  });

  renderDemo();

  expect(screen.getByRole('link', { name: 'Документы' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Метки' })).toBeInTheDocument();
  expect(screen.getByText('account-user')).not.toHaveAttribute('href');
  expect(
    screen.getByRole('link', { name: 'Сменить пароль' })
  ).toHaveAttribute('href', '/account');
  expect(
    screen.getAllByRole('link', { name: 'К моим документам' }).length
  ).toBeGreaterThan(0);
  expect(
    screen.queryByRole('link', { name: 'Зарегистрироваться' })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Войти' })).not.toBeInTheDocument();
});
