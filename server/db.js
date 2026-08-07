const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { METRICS } = require('./metrics');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// If this disk has no real data yet - either no file at all, or a file that
// exists but has zero audit visits (e.g. left over from an earlier deploy,
// before this restore logic existed) - restore from the historical data
// bundled with the code. Once the disk has even one real visit, this never
// touches it again.
const dbPath = path.join(DATA_DIR, 'qi.db');
const seedPath = path.join(__dirname, 'seed-data', 'qi-seed.db');

function isEmptyOrMissing(p) {
  if (!fs.existsSync(p)) return true;
  try {
    const testDb = new DatabaseSync(p);
    let count = 0;
    try {
      count = testDb.prepare('SELECT COUNT(*) as c FROM audit_visits').get().c;
    } catch (e) {
      count = 0; // table doesn't exist yet - treat as empty
    }
    testDb.close();
    return count === 0;
  } catch (e) {
    return true; // file exists but isn't a valid/openable database - restore
  }
}

if (isEmptyOrMissing(dbPath) && fs.existsSync(seedPath)) {
  fs.copyFileSync(seedPath, dbPath);
  // eslint-disable-next-line no-console
  console.log('Disk had no real data yet - restored historical audit data from the bundled seed file.');
}

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('volunteer','admin')),
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at TEXT,
    audit_date TEXT,
    submitted_by_email TEXT,
    location TEXT,
    room_number TEXT,

    hand_hygiene_in TEXT,
    hand_hygiene_out TEXT,

    is_fall_risk TEXT,
    morse_score INTEGER,
    tips_board_correct TEXT,
    bed_alarm_on TEXT,
    bed_alarm_cord_plugged TEXT,
    call_light_reach TEXT,
    fall_wristband TEXT,
    non_slip_socks TEXT,
    gait_belt_present TEXT,
    walker_present TEXT,
    posey_alarm_present TEXT,
    posey_alarm_charged TEXT,
    shower_chair_present TEXT,
    bedside_commode_present TEXT,

    is_hapi_risk TEXT,
    braden_score INTEGER,
    purple_wedges TEXT,
    specialty_bed_yn TEXT,
    specialty_bed_type TEXT,
    turned_with_wedges TEXT,
    turned_in_chair TEXT,
    heels_offloaded TEXT,
    primo_boots TEXT,
    turned_recently TEXT,

    needs_hapi_education TEXT,
    knows_what_pi_is TEXT,
    knows_pi_risk_factors TEXT,
    knows_pi_locations TEXT,
    knows_pi_prevention TEXT,
    already_educated_today TEXT,
    patient_refused_education TEXT,

    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS targets (
    metric_key TEXT PRIMARY KEY,
    target_value INTEGER NOT NULL
  );

  -- Contextual events that explain WHY the numbers moved - staffing changes,
  -- leadership interventions, process changes. Annotating run charts with the
  -- events behind a shift is standard QI practice: without it, a reader sees
  -- a dip and has no way to tell a real care problem from a staffing gap.
  CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_month TEXT NOT NULL,
    end_month TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'all',
    kind TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// metric_key lets an annotation target one specific metric (e.g. PRIMO boots)
// instead of a whole category. Added after the table shipped, so it's an
// idempotent ALTER rather than part of the CREATE above.
const annotationCols = db.prepare('PRAGMA table_info(annotations)').all().map((c) => c.name);
if (!annotationCols.includes('metric_key')) {
  db.exec('ALTER TABLE annotations ADD COLUMN metric_key TEXT');
}

// Known-bad data corrections that run every boot, on any disk - not just
// fresh ones. Unlike the seed-restore above, these reach into a disk that
// already has real data, since each targets one specific known mistake
// rather than rebuilding anything. Safe to run repeatedly: a no-op once
// nothing matches.
const CORRECTIONS = [
  {
    label: 'Ascension Seton rows relabeled to Hospital #1 (no audits have happened at that second site yet)',
    sql: "UPDATE audit_visits SET location = 'Dell Seton Medical Center' WHERE location = 'Ascension Seton Medical Center'",
  },
  {
    label: 'Hospital name anonymized: Dell Seton Medical Center -> Hospital #1',
    sql: "UPDATE audit_visits SET location = 'Hospital #1' WHERE location = 'Dell Seton Medical Center'",
  },
  {
    label: 'Hospital name anonymized: Ascension Seton Medical Center -> Hospital #2',
    sql: "UPDATE audit_visits SET location = 'Hospital #2' WHERE location = 'Ascension Seton Medical Center'",
  },
];
CORRECTIONS.forEach(({ label, sql }) => {
  try {
    const info = db.prepare(sql).run();
    if (info.changes > 0) {
      // eslint-disable-next-line no-console
      console.log(`Data correction applied: ${label} (${info.changes} row${info.changes === 1 ? '' : 's'})`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Data correction failed: ${label} -`, e.message);
  }
});

// Seed a default admin account the very first time the app runs, so there's
// always a way in. This password must be changed immediately after first login.
const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
if (adminCount === 0) {
  const tempPassword = 'ChangeMe123!';
  const hash = bcrypt.hashSync(tempPassword, 10);
  db.prepare("INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'admin', ?)")
    .run('admin', hash, 'Admin');
  // eslint-disable-next-line no-console
  console.log('First run: created default admin account -> username "admin", password "ChangeMe123!". Log in and change this immediately (Manage Users).');
}

// Seed default targets and suggestions on first run only (never overwrites
// values an admin has already edited).
const targetCount = db.prepare('SELECT COUNT(*) as c FROM targets').get().c;
if (targetCount === 0) {
  const insertTarget = db.prepare('INSERT INTO targets (metric_key, target_value) VALUES (?, ?)');
  METRICS.forEach((m) => insertTarget.run(m.key, m.target));
}

// The Nov-Dec leadership review covered each HAPI measure, so each gets its
// own note rather than one blanket sentence repeated under every chart.
const HAPI_LEADERSHIP_NOTES = [
  ['purple_wedges', 'wedge availability in patient rooms'],
  ['turned_with_wedges', 'use of wedges for side-lying positioning'],
  ['heels_offloaded', 'heel offloading practice'],
  ['primo_boots', 'PRIMO boot utilization'],
  ['turned_recently', 'Q2hr repositioning'],
  ['specialty_bed_yn', 'specialty bed allocation'],
];
const LEADERSHIP_TITLE = 'Findings shared with hospital leadership';
const GENERIC_LEADERSHIP_DETAIL = 'Audit results were presented to hospital leadership, who intervened to address the drop in HAPI prevention adherence.';

function leadershipRows() {
  return HAPI_LEADERSHIP_NOTES.map(([key, phrase]) => ({
    start: '2025-11', end: '2025-12', scope: 'hapi', kind: 'intervention', metric_key: key,
    title: LEADERSHIP_TITLE,
    detail: `Audit results were presented to hospital leadership, who intervened to address ${phrase}.`,
  }));
}

// Seed the known program events on first run only. These are real, documented
// context for the visible shifts in the data. Seeded once and never re-applied,
// so anything edited or deleted in the app stays that way.
const annotationCount = db.prepare('SELECT COUNT(*) as c FROM annotations').get().c;
const insertAnnotation = db.prepare(
  'INSERT INTO annotations (start_month, end_month, scope, kind, metric_key, title, detail) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
if (annotationCount === 0) {
  [
    {
      start: '2025-11', end: '2025-12', scope: 'hapi', kind: 'intervention', metric_key: null,
      title: LEADERSHIP_TITLE, detail: GENERIC_LEADERSHIP_DETAIL,
    },
    ...leadershipRows(),
    {
      start: '2026-01', end: '2026-04', scope: 'education', kind: 'staffing', metric_key: null,
      title: 'Volunteer director departed — roster fell from ~52 to ~20',
      detail: 'The volunteer director left at the start of the spring semester, disrupting scheduling and onboarding. The team shrank from roughly 52 volunteers to about 20, and shift call-outs rose. With the program understaffed, daily patient education was delivered inconsistently — the most likely explanation for the drop in patient understanding scores through the spring, and especially in April.',
    },
  ].forEach((a) => insertAnnotation.run(a.start, a.end, a.scope, a.kind, a.metric_key, a.title, a.detail));
} else {
  // Existing deployment: add per-metric notes alongside the general one, but
  // only once - guarded on whether any per-metric HAPI note already exists,
  // otherwise this re-inserts a duplicate set on every single boot.
  const alreadyPerMetric = db.prepare(
    `SELECT id FROM annotations WHERE metric_key IS NOT NULL AND scope='hapi' AND title=?`
  ).get(LEADERSHIP_TITLE);
  const generic = db.prepare(
    `SELECT id FROM annotations WHERE metric_key IS NULL AND scope='hapi' AND title=? AND detail=?`
  ).get(LEADERSHIP_TITLE, GENERIC_LEADERSHIP_DETAIL);
  if (generic && !alreadyPerMetric) {
    leadershipRows().forEach((a) => insertAnnotation.run(a.start, a.end, a.scope, a.kind, a.metric_key, a.title, a.detail));
    // eslint-disable-next-line no-console
    console.log('Added per-metric HAPI leadership notes alongside the general one.');
  }
}

// The category-level HAPI chart on Overview needs its own general note - the
// per-metric notes only attach to individual metric charts, so without this
// the blended HAPI chart would show no context at all.
const hasGeneralHapi = db.prepare(
  `SELECT id FROM annotations WHERE metric_key IS NULL AND scope='hapi' AND title=?`
).get(LEADERSHIP_TITLE);
const hasPerMetricHapi = db.prepare(
  `SELECT id FROM annotations WHERE metric_key IS NOT NULL AND scope='hapi' AND title=?`
).get(LEADERSHIP_TITLE);
if (!hasGeneralHapi && hasPerMetricHapi) {
  insertAnnotation.run('2025-11', '2025-12', 'hapi', 'intervention', null, LEADERSHIP_TITLE, GENERIC_LEADERSHIP_DETAIL);
  // eslint-disable-next-line no-console
  console.log('Restored the category-level HAPI leadership note for the Overview chart.');
}

module.exports = db;
