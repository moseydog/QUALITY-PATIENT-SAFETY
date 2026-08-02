import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, LabelList, ResponsiveContainer } from 'recharts';
import { niceTicks } from '../lib/chartMath';

async function api(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

function ValueLabel(props) {
  const { x, y, width, value } = props;
  if (value === null || value === undefined) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#12283b" fontSize={13} fontWeight={700}>
      {Math.round(value)}%
    </text>
  );
}

function SemesterFigure({ metric }) {
  const [fall, spring] = metric.semesters;
  const data = metric.semesters.map((s) => ({ name: s.label.split(' ')[0], pct: s.pct }));
  const values = metric.semesters.map((s) => s.pct).filter((v) => v !== null);
  const { ticks, domain } = values.length ? niceTicks(Math.min(...values, metric.target), Math.max(...values, metric.target)) : { ticks: [0, 50, 100], domain: [0, 100] };

  return (
    <div className="bg-surface border border-rule rounded p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink">{metric.label}</h4>
        {metric.delta !== null && (
          <span className={`text-xs font-semibold ${metric.delta >= 0 ? 'text-status-good' : 'text-status-bad'}`}>
            {metric.delta >= 0 ? '+' : ''}{metric.delta} pts, Fall → Spring
          </span>
        )}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 16, left: 4, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#52626e' }} axisLine={{ stroke: '#d7dce1' }} tickLine={false} />
            <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: '#52626e' }} width={34} axisLine={false} tickLine={false} />
            <ReferenceLine y={metric.target} stroke="#52626e" strokeDasharray="4 3" strokeWidth={1.25} />
            <Bar dataKey="pct" radius={[2, 2, 0, 0]} maxBarSize={60} isAnimationActive={false}>
              <LabelList dataKey="pct" content={ValueLabel} />
              <Cell fill="#8996a1" />
              <Cell fill="#12283b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-text-dim mt-1">
        Fall: n={fall.total}{fall.pct === null ? ' (not enough audits)' : ''} · Spring: n={spring.total}{spring.pct === null ? ' (not enough audits)' : ''} · Goal {metric.target}%
      </p>
    </div>
  );
}

export default function SemesterComparison({ category }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/api/visits/stats/semester/${category}`)
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError('Could not load the semester comparison.'));
  }, [category]);

  if (error) return <p className="text-sm text-status-bad">{error}</p>;
  if (!data) return <p className="text-sm text-text-dim">Loading…</p>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">Fall semester vs. Spring semester</h3>
        <p className="text-xs text-text-dim">Fall 2025 (Sep–Dec) compared against Spring 2026 (Jan–Apr) — the volunteer roster turns over on the academic calendar, so this splits the data the way the team's staffing actually changes, rather than by arbitrary month.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {data.metrics.map((m) => <SemesterFigure key={m.key} metric={m} />)}
      </div>
    </div>
  );
}
