import { collection, doc, writeBatch, type Firestore, type QueryDocumentSnapshot, type WriteBatch } from "firebase/firestore";
import { requireDb } from "@/lib/firebase";

// Login records live at accounts/{sha256(email)}; every user's data lives under users/{uid},
// where uid is a random id created at registration.
export const USER_SUBCOLLECTIONS = [
  "cvVersions",
  "applications",
  "diagnoses",
  "actions",
  "evaluations",
  "engineState",
] as const;
export type UserSub = (typeof USER_SUBCOLLECTIONS)[number];

export const accountRef = (key: string) => doc(requireDb(), "accounts", key);
export const userRef = (uid: string) => doc(requireDb(), "users", uid);
export const subCol = (uid: string, sub: UserSub) => collection(requireDb(), "users", uid, sub);
export const subDoc = (uid: string, sub: UserSub, id: string) => doc(requireDb(), "users", uid, sub, id);
export const institutionRef = (id: string) => doc(requireDb(), "institutions", id);
export const membersCol = (instId: string) => collection(requireDb(), "institutions", instId, "members");
export const memberRef = (instId: string, uid: string) => doc(requireDb(), "institutions", instId, "members", uid);
export const joinCodeRef = (code: string) => doc(requireDb(), "joinCodes", code);

export function withId<T>(snap: QueryDocumentSnapshot): T {
  return { id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } as T;
}

/** Run writes in chunks under Firestore's 500-operation batch limit. */
export async function chunkedBatch(db: Firestore, ops: ((b: WriteBatch) => void)[], size = 400) {
  for (let i = 0; i < ops.length; i += size) {
    const b = writeBatch(db);
    ops.slice(i, i + size).forEach((op) => op(b));
    await b.commit();
  }
}
