import { readFileSync } from "node:fs";
import path from "node:path";
import type { Application, CandidateProfile, CvVersion } from "@/data/types";
import { analyseCv, analyseJd } from "@/engine";
import { autoMap, parseCsv, validateRows } from "@/lib/csv";
import { splitCvText } from "@/lib/cvText";

export const TODAY = "2026-11-03";

export function profile(over: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    education: "BSc",
    degreeClassification: "2:1",
    qualifications: [],
    skills: [],
    yearsExperience: 1,
    workExperience: "",
    targetRoleFamilies: ["Business Analysis"],
    targetRoles: [],
    targetIndustry: "",
    careerBackground: "",
    segment: "Recent graduate",
    ...over,
  };
}

export function cv(id: string, label: string, parts: { statement?: string; bullets: string[]; skills?: string[] }): CvVersion {
  const content = { personalStatement: parts.statement ?? "", experience: [{ role: "Analyst", employer: "Firm", start: "", end: "", bullets: parts.bullets }], skillsSection: parts.skills ?? [] };
  return { id, label, fileName: null, fileSize: null, createdAt: null, ...content, analysis: analyseCv(content) };
}

export function cvFromText(id: string, label: string, text: string): CvVersion {
  const split = splitCvText(text);
  return { id, label, fileName: null, fileSize: null, createdAt: null, ...split, analysis: analyseCv(split) };
}

let n = 0;
export function app(over: Partial<Application> & Pick<Application, "dateApplied">): Application {
  n += 1;
  const base: Application = {
    id: `a${n}`,
    jobTitle: "Analyst",
    employer: `Employer ${n}`,
    location: "Leeds",
    roleFamily: "Business Analysis",
    seniority: "Junior",
    isGraduateScheme: false,
    jobDescription: "",
    cvVersionId: "cv1",
    status: "Rejected",
    responseDate: null,
    recruiterResponse: "",
    interviewStage: "None",
    interviewOutcome: "Not applicable",
    feedback: "",
    source: "manual",
    importBatchId: null,
    createdAt: null,
    updatedAt: null,
    jdAnalysis: analyseJd(""),
    ...over,
  };
  return { ...base, jdAnalysis: analyseJd(base.jobDescription) };
}

/** n dates spaced 3 days apart starting at start (all well over 30 days before TODAY). */
export function dates(count: number, start = "2026-05-01"): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * 3);
    return d.toISOString().slice(0, 10);
  });
}

const templates = path.resolve(__dirname, "../../../public/templates");

/** The business plan's worked example, loaded through the real CSV import path. */
export function workedExample() {
  const cvVersion = cvFromText("cv-sample", "CV v1 - Internships", readFileSync(path.join(templates, "sample_cv.txt"), "utf8"));
  const parsed = parseCsv(readFileSync(path.join(templates, "sample_applications.csv"), "utf8"));
  const rows = validateRows(parsed.rows, autoMap(parsed.headers), { cvLabels: [cvVersion.label], existing: [] });
  const applications = rows.map((r, i) => {
    if (!r.input) throw new Error(`Row ${r.index}: ${r.messages.join("; ")}`);
    return app({ ...r.input, id: `w${i}`, cvVersionId: cvVersion.id, source: "csv" });
  });
  const prof = profile({
    education: "BSc (Hons) Accounting and Finance",
    degreeClassification: "First",
    skills: ["Excel", "Bloomberg", "Financial reporting", "PowerPoint"],
    yearsExperience: 1,
    workExperience: "Finance Intern at Harlow & Pike LLP; Investment Operations Intern at Northvale Capital; Finance Assistant placement at Westbrook Council.",
    targetRoleFamilies: ["Finance and Accounting"],
  });
  return { profile: prof, cvVersions: [cvVersion], applications, rows };
}
