import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import { getAuthErrorMessage } from '../utils/apiErrors';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (nextUsername, nextPassword) => {
    await login(nextUsername, nextPassword);
    navigate('/documents', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(username, password);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
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
            <p className="eyebrow">Добро пожаловать</p>
            <h1>Вход</h1>
            <p className="auth-description">
              Войдите, чтобы продолжить работу с документами.
            </p>
          </div>

          {location.state?.registered ? (
            <p className="success-message">
              Аккаунт создан. Теперь войдите в приложение.
            </p>
          ) : null}

          <label className="field" htmlFor="username">
            <span>Имя пользователя</span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field" htmlFor="password">
            <span>Пароль</span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
          <Link to="/demo" className="btn ghost button-link">
            Попробовать демо
          </Link>

          <ErrorMessage message={error} />

          <p className="auth-switch">
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
