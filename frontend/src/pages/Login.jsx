import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, MonitorCog, ShieldCheck, User } from 'lucide-react';
import { AuthContext } from '../context/authContextObject';
import styles from './AuthPage.module.css';

const roles = [
  {
    key: 'admin',
    label: 'Admin',
    description: 'Manage queue routing, counters and analytics.',
    icon: ShieldCheck,
    accent: '#ff8f74',
  },
  {
    key: 'customer',
    label: 'Customer',
    description: 'Generate token, track position and submit feedback.',
    icon: User,
    accent: '#77e6ff',
  },
  {
    key: 'staff',
    label: 'Counter Staff',
    description: 'Accept tokens, set service duration and complete service.',
    icon: MonitorCog,
    accent: '#a18eff',
  },
];

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (key) => {
    setSelectedRole(key);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const response = await login(email, password);
    setLoading(false);
    if (!response.success) {
      setError(response.message);
      return;
    }
    navigate('/');
  };

  return (
    <div className={styles.shell}>
      <div className={styles.authBox}>

        {/* Header */}
        <div className={styles.authHeader}>
          <p className={styles.authEyebrow}>Digital Queue Management</p>
          <h1 className={styles.authTitle}>Sign in to your workspace</h1>
          <p className={styles.authSub}>Select your role to continue</p>
        </div>

        {/* Role selector */}
        <div className={styles.roleGrid}>
          {roles.map(({ key, label, description, icon: Icon, accent }) => ( // eslint-disable-line no-unused-vars
            <button
              key={key}
              type="button"
              className={`${styles.roleCard} ${selectedRole === key ? styles.roleCardActive : ''}`}
              style={selectedRole === key ? { '--role-accent': accent } : {}}
              onClick={() => handleRoleSelect(key)}
            >
              <span className={styles.roleIcon} style={{ color: accent }}>
                <Icon size={22} />
              </span>
              <strong>{label}</strong>
              <p>{description}</p>
            </button>
          ))}
        </div>

        {/* Login form — shown after role selected */}
        {selectedRole && (
          <div className={styles.formWrap}>
            <p className={styles.formLabel}>
              Signing in as <strong>{roles.find((r) => r.key === selectedRole)?.label}</strong>
            </p>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button type="submit" className={styles.submit} disabled={loading}>
                <LockKeyhole size={17} />
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        )}

        <p className={styles.footer}>
          New to the system? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
