import { useState } from 'react';
import { changePassword } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

const getPasswordError = (error) => {
  const data = error?.response?.data;

  if (data?.current_password) {
    return 'Текущий пароль указан неверно.';
  }
  if (data?.re_new_password || data?.non_field_errors) {
    return 'Пароли не совпадают.';
  }
  if (data?.new_password) {
    return 'Новый пароль слишком простой. Выберите более длинный и уникальный пароль.';
  }
  return 'Не удалось изменить пароль. Попробуйте ещё раз.';
};

function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reNewPassword, setReNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== reNewPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        re_new_password: reNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setReNewPassword('');
      setSuccess('Пароль успешно изменён.');
    } catch (requestError) {
      setError(getPasswordError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <main className="container account-page">
        <section className="card account-card">
          <h1 className="page-title">Смена пароля</h1>
          <p className="account-username">
            Имя пользователя: <strong>{user?.username}</strong>
          </p>

          <form className="form-grid account-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="current-password">
              <span>Текущий пароль</span>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="field" htmlFor="new-password">
              <span>Новый пароль</span>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="field" htmlFor="repeat-new-password">
              <span>Повторите новый пароль</span>
              <input
                id="repeat-new-password"
                type="password"
                value={reNewPassword}
                onChange={(event) => setReNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <div className="actions-row">
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Изменяем...' : 'Изменить пароль'}
              </button>
            </div>

            {success ? <p className="success-message">{success}</p> : null}
            <ErrorMessage message={error} />
          </form>
        </section>
      </main>
    </div>
  );
}

export default AccountPage;
