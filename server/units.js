// Room-number-to-unit mapping, confirmed against 3,095 real audits.
//
// Numeric ranges cover the floor-based units. CDU is matched by prefix
// instead, because its rooms are recorded as "CDU54", "CDU55" etc. rather
// than as bare numbers - without this, real CDU audits were being silently
// dropped from unit-level analysis even though CDU is a genuine audited unit.
const UNITS = [
  { name: 'CDU', prefix: 'CDU', label: 'CDU (Clinical Decision Unit)' },
  { name: 'SICU', min: 201, max: 230 },
  { name: 'MICU', min: 301, max: 330 },
  { name: '4EW', min: 401, max: 430 },
  { name: '4NS', min: 450, max: 479 },
  { name: '5NCC', min: 501, max: 530 },
  { name: '5NS', min: 550, max: 579 },
  { name: '6NS', min: 650, max: 679 },
  { name: '7NS', min: 750, max: 779 },
];

function roomRangeLabel(u) {
  return u.prefix ? `${u.prefix}##` : `${u.min}-${u.max}`;
}

function unitForRoom(roomNumber) {
  if (roomNumber === null || roomNumber === undefined) return null;
  const raw = String(roomNumber).trim().toUpperCase();
  if (raw === '') return null;

  const prefixMatch = UNITS.find((u) => u.prefix && raw.startsWith(u.prefix));
  if (prefixMatch) return prefixMatch.name;

  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  const match = UNITS.find((u) => u.min !== undefined && n >= u.min && n <= u.max);
  return match ? match.name : null;
}

// A room string is "well-formed" if it maps to a known unit. Anything else is
// surfaced rather than silently discarded - either as a data-quality flag or
// as an explicit "unassigned" bucket, so audit counts always reconcile.
function isValidRoom(roomNumber) {
  return unitForRoom(roomNumber) !== null;
}

module.exports = { UNITS, unitForRoom, isValidRoom, roomRangeLabel };
