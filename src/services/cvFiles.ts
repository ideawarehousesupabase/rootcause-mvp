import { Bytes, getDocs, query, where, type WriteBatch } from "firebase/firestore";
import { subCol, subDoc } from "./paths";

// Original CV files, kept in Firestore (no Firebase Storage, so no paid plan is needed).
// A Firestore document holds at most 1 MiB, so each file is split into pieces of up to
// CHUNK_BYTES, stored as users/{uid}/cvFiles/{cvId}_{index}. The CV version records how
// many pieces there are and the file's type, name and size.

export const CHUNK_BYTES = 700_000;

export interface StoredFile {
  contentType: string;
  chunks: number;
}

/** The pieces of a file, in order. */
export function splitBytes(data: Uint8Array, size = CHUNK_BYTES): Uint8Array[] {
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += size) pieces.push(data.subarray(i, i + size));
  return pieces.length ? pieces : [new Uint8Array()];
}

/** The pieces back as one file. */
export function joinBytes(pieces: Uint8Array[]) {
  const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const chunkRef = (uid: string, cvId: string, index: number) => subDoc(uid, "cvFiles", `${cvId}_${index}`);

/**
 * Adds the writes that store `file` for this CV to `batch`, removing any pieces left over
 * from a larger file stored before. Returns what to record on the CV version.
 */
export async function addFileWrites(batch: WriteBatch, uid: string, cvId: string, file: File, previousChunks = 0): Promise<StoredFile> {
  const pieces = splitBytes(new Uint8Array(await file.arrayBuffer()));
  pieces.forEach((piece, index) => batch.set(chunkRef(uid, cvId, index), { cvId, index, data: Bytes.fromUint8Array(piece) }));
  for (let index = pieces.length; index < previousChunks; index++) batch.delete(chunkRef(uid, cvId, index));
  return { contentType: file.type || "application/octet-stream", chunks: pieces.length };
}

/** Adds the writes that remove this CV's stored file to `batch`. */
export function addFileDeletes(batch: WriteBatch, uid: string, cvId: string, chunks: number) {
  for (let index = 0; index < chunks; index++) batch.delete(chunkRef(uid, cvId, index));
}

/** The stored original file of a CV version. */
export async function readCvFile(uid: string, cvId: string, contentType: string): Promise<Blob> {
  const snap = await getDocs(query(subCol(uid, "cvFiles"), where("cvId", "==", cvId)));
  if (snap.empty) throw new Error("The original file could not be found.");
  const pieces = snap.docs
    .map((d) => d.data() as { index: number; data: Bytes })
    .sort((a, b) => a.index - b.index)
    .map((d) => d.data.toUint8Array());
  return new Blob([joinBytes(pieces)], { type: contentType });
}

/** Saves a blob to the user's device under its original name. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
