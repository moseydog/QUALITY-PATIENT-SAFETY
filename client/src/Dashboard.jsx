import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import {
  Plus, X, Trash2, Users, KeyRound, Settings, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck,
} from 'lucide-react';
import AddVisitModal from './components/AddVisitModal.jsx';
import SemesterMonthChart from './components/SemesterMonthChart.jsx';
import UnitsTab from './components/UnitsTab.jsx';
import StratifiedFindings from './components/StratifiedFindings.jsx';

const CATEGORY_META = {
  fall: { label: 'Falls Prevention', active: 'bg-falls-accent text-white', text: 'text-falls-accent', light: 'bg-falls-light' },
  hapi: { label: 'HAPI Prevention', active: 'bg-hapi-accent text-white', text: 'text-hapi-accent', light: 'bg-hapi-light' },
  education: { label: 'Patient Education', active: 'bg-edu-accent text-white', text: 'text-edu-accent', light: 'bg-edu-light' },
};

const statusBar = { green: 'bg-status-good', warn: 'bg-status-warn', red: 'bg-status-bad', gray: 'bg-rule' };
const LOCATION_COLORS = { 'Hospital #1': '#f2f2f0', 'Hospital #2': '#8a8a86' };
const FALL_MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12'];
const SPRING_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

function getStatus(pct, target) {
  if (pct === null || pct === undefined) return 'gray';
  if (pct >= target) return 'green';
  if (pct >= target - 10) return 'warn';
  return 'red';
}

// Absolute compliance-score coloring (not relative to each metric's own
// target): >75% green, 50-75% yellow, <50% red.
function scoreColorClass(pct) {
  if (pct === null || pct === undefined) return 'text-ink';
  if (pct > 75) return 'text-status-good';
  if (pct >= 50) return 'text-status-warn';
  return 'text-status-bad';
}

function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

async function api(path, options) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function MetricCard({ metric, selected, onClick }) {
  const { label, latestPct, prevPct, target, status } = metric;
  const delta = latestPct !== null && prevPct !== null ? latestPct - prevPct : null;
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 bg-surface border rounded transition ${selected ? 'border-ink ring-1 ring-ink' : 'border-rule hover:border-text-dim'}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-0.5">Compliance score</div>
      <div className="text-xs font-medium text-text-muted mb-1 leading-snug flex items-center gap-1.5">
        {label}
        {metric.reference && <span className="text-[9px] font-semibold uppercase tracking-wide bg-surface-2 text-text-dim px-1.5 py-0.5 rounded-full flex-shrink-0">Reference</span>}
      </div>
      <div className="flex items-end justify-between">
        <span className={`font-serif text-3xl font-semibold ${scoreColorClass(latestPct)}`}>{latestPct !== null ? `${Math.round(latestPct)}%` : '—'}</span>
        {delta !== null && Math.abs(delta) >= 0.5 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-status-good' : 'text-status-bad'}`}>
            {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(Math.round(delta * 10) / 10)}
          </span>
        )}
      </div>
      <div className="relative h-1 bg-surface-2 mt-2 overflow-hidden">
        <div className={`h-full ${statusBar[status]}`} style={{ width: `${latestPct !== null ? Math.min(100, latestPct) : 0}%` }} />
        <div className="absolute top-0 bottom-0 w-px bg-text-dim" style={{ left: `${Math.min(100, target)}%` }} />
      </div>
      <div className="text-xs text-text-dim mt-1 flex items-center justify-between">
        <span>Target {target}% · n={metric.n}</span>
        {!metric.reference && metric.weight !== 1 && <span className="font-medium text-text-muted">{metric.weight}× weight</span>}
      </div>
    </button>
  );
}

function BelowTargetList({ list }) {
  if (list.length === 0) return <p className="text-sm text-text-dim">Everything here is meeting target for the latest month.</p>;
  return (
    <div className="bg-surface border border-rule divide-y divide-rule">
      {list.map((m) => (
        <div key={m.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-ink">{m.label}</span>
          <span className="font-medium text-status-bad">{Math.round(m.latestPct)}% <span className="text-text-dim font-normal">/ target {m.target}%</span></span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const isAdmin = user.role === 'admin';
  const [summary, setSummary] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const [showAddVisit, setShowAddVisit] = useState(false);
  const [addVisitError, setAddVisitError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [qualityIssues, setQualityIssues] = useState(null);
  const [qualityCounts, setQualityCounts] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);

  const [userError, setUserError] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'volunteer', display_name: '' });
  const [resetPasswordFor, setResetPasswordFor] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState(null);
  const [resetPasswordDone, setResetPasswordDone] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);

  async function refetchSummary() { setSummary(await api('/api/visits/stats/summary')); }
  async function refetchUsers() { if (isAdmin) setUsers(await api('/api/users')); }
  async function refetchVisits(month) {
    const q = month ? `?limit=100&month=${encodeURIComponent(month)}` : '?limit=100';
    setRecentVisits(await api(`/api/visits${q}`));
  }
  async function refetchMonthly() { setMonthlyData(await api('/api/visits/stats/monthly-table')); }
  async function runQualityCheck() {
    if (!isAdmin) return;
    const data = await api('/api/visits/quality-check');
    setQualityIssues(data.issues);
    setQualityCounts(data.counts);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refetchSummary(), refetchUsers(), refetchVisits(), refetchMonthly()]);
      } catch (e) { /* handled by empty states */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) refetchVisits(monthFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter]);

  useEffect(() => {
    if (!selectedMetric) { setTrend(null); return; }
    setTrendLoading(true);
    api(`/api/visits/stats/trend/${selectedMetric}`)
      .then(setTrend)
      .catch(() => setTrend(null))
      .finally(() => setTrendLoading(false));
  }, [selectedMetric]);

  async function handleSaveVisit(form) {
    setAddVisitError(null);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
      await api('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await Promise.all([refetchSummary(), refetchVisits(monthFilter), refetchMonthly()]);
      setShowAddVisit(false);
    } catch (e) {
      setAddVisitError(e.message);
    }
  }

  async function handleDeleteVisit(id) {
    try { await api(`/api/visits/${id}`, { method: 'DELETE' }); await Promise.all([refetchSummary(), refetchVisits(monthFilter), refetchMonthly()]); } catch (e) { /* ignore */ }
  }

  async function handleDeleteFlagged(id) {
    try { await api(`/api/visits/${id}`, { method: 'DELETE' }); await Promise.all([refetchSummary(), refetchVisits(monthFilter), refetchMonthly(), runQualityCheck()]); } catch (e) { /* ignore */ }
  }

  async function handleClearAll() {
    try { await api('/api/visits/all', { method: 'DELETE' }); await Promise.all([refetchSummary(), refetchVisits(monthFilter), refetchMonthly()]); } catch (e) { /* ignore */ }
    setShowClearConfirm(false);
  }

  async function handleAddUser() {
    setUserError(null);
    if (!newUser.username.trim() || newUser.password.length < 8) {
      setUserError('Username required, password needs 8+ characters.');
      return;
    }
    try {
      await api('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
      await refetchUsers();
      setNewUser({ username: '', password: '', role: 'volunteer', display_name: '' });
    } catch (e) { setUserError(e.message); }
  }

  async function handleDeleteUser(id) {
    try { await api(`/api/users/${id}`, { method: 'DELETE' }); await refetchUsers(); } catch (e) { /* ignore */ }
  }

  async function handleResetPassword(id) {
    setResetPasswordError(null);
    if (resetPasswordValue.length < 8) {
      setResetPasswordError('New password needs 8+ characters.');
      return;
    }
    try {
      await api(`/api/users/${id}/reset-password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });
      setResetPasswordDone(id);
      setResetPasswordValue('');
      setTimeout(() => { setResetPasswordFor(null); setResetPasswordDone(null); }, 3000);
    } catch (e) { setResetPasswordError(e.message); }
  }

  async function handleChangePassword() {
    setPasswordError(null); setPasswordMessage(null);
    if (!passwordForm.currentPassword || passwordForm.newPassword.length < 8) {
      setPasswordError('Enter your current password and a new one with 8+ characters.');
      return;
    }
    try {
      await api('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(passwordForm) });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Password updated.');
    } catch (e) { setPasswordError(e.message); }
  }

  async function handleTargetChange(key, value) {
    setSummary((s) => s.map((m) => (m.key === key ? { ...m, target: value } : m)));
    try {
      await api(`/api/targets/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
    } catch (e) { /* ignore transient failure */ }
  }

  const withStatus = useMemo(() => summary.map((m) => ({ ...m, status: getStatus(m.latestPct, m.target) })), [summary]);
  const byCategory = useMemo(() => {
    const g = { fall: [], hapi: [], education: [] };
    withStatus.forEach((m) => { if (g[m.category]) g[m.category].push(m); });
    return g;
  }, [withStatus]);

  function belowTarget(list) {
    return list
      .filter((c) => !c.reference && c.category !== 'education' && c.latestPct !== null && c.latestPct < c.target)
      .sort((a, b) => (b.target - b.latestPct) - (a.target - a.latestPct));
  }

  function categoryAvg(list) {
    const withPct = list.filter((m) => !m.reference && m.latestPct !== null);
    if (withPct.length === 0) return null;
    const totalWeight = withPct.reduce((s, m) => s + m.weight, 0);
    const weightedSum = withPct.reduce((s, m) => s + m.latestPct * m.weight, 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  function metricMonthlySeries(metricKey) {
    if (!monthlyData) return [];
    const full = monthlyData.metrics.find((m) => m.key === metricKey);
    if (!full) return [];
    return monthlyData.months.map((month) => {
      const cell = full.byMonth[month];
      return cell ? { month, pct: cell.pct, compliant: cell.compliant, total: cell.total } : { month, pct: null, compliant: 0, total: 0 };
    });
  }

  function categoryMonthlySeries(cat) {
    if (!monthlyData) return [];
    const catMetrics = withStatus.filter((m) => m.category === cat && !m.reference);
    return monthlyData.months.map((month) => {
      let totalWeight = 0;
      let weightedSum = 0;
      let sampleTotal = 0;
      let sampleCompliant = 0;
      catMetrics.forEach((m) => {
        const full = monthlyData.metrics.find((x) => x.key === m.key);
        const cell = full ? full.byMonth[month] : undefined;
        if (cell) {
          totalWeight += m.weight;
          weightedSum += cell.pct * m.weight;
          sampleTotal += cell.total;
          sampleCompliant += cell.compliant;
        }
      });
      return {
        month,
        pct: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null,
        total: sampleTotal,
        compliant: sampleCompliant,
      };
    });
  }

  function categoryWeightedTarget(cat) {
    const catMetrics = withStatus.filter((m) => m.category === cat && !m.reference);
    const totalWeight = catMetrics.reduce((s, m) => s + m.weight, 0);
    if (totalWeight === 0) return 85;
    return Math.round(catMetrics.reduce((s, m) => s + m.target * m.weight, 0) / totalWeight);
  }

  const trendChartData = useMemo(() => {
    if (!trend) return [];
    const months = Array.from(new Set([
      ...trend.overall.map((r) => r.month),
      ...trend.byLocation.map((r) => r.month),
    ])).sort();
    return months.map((month) => {
      const row = { month };
      const overallRow = trend.overall.find((r) => r.month === month);
      if (overallRow) row.Overall = overallRow.pct;
      trend.byLocation.filter((r) => r.month === month).forEach((r) => { row[r.location] = r.pct; });
      return row;
    });
  }, [trend]);

  const locationsInTrend = useMemo(() => {
    if (!trend) return [];
    return Array.from(new Set(trend.byLocation.map((r) => r.location)));
  }, [trend]);

  const allMonths = monthlyData ? monthlyData.months : [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-2 text-text-dim text-sm">Loading dashboard…</div>;
  }

  const detailMetric = selectedMetric ? withStatus.find((m) => m.key === selectedMetric) : null;
  const catMetrics = activeTab === 'overview' ? null : byCategory[activeTab];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-panel text-panel-text flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-panel-rule">
          <span className="bg-panel-text text-panel text-xs font-bold px-2 py-1 rounded">QPS</span>
          <h1 className="text-sm font-semibold mt-2.5 leading-snug">Quality and Patient Safety Volunteer Program</h1>
          <p className="text-[11px] text-panel-muted mt-1">Hospital #1</p>
        </div>
        <nav className="flex-1 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-panel-muted px-2 mb-1.5">Navigation</p>
          {['overview', 'fall', 'hapi', 'education', 'units', 'audits'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedMetric(null); }}
              className={`w-full text-left px-2.5 py-2 rounded text-sm font-medium transition mb-0.5 ${
                activeTab === tab ? 'bg-panel-2 text-panel-text' : 'text-panel-muted hover:bg-panel-2 hover:text-panel-text'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'audits' ? 'Audits' : tab === 'units' ? 'Units' : CATEGORY_META[tab].label}
            </button>
          ))}
          <button onClick={() => setShowAddVisit(true)} className="w-full mt-4 px-2.5 py-2 rounded text-sm font-semibold bg-panel-text text-panel flex items-center gap-1.5 justify-center">
            <Plus size={14} /> Add visit
          </button>
          {isAdmin && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-panel-muted px-2 mb-1.5 mt-5">Admin tools</p>
              <button onClick={() => { setShowQuality(true); runQualityCheck(); }} className="w-full text-left px-2.5 py-2 rounded text-sm text-panel-muted hover:bg-panel-2 hover:text-panel-text flex items-center gap-2">
                <ShieldCheck size={14} /> Data quality
              </button>
              <button onClick={() => setShowUsers(true)} className="w-full text-left px-2.5 py-2 rounded text-sm text-panel-muted hover:bg-panel-2 hover:text-panel-text flex items-center gap-2">
                <Users size={14} /> Manage users
              </button>
              <button onClick={() => setShowSettings(true)} className="w-full text-left px-2.5 py-2 rounded text-sm text-panel-muted hover:bg-panel-2 hover:text-panel-text flex items-center gap-2">
                <Settings size={14} /> Targets
              </button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-panel-rule text-xs">
          <div className="font-medium text-panel-text">{user.display_name || user.username}</div>
          <div className="text-panel-muted capitalize mb-2">{user.role}</div>
          <div className="flex gap-3">
            <button onClick={() => setShowPassword(true)} className="text-panel-muted hover:text-panel-text underline underline-offset-2">Password</button>
            <button onClick={onLogout} className="text-panel-muted hover:text-panel-text underline underline-offset-2">Log out</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-paper">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-3">
              {['fall', 'hapi', 'education'].map((cat) => {
                const list = byCategory[cat];
                const countable = list.filter((m) => !m.reference);
                const avg = categoryAvg(list);
                return (
                  <button key={cat} onClick={() => setActiveTab(cat)}
                    className="text-left p-5 bg-surface border border-rule hover:border-text-dim transition">
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${CATEGORY_META[cat].text}`}>{CATEGORY_META[cat].label}</div>
                    {cat === 'education' ? (
                      <>
                        <div className="text-sm text-text-muted">See month-over-month understanding trends</div>
                        <div className="text-xs text-text-dim mt-1">{countable.length} knowledge questions tracked, by semester</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Compliance score</div>
                        <div className={`text-4xl font-bold ${scoreColorClass(avg)}`}>{avg !== null ? `${avg}%` : '—'}</div>
                        <div className="text-xs text-text-dim mt-1">weighted average, {countable.length} metrics, latest month</div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <div className="flex items-center mb-2">
                <span className="bg-ink text-paper text-[10px] font-semibold px-2 py-0.5">QPS</span>
                <span className="bg-surface text-ink text-[10px] font-medium px-2 py-0.5">Since Program Start</span>
              </div>
              <p className="text-xs text-text-dim">Each semester's month-over-month change stands on its own — Fall and Spring aren't compared against each other, since the volunteer cohort, patient population, and program maturity all differ between them.</p>
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">Fall 2025 semester — month over month (Sep, Oct, Nov, Dec)</h2>
                <div className="grid md:grid-cols-3 gap-3">
                  {['fall', 'hapi', 'education'].map((cat) => (
                    <SemesterMonthChart key={cat} label={CATEGORY_META[cat].label} months={FALL_MONTHS} series={categoryMonthlySeries(cat)} target={categoryWeightedTarget(cat)} showGoal={cat !== 'education'} big />
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">Spring 2026 semester — month over month (Jan, Feb, Mar, Apr)</h2>
                <div className="grid md:grid-cols-3 gap-3">
                  {['fall', 'hapi', 'education'].map((cat) => (
                    <SemesterMonthChart key={cat} label={CATEGORY_META[cat].label} months={SPRING_MONTHS} series={categoryMonthlySeries(cat)} target={categoryWeightedTarget(cat)} showGoal={cat !== 'education'} big />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">Needs attention</h2>
              <BelowTargetList list={belowTarget(withStatus).slice(0, 6)} />
            </div>
          </div>
        )}

        {catMetrics && (
          <div className="space-y-6">
            <div className="flex items-center">
              <span className="bg-ink text-paper text-[10px] font-semibold px-2 py-0.5">QPS</span>
              <span className="bg-surface text-ink text-[10px] font-medium px-2 py-0.5">{CATEGORY_META[activeTab].label}</span>
            </div>

            {activeTab === 'education' && (
              <p className="text-sm text-text-muted">
                This shows what patients themselves understand about pressure injuries — what they are, what causes them, and how to prevent them — based on talking with a volunteer directly, not on whether a nurse already explained it. There's no fixed target here, since a knowledge check like this is harder to measure against a set bar than simply checking if equipment is in the room.
              </p>
            )}

            {activeTab !== 'education' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {catMetrics.filter((m) => !m.reference).map((m) => (
                  <MetricCard key={m.key} metric={m} selected={selectedMetric === m.key} onClick={() => setSelectedMetric(m.key)} />
                ))}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-text-dim">Each metric's month-over-month change stands on its own per semester — not compared against the other semester, since the volunteer cohort and program maturity differ between them.</p>
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">Fall 2025 — month over month by metric</h2>
                {catMetrics.filter((m) => !m.reference).every((m) => metricMonthlySeries(m.key).every((s) => s.pct === null)) ? (
                  <p className="text-sm text-text-dim border border-dashed border-rule rounded p-4">Not tracked yet this semester.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catMetrics.filter((m) => !m.reference).map((m) => (
                      <SemesterMonthChart key={m.key} label={m.label} months={FALL_MONTHS} series={metricMonthlySeries(m.key)} target={m.target} showGoal={activeTab !== 'education'} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">Spring 2026 — month over month by metric</h2>
                {catMetrics.filter((m) => !m.reference).every((m) => metricMonthlySeries(m.key).every((s) => s.pct === null)) ? (
                  <p className="text-sm text-text-dim border border-dashed border-rule rounded p-4">Not tracked yet this semester.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catMetrics.filter((m) => !m.reference).map((m) => (
                      <SemesterMonthChart key={m.key} label={m.label} months={SPRING_MONTHS} series={metricMonthlySeries(m.key)} target={m.target} showGoal={activeTab !== 'education'} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {detailMetric && detailMetric.category === activeTab && (
              <div className="bg-surface border border-rule rounded p-4 md:p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-medium text-ink">{detailMetric.label} — full history by unit</h3>
                  <span className="text-xs text-text-muted">goal {detailMetric.target}%</span>
                </div>
                {trendLoading ? (
                  <div className="h-64 flex items-center justify-center text-sm text-text-dim">Loading…</div>
                ) : trendChartData.length === 0 ? (
                  <p className="text-sm text-text-dim">No dated audits for this metric yet.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 5, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke="#d7dce1" strokeDasharray="0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#52626e' }} width={36} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
                        <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #d7dce1', borderRadius: 2, background: '#ffffff', color: '#12283b' }} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#52626e' }} iconType="plainline" />
                        <ReferenceLine y={detailMetric.target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1.25} />
                        <Line type="linear" dataKey="Overall" stroke="#12283b" strokeWidth={2.25} dot={{ r: 3, fill: '#12283b', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                        {locationsInTrend.map((loc) => (
                          <Line key={loc} type="linear" dataKey={loc} stroke={LOCATION_COLORS[loc] || '#8996a1'} strokeWidth={1.25} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {locationsInTrend.length === 0 && (
                  <p className="text-xs text-text-dim mt-2">Location wasn't recorded for most audits of this metric, so only the overall trend is shown.</p>
                )}
              </div>
            )}

            {activeTab !== 'education' && (
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">Needs attention</h2>
                <BelowTargetList list={belowTarget(catMetrics)} />
              </div>
            )}

            {(activeTab === 'fall' || activeTab === 'hapi') && (
              <StratifiedFindings category={activeTab} riskLabel={activeTab === 'hapi' ? 'Braden score' : 'Morse score'} />
            )}
          </div>
        )}

        {activeTab === 'units' && <UnitsTab />}

        {activeTab === 'audits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Individual audit visits</h2>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="text-xs border border-rule rounded px-2 py-1 text-text-muted"
              >
                <option value="">Most recent 100</option>
                {allMonths.slice().reverse().map((mo) => <option key={mo} value={mo}>{formatMonth(mo)}</option>)}
              </select>
            </div>
            <div className="bg-surface border-t-2 border-b border-ink overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-text-muted text-xs uppercase tracking-wide">
                  <tr className="border-b border-ink">
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Location</th>
                    <th className="text-left px-3 py-2 font-medium">Room</th>
                    <th className="text-left px-3 py-2 font-medium">Fall risk</th>
                    <th className="text-left px-3 py-2 font-medium">HAPI risk</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="border-t border-rule">
                      <td className="px-3 py-2 text-text-muted whitespace-nowrap">{v.audit_date || '—'}</td>
                      <td className="px-3 py-2 text-text-muted whitespace-nowrap">{v.location || '—'}</td>
                      <td className="px-3 py-2 text-text-muted">{v.room_number || '—'}</td>
                      <td className="px-3 py-2 text-text-muted capitalize">{v.is_fall_risk || '—'}</td>
                      <td className="px-3 py-2 text-text-muted capitalize">{v.is_hapi_risk || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {isAdmin && (
                          <button onClick={() => handleDeleteVisit(v.id)} className="text-text-dim hover:text-status-bad">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </main>

      {showAddVisit && (
        <AddVisitModal onClose={() => setShowAddVisit(false)} onSave={handleSaveVisit} error={addVisitError} />
      )}

      {showQuality && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><ShieldCheck size={16} /> Data quality check</h3>
              <button onClick={() => setShowQuality(false)}><X size={18} className="text-text-dim" /></button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Rule-based checks against the current data: implausible scores, likely swapped room-number/score fields, answers that contradict a stated risk level, and possible duplicate entries. This flags rows worth a human look — it can't independently confirm what actually happened in a room, only that something about the entry looks inconsistent.
            </p>
            {qualityCounts && (
              <div className="bg-surface-2 border border-rule rounded px-3 py-2 mb-3 text-xs text-text-muted flex flex-wrap gap-x-4 gap-y-1">
                <span><strong className="text-ink">{qualityCounts.totalInDatabase}</strong> total audits in the database</span>
                <span><strong className="text-ink">{qualityCounts.inScope}</strong> in the analyzed range ({qualityCounts.scopeRange})</span>
                <span><strong className="text-ink">{qualityCounts.outOfScope}</strong> excluded as out of range</span>
                <span>months need <strong className="text-ink">{qualityCounts.minSampleSize}+</strong> audits to be shown</span>
              </div>
            )}
            <div className="overflow-y-auto flex-1 space-y-2">
              {qualityIssues === null ? (
                <p className="text-sm text-text-dim">Checking…</p>
              ) : qualityIssues.length === 0 ? (
                <p className="text-sm text-text-dim">No issues found by these checks.</p>
              ) : (
                qualityIssues.map((issue, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink">
                    <div>
                      <div className="font-medium text-ink">{issue.type}</div>
                      <div className="text-xs text-text-dim">
                        {issue.date || 'no date'} · room {issue.room || '—'}{issue.detail ? ` · value: ${issue.detail}` : ''}
                      </div>
                    </div>
                    {issue.id && (
                      <button onClick={() => handleDeleteFlagged(issue.id)} className="text-text-dim hover:text-status-bad flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded p-6 w-full max-w-md space-y-3 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-ink">Target thresholds</h3>
              <button onClick={() => setShowSettings(false)}><X size={18} className="text-text-dim" /></button>
            </div>
            {withStatus.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-muted flex-1">{m.label}</span>
                <input
                  type="number" min="0" max="100" value={m.target}
                  onChange={(e) => handleTargetChange(m.key, Number(e.target.value))}
                  className="w-16 border border-rule rounded-lg px-2 py-1 text-sm text-right"
                />
                <span className="text-xs text-text-dim">%</span>
              </div>
            ))}
            <div className="pt-3 border-t border-rule">
              <button onClick={() => setShowClearConfirm(true)} className="w-full text-sm text-status-bad font-medium text-left underline">Clear all visit data</button>
            </div>
          </div>
        </div>
      )}

      {showUsers && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded p-6 w-full max-w-lg space-y-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-ink">Manage users</h3>
              <button onClick={() => setShowUsers(false)}><X size={18} className="text-text-dim" /></button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="border-b border-rule pb-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium text-ink">{u.display_name || u.username}</span>
                      <span className="text-xs text-text-dim ml-2">@{u.username}</span>
                      <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-surface-2 text-text-muted' : 'bg-surface-2 text-text-primary'}`}>{u.role}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setResetPasswordFor(resetPasswordFor === u.id ? null : u.id); setResetPasswordValue(''); setResetPasswordError(null); }}
                        className="text-text-dim hover:text-text-muted" title="Reset password"
                      >
                        <KeyRound size={14} />
                      </button>
                      {u.id !== user.id && (
                        <button onClick={() => handleDeleteUser(u.id)} className="text-text-dim hover:text-status-bad" title="Remove user">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {resetPasswordFor === u.id && (
                    <div className="mt-2 flex items-center gap-2">
                      {resetPasswordDone === u.id ? (
                        <p className="text-xs text-status-good">Password reset — let them know their new one.</p>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={resetPasswordValue}
                            onChange={(e) => setResetPasswordValue(e.target.value)}
                            placeholder="New password (8+ characters)"
                            className="flex-1 border border-rule rounded px-2 py-1 text-xs"
                          />
                          <button onClick={() => handleResetPassword(u.id)} className="text-xs bg-ink text-paper px-2 py-1 rounded flex-shrink-0">Set</button>
                        </>
                      )}
                      {resetPasswordError && <p className="text-xs text-status-bad">{resetPasswordError}</p>}
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-text-dim">No other users yet.</p>}
            </div>
            <div className="pt-3 border-t border-rule space-y-2">
              <h4 className="text-sm font-semibold text-ink">Add a user</h4>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink">
                <option value="volunteer">Volunteer</option>
                <option value="admin">Admin</option>
              </select>
              <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="Full name" className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink" />
              <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Username" className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink" />
              <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temporary password (8+ characters)" className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink" />
              {userError && <p className="text-xs text-status-bad">{userError}</p>}
              <button onClick={handleAddUser} className="w-full bg-ink text-paper rounded py-2 text-sm font-medium">Create account</button>
            </div>
          </div>
        </div>
      )}

      {showPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded p-6 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><KeyRound size={16} /> Change password</h3>
              <button onClick={() => { setShowPassword(false); setPasswordError(null); setPasswordMessage(null); }}><X size={18} className="text-text-dim" /></button>
            </div>
            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="Current password" className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink" />
            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="New password (8+ characters)" className="w-full border border-rule rounded px-3 py-2 text-sm bg-surface-2 text-ink" />
            {passwordError && <p className="text-xs text-status-bad">{passwordError}</p>}
            {passwordMessage && <p className="text-xs text-status-good">{passwordMessage}</p>}
            <button onClick={handleChangePassword} className="w-full bg-ink text-paper rounded py-2 text-sm font-medium">Update password</button>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded p-6 w-full max-w-sm space-y-3 text-center">
            <AlertTriangle className="mx-auto text-status-warn" size={28} />
            <h3 className="font-serif text-lg font-semibold text-ink">Clear all visit data?</h3>
            <p className="text-sm text-text-muted">This removes every audit visit — including the historical import — for everyone. It can't be undone.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 border border-rule rounded-lg py-2 text-sm font-medium text-text-muted">Cancel</button>
              <button onClick={handleClearAll} className="flex-1 bg-status-bad text-white rounded-lg py-2 text-sm font-medium">Yes, clear it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
