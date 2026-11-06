import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { describe as describeWorkspace, deserialise, emptyLegacyStore, serialise } from "./legacyImport";

describe("legacy browser workspace", () => {
  it("keeps Timestamps through a save and load", () => {
    const store = emptyLegacyStore();
    const at = Timestamp.fromMillis(1_790_000_000_000);
    store.cols.applications.a1 = { jobTitle: "Analyst", createdAt: at, nested: { updatedAt: at } };
    const back = deserialise(serialise(store));
    const app = back.cols.applications.a1 as { createdAt: Timestamp; nested: { updatedAt: Timestamp } };
    expect(app.createdAt).toBeInstanceOf(Timestamp);
    expect(app.createdAt.toMillis()).toBe(at.toMillis());
    expect(app.nested.updatedAt.toMillis()).toBe(at.toMillis());
  });

  it("reads records saved by the previous version, filling missing collections", () => {
    const text = JSON.stringify({ version: 1, seededAt: null, profile: null, cols: { applications: { a1: { createdAt: { __ts: 5 } } } } });
    const store = deserialise(text);
    expect(store.cols.cvVersions).toEqual({});
    expect((store.cols.applications.a1.createdAt as Timestamp).toMillis()).toBe(5);
  });

  it("counts what a workspace holds and spots the untouched demo seed", () => {
    const store = emptyLegacyStore();
    store.seededAt = 1;
    store.cols.cvVersions.c1 = {};
    for (let i = 0; i < 24; i++) store.cols.applications[`a${i}`] = {};
    expect(describeWorkspace("rc-data:x", store)).toMatchObject({ demoOnly: true, counts: { cvVersions: 1, applications: 24, diagnoses: 0 } });
    store.cols.diagnoses.d1 = {};
    expect(describeWorkspace("rc-data:x", store).demoOnly).toBe(false);
  });
});
