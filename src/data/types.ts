import type { Timestamp } from "firebase/firestore";

// ---------- Fixed vocabularies ----------
export const ROLE_FAMILIES = [
  "Business Analysis",
  "Data Analysis",
  "Project Management",
  "Marketing",
  "Finance and Accounting",
  "Software Engineering",
  "HR",
  "Sales",
  "Operations",
  "Policy and Public Sector",
  "Engineering",
  "Other",
] as const;
export type RoleFamily = (typeof ROLE_FAMILIES)[number];

export const SENIORITIES = ["Entry / Graduate", "Junior", "Mid", "Senior", "Lead / Manager"] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const APPLICATION_STATUSES = ["Applied", "Response Received", "Interview", "Rejected", "Offer", "Withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const INTERVIEW_STAGES = ["None", "Phone screen", "First interview", "Assessment centre", "Final interview"] as const;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

export const INTERVIEW_OUTCOMES = ["Not applicable", "Awaiting outcome", "Progressed", "Unsuccessful", "Offer made"] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

export const DEGREE_CLASSIFICATIONS = ["First", "2:1", "2:2", "Third", "Pass", "Other", "None"] as const;
export type DegreeClassification = (typeof DEGREE_CLASSIFICATIONS)[number];

export const SEGMENTS = ["Recent graduate", "International graduate", "Career changer", "Experienced professional"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** The business plan's five mutually exclusive causal classes, in funnel order (earliest first). */
export const CAUSE_CLASSES = ["Targeting", "Qualification", "Positioning", "Evidence", "Delivery"] as const;
export type CauseClass = (typeof CAUSE_CLASSES)[number];

export const CAUSE_DESCRIPTIONS: Record<CauseClass, string> = {
  Targeting: "Applications aimed at roles misaligned by function, seniority or market saturation.",
  Qualification: "A genuine credential or competency gap exists.",
  Positioning: "The capability exists but is not communicated in the CV.",
  Evidence: "Claims are made without quantified substantiation.",
  Delivery: "Performance fails at interview rather than at application.",
};

export const ACTION_STATUSES = ["Queued", "To Do", "In Progress", "Completed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type Priority = "High" | "Medium" | "Low";

// ---------- Users ----------
export type AccountType = "candidate" | "institutional";

export interface CandidateProfile {
  education: string;
  degreeClassification: DegreeClassification;
  qualifications: string[];
  skills: string[];
  yearsExperience: number;
  workExperience: string;
  targetRoleFamilies: RoleFamily[];
  targetRoles: string[];
  targetIndustry: string;
  careerBackground: string;
  segment: Segment;
}

export interface SharingState {
  institutionId: string;
  institutionName: string;
  consentedAt: Timestamp | null;
}

/** users/{uid}: the account record (uid = a random id created at registration) plus profile and sharing consent. */
export interface UserDoc {
  uid: string;
  fullName: string;
  email: string;
  accountType: AccountType;
  organisationName: string | null;
  /** The institution an institutional account owns. */
  institutionId: string | null;
  createdAt: Timestamp;
  privacyAcceptedAt: Timestamp;
  profile: CandidateProfile | null;
  sharing: SharingState | null;
  /** Set once a workspace saved in a browser by the earlier version has been imported. */
  legacyImportedAt?: Timestamp | null;
}

export type CandidateUser = UserDoc;

// ---------- Engine analyses stored on documents ----------
export type BulletStrength = "Strong" | "Partial" | "Weak";

export interface BulletAnalysis {
  text: string;
  quantified: boolean;
  weakOpening: boolean;
  strongVerb: boolean;
  outcomeWord: boolean;
  strength: BulletStrength;
  reasons: string[];
}

export interface CvAnalysis {
  bulletCount: number;
  quantifiedRatio: number;
  weakOpeningRatio: number;
  strongRatio: number;
  bullets: BulletAnalysis[];
  mentionedSkills: string[];
  genericStatement: boolean;
  genericReasons: string[];
}

export interface JdAnalysis {
  requiredSkills: string[];
  desirableSkills: string[];
  requiredQualifications: string[];
  minYears: number | null;
  impactDemand: boolean;
  requiresDegreeClass: "First" | "2:1" | null;
  keywords: string[];
}

// ---------- Evidence ----------
export interface CvExperience {
  role: string;
  employer: string;
  start: string;
  end: string;
  bullets: string[];
}

/** A project from the CV's projects section. Kept apart from roles, so it never counts as work experience. */
export interface CvProject {
  name: string;
  bullets: string[];
}

export interface CvVersion {
  id: string;
  label: string;
  fileName: string | null;
  fileSize: number | null;
  /** Plain text extracted from the uploaded file. */
  extractedText?: string | null;
  personalStatement: string;
  experience: CvExperience[];
  /** The uploaded file, kept in pieces in users/{uid}/cvFiles. Missing or null when only text was saved. */
  storedFile?: { contentType: string; chunks: number } | null;
  /** Missing on CVs saved before projects were read separately. */
  projects?: CvProject[];
  skillsSection: string[];
  createdAt: Timestamp | null;
  analysis: CvAnalysis;
}

export interface Application {
  id: string;
  jobTitle: string;
  employer: string;
  location: string;
  roleFamily: RoleFamily;
  seniority: Seniority;
  isGraduateScheme: boolean;
  jobDescription: string;
  dateApplied: string;
  cvVersionId: string;
  status: ApplicationStatus;
  responseDate: string | null;
  recruiterResponse: string;
  interviewStage: InterviewStage;
  interviewOutcome: InterviewOutcome;
  feedback: string;
  source: "manual" | "csv" | "link";
  importBatchId: string | null;
  /** The advert link, for applications imported from a job link. */
  jobUrl?: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  jdAnalysis: JdAnalysis;
}

export type ApplicationInput = Omit<Application, "id" | "source" | "importBatchId" | "jobUrl" | "createdAt" | "updatedAt" | "jdAnalysis">;

// ---------- Diagnoses ----------
export interface EvidenceRef {
  type: "application" | "cvBullet" | "feedback" | "profile";
  id: string;
  excerpt: string;
}

export interface Signal {
  id: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  detail: string;
  evidenceRefs: EvidenceRef[];
}

export interface ClassResult {
  confidence: number;
  raw: number;
  assessable: boolean;
  notes: string[];
  signals: Signal[];
}

export type Sufficiency = "sufficient" | "limited" | "insufficient";
export type DiagnosisStatus = "active" | "superseded" | "corroborated" | "weakened" | "inconclusive";

export interface RationaleSentence {
  text: string;
  refs: EvidenceRef[];
}

export interface DiagnosisResult {
  engineVersion: string;
  inputSummary: { applications: number; decided: number; pending: number; interviews: number; cvVersions: number; feedbackItems: number; withJobDescription: number };
  sufficiency: Sufficiency;
  classes: Record<CauseClass, ClassResult>;
  primary: CauseClass | null;
  secondary: CauseClass | null;
  rationale: RationaleSentence[];
  marketContext: { schemeShare: number; schemeApplications: number; note: string };
  calibrationNotes: string[];
}

export interface Diagnosis extends DiagnosisResult {
  id: string;
  createdAt: Timestamp | null;
  status: DiagnosisStatus;
  changesAppliedAt: string | null;
}

// ---------- Actions & evaluations ----------
export interface CorrectiveAction {
  id: string;
  diagnosisId: string;
  causeClass: CauseClass;
  templateId: string;
  title: string;
  description: string;
  steps: string[];
  successMeasure: string;
  priority: Priority;
  status: ActionStatus;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  archived: boolean;
}

export type Verdict = "collecting" | "corroborated" | "weakened" | "inconclusive";

export interface EvaluationResult {
  diagnosisId: string;
  causeClass: CauseClass;
  metric: "interviewRate" | "interviewToOffer";
  changesAppliedAt: string;
  before: { n: number; rate: number };
  after: { n: number; rate: number };
  required: number;
  verdict: Verdict;
}

export interface Evaluation extends EvaluationResult {
  id: string;
  createdAt: Timestamp | null;
  appliedToCalibration: boolean;
}

export type ClassMultipliers = Record<CauseClass, number>;

// ---------- Institutions ----------
export interface Institution {
  id: string;
  name: string;
  ownerUid: string;
  joinCode: string;
  createdAt: Timestamp | null;
}

export interface MemberSummary {
  candidateUid: string;
  name: string;
  segment: string;
  targetRole: string;
  funnel: { applications: number; decided: number; responses: number; interviews: number; offers: number; responseRate: number; interviewRate: number; interviewToOffer: number };
  monthly: { key: string; month: string; applications: number; responses: number; interviews: number; offers: number }[];
  primaryCause: CauseClass | null;
  secondaryCause: CauseClass | null;
  primaryConfidence: number | null;
  rationale: string | null;
  latestVerdict: Verdict | null;
  actions: { title: string; causeClass: CauseClass; status: ActionStatus }[];
  actionsTotal: number;
  actionsCompleted: number;
  consentedAt?: Timestamp | null;
  lastActivityAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
