const AUTH_ERROR_MESSAGES = {
  'No active account found with the given credentials':
    'Неверное имя пользователя или пароль.',
};

export const getAuthErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;

  if (detail) {
    return AUTH_ERROR_MESSAGES[detail] || detail;
  }

  return 'Произошла ошибка. Попробуйте ещё раз.';
};
