import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, UserRoundPlus } from 'lucide-react';
import { AuthContext } from '../context/authContextObject';
import styles from './AuthPage.module.css';

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [adminExists, setAdminExists] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer',
  });

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data } = await axios.get('/api/auth/check-admin');
        setAdminExists(data.exists);
      } catch (requestError) {
        console.error(requestError);
      }
    };

    checkAdmin();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const response = await register(form);
    if (!response.success) {
      setError(response.message);
      return;
    }

    navigate('/');
  };

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <aside className={styles.brandPanel}>
          <div className={styles.eyebrow}>
            <ShieldCheck size={14} />
            Modular service suite
          </div>
          <h1>Onboard each role with one clean queue identity.</h1>
          <p>
            Customer accounts can self-serve token tracking, agents can operate their
            counters, and admins can unlock the analytics floor.
          </p>
          <div className={styles.signals}>
            <div className={styles.signalCard}>
              <strong>Priority aware</strong>
              <span>Normal, senior citizen, and emergency tokens follow a live priority queue.</span>
            </div>
            <div className={styles.signalCard}>
              <strong>Feedback ready</strong>
              <span>Customers rate service after completion, feeding agent-level insights.</span>
            </div>
            <div className={styles.signalCard}>
              <strong>Email hooks</strong>
              <span>Your EmailJS IDs are wired in and ready to enable later.</span>
            </div>
            <div className={styles.signalCard}>
              <strong>Responsive UI</strong>
              <span>Each dashboard is optimized for control-room desktops and mobile follow-up.</span>
            </div>
          </div>
        </aside>

        <section className={styles.formPanel}>
          <h2>Create account</h2>
          <p className={styles.subtext}>Choose the role you need and enter the live queue workspace.</p>
          {error ? <div className={styles.error}>{error}</div> : null}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>

            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="role">Role</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                <option value="customer">Customer</option>
                <option value="agent">Agent</option>
                {!adminExists ? <option value="admin">Admin</option> : null}
              </select>
            </div>

            <button type="submit" className={styles.submit}>
              <UserRoundPlus size={18} />
              Launch account
            </button>
          </form>

          <p className={styles.footer}>
            Already registered? <Link to="/login">Sign in here</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
