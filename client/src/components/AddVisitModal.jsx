import React, { useState, useMemo } from 'react';
import { X, Info, AlertTriangle } from 'lucide-react';

const YES_NO = [['', 'Select...'], ['yes', 'Yes'], ['no', 'No']];
const YES_NO_NA = [...YES_NO, ['not_applicable', 'Not applicable']];

// Real, confirmed unit layout - checked directly against 3,095 historical
// audits: every real room number fell inside these ranges except 4 isolated
// single-occurrence outliers, each almost certainly its own data-entry typo.
const UNITS = [
  { name: 'CDU', prefix: 'CDU' },
  { name: 'SICU', min: 201, max: 230 },
  { name: 'MICU', min: 301, max: 330 },
  { name: '4EW', min: 401, max: 430 },
  { name: '4NS', min: 450, max: 479 },
  { name: '5NCC', min: 501, max: 530 },
  { name: '5NS', min: 550, max: 579 },
  { name: '6NS', min: 650, max: 679 },
  { name: '7NS', min: 750, max: 779 },
];
function unitForRoom(room) {
  if (room === null || room === undefined) return null;
  const raw = String(room).trim().toUpperCase();
  if (raw === '') return null;
  const prefixMatch = UNITS.find((u) => u.prefix && raw.startsWith(u.prefix));
  if (prefixMatch) return prefixMatch.name;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  const u = UNITS.find((x) => x.min !== undefined && n >= x.min && n <= x.max);
  return u ? u.name : null;
}

// Hard-blocking checks: these disable Save outright, since each is either a
// room number that cannot exist in this hospital's layout, or a score value
// that is clinically impossible - not a judgment call, a fact. Catches the
// specific, recurring mistake of a Braden or Morse score ending up in the
// room number field (or vice versa). Deterministic rules, not a model call:
// the signal is a plain range/match check, so there's nothing here that
// benefits from an LLM's judgment, and a fixed rule is faster, free, and
// can't judge the same input differently on different days.
function validateForm(form) {
  const errors = [];
  const warnings = [];
  const room = form.room_number.trim();
  const roomIsNumeric = /^\d+$/.test(room);
  const braden = form.braden_score !== '' ? Number(form.braden_score) : null;
  const morse = form.morse_score !== '' ? Number(form.morse_score) : null;

  if (room && roomIsNumeric && !unitForRoom(room)) {
    errors.push(`Room ${room} doesn't fall within any known unit's room range (CDU rooms start with "CDU"; SICU 201-230, MICU 301-330, 4EW 401-430, 4NS 450-479, 5NCC 501-530, 5NS 550-579, 6NS 650-679, 7NS 750-779). Double-check the room number.`);
  }
  if (braden !== null && (braden < 6 || braden > 23)) {
    errors.push(`Braden score ${braden} is outside the only clinically valid range (6-23) — this is very likely a room number entered in the wrong field.`);
  }
  if (morse !== null && (morse < 0 || morse > 125)) {
    errors.push(`Morse score ${morse} is outside the only clinically valid range (0-125) — this is very likely a room number entered in the wrong field.`);
  }

  if (roomIsNumeric && braden !== null && room === String(braden)) {
    warnings.push(`Room number "${room}" exactly matches the Braden score entered — double-check these two fields weren't swapped.`);
  } else if (roomIsNumeric && morse !== null && room === String(morse)) {
    warnings.push(`Room number "${room}" exactly matches the Morse score entered — double-check these two fields weren't swapped.`);
  }

  return { errors, warnings };
}

const YES_NO_UNABLE = [...YES_NO, ['unable_to_assess', 'Unable to assess']];
const YES_NO_NA_UNABLE = [...YES_NO, ['not_applicable', 'Not applicable'], ['unable_to_assess', 'Unable to assess']];

function Field({ label, value, onChange, options, image, imageAlt }) {
  const realOptions = options.filter(([v]) => v !== '');
  return (
    <div className="bg-surface border border-rule rounded-lg p-3">
      <label className="text-sm text-ink font-medium">{label}</label>
      {image && (
        <div className="my-2 flex justify-center bg-surface-2 rounded p-2">
          <img src={image} alt={imageAlt || label} className="max-h-40 object-contain" />
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {realOptions.map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="radio"
              name={label}
              checked={value === v}
              onChange={() => onChange(v)}
              className="w-4 h-4 accent-ink"
            />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, hint }) {
  return (
    <div className="bg-surface border border-rule rounded-lg p-3">
      <label className="text-sm text-ink font-medium">{label}{hint ? <span className="text-text-dim font-normal"> ({hint})</span> : ''}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Short answer text"
        className="w-full border-b border-rule focus:border-text-muted outline-none px-1 py-2 text-sm mt-2 bg-transparent"
      />
    </div>
  );
}

function InfoBlock({ children }) {
  return (
    <div className="bg-surface-2 border border-rule rounded-lg px-3 py-2 text-xs text-text-muted leading-relaxed">
      {children}
    </div>
  );
}

function ScriptBlock({ title, children }) {
  return (
    <details className="bg-surface-2 border border-rule rounded-lg px-3 py-2 text-xs text-text-muted">
      <summary className="cursor-pointer font-medium text-ink">{title}</summary>
      <div className="mt-2 leading-relaxed space-y-2">{children}</div>
    </details>
  );
}

const initialForm = {
  audit_date: new Date().toISOString().slice(0, 10),
  location: 'Hospital #1', room_number: '',
  is_fall_risk: '', morse_score: '', tips_board_correct: '', bed_alarm_on: '',
  bed_alarm_cord_plugged: '', call_light_reach: '', fall_wristband: '', non_slip_socks: '',
  gait_belt_present: '', walker_present: '', posey_alarm_present: '', posey_alarm_charged: '',
  shower_chair_present: '', bedside_commode_present: '',
  is_hapi_risk: '', braden_score: '', purple_wedges: '', specialty_bed_yn: '', specialty_bed_type: '',
  turned_with_wedges: '', turned_in_chair: '', heels_offloaded: '', primo_boots: '', turned_recently: '',
  patient_refused_education: '', needs_hapi_education: '',
  knows_what_pi_is: '', knows_pi_locations: '', knows_pi_risk_factors: '', knows_pi_prevention: '',
};

export default function AddVisitModal({ onClose, onSave, error }) {
  const [form, setForm] = useState(initialForm);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (val) => { setForm((f) => ({ ...f, [key]: val })); setChecked(false); };
  const { errors: formErrors, warnings: swapWarnings } = useMemo(() => validateForm(form), [form.room_number, form.braden_score, form.morse_score]);
  const needsConfirm = duplicateCount > 0 || swapWarnings.length > 0;

  async function handleSaveClick() {
    if (formErrors.length > 0) return; // hard block - cannot be overridden
    if (!checked) {
      setChecking(true);
      try {
        const res = await fetch(`/api/visits/check-duplicate?date=${encodeURIComponent(form.audit_date)}&room=${encodeURIComponent(form.room_number)}`, { credentials: 'same-origin' });
        const data = await res.json();
        setDuplicateCount(data.count || 0);
      } catch (e) { setDuplicateCount(0); }
      setChecking(false);
      setChecked(true);
      return; // show the warning (if any) and require a second click to actually save
    }
    setSubmitting(true);
    await onSave(form);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="h-2 bg-hapi-accent flex-shrink-0" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
          <div>
            <h3 className="font-semibold text-ink">Add a room-visit audit</h3>
            <p className="text-xs text-text-dim">Part 1: Falls — bed alarms &amp; fall prevention equipment. Part 2: HAPI &amp; patient education — positioning, heel offloading, repositioning, pressure-redistribution devices, and the knowledge check.</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-text-dim" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
          <InfoBlock>
            Please <strong>introduce yourself</strong> before starting: <em>"Hi, it's nice to meet you. My name is [your name] and I'm a volunteer with the Quality &amp; Patient Safety Team. We're here to search your room for equipment. Would that be okay with you?"</em> Proceed with the audit after your introduction.
          </InfoBlock>

          <div className="bg-surface border border-rule rounded-lg p-3 space-y-3">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Visit basics</h4>
            <div>
              <label className="text-sm text-ink font-medium">Date of audit</label>
              <input type="date" value={form.audit_date} onChange={(e) => set('audit_date')(e.target.value)}
                className="w-full border-b border-rule focus:border-text-muted outline-none px-1 py-2 text-sm mt-2 bg-transparent" />
            </div>
            <div>
              <label className="text-sm text-ink font-medium">Room number</label>
              <input value={form.room_number} onChange={(e) => set('room_number')(e.target.value)} placeholder="e.g. 452"
                className="w-full border-b border-rule focus:border-text-muted outline-none px-1 py-2 text-sm mt-2 bg-transparent" />
              <p className="text-[11px] text-text-dim mt-1">CDU (e.g. CDU54) · SICU 201-230 · MICU 301-330 · 4EW 401-430 · 4NS 450-479 · 5NCC 501-530 · 5NS 550-579 · 6NS 650-679 · 7NS 750-779</p>
            </div>
          </div>
          <div className="bg-surface-2 border border-rule rounded-lg p-3">
            <label className="text-sm text-ink font-medium">Location</label>
            <p className="text-sm text-text-muted mt-1">Hospital #1</p>
            <p className="text-xs text-text-dim mt-1">The only site currently being audited — ask an admin to re-enable a location choice once a second site starts.</p>
          </div>

          <div className="pt-2">
            <Field label="Is the patient a fall-risk?" value={form.is_fall_risk} onChange={set('is_fall_risk')} options={YES_NO} />
          </div>

          {form.is_fall_risk === 'yes' && (
            <div className="bg-falls-light border-2 border-falls-accent rounded-lg p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-falls-accent uppercase tracking-wide">Part 1 — Falls</h4>
                <p className="text-xs text-text-dim">Bed alarms, mobility aids, and fall-prevention equipment.</p>
              </div>
              <NumberField label="Morse Fall Risk Score" value={form.morse_score} onChange={set('morse_score')} min={0} max={125} hint="0-125" />
              <InfoBlock>The TIPS Board contains mobility status and other information to determine fall risk. If the patient needs assistance from 2+ people out of bed, they have limited mobility (higher risk of falling).</InfoBlock>
              <Field label="Is the TIPS Board filled out with the correct name and date?" value={form.tips_board_correct} onChange={set('tips_board_correct')} options={YES_NO} />
              <Field label="Is the Bed Alarm on?" value={form.bed_alarm_on} onChange={set('bed_alarm_on')} options={YES_NO} image="/images/bed_alarm.png" />
              <Field label="Is the Bed Alarm Cord plugged into the wall?" value={form.bed_alarm_cord_plugged} onChange={set('bed_alarm_cord_plugged')} options={YES_NO} />
              <Field label="Is the Call Light within reach?" value={form.call_light_reach} onChange={set('call_light_reach')} options={YES_NO} image="/images/call_light.png" />
              <Field label="Does the patient have a Fall Risk Wristband on?" value={form.fall_wristband} onChange={set('fall_wristband')} options={YES_NO} image="/images/fall_wristband.png" />
              <Field label="Does the patient have Non-Slip Socks on?" value={form.non_slip_socks} onChange={set('non_slip_socks')} options={YES_NO} image="/images/non_slip_socks.png" />
              <Field label="Is there a Gait Belt in the room?" value={form.gait_belt_present} onChange={set('gait_belt_present')} options={YES_NO} image="/images/gait_belt.png" />
              <Field label="Is there a Walker in the room?" value={form.walker_present} onChange={set('walker_present')} options={YES_NO} image="/images/walker.png" />
              <Field label="Is there a Posey Alarm in the room?" value={form.posey_alarm_present} onChange={set('posey_alarm_present')} options={YES_NO} image="/images/posey_alarm.png" />
              <Field label="Is the Posey Alarm fully charged?" value={form.posey_alarm_charged} onChange={set('posey_alarm_charged')} options={[...YES_NO, ['not_in_room', 'The Posey Alarm is not in the room']]} />
              <InfoBlock>If applicable, please change out the batteries of the Posey Alarm.</InfoBlock>
              <Field label="Is there a Shower Chair in the bathroom?" value={form.shower_chair_present} onChange={set('shower_chair_present')} options={YES_NO} image="/images/shower_chair.png" />
              <Field label="Is there a Bedside Commode in the bathroom?" value={form.bedside_commode_present} onChange={set('bedside_commode_present')} options={YES_NO} image="/images/bedside_commode.png" />

              <div className="pt-3 mt-1 border-t border-falls-accent space-y-3">
                <h5 className="text-xs font-semibold text-falls-accent uppercase tracking-wide">Falls prevention education</h5>
                <ScriptBlock title='Say — "Would it be okay if I go over your fall prevention plan with you?"'>
                  <p>"I just wanted to remind you that you can always press your call button whenever you need help getting out of bed. It's especially important to call for assistance if you are connected to an IV or other medical devices to prevent accidents from happening. In addition, the medications that you may be taking can cause you to feel drowsy and light-headed. If you feel any of these symptoms, please give us a call so that the nursing staff can assist you."</p>
                </ScriptBlock>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Field label="Is the patient at risk of developing a pressure injury?" value={form.is_hapi_risk} onChange={set('is_hapi_risk')} options={YES_NO} />
          </div>

          {form.is_hapi_risk === 'yes' && (
            <div className="bg-hapi-light border-2 border-hapi-accent rounded-lg p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-hapi-accent uppercase tracking-wide">Part 2 — HAPI &amp; patient education</h4>
                <p className="text-xs text-text-dim">Positioning, heel offloading, repositioning, pressure-redistribution devices, and the patient knowledge check.</p>
              </div>
              <NumberField label="Braden Score" value={form.braden_score} onChange={set('braden_score')} min={6} max={23} hint="6-23" />
              <Field label="Are there Purple Wedges in the room?" value={form.purple_wedges} onChange={set('purple_wedges')}
                options={[['', 'Select...'], ['yes', 'Yes (two)'], ['no', 'No (less than two or none)'], ['other', 'Other (more than two)']]} image="/images/purple_wedge.png" />
              <Field label="Is the patient on a Specialty Bed?" value={form.specialty_bed_yn} onChange={set('specialty_bed_yn')} options={YES_NO} image="/images/specialty_bed.png" />
              <Field label="What type of Specialty Bed is being used?" value={form.specialty_bed_type} onChange={set('specialty_bed_type')}
                options={[['', 'Select...'], ['arjo', 'Arjo'], ['envella', 'Envella'], ['icu', 'ICU'], ['not_applicable', 'Not applicable']]} />
              <Field label="Is the patient turned to their side with Purple Wedges?" value={form.turned_with_wedges} onChange={set('turned_with_wedges')}
                options={[['', 'Select...'], ['yes', 'Yes (turned on their side with the wedges)'], ['no', 'No (laying flat or pillows used instead)'], ['sitting_in_chair', 'No (the patient is sitting in the chair)'], ['not_applicable', 'Not applicable']]} image="/images/turned_with_wedge.png" />
              {form.turned_with_wedges === 'sitting_in_chair' && (
                <Field label="If sitting in the chair, are they turned on their side?" value={form.turned_in_chair} onChange={set('turned_in_chair')} options={YES_NO_NA} />
              )}
              <Field label="Are the patient's heels offloaded properly?" value={form.heels_offloaded} onChange={set('heels_offloaded')}
                options={[['', 'Select...'], ['yes', 'Yes (heels are off the surface of the bed)'], ['no', 'No (heels are touching the surface of the bed)'], ['not_applicable', 'Not applicable']]} image="/images/heel_floating.png" imageAlt="How to effectively float heels" />
              <Field label="Does the patient have PRIMO boots on?" value={form.primo_boots} onChange={set('primo_boots')} options={YES_NO_NA} image="/images/primo_boot.png" />
              <Field label="Has the patient been turned recently (past 2 hours)?" value={form.turned_recently} onChange={set('turned_recently')} options={YES_NO_NA} />
              <p className="text-xs text-text-dim italic">*Please ask the patient or nurse/PCT directly*</p>

              <div className="pt-3 mt-3 border-t border-hapi-accent space-y-3">
                <h5 className="text-xs font-semibold text-hapi-accent uppercase tracking-wide">Patient education</h5>
                <InfoBlock>
                  One of the most important parts of your role is patient education — you don't need to be a doctor or nurse, just a friendly advocate. Some patients may be non-verbal or unable to answer; select "Unable to assess" to continue.
                </InfoBlock>
                <Field label="Did the patient refuse education?" value={form.patient_refused_education} onChange={set('patient_refused_education')} options={YES_NO} />

                {form.patient_refused_education !== 'yes' && (
                  <>
                    <Field label="Does this patient need HAPI prevention education?" value={form.needs_hapi_education} onChange={set('needs_hapi_education')} options={YES_NO} />
                    {form.needs_hapi_education === 'yes' && (
                      <div className="space-y-3">
                        <Field label="Do you know what a pressure injury is?" value={form.knows_what_pi_is} onChange={set('knows_what_pi_is')} options={YES_NO_NA_UNABLE} />
                        <ScriptBlock title="Script — if patient doesn't know what a pressure injury is">
                          <p>"A pressure injury, sometimes called a bedsore, is an area of skin breakdown that happens when a patient stays in one position for too long. Did you know that a pressure injury can begin forming in as little as 2 hours? These injuries can be extremely painful and slow to heal if not prevented."</p>
                          <p>"There are four stages of pressure injuries. In the first stage, the skin might just look red or discolored, and it may feel warm or tender to the touch. If nothing is done, the injury can worsen, leading to the second stage, where the outer layer of skin breaks open, creating a shallow wound or blister."</p>
                          <p>"In the third stage, the injury goes underneath the skin, forming a deeper sore that may expose fat tissue. By this point, the damage is more severe and harder to treat. Finally, in the fourth stage, the injury penetrates even further, reaching muscles, bones, or tendons. At this stage, the wound can be life-threatening if not properly cared for. Preventing these injuries early is very important."</p>
                        </ScriptBlock>

                        <Field label="Do you know where pressure injuries commonly occur? (two most common areas)" value={form.knows_pi_locations} onChange={set('knows_pi_locations')} options={YES_NO_UNABLE} />
                        <ScriptBlock title="Script — if patient doesn't know common locations">
                          <p>"Pressure injuries often develop on bony areas of the body — like the heels, tailbone, hips, and elbows — because these spots have less padding and accumulate more pressure when lying or sitting. The two most common areas are the tailbone (sacrum) and heels."</p>
                        </ScriptBlock>

                        <Field label="Do you know the common risk factors? (at least three)" value={form.knows_pi_risk_factors} onChange={set('knows_pi_risk_factors')} options={YES_NO_UNABLE} />
                        <ScriptBlock title="Script — if patient doesn't know risk factors">
                          <p>"Common risk factors include lack of mobility (bed-bound patients can't easily shift their weight), poor nutrition (lack of protein, vitamins, and minerals weakens skin and delays healing), dehydration (dry, fragile skin is more prone to breakdown), and friction and shear (forces that damage skin during repositioning or transfers)."</p>
                        </ScriptBlock>

                        <Field label="Do you know how to prevent a pressure injury? (three main strategies)" value={form.knows_pi_prevention} onChange={set('knows_pi_prevention')} options={YES_NO_UNABLE} />
                        <ScriptBlock title="Script — if patient doesn't know prevention strategies (S.K.I.N.C.A.R.E.)">
                          <p>"You can help prevent pressure injuries by shifting positions regularly (preferably every 2 hours), keeping your heels elevated with pillows or PRIMO boots, making sure your skin stays clean and dry, and having your skin assessed regularly. Eating well and staying hydrated is also very important to protect skin health."</p>
                          <p className="font-medium">S.K.I.N.C.A.R.E. — Support surfaces, Keep repositioning, Incontinence care, Nutrition and hydration, Check medical devices, Assess risk and skin daily, Reduce head of bed &lt;30° (unless contraindicated), Elevate heels.</p>
                        </ScriptBlock>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <InfoBlock>
            Before leaving, ask if the patient would like to be repositioned — if yes, press the call button and ask for the nurse or PCT. Remind them they can always press the call button for help getting out of bed or repositioning.
          </InfoBlock>

          {error && <p className="text-xs text-status-bad">{error}</p>}
          <p className="text-xs text-text-dim flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 flex-shrink-0" /> Room number is for equipment tracking only — no patient names, MRNs, or other identifiers belong in this form.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-rule space-y-2">
          {formErrors.map((w, i) => (
            <div key={`err-${i}`} className="bg-status-bad-light border border-status-bad rounded px-3 py-2 text-xs text-status-bad flex items-start gap-1.5 font-medium">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {w}
            </div>
          ))}
          {checked && swapWarnings.map((w, i) => (
            <div key={`warn-${i}`} className="bg-status-bad-light border border-rule rounded px-3 py-2 text-xs text-status-bad flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {w}
            </div>
          ))}
          {checked && duplicateCount > 0 && (
            <div className="bg-status-warn-light border border-rule rounded px-3 py-2 text-xs text-status-warn">
              {duplicateCount} audit{duplicateCount === 1 ? ' is' : 's are'} already logged for room {form.room_number || '(blank)'} on {form.audit_date}. Double-check the room number and date before saving — if this really is a second, separate visit, click Save again to confirm.
            </div>
          )}
          <button
            onClick={handleSaveClick}
            disabled={checking || submitting || !form.audit_date || !form.room_number.trim() || formErrors.length > 0}
            className="w-full bg-ink text-paper rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {checking ? 'Checking…' : submitting ? 'Saving…' : formErrors.length > 0 ? 'Fix errors above to save' : (checked && needsConfirm) ? 'Save anyway' : 'Save visit'}
          </button>
        </div>
      </div>
    </div>
  );
}
