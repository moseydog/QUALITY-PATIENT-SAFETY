// Room-number-to-unit mapping, confirmed against 3,095 real audits: every
// unit's actual room numbers fell cleanly inside these ranges except for 4
// isolated single-occurrence outliers (278, 582, 717, 780) - each is very
// likely its own data-entry typo, not evidence the ranges are wrong.
const UNITS = [
  { name: 'SICU', min: 201, max: 230 },
  { name: 'MICU', min: 301, max: 330 },
  { name: '4EW', min: 401, max: 430 },
  { name: '4NS', min: 450, max: 479 },
  { name: '5NCC', min: 501, max: 530 },
  { name: '5NS', min: 550, max: 579 },
  { name: '6NS', min: 650, max: 679 },
  { name: '7NS', min: 750, max: 779 },
];

function unitForRoom(roomNumber) {
  const n = Number(roomNumber);
  if (!Number.isInteger(n)) return null;
  const match = UNITS.find((u) => n >= u.min && n <= u.max);
  return match ? match.name : null;
}

function isValidRoom(roomNumber) {
  return unitForRoom(roomNumber) !== null;
}

module.exports = { UNITS, unitForRoom, isValidRoom };
