import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Activity, Clock3, MonitorCog, Plus, Star, Users } from 'lucide-react';
import '../lib/chartSetup';
import { AuthContext } from '../context/authContextObject';
import SocketContext from '../context/socketContextObject';
import GlassPanel from '../components/GlassPanel';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { formatHour } from '../utils/formatters';
import styles from './AdminDashboard.module.css';

const C = 'rgba(228,235,250,0.7)';
const G = 'rgba(255,255,255,0.08)';

const barOpts = (title) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: C } }, title: title ? { display: false } : undefined },
  scales: {
    x: { ticks: { color: C }, grid: { color: G } },
    y: { ticks: { color: C }, grid: { color: G }, beginAtZero: true },
  },
});

const doughnutOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { color: C, padding: 14 } } },
};

const empty = {
  analytics: {},
  charts: {
    hourlyTraffic: [], priorityBreakdown: [], agentRatings: [],
    counterServed: [], counterAvgDuration: [], counterStatus: [],
  },
  counters: [], agents: [],
  waitingTokens: [], assignedTokens: [], activeTokens: [],
  feedbackInsights: { recentFeedback: [], averageRating: 0, totalFeedbackCount: 0 },
};

export default function AdminDashboard() {
  const { authHeaders } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [dashboard, setDashboard] = useState(empty);
  const [counterName, setCounterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/dashboard', { headers: authHeaders });
      setDashboard(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (!socket) return undefined;
    const events = [
      'queue_updated', 'token_generated', 'priority_token_generated',
      'token_assigned', 'token_accepted', 'service_started',
      'service_completed', 'analytics_updated', 'feedback_submitted',
    ];
    events.forEach((e) => socket.on(e, fetchDashboard));
    return () => events.forEach((e) => socket.off(e, fetchDashboard));
  }, [fetchDashboard, socket]);

  const handleCreateCounter = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/admin/counters', { counterName }, { headers: authHeaders });
      setCounterName('');
      fetchDashboard();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to create counter.');
    } finally { setSaving(false); }
  };

  const handleAssignAgent = async (counterId, agentId) => {
    try {
      await axios.put(`/api/admin/counters/${counterId}/assign`, { agentId: agentId || null }, { headers: authHeaders });
      fetchDashboard();
    } catch (e) { setError(e.response?.data?.message || 'Unable to assign agent.'); }
  };

  const handleToggleCounter = async (counterId) => {
    try {
      await axios.put(`/api/admin/counters/${counterId}/toggle`, {}, { headers: authHeaders });
      fetchDashboard();
    } catch (e) { setError(e.response?.data?.message || 'Unable to toggle counter.'); }
  };

  const handleAssignToken = async (tokenId, counterId, isReassign = false) => {
    if (!counterId) return;
    setAssigning(tokenId);
    try {
      const url = isReassign
        ? `/api/admin/tokens/${tokenId}/reassign`
        : `/api/admin/tokens/${tokenId}/assign`;
      await axios.put(url, { counterId }, { headers: authHeaders });
      fetchDashboard();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to assign token.');
    } finally { setAssigning(null); }
  };

  // ── Chart data ──────────────────────────────────────────────────────────────
  const busyHoursData = useMemo(() => ({
    labels: dashboard.charts.hourlyTraffic.map((e) => e.label || formatHour(e.hour)),
    datasets: [{ label: 'Customers served', data: dashboard.charts.hourlyTraffic.map((e) => e.value), backgroundColor: 'rgba(119,230,255,0.5)', borderColor: '#79e5ff', borderRadius: 7 }],
  }), [dashboard.charts.hourlyTraffic]);

  const priorityData = useMemo(() => ({
    labels: (dashboard.charts.serviceBreakdown || dashboard.charts.priorityBreakdown || []).map((e) => e.label),
    datasets: [{ data: (dashboard.charts.serviceBreakdown || dashboard.charts.priorityBreakdown || []).map((e) => e.value), backgroundColor: ['#77e6ff','#a18eff','#ffb188','#77e6a0','#ffd080'], borderWidth: 0 }],
  }), [dashboard.charts]);

  const ratingData = useMemo(() => ({
    labels: dashboard.charts.agentRatings.map((e) => e.label),
    datasets: [{ label: 'Avg rating', data: dashboard.charts.agentRatings.map((e) => e.value), backgroundColor: 'rgba(255,190,110,0.7)', borderRadius: 10 }],
  }), [dashboard.charts.agentRatings]);

  // Feature 1 — counter performance charts
  const counterServedData = useMemo(() => ({
    labels: dashboard.charts.counterServed.map((e) => e.label),
    datasets: [{ label: 'Customers served', data: dashboard.charts.counterServed.map((e) => e.value), backgroundColor: 'rgba(161,142,255,0.65)', borderRadius: 8 }],
  }), [dashboard.charts.counterServed]);

  const counterDurationData = useMemo(() => ({
    labels: dashboard.charts.counterAvgDuration.map((e) => e.label),
    datasets: [{ label: 'Avg service (min)', data: dashboard.charts.counterAvgDuration.map((e) => e.value), backgroundColor: 'rgba(255,143,116,0.65)', borderRadius: 8 }],
  }), [dashboard.charts.counterAvgDuration]);

  const counterStatusData = useMemo(() => ({
    labels: dashboard.charts.counterStatus.map((e) => e.label),
    datasets: [{ data: dashboard.charts.counterStatus.map((e) => e.value), backgroundColor: ['#77e6a0', '#ff8f74'], borderWidth: 0 }],
  }), [dashboard.charts.counterStatus]);

  if (loading) return <div className="app-loader"><div className="app-loader__orb" /><p>Loading...</p></div>;

  const { analytics, counters, agents, waitingTokens, assignedTokens, activeTokens, feedbackInsights } = dashboard;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.eyebrow}>Admin Dashboard</p>
        <h1 className={styles.pageTitle}>Queue Overview</h1>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── KPI metrics ── */}
      <section className={styles.metricGrid}>
        <MetricCard icon={Users} label="Served today" value={analytics.totalServedToday || 0} accent="warm" helper="Completed tokens" />
        <MetricCard icon={Clock3} label="Waiting" value={analytics.waitingCount || 0} accent="cool" helper="In queue" />
        <MetricCard icon={MonitorCog} label="Best counter" value={analytics.bestCounter?.name || '—'} accent="violet" helper={analytics.bestCounter ? `${analytics.bestCounter.total} served` : 'No data yet'} />
        <MetricCard icon={Star} label="Avg rating" value={analytics.averageRating ? `${analytics.averageRating}/5` : '—'} accent="green" helper="Customer feedback" />
      </section>

      {/* ── Token routing ── */}
      <section className={styles.routingGrid}>
        <GlassPanel title="Waiting Tokens" eyebrow={`${waitingTokens.length} in queue`}>
          <div className={styles.tokenList}>
            {waitingTokens.length ? waitingTokens.map((t) => (
              <div key={t._id} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <strong>{t.tokenNumber}</strong>
                  <span>{t.customerName}</span>
                  <StatusBadge value={t.priorityType} />
                </div>
                <div className={styles.assignControl}>
                  <select defaultValue="" onChange={(e) => e.target.value && handleAssignToken(t._id, e.target.value)} disabled={assigning === t._id}>
                    <option value="" disabled>Assign to counter</option>
                    {counters.filter((c) => c.status === 'active').map((c) => (
                      <option key={c._id} value={c._id}>{c.counterName}</option>
                    ))}
                  </select>
                </div>
              </div>
            )) : <p className={styles.empty}>No waiting tokens.</p>}
          </div>
        </GlassPanel>

        <GlassPanel title="Assigned Tokens" eyebrow={`${assignedTokens.length} routed`}>
          <div className={styles.tokenList}>
            {assignedTokens.length ? assignedTokens.map((t) => (
              <div key={t._id} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <strong>{t.tokenNumber}</strong>
                  <span>{t.customerName}</span>
                  <div className={styles.badgeRow}>
                    <StatusBadge value={t.priorityType} />
                    <span className={styles.counterTag}>{t.counterName}</span>
                  </div>
                </div>
                <div className={styles.assignControl}>
                  <select defaultValue="" onChange={(e) => e.target.value && handleAssignToken(t._id, e.target.value, true)} disabled={assigning === t._id}>
                    <option value="" disabled>Reassign</option>
                    {counters.filter((c) => c.status === 'active').map((c) => (
                      <option key={c._id} value={c._id}>{c.counterName}</option>
                    ))}
                  </select>
                </div>
              </div>
            )) : <p className={styles.empty}>No assigned tokens.</p>}
          </div>
        </GlassPanel>

        <GlassPanel title="Active Tokens" eyebrow={`${activeTokens.length} being served`}>
          <div className={styles.tokenList}>
            {activeTokens.length ? activeTokens.map((t) => (
              <div key={t._id} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <strong>{t.tokenNumber}</strong>
                  <span>{t.customerName}</span>
                  <div className={styles.badgeRow}>
                    <StatusBadge value="active" />
                    <span className={styles.counterTag}>{t.counterName}</span>
                  </div>
                </div>
                {t.serviceDurationMinutes && (
                  <span className={styles.duration}>{t.serviceDurationMinutes} min</span>
                )}
              </div>
            )) : <p className={styles.empty}>No active tokens.</p>}
          </div>
        </GlassPanel>
      </section>

      {/* ── Counter management ── */}
      <section className={styles.managementGrid}>
        <GlassPanel title="Add Counter" eyebrow="Counter management">
          <form onSubmit={handleCreateCounter} className={styles.form}>
            <label htmlFor="cname">Counter name</label>
            <input id="cname" value={counterName} onChange={(e) => setCounterName(e.target.value)} placeholder="e.g. Counter Delta" required />
            <button type="submit" disabled={saving}><Plus size={16} />{saving ? 'Creating...' : 'Add counter'}</button>
          </form>
        </GlassPanel>

        <GlassPanel title="Counters & Staff" eyebrow="Operations">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Counter</th><th>Status</th><th>Assigned staff</th><th>Action</th></tr>
              </thead>
              <tbody>
                {counters.map((c) => (
                  <tr key={c._id}>
                    <td>{c.counterName}</td>
                    <td><StatusBadge value={c.status} /></td>
                    <td>
                      <select value={c.assignedAgent?._id || ''} onChange={(e) => handleAssignAgent(c._id, e.target.value)}>
                        <option value="">Unassigned</option>
                        {agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <button type="button" className={styles.toggleBtn} onClick={() => handleToggleCounter(c._id)}>
                        {c.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </section>

      {/* ── Feature 1: Counter Performance Analytics ── */}
      <div className={styles.sectionLabel}>
        <Activity size={15} />
        Counter Performance Analytics
      </div>
      <section className={styles.counterPerfGrid}>
        <GlassPanel title="Customers Served per Counter" eyebrow="Today">
          <div className={styles.chartFrame}>
            {dashboard.charts.counterServed.length
              ? <Bar data={counterServedData} options={barOpts()} />
              : <p className={styles.empty}>No completed services yet today.</p>}
          </div>
        </GlassPanel>

        <GlassPanel title="Avg Service Duration per Counter" eyebrow="Minutes">
          <div className={styles.chartFrame}>
            {dashboard.charts.counterAvgDuration.length
              ? <Bar data={counterDurationData} options={barOpts()} />
              : <p className={styles.empty}>No service duration data yet.</p>}
          </div>
        </GlassPanel>

        <GlassPanel title="Active vs Inactive Counters" eyebrow="Counter status">
          <div className={styles.chartFrameSm}>
            <Doughnut data={counterStatusData} options={doughnutOpts} />
          </div>
        </GlassPanel>
      </section>

      {/* ── Feature 4: Peak Service Hours ── */}
      <section className={styles.analyticsGrid}>
        <GlassPanel title="Busy Service Hours" eyebrow="Customers completed per hour">
          <div className={styles.chartFrame}>
            {dashboard.charts.hourlyTraffic.length
              ? <Bar data={busyHoursData} options={barOpts()} />
              : <p className={styles.empty}>No hourly data yet today.</p>}
          </div>
        </GlassPanel>

        <GlassPanel title="Service Type Mix" eyebrow="Tokens by service today">
          <div className={styles.chartFrameSm}>
            <Doughnut data={priorityData} options={doughnutOpts} />
          </div>
        </GlassPanel>

        <GlassPanel title="Agent Ratings" eyebrow="Feedback summary" className={styles.fullSpan}>
          <div className={styles.chartFrame}>
            {dashboard.charts.agentRatings.length
              ? <Bar data={ratingData} options={barOpts()} />
              : <p className={styles.empty}>No agent ratings yet.</p>}
          </div>
        </GlassPanel>
      </section>

      {/* ── Feedback ── */}
      <GlassPanel title="Feedback Summary" eyebrow={`${feedbackInsights.totalFeedbackCount} reviews`}>
        <div className={styles.feedbackHeader}>
          <div><span>Avg rating</span><strong>{feedbackInsights.averageRating || 0} / 5</strong></div>
          <div><span>Total reviews</span><strong>{feedbackInsights.totalFeedbackCount || 0}</strong></div>
        </div>
        <div className={styles.feedbackStream}>
          {feedbackInsights.recentFeedback.map((f) => (
            <article key={f.id} className={styles.feedbackCard}>
              <div className={styles.feedbackTop}>
                <div><strong>{f.customerName}</strong><span>{f.counterName}</span></div>
                <StatusBadge value={`${f.rating} stars`} />
              </div>
              <p>{f.comment || 'No written feedback.'}</p>
              <small>{f.agentName}</small>
            </article>
          ))}
          {!feedbackInsights.recentFeedback.length && <p className={styles.empty}>No feedback yet.</p>}
        </div>
      </GlassPanel>
    </div>
  );
}
