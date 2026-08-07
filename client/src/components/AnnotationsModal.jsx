import React, { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';

const SCOPES = [
  ['all', 'All categories'],
  ['fall', 'Falls Prevention'],
  ['hapi', 'HAPI Prevention'],
  ['education', 'Patient Education'],
];
const KINDS = [
  ['staffing', 'Staffing change'],
  ['intervention', 'Intervention / leadership action'],
  ['process', 'Process change'],
  ['external', 'External factor'],
  ['other', 'Other note'],
];
const MONTHS = [
  '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04',
];

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const EMPTY = { start_month: '2026-01', end_month: '2026-04', scope: 'all', kind: 'staffing', metric_key: '', title: '', detail: '' };

export default function AnnotationsModal({ annotations, metrics = [], onClose, onSave, onDelete, error }) {
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  function startEdit(a) {
    setEditingId(a.id);
    setDraft({
      start_month: a.start_month, end_month: a.end_month,
      scope: a.scope, kind: a.kind, metric_key: a.metric_key || '', title: a.title, detail: a.detail || '',
    });
  }
  function reset() { setEditingId(null); setDraft(EMPTY); }

  async function handleSave() {
    const ok = await onSave(draft, editingId);
    if (ok) reset();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-rule">
          <div>
            <h3 className="text-lg font-semibold text-ink">Explaining the data</h3>
            <p className="text-xs text-text-muted mt-0.5 max-w-lg">
              Add the real events behind a rise or dip — staffing changes, leadership interventions, process changes. These appear as shaded bands with footnotes on the trend charts, so a reader can tell a care problem from a staffing gap.
            </p>
          </div>
          <button onClick={onClose} className="text-text-dim p-1"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div className="space-y-2">
            {annotations.length === 0 && <p className="text-sm text-text-dim">No events recorded yet.</p>}
            {annotations.map((a) => (
              <div key={a.id} className="border border-rule rounded px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{a.title}</div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {monthLabel(a.start_month)}{a.start_month !== a.end_month ? ` – ${monthLabel(a.end_month)}` : ''}
                      {' · '}{a.metric_key
                        ? ((metrics.find((m) => m.key === a.metric_key) || {}).label || a.metric_key)
                        : (SCOPES.find((s) => s[0] === a.scope) || [])[1]}
                      {' · '}{(KINDS.find((k) => k[0] === a.kind) || [])[1]}
                    </div>
                    {a.detail && <p className="text-xs text-text-muted mt-1">{a.detail}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(a)} className="text-xs text-ink underline underline-offset-2">Edit</button>
                    <button onClick={() => onDelete(a.id)} className="text-text-dim hover:text-status-bad"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-rule pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-ink">{editingId ? 'Edit event' : 'Add an event'}</h4>
            <div>
              <label className="text-xs text-text-muted">What happened</label>
              <input value={draft.title} onChange={(e) => set('title')(e.target.value)}
                placeholder="e.g. Volunteer director departed"
                className="w-full border border-rule rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Why it affected the numbers (optional)</label>
              <textarea value={draft.detail} onChange={(e) => set('detail')(e.target.value)} rows={3}
                placeholder="e.g. Roster fell from ~52 to ~20 volunteers, so daily education was delivered inconsistently."
                className="w-full border border-rule rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted">From</label>
                <select value={draft.start_month} onChange={(e) => set('start_month')(e.target.value)}
                  className="w-full border border-rule rounded px-3 py-2 text-sm mt-1">
                  {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted">Through</label>
                <select value={draft.end_month} onChange={(e) => set('end_month')(e.target.value)}
                  className="w-full border border-rule rounded px-3 py-2 text-sm mt-1">
                  {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted">Applies to</label>
                <select value={draft.scope} onChange={(e) => { setDraft((d) => ({ ...d, scope: e.target.value, metric_key: '' })); }}
                  className="w-full border border-rule rounded px-3 py-2 text-sm mt-1">
                  {SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-muted">Specific metric (optional)</label>
                <select value={draft.metric_key} onChange={(e) => set('metric_key')(e.target.value)}
                  className="w-full border border-rule rounded px-3 py-2 text-sm mt-1">
                  <option value="">All metrics in the category above</option>
                  {metrics
                    .filter((m) => draft.scope === 'all' || m.category === draft.scope)
                    .map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <p className="text-[11px] text-text-dim mt-1">Pick a metric to attach this note only to that one chart — useful when leadership addressed a specific measure.</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">Type</label>
                <select value={draft.kind} onChange={(e) => set('kind')(e.target.value)}
                  className="w-full border border-rule rounded px-3 py-2 text-sm mt-1">
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-status-bad">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-ink text-paper rounded py-2 text-sm font-medium flex items-center justify-center gap-1.5">
                {editingId ? 'Save changes' : <><Plus size={14} /> Add event</>}
              </button>
              {editingId && (
                <button onClick={reset} className="px-4 border border-rule rounded py-2 text-sm text-text-muted">Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
