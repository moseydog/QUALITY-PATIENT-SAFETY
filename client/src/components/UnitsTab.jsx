import React, { useState, useEffect } from 'react';
import SemesterMonthChart from './SemesterMonthChart.jsx';

const FALL_MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12'];
const SPRING_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

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

function UnitDetail({ unitName }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDetail(null);
    api(`/api/visits/stats/by-unit/${encodeURIComponent(unitName)}/monthly`)
      .then((d) => { setDetail(d); setError(null); })
      .catch(() => setError('Could not load this unit\'s detail.'));
  }, [unitName]);

  if (error) return <p className="text-sm text-status-bad px-1">{error}</p>;
  if (!detail) return <p className="text-sm text-text-dim px-1">Loading…</p>;

  return (
    <div className="space-y-4 px-1">
      <p className="text-xs text-text-dim">Fall and Spring shown as separate panels, not one continuous line — the volunteer program goes idle over winter break, and each semester stands on its own.</p>
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Fall 2025 — month over month</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <SemesterMonthChart label="Falls compliance rate" months={FALL_MONTHS} series={detail.categories.fall} target={detail.targets.fall} />
          <SemesterMonthChart label="HAPI compliance rate" months={FALL_MONTHS} series={detail.categories.hapi} target={detail.targets.hapi} />
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Spring 2026 — month over month</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <SemesterMonthChart label="Falls compliance rate" months={SPRING_MONTHS} series={detail.categories.fall} target={detail.targets.fall} />
          <SemesterMonthChart label="HAPI compliance rate" months={SPRING_MONTHS} series={detail.categories.hapi} target={detail.targets.hapi} />
        </div>
      </div>
    </div>
  );
}

export default function UnitsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedUnit, setExpandedUnit] = useState(null);

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
        <p className="text-xs text-text-dim">
          Falls and HAPI columns are weighted compliance rates — the % of audits in that unit meeting the standard for each category, computed the same way as the main tabs, across the full analyzed range ({data.scopeRange}). Click a unit for its month-over-month detail.
        </p>
      </div>
      <div className="bg-surface border border-rule rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-semibold">Unit</th>
              <th className="text-left px-3 py-2 font-semibold">Rooms</th>
              <th className="text-right px-3 py-2 font-semibold">Audits</th>
              <th className="text-right px-3 py-2 font-semibold">Avg Morse</th>
              <th className="text-right px-3 py-2 font-semibold">Falls compliance</th>
              <th className="text-right px-3 py-2 font-semibold">Avg Braden</th>
              <th className="text-right px-3 py-2 font-semibold">HAPI compliance</th>
            </tr>
          </thead>
          <tbody>
            {data.units.map((u) => (
              <React.Fragment key={u.unit}>
                <tr
                  onClick={() => setExpandedUnit(expandedUnit === u.unit ? null : u.unit)}
                  className={`border-t border-rule cursor-pointer hover:bg-surface-2 ${expandedUnit === u.unit ? 'bg-surface-2' : ''}`}
                >
                  <td className="px-3 py-2 font-medium text-ink">{u.unit}</td>
                  <td className="px-3 py-2 text-text-muted">{u.roomRange}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-muted">{u.totalAudits}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-muted">{u.avgMorse ?? '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${scoreColorClass(u.fall)}`}>{u.fall !== null ? `${u.fall}%` : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-muted">{u.avgBraden ?? '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${scoreColorClass(u.hapi)}`}>{u.hapi !== null ? `${u.hapi}%` : '—'}</td>
                </tr>
                {expandedUnit === u.unit && (
                  <tr>
                    <td colSpan={7} className="bg-paper border-t border-rule py-4">
                      <UnitDetail unitName={u.unit} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-dim">Compliance rates colored the same as elsewhere: above 75% green, 50–75% yellow, below 50% red. A blank cell means fewer than {data.minSampleSize} audits answered that question for that unit.</p>
    </div>
  );
}
