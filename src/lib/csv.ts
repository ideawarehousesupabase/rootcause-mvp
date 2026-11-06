import Papa from "papaparse";
import {
  APPLICATION_STATUSES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  ROLE_FAMILIES,
  SENIORITIES,
  type Application,
  type ApplicationInput,
} from "@/data/types";
import { applicationSchema } from "./validation";

export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 1024 * 1024;

export const CSV_COLUMNS = [
  { key: "job_title", required: true },
  { key: "employer", required: true },
  { key: "location", required: false },
  { key: "role_family", required: true },
  { key: "seniority", required: false },
  { key: "graduate_scheme", required: false },
  { key: "date_applied", required: true },
  { key: "cv_version", required: true },
  { key: "status", required: false },
  { key: "response_date", required: false },
  { key: "recruiter_response", required: false },
  { key: "interview_stage", required: false },
  { key: "interview_outcome", required: false },
  { key: "feedback", required: false },
  { key: "job_description", required: false },
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number]["key"];

export const TEMPLATE_CSV =
  CSV_COLUMNS.map((c) => c.key).join(",") +
  "\n" +
  'Junior Business Analyst,Example Ltd,Leeds,Business Analysis,Junior,no,2026-09-01,CV v1,Applied,,,None,Not applicable,,"Paste the job description here. Requirements with commas must stay inside quotes."\n';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  error: string | null;
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  if (!headers.length) return { headers: [], rows: [], error: "The file has no header row." };
  if (result.data.length > CSV_MAX_ROWS) return { headers, rows: [], error: `The file has ${result.data.length} rows; the limit is ${CSV_MAX_ROWS}.` };
  const fatal = result.errors.find((e) => e.type === "Delimiter");
  return { headers, rows: result.data, error: fatal ? "Could not detect the CSV delimiter." : null };
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ColumnMapping = Record<string, CsvColumn | null>;

/** Match headers to template columns case-insensitively, ignoring spaces and punctuation. */
export function autoMap(headers: string[]): ColumnMapping {
  const byKey = new Map(CSV_COLUMNS.map((c) => [simplify(c.key), c.key]));
  const aliases: Record<string, CsvColumn> = { title: "job_title", role: "job_title", company: "employer", date: "date_applied", applied: "date_applied", cv: "cv_version", jd: "job_description", description: "job_description" };
  const used = new Set<CsvColumn>();
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const key = byKey.get(simplify(h)) ?? aliases[simplify(h)] ?? null;
    mapping[h] = key && !used.has(key) ? key : null;
    if (key) used.add(key);
  }
  return mapping;
}

export function missingRequired(mapping: ColumnMapping): CsvColumn[] {
  const mapped = new Set(Object.values(mapping));
  return CSV_COLUMNS.filter((c) => c.required && !mapped.has(c.key)).map((c) => c.key);
}

/** YYYY-MM-DD or DD/MM/YYYY (UK) → YYYY-MM-DD. */
export function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const uk = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (uk) [d, m, y] = [+uk[1], +uk[2], +uk[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function matchEnum<T extends string>(value: string, options: readonly T[]): T | null {
  const v = simplify(value);
  return options.find((o) => simplify(o) === v) ?? null;
}

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

export type RowStatus = "ready" | "warning" | "error";

export interface RowResult {
  index: number; // 1-based data row number
  status: RowStatus;
  messages: string[];
  duplicate: boolean;
  include: boolean;
  cvLabel: string;
  isNewCv: boolean;
  input: Omit<ApplicationInput, "cvVersionId"> | null;
  raw: Record<string, string>;
}

export const duplicateKey = (a: { employer: string; jobTitle: string; dateApplied: string }) =>
  `${a.employer.trim().toLowerCase()}|${a.jobTitle.trim().toLowerCase()}|${a.dateApplied}`;

export function validateRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  opts: { cvLabels: string[]; existing: Pick<Application, "employer" | "jobTitle" | "dateApplied">[] },
): RowResult[] {
  const cvSet = new Set(opts.cvLabels.map((l) => l.trim().toLowerCase()));
  const existingKeys = new Set(opts.existing.map(duplicateKey));
  const seenInFile = new Set<string>();

  return rows.map((raw, i) => {
    const get = (col: CsvColumn) => {
      const header = Object.keys(mapping).find((h) => mapping[h] === col);
      return header ? (raw[header] ?? "").trim() : "";
    };
    const messages: string[] = [];
    const errors: string[] = [];

    const roleFamily = matchEnum(get("role_family"), ROLE_FAMILIES);
    if (get("role_family") && !roleFamily) errors.push(`role_family: "${get("role_family")}" is not a recognised role family`);
    const seniority = get("seniority") ? matchEnum(get("seniority"), SENIORITIES) : "Junior";
    if (!seniority) errors.push(`seniority: "${get("seniority")}" is not recognised`);
    const scheme = parseBool(get("graduate_scheme"));
    if (scheme === null) errors.push(`graduate_scheme: use yes or no`);
    const dateApplied = parseDate(get("date_applied"));
    if (get("date_applied") && !dateApplied) errors.push(`date_applied: "${get("date_applied")}" — use YYYY-MM-DD or DD/MM/YYYY`);
    const responseDate = get("response_date") ? parseDate(get("response_date")) : null;
    if (get("response_date") && !responseDate) errors.push(`response_date: "${get("response_date")}" — use YYYY-MM-DD or DD/MM/YYYY`);
    const status = get("status") ? matchEnum(get("status"), APPLICATION_STATUSES) : "Applied";
    if (!status) errors.push(`status: "${get("status")}" is not recognised`);
    const interviewStage = get("interview_stage") ? matchEnum(get("interview_stage"), INTERVIEW_STAGES) : "None";
    if (!interviewStage) errors.push(`interview_stage: "${get("interview_stage")}" is not recognised`);
    const interviewOutcome = get("interview_outcome") ? matchEnum(get("interview_outcome"), INTERVIEW_OUTCOMES) : "Not applicable";
    if (!interviewOutcome) errors.push(`interview_outcome: "${get("interview_outcome")}" is not recognised`);

    const cvLabel = get("cv_version");
    const candidate = {
      jobTitle: get("job_title"),
      employer: get("employer"),
      location: get("location"),
      roleFamily: roleFamily ?? ("" as never),
      seniority: seniority ?? ("" as never),
      isGraduateScheme: scheme ?? false,
      jobDescription: get("job_description"),
      dateApplied: dateApplied ?? "",
      cvVersionId: cvLabel || "",
      status: status ?? ("" as never),
      responseDate,
      recruiterResponse: get("recruiter_response"),
      interviewStage: interviewStage ?? ("" as never),
      interviewOutcome: interviewOutcome ?? ("" as never),
      feedback: get("feedback"),
    };

    if (!errors.length) {
      const parsed = applicationSchema.safeParse(candidate);
      if (!parsed.success) parsed.error.issues.forEach((iss) => errors.push(`${String(iss.path[0] ?? "row")}: ${iss.message}`));
    }

    const key = candidate.dateApplied ? duplicateKey(candidate) : "";
    const duplicate = Boolean(key) && (existingKeys.has(key) || seenInFile.has(key));
    if (key) seenInFile.add(key);
    const isNewCv = Boolean(cvLabel) && !cvSet.has(cvLabel.toLowerCase());

    if (!errors.length) {
      if (!candidate.jobDescription) messages.push("No job description — diagnosis accuracy reduced");
      if (isNewCv) messages.push(`New CV version "${cvLabel}" will be created — add its content afterwards`);
      if (duplicate) messages.push("Possible duplicate — skipped unless you include it");
    }

    const { cvVersionId: _omit, ...input } = candidate;
    void _omit;
    return {
      index: i + 1,
      status: errors.length ? "error" : messages.length ? "warning" : "ready",
      messages: errors.length ? errors : messages,
      duplicate,
      include: !errors.length && !duplicate,
      cvLabel,
      isNewCv,
      input: errors.length ? null : input,
      raw,
    };
  });
}

const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function applicationsToCsv(apps: Application[], cvLabelById: (id: string) => string): string {
  const header = CSV_COLUMNS.map((c) => c.key).join(",");
  const lines = apps.map((a) =>
    [
      a.jobTitle,
      a.employer,
      a.location,
      a.roleFamily,
      a.seniority,
      a.isGraduateScheme ? "yes" : "no",
      a.dateApplied,
      cvLabelById(a.cvVersionId),
      a.status,
      a.responseDate ?? "",
      a.recruiterResponse,
      a.interviewStage,
      a.interviewOutcome,
      a.feedback,
      a.jobDescription,
    ]
      .map((v) => escape(String(v ?? "")))
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export function rowsToErrorCsv(rows: RowResult[]): string {
  const failed = rows.filter((r) => r.status === "error");
  if (!failed.length) return "";
  const headers = Object.keys(failed[0].raw);
  return [
    [...headers, "error"].map(escape).join(","),
    ...failed.map((r) => [...headers.map((h) => r.raw[h] ?? ""), r.messages.join("; ")].map((v) => escape(String(v))).join(",")),
  ].join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
