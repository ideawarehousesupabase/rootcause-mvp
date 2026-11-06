import type { Application, CauseClass, ClassMultipliers, EvaluationResult, Verdict } from "@/data/types";
import { CAUSE_CLASSES } from "@/data/types";
import { CALIBRATION_STEP, EVALUATION } from "./config";
import { addDays, hasInterview, hasOffer, isDecided, isFinishedInterview } from "./funnel";
import { ratio, round2 } from "./text";

// Stage 7 — closed-loop outcome measurement.

export function evaluateDiagnosis(params: {
  diagnosisId: string;
  causeClass: CauseClass;
  changesAppliedAt: string;
  applications: Application[];
  today: string;
}): EvaluationResult {
  const { causeClass, changesAppliedAt, today } = params;
  const decided = params.applications.filter((a) => a.status !== "Withdrawn" && isDecided(a, today));
  const windowStart = addDays(changesAppliedAt, -EVALUATION.beforeWindowDays);
  const prior = decided.filter((a) => a.dateApplied < changesAppliedAt).sort((x, y) => y.dateApplied.localeCompare(x.dateApplied));
  const inWindow = prior.filter((a) => a.dateApplied >= windowStart);
  const before = inWindow.length >= EVALUATION.minBeforeApplications ? inWindow : prior.slice(0, EVALUATION.minBeforeApplications);
  const after = decided.filter((a) => a.dateApplied >= changesAppliedAt);

  const isDelivery = causeClass === "Delivery";
  const measure = (list: Application[]) => {
    if (isDelivery) {
      const finished = list.filter(isFinishedInterview);
      return { n: finished.length, rate: round2(ratio(finished.filter(hasOffer).length, finished.length)) };
    }
    return { n: list.length, rate: round2(ratio(list.filter(hasInterview).length, list.length)) };
  };
  const b = measure(before);
  const a = measure(after);
  const required = isDelivery ? EVALUATION.requiredAfterInterviews : EVALUATION.requiredAfterApplications;

  let verdict: Verdict;
  const gain = a.rate - b.rate;
  if (a.n < required) verdict = "collecting";
  else if (gain >= EVALUATION.corroborateMinGain && a.rate >= EVALUATION.corroborateMinRatio * b.rate) verdict = "corroborated";
  else if (gain < EVALUATION.weakenMaxGain) verdict = "weakened";
  else verdict = "inconclusive";

  return {
    diagnosisId: params.diagnosisId,
    causeClass,
    metric: isDelivery ? "interviewToOffer" : "interviewRate",
    changesAppliedAt,
    before: b,
    after: a,
    required,
    verdict,
  };
}

// Stage 8 — imitation of model learning, per candidate.
export function defaultMultipliers(): ClassMultipliers {
  return Object.fromEntries(CAUSE_CLASSES.map((c) => [c, 1])) as ClassMultipliers;
}

export function applyVerdict(m: ClassMultipliers, cls: CauseClass, verdict: Verdict): ClassMultipliers {
  const next = { ...m };
  if (verdict === "corroborated") next[cls] = round2(Math.min(CALIBRATION_STEP.max, m[cls] * CALIBRATION_STEP.up));
  if (verdict === "weakened") next[cls] = round2(Math.max(CALIBRATION_STEP.min, m[cls] * CALIBRATION_STEP.down));
  return next;
}
