import { getDocs, serverTimestamp, updateDoc, type WriteBatch } from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { LEGACY_SUBS, markImported, type LegacyWorkspace } from "@/lib/legacyImport";
import { chunkedBatch, subCol, subDoc, userRef } from "./paths";

/**
 * Copy a workspace saved in this browser into the signed-in user's Firestore records.
 * Document ids and timestamps are kept, so running it twice overwrites rather than duplicates.
 * The browser copy is only marked as imported after the counts are read back and match.
 * An existing profile in Firestore is never overwritten.
 */
export async function importLegacyWorkspace(uid: string, ws: LegacyWorkspace, opts: { hasProfile: boolean }) {
  const ops = LEGACY_SUBS.flatMap((sub) =>
    Object.entries(ws.store.cols[sub] ?? {}).map(([id, data]) => (b: WriteBatch) => {
      b.set(subDoc(uid, sub, id), data);
    }),
  );
  await chunkedBatch(requireDb(), ops);

  for (const sub of LEGACY_SUBS) {
    const ids = new Set((await getDocs(subCol(uid, sub))).docs.map((d) => d.id));
    const missing = Object.keys(ws.store.cols[sub] ?? {}).filter((id) => !ids.has(id));
    if (missing.length) throw new Error(`Import check failed: ${missing.length} ${sub} record(s) did not save. Nothing was removed from this browser; try again.`);
  }
  await updateDoc(userRef(uid), {
    ...(ws.store.profile && !opts.hasProfile ? { profile: ws.store.profile } : {}),
    legacyImportedAt: serverTimestamp(),
  });
  markImported(ws.key);
  return ws.counts;
}
