import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import type { RoadmapStatus, RoadmapStep, Recommendations } from "@/data/types";
import type { Funnel, RoadmapDraft } from "@/engine";
import { requireDb } from "@/lib/firebase";
import { subCol, subDoc } from "./paths";

// Career development records: progress snapshots, skills/course recommendations and the roadmap.

/** One snapshot per calendar month of the overall funnel, overwritten while the month is current. */
export const saveProgressSnapshot = (uid: string, today: string, f: Funnel) =>
  setDoc(subDoc(uid, "progressSnapshots", today.slice(0, 7)), {
    applications: f.applications,
    decided: f.decided,
    responses: f.responses,
    interviews: f.interviews,
    offers: f.offers,
    responseRate: f.responseRate,
    interviewRate: f.interviewRate,
    interviewToOffer: f.interviewToOffer,
    updatedAt: serverTimestamp(),
  });

export const saveRecommendations = (uid: string, rec: Omit<Recommendations, "generatedAt">) =>
  setDoc(subDoc(uid, "recommendations", "current"), { ...rec, generatedAt: serverTimestamp() });

/** Add steps to the end of the roadmap. */
export async function addRoadmapSteps(uid: string, drafts: RoadmapDraft[], startOrder: number) {
  const batch = writeBatch(requireDb());
  drafts.forEach((d, i) =>
    batch.set(doc(subCol(uid, "roadmap")), { ...d, order: startOrder + i, status: d.status ?? "To Do", createdAt: serverTimestamp(), completedAt: null }),
  );
  await batch.commit();
}

export const setRoadmapStatus = (uid: string, step: RoadmapStep, status: RoadmapStatus) =>
  updateDoc(subDoc(uid, "roadmap", step.id), { status, completedAt: status === "Completed" ? serverTimestamp() : null });

export const setRoadmapTargetDate = (uid: string, step: RoadmapStep, targetDate: string | null) =>
  updateDoc(subDoc(uid, "roadmap", step.id), { targetDate });

export const deleteRoadmapStep = (uid: string, step: RoadmapStep) => deleteDoc(subDoc(uid, "roadmap", step.id));

/** Swap a step with its neighbour. */
export async function moveRoadmapStep(uid: string, steps: RoadmapStep[], index: number, dir: -1 | 1) {
  const other = steps[index + dir];
  const step = steps[index];
  if (!other || !step) return;
  const batch = writeBatch(requireDb());
  batch.update(subDoc(uid, "roadmap", step.id), { order: other.order });
  batch.update(subDoc(uid, "roadmap", other.id), { order: step.order });
  await batch.commit();
}
