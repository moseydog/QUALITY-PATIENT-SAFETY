import React, { useState, useEffect } from 'react';

async function api(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

function scoreColorClass(pct) {
  if (pct === null || pct === undefined) return 'text-text-dim';
  if (pct > 75) return 'text-status-good';
  if (pct >= 50) return 'text-status-warn';
  return 'text-status-bad';
}

export default function UnitsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/visits/stats/by-unit')
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError('Could not load unit-level data.'));
  }, []);

  if (error) return <p className="text-sm text-status-bad">{error}</p>;
  if (!data) return <p className="text-sm text-text-dim">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <span className="bg-ink text-paper text-[10px] font-semibold px-2 py-0.5">QPS</span>
        <span className="bg-surface text-ink text-[10px] font-medium px-2 py-0.5">Units</span>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-ink">Compliance by unit</h2>
        <p className="text-xs text-text-dim">Weighted compliance scores computed the same way as the main tabs, broken out by hospital unit rather than by month — across the full analyzed range ({data.scopeRange}), since per-unit monthly samples run thin.</p>
      </div>
      <div className="bg-surface border border-rule rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-semibold">Unit</th>
              <th className="text-left px-3 py-2 font-semibold">Rooms</th>
              <th className="text-right px-3 py-2 font-semibold">Audits</th>
              <th className="text-right px-3 py-2 font-semibold">Avg Braden</th>
              <th className="text-right px-3 py-2 font-semibold">Falls</th>
              <th className="text-right px-3 py-2 font-semibold">HAPI</th>
              <th className="text-right px-3 py-2 font-semibold">Education</th>
            </tr>
          </thead>
          <tbody>
            {data.units.map((u) => (
              <tr key={u.unit} className="border-t border-rule">
                <td className="px-3 py-2 font-medium text-ink">{u.unit}</td>
                <td className="px-3 py-2 text-text-muted">{u.roomRange}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">{u.totalAudits}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">{u.avgBraden ?? '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${scoreColorClass(u.fall)}`}>{u.fall !== null ? `${u.fall}%` : '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${scoreColorClass(u.hapi)}`}>{u.hapi !== null ? `${u.hapi}%` : '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${scoreColorClass(u.education)}`}>{u.education !== null ? `${u.education}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-dim">Compliance scores colored the same as elsewhere: above 75% green, 50–75% yellow, below 50% red. A blank cell means fewer than {data.minSampleSize} audits answered that question for that unit.</p>
    </div>
  );
}
