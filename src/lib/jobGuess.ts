import type { RoleFamily, Seniority } from "@/data/types";

// First guesses for an imported advert's role family and seniority, from its title
// (and description when the title says nothing). The user checks them before saving.

const FAMILY_KEYWORDS: [RoleFamily, RegExp][] = [
  ["Software Engineering", /\b(software|developer|programmer|front[- ]?end|back[- ]?end|full[- ]?stack|devops|sre|mobile engineer|web engineer)\b/i],
  ["Data Analysis", /\b(data analyst|data scientist|insight|analytics|bi analyst|business intelligence|reporting analyst|data engineer)\b/i],
  ["Business Analysis", /\b(business analyst|business analysis|systems analyst|process analyst|requirements analyst)\b/i],
  ["Project Management", /\b(project manager|programme manager|project coordinator|pmo|scrum master|delivery manager|project officer)\b/i],
  ["Finance and Accounting", /\b(accountant|accounting|finance|financial|audit|tax|payroll|fp&a|treasury|bookkeep|credit control|investment)\b/i],
  ["Marketing", /\b(marketing|seo|content|social media|brand|digital marketing|campaign|communications|pr )\b/i],
  ["HR", /\b(hr|human resources|people partner|recruiter|recruitment|talent|learning and development|l&d)\b/i],
  ["Sales", /\b(sales|business development|account executive|account manager|bdr|sdr|telesales)\b/i],
  ["Operations", /\b(operations|logistics|supply chain|warehouse|procurement|purchasing|planner|facilities)\b/i],
  ["Policy and Public Sector", /\b(policy|civil service|government|public sector|parliament|council|regulat)\b/i],
  ["Engineering", /\b(mechanical|electrical|civil engineer|structural|manufacturing|chemical engineer|engineer)\b/i],
];

export function guessRoleFamily(title: string, description = ""): RoleFamily {
  for (const text of [title, description.slice(0, 600)]) {
    const hit = FAMILY_KEYWORDS.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return "Other";
}

export function guessSeniority(title: string): Seniority {
  if (/\b(graduate|grad|entry[- ]level|trainee|apprentice|intern|placement)\b/i.test(title)) return "Entry / Graduate";
  if (/\b(head of|director|lead|principal|manager)\b/i.test(title)) return "Lead / Manager";
  if (/\b(senior|sr\.?)\b/i.test(title)) return "Senior";
  if (/\b(junior|jr\.?|assistant|associate)\b/i.test(title)) return "Junior";
  return "Mid";
}

export const looksLikeGraduateScheme = (title: string, description = "") =>
  /\bgraduate (scheme|programme|program)\b/i.test(`${title} ${description.slice(0, 1500)}`);
