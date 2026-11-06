import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, StatusBadge } from "@/components/shared";
import {
  APPLICATION_STATUSES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  ROLE_FAMILIES,
  SENIORITIES,
  type Application,
  type ApplicationInput,
  type CvVersion,
  type JdAnalysis,
} from "@/data/types";
import { analyseJd, derivedState } from "@/engine";
import { fieldErrors, applicationSchema } from "@/lib/validation";
import { formatDate, todayLocal } from "@/lib/utils";
import { coherentStatus } from "@/services/evidence";

export function emptyInput(cvVersions: CvVersion[], roleFamily?: ApplicationInput["roleFamily"]): ApplicationInput {
  return {
    jobTitle: "",
    employer: "",
    location: "",
    roleFamily: roleFamily ?? "Business Analysis",
    seniority: "Junior",
    isGraduateScheme: false,
    jobDescription: "",
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

export function toInput(a: Application): ApplicationInput {
  return {
    jobTitle: a.jobTitle,
    employer: a.employer,
    location: a.location,
    roleFamily: a.roleFamily,
    seniority: a.seniority,
    isGraduateScheme: a.isGraduateScheme,
    jobDescription: a.jobDescription,
    dateApplied: a.dateApplied,
    cvVersionId: a.cvVersionId,
    status: a.status,
    responseDate: a.responseDate,
    recruiterResponse: a.recruiterResponse,
    interviewStage: a.interviewStage,
    interviewOutcome: a.interviewOutcome,
    feedback: a.feedback,
  };
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  labels,
  placeholder,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: Record<string, string>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labels?.[o] ?? o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function JdSummary({ analysis }: { analysis: JdAnalysis }) {
  const bits = [
    analysis.requiredSkills.length ? `Requires: ${analysis.requiredSkills.join(", ")}` : null,
    analysis.requiredQualifications.length ? `Qualifications: ${analysis.requiredQualifications.join(", ")}` : null,
    analysis.impactDemand ? "Asks for measurable impact" : null,
    analysis.minYears !== null ? `${analysis.minYears}+ years` : null,
    analysis.requiresDegreeClass ? `${analysis.requiresDegreeClass} degree` : null,
  ].filter((b): b is string => Boolean(b));
  if (!bits.length) return <p className="text-xs text-muted-foreground">No requirements detected yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {bits.map((b) => (
        <Badge key={b} variant="slate" className="whitespace-normal">
          {b}
        </Badge>
      ))}
    </div>
  );
}

/** Add / edit a job application. */
export function ApplicationFormDialog({
  open,
  onOpenChange,
  initial,
  cvVersions,
  onSubmit,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ApplicationInput;
  cvVersions: CvVersion[];
  onSubmit: (input: ApplicationInput) => Promise<void>;
  title: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setErrors({});
    }
    // Reset only when the dialog opens; callers often build `initial` inline.
  }, [open]);

  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit() {
    const parsed = applicationSchema.safeParse(draft);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } catch {
      setErrors({ form: "Could not save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const cvLabels = Object.fromEntries(cvVersions.map((c) => [c.id, c.label]));
  const jd = analyseJd(draft.jobDescription);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Paste the job description so the engine can read the role's requirements.</DialogDescription>
        </DialogHeader>
        {cvVersions.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Add a CV version in Evidence Capture first, so each application can record which CV you used.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-title">Job title</Label>
              <Input id="f-title" value={draft.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
              <FieldError message={errors.jobTitle} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-employer">Employer</Label>
              <Input id="f-employer" value={draft.employer} onChange={(e) => set("employer", e.target.value)} />
              <FieldError message={errors.employer} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-location">Location</Label>
              <Input id="f-location" value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Leeds / Remote (UK)" />
            </div>
            <SelectField id="f-family" label="Role family" value={draft.roleFamily} options={ROLE_FAMILIES} onChange={(v) => set("roleFamily", v)} />
            <SelectField id="f-seniority" label="Seniority" value={draft.seniority} options={SENIORITIES} onChange={(v) => set("seniority", v)} />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isGraduateScheme} onChange={(e) => set("isGraduateScheme", e.target.checked)} />
                Graduate scheme / programme
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-date">Date applied</Label>
              <Input id="f-date" type="date" max={todayLocal()} value={draft.dateApplied} onChange={(e) => set("dateApplied", e.target.value)} />
              <FieldError message={errors.dateApplied} />
            </div>
            <div className="space-y-2">
              <SelectField
                id="f-cv"
                label="CV version used"
                value={draft.cvVersionId}
                options={cvVersions.map((c) => c.id)}
                labels={cvLabels}
                placeholder="Select a CV"
                onChange={(v) => set("cvVersionId", v)}
              />
              <FieldError message={errors.cvVersionId} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="f-jd">Job description</Label>
              <Textarea
                id="f-jd"
                rows={4}
                value={draft.jobDescription}
                onChange={(e) => set("jobDescription", e.target.value)}
                placeholder="Paste the requirements from the job advert"
              />
              {draft.jobDescription.trim() && <JdSummary analysis={jd} />}
            </div>
            <SelectField id="f-status" label="Status" value={draft.status} options={APPLICATION_STATUSES} onChange={(v) => setDraft((d) => coherentStatus(d, v))} />
            <div className="space-y-2">
              <Label htmlFor="f-response">Response date</Label>
              <Input
                id="f-response"
                type="date"
                max={todayLocal()}
                value={draft.responseDate ?? ""}
                onChange={(e) => set("responseDate", e.target.value || null)}
              />
              <FieldError message={errors.responseDate} />
            </div>
            <SelectField id="f-stage" label="Interview stage" value={draft.interviewStage} options={INTERVIEW_STAGES} onChange={(v) => set("interviewStage", v)} />
            <SelectField
              id="f-outcome"
              label="Interview outcome"
              value={draft.interviewOutcome}
              options={INTERVIEW_OUTCOMES}
              onChange={(v) => set("interviewOutcome", v)}
            />
            <div className="sm:col-span-2">
              <FieldError message={errors.interviewStage ?? errors.form} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || cvVersions.length === 0}>
            {saving && <Loader2 className="animate-spin" />} Save application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type FeedbackDraft = Pick<ApplicationInput, "status" | "responseDate" | "recruiterResponse" | "interviewStage" | "interviewOutcome" | "feedback">;

/** Recruiter and interview feedback for one application. */
export function FeedbackDialog({
  open,
  onOpenChange,
  application,
  applications,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  application: Application | null;
  applications: Application[];
  onSubmit: (applicationId: string, draft: FeedbackDraft) => Promise<void>;
}) {
  const [appId, setAppId] = useState("");
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const target = applications.find((a) => a.id === appId) ?? null;

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setAppId(application?.id ?? "");
  }, [open, application?.id]);

  useEffect(() => {
    if (!target) return setDraft(null);
    setDraft({
      status: target.status,
      responseDate: target.responseDate,
      recruiterResponse: target.recruiterResponse,
      interviewStage: target.interviewStage,
      interviewOutcome: target.interviewOutcome,
      feedback: target.feedback,
    });
    // Load the selected application's values once, when the selection changes.
  }, [target?.id]);

  async function submit() {
    if (!target || !draft) return setError("Select the application this feedback relates to.");
    const parsed = applicationSchema.safeParse({ ...toInput(target), ...draft });
    if (!parsed.success) return setError(Object.values(fieldErrors(parsed.error))[0]);
    setSaving(true);
    try {
      await onSubmit(target.id, draft);
      onOpenChange(false);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const appLabels = Object.fromEntries(applications.map((a) => [a.id, `${a.jobTitle} — ${a.employer}`]));
  const set = <K extends keyof FeedbackDraft>(k: K, v: FeedbackDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recruiter and interview feedback</DialogTitle>
          <DialogDescription>{target ? `${target.jobTitle} — ${target.employer}` : "Record what the employer told you about an application."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!application && (
            <SelectField
              id="fb-app"
              label="Application"
              value={appId}
              options={applications.map((a) => a.id)}
              labels={appLabels}
              placeholder="Select an application"
              onChange={setAppId}
            />
          )}
          {draft && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  id="fb-status"
                  label="Status"
                  value={draft.status}
                  options={APPLICATION_STATUSES}
                  onChange={(v) => setDraft((d) => (d ? coherentStatus(d, v) : d))}
                />
                <div className="space-y-2">
                  <Label htmlFor="fb-date">Response date</Label>
                  <Input
                    id="fb-date"
                    type="date"
                    max={todayLocal()}
                    value={draft.responseDate ?? ""}
                    onChange={(e) => set("responseDate", e.target.value || null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-response">Recruiter response</Label>
                <Input
                  id="fb-response"
                  value={draft.recruiterResponse}
                  onChange={(e) => set("recruiterResponse", e.target.value)}
                  placeholder="e.g. Rejection email after CV screening"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField id="fb-stage" label="Interview stage" value={draft.interviewStage} options={INTERVIEW_STAGES} onChange={(v) => set("interviewStage", v)} />
                <SelectField
                  id="fb-outcome"
                  label="Interview outcome"
                  value={draft.interviewOutcome}
                  options={INTERVIEW_OUTCOMES}
                  onChange={(v) => set("interviewOutcome", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-feedback">Feedback (when available)</Label>
                <Textarea id="fb-feedback" rows={3} value={draft.feedback} onChange={(e) => set("feedback", e.target.value)} />
              </div>
            </>
          )}
          <FieldError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !draft}>
            {saving && <Loader2 className="animate-spin" />} Save feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApplicationDetailsDialog({
  application,
  cvLabel,
  today,
  onOpenChange,
  onEdit,
  onFeedback,
}: {
  application: Application | null;
  cvLabel: (id: string) => string;
  today: string;
  onOpenChange: (o: boolean) => void;
  onEdit: (a: Application) => void;
  onFeedback: (a: Application) => void;
}) {
  const a = application;
  return (
    <Dialog open={!!a} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {a && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{a.jobTitle}</DialogTitle>
                <StatusBadge status={a.status} derived={derivedState(a, today)} />
                {a.source === "csv" && <Badge variant="outline">Imported</Badge>}
              </div>
              <DialogDescription>
                {a.employer}
                {a.location && ` · ${a.location}`} · Applied {formatDate(a.dateApplied)}
                {a.responseDate && ` · Response ${formatDate(a.responseDate)}`}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Role family" value={`${a.roleFamily} · ${a.seniority}${a.isGraduateScheme ? " · Graduate scheme" : ""}`} />
              <Detail label="CV version" value={cvLabel(a.cvVersionId)} />
              <Detail label="Recruiter response" value={a.recruiterResponse || "No response recorded"} />
              <Detail label="Interview" value={a.interviewStage === "None" ? "No interview" : `${a.interviewStage} · ${a.interviewOutcome}`} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What the engine read from the job description</dt>
                <dd className="mt-1">
                  <JdSummary analysis={a.jdAnalysis} />
                </dd>
              </div>
              <Detail className="sm:col-span-2" label="Job description" value={a.jobDescription || "Not recorded — paste it to improve the diagnosis"} />
              <Detail className="sm:col-span-2" label="Feedback" value={a.feedback || "No feedback recorded"} />
            </dl>
            <DialogFooter>
              <Button variant="outline" onClick={() => onFeedback(a)}>
                Add feedback
              </Button>
              <Button onClick={() => onEdit(a)}>Edit application</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-foreground">{value}</dd>
    </div>
  );
}
