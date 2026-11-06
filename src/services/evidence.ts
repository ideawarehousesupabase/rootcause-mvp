import { deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, type WriteBatch } from "firebase/firestore";
import type { Application, ApplicationInput, ApplicationStatus, CvExperience, CvVersion } from "@/data/types";
import { analyseCv, analyseJd } from "@/engine";
import { requireDb } from "@/lib/firebase";
import { uid as makeId } from "@/lib/utils";
import { chunkedBatch, subCol, subDoc } from "./paths";

// ---------- CV versions ----------
export interface CvInput {
  label: string;
  fileName: string | null;
  fileSize: number | null;
  personalStatement: string;
  experience: CvExperience[];
  skillsSection: string[];
  extractedText?: string | null;
}

const cleanCv = (cv: CvInput) => ({
  label: cv.label.trim(),
  fileName: cv.fileName,
  fileSize: cv.fileSize,
  personalStatement: cv.personalStatement.trim(),
  experience: cv.experience
    .map((e) => ({ ...e, role: e.role.trim(), employer: e.employer.trim(), bullets: e.bullets.map((b) => b.trim()).filter(Boolean) }))
    .filter((e) => e.role || e.bullets.length),
  skillsSection: cv.skillsSection.map((s) => s.trim()).filter(Boolean),
  ...(cv.extractedText !== undefined ? { extractedText: cv.extractedText } : {}),
});

// Only the CV's text is stored; uploaded files are read in the browser and not kept.
export async function addCvVersion(uid: string, cv: CvInput, opts: { id?: string } = {}) {
  const ref = opts.id ? subDoc(uid, "cvVersions", opts.id) : doc(subCol(uid, "cvVersions"));
  const clean = cleanCv(cv);
  await setDoc(ref, { ...clean, analysis: analyseCv(clean), createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateCvVersion(uid: string, id: string, cv: CvInput) {
  const clean = cleanCv(cv);
  await updateDoc(subDoc(uid, "cvVersions", id), { ...clean, analysis: analyseCv(clean) });
}

export async function deleteCvVersion(uid: string, cv: CvVersion) {
  await deleteDoc(subDoc(uid, "cvVersions", cv.id));
}

// ---------- Applications ----------
/** Keep interview fields coherent with the chosen status (carried over from the prototype). */
export function coherentStatus<T extends Pick<Application, "status" | "interviewStage" | "interviewOutcome">>(a: T, status: ApplicationStatus): T {
  const next = { ...a, status };
  if (status === "Applied") {
    next.interviewStage = "None";
    next.interviewOutcome = "Not applicable";
  }
  if (status === "Interview" && next.interviewStage === "None") {
    next.interviewStage = "First interview";
    next.interviewOutcome = "Awaiting outcome";
  }
  if (status === "Offer") {
    if (next.interviewStage === "None") next.interviewStage = "Final interview";
    next.interviewOutcome = "Offer made";
  }
  if (status === "Rejected" && next.interviewStage !== "None" && next.interviewOutcome !== "Unsuccessful") next.interviewOutcome = "Unsuccessful";
  return next;
}

const appPayload = (input: ApplicationInput) => ({
  ...input,
  jobTitle: input.jobTitle.trim(),
  employer: input.employer.trim(),
  location: input.location.trim(),
  jdAnalysis: analyseJd(input.jobDescription),
});

export async function addApplication(uid: string, input: ApplicationInput) {
  const ref = doc(subCol(uid, "applications"));
  await setDoc(ref, { ...appPayload(input), source: "manual", importBatchId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateApplication(uid: string, id: string, input: ApplicationInput) {
  await updateDoc(subDoc(uid, "applications", id), { ...appPayload(input), updatedAt: serverTimestamp() });
}

export async function patchApplication(uid: string, id: string, changes: Partial<ApplicationInput>) {
  await updateDoc(subDoc(uid, "applications", id), { ...changes, updatedAt: serverTimestamp() });
}

export async function setStatus(uid: string, app: Application, status: ApplicationStatus) {
  const next = coherentStatus(app, status);
  await patchApplication(uid, app.id, { status: next.status, interviewStage: next.interviewStage, interviewOutcome: next.interviewOutcome });
}

export const deleteApplication = (uid: string, id: string) => deleteDoc(subDoc(uid, "applications", id));

export async function deleteApplications(uid: string, ids: string[]) {
  await chunkedBatch(requireDb(), ids.map((id) => (b) => b.delete(subDoc(uid, "applications", id))));
}

export async function bulkSetStatus(uid: string, apps: Application[], status: ApplicationStatus) {
  await chunkedBatch(
    requireDb(),
    apps.map((a) => (b) => {
      const next = coherentStatus(a, status);
      b.update(subDoc(uid, "applications", a.id), { status, interviewStage: next.interviewStage, interviewOutcome: next.interviewOutcome, updatedAt: serverTimestamp() });
    }),
  );
}

/** Import validated CSV rows. New CV labels become empty CV versions the user completes later. */
export async function importApplications(
  uid: string,
  rows: { input: Omit<ApplicationInput, "cvVersionId">; cvLabel: string }[],
  existingCvs: Pick<CvVersion, "id" | "label">[],
) {
  const db = requireDb();
  const batchId = makeId("import");
  const cvIds = new Map(existingCvs.map((c) => [c.label.trim().toLowerCase(), c.id]));
  const newCvs: { id: string; label: string }[] = [];
  for (const r of rows) {
    const key = r.cvLabel.trim().toLowerCase();
    if (!cvIds.has(key)) {
      const id = doc(subCol(uid, "cvVersions")).id;
      cvIds.set(key, id);
      newCvs.push({ id, label: r.cvLabel.trim() });
    }
  }
  const ops = [
    ...newCvs.map((cv) => (b: WriteBatch) => {
      const empty = { label: cv.label, fileName: null, fileSize: null, personalStatement: "", experience: [], skillsSection: [] };
      b.set(subDoc(uid, "cvVersions", cv.id), { ...empty, file: null, analysis: analyseCv(empty), createdAt: serverTimestamp() });
    }),
    ...rows.map((r) => (b: WriteBatch) => {
      const input = { ...r.input, cvVersionId: cvIds.get(r.cvLabel.trim().toLowerCase())! };
      b.set(doc(subCol(uid, "applications")), {
        ...appPayload(input),
        source: "csv",
        importBatchId: batchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  ];
  await chunkedBatch(db, ops);
  return { batchId, imported: rows.length, newCvLabels: newCvs.map((c) => c.label) };
}

export async function undoImport(uid: string, batchId: string) {
  const snap = await getDocs(query(subCol(uid, "applications"), where("importBatchId", "==", batchId)));
  await chunkedBatch(requireDb(), snap.docs.map((d) => (b) => b.delete(d.ref)));
  return snap.size;
}
