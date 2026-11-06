import { collection, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import type { AccountType, CandidateProfile, UserDoc } from "@/data/types";
import { requireDb } from "@/lib/firebase";
import { emailKey, hashPassword, normaliseEmail, verifyPassword } from "@/lib/password";
import { accountRef, institutionRef, joinCodeRef, userRef } from "./paths";

// Firestore-only accounts (no Firebase Authentication):
//   accounts/{sha256(email)}  → uid + salted password hash, used only to sign in
//   users/{uid}               → the account record, profile and sharing consent

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface StoredCredential {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  iterations: number;
  algorithm: string;
}

export class AccountError extends Error {}

export function generateJoinCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Records made by earlier versions may lack the newer fields. */
export const normaliseUser = (data: Partial<UserDoc>): UserDoc =>
  ({ organisationName: null, institutionId: null, profile: null, sharing: null, ...data }) as UserDoc;

export async function register(input: { fullName: string; email: string; password: string; accountType: AccountType; organisationName: string | null }) {
  const db = requireDb();
  const email = normaliseEmail(input.email);
  const key = await emailKey(email);
  if ((await getDoc(accountRef(key))).exists()) throw new AccountError("An account with this email address already exists.");

  const uid = doc(collection(db, "users")).id;
  const batch = writeBatch(db);
  let institutionId: string | null = null;

  if (input.accountType === "institutional") {
    const instRef = doc(collection(db, "institutions"));
    institutionId = instRef.id;
    const code = generateJoinCode();
    const name = input.organisationName!.trim();
    batch.set(instRef, { name, ownerUid: uid, joinCode: code, createdAt: serverTimestamp() });
    batch.set(joinCodeRef(code), { institutionId, institutionName: name });
  }

  // The login record can only be created, never overwritten, so a second registration
  // racing for the same email is refused by the rules.
  batch.set(accountRef(key), { uid, email, ...(await hashPassword(input.password)), createdAt: serverTimestamp() });
  batch.set(userRef(uid), {
    uid,
    fullName: input.fullName.trim(),
    email,
    accountType: input.accountType,
    organisationName: input.accountType === "institutional" ? input.organisationName!.trim() : null,
    institutionId,
    createdAt: serverTimestamp(),
    privacyAcceptedAt: serverTimestamp(),
    profile: null,
    sharing: null,
  });
  await batch.commit();
  return uid;
}

/** Look up the login record by email, check the password against the stored hash, and return the user record. */
export async function signIn(email: string, password: string) {
  const snap = await getDoc(accountRef(await emailKey(email)));
  if (!snap.exists()) throw new AccountError("The email or password is incorrect.");
  const cred = snap.data() as StoredCredential;
  if (!(await verifyPassword(password, cred))) throw new AccountError("The email or password is incorrect.");
  const user = await getDoc(userRef(cred.uid));
  if (!user.exists()) throw new AccountError("Your account record could not be found. Please register again.");
  return normaliseUser(user.data() as Partial<UserDoc>);
}

export async function updateAccountDetails(uid: string, changes: { fullName?: string; organisationName?: string }, institutionId: string | null) {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(userRef(uid), {
    ...(changes.fullName !== undefined ? { fullName: changes.fullName.trim() } : {}),
    ...(changes.organisationName !== undefined ? { organisationName: changes.organisationName.trim() } : {}),
  });
  if (institutionId && changes.organisationName !== undefined) {
    const name = changes.organisationName.trim();
    const inst = await getDoc(institutionRef(institutionId));
    batch.update(institutionRef(institutionId), { name });
    const code = inst.data()?.joinCode as string | undefined;
    if (code) batch.update(joinCodeRef(code), { institutionName: name });
  }
  await batch.commit();
}

export const saveProfile = (uid: string, profile: CandidateProfile) => updateDoc(userRef(uid), { profile });

/** Friendly message for any account error. */
export function accountErrorMessage(err: unknown): string {
  if (err instanceof AccountError) return err.message;
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "unavailable":
      return "Network error. Check your connection and try again.";
    case "permission-denied":
      return "The database refused the request. Check that the latest firestore.rules are published.";
    default:
      console.error("Account request failed", err);
      return code ? `Something went wrong (${code}). Please try again.` : "Something went wrong. Please try again.";
  }
}
