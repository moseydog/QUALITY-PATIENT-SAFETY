// Canonical list of tracked metrics, matching the real audit_visits columns.
// `exclude` lists values that should be dropped from the denominator entirely
// (not counted as either compliant or non-compliant) - e.g. "not applicable"
// or "unable to assess".
const METRICS = [
  // --- Fall prevention ---
  { key: 'fall_wristband', label: 'Fall-risk wristband on', category: 'fall', target: 90, exclude: [] },
  { key: 'non_slip_socks', label: 'Non-slip socks on', category: 'fall', target: 85, exclude: [] },
  { key: 'bed_alarm_on', label: 'Bed alarm on', category: 'fall', target: 90, exclude: [] },
  { key: 'bed_alarm_cord_plugged', label: 'Bed alarm cord plugged in', category: 'fall', target: 95, exclude: [] },
  { key: 'call_light_reach', label: 'Call light within reach', category: 'fall', target: 95, exclude: [] },
  { key: 'tips_board_correct', label: 'TIPS board filled out correctly', category: 'fall', target: 90, exclude: [] },
  { key: 'posey_alarm_charged', label: 'Posey alarm charged', category: 'fall', target: 95, exclude: ['not_in_room'] },
  { key: 'gait_belt_present', label: 'Gait belt in room', category: 'fall', target: 85, exclude: [] },
  { key: 'walker_present', label: 'Walker in room', category: 'fall', target: 80, exclude: [] },
  { key: 'shower_chair_present', label: 'Shower chair in bathroom', category: 'fall', target: 80, exclude: [], reference: true },
  { key: 'bedside_commode_present', label: 'Bedside commode in bathroom', category: 'fall', target: 80, exclude: [], reference: true },

  // --- HAPI prevention ---
  { key: 'purple_wedges', label: 'Two purple wedges present', category: 'hapi', target: 85, exclude: [] },
  { key: 'turned_with_wedges', label: 'Positioned with wedges', category: 'hapi', target: 85, exclude: ['not_applicable', 'sitting_in_chair'] },
  { key: 'heels_offloaded', label: 'Heels offloaded properly', category: 'hapi', target: 85, exclude: ['not_applicable'] },
  { key: 'primo_boots', label: 'PRIMO boots on', category: 'hapi', target: 80, exclude: ['not_applicable'] },
  { key: 'turned_recently', label: 'Turned within past 2 hours', category: 'hapi', target: 90, exclude: ['not_applicable'] },
  { key: 'specialty_bed_yn', label: 'On a specialty bed', category: 'hapi', target: 70, exclude: [] },

  // --- Patient education (health literacy teach-back) ---
  { key: 'knows_what_pi_is', label: 'Knows what a pressure injury is', category: 'education', target: 80, exclude: ['unable_to_assess', 'not_applicable'] },
  { key: 'knows_pi_risk_factors', label: 'Knows pressure injury risk factors', category: 'education', target: 75, exclude: ['unable_to_assess'] },
  { key: 'knows_pi_locations', label: 'Knows where pressure injuries occur', category: 'education', target: 75, exclude: ['unable_to_assess'] },
  { key: 'knows_pi_prevention', label: 'Knows prevention strategies', category: 'education', target: 75, exclude: ['unable_to_assess'] },
  { key: 'already_educated_today', label: 'Already educated today (self-report)', category: 'education', target: 70, exclude: ['unable_to_assess'] },
];

const METRIC_KEYS = new Set(METRICS.map((m) => m.key));

module.exports = { METRICS, METRIC_KEYS };
