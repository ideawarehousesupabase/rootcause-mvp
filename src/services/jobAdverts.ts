import type { ApplicationInput, CvVersion } from "@/data/types";
import { guessRoleFamily, guessSeniority, looksLikeGraduateScheme } from "@/lib/jobGuess";
import { todayLocal } from "@/lib/utils";

// "Import from job link": the /api/read-job-advert function (api/read-job-advert.ts, on Vercel)
// reads the advert page; the result pre-fills a new application, which the user checks and saves
// to Firestore.

export interface JobAdvert {
  url: string;
  portal: string;
  title: string;
  employer: string;
  location: string;
  description: string;
  datePosted: string | null;
  employmentType: string | null;
  method: "structured-data" | "page-tags";
}

class AdvertError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readJobAdvert(url: string): Promise<JobAdvert> {
  let res: Response;
  try {
    res = await fetch("/api/read-job-advert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
      signal: AbortSignal.timeout(35_000),
    });
  } catch (err) {
    throw new AdvertError((err as Error)?.name === "TimeoutError" ? "timeout" : "offline", "");
  }
  const body = (await res.json().catch(() => null)) as (JobAdvert & { error?: { code: string; message: string } }) | null;
  if (!res.ok || !body || body.error) throw new AdvertError(body?.error?.code ?? "internal", body?.error?.message ?? "");
  return body;
}

export function advertToInput(advert: JobAdvert, cvVersions: CvVersion[]): ApplicationInput {
  return {
    jobTitle: advert.title,
    employer: advert.employer,
    location: advert.location,
    roleFamily: guessRoleFamily(advert.title, advert.description),
    seniority: guessSeniority(advert.title),
    isGraduateScheme: looksLikeGraduateScheme(advert.title, advert.description),
    jobDescription: advert.description,
    dateApplied: todayLocal(),
    cvVersionId: cvVersions[cvVersions.length - 1]?.id ?? "",
    status: "Applied",
    responseDate: null,
    recruiterResponse: "",
    interviewStage: "None",
    interviewOutcome: "Not applicable",
    feedback: "",
  };
}

/** A friendly message for a failed read. */
export function advertErrorMessage(err: unknown): string {
  const code = err instanceof AdvertError ? err.code : "";
  const message = err instanceof AdvertError ? err.message : "";
  if (code === "timeout") return "The advert took too long to read. Try again, or fill in the details by hand.";
  if (code === "offline") return "Couldn't reach the advert reader. Check your connection and try again.";
  if (message && code !== "internal") return message;
  return "The advert could not be read right now. Fill in the details by hand, or try again later.";
}
