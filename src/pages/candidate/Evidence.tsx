import { useState } from "react";
import { ClipboardList, FileText, Link2, MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationFormDialog, emptyInput, FeedbackDialog, JdSummary, toInput } from "@/components/candidate/ApplicationDialogs";
import { CvDialog } from "@/components/candidate/CvDialog";
import { JobLinkDialog } from "@/components/candidate/JobLinkDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, LoadingState, PageHeader, StatusBadge } from "@/components/shared";
import type { Application, ApplicationInput, CvVersion } from "@/data/types";
import { derivedState } from "@/engine";
import { cn, formatDate } from "@/lib/utils";
import {
  addApplication,
  addCvVersion,
  deleteApplication,
  deleteCvVersion,
  patchApplication,
  updateApplication,
  updateCvVersion,
} from "@/services/evidence";
import { advertToInput } from "@/services/jobAdverts";
import { useCandidateData } from "@/store/CandidateDataContext";

const hasFeedback = (a: Application) => Boolean(a.recruiterResponse || a.feedback || a.interviewStage !== "None");
const strengthColour = { Strong: "text-emerald-700", Partial: "text-amber-700", Weak: "text-red-700" } as const;

export default function Evidence() {
  const { uid, user, loading, cvVersions, applications, today, cvLabel } = useCandidateData();
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null);
  const [cvDialog, setCvDialog] = useState<{ open: boolean; editing: CvVersion | null }>({ open: false, editing: null });
  const [appDialog, setAppDialog] = useState<{ open: boolean; editing: Application | null; prefill?: ApplicationInput; jobUrl?: string }>({ open: false, editing: null });
  const [linkOpen, setLinkOpen] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{ open: boolean; app: Application | null }>({ open: false, app: null });
  const [confirm, setConfirm] = useState<{ kind: "app" | "cv" | "feedback"; id: string; label: string } | null>(null);

  if (loading) return <LoadingState />;

  const selectedCv = cvVersions.find((c) => c.id === selectedCvId) ?? cvVersions[cvVersions.length - 1];
  const usage = (id: string) => applications.filter((a) => a.cvVersionId === id).length;
  const feedbackApps = applications.filter(hasFeedback);

  async function onConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "app") await deleteApplication(uid, confirm.id);
      else if (confirm.kind === "cv") {
        const cv = cvVersions.find((c) => c.id === confirm.id);
        if (cv) await deleteCvVersion(uid, cv);
      }
      else await patchApplication(uid, confirm.id, { recruiterResponse: "", feedback: "", interviewStage: "None", interviewOutcome: "Not applicable" });
      toast.success("Removed.");
    } catch {
      toast.error("Could not remove. Please try again.");
    }
  }

  return (
    <>
      <PageHeader
        title="Evidence Capture"
        description="Your CVs, applications and employer feedback. The diagnostic engine looks for patterns across all of it."
      />

      <Tabs defaultValue={cvVersions.length ? "applications" : "cv"}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="cv">A. CV evidence ({cvVersions.length})</TabsTrigger>
          <TabsTrigger value="applications">B. Job applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="feedback">C. Recruiter & interview feedback ({feedbackApps.length})</TabsTrigger>
        </TabsList>

        {/* ---------- A. CV evidence ---------- */}
        <TabsContent value="cv">
          {cvVersions.length === 0 ? (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  icon={FileText}
                  title="No CV yet"
                  description="Paste or type your CV so the engine can check each statement for measurable evidence."
                  action={
                    <Button onClick={() => setCvDialog({ open: true, editing: null })}>
                      <Plus /> Add CV version
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>CV versions</CardTitle>
                    <CardDescription className="mt-1">Select one to see its analysis.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setCvDialog({ open: true, editing: null })}>
                    <Plus /> Add CV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cvVersions.map((cv) => {
                    const used = usage(cv.id);
                    const incomplete = cv.analysis.bulletCount === 0;
                    return (
                      <div
                        key={cv.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCvId(cv.id)}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedCvId(cv.id)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                          selectedCv?.id === cv.id ? "border-primary bg-blue-50/60 ring-1 ring-primary" : "hover:bg-muted/50",
                        )}
                      >
                        <div className="rounded-md bg-blue-50 p-2 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-navy">{cv.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {incomplete ? (
                              <span className="font-medium text-amber-700">No content yet — add the CV text</span>
                            ) : (
                              `${cv.analysis.bulletCount} bullets · ${Math.round(cv.analysis.quantifiedRatio * 100)}% quantified`
                            )}{" "}
                            · used in {used} application{used === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit CV"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCvDialog({ open: true, editing: cv });
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete CV"
                          disabled={used > 0}
                          title={used > 0 ? "Used by applications — reassign them first" : "Delete CV"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({ kind: "cv", id: cv.id, label: cv.label });
                          }}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {selectedCv && (
                <Card className="lg:col-span-3">
                  <CardHeader>
                    <CardTitle>{selectedCv.label}</CardTitle>
                    <CardDescription>
                      {selectedCv.fileName ? `${selectedCv.fileName} · ` : ""}
                      {selectedCv.createdAt ? `Added ${formatDate(selectedCv.createdAt.toDate().toISOString())}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <Stat label="Quantified" value={`${Math.round(selectedCv.analysis.quantifiedRatio * 100)}%`} />
                      <Stat label="Strong bullets" value={`${Math.round(selectedCv.analysis.strongRatio * 100)}%`} />
                      <Stat label="Duty-style openings" value={`${Math.round(selectedCv.analysis.weakOpeningRatio * 100)}%`} />
                    </div>
                    <Progress value={selectedCv.analysis.quantifiedRatio * 100} indicatorClassName="bg-teal" />
                    {selectedCv.personalStatement && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal statement</p>
                        <p className="mt-1">{selectedCv.personalStatement}</p>
                        {selectedCv.analysis.genericStatement && <p className="mt-1 text-xs text-amber-700">Generic: {selectedCv.analysis.genericReasons.join("; ")}</p>}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience statements</p>
                      <ul className="mt-2 space-y-2">
                        {selectedCv.analysis.bullets.map((b, i) => (
                          <li key={i} className="rounded-md border p-2.5">
                            <p>{b.text}</p>
                            <p className={cn("mt-1 text-xs font-medium", strengthColour[b.strength])}>
                              {b.strength}
                              {b.reasons.length ? ` — ${b.reasons.join(" · ")}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {(selectedCv.projects ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projects</p>
                        <ul className="mt-2 space-y-2">
                          {selectedCv.projects!.map((p, i) => (
                            <li key={i} className="rounded-md border p-2.5">
                              {p.name && <p className="font-medium">{p.name}</p>}
                              {p.bullets.map((b, j) => (
                                <p key={j} className="mt-1 text-muted-foreground">
                                  {b}
                                </p>
                              ))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedCv.analysis.mentionedSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills the engine found in this CV</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedCv.analysis.mentionedSkills.map((s) => (
                            <Badge key={s} variant="slate">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ---------- B. Job application evidence ---------- */}
        <TabsContent value="applications">
          <Card>
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Job application evidence</CardTitle>
                <CardDescription className="mt-1">Add applications by hand, or from the link to the job advert.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                  <Link2 /> Import from job link
                </Button>
                <Button size="sm" onClick={() => setAppDialog({ open: true, editing: null })}>
                  <Plus /> Add application
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {applications.length === 0 ? (
                <div className="px-5">
                  <EmptyState
                    icon={ClipboardList}
                    title="No applications yet"
                    description="Add your applications by hand or from a job advert link. At least 3 decided applications are needed for a diagnosis."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job title</TableHead>
                      <TableHead>Employer</TableHead>
                      <TableHead className="hidden md:table-cell">What the engine read</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>CV</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-navy">{a.jobTitle}</TableCell>
                        <TableCell className="text-muted-foreground">{a.employer}</TableCell>
                        <TableCell className="hidden max-w-xs md:table-cell">
                          {a.jobDescription ? <JdSummary analysis={a.jdAnalysis} /> : <span className="text-xs text-amber-700">No job description</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(a.dateApplied)}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">{cvLabel(a.cvVersionId)}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} derived={derivedState(a, today)} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setAppDialog({ open: true, editing: a })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setConfirm({ kind: "app", id: a.id, label: `${a.jobTitle} — ${a.employer}` })}>
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- C. Recruiter and interview feedback ---------- */}
        <TabsContent value="feedback">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Employer responses, interview stages and feedback. Applications with no reply after 30 days are counted as "No response" automatically.
            </p>
            <Button size="sm" onClick={() => setFeedbackDialog({ open: true, app: null })} disabled={!applications.length}>
              <Plus /> Add feedback
            </Button>
          </div>
          {feedbackApps.length === 0 ? (
            <EmptyState icon={MessageSquareQuote} title="No feedback recorded" description="Add recruiter responses or interview feedback as you receive them." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {feedbackApps.map((a) => (
                <Card key={a.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">{a.jobTitle}</CardTitle>
                        <CardDescription className="mt-0.5">
                          {a.employer} · {formatDate(a.dateApplied)}
                        </CardDescription>
                      </div>
                      <StatusBadge status={a.status} derived={derivedState(a, today)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Recruiter response</p>
                        <p>{a.recruiterResponse || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Interview</p>
                        <p>{a.interviewStage === "None" ? "No interview" : `${a.interviewStage} · ${a.interviewOutcome}`}</p>
                      </div>
                    </div>
                    {a.feedback && <blockquote className="border-l-2 border-teal pl-3 italic text-slate-700">"{a.feedback}"</blockquote>}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setFeedbackDialog({ open: true, app: a })}>
                        <Pencil /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirm({ kind: "feedback", id: a.id, label: `${a.jobTitle} — ${a.employer}` })}>
                        <Trash2 /> Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CvDialog
        open={cvDialog.open}
        onOpenChange={(open) => setCvDialog((s) => ({ ...s, open }))}
        editing={cvDialog.editing}
        existingLabels={cvVersions.map((c) => c.label)}
        onSave={async (cv, fromFile) => {
          if (cvDialog.editing) await updateCvVersion(uid, cvDialog.editing.id, cv);
          else setSelectedCvId(await addCvVersion(uid, cv));
          toast.success(fromFile ? "CV text extracted, saved and analysed." : "CV saved and analysed.");
        }}
      />

      <ApplicationFormDialog
        open={appDialog.open}
        onOpenChange={(open) => setAppDialog((s) => ({ ...s, open }))}
        title={appDialog.editing ? "Edit application" : "Add application"}
        initial={appDialog.editing ? toInput(appDialog.editing) : (appDialog.prefill ?? emptyInput(cvVersions, user.profile?.targetRoleFamilies[0]))}
        cvVersions={cvVersions}
        onSubmit={async (input) => {
          if (appDialog.editing) await updateApplication(uid, appDialog.editing.id, input);
          else await addApplication(uid, input, { jobUrl: appDialog.jobUrl });
          toast.success("Application saved.");
        }}
      />

      <JobLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        hasCv={cvVersions.length > 0}
        onRead={(advert) => {
          setLinkOpen(false);
          setAppDialog({ open: true, editing: null, prefill: advertToInput(advert, cvVersions), jobUrl: advert.url });
          toast.success(`Read the advert from ${advert.portal}. Check the details, then save.`);
        }}
        onManual={(url) => {
          setLinkOpen(false);
          setAppDialog({ open: true, editing: null, jobUrl: url });
        }}
      />

      <FeedbackDialog
        open={feedbackDialog.open}
        onOpenChange={(open) => setFeedbackDialog((s) => ({ ...s, open }))}
        application={feedbackDialog.app}
        applications={applications}
        onSubmit={async (id, draft) => {
          await patchApplication(uid, id, draft);
          toast.success("Feedback saved.");
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "feedback" ? "Remove feedback?" : "Delete?"}
        description={`"${confirm?.label}" will be ${confirm?.kind === "feedback" ? "cleared of its feedback" : "permanently deleted"}.`}
        confirmLabel={confirm?.kind === "feedback" ? "Remove" : "Delete"}
        onConfirm={onConfirm}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-lg font-semibold text-navy">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
