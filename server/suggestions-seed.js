// Starting suggestions per metric - all editable/removable/addable by admins
// once the app is running (Manage Suggestions). These seed only on first run.
module.exports = {
  fall_wristband: [
    'Stock wristbands on the fall-risk equipment cart so availability isn\'t the barrier',
    'Add wristband application to the admission fall-risk order set',
    'Include a wristband check in shift-change handoff',
  ],
  non_slip_socks: [
    'Keep non-slip socks stocked at the bedside, not just in central supply',
    'Add sock application to the admission fall-risk checklist',
    'Flag missing socks during interdisciplinary rounds',
  ],
  bed_alarm_on: [
    'Tie alarm activation to the fall-risk order set so it isn\'t a separate manual step',
    'Include alarm status in shift-change handoff',
    'Real-time audit with same-shift feedback when found off',
  ],
  bed_alarm_cord_plugged: [
    'Standardize cord routing/labeling so it\'s obvious at a glance whether it\'s plugged in',
    'Add to routine equipment checks during rounding',
    'Flag rooms with frequent issues for an outlet or cord-length fix',
  ],
  call_light_reach: [
    'Make call-light placement part of every repositioning and turning task',
    'Add to bedside shift report checklist',
    'Quick reminder cards at the nurses\' station during high-census periods',
  ],
  tips_board_correct: [
    'Assign updating the TIPS board to whoever completes the fall-risk assessment',
    'Audit and correct in real time rather than noting it for later',
    'Include board accuracy in new-hire and travel-staff orientation',
  ],
  posey_alarm_charged: [
    'Standardize a charging station/routine for Posey alarms on the unit',
    'Track battery life as its own quick check during equipment rounds',
    'Swap to a spare immediately rather than leaving one that\'s low',
  ],
  gait_belt_present: [
    'Stock gait belts in every fall-risk kit rather than as shared/roaming equipment',
    'Track missing belts as an equipment/supply issue, not just a compliance miss',
    'Include belt availability in interdisciplinary rounds',
  ],
  walker_present: [
    'Coordinate with PT/OT so mobility aids arrive before the room audit, not after',
    'Track equipment turnaround time as a secondary measure',
    'Flag units with frequent shortages to central equipment services',
  ],
  shower_chair_present: [
    'Standardize bathroom equipment checks as part of admission setup',
    'Track equipment availability separately from whether staff remembered to request it',
    'Include in rounds for mobility-limited patients',
  ],
  bedside_commode_present: [
    'Tie commode delivery to the admission mobility assessment, not a separate request',
    'Track availability/turnaround as an equipment services metric',
    'Include in rounds for patients with toileting assistance needs',
  ],
  purple_wedges: [
    'Stock wedges directly on the unit rather than a shared central supply',
    'Pair wedge delivery with the Braden-triggered order set',
    'Track equipment availability as a distinct barrier from staff follow-through',
  ],
  turned_with_wedges: [
    'Bedside visual reminders (turn clocks/signage) paired with the wedges themselves',
    'Structured rounding that pairs repositioning checks with brief patient education',
    'Real-time audits with same-shift feedback rather than monthly reporting',
    'Consider a turn-team or buddy system for higher-acuity patients',
  ],
  heels_offloaded: [
    'Pair heel checks with routine repositioning or bathing care',
    'Default to a heel-offloading device for any Braden-flagged patient',
    'Two-person skin/positioning checks for limited-mobility patients',
  ],
  primo_boots: [
    'Make boot application part of the Braden-triggered order set',
    'Track boot inventory/availability as its own barrier to fix directly',
    'Include boot status in interdisciplinary rounds',
  ],
  turned_recently: [
    'Bedside turn clocks showing the last and next scheduled turn',
    'Shared CNA/RN documentation workflow so turns are logged in real time',
    'Real-time audits with direct, same-shift feedback',
  ],
  specialty_bed_yn: [
    'Auto-suggest a specialty bed from the Braden-triggered order set',
    'Track bed availability/turnaround as an equipment services metric',
    'Include current bed type in interdisciplinary rounds for at-risk patients',
  ],
  knows_what_pi_is: [
    'Keep the teach-back script visible for volunteers to reference at the bedside',
    'Repeat education across visits rather than assuming one conversation is enough',
    'Share what\'s working with volunteers whose patients consistently understand',
  ],
  knows_pi_risk_factors: [
    'Pair verbal education with a simple visual handout patients can keep',
    'Revisit risk factors at each visit rather than only once',
    'Focus extra time on patients with longer expected stays, where reinforcement compounds',
  ],
  knows_pi_locations: [
    'Use the body-diagram visual during education, not just verbal description',
    'Reinforce at shift handoff so nursing staff repeat the same message',
    'Track whether repeat visits improve recall for the same patient',
  ],
  knows_pi_prevention: [
    'Tie prevention teaching to what\'s actually happening in the room ("that\'s why we\'re turning you")',
    'Use a consistent mnemonic or script across volunteers',
    'Reinforce with family or caregivers present, not just the patient alone',
  ],
  already_educated_today: [
    'Log education somewhere shared and visible so it isn\'t duplicated or missed',
    'Coordinate timing with nursing so education isn\'t always happening at the same point in the day',
    'Treat a "no" as a prompt to educate now, not just a data point',
  ],
  default: [
    'Run a quick root-cause discussion with frontline staff to find the real barrier',
    'Test one small change with a PDSA cycle on a single unit before spreading it',
    'Increase audit frequency and give real-time feedback instead of monthly reports',
    'Add a visual reminder at the point of care',
  ],
};
