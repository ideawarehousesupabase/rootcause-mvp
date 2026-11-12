import type { CauseClass, RoleFamily } from "@/data/types";

/**
 * Rule-based diagnostic engine configuration (AI simulation).
 * Every keyword list, weight and threshold lives here. Changing any of them
 * must bump ENGINE_VERSION so stored diagnoses stay traceable to their rules.
 */
export const ENGINE_VERSION = "rules-1.0.2";

// ---------- Funnel ----------
export const NO_RESPONSE_DAYS = 30;
export const MIN_DECIDED_TO_RUN = 3;
export const MIN_CV_BULLETS_TO_RUN = 3;
export const SUFFICIENT_DECIDED = 20;
export const SUFFICIENT_JD_SHARE = 0.7;
export const LIMITED_FACTOR = 0.85;

// ---------- Scoring ----------
export const CALIBRATION = { floor: 0.1, scale: 0.7, cap: 0.95 };
export const PRIMARY_THRESHOLD = 0.5;
export const SECONDARY_THRESHOLD = 0.35;
export const TIE_MARGIN = 0.05;
export const DELIVERY_SMALL_SAMPLE = { interviews: 3, factor: 0.75 };
export const DELIVERY_MIN_INTERVIEWS_FOR_PRIMARY = 2;

export const WEIGHTS = {
  Targeting: { T1: 0.3, T2: 0.25, T3: 0.25, T4: 0.1, T5: 0.1 },
  Qualification: { Q1: 0.4, Q2: 0.3, Q3: 0.2, Q4: 0.1 },
  Positioning: { P1: 0.4, P2: 0.2, P3: 0.2, P4: 0.2 },
  Evidence: { E1: 0.4, E2: 0.15, E3: 0.2, E4: 0.1, E5: 0.15 },
  Delivery: { D1: 0.45, D2: 0.25, D3: 0.3 },
} as const;

// ---------- Closed loop ----------
export const EVALUATION = {
  beforeWindowDays: 90,
  /** If the 90-day window is thin, fall back to the most recent N earlier applications. */
  minBeforeApplications: 10,
  requiredAfterApplications: 8,
  requiredAfterInterviews: 3,
  corroborateMinGain: 0.1,
  corroborateMinRatio: 1.5,
  weakenMaxGain: 0.03,
};

export const CALIBRATION_STEP = { up: 1.05, down: 0.85, max: 1.15, min: 0.7 };

// ---------- Text lexicons ----------
export const WEAK_OPENINGS = [
  "responsible for",
  "helped with",
  "helped",
  "assisted with",
  "assisted in",
  "assisted",
  "involved in",
  "supported",
  "worked on",
  "duties included",
  "tasked with",
  "participated in",
  "in charge of",
];

export const STRONG_VERBS = [
  "delivered", "reduced", "increased", "improved", "built", "designed", "launched", "led", "created", "automated",
  "saved", "grew", "cut", "negotiated", "implemented", "analysed", "analyzed", "streamlined", "achieved", "generated",
  "won", "rebuilt", "developed", "introduced", "trained", "managed", "redesigned", "produced",
];

export const OUTCOME_WORDS = ["reduced", "increased", "improved", "saved", "grew", "cut", "achieved", "generated", "raised", "lowered", "doubled", "halved", "boosted"];

export const NUMBER_WORDS = ["doubled", "halved", "tripled", "dozen", "dozens", "hundreds", "thousands"];

export const GENERIC_PHRASES = [
  "hard working",
  "hard-working",
  "motivated",
  "team player",
  "exciting opportunity",
  "passionate",
  "excellent communication skills",
  "results driven",
  "results-driven",
  "go getter",
  "go-getter",
  "self starter",
  "self-starter",
];

export const REQUIRED_MARKERS = ["required", "essential", "must", "minimum", "you will have", "proven", "you will need", "we need"];

export const IMPACT_DEMAND_TERMS = [
  "measurable",
  "quantified",
  "track record",
  "demonstrable",
  "demonstrated",
  "proven results",
  "evidence of impact",
  "delivered results",
  "commercial impact",
];

export const QUALIFICATIONS = [
  "CIMA", "ACCA", "ACA", "AAT", "CPA", "CFA", "CIPD", "PRINCE2", "APM", "PMP", "NEBOSH", "CSCS", "QTS", "NMC",
  "chartered", "driving licence", "security clearance",
];

/** Skill lexicon: canonical skill → aliases (all matched case-insensitively, whole words). */
export const SKILLS: Record<string, string[]> = {
  excel: ["excel", "ms excel", "microsoft excel", "spreadsheets"],
  sql: ["sql", "mysql", "postgresql", "t-sql"],
  python: ["python"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  "data analysis": ["data analysis", "analysing data", "analyzing data", "data analytics"],
  "data visualisation": ["data visualisation", "data visualization", "dashboards", "dashboard"],
  "stakeholder management": ["stakeholder management", "stakeholder engagement", "stakeholders"],
  "requirements gathering": ["requirements gathering", "gather requirements", "gathering requirements", "requirements"],
  "process mapping": ["process mapping", "map processes", "process improvement"],
  "project management": ["project management", "managing projects", "project plans"],
  agile: ["agile", "scrum", "kanban"],
  jira: ["jira"],
  "financial modelling": ["financial modelling", "financial modeling", "financial models", "financial model"],
  valuation: ["valuation", "valuations", "dcf"],
  forecasting: ["forecasting", "forecasts", "forecast"],
  budgeting: ["budgeting", "budgets", "budget"],
  "financial reporting": ["financial reporting", "management accounts", "month end", "month-end"],
  "variance analysis": ["variance analysis", "variance reports", "variance reporting"],
  bloomberg: ["bloomberg"],
  reporting: ["reporting", "reports"],
  crm: ["crm", "salesforce", "hubspot"],
  seo: ["seo", "search engine optimisation"],
  "google analytics": ["google analytics", "ga4"],
  "social media": ["social media"],
  "content creation": ["content creation", "copywriting"],
  "presentation skills": ["presentation skills", "presenting", "presentations"],
  negotiation: ["negotiation", "negotiating"],
  "customer service": ["customer service", "customer queries", "customer complaints"],
  recruitment: ["recruitment", "recruiting", "talent acquisition"],
  payroll: ["payroll"],
  "employee relations": ["employee relations"],
  compliance: ["compliance", "regulatory"],
  "risk management": ["risk management", "risk assessment"],
  "policy analysis": ["policy analysis", "policy development", "policy"],
  research: ["research"],
  autocad: ["autocad"],
  java: ["java"],
  javascript: ["javascript", "typescript"],
  react: ["react"],
  "cloud platforms": ["aws", "azure", "gcp", "cloud"],
  testing: ["unit testing", "automated testing", "test automation"],
  "supply chain": ["supply chain", "logistics", "procurement"],
  "lean / six sigma": ["lean", "six sigma", "kaizen"],
  "sales targets": ["sales targets", "pipeline", "business development", "lead generation"],
};

/** Words that indicate a role family when found in a personal statement (for the generic-statement check). */
export const FAMILY_TERMS: Partial<Record<RoleFamily, string[]>> = {
  "Business Analysis": ["business analyst", "business analysis"],
  "Data Analysis": ["data analyst", "data analysis", "analytics"],
  "Project Management": ["project management", "project manager", "project coordinator"],
  Marketing: ["marketing"],
  "Finance and Accounting": ["finance", "accounting", "financial"],
  "Software Engineering": ["software", "developer", "engineering"],
  HR: ["hr", "human resources"],
  Sales: ["sales"],
  Operations: ["operations"],
  "Policy and Public Sector": ["policy", "public sector"],
};

/**
 * Feedback / recruiter-response terms that point at each class. Only feedback
 * on unsuccessful applications is scanned, so positive feedback is not misread.
 */
export const FEEDBACK_TERMS: Record<CauseClass, string[]> = {
  Evidence: ["measurable", "evidence of", "achievements", "quantified", "track record", "results in previous roles"],
  Qualification: ["qualification", "qualified", "certification", "part-qualified", "cima", "acca", "degree requirement", "technical skills", "technical test"],
  Targeting: ["overqualified", "underqualified", "seniority", "more experienced", "more senior", "high volume of applications"],
  Positioning: ["not clear how", "did not demonstrate", "unclear relevance", "relevance of your experience", "transferable"],
  Delivery: ["lacked examples", "lacked specific", "too general", "were general", "not structured", "unstructured", "star", "communication", "confidence", "nervous"],
};

/** Delivery competencies we look for in interview feedback to personalise STAR preparation. */
export const DELIVERY_COMPETENCIES = [
  "stakeholder", "teamwork", "problem solving", "leadership", "communication", "commercial awareness", "technical", "motivation", "examples",
];
