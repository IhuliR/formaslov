import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Loader from './Loader';

function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="route-loader">
        <Loader />
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/documents" replace />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
