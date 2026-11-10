import { httpsCallable } from "firebase/functions";
import type { ApplicationInput, CvVersion } from "@/data/types";
import { requireFunctions } from "@/lib/firebase";
import { guessRoleFamily, guessSeniority, looksLikeGraduateScheme } from "@/lib/jobGuess";
import { todayLocal } from "@/lib/utils";

// "Import from job link": the readJobAdvert Cloud Function reads the advert page;
// the result pre-fills a new application, which the user checks and saves.

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

export async function readJobAdvert(url: string): Promise<JobAdvert> {
  const call = httpsCallable<{ url: string }, JobAdvert>(requireFunctions(), "readJobAdvert", { timeout: 35_000 });
  return (await call({ url: url.trim() })).data;
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

/** A friendly message, and whether the user should fill the details in by hand. */
export function advertErrorMessage(err: unknown): string {
  const code = String((err as { code?: string })?.code ?? "").replace(/^functions\//, "");
  const message = (err as { message?: string })?.message ?? "";
  switch (code) {
    case "invalid-argument":
    case "permission-denied":
    case "not-found":
    case "unavailable":
    case "out-of-range":
      return message || "The advert could not be read.";
    case "deadline-exceeded":
      return "The advert took too long to read. Try again, or fill in the details by hand.";
    default:
      return "The advert could not be read right now. Fill in the details by hand, or try again later.";
  }
}
