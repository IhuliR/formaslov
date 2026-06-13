import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createTokenPair,
  getCurrentUser,
  refreshAccessToken,
  registerUser,
  setUnauthorizedHandler,
  verifyAccessToken,
} from '../api/api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveTokens,
} from './tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setStatus('unauthenticated');
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      navigate('/login', { replace: true });
    });

    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (!access) {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        await verifyAccessToken(access);
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch {
        if (!refresh) {
          clearTokens();
          if (!cancelled) {
            setUser(null);
            setStatus('unauthenticated');
          }
          return;
        }

        try {
          const nextAccess = await refreshAccessToken(refresh);
          saveAccessToken(nextAccess);
          await verifyAccessToken(nextAccess);
          const currentUser = await getCurrentUser();
          if (!cancelled) {
            setUser(currentUser);
            setStatus('authenticated');
          }
        } catch {
          clearTokens();
          if (!cancelled) {
            setUser(null);
            setStatus('unauthenticated');
          }
        }
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const tokens = await createTokenPair(username, password);
    saveTokens(tokens);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
    } catch (error) {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      throw error;
    }
  }, []);

  const register = useCallback(async (username, password) => {
    await registerUser(username, password);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
      register,
      user,
    }),
    [login, logout, register, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
