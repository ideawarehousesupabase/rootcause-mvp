import { describe, expect, it } from "vitest";
import { evaluateDiagnosis, generateActions, readiness, runDiagnosis } from "@/engine";
import { analyseBullet } from "@/engine/analyse";
import { app, cv, dates, profile, TODAY, workedExample } from "./fixtures";

const quantifiedCv = cv("cv1", "CV v2", {
  statement: "Business analyst focused on process improvement in logistics.",
  bullets: [
    "Reduced weekly reporting time from 3 hours to 45 minutes by rebuilding the sales tracker.",
    "Analysed 6 months of complaint logs and cut repeat complaints by 18%.",
    "Trained 9 new colleagues on stock procedures within their first fortnight.",
    "Delivered a requirements workshop for 12 stakeholders using process mapping and Excel.",
  ],
  skills: ["Excel", "requirements gathering", "process mapping", "stakeholder management"],
});

describe("text understanding", () => {
  it("scores bullets", () => {
    expect(analyseBullet("Responsible for processing invoices.").strength).toBe("Weak");
    expect(analyseBullet("Reduced invoice errors by 25% through a new checklist.").strength).toBe("Strong");
    expect(analyseBullet("Built a tracker for 40 suppliers").strength).toBe("Strong");
  });
});

describe("business plan worked example (sample CSV + CV)", () => {
  const input = { ...workedExample(), today: TODAY };

  it("imports all 24 rows without errors", () => {
    expect(input.rows).toHaveLength(24);
    expect(input.rows.every((r) => r.status !== "error")).toBe(true);
  });

  it("diagnoses Evidence as primary and Delivery as monitored secondary", () => {
    const r = runDiagnosis(input);
    expect(r.sufficiency).toBe("sufficient");
    expect(r.primary).toBe("Evidence");
    expect(r.classes.Evidence.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.classes.Evidence.confidence).toBeLessThanOrEqual(0.8);
    expect(r.secondary).toBe("Delivery");
    expect(r.classes.Delivery.confidence).toBeGreaterThanOrEqual(0.35);
    expect(r.classes.Delivery.confidence).toBeLessThanOrEqual(0.5);
    expect(r.classes.Delivery.notes.join(" ")).toMatch(/Small sample/);
    expect(r.classes.Targeting.confidence).toBeLessThan(0.3);
    expect(r.classes.Qualification.confidence).toBeLessThan(0.45);
    expect(r.rationale[0].refs.length).toBeGreaterThan(0);
  });

  it("creates Evidence actions to do and Delivery actions queued", () => {
    const r = runDiagnosis(input);
    const actions = generateActions(input, r);
    expect(actions.filter((a) => a.causeClass === "Evidence").every((a) => a.status === "To Do")).toBe(true);
    expect(actions.filter((a) => a.causeClass === "Delivery").every((a) => a.status === "Queued")).toBe(true);
    expect(actions[0].description).toContain("Assisted with monthly financial reporting.");
  });

  it("is deterministic", () => {
    expect(JSON.stringify(runDiagnosis(input))).toBe(JSON.stringify(runDiagnosis(input)));
  });
});

describe("class fixtures", () => {
  it("Targeting", () => {
    const d = dates(25);
    const families = ["Business Analysis", "Marketing", "Finance and Accounting", "HR"] as const;
    const apps = d.map((date, i) => {
      const family = i < 9 ? families[0] : families[1 + (i % 3)];
      return app({
        dateApplied: date,
        roleFamily: family,
        seniority: i >= 9 && i % 2 === 0 ? "Senior" : "Junior",
        isGraduateScheme: i % 2 === 1,
        jobDescription: "Excel and process mapping required. Requirements gathering with stakeholders.",
        status: i < 2 ? "Rejected" : "Applied",
        interviewStage: i < 2 ? "First interview" : "None",
        interviewOutcome: i < 2 ? "Unsuccessful" : "Not applicable",
      });
    });
    const r = runDiagnosis({ profile: profile({ yearsExperience: 1 }), cvVersions: [quantifiedCv], applications: apps, today: TODAY });
    expect(r.primary).toBe("Targeting");
  });

  it("Qualification", () => {
    const apps = dates(20).map((date, i) =>
      app({
        dateApplied: date,
        roleFamily: "Finance and Accounting",
        jobDescription:
          i < 16 ? "Assistant accountant. CIMA or ACCA part-qualification is essential. Budgeting experience required. Excel required." : "Assistant accountant. Excel required.",
        feedback: i < 2 ? "Applicants must be CIMA part-qualified for this role." : "",
      }),
    );
    const finCv = cv("cv1", "CV", {
      statement: "Accounting graduate.",
      bullets: ["Reconciled 300 invoices a month with 99% accuracy.", "Produced 12 monthly financial reporting packs.", "Cut month-end close by 2 days."],
      skills: ["Excel"],
    });
    const r = runDiagnosis({
      profile: profile({ targetRoleFamilies: ["Finance and Accounting"], skills: ["Excel"] }),
      cvVersions: [finCv],
      applications: apps,
      today: TODAY,
    });
    expect(r.primary).toBe("Qualification");
  });

  it("Positioning", () => {
    const apps = dates(20).map((date) =>
      app({ dateApplied: date, roleFamily: "Data Analysis", jobDescription: "Data analyst for operations. SQL, Power BI and stakeholder management are essential." }),
    );
    const plainCv = cv("cv1", "CV", {
      statement: "Motivated, hard-working graduate seeking an exciting opportunity.",
      bullets: ["Reduced picking errors by 20% across 3 sites.", "Cut onboarding time by 2 days for 15 new starters.", "Grew repeat orders 12% in one quarter."],
    });
    const r = runDiagnosis({
      profile: profile({ targetRoleFamilies: ["Data Analysis"], skills: ["SQL", "Power BI", "Stakeholder management"] }),
      cvVersions: [plainCv],
      applications: apps,
      today: TODAY,
    });
    expect(r.primary).toBe("Positioning");
  });

  it("Delivery", () => {
    const apps = dates(20).map((date, i) =>
      app({
        dateApplied: date,
        jobDescription: "Business analyst. Excel and process mapping required.",
        interviewStage: i < 6 ? "First interview" : "None",
        interviewOutcome: i < 6 ? "Unsuccessful" : "Not applicable",
        feedback: i < 6 ? "Answers were too general and not structured." : "",
      }),
    );
    const r = runDiagnosis({ profile: profile(), cvVersions: [quantifiedCv], applications: apps, today: TODAY });
    expect(r.primary).toBe("Delivery");
  });

  it("refuses to run with too little data", () => {
    const apps = dates(6).map((date) => app({ dateApplied: date }));
    expect(readiness({ profile: profile(), cvVersions: [quantifiedCv], applications: apps, today: TODAY }).canRun).toBe(false);
  });

  it("reports no dominant cause when signals are weak", () => {
    const halfCv = cv("cv1", "CV", {
      statement: "Business analyst.",
      bullets: ["Reduced reporting time by 30%.", "Managed the weekly team rota.", "Cut stock errors by 10%.", "Prepared supplier reports."],
      skills: ["Excel"],
    });
    const apps = dates(12).map((date, i) =>
      app({
        dateApplied: date,
        roleFamily: i < 8 ? "Business Analysis" : "Data Analysis",
        jobDescription: "Excel required.",
        status: i < 3 ? "Interview" : "Rejected",
        interviewStage: i < 3 ? "First interview" : "None",
        interviewOutcome: i < 3 ? "Awaiting outcome" : "Not applicable",
      }),
    );
    const r = runDiagnosis({ profile: profile({ targetRoleFamilies: ["Business Analysis", "Data Analysis"], skills: ["Excel"] }), cvVersions: [halfCv], applications: apps, today: TODAY });
    expect(r.primary).toBeNull();
  });
});

describe("closed-loop evaluation", () => {
  const before = dates(10, "2026-06-01").map((date, i) => app({ dateApplied: date, interviewStage: i < 2 ? "First interview" : "None" }));
  const after = (count: number, interviews: number) =>
    dates(count, "2026-08-01").map((date, i) => app({ dateApplied: date, interviewStage: i < interviews ? "First interview" : "None" }));
  const evaluate = (apps: ReturnType<typeof app>[]) =>
    evaluateDiagnosis({ diagnosisId: "d1", causeClass: "Evidence", changesAppliedAt: "2026-08-01", applications: [...before, ...apps], today: TODAY }).verdict;

  it("collecting", () => expect(evaluate(after(5, 3))).toBe("collecting"));
  it("corroborated", () => expect(evaluate(after(8, 4))).toBe("corroborated"));
  it("weakened", () => expect(evaluate(after(8, 1))).toBe("weakened"));
  it("inconclusive", () => expect(evaluate(after(8, 2))).toBe("inconclusive"));
});

describe("evaluation baseline", () => {
  it("falls back to the most recent earlier applications when the 90-day window is thin", () => {
    const old = dates(12, "2026-03-01").map((date) => app({ dateApplied: date }));
    const after = dates(8, "2026-10-01").map((date, i) => app({ dateApplied: date, interviewStage: i < 3 ? "First interview" : "None" }));
    const r = evaluateDiagnosis({ diagnosisId: "d2", causeClass: "Evidence", changesAppliedAt: "2026-10-01", applications: [...old, ...after], today: TODAY });
    expect(r.before.n).toBe(10);
    expect(r.verdict).toBe("corroborated");
  });
});
