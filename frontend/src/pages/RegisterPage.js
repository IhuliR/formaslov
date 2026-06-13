import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (data?.username?.[0]) {
    return data.username[0];
  }
  if (data?.password?.[0]) {
    return data.password[0];
  }
  if (data) {
    return JSON.stringify(data);
  }
  return 'Не удалось зарегистрироваться. Проверьте соединение с сервером.';
};

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== passwordRepeat) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsLoading(true);

    try {
      await register(username, password);
      navigate('/login', {
        replace: true,
        state: { registered: true },
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-back-link">
          ← На главную
        </Link>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Новый аккаунт</p>
            <h1>Регистрация</h1>
            <p className="auth-description">
              Документы и аннотации будут доступны только вашему аккаунту.
            </p>
          </div>

          <label className="field" htmlFor="register-username">
            <span>Имя пользователя</span>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field" htmlFor="register-password">
            <span>Пароль</span>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field" htmlFor="register-password-repeat">
            <span>Повторите пароль</span>
            <input
              id="register-password-repeat"
              type="password"
              value={passwordRepeat}
              onChange={(event) => setPasswordRepeat(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>

          <ErrorMessage message={error} />

          <p className="auth-switch">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default RegisterPage;
