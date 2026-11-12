import { deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import type { Application, ApplicationInput, ApplicationStatus, CvExperience, CvProject, CvVersion } from "@/data/types";
import { analyseCv, analyseJd } from "@/engine";
import { requireDb } from "@/lib/firebase";
import { addFileDeletes, addFileWrites } from "./cvFiles";
import { chunkedBatch, subCol, subDoc } from "./paths";

// ---------- CV versions ----------
export interface CvInput {
  label: string;
  fileName: string | null;
  fileSize: number | null;
  personalStatement: string;
  experience: CvExperience[];
  projects: CvProject[];
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
  projects: cv.projects
    .map((p) => ({ name: p.name.trim(), bullets: p.bullets.map((b) => b.trim()).filter(Boolean) }))
    .filter((p) => p.name || p.bullets.length),
  skillsSection: cv.skillsSection.map((s) => s.trim()).filter(Boolean),
  ...(cv.extractedText !== undefined ? { extractedText: cv.extractedText } : {}),
});

// The CV's text and structure are stored on the CV version; an uploaded file is also kept,
// in pieces, in the cvFiles collection (see cvFiles.ts). Both are written in one batch, so the
// CV and its file are saved, or fail, together.
export async function addCvVersion(uid: string, cv: CvInput, opts: { id?: string; file?: File | null } = {}) {
  const ref = opts.id ? subDoc(uid, "cvVersions", opts.id) : doc(subCol(uid, "cvVersions"));
  const clean = cleanCv(cv);
  const batch = writeBatch(requireDb());
  const storedFile = opts.file ? await addFileWrites(batch, uid, ref.id, opts.file) : null;
  batch.set(ref, { ...clean, storedFile, analysis: analyseCv(clean), createdAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

/** `file` replaces the stored file; `null` removes it; leaving it out keeps the current one. */
export async function updateCvVersion(uid: string, existing: CvVersion, cv: CvInput, file?: File | null) {
  const clean = cleanCv(cv);
  const batch = writeBatch(requireDb());
  const previous = existing.storedFile?.chunks ?? 0;
  let storedFile = existing.storedFile ?? null;
  if (file) storedFile = await addFileWrites(batch, uid, existing.id, file, previous);
  else if (file === null && previous) {
    addFileDeletes(batch, uid, existing.id, previous);
    storedFile = null;
  }
  batch.update(subDoc(uid, "cvVersions", existing.id), { ...clean, storedFile, analysis: analyseCv(clean) });
  await batch.commit();
}

export async function deleteCvVersion(uid: string, cv: CvVersion) {
  const batch = writeBatch(requireDb());
  addFileDeletes(batch, uid, cv.id, cv.storedFile?.chunks ?? 0);
  batch.delete(subDoc(uid, "cvVersions", cv.id));
  await batch.commit();
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

export async function addApplication(uid: string, input: ApplicationInput, from: { jobUrl?: string } = {}) {
  const ref = doc(subCol(uid, "applications"));
  await setDoc(ref, {
    ...appPayload(input),
    source: from.jobUrl ? "link" : "manual",
    jobUrl: from.jobUrl ?? null,
    importBatchId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

/** Removes applications imported together by CSV (older imports only; CSV import has been removed). */
export async function undoImport(uid: string, batchId: string) {
  const snap = await getDocs(query(subCol(uid, "applications"), where("importBatchId", "==", batchId)));
  await chunkedBatch(requireDb(), snap.docs.map((d) => (b) => b.delete(d.ref)));
  return snap.size;
}
