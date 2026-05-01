import { useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowDownToLine, ArrowUpFromLine, BadgeInfo,
  BellRing, Clock3, CreditCard, FileText, HeartHandshake,
} from 'lucide-react';
import { AuthContext } from '../context/authContextObject';
import SocketContext from '../context/socketContextObject';
import GlassPanel from '../components/GlassPanel';
import MetricCard from '../components/MetricCard';
import StarRatingInput from '../components/StarRatingInput';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatMinutes } from '../utils/formatters';
import { sendNotificationEmail } from '../services/emailService';
import styles from './CustomerDashboard.module.css';

// ─── Bank service definitions ─────────────────────────────────────────────────
const SERVICES = [
  {
    value: 'deposit',
    label: 'Deposit',
    description: 'Cash or cheque deposit into your account.',
    icon: ArrowDownToLine,
    prefix: 'D',
    color: '#77e6ff',
  },
  {
    value: 'withdrawal',
    label: 'Withdrawal',
    description: 'Withdraw cash from your account.',
    icon: ArrowUpFromLine,
    prefix: 'W',
    color: '#a18eff',
  },
  {
    value: 'loan',
    label: 'Loan Services',
    description: 'Apply for or enquire about loan products.',
    icon: FileText,
    prefix: 'L',
    color: '#ffb188',
  },
  {
    value: 'account_opening',
    label: 'Account Opening',
    description: 'Open a new savings or current account.',
    icon: CreditCard,
    prefix: 'A',
    color: '#77e6a0',
  },
  {
    value: 'general_enquiry',
    label: 'General Enquiry',
    description: 'Any other banking queries or assistance.',
    icon: BadgeInfo,
    prefix: 'G',
    color: '#ffd080',
  },
];

const emptyState = { activeToken: null, feedbackPendingToken: null, notificationHistory: [] };

const mergeNotifications = (server = [], realtime = []) => {
  const all = [...realtime, ...server].map((n) => {
    // Stable ID generation: use explicit id if exists, or combine type and a truncated ISO string
    // to avoid slight time mismatches between client/server
    const timeId = n.createdAt ? new Date(n.createdAt).getTime() : Date.now();
    const id = n.id || n._id || `${n.type}-${timeId}`;
    return { ...n, id };
  });
  const map = new Map();
  all.forEach((n) => {
    // If we already have this ID, prefer the one with more data
    if (map.has(n.id)) {
      const existing = map.get(n.id);
      if (Object.keys(n).length > Object.keys(existing).length) {
        map.set(n.id, n);
      }
    } else {
      map.set(n.id, n);
    }
  });
  return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export default function CustomerDashboard() {
  const { user, authHeaders } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [dashboard, setDashboard] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [feedback, setFeedback] = useState({ rating: 5, comment: '' });
  const dashboardRef = useRef(dashboard);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/queue/dashboard', { headers: authHeaders });
      setDashboard(data);
      setNotifications((cur) => mergeNotifications(data.notificationHistory, cur));
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load your queue status.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => fetchDashboard();
    const onNotif = (rawN) => {
      const n = {
        type: rawN.type || 'feedback_requested',
        message: rawN.message,
        createdAt: rawN.createdAt || new Date().toISOString(),
        tokenId: rawN.tokenId,
        tokenNumber: rawN.tokenNumber,
        counterName: rawN.counterName,
        ...rawN
      };
      setNotifications((cur) => mergeNotifications([], [{ ...n, id: `${n.type}-${n.createdAt}` }, ...cur]));
      fetchDashboard();

      // Send email notification with specific messages per requirement
      if (user) {
        const token_number = n.tokenNumber || 'N/A';
        const counter_name = n.counterName || 'N/A';

        let message = n.message;
        switch (n.type) {
          case 'token_generated':
            message = `Your token ${token_number} has been generated successfully`;
            break;
          case 'token_assigned':
            message = `Your token ${token_number} assigned to ${counter_name}`;
            break;
          case 'turn_approaching':
            message = `Your turn is approaching soon. Please be ready.`;
            break;
          case 'token_accepted': // Service started
            message = `Your service has started at ${counter_name}`;
            break;
          case 'service_completed':
            message = 'Your service has been completed successfully';
            break;
          case 'feedback_requested':
            message = 'Please submit feedback for your recent service';
            break;
          default:
            // For any other notifications, use the message from the system
            break;
        }

        console.log(`Triggering email for event: ${n.type} to ${user.email}`);
        sendNotificationEmail({
          user_name: user.name,
          user_email: user.email,
          token_number,
          counter_name,
          message,
        });
      }
    };
    const events = ['queue_updated', 'queue_state', 'token_assigned', 'token_accepted',
      'service_time_updated', 'service_completed', 'feedback_requested',
      'token_generated', 'turn_approaching', 'customer_notification'];
    events.forEach((e) => {
      if (e === 'customer_notification' || e === 'feedback_requested') {
        socket.on(e, onNotif);
      } else {
        socket.on(e, refresh);
      }
    });
    return () => {
      events.forEach((e) => {
        if (e === 'customer_notification' || e === 'feedback_requested') {
          socket.off(e, onNotif);
        } else {
          socket.off(e, refresh);
        }
      });
    };
  }, [fetchDashboard, socket]);

  const generateToken = async () => {
    if (!selectedService) { setError('Please select a service first.'); return; }
    setGenerating(true);
    setError('');
    try {
      const { data } = await axios.post('/api/queue/generate', {
        serviceType: selectedService,
        priorityType: 'normal',
      }, { headers: authHeaders });
      setDashboard(data);
      setNotifications((cur) => mergeNotifications(data.notificationHistory, cur));
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to generate token.');
    } finally {
      setGenerating(false);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (!dashboard.feedbackPendingToken) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/queue/feedback', {
        tokenId: dashboard.feedbackPendingToken._id,
        rating: feedback.rating,
        comment: feedback.comment,
      }, { headers: authHeaders });
      setDashboard(data);
      setNotifications((cur) => mergeNotifications(data.notificationHistory, cur));
      setFeedback({ rating: 5, comment: '' });
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const notificationFeed = useMemo(
    () => mergeNotifications(dashboard.notificationHistory, notifications),
    [dashboard.notificationHistory, notifications],
  );

  const token = dashboard.activeToken;
  const activeServiceDef = token ? SERVICES.find((s) => s.value === token.serviceType) : null;

  if (loading) return <div className="app-loader"><div className="app-loader__orb" /><p>Loading...</p></div>;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <p className={styles.eyebrow}>Bank Queue Management</p>
        <h1 className={styles.pageTitle}>Generate Your Bank Service Token</h1>
        <p className={styles.pageSub}>Track your queue position and proceed to the assigned counter when called.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.metricRow}>
        <MetricCard icon={BellRing} label="Notifications" value={notificationFeed.length} accent="warm" helper="Realtime alerts" />
        <MetricCard icon={Clock3} label="Est. wait" value={token ? formatMinutes(token.estimatedWaitMinutes || 0) : '—'} accent="cool" helper="Based on queue ahead" />
        <MetricCard icon={HeartHandshake} label="Feedback" value={dashboard.feedbackPendingToken ? 'Pending' : 'None'} accent="violet" helper="Post-service" />
      </section>

      {!token ? (
        <>
          {/* ── Service selection ── */}
          <GlassPanel title="Select Banking Service" eyebrow="Step 1 — Choose your service">
            <div className={styles.serviceGrid}>
              {SERVICES.map(({ value, label, description, icon: Icon, color }) => ( // eslint-disable-line no-unused-vars
                <button
                  key={value}
                  type="button"
                  className={`${styles.serviceCard} ${selectedService === value ? styles.serviceCardActive : ''}`}
                  style={selectedService === value ? { '--svc-color': color } : {}}
                  onClick={() => setSelectedService(value)}
                >
                  <span className={styles.serviceIcon} style={{ color }}>
                    <Icon size={22} />
                  </span>
                  <strong>{label}</strong>
                  <p>{description}</p>
                </button>
              ))}
            </div>

            <div className={styles.generateRow}>
              <div className={styles.selectedInfo}>
                {selectedService ? (
                  <span>
                    Selected: <strong>{SERVICES.find((s) => s.value === selectedService)?.label}</strong>
                    {' '}— Token prefix: <strong>{SERVICES.find((s) => s.value === selectedService)?.prefix}-001</strong>
                  </span>
                ) : (
                  <span className={styles.selectHint}>Select a service above to continue</span>
                )}
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={generateToken}
                disabled={generating || !selectedService}
              >
                {generating ? 'Generating...' : 'Generate Token'}
              </button>
            </div>
          </GlassPanel>

          {/* ── Notifications ── */}
          <GlassPanel title="Notification Panel" eyebrow="Realtime alerts">
            <div className={styles.notifList}>
              {notificationFeed.length ? notificationFeed.map((n) => (
                <article key={n.id} className={styles.notifCard}>
                  <div><strong>{n.message}</strong><p>{n.type.replaceAll('_', ' ')}</p></div>
                  <small>{formatDateTime(n.createdAt)}</small>
                </article>
              )) : <p className={styles.empty}>No notifications yet.</p>}
            </div>
          </GlassPanel>
        </>
      ) : (
        <section className={styles.twoCol}>
          {/* ── Active token card ── */}
          <GlassPanel title="Track Your Queue Position" eyebrow="Your token">
            <div
              className={`${styles.tokenCard} ${token.status === 'active' ? styles.tokenActive : ''}`}
              style={{ '--svc-color': activeServiceDef?.color || '#77e6ff' }}
            >
              <div className={styles.serviceBadge} style={{ color: activeServiceDef?.color }}>
                {activeServiceDef && <activeServiceDef.icon size={14} />}
                {token.serviceLabel || token.serviceType}
              </div>

              <span className={styles.tokenLabel}>Token number</span>
              <strong className={styles.tokenNumber}>{token.tokenNumber}</strong>

              <div className={styles.badgeRow}>
                <StatusBadge value={token.status} />
              </div>

              {token.status === 'waiting' && (
                <div className={styles.positionBlock}>
                  <div className={styles.positionItem}>
                    <span>Queue position</span>
                    <strong>#{token.queuePosition || '—'}</strong>
                  </div>
                  <div className={styles.positionItem}>
                    <span>People ahead</span>
                    <strong>{token.peopleAhead ?? 0}</strong>
                  </div>
                  <div className={styles.positionItem}>
                    <span>Est. wait</span>
                    <strong>{formatMinutes(token.estimatedWaitMinutes || 0)}</strong>
                  </div>
                </div>
              )}

              {token.status === 'assigned' && (
                <div className={styles.assignedBlock}>
                  <p>Assigned to <strong>{token.counterName}</strong></p>
                  <p>Est. wait: <strong>{formatMinutes(token.estimatedWaitMinutes || 0)}</strong></p>
                </div>
              )}

              {token.status === 'active' && (
                <div className={styles.proceedAlert}>
                  <strong>Proceed to {token.counterName}</strong>
                  <p>Your service has started. Please go to the counter now.</p>
                </div>
              )}

              {token.qrPayload && (
                <div className={styles.qrBlock}>
                  <p className={styles.qrLabel}>Token QR Code</p>
                  <div className={styles.qrWrap}>
                    <QRCodeSVG value={token.qrPayload} size={130} bgColor="transparent" fgColor="#e4ebfa" level="M" />
                  </div>
                  <p className={styles.qrHint}>Show this at the counter</p>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* ── Notifications ── */}
          <GlassPanel title="Notification Panel" eyebrow="Realtime alerts">
            <div className={styles.notifList}>
              {notificationFeed.length ? notificationFeed.map((n) => (
                <article key={n.id} className={styles.notifCard}>
                  <div><strong>{n.message}</strong><p>{n.type.replaceAll('_', ' ')}</p></div>
                  <small>{formatDateTime(n.createdAt)}</small>
                </article>
              )) : <p className={styles.empty}>No notifications yet.</p>}
            </div>
          </GlassPanel>
        </section>
      )}

      {/* ── Feedback ── */}
      {dashboard.feedbackPendingToken && (
        <GlassPanel title="Rate Your Experience" eyebrow="Service completed">
          <div className={styles.feedbackAlert}>
            <strong>{dashboard.feedbackPendingToken.tokenNumber}</strong> — {dashboard.feedbackPendingToken.serviceLabel || 'Service'} completed.
            Please rate your experience.
          </div>
          <form className={styles.feedbackForm} onSubmit={submitFeedback}>
            <StarRatingInput value={feedback.rating} onChange={(r) => setFeedback((f) => ({ ...f, rating: r }))} />
            <label htmlFor="comment">Comments (optional)</label>
            <textarea
              id="comment"
              rows="3"
              value={feedback.comment}
              onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))}
              placeholder="How was your banking experience?"
            />
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </GlassPanel>
      )}
    </div>
  );
}
