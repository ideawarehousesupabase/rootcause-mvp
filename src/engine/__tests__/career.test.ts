import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/data/courseCatalogue";
import { SAMPLE_VACANCIES } from "@/data/sampleVacancies";
import type { CorrectiveAction, RoadmapStep } from "@/data/types";
import { analyseJd, candidateSkills, recommendCourses, skillsGap, suggestRoadmapSteps, vacancyMatch } from "@/engine";
import { cv, profile, workedExample } from "./fixtures";

describe("sample data", () => {
  it("labels every sample vacancy and course as a sample", () => {
    expect(SAMPLE_VACANCIES.every((v) => v.employer.includes("(sample)"))).toBe(true);
    expect(COURSE_CATALOGUE.every((c) => c.provider.includes("(sample)"))).toBe(true);
  });

  it("gives every sample vacancy some requirements the engine can read", () => {
    for (const v of SAMPLE_VACANCIES) expect(analyseJd(v.description).requiredSkills.length).toBeGreaterThan(0);
  });
});

describe("skills gap", () => {
  const input = { ...workedExample(), vacancies: SAMPLE_VACANCIES };

  it("compares the worked example against finance roles", () => {
    const r = skillsGap(input);
    expect(r.targetFamilies).toEqual(["Finance and Accounting"]);
    expect(r.rolesConsidered).toBeGreaterThanOrEqual(24);
    const excel = r.gaps.find((g) => g.skill === "excel")!;
    expect(excel.have).toBe(true);
    const modelling = r.gaps.find((g) => g.skill === "financial modelling")!;
    expect(modelling.have).toBe(false);
    expect(modelling.importance).toBeGreaterThan(0.2);
  });

  it("puts missing skills first, then listed-but-unshown, then evidenced", () => {
    const rank = (g: { have: boolean; evidenced: boolean }) => (!g.have ? 0 : !g.evidenced ? 1 : 2);
    const ranks = skillsGap(input).gaps.map(rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("counts a skill as evidenced only when a CV bullet shows it", () => {
    const shown = cv("c1", "CV", { bullets: ["Built an Excel model that cut forecast time by 30%."], skills: ["SQL"] });
    const s = candidateSkills(profile({ skills: [] }), [shown]);
    expect(s.have.has("excel")).toBe(true);
    expect(s.evidenced.has("excel")).toBe(true);
    expect(s.have.has("sql")).toBe(true);
    expect(s.evidenced.has("sql")).toBe(false);
  });

  it("scores a vacancy match from its required skills", () => {
    const v = SAMPLE_VACANCIES.find((x) => x.id === "sv-data-01")!;
    const none = vacancyMatch(v, { have: new Set(), evidenced: new Set() }, null);
    expect(none.match).toBe(0);
    const all = vacancyMatch(v, { have: new Set(none.required.map((r) => r.skill)), evidenced: new Set() }, null);
    expect(all.match).toBe(1);
  });
});

describe("course recommendations", () => {
  it("recommends one course per important missing skill, cheapest first", () => {
    const { gaps } = skillsGap({ ...workedExample(), vacancies: SAMPLE_VACANCIES });
    const recs = recommendCourses(gaps, COURSE_CATALOGUE);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(6);
    expect(new Set(recs.map((r) => r.skill)).size).toBe(recs.length);
    for (const r of recs) expect(gaps.find((g) => g.skill === r.skill)!.have).toBe(false);
    expect(recs.some((r) => r.skill === "financial modelling")).toBe(true);
  });

  it("recommends nothing when there is no gap", () => {
    expect(recommendCourses([{ skill: "excel", importance: 1, required: true, have: true, evidenced: true, sources: 3 }], COURSE_CATALOGUE)).toEqual([]);
  });
});

describe("career roadmap", () => {
  const action = { id: "a1", title: "Quantify three bullets", causeClass: "Evidence", description: "Add numbers.", status: "To Do", archived: false } as CorrectiveAction;
  const queued = { ...action, id: "a2", title: "Prepare STAR examples", status: "Queued" } as CorrectiveAction;

  it("suggests the active corrective actions and career steps, not queued actions", () => {
    const drafts = suggestRoadmapSteps({ actions: [action, queued], gaps: [], families: ["Finance and Accounting"], existing: [] });
    expect(drafts.map((d) => d.sourceId)).toEqual(["action:a1", "apply:Finance and Accounting", "rerun-diagnosis"]);
  });

  it("never suggests a step that is already on the roadmap", () => {
    const existing = [{ sourceId: "action:a1", title: "Quantify three bullets" }, { sourceId: "rerun-diagnosis", title: "x" }] as RoadmapStep[];
    const drafts = suggestRoadmapSteps({ actions: [action], gaps: [], families: [], existing });
    expect(drafts).toEqual([]);
  });

  it("turns listed-but-unshown skills into CV evidence steps", () => {
    const drafts = suggestRoadmapSteps({
      actions: [],
      gaps: [{ skill: "sql", importance: 0.5, required: true, have: true, evidenced: false, sources: 4 }],
      families: [],
      existing: [],
    });
    expect(drafts[0]).toMatchObject({ kind: "career", sourceId: "evidence:sql" });
  });
});
