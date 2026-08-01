import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

const YES_NO = [['', 'Select...'], ['yes', 'Yes'], ['no', 'No']];
const YES_NO_NA = [...YES_NO, ['not_applicable', 'Not applicable']];
const YES_NO_UNABLE = [...YES_NO, ['unable_to_assess', 'Unable to assess']];
const YES_NO_NA_UNABLE = [...YES_NO, ['not_applicable', 'Not applicable'], ['unable_to_assess', 'Unable to assess']];

function Field({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, hint }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}{hint ? ` (${hint})` : ''}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1"
      />
    </div>
  );
}

const initialForm = {
  audit_date: new Date().toISOString().slice(0, 10),
  location: '', room_number: '', hand_hygiene_in: '', hand_hygiene_out: '',
  is_fall_risk: '', morse_score: '', tips_board_correct: '', bed_alarm_on: '',
  bed_alarm_cord_plugged: '', call_light_reach: '', fall_wristband: '', non_slip_socks: '',
  gait_belt_present: '', walker_present: '', posey_alarm_present: '', posey_alarm_charged: '',
  shower_chair_present: '', bedside_commode_present: '',
  is_hapi_risk: '', braden_score: '', purple_wedges: '', specialty_bed_yn: '', specialty_bed_type: '',
  turned_with_wedges: '', turned_in_chair: '', heels_offloaded: '', primo_boots: '', turned_recently: '',
  needs_hapi_education: '', knows_what_pi_is: '', knows_pi_risk_factors: '', knows_pi_locations: '',
  knows_pi_prevention: '', already_educated_today: '', patient_refused_education: '',
};

export default function AddVisitModal({ onClose, onSave, error }) {
  const [form, setForm] = useState(initialForm);
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Add a room-visit audit</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Visit basics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Date of audit</label>
                <input type="date" value={form.audit_date} onChange={(e) => set('audit_date')(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <Field label="Location" value={form.location} onChange={set('location')}
                options={[['', 'Select...'], ['Dell Seton Medical Center', 'Dell Seton Medical Center'], ['Ascension Seton Medical Center', 'Ascension Seton Medical Center']]} />
              <div>
                <label className="text-xs text-slate-500">Room number</label>
                <input value={form.room_number} onChange={(e) => set('room_number')(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <Field label="Hand hygiene before entering" value={form.hand_hygiene_in} onChange={set('hand_hygiene_in')} options={YES_NO} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Field label="Is the patient a fall risk?" value={form.is_fall_risk} onChange={set('is_fall_risk')} options={YES_NO} />
          </div>

          {form.is_fall_risk === 'yes' && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Fall prevention</h4>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Morse Fall Risk Score" value={form.morse_score} onChange={set('morse_score')} min={0} max={125} hint="0-125" />
                <Field label="TIPS board correct" value={form.tips_board_correct} onChange={set('tips_board_correct')} options={YES_NO} />
                <Field label="Bed alarm on" value={form.bed_alarm_on} onChange={set('bed_alarm_on')} options={YES_NO} />
                <Field label="Bed alarm cord plugged in" value={form.bed_alarm_cord_plugged} onChange={set('bed_alarm_cord_plugged')} options={YES_NO} />
                <Field label="Call light within reach" value={form.call_light_reach} onChange={set('call_light_reach')} options={YES_NO} />
                <Field label="Fall-risk wristband on" value={form.fall_wristband} onChange={set('fall_wristband')} options={YES_NO} />
                <Field label="Non-slip socks on" value={form.non_slip_socks} onChange={set('non_slip_socks')} options={YES_NO} />
                <Field label="Gait belt in room" value={form.gait_belt_present} onChange={set('gait_belt_present')} options={YES_NO} />
                <Field label="Walker in room" value={form.walker_present} onChange={set('walker_present')} options={YES_NO} />
                <Field label="Posey alarm in room" value={form.posey_alarm_present} onChange={set('posey_alarm_present')} options={YES_NO} />
                <Field label="Posey alarm charged" value={form.posey_alarm_charged} onChange={set('posey_alarm_charged')} options={[...YES_NO, ['not_in_room', 'Not in room']]} />
                <Field label="Shower chair in bathroom" value={form.shower_chair_present} onChange={set('shower_chair_present')} options={YES_NO} />
                <Field label="Bedside commode in bathroom" value={form.bedside_commode_present} onChange={set('bedside_commode_present')} options={YES_NO} />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <Field label="Is the patient at risk of developing a pressure injury?" value={form.is_hapi_risk} onChange={set('is_hapi_risk')} options={YES_NO} />
          </div>

          {form.is_hapi_risk === 'yes' && (
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-teal-700 uppercase tracking-wide">HAPI prevention</h4>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Braden Score" value={form.braden_score} onChange={set('braden_score')} min={6} max={23} hint="6-23" />
                <Field label="Purple wedges present" value={form.purple_wedges} onChange={set('purple_wedges')}
                  options={[['', 'Select...'], ['yes', 'Yes (two)'], ['no', 'No (fewer than two)'], ['other', 'Other (more than two)']]} />
                <Field label="On a specialty bed" value={form.specialty_bed_yn} onChange={set('specialty_bed_yn')} options={YES_NO} />
                <Field label="Specialty bed type" value={form.specialty_bed_type} onChange={set('specialty_bed_type')}
                  options={[['', 'Select...'], ['not_applicable', 'Not applicable'], ['arjo', 'Arjo'], ['icu', 'ICU'], ['envella', 'Envella']]} />
                <Field label="Positioned with wedges" value={form.turned_with_wedges} onChange={set('turned_with_wedges')}
                  options={[['', 'Select...'], ['yes', 'Yes'], ['no', 'No'], ['sitting_in_chair', 'Sitting in chair'], ['not_applicable', 'Not applicable']]} />
                <Field label="If sitting, turned on side" value={form.turned_in_chair} onChange={set('turned_in_chair')} options={YES_NO_NA} />
                <Field label="Heels offloaded properly" value={form.heels_offloaded} onChange={set('heels_offloaded')} options={YES_NO_NA} />
                <Field label="PRIMO boots on" value={form.primo_boots} onChange={set('primo_boots')} options={YES_NO_NA} />
                <Field label="Turned within past 2 hours" value={form.turned_recently} onChange={set('turned_recently')} options={YES_NO_NA} />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Patient education (optional)</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Needs HAPI prevention education" value={form.needs_hapi_education} onChange={set('needs_hapi_education')} options={YES_NO} />
              <Field label="Refused education" value={form.patient_refused_education} onChange={set('patient_refused_education')} options={YES_NO} />
              <Field label="Knows what a pressure injury is" value={form.knows_what_pi_is} onChange={set('knows_what_pi_is')} options={YES_NO_NA_UNABLE} />
              <Field label="Knows risk factors" value={form.knows_pi_risk_factors} onChange={set('knows_pi_risk_factors')} options={YES_NO_UNABLE} />
              <Field label="Knows common locations" value={form.knows_pi_locations} onChange={set('knows_pi_locations')} options={YES_NO_UNABLE} />
              <Field label="Knows prevention strategies" value={form.knows_pi_prevention} onChange={set('knows_pi_prevention')} options={YES_NO_UNABLE} />
              <Field label="Already educated today" value={form.already_educated_today} onChange={set('already_educated_today')} options={YES_NO_UNABLE} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Field label="Hand hygiene after exiting" value={form.hand_hygiene_out} onChange={set('hand_hygiene_out')} options={YES_NO} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs text-slate-400 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 flex-shrink-0" /> Room number is for equipment tracking only — no patient names, MRNs, or other identifiers belong in this form.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          <button onClick={() => onSave(form)} className="w-full bg-slate-800 text-white rounded-lg py-2 text-sm font-medium">
            Save visit
          </button>
        </div>
      </div>
    </div>
  );
}
