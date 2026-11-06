import { Timestamp } from "firebase/firestore";
import type { CandidateProfile } from "@/data/types";

// The previous version kept each candidate workspace in this browser's localStorage under
// rc-data:{oldUserId}, with Timestamps stored as { __ts: millis }. This module only reads
// those records so they can be imported into Firestore; it never deletes them. After an
// import the key is renamed to rc-data-imported:{oldUserId}.

export const LEGACY_SUBS = ["cvVersions", "applications", "diagnoses", "actions", "evaluations", "engineState"] as const;
export type LegacySub = (typeof LEGACY_SUBS)[number];
type Doc = Record<string, unknown>;

export interface LegacyStore {
  version: 1;
  seededAt: number | null;
  profile: CandidateProfile | null;
  cols: Record<LegacySub, Record<string, Doc>>;
}

export interface LegacyWorkspace {
  key: string;
  store: LegacyStore;
  counts: Record<LegacySub, number>;
  /** Only the untouched demonstration seed: nothing worth importing. */
  demoOnly: boolean;
}

const PREFIX = "rc-data:";
const IMPORTED_PREFIX = "rc-data-imported:";
const SKIP_KEY = "rc-legacy-import-skipped";
const TS = "__ts";

export const emptyLegacyStore = (): LegacyStore => ({
  version: 1,
  seededAt: null,
  profile: null,
  cols: { cvVersions: {}, applications: {}, diagnoses: {}, actions: {}, evaluations: {}, engineState: {} },
});

export const serialise = (store: LegacyStore) =>
  JSON.stringify(store, function (this: Record<string, unknown>, k, v) {
    // JSON.stringify calls toJSON before the replacer, so read the raw value.
    const raw = this[k];
    return raw instanceof Timestamp ? { [TS]: raw.toMillis() } : v;
  });

export const deserialise = (text: string): LegacyStore => {
  const parsed = JSON.parse(text, (_k, v) => (v && typeof v === "object" && TS in v && Object.keys(v).length === 1 ? Timestamp.fromMillis(v[TS]) : v));
  const base = emptyLegacyStore();
  return { ...base, ...parsed, cols: { ...base.cols, ...(parsed?.cols ?? {}) } };
};

export function describe(key: string, store: LegacyStore): LegacyWorkspace {
  const counts = Object.fromEntries(LEGACY_SUBS.map((s) => [s, Object.keys(store.cols[s] ?? {}).length])) as Record<LegacySub, number>;
  // A seeded workspace that was never touched holds exactly the demo CV and 24 applications and nothing else.
  const demoOnly = Boolean(store.seededAt) && counts.diagnoses === 0 && counts.actions === 0 && counts.cvVersions <= 1 && counts.applications === 24;
  return { key, store, counts, demoOnly };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Workspaces saved in this browser by the previous version, not yet imported. */
export function findLegacyWorkspaces(): LegacyWorkspace[] {
  const ls = storage();
  if (!ls) return [];
  const out: LegacyWorkspace[] = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const ws = describe(key, deserialise(ls.getItem(key) ?? ""));
      if (Object.values(ws.counts).some(Boolean) || ws.store.profile) out.push(ws);
    } catch {
      // Unreadable record: leave it alone.
    }
  }
  return out;
}

/** Keep the data, but mark it as imported so it is not offered again. */
export function markImported(key: string) {
  const ls = storage();
  const text = ls?.getItem(key);
  if (!ls || text == null) return;
  ls.setItem(key.replace(PREFIX, IMPORTED_PREFIX), text);
  ls.removeItem(key);
}

export function isImportSkipped(uid: string) {
  return storage()?.getItem(`${SKIP_KEY}:${uid}`) === "1";
}

export function skipImport(uid: string) {
  try {
    storage()?.setItem(`${SKIP_KEY}:${uid}`, "1");
  } catch {
    // Storage blocked: the offer will simply appear again next time.
  }
}
