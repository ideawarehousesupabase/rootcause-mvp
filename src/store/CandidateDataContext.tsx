import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import type {
  Application,
  ClassMultipliers,
  CorrectiveAction,
  CvVersion,
  Diagnosis,
  Evaluation,
  UserDoc,
} from "@/data/types";
import { applyVerdict, defaultMultipliers, evaluateDiagnosis, funnel, readiness, type Funnel, type Readiness } from "@/engine";
import { todayLocal } from "@/lib/utils";
import { finaliseVerdict, markInconclusive, setChangesApplied, writeEvaluation } from "@/services/diagnosis";
import { subCol, subDoc, withId, type UserSub } from "@/services/paths";
import { syncMemberSummary } from "@/services/sharing";

// Real-time data layer for the candidate workspace, backed by Firestore listeners.

interface CandidateDataValue {
  user: UserDoc;
  uid: string;
  today: string;
  loading: boolean;
  error: string | null;
  cvVersions: CvVersion[];
  applications: Application[];
  diagnoses: Diagnosis[];
  actions: CorrectiveAction[];
  evaluations: Evaluation[];
  multipliers: ClassMultipliers;
  funnel: Funnel;
  readiness: Readiness;
  latestDiagnosis: Diagnosis | null;
  currentActions: CorrectiveAction[];
  latestEvaluation: Evaluation | null;
  /** Newer evidence exists than the latest diagnosis. */
  evidenceChangedSinceDiagnosis: boolean;
  cvLabel: (id: string) => string;
}

const CandidateDataContext = createContext<CandidateDataValue | null>(null);

function useCollection<T>(uid: string, sub: UserSub, order?: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = order ? query(subCol(uid, sub), orderBy(order, "desc")) : subCol(uid, sub);
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => withId<T>(d)));
        setLoaded(true);
      },
      (err) => {
        setError(err.message);
        setLoaded(true);
      },
    );
  }, [uid, sub, order]);
  return { items, loaded, error };
}

function useDocData<T>(uid: string, sub: UserSub, id: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(
    () =>
      onSnapshot(
        subDoc(uid, sub, id),
        (snap) => setData(snap.exists() ? (snap.data({ serverTimestamps: "estimate" }) as T) : null),
        () => setData(null),
      ),
    [uid, sub, id],
  );
  return data;
}

export function CandidateDataProvider({ user, children }: { user: UserDoc; children: ReactNode }) {
  const uid = user.uid;
  const cvs = useCollection<CvVersion>(uid, "cvVersions");
  const apps = useCollection<Application>(uid, "applications");
  const diags = useCollection<Diagnosis>(uid, "diagnoses", "createdAt");
  const acts = useCollection<CorrectiveAction>(uid, "actions");
  const evals = useCollection<Evaluation>(uid, "evaluations");
  const calibration = useDocData<{ classMultipliers?: ClassMultipliers }>(uid, "engineState", "calibration");
  const multipliers = useMemo<ClassMultipliers>(() => ({ ...defaultMultipliers(), ...(calibration?.classMultipliers ?? {}) }), [calibration]);

  const today = todayLocal();
  const loading = !(cvs.loaded && apps.loaded && diags.loaded && acts.loaded && evals.loaded);
  const error = cvs.error ?? apps.error ?? diags.error ?? acts.error ?? evals.error;

  const value = useMemo<CandidateDataValue>(() => {
    const applications = [...apps.items].sort((a, b) => b.dateApplied.localeCompare(a.dateApplied));
    const cvVersions = [...cvs.items].sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
    const latestDiagnosis = diags.items[0] ?? null;
    const currentActions = latestDiagnosis ? acts.items.filter((a) => a.diagnosisId === latestDiagnosis.id && !a.archived) : [];
    const latestEvaluation = latestDiagnosis ? evals.items.find((e) => e.diagnosisId === latestDiagnosis.id) ?? null : null;
    const diagMillis = latestDiagnosis?.createdAt?.toMillis() ?? 0;
    const evidenceChangedSinceDiagnosis =
      Boolean(latestDiagnosis) &&
      [...apps.items.map((a) => a.updatedAt?.toMillis() ?? 0), ...cvs.items.map((c) => c.createdAt?.toMillis() ?? 0)].some((m) => m > diagMillis + 1000);
    return {
      user,
      uid,
      today,
      loading,
      error,
      cvVersions,
      applications,
      diagnoses: diags.items,
      actions: acts.items,
      evaluations: evals.items,
      multipliers,
      funnel: funnel(applications, today),
      readiness: readiness({ profile: user.profile, cvVersions, applications, today }),
      latestDiagnosis,
      currentActions,
      latestEvaluation,
      evidenceChangedSinceDiagnosis,
      cvLabel: (id) => cvVersions.find((c) => c.id === id)?.label ?? "Removed CV",
    };
  }, [user, uid, today, loading, error, cvs.items, apps.items, diags.items, acts.items, evals.items, multipliers]);

  // ---- Closed loop: mark changes applied and keep the evaluation current ----
  const busy = useRef(false);
  useEffect(() => {
    const d = value.latestDiagnosis;
    if (loading || busy.current || !d || !d.primary) return;
    const primaryActions = value.currentActions.filter((a) => a.causeClass === d.primary && a.status !== "Queued");
    const allDone = primaryActions.length > 0 && primaryActions.every((a) => a.status === "Completed");
    const lastCompleted = primaryActions
      .map((a) => a.completedAt?.toDate())
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];
    const appliedDate = lastCompleted ? todayLocal(lastCompleted) : null;

    const run = async () => {
      busy.current = true;
      try {
        if (allDone && appliedDate && d.changesAppliedAt !== appliedDate && d.status === "active") {
          await setChangesApplied(uid, d.id, appliedDate);
          return;
        }
        if (!allDone && d.changesAppliedAt && d.status === "active") {
          await setChangesApplied(uid, d.id, null);
          return;
        }
        if (!d.changesAppliedAt || d.status === "superseded" || d.status === "corroborated" || d.status === "weakened") return;
        const result = evaluateDiagnosis({ diagnosisId: d.id, causeClass: d.primary!, changesAppliedAt: d.changesAppliedAt, applications: value.applications, today });
        const prev = value.latestEvaluation;
        const changed =
          !prev || prev.verdict !== result.verdict || prev.after.n !== result.after.n || prev.after.rate !== result.after.rate || prev.before.n !== result.before.n;
        if (changed) await writeEvaluation(uid, result);
        if ((result.verdict === "corroborated" || result.verdict === "weakened") && !prev?.appliedToCalibration) {
          const next = applyVerdict(value.multipliers, d.primary!, result.verdict);
          const queued = value.currentActions.filter((a) => a.status === "Queued");
          await finaliseVerdict(uid, d.id, result.verdict, next, queued);
        } else if (result.verdict === "inconclusive" && d.status !== "inconclusive") {
          await markInconclusive(uid, d.id);
        }
      } catch (err) {
        console.error("Evaluation update failed", err);
      } finally {
        busy.current = false;
      }
    };
    void run();
  }, [value, loading, uid, today]);

  // ---- Member summary sync (only while sharing consent is active) ----
  useEffect(() => {
    if (loading || !user.sharing) return;
    const t = setTimeout(() => {
      syncMemberSummary({
        user,
        applications: value.applications,
        latestDiagnosis: value.latestDiagnosis,
        actions: value.currentActions,
        latestEvaluation: value.latestEvaluation,
        today,
      }).catch((err) => console.error("Summary sync failed", err));
    }, 2000);
    return () => clearTimeout(t);
  }, [loading, user, value.applications, value.latestDiagnosis, value.currentActions, value.latestEvaluation, today]);

  return <CandidateDataContext.Provider value={value}>{children}</CandidateDataContext.Provider>;
}

export function useCandidateData() {
  const ctx = useContext(CandidateDataContext);
  if (!ctx) throw new Error("useCandidateData must be used inside CandidateDataProvider");
  return ctx;
}

/** For components shared with the institutional workspace (e.g. the account dialog). */
export function useOptionalCandidateData() {
  return useContext(CandidateDataContext);
}
