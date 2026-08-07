// The program's audit tracking is only considered reliable within this
// window. Shared by the stats routes and the quality checker so the two can
// never drift apart.
const SCOPE_START = '2025-09';
const SCOPE_END = '2026-04';
const SCOPE_SQL = `substr(audit_date,1,7) BETWEEN '${SCOPE_START}' AND '${SCOPE_END}'`;

// A month with only a handful of answered audits can't support a meaningful
// rate - one lucky/unlucky audit would swing it from 0% to 100%.
const MIN_SAMPLE_SIZE = 10;

module.exports = { SCOPE_START, SCOPE_END, SCOPE_SQL, MIN_SAMPLE_SIZE };
