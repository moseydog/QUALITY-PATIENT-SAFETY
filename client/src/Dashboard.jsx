import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Plus, X, Trash2, Users, KeyRound, Settings, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck,
} from 'lucide-react';
import AddVisitModal from './components/AddVisitModal.jsx';
import MonthlyTable from './components/MonthlyTable.jsx';

const CATEGORY_META = {
  fall: { label: 'Fall Prevention', active: 'bg-amber-600 text-white', text: 'text-amber-700' },
  hapi: { label: 'HAPI Prevention', active: 'bg-teal-600 text-white', text: 'text-teal-700' },
  education: { label: 'Patient Education', active: 'bg-violet-600 text-white', text: 'text-violet-700' },
};

const statusBar = { green: 'bg-emerald-500', warn: 'bg-orange-500', red: 'bg-red-500', gray: 'bg-slate-300' };
const LOCATION_COLORS = { 'Dell Seton Medical Center': '#1e293b', 'Ascension Seton Medical Center': '#d97706' };
const LINE_PALETTE = ['#1e293b', '#d97706', '#0d9488', '#7c3aed', '#be123c', '#0369a1', '#65a30d', '#c026d3', '#0891b2', '#ea580c', '#4d7c0f'];

function getStatus(pct, target) {
  if (pct === null || pct === undefined) return 'gray';
  if (pct >= target) return 'green';
  if (pct >= target - 10) return 'warn';
  return 'red';
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
      className={`text-left p-4 rounded-xl border bg-white hover:shadow-sm transition ${selected ? 'ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200'}`}
    >
      <div className="text-xs font-medium text-slate-500 mb-1 leading-snug">{label}</div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-800">{latestPct !== null ? `${Math.round(latestPct)}%` : '—'}</span>
        {delta !== null && Math.abs(delta) >= 0.5 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(Math.round(delta * 10) / 10)}
          </span>
        )}
      </div>
      <div className="relative h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${statusBar[status]}`} style={{ width: `${latestPct !== null ? Math.min(100, latestPct) : 0}%` }} />
        <div className="absolute top-0 bottom-0 w-px bg-slate-400" style={{ left: `${Math.min(100, target)}%` }} />
      </div>
      <div className="text-xs text-slate-400 mt-1">Target {target}% · n={metric.n}</div>
    </button>
  );
}

function BelowTargetList({ list }) {
  if (list.length === 0) return <p className="text-sm text-slate-400">Everything here is meeting target for the latest month.</p>;
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {list.map((m) => (
        <div key={m.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-slate-700">{m.label}</span>
          <span className="font-medium text-red-600">{Math.round(m.latestPct)}% <span className="text-slate-400 font-normal">/ target {m.target}%</span></span>
        </div>
      ))}
    </div>
  );
}

function CategoryTrendChart({ metrics, monthlyData }) {
  const chartData = useMemo(() => {
    if (!monthlyData) return [];
    const months = monthlyData.months.slice(-6);
    return months.map((mo) => {
      const row = { month: formatMonth(mo) };
      metrics.forEach((m) => {
        const full = monthlyData.metrics.find((x) => x.key === m.key);
        if (full && full.byMonth[mo] !== undefined && full.byMonth[mo] !== null) row[m.label] = full.byMonth[mo];
      });
      return row;
    });
  }, [metrics, monthlyData]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
      <h3 className="font-semibold text-slate-800 mb-3">All metrics — last 6 months</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {metrics.map((m, i) => (
              <Line key={m.key} type="monotone" dataKey={m.label} stroke={LINE_PALETTE[i % LINE_PALETTE.length]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  const [monthlyData, setMonthlyData] = useState(null);

  const [userError, setUserError] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'volunteer', display_name: '' });
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
      .filter((c) => c.latestPct !== null && c.latestPct < c.target)
      .sort((a, b) => (b.target - b.latestPct) - (a.target - a.latestPct));
  }

  function categoryAvg(list) {
    const withPct = list.filter((m) => m.latestPct !== null);
    if (withPct.length === 0) return null;
    return Math.round((withPct.reduce((s, m) => s + m.latestPct, 0) / withPct.length) * 10) / 10;
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">Loading dashboard…</div>;
  }

  const detailMetric = selectedMetric ? withStatus.find((m) => m.key === selectedMetric) : null;
  const catMetrics = activeTab === 'overview' ? null : byCategory[activeTab];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-5 md:p-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Quality and Patient Safety Volunteer Program</h1>
            <p className="text-sm text-slate-500 mt-1">Falls &amp; HAPI prevention compliance dashboard</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-medium text-slate-700">{user.display_name || user.username}</div>
            <div className="text-xs text-slate-400 mb-1 capitalize">{user.role}</div>
            <div className="flex gap-3 justify-end text-xs">
              <button onClick={() => setShowPassword(true)} className="text-slate-500 underline">Change password</button>
              <button onClick={onLogout} className="text-slate-500 underline">Log out</button>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <div className="flex gap-2 flex-wrap">
            {['overview', 'fall', 'hapi', 'education'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedMetric(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === tab
                    ? (tab === 'overview' ? 'bg-slate-800 text-white' : CATEGORY_META[tab].active)
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {tab === 'overview' ? 'Overview' : CATEGORY_META[tab].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setShowAddVisit(true)} className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white flex items-center gap-1.5">
              <Plus size={15} /> Add visit
            </button>
            {isAdmin && (
              <button onClick={() => { setShowQuality(true); runQualityCheck(); }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500" title="Data quality check">
                <ShieldCheck size={16} />
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowUsers(true)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500" title="Manage users">
                <Users size={16} />
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500" title="Target thresholds">
                <Settings size={16} />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-3">
              {['fall', 'hapi', 'education'].map((cat) => {
                const list = byCategory[cat];
                const avg = categoryAvg(list);
                return (
                  <button key={cat} onClick={() => setActiveTab(cat)}
                    className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:shadow-sm transition">
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${CATEGORY_META[cat].text}`}>{CATEGORY_META[cat].label}</div>
                    <div className="text-3xl font-bold text-slate-800">{avg !== null ? `${avg}%` : '—'}</div>
                    <div className="text-xs text-slate-400 mt-1">average across {list.length} metrics, latest month</div>
                  </button>
                );
              })}
            </div>
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs attention</h2>
              <BelowTargetList list={belowTarget(withStatus).slice(0, 6)} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Month-by-month progression (last 6 months, % compliant)</h2>
              <MonthlyTable data={monthlyData} targets={Object.fromEntries(withStatus.map((m) => [m.key, m.target]))} />
            </div>
          </div>
        )}

        {catMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {catMetrics.map((m) => (
                <MetricCard key={m.key} metric={m} selected={selectedMetric === m.key} onClick={() => setSelectedMetric(m.key)} />
              ))}
            </div>

            <CategoryTrendChart metrics={catMetrics} monthlyData={monthlyData} />

            {detailMetric && detailMetric.category === activeTab && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
                <h3 className="font-semibold text-slate-800 mb-3">{detailMetric.label} — monthly trend by unit</h3>
                {trendLoading ? (
                  <div className="h-72 flex items-center justify-center text-sm text-slate-400">Loading trend…</div>
                ) : trendChartData.length === 0 ? (
                  <p className="text-sm text-slate-400">No dated audits for this metric yet.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <ReferenceLine y={detailMetric.target} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Target ${detailMetric.target}%`, fontSize: 11, position: 'right', fill: '#64748b' }} />
                        <Line type="monotone" dataKey="Overall" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                        {locationsInTrend.map((loc) => (
                          <Line key={loc} type="monotone" dataKey={loc} stroke={LOCATION_COLORS[loc] || '#7F77DD'} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {locationsInTrend.length === 0 && (
                  <p className="text-xs text-slate-400 mt-2">Location wasn't recorded for most audits of this metric, so only the overall trend is shown.</p>
                )}
              </div>
            )}

            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs attention</h2>
              <BelowTargetList list={belowTarget(catMetrics)} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visits</h2>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600"
                >
                  <option value="">Most recent 100</option>
                  {allMonths.slice().reverse().map((mo) => <option key={mo} value={mo}>{formatMonth(mo)}</option>)}
                </select>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-400 text-xs uppercase">
                    <tr>
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
                      <tr key={v.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{v.audit_date || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{v.location || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{v.room_number || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 capitalize">{v.is_fall_risk || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 capitalize">{v.is_hapi_risk || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {isAdmin && (
                            <button onClick={() => handleDeleteVisit(v.id)} className="text-slate-300 hover:text-red-500">
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
          </div>
        )}
      </div>

      {showAddVisit && (
        <AddVisitModal onClose={() => setShowAddVisit(false)} onSave={handleSaveVisit} error={addVisitError} />
      )}

      {showQuality && isAdmin && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2"><ShieldCheck size={16} /> Data quality check</h3>
              <button onClick={() => setShowQuality(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Rule-based checks against the current data: implausible scores, answers that contradict a stated risk level, and possible duplicate entries. This flags rows worth a human look — it can't independently confirm what actually happened in a room, only that something about the entry looks inconsistent.
            </p>
            <div className="overflow-y-auto flex-1 space-y-2">
              {qualityIssues === null ? (
                <p className="text-sm text-slate-400">Checking…</p>
              ) : qualityIssues.length === 0 ? (
                <p className="text-sm text-slate-400">No issues found by these checks.</p>
              ) : (
                qualityIssues.map((issue, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-700">{issue.type}</div>
                      <div className="text-xs text-slate-400">
                        {issue.date || 'no date'} · room {issue.room || '—'}{issue.detail ? ` · value: ${issue.detail}` : ''}
                      </div>
                    </div>
                    {issue.id && (
                      <button onClick={() => handleDeleteFlagged(issue.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
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
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Target thresholds</h3>
              <button onClick={() => setShowSettings(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            {withStatus.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 flex-1">{m.label}</span>
                <input
                  type="number" min="0" max="100" value={m.target}
                  onChange={(e) => handleTargetChange(m.key, Number(e.target.value))}
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100">
              <button onClick={() => setShowClearConfirm(true)} className="w-full text-sm text-red-500 font-medium text-left underline">Clear all visit data</button>
            </div>
          </div>
        </div>
      )}

      {showUsers && isAdmin && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Manage users</h3>
              <button onClick={() => setShowUsers(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-medium text-slate-700">{u.display_name || u.username}</span>
                    <span className="text-xs text-slate-400 ml-2">@{u.username}</span>
                    <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-600'}`}>{u.role}</span>
                  </div>
                  {u.id !== user.id && (
                    <button onClick={() => handleDeleteUser(u.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-slate-400">No other users yet.</p>}
            </div>
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Add a user</h4>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="volunteer">Volunteer</option>
                <option value="admin">Admin</option>
              </select>
              <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="Full name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Username" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temporary password (8+ characters)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              {userError && <p className="text-xs text-red-500">{userError}</p>}
              <button onClick={handleAddUser} className="w-full bg-slate-800 text-white rounded-lg py-2 text-sm font-medium">Create account</button>
            </div>
          </div>
        </div>
      )}

      {showPassword && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2"><KeyRound size={16} /> Change password</h3>
              <button onClick={() => { setShowPassword(false); setPasswordError(null); setPasswordMessage(null); }}><X size={18} className="text-slate-400" /></button>
            </div>
            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="Current password" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="New password (8+ characters)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            {passwordMessage && <p className="text-xs text-emerald-600">{passwordMessage}</p>}
            <button onClick={handleChangePassword} className="w-full bg-slate-800 text-white rounded-lg py-2 text-sm font-medium">Update password</button>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3 text-center">
            <AlertTriangle className="mx-auto text-orange-500" size={28} />
            <h3 className="font-semibold text-slate-800">Clear all visit data?</h3>
            <p className="text-sm text-slate-500">This removes every audit visit — including the historical import — for everyone. It can't be undone.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={handleClearAll} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Yes, clear it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
