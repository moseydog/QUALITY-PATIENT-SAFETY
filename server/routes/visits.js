const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');
const { METRICS } = require('../metrics');
const { UNITS, unitForRoom } = require('../units');

const router = express.Router();
router.use(requireAuth);

// The program's audit tracking is only considered reliable/relevant within
// this window; earlier pilot data and later stray entries are excluded from
// every stats view and the visit list, though the underlying rows are left
// in the database rather than deleted.
const SCOPE_START = '2025-09';
const SCOPE_END = '2026-04';
const SCOPE_SQL = `substr(audit_date,1,7) BETWEEN '${SCOPE_START}' AND '${SCOPE_END}'`;

// A month with only a handful of answered audits can't support a meaningful
// rate - one lucky/unlucky audit would swing it from 0% to 100%. Below this,
// the month is treated as not-yet-reportable rather than plotted.
const MIN_SAMPLE_SIZE = 10;

function metricOrThrow(key) {
  const m = METRICS.find((x) => x.key === key);
  if (!m) throw new Error('Unknown metric');
  return m;
}

// One metric's month-by-month {compliant, total} rows, respecting its exclude list.
// Months with fewer than MIN_SAMPLE_SIZE answered audits are dropped entirely,
// not just zeroed - a single lucky/unlucky audit shouldn't read as "100%" or "0%"
// for the whole month.
function monthlyRows(metric) {
  const notInSql = metric.exclude.length ? `AND ${metric.key} NOT IN (${metric.exclude.map(() => '?').join(',')})` : '';
  const sql = `
    SELECT substr(audit_date,1,7) as month,
      SUM(CASE WHEN ${metric.key} = 'yes' THEN 1 ELSE 0 END) as compliant,
      COUNT(*) as total
    FROM audit_visits
    WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL AND ${SCOPE_SQL} ${notInSql}
    GROUP BY month HAVING total >= ${MIN_SAMPLE_SIZE} ORDER BY month
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
    GROUP BY month, location HAVING total >= ${MIN_SAMPLE_SIZE} ORDER BY month
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
      byMonth[r.month] = { pct: Math.round((r.compliant / r.total) * 1000) / 10, compliant: r.compliant, total: r.total };
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

  // Precise field-swap signal: the score in this row exactly equals the room
  // number typed for it. Room numbers here run 3 digits; a 1-2 digit "room"
  // that's identical to the Braden or Morse score is very likely the two
  // fields getting swapped during entry, not a coincidence.
  const swappedBraden = db.prepare(
    `SELECT id, audit_date, room_number, braden_score FROM audit_visits
     WHERE braden_score IS NOT NULL AND room_number = CAST(braden_score AS TEXT) AND LENGTH(room_number) <= 2 AND ${SCOPE_SQL}`
  ).all();
  swappedBraden.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Likely field swap: room number exactly matches the Braden score', detail: String(r.braden_score) }));

  const swappedMorse = db.prepare(
    `SELECT id, audit_date, room_number, morse_score FROM audit_visits
     WHERE morse_score IS NOT NULL AND room_number = CAST(morse_score AS TEXT) AND LENGTH(room_number) <= 2 AND ${SCOPE_SQL}`
  ).all();
  swappedMorse.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Likely field swap: room number exactly matches the Morse score', detail: String(r.morse_score) }));

  const allRoomed = db.prepare(
    `SELECT id, audit_date, room_number FROM audit_visits WHERE room_number IS NOT NULL AND room_number GLOB '[0-9]*' AND ${SCOPE_SQL}`
  ).all();
  allRoomed.filter((r) => !unitForRoom(r.room_number)).forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: "Room number doesn't fall within any known unit's range — likely a typo", detail: '' }));

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
    `SELECT id, audit_date, room_number, location FROM audit_visits WHERE location = 'Hospital #2' AND ${SCOPE_SQL}`
  ).all();
  wrongLocation.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Location is Hospital #2 — no audits have actually happened there yet', detail: '' }));

  const duplicates = db.prepare(
    `SELECT audit_date, room_number, COUNT(*) as c FROM audit_visits
     WHERE audit_date IS NOT NULL AND room_number IS NOT NULL AND room_number != '' AND ${SCOPE_SQL}
     GROUP BY audit_date, room_number HAVING c > 1`
  ).all();
  duplicates.forEach((r) => issues.push({ id: null, date: r.audit_date, room: r.room_number, type: `Possible duplicate — ${r.c} audits logged for this room on this date`, detail: '' }));

  const totalAll = db.prepare('SELECT COUNT(*) as c FROM audit_visits').get().c;
  const totalInScope = db.prepare(`SELECT COUNT(*) as c FROM audit_visits WHERE ${SCOPE_SQL}`).get().c;
  const totalOutOfScope = totalAll - totalInScope;
  const counts = {
    totalInDatabase: totalAll,
    inScope: totalInScope,
    outOfScope: totalOutOfScope,
    scopeRange: `${SCOPE_START} to ${SCOPE_END}`,
    minSampleSize: MIN_SAMPLE_SIZE,
  };

  res.json({ count: issues.length, issues, counts });
});

// Risk-stratified snapshot for the most recent in-scope month, mirroring the
// real monthly summary sheet: compliance broken out by risk-score severity
// (Braden <=18 / <=14 for HAPI, Morse >=25 / >=45 for Falls), each with the
// point-change versus the prior month. Positive framing (e.g. "wedges
// present") reports raw compliance; the underlying fields are all yes/no.
const STRATA = {
  hapi: {
    scoreField: 'braden_score',
    tiers: [
      { label: 'Braden ≤ 18', cmp: (v) => v <= 18 },
      { label: 'Braden ≤ 14', cmp: (v) => v <= 14 },
    ],
    metricKeys: ['purple_wedges', 'turned_with_wedges', 'heels_offloaded', 'primo_boots', 'turned_recently', 'specialty_bed_yn'],
  },
  fall: {
    scoreField: 'morse_score',
    tiers: [
      { label: 'Morse ≥ 25', cmp: (v) => v >= 25 },
      { label: 'Morse ≥ 45', cmp: (v) => v >= 45 },
    ],
    metricKeys: ['fall_wristband', 'non_slip_socks', 'bed_alarm_on', 'bed_alarm_cord_plugged', 'call_light_reach', 'tips_board_correct', 'posey_alarm_charged', 'gait_belt_present', 'walker_present'],
  },
};

router.get('/stats/stratified/:category', (req, res) => {
  const spec = STRATA[req.params.category];
  if (!spec) return res.status(404).json({ error: 'Unknown category' });

  const months = db.prepare(`SELECT DISTINCT substr(audit_date,1,7) as month FROM audit_visits WHERE audit_date IS NOT NULL AND ${SCOPE_SQL} ORDER BY month`).all().map((r) => r.month);
  if (months.length === 0) return res.json({ months: [], tiers: spec.tiers.map((t) => t.label), metrics: [] });
  const latest = months[months.length - 1];
  const prior = months.length > 1 ? months[months.length - 2] : null;

  function tierStats(month, metricKey, tier) {
    if (!month) return null;
    const rows = db.prepare(
      `SELECT ${metricKey} as v, ${spec.scoreField} as score FROM audit_visits
       WHERE substr(audit_date,1,7) = ? AND ${metricKey} IS NOT NULL AND ${spec.scoreField} IS NOT NULL`
    ).all(month);
    const inTier = rows.filter((r) => tier.cmp(r.score));
    const compliant = inTier.filter((r) => r.v === 'yes').length;
    const total = inTier.length;
    if (total < MIN_SAMPLE_SIZE) return { compliant, total, pct: null };
    return { compliant, total, pct: Math.round((compliant / total) * 1000) / 10 };
  }

  const metrics = spec.metricKeys
    .map((key) => METRICS.find((m) => m.key === key))
    .filter(Boolean)
    .map((m) => {
      const tiers = spec.tiers.map((tier) => {
        const latestStat = tierStats(latest, m.key, tier);
        const priorStat = tierStats(prior, m.key, tier);
        const delta = latestStat && priorStat && latestStat.pct !== null && priorStat.pct !== null
          ? Math.round((latestStat.pct - priorStat.pct) * 10) / 10 : null;
        return { label: tier.label, ...latestStat, delta };
      });
      return { key: m.key, label: m.label, tiers };
    });

  res.json({ latestMonth: latest, priorMonth: prior, tierLabels: spec.tiers.map((t) => t.label), metrics });
});

// Fall semester (Sep-Dec) vs Spring semester (Jan-Apr) comparison, since the
// volunteer roster turns over on the academic calendar rather than by month.
const SEMESTERS = [
  { label: 'Fall 2025', months: ['2025-09', '2025-10', '2025-11', '2025-12'] },
  { label: 'Spring 2026', months: ['2026-01', '2026-02', '2026-03', '2026-04'] },
];

router.get('/stats/semester/:category', (req, res) => {
  const catMetrics = METRICS.filter((m) => m.category === req.params.category && !m.reference);
  if (catMetrics.length === 0) return res.status(404).json({ error: 'Unknown category' });

  const out = catMetrics.map((m) => {
    const notInSql = m.exclude.length ? `AND ${m.key} NOT IN (${m.exclude.map(() => '?').join(',')})` : '';
    const semesterStats = SEMESTERS.map((sem) => {
      const placeholders = sem.months.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT SUM(CASE WHEN ${m.key}='yes' THEN 1 ELSE 0 END) as compliant, COUNT(*) as total
         FROM audit_visits WHERE substr(audit_date,1,7) IN (${placeholders}) AND ${m.key} IS NOT NULL ${notInSql}`
      ).get(...sem.months, ...m.exclude);
      return {
        label: sem.label,
        compliant: row.compliant || 0,
        total: row.total || 0,
        pct: row.total >= MIN_SAMPLE_SIZE ? Math.round((row.compliant / row.total) * 1000) / 10 : null,
      };
    });
    const [fall, spring] = semesterStats;
    const delta = fall.pct !== null && spring.pct !== null ? Math.round((spring.pct - fall.pct) * 10) / 10 : null;
    return { key: m.key, label: m.label, target: m.target, semesters: semesterStats, delta };
  });

  res.json({ metrics: out });
});

router.get('/stats/by-unit', (req, res) => {
  const metricKeys = METRICS.filter((m) => !m.reference).map((m) => m.key);
  const cols = ['room_number', 'braden_score', 'morse_score', ...metricKeys].join(', ');
  const rows = db.prepare(`SELECT ${cols} FROM audit_visits WHERE room_number IS NOT NULL AND ${SCOPE_SQL}`).all();

  const byUnit = {};
  UNITS.forEach((u) => { byUnit[u.name] = { rows: [], bradenSum: 0, bradenN: 0, morseSum: 0, morseN: 0 }; });

  rows.forEach((r) => {
    const unit = unitForRoom(r.room_number);
    if (!unit) return; // room number doesn't fall in any known unit range
    byUnit[unit].rows.push(r);
    if (r.braden_score !== null && r.braden_score >= 6 && r.braden_score <= 23) {
      byUnit[unit].bradenSum += r.braden_score;
      byUnit[unit].bradenN += 1;
    }
    if (r.morse_score !== null && r.morse_score >= 0 && r.morse_score <= 125) {
      byUnit[unit].morseSum += r.morse_score;
      byUnit[unit].morseN += 1;
    }
  });

  const out = UNITS.map((u) => {
    const bucket = byUnit[u.name];
    const totalAudits = bucket.rows.length;
    const avgBraden = bucket.bradenN > 0 ? Math.round((bucket.bradenSum / bucket.bradenN) * 10) / 10 : null;
    const avgMorse = bucket.morseN > 0 ? Math.round((bucket.morseSum / bucket.morseN) * 10) / 10 : null;

    const categoryScores = {};
    ['fall', 'hapi'].forEach((cat) => {
      const catMetrics = METRICS.filter((m) => m.category === cat && !m.reference);
      let totalWeight = 0;
      let weightedSum = 0;
      catMetrics.forEach((m) => {
        const answered = bucket.rows.filter((r) => r[m.key] !== null && !m.exclude.includes(r[m.key]));
        const compliant = answered.filter((r) => r[m.key] === 'yes').length;
        if (answered.length >= MIN_SAMPLE_SIZE) {
          totalWeight += m.weight;
          weightedSum += (compliant / answered.length) * 100 * m.weight;
        }
      });
      categoryScores[cat] = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
    });

    return { unit: u.name, roomRange: `${u.min}-${u.max}`, totalAudits, avgBraden, avgMorse, ...categoryScores };
  });

  res.json({ units: out, scopeRange: `${SCOPE_START} to ${SCOPE_END}`, minSampleSize: MIN_SAMPLE_SIZE });
});

router.get('/stats/by-unit/:unit/monthly', (req, res) => {
  const unit = UNITS.find((u) => u.name === req.params.unit);
  if (!unit) return res.status(404).json({ error: 'Unknown unit' });

  function unitMonthlyRows(metric) {
    const notInSql = metric.exclude.length ? `AND ${metric.key} NOT IN (${metric.exclude.map(() => '?').join(',')})` : '';
    const sql = `
      SELECT substr(audit_date,1,7) as month,
        SUM(CASE WHEN ${metric.key} = 'yes' THEN 1 ELSE 0 END) as compliant,
        COUNT(*) as total
      FROM audit_visits
      WHERE ${metric.key} IS NOT NULL AND audit_date IS NOT NULL AND ${SCOPE_SQL}
        AND CAST(room_number AS INTEGER) BETWEEN ? AND ? ${notInSql}
      GROUP BY month HAVING total >= ${MIN_SAMPLE_SIZE} ORDER BY month
    `;
    return db.prepare(sql).all(unit.min, unit.max, ...metric.exclude);
  }

  const allMonths = db.prepare(`SELECT DISTINCT substr(audit_date,1,7) as month FROM audit_visits WHERE audit_date IS NOT NULL AND ${SCOPE_SQL} ORDER BY month`).all().map((r) => r.month);

  const categories = {};
  const targets = {};
  const metricBreakdown = [];
  ['fall', 'hapi'].forEach((cat) => {
    const catMetrics = METRICS.filter((m) => m.category === cat && !m.reference);
    const totalWeight = catMetrics.reduce((s, m) => s + m.weight, 0);
    targets[cat] = totalWeight > 0 ? Math.round(catMetrics.reduce((s, m) => s + m.target * m.weight, 0) / totalWeight) : 85;
    const perMetricByMonth = {};
    catMetrics.forEach((m) => {
      perMetricByMonth[m.key] = {};
      unitMonthlyRows(m).forEach((r) => { perMetricByMonth[m.key][r.month] = { compliant: r.compliant, total: r.total }; });
    });

    // Per-metric breakdown: latest available month for this unit, so
    // leadership can see exactly which specific metrics are driving the
    // category score up or down, not just the blended average.
    catMetrics.forEach((m) => {
      const monthsWithData = Object.keys(perMetricByMonth[m.key]).sort();
      const latestMonth = monthsWithData[monthsWithData.length - 1];
      const cell = latestMonth ? perMetricByMonth[m.key][latestMonth] : null;
      metricBreakdown.push({
        key: m.key,
        label: m.label,
        category: cat,
        weight: m.weight,
        target: m.target,
        latestMonth: latestMonth || null,
        pct: cell ? Math.round((cell.compliant / cell.total) * 1000) / 10 : null,
        n: cell ? cell.total : 0,
      });
    });

    const series = allMonths.map((month) => {
      let totalWeight = 0;
      let weightedSum = 0;
      let sampleTotal = 0;
      let sampleCompliant = 0;
      catMetrics.forEach((m) => {
        const cell = perMetricByMonth[m.key][month];
        if (cell) {
          const pct = (cell.compliant / cell.total) * 100;
          totalWeight += m.weight;
          weightedSum += pct * m.weight;
          sampleTotal += cell.total;
          sampleCompliant += cell.compliant;
        }
      });
      return {
        month,
        pct: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null,
        total: sampleTotal,
        compliant: sampleCompliant,
      };
    });
    categories[cat] = series;
  });

  res.json({ unit: unit.name, roomRange: `${unit.min}-${unit.max}`, categories, targets, metricBreakdown });
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
  if (b.room_number && /^\d+$/.test(String(b.room_number)) && !unitForRoom(b.room_number)) {
    return res.status(400).json({ error: `Room ${b.room_number} doesn't fall within any known unit's room range.` });
  }
  if (b.braden_score !== undefined && b.braden_score !== null && b.braden_score !== '') {
    const bs = Number(b.braden_score);
    if (bs < 6 || bs > 23) return res.status(400).json({ error: `Braden score ${bs} is outside the valid range (6-23).` });
  }
  if (b.morse_score !== undefined && b.morse_score !== null && b.morse_score !== '') {
    const ms = Number(b.morse_score);
    if (ms < 0 || ms > 125) return res.status(400).json({ error: `Morse score ${ms} is outside the valid range (0-125).` });
  }

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
