const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');
const { METRICS } = require('../metrics');

const router = express.Router();
router.use(requireAuth);

// The program's audit tracking is only considered reliable/relevant within
// this window; earlier pilot data and later stray entries are excluded from
// every stats view and the visit list, though the underlying rows are left
// in the database rather than deleted.
const SCOPE_START = '2025-09';
const SCOPE_END = '2026-04';
const SCOPE_SQL = `substr(audit_date,1,7) BETWEEN '${SCOPE_START}' AND '${SCOPE_END}'`;

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
    WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL AND ${SCOPE_SQL} ${notInSql}
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
      reference: !!m.reference,
      weight: m.weight || 1,
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
    WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL AND location IS NOT NULL AND ${SCOPE_SQL} ${notInSql}
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

router.get('/stats/monthly-table', (req, res) => {
  const out = METRICS.map((m) => {
    const rows = monthlyRows(m);
    const byMonth = {};
    rows.forEach((r) => {
      byMonth[r.month] = r.total > 0 ? Math.round((r.compliant / r.total) * 1000) / 10 : null;
    });
    return { key: m.key, label: m.label, category: m.category, byMonth };
  });
  const months = Array.from(new Set(out.flatMap((m) => Object.keys(m.byMonth)))).sort();
  res.json({ months, metrics: out });
});

// Rule-based data-quality checks - flags rows worth a human's review rather
// than claiming to independently verify what happened in a patient's room.
router.get('/quality-check', requireRole('admin'), (req, res) => {
  const issues = [];

  const badBraden = db.prepare(
    `SELECT id, audit_date, room_number, braden_score FROM audit_visits WHERE braden_score IS NOT NULL AND (braden_score < 6 OR braden_score > 23) AND ${SCOPE_SQL}`
  ).all();
  badBraden.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Braden score out of range (valid: 6-23)', detail: String(r.braden_score) }));

  const badMorse = db.prepare(
    `SELECT id, audit_date, room_number, morse_score FROM audit_visits WHERE morse_score IS NOT NULL AND (morse_score < 0 OR morse_score > 125) AND ${SCOPE_SQL}`
  ).all();
  badMorse.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Morse score out of range (valid: 0-125)', detail: String(r.morse_score) }));

  const fallInconsistent = db.prepare(
    `SELECT id, audit_date, room_number FROM audit_visits
     WHERE is_fall_risk = 'no' AND (morse_score IS NOT NULL OR fall_wristband IS NOT NULL OR bed_alarm_on IS NOT NULL) AND ${SCOPE_SQL}`
  ).all();
  fallInconsistent.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Marked not a fall risk, but fall equipment fields were filled in', detail: '' }));

  const hapiInconsistent = db.prepare(
    `SELECT id, audit_date, room_number FROM audit_visits
     WHERE is_hapi_risk = 'no' AND (braden_score IS NOT NULL OR heels_offloaded IS NOT NULL OR primo_boots IS NOT NULL) AND ${SCOPE_SQL}`
  ).all();
  hapiInconsistent.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Marked not a HAPI risk, but HAPI fields were filled in', detail: '' }));

  const wrongLocation = db.prepare(
    `SELECT id, audit_date, room_number, location FROM audit_visits WHERE location = 'Ascension Seton Medical Center' AND ${SCOPE_SQL}`
  ).all();
  wrongLocation.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Location is Ascension Seton — no audits have actually happened there yet', detail: '' }));

  const duplicates = db.prepare(
    `SELECT audit_date, room_number, COUNT(*) as c FROM audit_visits
     WHERE audit_date IS NOT NULL AND room_number IS NOT NULL AND room_number != '' AND ${SCOPE_SQL}
     GROUP BY audit_date, room_number HAVING c > 1`
  ).all();
  duplicates.forEach((r) => issues.push({ id: null, date: r.audit_date, room: r.room_number, type: `Possible duplicate — ${r.c} audits logged for this room on this date`, detail: '' }));

  res.json({ count: issues.length, issues });
});

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  if (req.query.month) {
    const rows = db.prepare(
      `SELECT * FROM audit_visits WHERE substr(audit_date,1,7) = ? AND ${SCOPE_SQL} ORDER BY audit_date DESC, id DESC LIMIT ?`
    ).all(req.query.month, limit);
    return res.json(rows);
  }
  const rows = db.prepare(`SELECT * FROM audit_visits WHERE ${SCOPE_SQL} ORDER BY audit_date DESC, id DESC LIMIT ?`).all(limit);
  res.json(rows);
});

router.get('/check-duplicate', (req, res) => {
  const { date, room } = req.query;
  if (!date || !room) return res.json({ count: 0 });
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM audit_visits WHERE audit_date = ? AND room_number = ?'
  ).get(date, room);
  res.json({ count: row.c });
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
