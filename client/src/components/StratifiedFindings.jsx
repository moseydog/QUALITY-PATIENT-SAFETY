import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

const COLORS = { yes: '#3d6690', no: '#a33a2e' };

function MiniPie({ compliant, total, tierLabel }) {
  if (total === 0) {
    return <div className="flex items-center justify-center h-full text-xs text-text-dim">No data this month</div>;
  }
  const data = [
    { name: 'Yes', value: compliant },
    { name: 'No', value: total - compliant },
  ];
  return (
    <div>
      <p className="text-[11px] text-text-muted text-center mb-1">{tierLabel}</p>
      <PieChart width={150} height={130}>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={45} labelLine={false}
          label={({ percent }) => `${Math.round(percent * 100)}%`}
          isAnimationActive={false}
        >
          <Cell fill={COLORS.yes} />
          <Cell fill={COLORS.no} />
        </Pie>
        <Tooltip formatter={(v, n) => [`${v} of ${total}`, n]} />
      </PieChart>
    </div>
  );
}

function MetricFindingRow({ metric }) {
  const [a, b] = metric.tiers;
  const headline = b.pct !== null
    ? `${b.pct}% of patients meeting ${b.label} had this compliant (${b.delta !== null ? `${b.delta > 0 ? '+' : ''}${b.delta} pts vs prior month` : 'no prior month to compare'}).`
    : 'Not enough data this month for the higher-risk tier.';
  return (
    <div className="bg-surface border border-rule rounded p-4">
      <h4 className="text-sm font-semibold text-ink mb-1">{metric.label}</h4>
      <p className="text-xs text-text-muted mb-3">{headline}</p>
      <div className="flex gap-4 justify-center">
        {metric.tiers.map((t) => (
          <MiniPie key={t.label} compliant={t.compliant} total={t.total} tierLabel={t.label} />
        ))}
      </div>
    </div>
  );
}

async function api(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

export default function StratifiedFindings({ category, riskLabel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api(`/api/visits/stats/stratified/${category}`)
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError('Could not load stratified findings.'))
      .finally(() => setLoading(false));
  }, [category]);

  if (loading) return <p className="text-sm text-text-dim">Loading findings…</p>;
  if (error) return <p className="text-sm text-status-bad">{error}</p>;
  if (!data || data.metrics.length === 0) return <p className="text-sm text-text-dim">Not enough scored audits yet to stratify by {riskLabel}.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Findings — {data.latestMonth}, stratified by {riskLabel}</h3>
        <p className="text-xs text-text-dim">
          Each pair of pies compares the broader at-risk group against the narrower, higher-risk group for that same month, the same way the monthly summary sheet does it — so a metric that looks fine overall but is failing the highest-risk patients doesn't get lost in an average.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {data.metrics.map((m) => <MetricFindingRow key={m.key} metric={m} />)}
      </div>
    </div>
  );
}
