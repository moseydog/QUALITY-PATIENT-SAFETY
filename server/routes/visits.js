const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');
const { METRICS } = require('../metrics');

const router = express.Router();
router.use(requireAuth);

function metricOrThrow(key) {
  const m = METRICS.find((x) => x.key === key);
  if (!m) throw new Error('Unknown metric');
  return m;
}

// One metric's month-by-month {compliant, total} rows, respecting its exclude list.
function monthlyRows(metric) {
  const notInSql = metric.exclude.length ? `AND ${metric.key} NOT IN (${metric.exclude.map(() => '?').join(',')})` : '';
  const sql = `
    SELECT substr(audit_date,1,7) as month,
      SUM(CASE WHEN ${metric.key} = 'yes' THEN 1 ELSE 0 END) as compliant,
      COUNT(*) as total
    FROM audit_visits
    WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL ${notInSql}
    GROUP BY month ORDER BY month
  `;
  return db.prepare(sql).all(...metric.exclude);
}

router.get('/stats/summary', (req, res) => {
  const targets = {};
  db.prepare('SELECT * FROM targets').all().forEach((r) => { targets[r.metric_key] = r.target_value; });

  const out = METRICS.map((m) => {
    const rows = monthlyRows(m);
    const latest = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const latestPct = latest && latest.total > 0 ? Math.round((latest.compliant / latest.total) * 1000) / 10 : null;
    const prevPct = prev && prev.total > 0 ? Math.round((prev.compliant / prev.total) * 1000) / 10 : null;
    return {
      key: m.key,
      label: m.label,
      category: m.category,
      target: targets[m.key] ?? m.target,
      latestPct,
      prevPct,
      latestMonth: latest ? latest.month : null,
      n: latest ? latest.total : 0,
    };
  });
  res.json(out);
});

router.get('/stats/trend/:key', (req, res) => {
  let metric;
  try { metric = metricOrThrow(req.params.key); } catch (e) { return res.status(404).json({ error: 'Unknown metric' }); }

  const overallRows = monthlyRows(metric);
  const overall = overallRows.map((r) => ({
    month: r.month,
    pct: r.total > 0 ? Math.round((r.compliant / r.total) * 1000) / 10 : null,
  }));

  const notInSql = metric.exclude.length ? `AND ${metric.key} NOT IN (${metric.exclude.map(() => '?').join(',')})` : '';
  const byLocSql = `
    SELECT substr(audit_date,1,7) as month, location,
      SUM(CASE WHEN ${metric.key} = 'yes' THEN 1 ELSE 0 END) as compliant,
      COUNT(*) as total
    FROM audit_visits
    WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL AND location IS NOT NULL ${notInSql}
    GROUP BY month, location ORDER BY month
  `;
  const byLocRows = db.prepare(byLocSql).all(...metric.exclude);
  const byLocation = byLocRows.map((r) => ({
    month: r.month,
    location: r.location,
    pct: r.total > 0 ? Math.round((r.compliant / r.total) * 1000) / 10 : null,
  }));

  res.json({ key: metric.key, label: metric.label, target: metric.target, overall, byLocation });
});

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const rows = db.prepare('SELECT * FROM audit_visits ORDER BY audit_date DESC, id DESC LIMIT ?').all(limit);
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const cols = [
    'audit_date', 'location', 'room_number', 'hand_hygiene_in', 'hand_hygiene_out',
    'is_fall_risk', 'morse_score', 'tips_board_correct', 'bed_alarm_on', 'bed_alarm_cord_plugged',
    'call_light_reach', 'fall_wristband', 'non_slip_socks', 'gait_belt_present', 'walker_present',
    'posey_alarm_present', 'posey_alarm_charged', 'shower_chair_present', 'bedside_commode_present',
    'is_hapi_risk', 'braden_score', 'purple_wedges', 'specialty_bed_yn', 'specialty_bed_type',
    'turned_with_wedges', 'turned_in_chair', 'heels_offloaded', 'primo_boots', 'turned_recently',
    'needs_hapi_education', 'knows_what_pi_is', 'knows_pi_risk_factors', 'knows_pi_locations',
    'knows_pi_prevention', 'already_educated_today', 'patient_refused_education',
  ];
  if (!b.audit_date) return res.status(400).json({ error: 'Audit date is required' });

  const values = cols.map((c) => (b[c] === undefined || b[c] === '' ? null : b[c]));
  const placeholders = cols.map(() => '?').join(',');
  const info = db.prepare(
    `INSERT INTO audit_visits (${cols.join(',')}, submitted_at, submitted_by_email, created_by)
     VALUES (${placeholders}, datetime('now'), ?, ?)`
  ).run(...values, req.user.username, req.user.id);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/all', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM audit_visits').run();
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM audit_visits WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
