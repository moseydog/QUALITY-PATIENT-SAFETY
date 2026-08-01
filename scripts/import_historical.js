// One-time import of the real Google Forms export into the audit_visits table.
// Run with: node scripts/import_historical.js scripts/historical_data.csv
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../server/db');

const csvPath = process.argv[2] || path.join(__dirname, 'historical_data.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parse(raw, { columns: false, skip_empty_lines: true, from_line: 2 });

function trim(v) { return v === undefined || v === null ? null : String(v).trim(); }
function blankToNull(v) { const t = trim(v); return t === '' ? null : t; }

function yn(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  const low = t.toLowerCase();
  if (low.startsWith('yes')) return 'yes';
  if (low.startsWith('no')) return 'no';
  if (low === 'not applicable') return 'not_applicable';
  if (low === 'unable to assess') return 'unable_to_assess';
  return low.replace(/\s+/g, '_');
}

// Fields where "No (...)" has several historical wordings but all mean the
// same non-compliant outcome, plus one wording that's actually a different
// case (sitting in chair) that gets tracked as its own value.
function turnedWithWedges(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  if (t === 'Not Applicable') return 'not_applicable';
  if (t.toLowerCase().includes('sitting in the chair')) return 'sitting_in_chair';
  if (t.toLowerCase().startsWith('yes')) return 'yes';
  return 'no'; // every other "No (...)" wording variant = not positioned with wedges
}

function purpleWedges(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  if (t.startsWith('Yes')) return 'yes';
  if (t.startsWith('Other')) return 'other';
  return 'no';
}

function poseyCharged(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  if (t === 'Yes') return 'yes';
  if (t === 'No') return 'no';
  return 'not_in_room';
}

function specialtyBedType(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  return t.toLowerCase().replace(/\s+/g, '_');
}

function refusedEducation(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  if (t === 'Yes' || t === 'Patient refused') return 'yes';
  return 'no';
}

function validScore(v, min, max) {
  const t = blankToNull(v);
  if (t === null) return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return Math.round(n);
}

function normalizeDate(v) {
  const t = blankToNull(v);
  if (t === null) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  const year = Number(yr);
  if (year < 2020 || year > 2030) return null; // catches the "0202" typo rows
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

const insert = db.prepare(`
  INSERT INTO audit_visits (
    submitted_at, audit_date, submitted_by_email, location, room_number,
    hand_hygiene_in, hand_hygiene_out,
    is_fall_risk, morse_score, tips_board_correct, bed_alarm_on, bed_alarm_cord_plugged,
    call_light_reach, fall_wristband, non_slip_socks, gait_belt_present, walker_present,
    posey_alarm_present, posey_alarm_charged, shower_chair_present, bedside_commode_present,
    is_hapi_risk, braden_score, purple_wedges, specialty_bed_yn, specialty_bed_type,
    turned_with_wedges, turned_in_chair, heels_offloaded, primo_boots, turned_recently,
    needs_hapi_education, knows_what_pi_is, knows_pi_risk_factors, knows_pi_locations,
    knows_pi_prevention, already_educated_today, patient_refused_education
  ) VALUES (?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?,?)
`);

let imported = 0;
let dateRejected = 0;
let badBraden = 0;
let badMorse = 0;for (const r of rows) {
  const audit_date = normalizeDate(r[2]);
  if (blankToNull(r[2]) && !audit_date) dateRejected++;
  const braden = validScore(r[21], 6, 23);
  if (blankToNull(r[21]) && braden === null) badBraden++;
  const morse = validScore(r[35], 0, 125);
  if (blankToNull(r[35]) && morse === null) badMorse++;

  insert.run(
    blankToNull(r[0]), audit_date, blankToNull(r[1]), blankToNull(r[3]), blankToNull(r[4]),
    yn(r[19]), yn(r[18]),
    yn(r[31]), morse, yn(r[30]), yn(r[23]), yn(r[36]),
    yn(r[32]), yn(r[33]), yn(r[34]), yn(r[25]), yn(r[24]),
    yn(r[26]), poseyCharged(r[27]), yn(r[28]), yn(r[29]),
    yn(r[5]), braden, purpleWedges(r[6]), yn(r[7]), specialtyBedType(r[20]),
    turnedWithWedges(r[8]), yn(r[22]), yn(r[9]), yn(r[10]), yn(r[11]),
    yn(r[12]), yn(r[13]), yn(r[14]), yn(r[15]), yn(r[16]), yn(r[17]), refusedEducation(r[37])
  );
  imported++;
}

console.log(`Imported ${imported} audit visits.`);
console.log(`Dates rejected as invalid (kept row, date set null): ${dateRejected}`);
console.log(`Braden scores rejected as out-of-range (6-23): ${badBraden}`);
console.log(`Morse scores rejected as out-of-range (0-125): ${badMorse}`);
