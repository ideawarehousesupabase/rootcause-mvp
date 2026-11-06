# MVP UPGRADE PROMPT — ROOTCAUSE CAREERS LTD

## 0. HOW TO USE THIS PROMPT

This prompt upgrades the existing RootCause Careers **prototype** into the **MVP**.

- **Prototype (already built):** complete visual demonstration, mock data everywhere, Firestore used only for basic account CRUD, user input not saved, results are mock.
- **MVP (to build now):** all mock data removed. Users enter real evidence by **manual input or CSV import**. A **rule-based diagnostic engine** processes that evidence and produces **real-time** results. The rule-based engine imitates how the planned AI model will work. **No AI integration** is done in the MVP. Everything else shows real data.

Keep the existing visual design, layout, page structure, navigation, components and branding. This is an upgrade of behaviour and data, not a redesign.

Work through Section 15 (Implementation Order) step by step. Do not stop at static layouts. Every screen must read from and write to real stored data.

---

## 1. PRODUCT CONTEXT (FROM THE BUSINESS PLAN)

RootCause Careers Ltd is a UK job-search root-cause diagnostic platform. Its core innovation is **not** AI as such. It is:

1. A **root-cause classification taxonomy** that resolves job-search underperformance into **five mutually exclusive causal classes**.
2. **Decision rules** and a **confidence-scoring method** that assign a candidate's evidence to a class.
3. A **closed loop** that checks each diagnosis against what happens after the candidate acts on it.

Workflow:

**Evidence Capture → Analysis → Root-Cause Diagnosis → Corrective Action → Outcome Measurement → Engine Improvement**

The MVP must implement this workflow for real, using a deterministic rule-based engine in place of the future AI model.

### 1.1 The five causal classes (replaces the prototype's six categories)

| Class | Meaning | Funnel stage where it bites |
|---|---|---|
| **Targeting** | Applications aimed at roles misaligned by function, seniority or market saturation. | Application |
| **Qualification** | A genuine credential or competency gap exists. | Application |
| **Positioning** | The capability exists but is not communicated in the CV. | Application |
| **Evidence** | Claims are made without quantified substantiation. | Application |
| **Delivery** | Performance fails at interview rather than at application. | Interview |

The prototype used six categories (Weak Evidence of Impact, Poor Role Targeting, Missing Qualifications, Skills Gaps, Ineffective Communication, Market Competition). Map them as follows and remove the old list everywhere:

- Weak Evidence of Impact → **Evidence**
- Poor Role Targeting → **Targeting**
- Missing Qualifications and Skills Gaps → **Qualification**
- Ineffective Communication → **Delivery**
- **Positioning** → new class (not in the prototype)
- Market Competition → **not a class.** It is outside the candidate's control, so it cannot be one of the mutually exclusive causes. Show it as a separate **"Market context"** panel in the report (Section 7.8). It must never be selected as the primary cause.

### 1.2 Diagnostic output format (from the business plan's worked example)

Each diagnosis returns:

- **Primary class** with a confidence score between 0 and 1 (for example 0.71).
- **Secondary class** with its confidence, labelled "Monitored — not yet actioned".
- A confidence score for **all five classes**.
- A **plain-language rationale** traceable to the specific evidence that produced it.
- **Corrective actions** for the primary class only, sequenced so the effect of one change can be measured before a second is introduced.

---

## 2. STRICT TECHNOLOGY REQUIREMENTS

Keep the prototype stack:

- React with TypeScript (Vite).
- Tailwind CSS and shadcn/ui.
- React Router.
- Lucide React icons.
- Recharts.
- Firebase (modular SDK).

Add only:

- **Firebase Authentication** (email and password).
- **Cloud Firestore** for all MVP data (not only accounts).
- **PapaParse** for CSV parsing.
- **Zod** for input and CSV row validation.
- **Vitest** for unit tests of the engine and CSV import.

Do not use:

- Any AI, LLM or NLP API or library (no OpenAI, Anthropic, Gemini, Hugging Face, TensorFlow.js, compromise, natural, etc.).
- PDF or DOCX text extraction libraries.
- Firebase Storage, Cloud Functions or Realtime Database.
- Supabase, Lovable Cloud or any other backend.
- External job APIs, email tracking, browser extensions.
- Payment gateways.

### 2.1 Why Firebase Authentication replaces the demo login

The prototype's demo login was acceptable because nothing real was stored. The MVP stores real personal data (CVs, applications, recruiter feedback). Firestore security rules can only protect that data if requests carry a verified identity, which requires Firebase Authentication.

- Replace the prototype's demo credential mechanism and the "local demo mode" fallback.
- Remove the built-in demo accounts and the shared demo password.
- Keep the same Register and Login pages and visual design.
- Keep the `users` collection, now keyed by the Firebase Auth `uid`.
- Do not store passwords anywhere in Firestore.
- Show a clear configuration error screen if `VITE_FIREBASE_*` variables are missing.

Environment variables (unchanged):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
```

Do not invent Firebase credentials.

---

## 3. REMOVE ALL MOCK DATA

Delete or empty every mock dataset and every hardcoded value that represents user data:

- The sample candidate seed (applications, CV versions, profile, corrective actions).
- The predefined diagnostic findings and fixed confidence percentages.
- The fictional institutional cohort and monthly cohort series.
- Demo accounts, demo password and local account storage.
- localStorage persistence of candidate business data.

After this step a new account must start **empty**, and every page must show a helpful empty state with a clear next step.

The only fictional content allowed:

- Marketing illustrations on the landing page, clearly labelled "Illustrative example".
- A downloadable **sample CSV** (Section 6.4) that a user may choose to import for demonstration. Once imported it is treated as that user's real data.

---

## 4. USER TYPES AND ACCESS

### 4.1 Candidate

Can create, read, update and delete only their own data. Can optionally share a **summary** with one institution through a join code and explicit consent (Section 9).

### 4.2 Institutional user

Represents a careers service, employability programme, recruitment agency or outplacement provider.

- On registration an `institutions` document is created with this user as owner, plus a unique join code.
- Can see only summaries that candidates have chosen to share with their institution.
- Cannot read or edit any candidate's raw applications, CVs or feedback.
- One owner per institution in the MVP. No multiple advisers, roles or permissions.

No admin panel and no administrator account type.

---

## 5. FIRESTORE DATA MODEL

All timestamps are Firestore `Timestamp`. All dates entered by users (date applied, response date) are stored as `yyyy-mm-dd` strings in the user's local calendar to avoid time-zone shifts.

### 5.1 `users/{uid}`

```ts
{
  uid: string;
  fullName: string;
  email: string;
  accountType: "candidate" | "institutional";
  organisationName: string | null;      // institutional only
  institutionId: string | null;         // institutional only: owned institution
  createdAt: Timestamp;
  privacyAcceptedAt: Timestamp;
  // candidate only
  profile: {
    education: string;
    degreeClassification: "First" | "2:1" | "2:2" | "Third" | "Pass" | "Other" | "None";
    qualifications: string[];            // e.g. ["Microsoft Excel Associate"]
    skills: string[];                    // free tags, normalised to lower case for matching
    yearsExperience: number;             // relevant professional experience, 0–50
    workExperience: string;
    targetRoleFamilies: RoleFamily[];    // 1–3
    targetRoles: string[];
    targetIndustry: string;
    careerBackground: string;
    segment: "Recent graduate" | "International graduate" | "Career changer" | "Experienced professional";
  } | null;
  sharing: { institutionId: string; institutionName: string; consentedAt: Timestamp } | null;
}
```

`RoleFamily` is a fixed list held in one config file. Start with: Business Analysis, Data Analysis, Project Management, Marketing, Finance and Accounting, Software Engineering, HR, Sales, Operations, Policy and Public Sector, Engineering, Other.

### 5.2 `users/{uid}/cvVersions/{cvId}`

```ts
{
  label: string;                         // "CV v2 — Analyst"
  fileName: string | null;               // metadata only, file not uploaded
  fileSize: number | null;
  personalStatement: string;
  experience: { role: string; employer: string; start: string; end: string; bullets: string[] }[];
  skillsSection: string[];
  createdAt: Timestamp;
  analysis: CvAnalysis;                  // computed by the engine on save (Section 7.2)
}
```

The CV's text is entered by the user (paste or type, one bullet per line), or loaded from a `.txt` file. No PDF or DOCX extraction.

### 5.3 `users/{uid}/applications/{appId}`

```ts
{
  jobTitle: string;
  employer: string;
  location: string;
  roleFamily: RoleFamily;
  seniority: "Entry / Graduate" | "Junior" | "Mid" | "Senior" | "Lead / Manager";
  isGraduateScheme: boolean;
  jobDescription: string;                // pasted text
  dateApplied: string;                   // yyyy-mm-dd
  cvVersionId: string;
  status: "Applied" | "Response Received" | "Interview" | "Rejected" | "Offer" | "Withdrawn";
  responseDate: string | null;
  recruiterResponse: string;
  interviewStage: "None" | "Phone screen" | "First interview" | "Assessment centre" | "Final interview";
  interviewOutcome: "Not applicable" | "Awaiting outcome" | "Progressed" | "Unsuccessful" | "Offer made";
  feedback: string;
  source: "manual" | "csv";
  importBatchId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  jdAnalysis: JdAnalysis;                // computed by the engine on save (Section 7.2)
}
```

### 5.4 `users/{uid}/diagnoses/{diagnosisId}`

A diagnosis is an **immutable snapshot**. Never overwrite one; create a new one on each run.

```ts
{
  engineVersion: string;                 // e.g. "rules-1.0.0"
  createdAt: Timestamp;
  inputSummary: { applications: number; decided: number; pending: number; interviews: number; cvVersions: number; feedbackItems: number };
  sufficiency: "sufficient" | "limited" | "insufficient";
  classes: Record<CauseClass, {
    confidence: number;                  // 0–1, two decimals
    signals: { id: string; label: string; value: number; weight: number; contribution: number; evidenceRefs: EvidenceRef[] }[];
  }>;
  primary: CauseClass | null;            // null when no class reaches the threshold
  secondary: CauseClass | null;
  rationale: string;                     // generated text (Section 7.6)
  marketContext: { schemeShare: number; note: string };
  status: "active" | "superseded" | "corroborated" | "weakened" | "inconclusive";
  changesAppliedAt: string | null;       // yyyy-mm-dd, set when primary actions complete
}
```

`EvidenceRef` points at the item that produced a signal: `{ type: "application" | "cvBullet" | "feedback" | "profile"; id: string; excerpt: string }`.

### 5.5 `users/{uid}/actions/{actionId}`

```ts
{
  diagnosisId: string;
  causeClass: CauseClass;
  templateId: string;
  title: string;
  description: string;                   // personalised text
  steps: string[];
  successMeasure: string;
  priority: "High" | "Medium" | "Low";
  status: "Queued" | "To Do" | "In Progress" | "Completed";
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
}
```

`Queued` is used for secondary-class actions that are locked until the primary is evaluated (Section 7.7).

### 5.6 `users/{uid}/evaluations/{evaluationId}`

```ts
{
  diagnosisId: string;
  causeClass: CauseClass;
  metric: "interviewRate" | "interviewToOffer";
  changesAppliedAt: string;
  before: { n: number; rate: number };
  after: { n: number; rate: number };
  verdict: "corroborated" | "weakened" | "inconclusive" | "collecting";
  createdAt: Timestamp;
}
```

### 5.7 `users/{uid}/engineState/calibration`

```ts
{ classMultipliers: Record<CauseClass, number> }   // starts at 1.0 for each class
```

Used to imitate model improvement from the candidate's own outcomes (Section 7.9).

### 5.8 `institutions/{institutionId}`

```ts
{ name: string; ownerUid: string; joinCode: string; createdAt: Timestamp }
```

### 5.9 `joinCodes/{code}`

```ts
{ institutionId: string; institutionName: string }
```

Codes are 8 characters from an unambiguous alphabet (no 0/O/1/I). Readable by `get` only, never listable.

### 5.10 `institutions/{institutionId}/memberSummaries/{candidateUid}`

Written **by the candidate's client** whenever their data changes, only while sharing consent is active. Contains no raw CV text, job descriptions or feedback text.

```ts
{
  candidateUid: string;
  name: string;
  segment: string;
  targetRole: string;
  funnel: { applications: number; responses: number; interviews: number; offers: number; responseRate: number; interviewRate: number; interviewToOffer: number };
  monthly: { month: string; applications: number; responses: number; interviews: number; offers: number }[];
  primaryCause: CauseClass | null;
  secondaryCause: CauseClass | null;
  primaryConfidence: number | null;
  rationale: string | null;
  latestVerdict: "corroborated" | "weakened" | "inconclusive" | "collecting" | null;
  actions: { title: string; causeClass: CauseClass; status: string }[];
  actionsTotal: number;
  actionsCompleted: number;
  lastActivityAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5.11 Firestore security rules

Create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function isSelf(uid) { return signedIn() && request.auth.uid == uid; }
    function institution(id) { return get(/databases/$(database)/documents/institutions/$(id)).data; }
    function userDoc(uid) { return get(/databases/$(database)/documents/users/$(uid)).data; }

    match /users/{uid} {
      allow read, create, update, delete: if isSelf(uid);
      match /{sub=**} {
        allow read, write: if isSelf(uid);
      }
    }

    match /institutions/{instId} {
      allow create: if signedIn() && request.resource.data.ownerUid == request.auth.uid;
      allow read, update, delete: if signedIn() && resource.data.ownerUid == request.auth.uid;

      match /memberSummaries/{candidateUid} {
        allow read: if signedIn() && institution(instId).ownerUid == request.auth.uid;
        allow create, update: if isSelf(candidateUid)
          && userDoc(candidateUid).sharing != null
          && userDoc(candidateUid).sharing.institutionId == instId;
        allow delete: if isSelf(candidateUid) || (signedIn() && institution(instId).ownerUid == request.auth.uid);
      }
    }

    match /joinCodes/{code} {
      allow get: if signedIn();
      allow list: if false;
      allow create: if signedIn() && institution(request.resource.data.institutionId).ownerUid == request.auth.uid;
      allow delete: if signedIn() && institution(resource.data.institutionId).ownerUid == request.auth.uid;
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

The candidate must write `users/{uid}.sharing` **before** creating the member summary.

### 5.12 Real-time reads

Use Firestore `onSnapshot` listeners for the signed-in user's profile, CV versions, applications, diagnoses, actions and evaluations, and for an institution's member summaries. Every chart, KPI and table must update immediately when underlying data changes, without a page refresh.

Replace the prototype's local data context with a context backed by these listeners. Keep the same hook names where practical so pages need minimal change.

---

## 6. EVIDENCE INPUT

### 6.1 Onboarding (new candidate)

After first sign-in, show a short onboarding checklist on the dashboard until complete:

1. Complete your profile (target role families, years of experience, skills, qualifications).
2. Add your CV (at least one version with at least 3 experience bullets).
3. Add applications manually or import a CSV.
4. Run your first diagnosis (enabled once the minimum data is met, Section 7.1).

Each item links to the right page and ticks itself when its condition is met.

### 6.2 CV input

On Evidence Capture → CV evidence:

- **Add CV version** form: label, personal statement, experience entries (role, employer, start, end, bullets — one per line), skills section.
- **Paste CV text** option: a textarea where the user pastes a plain-text CV. Split it into sections using simple heading detection (lines in capitals or matching Profile, Personal statement, Experience, Employment, Education, Skills). Show the result in the structured form for the user to correct before saving. Label this "Basic text splitting — please check".
- **Load .txt file** option using the browser FileReader (plain text only).
- If the user selects a PDF or DOCX, record the filename and size but explain that text must be pasted, because document extraction is not part of the MVP.
- On save, run the CV analysis (Section 7.2.1) and show a per-bullet strength indicator (Strong / Partial / Weak) with the reason, e.g. "No measurable result", "Starts with 'Responsible for'".
- Edit and delete CV versions. Block deletion of a CV version used by applications unless the user reassigns those applications first.

### 6.3 Manual application input

Keep the prototype's application form and add: seniority, graduate scheme toggle, response date, and the six-status list including Withdrawn. Validate with Zod:

- Job title, employer, role family, seniority, date applied and CV version are required.
- Date applied cannot be in the future.
- Response date cannot be before date applied.
- Interview stage other than None requires status Interview, Offer or Rejected.
- Status Offer requires an interview stage.

Keep the prototype's automatic status coherence rules (for example Applied resets interview fields).

### 6.4 CSV import

Add **Import CSV** on Evidence Capture → Job applications and on the Application Tracker.

**Template download:** `applications_template.csv` with these columns:

| Column | Required | Format / allowed values |
|---|---|---|
| job_title | Yes | text |
| employer | Yes | text |
| location | No | text |
| role_family | Yes | one of the RoleFamily list (case-insensitive) |
| seniority | No (default Junior) | Entry / Graduate, Junior, Mid, Senior, Lead / Manager |
| graduate_scheme | No (default no) | yes/no, true/false, y/n |
| date_applied | Yes | YYYY-MM-DD or DD/MM/YYYY |
| cv_version | Yes | label of an existing CV version, or a new label (the import offers to create it as an empty CV version the user must complete) |
| status | No (default Applied) | Applied, Response Received, Interview, Rejected, Offer, Withdrawn |
| response_date | No | YYYY-MM-DD or DD/MM/YYYY |
| recruiter_response | No | text |
| interview_stage | No | None, Phone screen, First interview, Assessment centre, Final interview |
| interview_outcome | No | Not applicable, Awaiting outcome, Progressed, Unsuccessful, Offer made |
| feedback | No | text |
| job_description | No but strongly recommended | text (quoted if it contains commas or line breaks) |

**Import flow:**

1. Upload `.csv` (max 1 MB, max 500 rows).
2. Parse with PapaParse (header row required, UTF-8, trim whitespace).
3. Header mapping step: auto-match columns case-insensitively; let the user map unmatched columns or ignore them.
4. Validate every row with the same Zod schema as manual entry.
5. Preview table with a status per row: Ready, Warning (e.g. no job description — engine accuracy reduced), Error (with the reason and column).
6. Duplicate detection: same employer + job title + date applied as an existing application → flagged "Possible duplicate", skipped by default, user may include it.
7. Import button shows "Import N valid rows". Write in Firestore batches of up to 400.
8. Each imported row stores `source: "csv"` and a shared `importBatchId`.
9. Show an import summary: imported, skipped, failed, plus **Download error report** (CSV of failed rows with an `error` column).
10. **Undo import**: deletes all applications with that `importBatchId`.

**Sample data:** also provide `sample_applications.csv` and a matching sample CV (as pasted text) on the import screen, labelled "Fictional sample for trying the product". Build it from the business plan's worked example: a recent finance graduate, 24 applications over eleven weeks for financial-analyst and investment-analyst roles at mid-sized firms, 22 rejections at application stage, 2 first-round interviews, no offers. The CV describes responsibilities, not outcomes ("assisted with financial reporting", "supported the analysis team"). Job descriptions consistently ask for demonstrated financial modelling and quantified commercial impact.

### 6.5 Recruiter and interview feedback

Keep the prototype's feedback section, now writing to the application document. Add the response date field.

### 6.6 Derived "no response" status

Most applications never get a reply. Do not ask users to mark every silence. Compute it:

- Applied with no response and date applied **30 or more days ago** → treated as **No response** (decided, unsuccessful at application stage).
- Applied with no response and **under 30 days** → **Pending**, excluded from rate denominators.
- Show a "No response (30+ days)" badge in the tracker. Store nothing; it is derived at read time.

---

## 7. RULE-BASED DIAGNOSTIC ENGINE (AI IMITATION)

### 7.0 Principles

- Pure, deterministic TypeScript functions in `src/engine/`. Same input → same output, every time.
- No network calls, no randomness, no AI or NLP libraries.
- All keyword lists, weights and thresholds live in one configuration file (`src/engine/config.ts`) with an `ENGINE_VERSION` constant. Changing any of them bumps the version.
- Every confidence score must be explainable: store each signal's value, weight, contribution and the evidence items that produced it.
- The engine imitates the stages an AI model would perform (understanding text, finding patterns, classifying, explaining, recommending, learning). The UI may show these stages, but must label the engine honestly as **"Rule-based diagnostic engine (AI simulation) — v{version}"**. Never claim results come from an AI model.
- Diagnoses describe **probable** causes. Never state the confirmed reason for an employer's decision.

Suggested files:

```
src/engine/
  config.ts          // lexicons, weights, thresholds, ENGINE_VERSION
  types.ts
  text.ts            // tokenising, normalising, phrase matching
  analyseCv.ts       // 7.2.1
  analyseJd.ts       // 7.2.2
  funnel.ts          // 7.3
  signals/targeting.ts | qualification.ts | positioning.ts | evidence.ts | delivery.ts
  score.ts           // 7.4
  select.ts          // 7.5
  rationale.ts       // 7.6
  actions.ts         // 7.7
  evaluate.ts        // 7.8 closed loop
  calibrate.ts       // 7.9
  index.ts           // runDiagnosis(input) => DiagnosisResult
  __tests__/
```

### 7.1 Minimum data and sufficiency

Before running, check:

- Profile completed (target role families and years of experience set).
- At least one CV version with at least 3 experience bullets.
- At least **10 decided applications** (decided = not Pending, not Withdrawn).

If not met, the Run Diagnosis button is disabled and a checklist shows what is missing.

Sufficiency label on the result:

- **Sufficient:** ≥ 20 decided applications, ≥ 70% have a job description.
- **Limited:** 10–19 decided applications, or < 70% with job descriptions.
- Show "Limited evidence — confidence reduced" on limited results. Multiply all confidences by 0.85 when limited.

### 7.2 Stage 1 — Text understanding (imitates NLP)

Use normalised lower-case text, punctuation stripped, simple word and phrase matching. Store the results on the document when it is saved so diagnoses are fast.

#### 7.2.1 CV analysis (`analyseCv`)

For each experience bullet compute:

- `quantified`: contains a number, %, £, $, "x" multiplier, or a quantity word followed by a unit (e.g. "3 hours", "15 people", "£2k", "20%").
- `weakOpening`: starts with a weak phrase from config, initial list: responsible for, helped, helped with, assisted, assisted with, involved in, supported, worked on, duties included, tasked with, participated in, in charge of.
- `strongVerb`: starts with a strong action verb from config, initial list: delivered, reduced, increased, improved, built, designed, launched, led, created, automated, saved, grew, cut, negotiated, implemented, analysed, streamlined, achieved, generated, won.
- `outcomeWord`: contains reduced, increased, improved, saved, grew, cut, achieved, generated, raised, lowered, from … to.
- Strength: **Strong** = quantified and (strongVerb or outcomeWord); **Partial** = quantified or strongVerb; **Weak** = otherwise.

CV-level analysis:

- `bulletCount`, `quantifiedRatio`, `weakOpeningRatio`, `strongRatio`.
- `mentionedSkills`: skills lexicon terms found anywhere in the CV text.
- `genericStatement`: personal statement contains generic phrases from config (hard-working, motivated, team player, exciting opportunity, passionate, excellent communication skills, results-driven, go-getter) **or** names two or more role families.

#### 7.2.2 Job description analysis (`analyseJd`)

- `requiredSkills` / `desirableSkills`: skills lexicon terms; a term is "required" if its sentence contains required, essential, must, minimum, you will have, proven; otherwise "desirable".
- `requiredQualifications`: qualification lexicon terms in a required sentence (initial list: CIMA, ACCA, ACA, CIPD, PRINCE2, APM, PMP, CFA, chartered, degree in, 2:1, first-class, driving licence, security clearance, QTS, NMC).
- `minYears`: from patterns like "3+ years", "minimum 2 years", "at least 5 years".
- `impactDemand`: contains any of measurable, quantified, track record, demonstrable, proven results, evidence of impact, delivered results, commercial impact.
- `keywords`: top 15 skills and role terms in the JD.

Skills lexicon: a config map from role family to 20–40 skill terms, plus a shared list (Excel, SQL, Python, Power BI, Tableau, stakeholder management, project management, financial modelling, forecasting, budgeting, reporting, CRM, SEO, Google Analytics, Agile, Scrum, Jira, requirements gathering, process mapping, data analysis, presentation skills, negotiation, customer service, recruitment, payroll, compliance, risk management, AutoCAD, Java, JavaScript, React, cloud, AWS, Azure). Matching is case-insensitive, whole-word, and supports simple synonyms in config (e.g. "powerbi" → "power bi", "ms excel" → "excel").

### 7.3 Stage 2 — Pattern analysis across applications (imitates pattern recognition)

From all applications compute funnel metrics with the Section 6.6 rules:

- `decided`, `responses` (status ≠ Applied/Withdrawn, or response date set), `interviews` (interview stage ≠ None or status Interview/Offer), `offers`.
- `responseRate = responses / decided`, `interviewRate = interviews / decided`, `interviewToOffer = offers / interviews` (finished interviews only).
- Breakdowns by role family, seniority, CV version and month.
- `familyCount`, `familyConcentration` (share of the largest family).
- `offTargetShare`: share of decided applications whose role family is not in `profile.targetRoleFamilies`.
- `seniorityMismatchShare`: share where `jdAnalysis.minYears > profile.yearsExperience + 1`, or seniority is Senior or Lead / Manager while `yearsExperience < 3`.
- `schemeShare`: share of applications with `isGraduateScheme`.
- Feedback signals: for each class, count feedback and recruiter-response texts containing that class's feedback lexicon (config), e.g.
  - Evidence: measurable, results, achievements, impact, evidence of, examples of results.
  - Qualification: qualification, qualified, certification, CIMA, ACCA, degree requirement, experience requirement, technical skills.
  - Targeting: overqualified, underqualified, seniority, more experienced, not the right fit for the level, high volume of applications.
  - Positioning: not clear how, did not demonstrate, unclear relevance, transferable.
  - Delivery: lacked examples, too general, not structured, STAR, communication, confidence, presentation, nervous, answers.

### 7.4 Stage 3 — Class scoring (imitates classification)

Each class has signals `s` in the range 0–1 with weights `w` that sum to 1 for that class.

```
raw(class)        = Σ (w × s)
calibrated(class) = 0.10 + 0.70 × raw(class)
confidence(class) = round2( calibrated × sufficiencyFactor × classMultiplier(class) ), capped at 0.95
```

`linear(x, a, b)` means 0 at or below a, 1 at or above b, straight line between.

**Targeting**

| Signal | Value | Weight |
|---|---|---|
| T1 Spread across role families | familyCount: 1→0, 2→0.35, 3→0.7, ≥4→1 | 0.30 |
| T2 Off-target applications | offTargetShare | 0.25 |
| T3 Seniority mismatch | seniorityMismatchShare | 0.25 |
| T4 Saturated routes | linear(schemeShare, 0.3, 0.8) | 0.10 |
| T5 Uneven family progression | spread between best and worst family interview rate (families with ≥ 3 decided): linear(spread, 0.10, 0.35) | 0.10 |

**Qualification**

| Signal | Value | Weight |
|---|---|---|
| Q1 Missing required qualification | share of JDs with a required qualification not in profile.qualifications | 0.40 |
| Q2 Missing required skills | average share of JD required skills found in neither profile.skills nor CV mentionedSkills | 0.30 |
| Q3 Qualification feedback | min(1, qualification feedback count / 2) | 0.20 |
| Q4 Degree threshold | share of JDs requiring 2:1 or First where the profile classification is below it | 0.10 |

**Positioning**

| Signal | Value | Weight |
|---|---|---|
| P1 Hidden capability | average share of JD required skills present in profile.skills or workExperience but **absent from the CV** used for that application | 0.40 |
| P2 Generic personal statement | CV genericStatement → 1, else 0 | 0.20 |
| P3 Untailored CV | the same CV version used across ≥ 3 role families → 1; 2 families → 0.5 | 0.20 |
| P4 Low keyword coverage | 1 − average share of JD keywords present in the CV | 0.20 |

**Evidence**

| Signal | Value | Weight |
|---|---|---|
| E1 Unquantified experience | 1 − quantifiedRatio of the CV version used most | 0.40 |
| E2 Responsibility phrasing | weakOpeningRatio | 0.15 |
| E3 Roles demand impact | share of JDs with impactDemand | 0.20 |
| E4 Evidence feedback | min(1, evidence feedback count / 2) | 0.10 |
| E5 Application-stage failure | 1 − linear(interviewRate, 0.10, 0.30). Use the interview rate, not the response rate: rejection emails count as responses, so only progression to interview shows whether the CV is getting through screening. | 0.15 |

**Delivery** (only assessable with at least 1 finished interview; otherwise confidence 0 and labelled "Not assessable — no interviews yet")

| Signal | Value | Weight |
|---|---|---|
| D1 Interview failure | unsuccessful finished interviews / finished interviews | 0.45 |
| D2 Delivery feedback | min(1, delivery feedback count / 2) | 0.25 |
| D3 Getting to interview | linear(interviewRate, 0.05, 0.15) — Delivery matters most when applications already convert | 0.30 |

Small-sample rule for Delivery: if finished interviews < 3, multiply raw by 0.75 and add the note "Small sample — held for review".

Reference calculation for the business-plan worked example (24 decided, 2 interviews both unsuccessful, all bullets unquantified and duty-based, all JDs ask for impact, one role family): Evidence raw ≈ 0.90 → confidence ≈ 0.73; Delivery raw ≈ 0.55 × 0.75 ≈ 0.41 → confidence ≈ 0.39; Targeting raw ≈ 0 → confidence ≈ 0.10. This matches the plan's example (Evidence 0.71 primary, Delivery 0.44 secondary) within the test tolerances.

Tune the weights only through `config.ts`. The tests in Section 7.10 must pass with the final values.

### 7.5 Stage 4 — Selection

- **Primary:** highest confidence, if ≥ **0.50**.
- **Tie-break** (within 0.05): choose the class whose failure happens earliest in the funnel, in this order: Targeting → Qualification → Positioning → Evidence → Delivery. Fix the earliest bottleneck first.
- **Secondary:** next highest, if ≥ **0.35**, labelled "Monitored — not yet actioned".
- **No dominant cause:** if no class reaches 0.50, set primary to null. Show the top two as hypotheses and tell the user which evidence to add (more applications, job descriptions, interview feedback).
- Delivery can only be primary with at least 2 finished interviews.

### 7.6 Stage 5 — Rationale (imitates natural-language explanation)

Generate the rationale from templates filled with real values, citing the strongest signals. Never output a sentence that is not backed by a computed value. Examples:

- Evidence: "{unquantified} of {bullets} experience statements in '{cvLabel}' describe duties without a measurable result, and {impactShare}% of your target job descriptions ask for demonstrated, quantified impact. With only {interviewRate}% of {decided} decided applications reaching interview, the most probable constraint is at application screening: the CV is not substantiating your capability."
- Targeting: "Your {decided} decided applications are spread across {familyCount} role families, and {offTarget}% fall outside your target families ({targets}). {seniorityShare}% ask for more experience than your {years} years."
- Delivery: "{interviews} applications reached interview but {unsuccessful} ended unsuccessfully. {feedbackQuote}"
- Secondary note: "{secondaryClass} ({secondaryConfidence}) is being monitored but not actioned yet, so the effect of the first change can be measured on its own."

Each rationale sentence must link to the evidence items behind it (click to open the application, CV bullet or feedback).

### 7.7 Stage 6 — Corrective action generation (imitates AI recommendations)

An action library in config with 3–4 templates per class. Each template has a title, a personalised description using slots, steps, a success measure and a priority. Examples:

- **Evidence:** "Rewrite your {weakCount} weakest CV bullets" — lists the actual weak bullets from the CV with the reason for each and a pattern: action verb + what you did + measurable result. Success measure: application-to-interview rate over the next 8 decided applications.
- **Evidence:** "Lead with quantified achievements" — move the 3 strongest bullets to the top of each role.
- **Positioning:** "Add skills you hold but don't show" — lists skills found in the profile but missing from the CV that appear in {n} of your job descriptions.
- **Positioning:** "Create a targeted CV for {topFamily}" — rewrite the personal statement for one role family.
- **Targeting:** "Focus on {bestFamilies}" — the families with the best response rates and their numbers.
- **Targeting:** "Apply at your level" — filter out roles asking for more than {years + 1} years.
- **Qualification:** "Plan a route to {missingQualification}" — named from JDs, with how often it was required.
- **Qualification:** "Close the {missingSkill} gap" — the most frequent missing required skills.
- **Delivery:** "Prepare STAR examples for {competencies}" — competencies taken from interview feedback.
- **Delivery:** "Log a reflection after each interview" — what was asked and how you answered.

Sequencing (from the business plan):

- Only the **primary** class's actions are created as To Do.
- The **secondary** class's actions are created as **Queued** and locked, with the message: "Held until your first change has been measured, so the two effects aren't mixed."
- When all primary actions are Completed, set the diagnosis `changesAppliedAt` to the latest completion date and start evaluation (7.8).
- Re-running a diagnosis marks the previous one `superseded` and archives its open actions (kept, read-only).

### 7.8 Stage 7 — Outcome measurement (closed loop)

Metric per class:

- Targeting, Qualification, Positioning, Evidence → application-to-interview rate (the business plan's measure; rejection emails would inflate a response rate).
- Delivery → interview-to-offer rate (or progression past first interview).

Before window: decided applications in the 90 days before `changesAppliedAt`; if fewer than 10, use the 10 most recent decided applications before it. After window: decided applications dated on or after `changesAppliedAt`.

Verdict:

- **Collecting:** fewer than 8 decided applications after (Delivery: fewer than 3 finished interviews after). Show progress "5 of 8 applications needed".
- **Corroborated:** after rate − before rate ≥ 0.10 **and** after rate ≥ 1.5 × before rate.
- **Weakened:** after rate − before rate < 0.03.
- **Inconclusive:** anything else.

On a verdict:

- Corroborated → diagnosis status corroborated; prompt the user to re-run to find the next constraint.
- Weakened → diagnosis status weakened; unlock the secondary class's queued actions **or** suggest re-running; apply calibration (7.9).
- Inconclusive → keep collecting or allow re-run.

Always display: "This comparison is indicative. Sample sizes are small and other factors (timing, vacancies) also change, so it cannot prove the change caused the result."

Market context panel: show `schemeShare` and number of graduate-scheme applications with the note: "High-volume graduate schemes are very competitive. This is context outside your control and is not treated as a root cause."

### 7.9 Stage 8 — Engine improvement (imitates model learning)

Per candidate, in `engineState/calibration`:

- Corroborated verdict for class X → `classMultipliers[X] = min(1.15, current × 1.05)`.
- Weakened verdict for class X → `classMultipliers[X] = max(0.70, current × 0.85)`.
- Show on the Diagnostics page: "Engine adjusted from your outcomes: Evidence ×1.05" with an explanation.

Cross-user learning is out of scope for the MVP (it needs trusted server-side aggregation).

### 7.10 Engine tests (Vitest) — required

1. **Business-plan worked example** (the sample CSV and CV): primary = Evidence with confidence 0.60–0.80; secondary = Delivery with confidence 0.35–0.50 and the small-sample note; Targeting < 0.30; Qualification < 0.45.
2. **Targeting case:** 25 applications across 4 role families, 60% off-target, low response → primary Targeting.
3. **Qualification case:** 20 finance applications where 16 JDs require CIMA/ACCA, profile lacks them, 2 feedback items mention qualification → primary Qualification.
4. **Positioning case:** profile lists SQL, Power BI and stakeholder management; JDs require them; CV text omits them; bullets mostly quantified → primary Positioning.
5. **Delivery case:** 20 applications, 6 interviews, 6 unsuccessful, feedback "answers lacked structure" → primary Delivery.
6. **Insufficient data:** 6 decided applications → not runnable.
7. **No dominant cause:** balanced weak signals → primary null.
8. **Determinism:** running twice on the same input gives identical output.
9. **Evaluation verdicts:** fixtures for collecting, corroborated, weakened and inconclusive.
10. **CSV import:** date formats, invalid enum, missing required field, duplicate detection, 500-row limit.

---

## 8. PAGE-BY-PAGE CHANGES

Keep every prototype page and route. Replace mock behaviour as below.

### 8.1 Landing page

Keep. Update the "How it works" and capability text to the five causal classes. Label the hero preview "Illustrative example". Keep pricing as display only (no payments).

### 8.2 Register

- Firebase Authentication `createUserWithEmailAndPassword`.
- Create `users/{uid}`.
- Institutional: also create `institutions/{id}` and `joinCodes/{code}`, set `institutionId` on the user.
- Required privacy checkbox: "I agree that RootCause Careers stores the job-search information I enter to provide diagnostics." Store `privacyAcceptedAt`.
- Keep existing validation (password ≥ 8 chars with a letter and a number, matching confirm).
- Map Firebase errors to friendly messages (email already in use, weak password, network error).

### 8.3 Login

- `signInWithEmailAndPassword`; read `users/{uid}`; route by `accountType`.
- Add **Forgot password** using `sendPasswordResetEmail` (Firebase's built-in email). This replaces the prototype rule against password reset because real accounts now exist.
- Remove the demo account buttons and demo banner.
- Session handled by Firebase Auth persistence; logout uses `signOut`.

### 8.4 Candidate Dashboard

All six KPIs computed from real applications using the Section 7.3 definitions. Show:

- Onboarding checklist until complete.
- **Latest diagnosis card:** primary class, confidence, one-line rationale, sufficiency, status (active / corroborated / weakened…), "New evidence since this diagnosis — re-run" badge when applications or CVs changed after `createdAt`.
- Corrective actions: active count, completed, percentage, next action.
- Job-search activity chart by month (applications, responses, interviews).
- Recent applications table.
- **Nudges panel** (in-app only): applications Pending past 21 days without update, interviews awaiting an outcome, actions In Progress over 21 days, evaluation progress ("3 more applications needed to measure your change").

### 8.5 My Profile

Saved to `users/{uid}.profile`. Add structured fields: degree classification, qualifications (tags), skills (tags with lexicon suggestions), years of experience, target role families (multi-select, 1–3), segment. Explain which fields the engine uses.

### 8.6 Evidence Capture

Section 6 in full: CV versions with analysis, manual applications, CSV import, feedback. Show per-application JD analysis ("Requires: SQL, Power BI · Asks for measurable impact · 2+ years").

### 8.7 Application Tracker

Real CRUD on Firestore. Keep filters, search, inline status change, details, edit, delete, feedback. Add:

- Derived Pending / No response badges.
- Filter by role family, CV version, source (manual / CSV), import batch.
- Bulk select → change status, delete.
- Export applications to CSV (same columns as the template).
- Undo import from the import history list.

### 8.8 Root-Cause Diagnostics

- **Run Diagnosis** button (disabled with checklist if minimum data is not met).
- Staged progress that reflects the real engine stages: "Analysing CV statements → Reading job descriptions → Comparing applications → Scoring five causal classes → Generating rationale and actions". Each stage shows a real count (e.g. "Read 24 job descriptions").
- Result: primary card (class, confidence, rationale with evidence links), secondary card (monitored), five-class confidence chart, per-class expandable **signal breakdown table** (signal, value, weight, contribution, evidence), sufficiency badge, market context panel, engine version, calibration notes.
- **Diagnosis history:** list of past diagnoses with date, primary class, confidence, status and verdict. Open any past one read-only.
- "View Action Plan" button.
- Labels: "Rule-based diagnostic engine (AI simulation)", "Probable cause — not a confirmed employer reason".

### 8.9 Corrective Action Plan

- Actions from the active diagnosis, grouped as **Active** (primary class) and **Queued** (secondary, locked with explanation).
- Status changes To Do / In Progress / Completed write `startedAt` / `completedAt`.
- Overall completion for the active diagnosis.
- When all active actions are complete: banner "Changes applied on {date}. Keep logging applications — we'll measure the effect after 8 more decided applications."
- Archived actions from superseded diagnoses in a collapsed read-only section.

### 8.10 Progress Analytics

All computed from real data:

- KPIs: total applications, application-to-response, application-to-interview, interview-to-offer.
- Outcomes over time (monthly).
- Response rate by role family, by CV version, by seniority.
- Action completion chart.
- **Closed-loop panel:** Initial outcomes → Diagnosis (primary class) → Actions completed (date) → Subsequent outcomes, using the real before/after windows from 7.8, with the verdict and progress indicator.
- Causation disclaimer from 7.8.

### 8.11 Institutional Dashboard

Keep the three tabs (Cohort Overview, Candidate Insights, Reports). All data comes from `memberSummaries` via a real-time listener.

- **Header:** institution name and **join code** with Copy button and "How candidates join" instructions. Regenerate code option (deletes the old `joinCodes` doc, creates a new one).
- **Empty state** until a candidate joins.
- **Cohort Overview:** total candidates, active (activity in last 30 days), applications, interviews, offers, common barriers chart (primary and secondary class counts).
- **Candidate Insights:** table (name, segment, target role, applications, interviews, primary cause, confidence, action completion, last activity) with search; read-only summary dialog showing funnel, monthly chart, primary/secondary cause, rationale, latest verdict and action statuses. Remove candidate from cohort (deletes the summary).
- **Reports:** cause-class distribution, cohort conversion rates, monthly cohort progress (sum of member `monthly`), action completion by candidate, barrier summary table, verdict distribution, **Export CSV** of the aggregated table, Print.

### 8.12 Account panel (sidebar)

Keep the prototype's account dialog and add:

- Edit name (and organisation name for institutional users).
- **Institution sharing (candidate):** enter join code → shows institution name → explicit consent checkbox describing exactly what is shared (summary metrics, causes, rationale, action titles — not CV text, job descriptions or feedback text) → Share. Withdraw sharing deletes the member summary and clears `sharing`.
- **Export my data:** downloads a JSON file of the profile, CV versions, applications, diagnoses, actions and evaluations, plus applications as CSV.
- **Delete account:** confirmation, re-authentication if Firebase requires it, delete all subcollection documents in batches, the member summary if shared, the user document, then the Firebase Auth user. For institutional users also delete the institution, its join code and member summaries.
- Remove "Reset demo data".

---

## 9. MEMBER SUMMARY SYNC

Create one function `syncMemberSummary(uid)` that builds the Section 5.10 document from the candidate's current data and writes it to `institutions/{sharing.institutionId}/memberSummaries/{uid}`.

Call it (debounced 2 seconds) after any change to applications, actions or diagnoses, and after evaluation verdicts, **only when `sharing` is set**. Call it once immediately when sharing is first granted.

---

## 10. SHARED METRIC DEFINITIONS

All pages must use one module (`src/lib/metrics.ts` or `src/engine/funnel.ts`) for funnel definitions. No page may compute rates its own way. The dashboard, tracker header, analytics, diagnostics and member summary must always show identical numbers for the same data.

---

## 11. UX, STATES AND RESILIENCE

- Every list and chart has loading, empty and error states.
- Firestore writes show optimistic updates with toast confirmation; failures roll back with an error toast.
- Disable buttons while saving; prevent double submission.
- Offline: show a small "Offline — changes will sync" indicator (Firestore offline persistence enabled).
- Accessibility: labelled inputs, keyboard-usable dialogs and tables, colour not the only status indicator.
- Responsive at 375px with no horizontal page scroll (tables scroll inside their card).
- UK English and UK date format (e.g. 3 Nov 2026) throughout.

---

## 12. PRIVACY AND HONESTY REQUIREMENTS

- Privacy notice page linked from Register and the footer, plain English: what is stored, why, who can see it (only the user, plus an institution's summary if the user consents), how to export and delete.
- Data minimisation: institutions see summaries only.
- No candidate data is used for anything outside that candidate's own diagnostics.
- The engine is always labelled rule-based (AI simulation).
- Diagnoses are always "probable", never "the reason you were rejected".
- Before/after comparisons always carry the causation disclaimer.

---

## 13. FEATURES THAT MUST NOT BE BUILT

- AI, LLM, NLP or machine-learning models or APIs.
- PDF/DOCX CV parsing.
- Payments, subscription billing or plan gating.
- Email tracking, browser extensions, job-board integrations, push notifications or outbound emails (except Firebase's built-in password reset).
- Coaching chat or appointment booking.
- Admin panel, multiple advisers per institution, roles and permissions beyond owner.
- White-label configuration.
- Cross-user model training or global analytics.
- Any feature outside the diagnostic workflow.

---

## 14. FUNCTIONAL ACCEPTANCE CRITERIA

**Candidate journey (empty account):**

Register → Login → see onboarding checklist → complete profile → add a CV (pasted text) and see bullet strengths → import the sample CSV (preview, validation, import summary) → add one application manually → dashboard KPIs reflect exactly the imported and manual data → run diagnosis → see Evidence as primary with confidence, Delivery as monitored secondary, rationale with working evidence links, signal breakdown → action plan shows active Evidence actions naming the actual weak bullets and queued Delivery actions → mark actions complete → analytics shows "collecting" with progress → add 8 more decided applications with better outcomes → verdict appears (corroborated) and calibration note shows → re-run diagnosis creates a new snapshot; history shows both.

**Institutional journey:**

Register institutional → see empty dashboard and join code → a candidate enters the code and consents → candidate appears in real time with correct metrics and primary cause → candidate changes an application status → institutional view updates within seconds → candidate withdraws sharing → candidate disappears.

**Data and security:**

- No mock data appears anywhere for a new account.
- Refreshing any page shows the same data (persisted in Firestore).
- A second candidate account cannot read the first candidate's data (verify with the Firestore emulator or rules playground).
- An institution cannot read raw applications or CVs.
- Export downloads complete data; Delete removes everything including the Auth user.
- All Vitest tests in 7.10 pass; `npm run build` passes with no TypeScript errors.

---

## 15. IMPLEMENTATION ORDER

1. **Firebase Auth and data layer:** Auth, `users/{uid}`, security rules, real-time context replacing the mock data context. Remove demo login, local mode and all mock datasets. Add empty states.
2. **Profile and CV evidence:** structured profile, CV versions with paste/.txt input and `analyseCv`.
3. **Applications:** manual entry with Zod validation, `analyseJd`, derived Pending/No response, tracker CRUD on Firestore.
4. **CSV import:** template, parsing, mapping, validation, preview, duplicates, batch write, error report, undo, export, sample CSV.
5. **Engine:** funnel, signals, scoring, selection, rationale, with the Section 7.10 tests passing.
6. **Diagnostics page:** run, staged progress, results, history.
7. **Actions:** generation, sequencing (active/queued), status timestamps.
8. **Closed loop:** evaluation, verdicts, calibration, analytics panel.
9. **Institutions:** join codes, consent, member summary sync, institutional dashboard on real data.
10. **Account:** export, delete, sharing management, privacy page, password reset.
11. **Polish and verification:** dashboard nudges, consistency check across pages, responsive check, accessibility pass, full acceptance run.

---

## 16. FINAL INSTRUCTION

Build the MVP strictly around the business plan's central innovation: **connected job-search evidence, classified into one of five mutually exclusive causes by transparent rules with confidence scores, turned into sequenced corrective actions, and checked against what happens next.**

Remove every trace of mock data. Every number on every screen must come from what the user entered or imported. The rule-based engine must behave like the future AI model — staged analysis, a classified cause, a confidence score, an explanation, recommendations and learning from outcomes — while being honestly labelled as rule-based.
