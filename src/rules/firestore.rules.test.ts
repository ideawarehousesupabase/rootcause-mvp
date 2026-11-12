// Security rules tests. Run with `npm run test:rules` (starts the Firestore emulator).
// There is no Firebase Authentication, so every request here is unauthenticated, as in the app.
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const root = path.resolve(__dirname, "../..");
let env: RulesTestEnvironment;
let db: ReturnType<ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"]>;

const HASH = "a".repeat(64);
const SALT = "b".repeat(32);

const userDoc = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  fullName: "Test Person",
  email: `${uid}@example.test`,
  accountType: "candidate",
  organisationName: null,
  institutionId: null,
  createdAt: serverTimestamp(),
  privacyAcceptedAt: serverTimestamp(),
  profile: null,
  sharing: null,
  ...extra,
});

const login = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  email: `${uid}@example.test`,
  passwordHash: HASH,
  salt: SALT,
  iterations: 210000,
  algorithm: "PBKDF2-SHA256",
  createdAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rootcause",
    firestore: { rules: readFileSync(path.join(root, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8181 },
  });
});
afterAll(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  db = env.unauthenticatedContext().firestore();
});

async function registerCandidate(uid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, "accounts", `key-${uid}`), login(uid));
  batch.set(doc(db, "users", uid), userDoc(uid));
  await assertSucceeds(batch.commit());
}

async function registerInstitution(uid: string, instId: string, code: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, "institutions", instId), { name: "Test Careers Service", ownerUid: uid, joinCode: code, createdAt: serverTimestamp() });
  batch.set(doc(db, "joinCodes", code), { institutionId: instId, institutionName: "Test Careers Service" });
  batch.set(doc(db, "accounts", `key-${uid}`), login(uid));
  batch.set(doc(db, "users", uid), userDoc(uid, { accountType: "institutional", organisationName: "Test Careers Service", institutionId: instId }));
  await assertSucceeds(batch.commit());
}

describe("accounts (login records)", () => {
  it("are created together with their user record, and only with a hash", async () => {
    await registerCandidate("alice");
    await assertFails(setDoc(doc(db, "accounts/key-orphan"), login("orphan")));
    const batch = writeBatch(db);
    batch.set(doc(db, "accounts/key-bob"), login("bob", { password: "plain-text" }));
    batch.set(doc(db, "users/bob"), userDoc("bob"));
    await assertFails(batch.commit());
  });

  it("can be read by exact key but never listed or overwritten", async () => {
    await registerCandidate("alice");
    await assertSucceeds(getDoc(doc(db, "accounts/key-alice")));
    await assertFails(getDocs(collection(db, "accounts")));
    await assertFails(setDoc(doc(db, "accounts/key-alice"), login("alice", { passwordHash: "c".repeat(64) })));
  });

  it("can only be deleted once the user record is gone", async () => {
    await registerCandidate("alice");
    await assertFails(deleteDoc(doc(db, "accounts/key-alice")));
    await assertSucceeds(deleteDoc(doc(db, "users/alice")));
    await assertSucceeds(deleteDoc(doc(db, "accounts/key-alice")));
  });
});

describe("users", () => {
  it("can't be listed, and keep their identity fields", async () => {
    await registerCandidate("alice");
    await assertFails(getDocs(collection(db, "users")));
    await assertSucceeds(updateDoc(doc(db, "users/alice"), { fullName: "Alice Renamed" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { email: "other@example.test" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { accountType: "institutional" }));
  });

  it("accept data only in the app's collections, and only for an existing user", async () => {
    await registerCandidate("alice");
    await assertSucceeds(setDoc(doc(db, "users/alice/applications/a1"), { jobTitle: "Analyst" }));
    await assertSucceeds(getDocs(collection(db, "users/alice/applications")));
    await assertFails(setDoc(doc(db, "users/alice/secrets/x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "users/nobody/applications/a1"), { jobTitle: "Analyst" }));
  });

  it("keep uploaded CV files only as bytes, in pieces of at most 700 KB", async () => {
    await registerCandidate("alice");
    const piece = (n: number) => ({ cvId: "cv1", index: 0, data: Bytes.fromUint8Array(new Uint8Array(n)) });
    await assertSucceeds(setDoc(doc(db, "users/alice/cvFiles/cv1_0"), piece(700_000)));
    await assertSucceeds(getDocs(collection(db, "users/alice/cvFiles")));
    await assertFails(setDoc(doc(db, "users/alice/cvFiles/cv1_1"), piece(700_001)));
    await assertFails(setDoc(doc(db, "users/alice/cvFiles/cv1_2"), { cvId: "cv1", index: 2, data: "not bytes" }));
    await assertFails(setDoc(doc(db, "users/nobody/cvFiles/cv1_0"), piece(10)));
    await assertSucceeds(deleteDoc(doc(db, "users/alice/cvFiles/cv1_0")));
  });

  it("can't claim an institution they don't own", async () => {
    await registerInstitution("owner", "inst1", "CODE2345");
    await assertFails(setDoc(doc(db, "users/mallory"), userDoc("mallory", { accountType: "institutional", institutionId: "inst1" })));
  });
});

describe("institutions, members and join codes", () => {
  it("need an institutional owner created in the same batch, and can't be listed", async () => {
    await registerInstitution("owner", "inst1", "CODE2345");
    await assertFails(getDocs(collection(db, "institutions")));
    await assertFails(getDocs(collection(db, "joinCodes")));
    await assertSucceeds(getDoc(doc(db, "joinCodes/CODE2345")));
    await assertFails(setDoc(doc(db, "institutions/inst2"), { name: "Fake", ownerUid: "nobody", joinCode: "FAKE2345" }));
    await assertFails(updateDoc(doc(db, "institutions/inst1"), { ownerUid: "mallory" }));
  });

  it("only accept a join code that is the institution's current code", async () => {
    await registerInstitution("owner", "inst1", "CODE2345");
    await assertFails(setDoc(doc(db, "joinCodes/OTHER234"), { institutionId: "inst1", institutionName: "x" }));
  });

  it("accept a member summary only while the candidate has consented", async () => {
    await registerInstitution("owner", "inst1", "CODE2345");
    await registerCandidate("alice");
    const summary = { candidateUid: "alice", name: "Alice" };
    await assertFails(setDoc(doc(db, "institutions/inst1/members/alice"), summary));
    await updateDoc(doc(db, "users/alice"), { sharing: { institutionId: "inst1", institutionName: "Test Careers Service", consentedAt: serverTimestamp() } });
    await assertSucceeds(setDoc(doc(db, "institutions/inst1/members/alice"), summary));
    await assertSucceeds(getDocs(collection(db, "institutions/inst1/members")));
    await assertFails(setDoc(doc(db, "institutions/inst1/members/bob"), { candidateUid: "bob", name: "Bob" }));
  });
});

describe("everything else", () => {
  it("is locked", async () => {
    await assertFails(setDoc(doc(db, "other/x"), { a: 1 }));
    await assertFails(getDoc(doc(db, "institutions/inst1/memberSummaries/alice")));
  });
});
