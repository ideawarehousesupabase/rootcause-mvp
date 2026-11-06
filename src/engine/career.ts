import type {
  Application,
  CandidateProfile,
  CorrectiveAction,
  CourseRecommendation,
  CvVersion,
  RoadmapKind,
  RoadmapStatus,
  RoadmapStep,
  RoleFamily,
  SkillGap,
} from "@/data/types";
import type { Course } from "@/data/courseCatalogue";
import type { SampleVacancy } from "@/data/sampleVacancies";
import { analyseJd } from "./analyse";
import { canonicalSkills, findSkills, pct } from "./text";

// Rule-based career development: skills gap against target roles, course recommendations
// and roadmap steps. Same approach as the diagnostic engine — transparent, deterministic rules.

/** Skills below this share of target roles are not worth a course. */
export const GAP_MIN_IMPORTANCE = 0.2;
export const MAX_COURSES = 6;

export interface CandidateSkills {
  /** Canonical skills and qualifications the candidate lists or shows. */
  have: Set<string>;
  /** Shown in use in a CV bullet. */
  evidenced: Set<string>;
}

const qualKey = (q: string) => q.trim().toUpperCase();

export function candidateSkills(profile: CandidateProfile | null, cvVersions: CvVersion[]): CandidateSkills {
  const latest = cvVersions[cvVersions.length - 1];
  const have = new Set<string>([
    ...canonicalSkills(profile?.skills ?? []),
    ...(profile?.qualifications ?? []).map(qualKey),
    ...(latest?.analysis.mentionedSkills ?? []),
  ]);
  const bullets = latest?.experience.flatMap((e) => e.bullets).join(". ") ?? "";
  return { have, evidenced: new Set(findSkills(bullets)) };
}

interface RoleRequirements {
  required: string[];
  desirable: string[];
}

const requirementsOf = (jd: ReturnType<typeof analyseJd>): RoleRequirements => ({
  required: [...jd.requiredSkills, ...jd.requiredQualifications.map(qualKey)],
  desirable: jd.desirableSkills,
});

export interface GapInput {
  profile: CandidateProfile | null;
  cvVersions: CvVersion[];
  applications: Application[];
  vacancies: SampleVacancy[];
}

/** Families to analyse: the profile's targets, else the families applied to most. */
export function targetFamilies(profile: CandidateProfile | null, applications: Application[]): RoleFamily[] {
  if (profile?.targetRoleFamilies.length) return profile.targetRoleFamilies;
  const counts = new Map<RoleFamily, number>();
  applications.forEach((a) => counts.set(a.roleFamily, (counts.get(a.roleFamily) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f);
}

export function skillsGap(input: GapInput) {
  const families = targetFamilies(input.profile, input.applications);
  const roles: RoleRequirements[] = [
    ...input.vacancies.filter((v) => families.includes(v.roleFamily)).map((v) => requirementsOf(analyseJd(v.description))),
    ...input.applications.filter((a) => families.includes(a.roleFamily) && a.jobDescription.trim()).map((a) => requirementsOf(a.jdAnalysis)),
  ];
  const skills = candidateSkills(input.profile, input.cvVersions);
  const tally = new Map<string, { required: number; any: number }>();
  for (const r of roles) {
    for (const s of new Set([...r.required, ...r.desirable])) {
      const t = tally.get(s) ?? { required: 0, any: 0 };
      t.any += 1;
      if (r.required.includes(s)) t.required += 1;
      tally.set(s, t);
    }
  }
  const status = (g: SkillGap) => (!g.have ? 0 : !g.evidenced ? 1 : 2);
  const gaps: SkillGap[] = [...tally.entries()]
    .map(([skill, t]) => {
      const isQual = skill === skill.toUpperCase() && /[A-Z]/.test(skill);
      const have = skills.have.has(skill);
      return {
        skill,
        // Desirable mentions count half as much as required ones.
        importance: roles.length ? Math.min(1, (t.required + (t.any - t.required) * 0.5) / roles.length) : 0,
        required: t.required > 0,
        have,
        // A qualification is evidenced by holding it; a skill by using it in a CV bullet.
        evidenced: have && (isQual || skills.evidenced.has(skill)),
        sources: t.any,
      };
    })
    .sort((a, b) => status(a) - status(b) || b.importance - a.importance || a.skill.localeCompare(b.skill));
  return { targetFamilies: families, rolesConsidered: roles.length, gaps };
}

export interface VacancyMatch {
  required: { skill: string; have: boolean }[];
  desirable: { skill: string; have: boolean }[];
  /** Share of required skills and qualifications the candidate has (0–1). */
  match: number;
  minYears: number | null;
  meetsYears: boolean;
}

export function vacancyMatch(vacancy: SampleVacancy, skills: CandidateSkills, profile: CandidateProfile | null): VacancyMatch {
  const jd = analyseJd(vacancy.description);
  const req = requirementsOf(jd);
  const required = req.required.map((skill) => ({ skill, have: skills.have.has(skill) }));
  const desirable = req.desirable.map((skill) => ({ skill, have: skills.have.has(skill) }));
  return {
    required,
    desirable,
    match: required.length ? required.filter((r) => r.have).length / required.length : 1,
    minYears: jd.minYears,
    meetsYears: jd.minYears === null || (profile?.yearsExperience ?? 0) >= jd.minYears,
  };
}

/** One course per missing skill, for the most important gaps first. */
export function recommendCourses(gaps: SkillGap[], catalogue: Course[], max = MAX_COURSES): CourseRecommendation[] {
  const costRank: Record<Course["cost"], number> = { Free: 0, "Under £100": 1, "£100–£500": 2, "Over £500": 3 };
  const out: CourseRecommendation[] = [];
  for (const g of gaps.filter((x) => !x.have && x.importance >= GAP_MIN_IMPORTANCE).sort((a, b) => b.importance - a.importance)) {
    const options = catalogue.filter((c) => c.skill.toLowerCase() === g.skill.toLowerCase()).sort((a, b) => costRank[a.cost] - costRank[b.cost]);
    if (!options.length) continue;
    out.push({
      courseId: options[0].id,
      skill: g.skill,
      reason: `${g.required ? "Required" : "Asked for"} in ${pct(g.importance)}% of your target roles (${g.sources} of the roles considered), and not in your profile or CV.`,
    });
    if (out.length >= max) break;
  }
  return out;
}

export type RoadmapDraft = Pick<RoadmapStep, "kind" | "title" | "detail" | "sourceId" | "targetDate"> & { status?: RoadmapStatus };

const step = (kind: RoadmapKind, title: string, detail: string, sourceId: string | null = null): RoadmapDraft => ({ kind, title, detail, sourceId, targetDate: null });

/**
 * New roadmap steps that aren't on the roadmap yet: the current corrective actions, then
 * career steps that turn identified gaps into evidence and applications.
 */
export function suggestRoadmapSteps(input: {
  actions: CorrectiveAction[];
  gaps: SkillGap[];
  families: RoleFamily[];
  existing: RoadmapStep[];
}): RoadmapDraft[] {
  const have = new Set(input.existing.map((s) => s.sourceId ?? `title:${s.title}`));
  const drafts: RoadmapDraft[] = [];
  const add = (d: RoadmapDraft) => {
    const key = d.sourceId ?? `title:${d.title}`;
    if (!have.has(key)) {
      have.add(key);
      drafts.push(d);
    }
  };
  input.actions
    .filter((a) => !a.archived && a.status !== "Queued")
    .forEach((a) => add(step("action", a.title, `Corrective action for ${a.causeClass}: ${a.description}`, `action:${a.id}`)));
  input.gaps
    .filter((g) => g.have && !g.evidenced && g.importance >= GAP_MIN_IMPORTANCE)
    .slice(0, 2)
    .forEach((g) => add(step("career", `Show ${g.skill} in a CV bullet`, `It's listed but no bullet shows it in use. Add one with a measurable result — ${pct(g.importance)}% of your target roles ask for it.`, `evidence:${g.skill}`)));
  const family = input.families[0];
  if (family) add(step("career", `Apply to 5 ${family} roles with the updated CV`, "Log each one in the Application Tracker so the next diagnosis can measure the change.", `apply:${family}`));
  add(step("career", "Re-run the diagnosis after 8 more decided applications", "This checks whether the changes made a difference to your interview rate.", "rerun-diagnosis"));
  return drafts;
}

export const courseStep = (course: Course): RoadmapDraft =>
  step("learning", course.title, `${course.provider} · ${course.format} · ${course.duration} · ${course.cost}. Builds ${course.skill}.`, `course:${course.id}`);
