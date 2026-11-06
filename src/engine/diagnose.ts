import {
  CAUSE_CLASSES,
  type Application,
  type CandidateProfile,
  type CauseClass,
  type ClassMultipliers,
  type ClassResult,
  type CvVersion,
  type DiagnosisResult,
  type RationaleSentence,
  type Signal,
  type Sufficiency,
} from "@/data/types";
import {
  CALIBRATION,
  DELIVERY_MIN_INTERVIEWS_FOR_PRIMARY,
  DELIVERY_SMALL_SAMPLE,
  ENGINE_VERSION,
  LIMITED_FACTOR,
  MIN_CV_BULLETS_TO_RUN,
  MIN_DECIDED_TO_RUN,
  PRIMARY_THRESHOLD,
  SECONDARY_THRESHOLD,
  SUFFICIENT_DECIDED,
  SUFFICIENT_JD_SHARE,
  TIE_MARGIN,
} from "./config";
import { funnel } from "./funnel";
import {
  buildContext,
  deliverySignals,
  evidenceSignals,
  positioningSignals,
  qualificationSignals,
  targetingSignals,
  type EngineContext,
} from "./signals";
import { pct, ratio, round2 } from "./text";

export interface EngineInput {
  profile: CandidateProfile | null;
  cvVersions: CvVersion[];
  applications: Application[];
  multipliers?: Partial<ClassMultipliers>;
  today: string;
}

export interface Readiness {
  canRun: boolean;
  checks: { id: string; label: string; done: boolean; detail: string }[];
}

/** Minimum data needed before a diagnosis can run (Section 7.1). */
export function readiness(input: Omit<EngineInput, "multipliers">): Readiness {
  const p = input.profile;
  const profileDone = Boolean(p && p.targetRoleFamilies.length > 0);
  const bestCv = Math.max(0, ...input.cvVersions.map((c) => c.analysis.bulletCount));
  const f = funnel(input.applications, input.today);
  const checks = [
    { id: "profile", label: "Complete your profile", done: profileDone, detail: profileDone ? "Target role families set" : "Set target role families and years of experience" },
    {
      id: "cv",
      label: "Add a CV version",
      done: bestCv >= MIN_CV_BULLETS_TO_RUN,
      detail: bestCv >= MIN_CV_BULLETS_TO_RUN ? `${bestCv} experience bullets` : `Needs at least ${MIN_CV_BULLETS_TO_RUN} experience bullets`,
    },
    {
      id: "applications",
      label: `Log at least ${MIN_DECIDED_TO_RUN} decided applications`,
      done: f.decided >= MIN_DECIDED_TO_RUN,
      detail: `${f.decided} decided${f.pending ? `, ${f.pending} pending (under 30 days, no response yet)` : ""}`,
    },
  ];
  return { canRun: checks.every((c) => c.done), checks };
}

function sufficiencyOf(ctx: EngineContext): Sufficiency {
  if (ctx.decided.length < MIN_DECIDED_TO_RUN) return "insufficient";
  return ctx.decided.length >= SUFFICIENT_DECIDED && ratio(ctx.withJd.length, ctx.decided.length) >= SUFFICIENT_JD_SHARE ? "sufficient" : "limited";
}

function score(signals: Signal[], factor: number, multiplier: number) {
  const raw = signals.reduce((s, x) => s + x.contribution, 0);
  const calibrated = CALIBRATION.floor + CALIBRATION.scale * raw;
  return { raw: round2(raw), confidence: round2(Math.min(CALIBRATION.cap, calibrated * factor * multiplier)) };
}

const FUNNEL_ORDER: CauseClass[] = [...CAUSE_CLASSES];

function select(classes: Record<CauseClass, ClassResult>, finishedInterviews: number) {
  const eligible = (c: CauseClass) => classes[c].assessable && (c !== "Delivery" || finishedInterviews >= DELIVERY_MIN_INTERVIEWS_FOR_PRIMARY);
  const ranked = [...FUNNEL_ORDER].sort((a, b) => classes[b].confidence - classes[a].confidence);
  const top = ranked.find(eligible);
  let primary: CauseClass | null = null;
  if (top && classes[top].confidence >= PRIMARY_THRESHOLD) {
    // Within the tie margin, fix the earliest bottleneck in the funnel first.
    const close = FUNNEL_ORDER.filter((c) => eligible(c) && classes[top].confidence - classes[c].confidence <= TIE_MARGIN && classes[c].confidence >= PRIMARY_THRESHOLD);
    primary = close[0] ?? top;
  }
  const secondaryCandidate = ranked.find((c) => c !== primary && classes[c].assessable);
  const secondary = secondaryCandidate && classes[secondaryCandidate].confidence >= SECONDARY_THRESHOLD ? secondaryCandidate : null;
  return { primary, secondary };
}

const sig = (r: ClassResult, id: string) => r.signals.find((s) => s.id === id)!;
const top = (r: ClassResult, n = 2) => [...r.signals].sort((a, b) => b.contribution - a.contribution).slice(0, n);

/** Stage 5 — plain-language rationale built only from computed values. */
function rationaleFor(cls: CauseClass, r: ClassResult, ctx: EngineContext): RationaleSentence[] {
  const f = ctx.funnel;
  const cv = ctx.mainCv;
  switch (cls) {
    case "Evidence": {
      const e1 = sig(r, "E1");
      const e3 = sig(r, "E3");
      return [
        {
          text: `${e1.evidenceRefs.length ? e1.detail.replace(/ have no/, " describe duties without a") : e1.detail}, and ${pct(e3.value)}% of your target job descriptions ask for demonstrated, measurable impact.`,
          refs: [...e1.evidenceRefs.slice(0, 3), ...e3.evidenceRefs.slice(0, 2)],
        },
        {
          text: `With ${pct(f.interviewRate)}% of ${f.decided} decided applications reaching interview, the most probable constraint is at application screening: the CV${cv ? ` ("${cv.label}")` : ""} is not substantiating your capability.`,
          refs: [],
        },
        ...(sig(r, "E4").evidenceRefs.length ? [{ text: `Employer feedback points the same way.`, refs: sig(r, "E4").evidenceRefs }] : []),
      ];
    }
    case "Targeting": {
      const t1 = sig(r, "T1");
      const t2 = sig(r, "T2");
      const t3 = sig(r, "T3");
      return [
        { text: `Your ${f.decided} decided applications are spread across ${t1.detail}.`, refs: [] },
        { text: `${pct(t2.value)}% fall outside your target role families, and ${pct(t3.value)}% ask for more experience than your ${ctx.profile.yearsExperience} year(s).`, refs: [...t2.evidenceRefs.slice(0, 3), ...t3.evidenceRefs.slice(0, 2)] },
        ...(sig(r, "T5").value > 0 ? [{ text: `Progression differs by role family: ${sig(r, "T5").detail}.`, refs: [] }] : []),
      ];
    }
    case "Qualification": {
      const [a, b] = top(r);
      return [
        { text: `${a.detail}.`, refs: a.evidenceRefs },
        ...(b && b.value > 0 ? [{ text: `${b.detail}.`, refs: b.evidenceRefs }] : []),
        { text: `This looks like a genuine gap against stated requirements rather than a presentation issue.`, refs: [] },
      ];
    }
    case "Positioning": {
      const [a, b] = top(r);
      return [
        { text: `Your profile shows capability that your CV does not communicate. ${a.detail}.`, refs: a.evidenceRefs },
        ...(b && b.value > 0 ? [{ text: `${b.detail}.`, refs: b.evidenceRefs }] : []),
      ];
    }
    case "Delivery": {
      const d1 = sig(r, "D1");
      const d2 = sig(r, "D2");
      return [
        { text: `${f.interviews} application(s) reached interview; ${d1.detail.toLowerCase()}.`, refs: d1.evidenceRefs },
        ...(d2.evidenceRefs.length ? [{ text: `Feedback mentions how answers were delivered.`, refs: d2.evidenceRefs }] : []),
        { text: `Applications are getting through screening, so the most probable constraint is at interview.`, refs: [] },
      ];
    }
  }
}

/** Run the full rule-based diagnosis. Pure and deterministic. */
export function runDiagnosis(input: EngineInput): DiagnosisResult {
  if (!input.profile) throw new Error("Profile required");
  const ctx = buildContext(input.profile, input.cvVersions, input.applications, input.today);
  const sufficiency = sufficiencyOf(ctx);
  const factor = sufficiency === "limited" ? LIMITED_FACTOR : 1;
  const mult = (c: CauseClass) => input.multipliers?.[c] ?? 1;

  const build = (c: CauseClass, signals: Signal[], extra?: { assessable: boolean; rawFactor?: number; notes?: string[] }): ClassResult => {
    const assessable = extra?.assessable ?? true;
    if (!assessable) return { confidence: 0, raw: 0, assessable: false, notes: extra?.notes ?? [], signals };
    const scaled = extra?.rawFactor ? signals.map((s) => ({ ...s, contribution: Math.round(s.contribution * extra.rawFactor! * 1000) / 1000 })) : signals;
    const { raw, confidence } = score(scaled, factor, mult(c));
    return { confidence, raw, assessable: true, notes: extra?.notes ?? [], signals: scaled };
  };

  const delivery = deliverySignals(ctx);
  const classes: Record<CauseClass, ClassResult> = {
    Targeting: build("Targeting", targetingSignals(ctx)),
    Qualification: build("Qualification", qualificationSignals(ctx)),
    Positioning: build("Positioning", positioningSignals(ctx)),
    Evidence: build("Evidence", evidenceSignals(ctx)),
    Delivery: build("Delivery", delivery.signals, {
      assessable: delivery.assessable,
      rawFactor: delivery.smallSample ? DELIVERY_SMALL_SAMPLE.factor : undefined,
      notes: !delivery.assessable
        ? ["Not assessable — no finished interviews yet"]
        : delivery.smallSample
          ? [`Small sample (${ctx.finishedInterviews.length} finished interview${ctx.finishedInterviews.length === 1 ? "" : "s"}) — held for review`]
          : [],
    }),
  };

  const { primary, secondary } = select(classes, ctx.finishedInterviews.length);

  let rationale: RationaleSentence[];
  if (primary) {
    rationale = rationaleFor(primary, classes[primary], ctx);
  } else {
    const ranked = [...CAUSE_CLASSES].filter((c) => classes[c].assessable).sort((a, b) => classes[b].confidence - classes[a].confidence);
    rationale = [
      {
        text: `No single cause stands out yet. The leading hypotheses are ${ranked.slice(0, 2).map((c) => `${c} (${classes[c].confidence.toFixed(2)})`).join(" and ")}.`,
        refs: [],
      },
      { text: `Add more decided applications, paste job descriptions for each one, and log interview feedback to sharpen the diagnosis.`, refs: [] },
    ];
  }
  if (secondary) {
    rationale.push({
      text: `${secondary} (${classes[secondary].confidence.toFixed(2)}) is being monitored but not actioned yet, so the effect of the first change can be measured on its own.`,
      refs: [],
    });
  }

  const schemeApplications = ctx.decided.filter((a) => a.isGraduateScheme).length;
  const schemeShare = ratio(schemeApplications, ctx.decided.length);
  const calibrationNotes = CAUSE_CLASSES.filter((c) => mult(c) !== 1).map(
    (c) => `${c} ×${mult(c).toFixed(2)} — adjusted from your measured outcomes`,
  );

  return {
    engineVersion: ENGINE_VERSION,
    inputSummary: {
      applications: ctx.apps.length,
      decided: ctx.decided.length,
      pending: ctx.funnel.pending,
      interviews: ctx.funnel.interviews,
      cvVersions: input.cvVersions.length,
      feedbackItems: ctx.decided.filter((a) => a.feedback.trim() || a.recruiterResponse.trim()).length,
      withJobDescription: ctx.withJd.length,
    },
    sufficiency,
    classes,
    primary,
    secondary,
    rationale,
    marketContext: {
      schemeShare: round2(schemeShare),
      schemeApplications,
      note:
        schemeApplications > 0
          ? `${schemeApplications} of ${ctx.decided.length} decided applications were to graduate schemes. High-volume schemes are very competitive; this is context outside your control and is not treated as a root cause.`
          : "No graduate-scheme applications recorded. Market competition is treated as context, never as a root cause.",
    },
    calibrationNotes,
  };
}
