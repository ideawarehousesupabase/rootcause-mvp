import type { Application, CandidateProfile, CauseClass, CvVersion, EvidenceRef, Signal } from "@/data/types";
import { DELIVERY_SMALL_SAMPLE, FEEDBACK_TERMS, WEIGHTS } from "./config";
import { funnel, hasInterview, isDecided, isFinishedInterview, isUnsuccessful, isUnsuccessfulInterview, type Funnel } from "./funnel";
import { canonicalSkills, findSkills, findTerms, linear, mean, normalise, pct, ratio } from "./text";

// Stage 2 (pattern analysis) and the per-class signals used in Stage 3.

const MAX_REFS = 6;
const appRef = (a: Application): EvidenceRef => ({ type: "application", id: a.id, excerpt: `${a.jobTitle} — ${a.employer}` });
const feedbackRef = (a: Application, text: string): EvidenceRef => ({ type: "feedback", id: a.id, excerpt: `${a.employer}: "${text}"` });
const bulletRef = (cvId: string, index: number, text: string): EvidenceRef => ({ type: "cvBullet", id: `${cvId}#${index}`, excerpt: text });
const profileRef = (field: string, excerpt: string): EvidenceRef => ({ type: "profile", id: field, excerpt });

export interface EngineContext {
  today: string;
  profile: CandidateProfile;
  apps: Application[];
  decided: Application[];
  withJd: Application[];
  cvById: Map<string, CvVersion>;
  mainCv: CvVersion | undefined;
  profileSkills: Set<string>;
  funnel: Funnel;
  feedbackHits: Record<CauseClass, { app: Application; text: string }[]>;
  interviewed: Application[];
  finishedInterviews: Application[];
}

export function buildContext(profile: CandidateProfile, cvVersions: CvVersion[], applications: Application[], today: string): EngineContext {
  const apps = applications.filter((a) => a.status !== "Withdrawn");
  const decided = apps.filter((a) => isDecided(a, today));
  const cvById = new Map(cvVersions.map((c) => [c.id, c]));
  const usage = new Map<string, number>();
  decided.forEach((a) => usage.set(a.cvVersionId, (usage.get(a.cvVersionId) ?? 0) + 1));
  const mainCvId = [...usage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainCv = (mainCvId && cvById.get(mainCvId)) || cvVersions[0];

  const profileSkills = new Set([...canonicalSkills(profile.skills), ...findSkills(profile.workExperience)]);

  const feedbackHits = { Targeting: [], Qualification: [], Positioning: [], Evidence: [], Delivery: [] } as EngineContext["feedbackHits"];
  for (const a of decided) {
    if (!isUnsuccessful(a, today) && a.interviewOutcome !== "Unsuccessful") continue;
    for (const text of [a.feedback, a.recruiterResponse].filter((t) => t.trim())) {
      const n = normalise(text);
      (Object.keys(FEEDBACK_TERMS) as CauseClass[]).forEach((cls) => {
        if (findTerms(n, FEEDBACK_TERMS[cls]).length && !feedbackHits[cls].some((h) => h.app.id === a.id)) feedbackHits[cls].push({ app: a, text });
      });
    }
  }

  return {
    today,
    profile,
    apps,
    decided,
    withJd: decided.filter((a) => a.jobDescription.trim()),
    cvById,
    mainCv,
    profileSkills,
    funnel: funnel(apps, today),
    feedbackHits,
    interviewed: decided.filter(hasInterview),
    finishedInterviews: decided.filter(isFinishedInterview),
  };
}

function signal(id: string, label: string, value: number, weight: number, detail: string, refs: EvidenceRef[] = []): Signal {
  const v = Math.max(0, Math.min(1, value));
  return { id, label, value: Math.round(v * 1000) / 1000, weight, contribution: Math.round(v * weight * 1000) / 1000, detail, evidenceRefs: refs.slice(0, MAX_REFS) };
}

const cvSkillsFor = (ctx: EngineContext, a: Application) => new Set(ctx.cvById.get(a.cvVersionId)?.analysis.mentionedSkills ?? []);

// ---------------- Targeting ----------------
export function targetingSignals(ctx: EngineContext): Signal[] {
  const w = WEIGHTS.Targeting;
  const families = new Map<string, Application[]>();
  ctx.decided.forEach((a) => families.set(a.roleFamily, [...(families.get(a.roleFamily) ?? []), a]));
  const familyCount = families.size;
  const t1 = familyCount <= 1 ? 0 : familyCount === 2 ? 0.35 : familyCount === 3 ? 0.7 : 1;

  const targets = ctx.profile.targetRoleFamilies;
  const offTarget = targets.length ? ctx.decided.filter((a) => !targets.includes(a.roleFamily)) : [];
  const years = ctx.profile.yearsExperience;
  const mismatch = ctx.decided.filter(
    (a) => (a.jdAnalysis.minYears !== null && a.jdAnalysis.minYears > years + 1) || ((a.seniority === "Senior" || a.seniority === "Lead / Manager") && years < 3),
  );
  const schemes = ctx.decided.filter((a) => a.isGraduateScheme);
  const schemeShare = ratio(schemes.length, ctx.decided.length);

  const familyRates = [...families.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([family, list]) => ({ family, rate: ratio(list.filter(hasInterview).length, list.length), n: list.length }));
  const spread = familyRates.length >= 2 ? Math.max(...familyRates.map((f) => f.rate)) - Math.min(...familyRates.map((f) => f.rate)) : 0;

  return [
    signal("T1", "Spread across role families", t1, w.T1, `${familyCount} role famil${familyCount === 1 ? "y" : "ies"}: ${[...families.entries()].map(([f, l]) => `${f} (${l.length})`).join(", ")}`),
    signal(
      "T2",
      "Applications outside target families",
      ratio(offTarget.length, ctx.decided.length),
      w.T2,
      targets.length ? `${offTarget.length} of ${ctx.decided.length} outside ${targets.join(", ")}` : "No target role families set in profile",
      offTarget.map(appRef),
    ),
    signal("T3", "Seniority mismatch", ratio(mismatch.length, ctx.decided.length), w.T3, `${mismatch.length} roles ask for more than ${years + 1} years or are senior-level`, mismatch.map(appRef)),
    signal("T4", "Saturated routes (graduate schemes)", linear(schemeShare, 0.3, 0.8), w.T4, `${schemes.length} graduate-scheme applications (${pct(schemeShare)}%)`, schemes.map(appRef)),
    signal(
      "T5",
      "Uneven progression between role families",
      linear(spread, 0.1, 0.35),
      w.T5,
      familyRates.length >= 2 ? familyRates.map((f) => `${f.family} ${pct(f.rate)}% to interview`).join("; ") : "Needs two role families with 3+ decided applications",
    ),
  ];
}

// ---------------- Qualification ----------------
const DEGREE_RANK: Record<string, number> = { First: 4, "2:1": 3, "2:2": 2, Third: 1, Pass: 0, Other: 0, None: 0 };

export function qualificationSignals(ctx: EngineContext): Signal[] {
  const w = WEIGHTS.Qualification;
  const held = ctx.profile.qualifications.map((q) => q.toLowerCase());
  const holds = (q: string) => held.some((h) => h.includes(q.toLowerCase()) || q.toLowerCase().includes(h));

  const qualMissing = ctx.withJd.filter((a) => a.jdAnalysis.requiredQualifications.some((q) => !holds(q)));
  const missingNames = [...new Set(qualMissing.flatMap((a) => a.jdAnalysis.requiredQualifications.filter((q) => !holds(q))))];

  const skillGapShares: number[] = [];
  const gapRefs: EvidenceRef[] = [];
  const missingSkills = new Map<string, number>();
  for (const a of ctx.withJd) {
    const req = a.jdAnalysis.requiredSkills;
    if (!req.length) continue;
    const cvSkills = cvSkillsFor(ctx, a);
    const missing = req.filter((s) => !ctx.profileSkills.has(s) && !cvSkills.has(s));
    missing.forEach((s) => missingSkills.set(s, (missingSkills.get(s) ?? 0) + 1));
    skillGapShares.push(ratio(missing.length, req.length));
    if (missing.length) gapRefs.push(appRef(a));
  }
  const topMissing = [...missingSkills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const hits = ctx.feedbackHits.Qualification;
  const rank = DEGREE_RANK[ctx.profile.degreeClassification] ?? 0;
  const degreeBelow = ctx.withJd.filter((a) => a.jdAnalysis.requiresDegreeClass && rank < DEGREE_RANK[a.jdAnalysis.requiresDegreeClass]);

  return [
    signal(
      "Q1",
      "Required qualification not held",
      ratio(qualMissing.length, ctx.withJd.length),
      w.Q1,
      missingNames.length ? `${qualMissing.length} of ${ctx.withJd.length} job descriptions require ${missingNames.join(", ")}` : "No required qualifications missing",
      qualMissing.map(appRef),
    ),
    signal(
      "Q2",
      "Required skills not evidenced anywhere",
      mean(skillGapShares),
      w.Q2,
      topMissing.length ? `Most often missing: ${topMissing.map(([s, n]) => `${s} (${n})`).join(", ")}` : "Required skills are covered by profile or CV",
      gapRefs,
    ),
    signal("Q3", "Qualification-related feedback", Math.min(1, hits.length / 2), w.Q3, `${hits.length} feedback item(s)`, hits.map((h) => feedbackRef(h.app, h.text))),
    signal(
      "Q4",
      "Degree classification below requirement",
      ratio(degreeBelow.length, ctx.withJd.length),
      w.Q4,
      `${degreeBelow.length} roles require a higher classification than ${ctx.profile.degreeClassification}`,
      degreeBelow.map(appRef),
    ),
  ];
}

// ---------------- Positioning ----------------
export function positioningSignals(ctx: EngineContext): Signal[] {
  const w = WEIGHTS.Positioning;
  const hiddenShares: number[] = [];
  const coverage: number[] = [];
  const hiddenSkills = new Map<string, number>();
  const hiddenRefs: EvidenceRef[] = [];
  for (const a of ctx.withJd) {
    const cvSkills = cvSkillsFor(ctx, a);
    const req = a.jdAnalysis.requiredSkills;
    if (req.length) {
      const hidden = req.filter((s) => ctx.profileSkills.has(s) && !cvSkills.has(s));
      hidden.forEach((s) => hiddenSkills.set(s, (hiddenSkills.get(s) ?? 0) + 1));
      hiddenShares.push(ratio(hidden.length, req.length));
      if (hidden.length) hiddenRefs.push(appRef(a));
    }
    const kw = a.jdAnalysis.keywords;
    if (kw.length) coverage.push(ratio(kw.filter((k) => cvSkills.has(k)).length, kw.length));
  }
  const topHidden = [...hiddenSkills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const cv = ctx.mainCv;
  const generic = cv?.analysis.genericStatement ?? false;

  const familiesPerCv = new Map<string, Set<string>>();
  ctx.decided.forEach((a) => familiesPerCv.set(a.cvVersionId, (familiesPerCv.get(a.cvVersionId) ?? new Set()).add(a.roleFamily)));
  const maxFamilies = Math.max(0, ...[...familiesPerCv.values()].map((s) => s.size));
  const p3 = maxFamilies >= 3 ? 1 : maxFamilies === 2 ? 0.5 : 0;

  return [
    signal(
      "P1",
      "Skills you hold but your CV doesn't show",
      mean(hiddenShares),
      w.P1,
      topHidden.length ? `In profile but missing from CV: ${topHidden.map(([s, n]) => `${s} (asked for in ${n})`).join(", ")}` : "No hidden skills found",
      hiddenRefs,
    ),
    signal(
      "P2",
      "Generic personal statement",
      generic ? 1 : 0,
      w.P2,
      generic ? cv!.analysis.genericReasons.join("; ") : "Personal statement is specific",
      generic && cv ? [{ type: "cvBullet", id: `${cv.id}#statement`, excerpt: cv.personalStatement }] : [],
    ),
    signal("P3", "Same CV used across role families", p3, w.P3, `One CV version used across up to ${maxFamilies} role famil${maxFamilies === 1 ? "y" : "ies"}`),
    signal(
      "P4",
      "Low job-description keyword coverage",
      coverage.length ? 1 - mean(coverage) : 0,
      w.P4,
      coverage.length ? `CV covers ${pct(mean(coverage))}% of job-description keywords on average` : "No job descriptions with keywords",
    ),
  ];
}

// ---------------- Evidence ----------------
export function evidenceSignals(ctx: EngineContext): Signal[] {
  const w = WEIGHTS.Evidence;
  const cv = ctx.mainCv;
  const bullets = cv?.analysis.bullets ?? [];
  const unquantified = bullets.map((b, i) => ({ b, i })).filter(({ b }) => !b.quantified);
  const weak = bullets.map((b, i) => ({ b, i })).filter(({ b }) => b.weakOpening);
  const impact = ctx.withJd.filter((a) => a.jdAnalysis.impactDemand);
  const hits = ctx.feedbackHits.Evidence;
  const rate = ctx.funnel.interviewRate;
  return [
    signal(
      "E1",
      "Experience without measurable results",
      cv ? 1 - cv.analysis.quantifiedRatio : 0,
      w.E1,
      cv ? `${unquantified.length} of ${bullets.length} bullets in "${cv.label}" have no measurable result` : "No CV",
      cv ? unquantified.map(({ b, i }) => bulletRef(cv.id, i, b.text)) : [],
    ),
    signal(
      "E2",
      "Responsibility-style phrasing",
      cv ? cv.analysis.weakOpeningRatio : 0,
      w.E2,
      `${weak.length} of ${bullets.length} bullets start with phrases like "responsible for" or "assisted"`,
      cv ? weak.map(({ b, i }) => bulletRef(cv.id, i, b.text)) : [],
    ),
    signal("E3", "Target roles ask for proven impact", ratio(impact.length, ctx.withJd.length), w.E3, `${impact.length} of ${ctx.withJd.length} job descriptions ask for measurable impact`, impact.map(appRef)),
    signal("E4", "Feedback about evidence of results", Math.min(1, hits.length / 2), w.E4, `${hits.length} feedback item(s)`, hits.map((h) => feedbackRef(h.app, h.text))),
    signal(
      "E5",
      "Applications not reaching interview",
      1 - linear(rate, 0.1, 0.3),
      w.E5,
      `${ctx.funnel.interviews} of ${ctx.funnel.decided} decided applications reached interview (${pct(rate)}%)`,
    ),
  ];
}

// ---------------- Delivery ----------------
export function deliverySignals(ctx: EngineContext): { signals: Signal[]; assessable: boolean; smallSample: boolean } {
  const w = WEIGHTS.Delivery;
  const finished = ctx.finishedInterviews;
  const unsuccessful = finished.filter(isUnsuccessfulInterview);
  const hits = ctx.feedbackHits.Delivery;
  const signals = [
    signal(
      "D1",
      "Interviews ending unsuccessfully",
      ratio(unsuccessful.length, finished.length),
      w.D1,
      `${unsuccessful.length} of ${finished.length} finished interviews were unsuccessful`,
      unsuccessful.map(appRef),
    ),
    signal("D2", "Interview feedback about answers", Math.min(1, hits.length / 2), w.D2, `${hits.length} feedback item(s)`, hits.map((h) => feedbackRef(h.app, h.text))),
    signal(
      "D3",
      "Applications already converting to interview",
      linear(ctx.funnel.interviewRate, 0.05, 0.15),
      w.D3,
      `${pct(ctx.funnel.interviewRate)}% of decided applications reach interview`,
    ),
  ];
  return { signals, assessable: finished.length >= 1, smallSample: finished.length < DELIVERY_SMALL_SAMPLE.interviews };
}

export { profileRef };
