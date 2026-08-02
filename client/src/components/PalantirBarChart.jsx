import React from 'react';
import { BarChart, Bar, XAxis, ReferenceLine, Cell, LabelList, ResponsiveContainer } from 'recharts';
import TwoBarComparison from './TwoBarComparison.jsx';

function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function ValueLabel(props) {
  const { x, y, width, value } = props;
  if (value === null || value === undefined) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#f4f4f0" fontSize={10} fontWeight={700}>
      {Math.round(value)}
    </text>
  );
}

export default function PalantirBarChart({ label, series, target, height = 170 }) {
  const data = series.map((d) => ({ ...d, monthLabel: formatMonthShort(d.month) }));
  const withData = data.filter((d) => d.pct !== null);
  const first = withData[0];
  const last = withData[withData.length - 1];
  const n = withData.length;

  return (
    <div className="bg-panel p-4">
      <h3 className="text-[11px] font-semibold text-panel-muted uppercase tracking-wide mb-3">{label}</h3>

      {first && last && first !== last && (
        <div className="mb-3 max-w-[220px]">
          <TwoBarComparison
            startLabel={formatMonthShort(first.month)}
            startValue={first.pct}
            endLabel={formatMonthShort(last.month)}
            endValue={last.pct}
          />
        </div>
      )}

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, left: 4, bottom: 4 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 9, fill: '#8f8f89' }} axisLine={{ stroke: '#333330' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={36} />
            <ReferenceLine y={target} stroke="#55554f" strokeDasharray="3 3" strokeWidth={1} />
            <Bar dataKey="pct" radius={[1, 1, 0, 0]} maxBarSize={22} isAnimationActive={false}>
              <LabelList dataKey="pct" content={ValueLabel} />
              {data.map((d, i) => {
                if (d.pct === null) return <Cell key={i} fill="transparent" />;
                // recency gradient: earliest bars dim, most recent bars bright
                const recency = n > 1 ? (withData.indexOf(d) / (n - 1)) : 1;
                const shade = Math.round(74 + recency * (244 - 74));
                return <Cell key={i} fill={`rgb(${shade},${shade},${Math.round(shade * 0.985)})`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-panel-muted mt-1">Dashed line marks the {target}% target. Bars brighten toward the most recent month.</p>
    </div>
  );
}
