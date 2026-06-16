import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import AccountPage from './pages/AccountPage';
import AboutPage from './pages/AboutPage';
import DemoPage from './pages/DemoPage';
import DocumentPage from './pages/DocumentPage';
import DocumentsPage from './pages/DocumentsPage';
import LabelsPage from './pages/LabelsPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TechnologiesPage from './pages/TechnologiesPage';
import './styles/App.css';

function AuthenticatedApp() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthenticatedApp />}>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/technologies" element={<TechnologiesPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<PrivateRoute />}>
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentPage />} />
            <Route path="/labels" element={<LabelsPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
