import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/authContextObject';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import styles from './App.module.css';

const HomeRedirect = () => {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'agent') return <Navigate to="/agent" replace />;
  return <Navigate to="/customer" replace />;
};

const RequireRole = ({ roles, children }) => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <div className={styles.appShell}>
        <div className={styles.ambientGlow} />
        <div className={styles.ambientGlowSecondary} />
        <Navbar />
        <main className={styles.pageFrame}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/customer"
              element={(
                <RequireRole roles={['customer']}>
                  <CustomerDashboard />
                </RequireRole>
              )}
            />
            <Route
              path="/agent"
              element={(
                <RequireRole roles={['agent', 'admin']}>
                  <AgentDashboard />
                </RequireRole>
              )}
            />
            <Route
              path="/admin"
              element={(
                <RequireRole roles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              )}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
