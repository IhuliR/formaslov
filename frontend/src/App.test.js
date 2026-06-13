import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('renders the public landing page with primary actions', async () => {
  render(<App />);

  expect(
    await screen.findByRole('heading', { name: 'Formaslov' })
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Formaslov' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(
    screen.getByRole('link', { name: 'Попробовать демо' })
  ).toHaveAttribute('href', '/demo');
  expect(
    await screen.findByRole('link', { name: 'Зарегистрироваться' })
  ).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute(
    'href',
    '/login'
  );
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    'приложение для ручной разметки текстов'
  );
  expect(screen.getByRole('link', { name: 'Репозиторий' })).toHaveAttribute(
    'href',
    'https://github.com/IhuliR/formaslov'
  );
});

test('opens a static read-only demo without creating auth tokens', async () => {
  render(<App />);

  fireEvent.click(
    await screen.findByRole('link', { name: 'Попробовать демо' })
  );

  expect(
    await screen.findByRole('heading', {
      name: 'Демо: путешествие по Петербургу',
    })
  ).toBeInTheDocument();
  expect(
    screen.getByText('Демо-режим только для просмотра.')
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Скачать пример JSON' })
  ).toBeInTheDocument();
  expect(document.querySelector('form')).not.toBeInTheDocument();
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(localStorage.getItem('refresh_token')).toBeNull();
});

test('redirects an unauthenticated user from documents to login', async () => {
  window.history.pushState({}, '', '/documents');
  render(<App />);

  expect(
    await screen.findByRole('heading', { name: 'Вход' })
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Formaslov' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
});

test('redirects an unauthenticated user from account to login', async () => {
  window.history.pushState({}, '', '/account');
  render(<App />);

  expect(
    await screen.findByRole('heading', { name: 'Вход' })
  ).toBeInTheDocument();
});

test('registration form rejects different passwords', async () => {
  window.history.pushState({}, '', '/register');
  render(<App />);

  fireEvent.change(await screen.findByLabelText('Имя пользователя'), {
    target: { value: 'new-user' },
  });
  fireEvent.change(screen.getByLabelText('Пароль'), {
    target: { value: 'first-password' },
  });
  fireEvent.change(screen.getByLabelText('Повторите пароль'), {
    target: { value: 'second-password' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Зарегистрироваться' })
  );

  expect(await screen.findByText('Пароли не совпадают.')).toBeInTheDocument();
});
