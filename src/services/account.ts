import { Bytes, deleteDoc, getDoc, getDocs } from "firebase/firestore";
import type { UserDoc } from "@/data/types";
import { requireDb } from "@/lib/firebase";
import { emailKey } from "@/lib/password";
import { accountRef, chunkedBatch, institutionRef, joinCodeRef, memberRef, membersCol, subCol, USER_SUBCOLLECTIONS, userRef } from "./paths";
import { AccountError, signIn } from "./users";

/** Everything stored for the user, for "Export my data". */
export async function exportUserData(user: UserDoc) {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: user };
  for (const sub of USER_SUBCOLLECTIONS) {
    const snap = await getDocs(subCol(user.uid, sub));
    // Stored CV file pieces are exported as base64 text.
    out[sub] = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, ...(data.data instanceof Bytes ? { data: data.data.toBase64() } : {}) };
    });
  }
  return out;
}

/** Delete all of the user's records, then their login record. Requires the current password. */
export async function deleteAccountAndData(user: UserDoc, password: string) {
  const db = requireDb();
  const checked = await signIn(user.email, password).catch(() => null);
  if (!checked || checked.uid !== user.uid) throw new AccountError("That password is incorrect.");

  for (const sub of USER_SUBCOLLECTIONS) {
    const snap = await getDocs(subCol(user.uid, sub));
    await chunkedBatch(db, snap.docs.map((d) => (b) => b.delete(d.ref)));
  }
  if (user.sharing) await deleteDoc(memberRef(user.sharing.institutionId, user.uid)).catch(() => undefined);

  if (user.accountType === "institutional" && user.institutionId) {
    const inst = await getDoc(institutionRef(user.institutionId));
    const members = await getDocs(membersCol(user.institutionId));
    await chunkedBatch(db, members.docs.map((d) => (b) => b.delete(d.ref)));
    if (inst.exists()) {
      const code = inst.data().joinCode as string | undefined;
      if (code) await deleteDoc(joinCodeRef(code)).catch(() => undefined);
      await deleteDoc(institutionRef(user.institutionId));
    }
  }
  await deleteDoc(userRef(user.uid));
  await deleteDoc(accountRef(await emailKey(user.email)));
}
