// Canonical list of tracked metrics, matching the real audit_visits columns.
// `exclude` lists values that should be dropped from the denominator entirely
// (not counted as either compliant or non-compliant) - e.g. "not applicable"
// or "unable to assess".
const METRICS = [
  // --- Fall prevention ---
// weight 3 = explicitly named as most important (actual protective equipment
// in active use); weight 1 = explicitly named as less important
// (identification/documentation); weight 2 = not specifically named, given
// the standard weight rather than assumed into either extreme.
  { key: 'fall_wristband', label: 'Fall-risk wristband on', category: 'fall', target: 90, exclude: [], weight: 1 },
  { key: 'non_slip_socks', label: 'Non-slip socks on', category: 'fall', target: 85, exclude: [], weight: 3 },
  { key: 'bed_alarm_on', label: 'Bed alarm on', category: 'fall', target: 90, exclude: [], weight: 3 },
  { key: 'bed_alarm_cord_plugged', label: 'Bed alarm cord plugged in', category: 'fall', target: 95, exclude: [], weight: 2 },
  { key: 'call_light_reach', label: 'Call light within reach', category: 'fall', target: 95, exclude: [], weight: 2 },
  { key: 'tips_board_correct', label: 'TIPS board filled out correctly', category: 'fall', target: 90, exclude: [], weight: 2 },
  { key: 'posey_alarm_charged', label: 'Posey alarm charged', category: 'fall', target: 95, exclude: ['not_in_room'], weight: 1 },
  { key: 'gait_belt_present', label: 'Gait belt in room', category: 'fall', target: 85, exclude: [], weight: 2 },
  { key: 'walker_present', label: 'Walker in room', category: 'fall', target: 80, exclude: [], weight: 2 },
  { key: 'shower_chair_present', label: 'Shower chair in bathroom', category: 'fall', target: 80, exclude: [], reference: true },
  { key: 'bedside_commode_present', label: 'Bedside commode in bathroom', category: 'fall', target: 80, exclude: [], reference: true },

  // --- HAPI prevention ---
  // weight 3 = explicitly named as most important (actual positioning/
  // repositioning outcomes); weight 1 = explicitly named as less important
  // (equipment presence, not the outcome itself).
  { key: 'purple_wedges', label: 'Two purple wedges present', category: 'hapi', target: 85, exclude: [], weight: 1 },
  { key: 'turned_with_wedges', label: 'Positioned with wedges', category: 'hapi', target: 85, exclude: ['not_applicable', 'sitting_in_chair'], weight: 3 },
  { key: 'heels_offloaded', label: 'Heels offloaded properly', category: 'hapi', target: 85, exclude: ['not_applicable'], weight: 3 },
  { key: 'primo_boots', label: 'PRIMO boots on', category: 'hapi', target: 80, exclude: ['not_applicable'], weight: 1 },
  { key: 'turned_recently', label: 'Turned within past 2 hours', category: 'hapi', target: 90, exclude: ['not_applicable'], weight: 3 },
  { key: 'specialty_bed_yn', label: 'On a specialty bed', category: 'hapi', target: 70, exclude: [], weight: 1 },

  // --- Patient education (health literacy teach-back) ---
  { key: 'knows_what_pi_is', label: 'Knows what a pressure injury is', category: 'education', target: 80, exclude: ['unable_to_assess', 'not_applicable'], weight: 1 },
  { key: 'knows_pi_risk_factors', label: 'Knows pressure injury risk factors', category: 'education', target: 75, exclude: ['unable_to_assess'], weight: 1 },
  { key: 'knows_pi_locations', label: 'Knows where pressure injuries occur', category: 'education', target: 75, exclude: ['unable_to_assess'], weight: 1 },
  { key: 'knows_pi_prevention', label: 'Knows prevention strategies', category: 'education', target: 75, exclude: ['unable_to_assess'], weight: 1 },
  { key: 'already_educated_today', label: 'Already educated today (self-report)', category: 'education', target: 70, exclude: ['unable_to_assess'], weight: 1, reference: true },
];

const METRIC_KEYS = new Set(METRICS.map((m) => m.key));

module.exports = { METRICS, METRIC_KEYS };
