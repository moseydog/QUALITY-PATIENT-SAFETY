import React from 'react';

function cellColor(pct, target) {
  if (pct === null || pct === undefined) return 'text-slate-300';
  if (pct >= target) return 'bg-emerald-50 text-emerald-700';
  if (pct >= target - 10) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function MonthlyTable({ data, targets, monthsToShow = 6 }) {
  if (!data || !data.months || data.months.length === 0) {
    return <p className="text-sm text-slate-400">No dated audits yet.</p>;
  }
  const months = data.months.slice(-monthsToShow);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2 font-medium sticky left-0 bg-slate-50">Metric</th>
            {months.map((mo) => <th key={mo} className="text-center px-2 py-2 font-medium whitespace-nowrap">{formatMonth(mo)}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((m) => (
            <tr key={m.key} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap sticky left-0 bg-white">{m.label}</td>
              {months.map((mo) => {
                const pct = m.byMonth[mo];
                const target = targets[m.key];
                return (
                  <td key={mo} className={`text-center px-2 py-2 font-medium ${cellColor(pct, target)}`}>
                    {pct !== null && pct !== undefined ? `${Math.round(pct)}` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
