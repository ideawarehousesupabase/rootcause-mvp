import type { Application } from "@/data/types";
import { NO_RESPONSE_DAYS } from "./config";
import { ratio } from "./text";

// Single source of truth for funnel definitions. Every page, the engine and
// the institutional member summary use these functions.

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

export type DerivedState = "Withdrawn" | "Pending" | "No response" | "Responded";

export function derivedState(a: Application, today: string): DerivedState {
  if (a.status === "Withdrawn") return "Withdrawn";
  if (a.status === "Applied" && !a.responseDate) {
    return daysBetween(a.dateApplied, today) >= NO_RESPONSE_DAYS ? "No response" : "Pending";
  }
  return "Responded";
}

export const isDecided = (a: Application, today: string) => {
  const s = derivedState(a, today);
  return s === "No response" || s === "Responded";
};
export const hasResponse = (a: Application) => (a.status !== "Applied" && a.status !== "Withdrawn") || Boolean(a.responseDate);
export const hasInterview = (a: Application) => a.status === "Interview" || a.status === "Offer" || a.interviewStage !== "None";
export const hasOffer = (a: Application) => a.status === "Offer";
export const isFinishedInterview = (a: Application) =>
  hasInterview(a) && (a.status === "Rejected" || a.status === "Offer" || a.interviewOutcome === "Unsuccessful" || a.interviewOutcome === "Offer made");
export const isUnsuccessfulInterview = (a: Application) => hasInterview(a) && (a.status === "Rejected" || a.interviewOutcome === "Unsuccessful");
export const isUnsuccessful = (a: Application, today: string) => a.status === "Rejected" || derivedState(a, today) === "No response";

export interface Funnel {
  applications: number;
  decided: number;
  pending: number;
  responses: number;
  interviews: number;
  finishedInterviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  interviewToOffer: number;
}

export function funnel(apps: Application[], today: string): Funnel {
  const active = apps.filter((a) => a.status !== "Withdrawn");
  const decided = active.filter((a) => isDecided(a, today));
  const responses = decided.filter(hasResponse).length;
  const interviews = decided.filter(hasInterview).length;
  const finishedInterviews = decided.filter(isFinishedInterview).length;
  const offers = decided.filter(hasOffer).length;
  return {
    applications: active.length,
    decided: decided.length,
    pending: active.length - decided.length,
    responses,
    interviews,
    finishedInterviews,
    offers,
    responseRate: ratio(responses, decided.length),
    interviewRate: ratio(interviews, decided.length),
    interviewToOffer: ratio(offers, finishedInterviews),
  };
}

export function monthlyActivity(apps: Application[], today: string) {
  const buckets = new Map<string, Application[]>();
  for (const a of apps) {
    if (a.status === "Withdrawn") continue;
    const key = a.dateApplied.slice(0, 7);
    buckets.set(key, [...(buckets.get(key) ?? []), a]);
  }
  return [...buckets.keys()].sort().map((key) => {
    const f = funnel(buckets.get(key)!, today);
    const month = new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    return { key, month, applications: f.applications, responses: f.responses, interviews: f.interviews, offers: f.offers };
  });
}

export function groupFunnel<K extends string>(apps: Application[], today: string, keyOf: (a: Application) => K) {
  const groups = new Map<K, Application[]>();
  apps.forEach((a) => groups.set(keyOf(a), [...(groups.get(keyOf(a)) ?? []), a]));
  return [...groups.entries()].map(([key, list]) => ({ key, ...funnel(list, today) }));
}
