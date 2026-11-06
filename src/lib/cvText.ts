import type { CvExperience } from "@/data/types";

// Basic text splitting for pasted or extracted CV text. The user checks
// and corrects the result in the structured form before saving.

const HEADINGS: Record<string, "statement" | "experience" | "skills" | "other"> = {
  profile: "statement",
  "personal statement": "statement",
  "personal profile": "statement",
  summary: "statement",
  "professional summary": "statement",
  about: "statement",
  experience: "experience",
  "work experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "professional experience": "experience",
  skills: "skills",
  "key skills": "skills",
  "technical skills": "skills",
  education: "other",
  qualifications: "other",
  interests: "other",
  references: "other",
  certifications: "other",
};

function headingType(line: string) {
  const clean = line.trim().replace(/[:#*]+$/g, "").replace(/^[#*\s]+/, "").toLowerCase();
  if (HEADINGS[clean]) return HEADINGS[clean];
  const isCaps = line.trim().length > 2 && line.trim().length < 40 && line.trim() === line.trim().toUpperCase() && /[A-Z]/.test(line);
  return isCaps ? (HEADINGS[clean] ?? "other") : null;
}

const BULLET = /^\s*([-•*–·]|\d+[.)])\s+/;

export interface SplitCv {
  personalStatement: string;
  experience: CvExperience[];
  skillsSection: string[];
}

export function splitCvText(text: string): SplitCv {
  const out: SplitCv = { personalStatement: "", experience: [], skillsSection: [] };
  let section: "statement" | "experience" | "skills" | "other" = "statement";
  let current: CvExperience | null = null;
  const statement: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = headingType(line);
    if (h) {
      section = h;
      current = null;
      continue;
    }
    if (section === "statement") statement.push(line);
    else if (section === "skills") out.skillsSection.push(...line.replace(BULLET, "").split(/[,;|]/).map((s) => s.trim()).filter(Boolean));
    else if (section === "experience") {
      if (BULLET.test(line)) {
        if (!current) {
          current = { role: "", employer: "", start: "", end: "", bullets: [] };
          out.experience.push(current);
        }
        current.bullets.push(line.replace(BULLET, "").trim());
      } else {
        // "Role | Employer | Start - End" or "Role, Employer" starts a new entry.
        const parts = line.split(/\s+\|\s+|\s+—\s+|\s+-\s+(?=[A-Z][a-z]{2} \d{4})|,\s+/).map((p) => p.trim());
        const dates = line.match(/([A-Z][a-z]{2,8}\.? \d{4}|\d{4})\s*[-–to]+\s*([A-Z][a-z]{2,8}\.? \d{4}|\d{4}|Present|present)/);
        current = {
          role: parts[0] ?? line,
          employer: parts[1] && !/\d{4}/.test(parts[1]) ? parts[1] : "",
          start: dates?.[1] ?? "",
          end: dates?.[2] ?? "",
          bullets: [],
        };
        out.experience.push(current);
      }
    }
  }
  out.personalStatement = statement.join(" ");
  out.experience = out.experience.filter((e) => e.role || e.bullets.length);
  return out;
}
