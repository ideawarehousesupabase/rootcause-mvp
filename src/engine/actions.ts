import type { ActionStatus, CauseClass, CorrectiveAction, DiagnosisResult, Priority } from "@/data/types";
import { DELIVERY_COMPETENCIES, EVALUATION } from "./config";
import type { EngineInput } from "./diagnose";
import { hasInterview } from "./funnel";
import { buildContext, type EngineContext } from "./signals";
import { findTerms, normalise, pct, ratio } from "./text";

export type ActionDraft = Pick<CorrectiveAction, "causeClass" | "templateId" | "title" | "description" | "steps" | "successMeasure" | "priority" | "status">;

const APP_MEASURE = `Application-to-interview rate over your next ${EVALUATION.requiredAfterApplications} decided applications.`;
const INTERVIEW_MEASURE = `Interview-to-offer rate over your next ${EVALUATION.requiredAfterInterviews} finished interviews.`;

type Template = (ctx: EngineContext, r: DiagnosisResult) => Omit<ActionDraft, "causeClass" | "status"> | null;

const quote = (xs: string[], n = 4) => xs.slice(0, n).map((x) => `"${x}"`);

// Stage 6 — corrective action library (imitates AI recommendations).
const LIBRARY: Record<CauseClass, Template[]> = {
  Evidence: [
    (ctx) => {
      const weak = (ctx.mainCv?.analysis.bullets ?? []).filter((b) => b.strength === "Weak");
      if (!weak.length) return null;
      return {
        templateId: "evidence-rewrite-bullets",
        title: `Rewrite your ${weak.length} weakest CV bullet${weak.length === 1 ? "" : "s"}`,
        description: `These statements describe duties without a result: ${quote(weak.map((b) => b.text)).join(", ")}${weak.length > 4 ? " and others" : ""}.`,
        steps: [
          "Use the pattern: action verb + what you did + measurable result (time saved, % change, volume, £ value).",
          ...weak.slice(0, 4).map((b) => `Rewrite: "${b.text}" — ${b.reasons.join(", ").toLowerCase()}.`),
          "Save the rewrite as a new CV version so its effect can be measured.",
        ],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    (ctx) => ({
      templateId: "evidence-lead-with-achievements",
      title: "Lead each role with quantified achievements",
      description: `Put your strongest, measurable result first under each role${ctx.mainCv ? ` in "${ctx.mainCv.label}"` : ""}, so a recruiter skimming the CV sees impact first.`,
      steps: ["For each role, move the most quantified bullet to the top.", "Cut duty-only bullets that add no evidence.", "Keep each bullet to one or two lines."],
      successMeasure: APP_MEASURE,
      priority: "Medium",
    }),
    () => ({
      templateId: "evidence-metric-bank",
      title: "Build a bank of numbers from past roles",
      description: "List the volumes, time savings, error reductions and results you can honestly evidence, so every application can draw on them.",
      steps: ["Go through each past role and note any numbers: people, hours, %, £, items, customers.", "Check records or ask former colleagues where you are unsure.", "Use only figures you can explain at interview."],
      successMeasure: APP_MEASURE,
      priority: "Medium",
    }),
  ],
  Positioning: [
    (ctx) => {
      const hidden = new Map<string, number>();
      for (const a of ctx.withJd) {
        const cvSkills = new Set(ctx.cvById.get(a.cvVersionId)?.analysis.mentionedSkills ?? []);
        a.jdAnalysis.requiredSkills.filter((s) => ctx.profileSkills.has(s) && !cvSkills.has(s)).forEach((s) => hidden.set(s, (hidden.get(s) ?? 0) + 1));
      }
      const list = [...hidden.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (!list.length) return null;
      return {
        templateId: "positioning-show-hidden-skills",
        title: "Add skills you hold but don't show",
        description: `Your profile includes ${list.map(([s, n]) => `${s} (required in ${n} job descriptions)`).join(", ")}, but your CV doesn't mention them.`,
        steps: ["Add each skill to your skills section using the wording employers use.", "Back each one with a bullet showing where you used it.", "Save as a new CV version."],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    (ctx) => {
      const family = ctx.profile.targetRoleFamilies[0] ?? ctx.decided[0]?.roleFamily ?? "your target role";
      return {
        templateId: "positioning-targeted-cv",
        title: `Create a targeted CV for ${family}`,
        description: "Rewrite your personal statement and skills section for one role family instead of a general CV.",
        steps: [`Name the ${family} role you want in the first line.`, "Replace generic phrases (hard-working, motivated) with two specific strengths.", "Mirror the most common keywords from your target job descriptions."],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    () => ({
      templateId: "positioning-transferable",
      title: "Translate transferable experience",
      description: "Describe past experience in the language of the target role, e.g. 'handled complaints' → 'resolved customer issues and identified root causes'.",
      steps: ["Pick three past tasks most relevant to the target role.", "Rewrite them using the target role's vocabulary.", "Check each still accurately describes what you did."],
      successMeasure: APP_MEASURE,
      priority: "Medium",
    }),
  ],
  Targeting: [
    (ctx) => {
      const fams = new Map<string, { n: number; i: number }>();
      ctx.decided.forEach((a) => {
        const f = fams.get(a.roleFamily) ?? { n: 0, i: 0 };
        fams.set(a.roleFamily, { n: f.n + 1, i: f.i + (hasInterview(a) ? 1 : 0) });
      });
      const best = [...fams.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => ratio(b[1].i, b[1].n) - ratio(a[1].i, a[1].n)).slice(0, 2);
      const names = best.length ? best.map(([f, v]) => `${f} (${pct(ratio(v.i, v.n))}% to interview from ${v.n})`).join(" and ") : ctx.profile.targetRoleFamilies.join(" and ");
      return {
        templateId: "targeting-focus-families",
        title: "Focus on the role families where you progress",
        description: `Concentrate applications on ${names}, and pause unrelated role types.`,
        steps: ["Set no more than two target role families in your profile.", "For the next applications, only apply within those families.", "Tailor one CV version per family."],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    (ctx) => ({
      templateId: "targeting-apply-at-level",
      title: "Apply at your level",
      description: `Prioritise roles asking for up to ${ctx.profile.yearsExperience + 1} year(s) of experience and junior or entry-level titles.`,
      steps: ["Check the experience requirement before applying.", "Skip roles titled Senior, Lead or Manager unless you meet the stated requirements.", "Record seniority for each application so progress can be compared."],
      successMeasure: APP_MEASURE,
      priority: "High",
    }),
    (_ctx, r) =>
      r.marketContext.schemeApplications > 0
        ? {
            templateId: "targeting-balance-routes",
            title: "Balance graduate schemes with direct-entry roles",
            description: `${r.marketContext.schemeApplications} of your applications were to high-volume graduate schemes. Add direct-entry junior roles at smaller employers, charities and the public sector.`,
            steps: ["For every scheme application, make one direct-entry application.", "Mark graduate schemes in the tracker so they can be compared."],
            successMeasure: APP_MEASURE,
            priority: "Medium",
          }
        : null,
  ],
  Qualification: [
    (ctx) => {
      const held = ctx.profile.qualifications.map((q) => q.toLowerCase());
      const counts = new Map<string, number>();
      ctx.withJd.forEach((a) => a.jdAnalysis.requiredQualifications.filter((q) => !held.some((h) => h.includes(q.toLowerCase()))).forEach((q) => counts.set(q, (counts.get(q) ?? 0) + 1)));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!top) return null;
      return {
        templateId: "qualification-route",
        title: `Plan a route to ${top[0]}`,
        description: `${top[0]} was required in ${top[1]} of your job descriptions. Either start working towards it or target roles that offer study support.`,
        steps: [`Check the entry route and cost for ${top[0]}.`, "Look for roles that sponsor study towards it.", "Deprioritise roles where it is mandatory until you are enrolled."],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    (ctx) => {
      const counts = new Map<string, number>();
      ctx.withJd.forEach((a) => {
        const cvSkills = new Set(ctx.cvById.get(a.cvVersionId)?.analysis.mentionedSkills ?? []);
        a.jdAnalysis.requiredSkills.filter((s) => !ctx.profileSkills.has(s) && !cvSkills.has(s)).forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
      });
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (!top.length) return null;
      return {
        templateId: "qualification-skill-gap",
        title: `Close the ${top[0][0]} gap`,
        description: `Required skills you don't yet evidence: ${top.map(([s, n]) => `${s} (${n} roles)`).join(", ")}.`,
        steps: [`Complete a short, practical course in ${top[0][0]}.`, "Build one small project you can describe at interview.", "Add the skill to your profile and CV once you can evidence it."],
        successMeasure: APP_MEASURE,
        priority: "High",
      };
    },
    () => ({
      templateId: "qualification-check-essentials",
      title: "Check essential criteria before applying",
      description: "Read the essential criteria of each advert and only apply where you meet them, or can show a clear plan to.",
      steps: ["Highlight essential vs desirable criteria in each advert.", "Skip roles where you miss an essential qualification.", "Note the gap in the tracker if you still apply."],
      successMeasure: APP_MEASURE,
      priority: "Medium",
    }),
  ],
  Delivery: [
    (ctx) => {
      const texts = ctx.interviewed.map((a) => normalise(a.feedback)).join(" ");
      const comps = findTerms(texts, DELIVERY_COMPETENCIES);
      const list = comps.length ? comps.join(", ") : "your target role's core competencies";
      return {
        templateId: "delivery-star-examples",
        title: "Prepare STAR examples",
        description: `Prepare six structured examples (situation, task, action, result) covering ${list}.`,
        steps: ["Write each example in four short parts.", "Include a measurable result in every example.", "Rehearse aloud and time each answer to around two minutes."],
        successMeasure: INTERVIEW_MEASURE,
        priority: "High",
      };
    },
    () => ({
      templateId: "delivery-reflection-log",
      title: "Log a reflection after each interview",
      description: "Straight after each interview, record the questions asked, how you answered and what you'd change.",
      steps: ["Add the questions to the application's feedback field.", "Rate each answer: strong, adequate, weak.", "Turn weak answers into new STAR examples."],
      successMeasure: INTERVIEW_MEASURE,
      priority: "Medium",
    }),
    () => ({
      templateId: "delivery-mock-interview",
      title: "Run a mock interview",
      description: "Practise with a careers adviser or friend using questions from your target job descriptions.",
      steps: ["Choose five likely questions.", "Record yourself or ask for specific feedback.", "Repeat until answers are structured and concise."],
      successMeasure: INTERVIEW_MEASURE,
      priority: "Medium",
    }),
  ],
};

function draftsFor(cls: CauseClass, status: ActionStatus, ctx: EngineContext, r: DiagnosisResult): ActionDraft[] {
  return LIBRARY[cls]
    .map((t) => t(ctx, r))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .slice(0, 3)
    .map((d) => ({ ...d, causeClass: cls, status, priority: (status === "Queued" ? "Low" : d.priority) as Priority }));
}

/** Primary actions start as To Do; secondary actions are Queued until the first change is measured. */
export function generateActions(input: EngineInput, result: DiagnosisResult): ActionDraft[] {
  if (!result.primary || !input.profile) return [];
  const ctx = buildContext(input.profile, input.cvVersions, input.applications, input.today);
  return [
    ...draftsFor(result.primary, "To Do", ctx, result),
    ...(result.secondary ? draftsFor(result.secondary, "Queued", ctx, result) : []),
  ];
}
