import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { BellRing, CheckCircle2, Clock3, HandshakeIcon, Timer, Users } from 'lucide-react';
import { AuthContext } from '../context/authContextObject';
import SocketContext from '../context/socketContextObject';
import GlassPanel from '../components/GlassPanel';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { formatMinutes } from '../utils/formatters';
import styles from './AgentDashboard.module.css';

export default function AgentDashboard() {
  const { user, authHeaders } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [overview, setOverview] = useState({ myCounter: null, activeToken: null, assignedTokens: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  const [durationSaving, setDurationSaving] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/staff/overview', { headers: authHeaders });
      setOverview(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load counter workspace.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  useEffect(() => {
    if (!socket) return undefined;
    const events = ['queue_updated', 'token_generated', 'priority_token_generated',
      'token_assigned', 'token_accepted',
      'service_time_updated', 'service_completed'];
    events.forEach((e) => socket.on(e, fetchOverview));
    return () => events.forEach((e) => socket.off(e, fetchOverview));
  }, [fetchOverview, socket]);

  const acceptToken = async (tokenId) => {
    setBusy(true);
    try {
      await axios.put(`/api/staff/tokens/${tokenId}/accept`, {}, { headers: authHeaders });
      fetchOverview();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to accept token.');
    } finally {
      setBusy(false);
    }
  };

  const saveServiceDuration = async (tokenId) => {
    const mins = Number(durationInput);
    if (!mins || mins < 1) { setError('Enter a valid duration in minutes.'); return; }
    setDurationSaving(true);
    try {
      await axios.put(`/api/staff/tokens/${tokenId}/duration`, { durationMinutes: mins }, { headers: authHeaders });
      setDurationInput('');
      fetchOverview();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to set duration.');
    } finally {
      setDurationSaving(false);
    }
  };

  const completeToken = async (tokenId) => {
    setBusy(true);
    try {
      await axios.put(`/api/staff/tokens/${tokenId}/complete`, {}, { headers: authHeaders });
      fetchOverview();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to complete token.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="app-loader"><div className="app-loader__orb" /><p>Loading...</p></div>;

  const { myCounter, activeToken, assignedTokens } = overview;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.eyebrow}>Counter Staff Dashboard</p>
        <h1 className={styles.pageTitle}>{user?.name || 'Staff'}</h1>
        {myCounter && (
          <p className={styles.counterLabel}>
            Counter: <strong>{myCounter.counterName}</strong>
            <StatusBadge value={myCounter.status} />
          </p>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!myCounter && (
        <div className={styles.noCounter}>
          No counter assigned. Ask the admin to assign you to a counter.
        </div>
      )}

      <section className={styles.metricRow}>
        <MetricCard icon={Users} label="Assigned to me" value={assignedTokens.length} accent="warm" helper="Waiting for acceptance" />
        <MetricCard icon={BellRing} label="Active now" value={activeToken ? 1 : 0} accent="cool" helper="Currently serving" />
        <MetricCard icon={Clock3} label="Service duration" value={activeToken?.serviceDurationMinutes ? `${activeToken.serviceDurationMinutes} min` : '—'} accent="violet" helper="Set for active token" />
      </section>

      <section className={styles.twoCol}>
        {/* Active token panel */}
        <GlassPanel title="Active Service" eyebrow="Currently serving">
          {activeToken ? (
            <div className={styles.activeBlock}>
              <div className={styles.tokenHero}>
                <span>Now serving</span>
                <strong>{activeToken.tokenNumber}</strong>
                <p>{activeToken.customerName}</p>
                {activeToken.serviceLabel && (
                  <p className={styles.serviceTag}>{activeToken.serviceLabel}</p>
                )}
                <StatusBadge value={activeToken.priorityType} />
              </div>

              <div className={styles.durationBlock}>
                <label htmlFor="dur">Set service duration (minutes)</label>
                <div className={styles.durationRow}>
                  {[3, 5, 7, 10].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.durationChip} ${durationInput === String(m) ? styles.chipActive : ''}`}
                      onClick={() => setDurationInput(String(m))}
                    >
                      {m} min
                    </button>
                  ))}
                  <input
                    id="dur"
                    type="number"
                    min="1"
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    placeholder="Custom"
                    className={styles.durationInput}
                  />
                </div>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => saveServiceDuration(activeToken._id)}
                  disabled={durationSaving || !durationInput}
                >
                  <Timer size={15} />
                  {durationSaving ? 'Saving...' : 'Set Duration'}
                </button>
                {activeToken.serviceDurationMinutes && (
                  <p className={styles.durationSet}>
                    Duration set: <strong>{activeToken.serviceDurationMinutes} min</strong>
                  </p>
                )}
              </div>

              <button
                type="button"
                className={styles.completeBtn}
                onClick={() => completeToken(activeToken._id)}
                disabled={busy}
              >
                <CheckCircle2 size={17} />
                Complete Service
              </button>
            </div>
          ) : (
            <p className={styles.empty}>No active token. Accept one from the list.</p>
          )}
        </GlassPanel>

        {/* Assigned tokens list */}
        <GlassPanel title="Assigned Tokens" eyebrow="Accept to serve">
          <div className={styles.tokenList}>
            {assignedTokens.length ? assignedTokens.map((t) => (
              <div key={t._id} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <strong>{t.tokenNumber}</strong>
                  <p>{t.customerName}</p>
                  {t.serviceLabel && <p className={styles.serviceTag}>{t.serviceLabel}</p>}
                  <div className={styles.badgeRow}>
                    <StatusBadge value={t.priorityType} />
                    {t.estimatedWaitMinutes > 0 && (
                      <span className={styles.waitTag}>{formatMinutes(t.estimatedWaitMinutes)} wait</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.acceptBtn}
                  onClick={() => acceptToken(t._id)}
                  disabled={busy || !!activeToken}
                  title={activeToken ? 'Complete current token first' : 'Accept this token'}
                >
                  <HandshakeIcon size={15} />
                  Accept Token
                </button>
              </div>
            )) : (
              <p className={styles.empty}>No tokens assigned to your counter yet.</p>
            )}
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
