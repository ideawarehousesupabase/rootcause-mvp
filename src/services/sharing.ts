import { deleteDoc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import type { Application, CorrectiveAction, Diagnosis, Evaluation, MemberSummary, UserDoc } from "@/data/types";
import { funnel, monthlyActivity } from "@/engine";
import { requireDb } from "@/lib/firebase";
import { institutionRef, joinCodeRef, memberRef, userRef } from "./paths";
import { generateJoinCode } from "./users";

// Consented sharing: a candidate who enters an institution's join code and consents writes a
// summary to institutions/{id}/members/{uid}; the security rules only accept it while the
// candidate's own record names that institution. Withdrawing deletes the summary.

export async function lookupJoinCode(code: string) {
  const snap = await getDoc(joinCodeRef(code.trim().toUpperCase()));
  return snap.exists() ? (snap.data() as { institutionId: string; institutionName: string }) : null;
}

export interface SummaryInput {
  user: UserDoc;
  applications: Application[];
  latestDiagnosis: Diagnosis | null;
  actions: CorrectiveAction[];
  latestEvaluation: Evaluation | null;
  today: string;
}

/** Summary only: no CV text, job descriptions or feedback text leave the candidate's records. */
export function buildMemberSummary({ user, applications, latestDiagnosis, actions, latestEvaluation, today }: SummaryInput) {
  const f = funnel(applications, today);
  const current = actions.filter((a) => !a.archived && a.status !== "Queued");
  const lastAppDate = applications.map((a) => a.updatedAt?.toMillis?.() ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const primary = latestDiagnosis?.primary ?? null;
  return {
    candidateUid: user.uid,
    name: user.fullName,
    segment: user.profile?.segment ?? "",
    targetRole: user.profile?.targetRoles[0] ?? user.profile?.targetRoleFamilies[0] ?? "",
    funnel: {
      applications: f.applications,
      decided: f.decided,
      responses: f.responses,
      interviews: f.interviews,
      offers: f.offers,
      responseRate: f.responseRate,
      interviewRate: f.interviewRate,
      interviewToOffer: f.interviewToOffer,
    },
    monthly: monthlyActivity(applications, today),
    primaryCause: primary,
    secondaryCause: latestDiagnosis?.secondary ?? null,
    primaryConfidence: primary && latestDiagnosis ? latestDiagnosis.classes[primary].confidence : null,
    rationale: latestDiagnosis ? latestDiagnosis.rationale.map((s) => s.text).join(" ") : null,
    latestVerdict: latestEvaluation?.verdict ?? null,
    actions: actions.filter((a) => !a.archived).map((a) => ({ title: a.title, causeClass: a.causeClass, status: a.status })),
    actionsTotal: current.length,
    actionsCompleted: current.filter((a) => a.status === "Completed").length,
    lastActivityMillis: lastAppDate,
  };
}

export async function syncMemberSummary(input: SummaryInput) {
  const sharing = input.user.sharing;
  if (!sharing) return;
  const { lastActivityMillis, ...summary } = buildMemberSummary(input);
  const payload: Omit<MemberSummary, "lastActivityAt" | "updatedAt" | "consentedAt"> & Record<string, unknown> = {
    ...summary,
    consentedAt: sharing.consentedAt ?? serverTimestamp(),
    lastActivityAt: lastActivityMillis ? new Date(lastActivityMillis) : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(memberRef(sharing.institutionId, input.user.uid), payload);
}

export async function grantSharing(input: SummaryInput, institution: { institutionId: string; institutionName: string }) {
  // Consent is recorded on the candidate's own record first; the rules check it before accepting the summary.
  await updateDoc(userRef(input.user.uid), { sharing: { ...institution, consentedAt: serverTimestamp() } });
  await syncMemberSummary({ ...input, user: { ...input.user, sharing: { ...institution, consentedAt: null } } });
}

export async function withdrawSharing(user: UserDoc) {
  if (!user.sharing) return;
  await deleteDoc(memberRef(user.sharing.institutionId, user.uid)).catch(() => undefined);
  await updateDoc(userRef(user.uid), { sharing: null });
}

export async function regenerateJoinCode(institutionId: string, oldCode: string, name: string) {
  const code = generateJoinCode();
  const batch = writeBatch(requireDb());
  batch.set(joinCodeRef(code), { institutionId, institutionName: name });
  batch.update(institutionRef(institutionId), { joinCode: code });
  batch.delete(joinCodeRef(oldCode));
  await batch.commit();
  return code;
}

export const removeMember = (institutionId: string, candidateUid: string) => deleteDoc(memberRef(institutionId, candidateUid));
