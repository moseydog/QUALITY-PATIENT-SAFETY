const db = require('./db');
const { unitForRoom } = require('./units');
const { SCOPE_SQL, SCOPE_START, SCOPE_END, MIN_SAMPLE_SIZE } = require('./config');

// Deterministic data-quality checks. Deliberately rule-based rather than
// model-driven: every signal here is a hard fact (a score outside its
// clinically valid range, a room matching no unit, two audits for the same
// room on the same date). Fixed rules are instant, free, run with no data
// leaving this server, and can't judge the same row differently on different
// days - all of which matter for a tool doing hospital quality reporting.
function runQualityChecks() {
  const issues = [];

  const badBraden = db.prepare(
    `SELECT id, audit_date, room_number, braden_score FROM audit_visits WHERE braden_score IS NOT NULL AND (braden_score < 6 OR braden_score > 23) AND ${SCOPE_SQL}`
  ).all();
  badBraden.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Braden score out of range (valid: 6-23)', detail: String(r.braden_score) }));

  const badMorse = db.prepare(
    `SELECT id, audit_date, room_number, morse_score FROM audit_visits WHERE morse_score IS NOT NULL AND (morse_score < 0 OR morse_score > 125) AND ${SCOPE_SQL}`
  ).all();
  badMorse.forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Morse score out of range (valid: 0-125)', detail: String(r.morse_score) }));

  // Precise field-swap signal: the score exactly equals the room number typed
  // for it. Room numbers here run 3 digits; a 1-2 digit "room" identical to a
  // Braden or Morse score is very likely the two fields getting swapped.
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
    `SELECT id, audit_date, room_number FROM audit_visits WHERE room_number IS NOT NULL AND TRIM(room_number) != '' AND ${SCOPE_SQL}`
  ).all();
  allRoomed.filter((r) => !unitForRoom(r.room_number)).forEach((r) => issues.push({ id: r.id, date: r.audit_date, room: r.room_number, type: 'Room number matches no known unit — likely a typo', detail: '' }));

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

  return {
    count: issues.length,
    issues,
    counts: {
      totalInDatabase: totalAll,
      inScope: totalInScope,
      outOfScope: totalAll - totalInScope,
      scopeRange: `${SCOPE_START} to ${SCOPE_END}`,
      minSampleSize: MIN_SAMPLE_SIZE,
    },
  };
}

// Cached result of the most recent sweep, so the badge and panel can read a
// current answer without re-querying on every page load.
let lastResult = null;
let lastRunAt = null;

function refresh() {
  lastResult = runQualityChecks();
  lastRunAt = new Date().toISOString();
  return lastResult;
}

function getLatest() {
  if (!lastResult) refresh();
  return { ...lastResult, lastRunAt };
}

// Continuous checking: sweep on boot, then on an interval, and again whenever
// a new audit is submitted. No API key and no external service needed - the
// checks are deterministic, so running them constantly costs nothing.
function startScheduler(intervalMinutes = 60) {
  refresh();
  const ms = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    try {
      const before = lastResult ? lastResult.count : 0;
      refresh();
      if (lastResult.count !== before) {
        // eslint-disable-next-line no-console
        console.log(`Quality sweep: ${lastResult.count} open issue(s) (was ${before}).`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Quality sweep failed:', e.message);
    }
  }, ms);
  if (timer.unref) timer.unref();
  // eslint-disable-next-line no-console
  console.log(`Quality checks running continuously (on boot, every ${intervalMinutes} min, and after each new audit). Currently ${lastResult.count} open issue(s).`);
}

module.exports = { runQualityChecks, refresh, getLatest, startScheduler };
