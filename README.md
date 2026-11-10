# RootCause Careers — MVP

Evidence-based job-search root-cause diagnostics for UK job seekers and employability providers.

**Evidence Capture → Analysis → Root-Cause Diagnosis → Corrective Action → Outcome Measurement → Engine Improvement**

RootCause Careers is being built as an AI-powered diagnostic platform. In this MVP, diagnoses come from a deterministic **rule-based engine that simulates the planned AI model** (no AI is used), built on the business plan's five mutually exclusive causes: Targeting, Qualification, Positioning, Evidence, Delivery.

All user data is persisted in **Cloud Firestore**, accounts included: Firebase is used for CRUD only, with no Firebase Authentication. Passwords are stored as salted PBKDF2-SHA256 hashes and checked in the browser. Uploaded CV files are read in the browser and only their text is kept. One Cloud Function, `readJobAdvert` (`functions/`), reads a job advert link for **Import from job link** on the Application Tracker.

## Stack

React + TypeScript (Vite), Tailwind, shadcn/ui, React Router, Recharts, Firebase (Firestore only), PapaParse, pdf.js and Mammoth (CV text extraction in the browser), Zod, Vitest, `@firebase/rules-unit-testing`.

## Run against a real Firebase project

1. In the Firebase console for the project, create a **Firestore** database and upgrade to the **Blaze** plan (Cloud Functions need it; the free allowance covers MVP use).
2. `cp .env.example .env` and fill in the `VITE_FIREBASE_*` values. `.env` is git-ignored — never commit it.
3. `npm --prefix functions install`, then deploy the rules and the function: `npx firebase deploy --only firestore:rules,functions`.
4. `npm install && npm run dev`.

## Run locally against the Firebase emulators (no Firebase project needed)

```bash
npm run emulators      # builds functions/, then Firestore on 8181 and Functions on 5401
npm run dev:emulator   # uses .env.emulator (demo-rootcause project)
```

## Tests

```bash
npm test               # engine, CSV, CV extraction, password, legacy-import and job-advert reader tests
npm run test:rules     # Firestore security rules (starts the emulator itself)
npm run build          # type-check + production build
```

## Where things are

| Area | Files |
|---|---|
| Rule-based engine (AI simulation) | `src/engine/` — `config.ts` (keyword lists, weights, thresholds, `ENGINE_VERSION`), `analyse.ts`, `funnel.ts`, `signals.ts`, `diagnose.ts`, `actions.ts`, `evaluate.ts` |
| Sign-in and accounts | `src/lib/password.ts`, `src/services/users.ts`, `src/services/account.ts`, `src/store/SessionContext.tsx` |
| Firestore data access | `src/services/` (`evidence.ts`, `diagnosis.ts`, `career.ts`, `sharing.ts`, `paths.ts`) |
| Real-time data layer | `src/store/CandidateDataContext.tsx` |
| CV upload and extraction | `src/lib/cvExtract.ts`, `src/components/candidate/CvDialog.tsx` |
| Legacy browser-data import | `src/lib/legacyImport.ts`, `src/services/legacy.ts`, `src/components/LegacyImportDialog.tsx` |
| Security rules | `firestore.rules`, tests in `src/rules/` |
| Import from job link | `functions/src/` (`portals.ts` supported sites, `fetchPage.ts` safe fetch, `atsApis.ts` Greenhouse/Lever APIs, `jobPosting.ts` advert parser), `src/services/jobAdverts.ts`, `src/components/candidate/JobLinkDialog.tsx` |
| Sample data | `public/templates/` (fictional worked example for the sample CV/CSV buttons) |

## Data model

Firestore — `accounts/{sha256(email)}` holds each login record (uid, salted password hash); `users/{uid}`, where `uid` is a random id created at registration, holds everything else:

- `users/{uid}` — name, email, account type, organisation, `institutionId` (institution owners), `profile`, `sharing` consent.
- Subcollections: `cvVersions` (with `extractedText`), `applications`, `diagnoses` (immutable snapshots), `actions`, `evaluations`, `engineState/calibration`.
- `institutions/{id}` (owner, name, join code) and `institutions/{id}/members/{candidateUid}` — the summary a candidate consented to share.
- `joinCodes/{code}` — get-only lookup.
Without Firebase Authentication the rules cannot tie a request to a user. They block listing of every top-level collection (records are reached only by exact id), never let a login record be overwritten, keep identity fields unchangeable, accept only the app's own collections, and accept a member summary only while the candidate's record names that institution. Anyone who knows a user's email address can still reach that user's records.

## Key rules

- An application with no reply after **30 days** counts as "No response"; under 30 days it is "Pending" and excluded from rates.
- A diagnosis needs a profile, a CV with ≥ 3 bullets and ≥ 10 decided applications. Primary cause ≥ 0.50, secondary ≥ 0.35 (monitored, not actioned).
- Only primary-cause actions are active; secondary actions are queued until the first change is measured.
- When all active actions are complete, outcomes after that date are compared with the 90 days before it (or the 10 most recent earlier applications) — verdicts: collecting, corroborated, weakened, inconclusive. Verdicts adjust that candidate's class multipliers.

## Migrating from the earlier version

Login records made by earlier versions (`accounts/*`) keep working with their original passwords. The earliest version kept workspaces in the browser: after sign-in, the app offers to import any workspace saved in that browser (`rc-data:*`), keeping document ids and timestamps, verifying the counts, and renaming the browser copy to `rc-data-imported:*` rather than deleting it.

## Import from job link

On the Application Tracker, **Import from job link** takes the link to one public job advert. The `readJobAdvert` function (region `europe-west2`) accepts only supported sites (Reed, Totaljobs, CV-Library, Guardian Jobs, NHS Jobs, Civil Service Jobs, Greenhouse, Lever, Workable, Ashby, SmartRecruiters, LinkedIn, Indeed), refuses internal network addresses, follows at most four redirects, and stops at 10 seconds or 3 MB. It reads Greenhouse and Lever adverts through their public job APIs, other pages through their schema.org `JobPosting` data, NHS Jobs through its page layout, and otherwise the page's title and description tags. It returns only the job fields and stores nothing; the user checks the pre-filled application and saves it to Firestore with `source: "link"` and the `jobUrl`. Sites that block automated reading (often Indeed, sometimes LinkedIn, Totaljobs) get a "Fill in by hand" fallback.
