import { z } from "zod";
import { APPLICATION_STATUSES, INTERVIEW_OUTCOMES, INTERVIEW_STAGES, ROLE_FAMILIES, SENIORITIES } from "@/data/types";
import { todayLocal } from "./utils";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Shared by the manual application form and CSV import. */
export const applicationSchema = z
  .object({
    jobTitle: z.string().trim().min(1, "Enter the job title.").max(200),
    employer: z.string().trim().min(1, "Enter the employer.").max(200),
    location: z.string().trim().max(200),
    roleFamily: z.enum(ROLE_FAMILIES, { errorMap: () => ({ message: "Choose a role family from the list." }) }),
    seniority: z.enum(SENIORITIES, { errorMap: () => ({ message: "Choose a seniority level from the list." }) }),
    isGraduateScheme: z.boolean(),
    jobDescription: z.string().max(20000),
    dateApplied: z.string().regex(isoDate, "Enter the date applied."),
    cvVersionId: z.string().min(1, "Select the CV version used."),
    status: z.enum(APPLICATION_STATUSES),
    responseDate: z.string().regex(isoDate).nullable(),
    recruiterResponse: z.string().max(2000),
    interviewStage: z.enum(INTERVIEW_STAGES),
    interviewOutcome: z.enum(INTERVIEW_OUTCOMES),
    feedback: z.string().max(5000),
  })
  .superRefine((a, ctx) => {
    if (a.dateApplied > todayLocal()) ctx.addIssue({ code: "custom", path: ["dateApplied"], message: "Date applied cannot be in the future." });
    if (a.responseDate && a.responseDate < a.dateApplied)
      ctx.addIssue({ code: "custom", path: ["responseDate"], message: "Response date cannot be before the date applied." });
    if (a.responseDate && a.responseDate > todayLocal()) ctx.addIssue({ code: "custom", path: ["responseDate"], message: "Response date cannot be in the future." });
    if (a.interviewStage !== "None" && !["Interview", "Offer", "Rejected"].includes(a.status))
      ctx.addIssue({ code: "custom", path: ["interviewStage"], message: "An interview stage needs status Interview, Offer or Rejected." });
    if (a.status === "Offer" && a.interviewStage === "None")
      ctx.addIssue({ code: "custom", path: ["interviewStage"], message: "An offer needs an interview stage." });
  });

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
