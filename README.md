# Falls & HAPI Audit — QI Dashboard

A real, multi-user QI dashboard built directly around your actual audit form —
individual room-visit records (not manually-typed percentages), separate
volunteer/admin logins, and 3,095 historical audits already loaded in.

## Before you do anything else

1. **Default admin account**: username `admin`, password `ChangeMe123!`.
   Log in at `/admin` and change it immediately (Change password, next to
   your name).
2. **Loop in your hospital's IT/informatics or security team** before this
   becomes something your committee relies on day to day. This still never
   stores patient names, MRNs, or other identifiers — just room number,
   unit-level equipment/process checks, and two clinical scores (Braden,
   Morse) — but it's a real system with employee logins doing hospital
   quality-reporting work, and most hospitals want a say in that.
3. **Set `JWT_SECRET`** before deploying — see `.env.example`.

## What's in here

- **3,095 real audits imported** from your Google Forms export, of which
  **3,031 fall inside the analyzed range (Sept 2025 – Apr 2026)**. Audits
  outside that window are kept in the database but excluded from every
  chart and table. See `scripts/import_historical.js` to re-run against a
  fresh export.
- **22 tracked metrics** across three categories — Falls Prevention, HAPI
  Prevention, and Patient Education (patient teach-back). Four are
  reference-only and excluded from scoring: shower chair, bedside commode,
  and "already educated today" (which measures staff delivery, not patient
  knowledge).
- **Weighted compliance scores** — metrics count differently toward their
  category score (e.g. bed alarm on and non-slip socks at 3x; fall wristband
  and Posey alarm at 1x). Weights live in `server/metrics.js`.
- **Minimum sample size of 10** — a metric-month with fewer than 10 answered
  audits is omitted rather than plotted, so a single audit can't read as
  "100% compliant."
- **Units tab** — compliance broken out by hospital unit, derived from room
  number (`server/units.js`). Click a unit for its per-metric breakdown and
  month-over-month detail. Unit totals reconcile visibly against the overall
  audit count; anything unmatched is reported rather than dropped.
- **Semester split** — Fall (Sep–Dec) and Spring (Jan–Apr) are shown as
  separate panels, never joined across winter break, since the volunteer
  program goes idle between terms.
- **Add visit** — matches your form's structure (fall-risk and HAPI-risk
  gates reveal their respective sections), with equipment photos, education
  scripts, and hard validation on room numbers and Braden/Morse scores.
- **Target thresholds** (admin) — editable per metric. Patient Education
  deliberately has no targets.
- Location is recorded on only about half of all audits (the question was
  added to the form partway through). Hospital #1 has all the real data;
  Hospital #2 hasn't been audited yet. Trend charts always show the overall
  line, and per-location lines only where that data exists.

## Not in this version yet

- Bulk CSV re-import through the UI (the historical load was a one-time
  script; a fresh Google Forms export won't upload directly yet)
- The deeper statistical/research-angle analysis (e.g., Braden score vs.
  offloading compliance) — the real data now supports this well given the
  sample size, but it's a deliberate next step rather than something rushed
  into this pass

## Running it locally

Requires Node.js 22.5+ (uses Node's built-in SQLite, nothing to compile).

```bash
npm install
npm run build
cp .env.example .env
# edit .env and set JWT_SECRET to any long random string for local testing
npm start
```

Visit `http://localhost:3000/volunteer` or `http://localhost:3000/admin`.

## Putting it on the internet for real

Same guidance as before: you need a host that keeps a Node process running
continuously and preserves a disk between restarts.

- **Render**: Starter plan (~$7/month) with a small persistent disk, `DATA_DIR`
  pointed at the mount path. Free tier does not support persistent disk —
  don't use it for this app once real data is involved.
- **Railway**: Hobby plan (~$5/month) is the comparable option.
- Build command: **must** include `--include=dev` if your platform sets
  `NODE_ENV=production` during the build step, since `esbuild` is a dev
  dependency: `npm install --include=dev && npm run build`.
- Start command: `npm start`.
- Environment variables: `JWT_SECRET` (generate with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
  `NODE_ENV=production`, `DATA_DIR=/data` (or wherever your disk is mounted).

## Project layout

```
server/                       Express API — auth, visits, targets, users
server/metrics.js             Canonical list of 22 tracked metrics, with
                               weights, targets, and exclusion rules
server/units.js               Room-number → hospital unit mapping
server/routes/visits.js       Stats endpoints, validation, quality checks
scripts/import_historical.js  One-time CSV importer, with wording-variant
                               canonicalization and score range validation
client/src/                   React frontend
public/                       Built frontend output (generated by `npm run build`)
public/images/                Equipment reference photos used by the audit form
data/                         SQLite database file lives here at runtime
```

## Data quality

The **Data quality** panel (admin) runs rule-based checks: out-of-range
Braden/Morse scores, likely swapped room-number/score fields, room numbers
matching no known unit, answers contradicting a stated risk level, and
possible duplicate entries. It also reconciles audit counts so you can see
how many records are in scope versus excluded.

The audit form blocks impossible entries outright — room numbers outside
every unit's range, and Braden/Morse scores outside their clinically valid
ranges — both in the browser and again server-side.
