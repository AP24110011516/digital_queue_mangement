import { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, LogOut, ShieldCheck, Sparkle } from 'lucide-react';
import { AuthContext } from '../context/authContextObject';
import styles from './Navbar.module.css';

const roleLinks = {
  admin: '/admin',
  agent: '/agent',
  customer: '/customer',
};

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link to={user ? roleLinks[user.role] : '/'} className={styles.brand}>
          <span className={styles.brandIcon}>
            <Activity size={20} />
          </span>
          <span>
            <strong>Queue</strong> Nexus
          </span>
        </Link>

        <div className={styles.meta}>
          {user ? (
            <>
              <div className={styles.statusPill}>
                <Sparkle size={14} />
                Live operations
              </div>
              <div className={styles.userChip}>
                <span className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</span>
                <div>
                  <p>{user.name}</p>
                  <span>{user.role}</span>
                </div>
              </div>
              <button type="button" onClick={handleLogout} className={styles.logoutButton}>
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <div className={styles.authLinks}>
              {location.pathname !== '/login' && <Link to="/login">Login</Link>}
              <Link to="/register" className={styles.primaryLink}>
                <ShieldCheck size={15} />
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
