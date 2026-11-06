import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import type { ActionStatus, ClassMultipliers, CorrectiveAction, Diagnosis, DiagnosisResult, EvaluationResult, Verdict } from "@/data/types";
import type { ActionDraft } from "@/engine";
import { requireDb } from "@/lib/firebase";
import { subCol, subDoc } from "./paths";

/** Store a new immutable diagnosis snapshot, supersede the previous one and archive its open actions. */
export async function saveDiagnosis(uid: string, result: DiagnosisResult, drafts: ActionDraft[], previous: Diagnosis[], openActions: CorrectiveAction[]) {
  const batch = writeBatch(requireDb());
  const ref = doc(subCol(uid, "diagnoses"));
  batch.set(ref, { ...result, status: "active", changesAppliedAt: null, createdAt: serverTimestamp() });
  previous
    .filter((d) => d.status === "active" || d.status === "inconclusive")
    .forEach((d) => batch.update(subDoc(uid, "diagnoses", d.id), { status: "superseded" }));
  openActions.filter((a) => !a.archived).forEach((a) => batch.update(subDoc(uid, "actions", a.id), { archived: true }));
  drafts.forEach((d) =>
    batch.set(doc(subCol(uid, "actions")), { ...d, diagnosisId: ref.id, startedAt: null, completedAt: null, archived: false }),
  );
  await batch.commit();
  return ref.id;
}

export async function setActionStatus(uid: string, action: CorrectiveAction, status: ActionStatus) {
  await updateDoc(subDoc(uid, "actions", action.id), {
    status,
    startedAt: status === "To Do" ? null : action.startedAt ?? serverTimestamp(),
    completedAt: status === "Completed" ? serverTimestamp() : null,
  });
}

export const setChangesApplied = (uid: string, diagnosisId: string, date: string | null) =>
  updateDoc(subDoc(uid, "diagnoses", diagnosisId), { changesAppliedAt: date });

/** One evaluation document per diagnosis, kept up to date as new outcomes arrive. */
export const writeEvaluation = (uid: string, result: EvaluationResult) =>
  setDoc(subDoc(uid, "evaluations", result.diagnosisId), { ...result, appliedToCalibration: false, createdAt: serverTimestamp() }, { merge: true });

/** Apply a final verdict once: diagnosis status, calibration, and unlocking queued actions on "weakened". */
export async function finaliseVerdict(uid: string, diagnosisId: string, verdict: Verdict, multipliers: ClassMultipliers, queued: CorrectiveAction[]) {
  const batch = writeBatch(requireDb());
  batch.update(subDoc(uid, "diagnoses", diagnosisId), { status: verdict });
  batch.set(subDoc(uid, "engineState", "calibration"), { classMultipliers: multipliers }, { merge: true });
  batch.update(subDoc(uid, "evaluations", diagnosisId), { appliedToCalibration: true });
  if (verdict === "weakened") queued.forEach((a) => batch.update(subDoc(uid, "actions", a.id), { status: "To Do", priority: "High" }));
  await batch.commit();
}

export const markInconclusive = (uid: string, diagnosisId: string) => updateDoc(subDoc(uid, "diagnoses", diagnosisId), { status: "inconclusive" });
