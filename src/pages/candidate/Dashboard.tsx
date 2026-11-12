import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Award, Bell, CalendarCheck, CheckCircle2, Circle, ListChecks, Mail, Microscope, Percent, Plus, Send, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplicationFormDialog, emptyInput } from "@/components/candidate/ApplicationDialogs";
import { ActionStatusBadge, CauseBadge, ConfidenceMeter, EngineBadge, KpiCard, LoadingState, PageHeader, PriorityBadge, StatusBadge } from "@/components/shared";
import { daysBetween, derivedState } from "@/engine";
import { MIN_DECIDED_TO_RUN } from "@/engine/config";
import { formatDate, todayLocal } from "@/lib/utils";
import { addApplication } from "@/services/evidence";
import { useCandidateData } from "@/store/CandidateDataContext";

const pctLabel = (x: number) => `${Math.round(x * 100)}%`;
const PRIORITY = { High: 0, Medium: 1, Low: 2 };

export default function Dashboard() {
  const data = useCandidateData();
  const { uid, user, loading, applications, cvVersions, funnel: f, today, latestDiagnosis, currentActions, latestEvaluation, readiness, evidenceChangedSinceDiagnosis } = data;
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  if (loading) return <LoadingState />;

  const firstName = user.fullName.split(" ")[0] || "there";
  const onboarding = [
    { label: "Complete your profile", done: Boolean(user.profile?.targetRoleFamilies.length), to: "/app/profile" },
    { label: "Add your CV (at least 3 experience bullets)", done: cvVersions.some((c) => c.analysis.bulletCount >= 3), to: "/app/evidence" },
    { label: `Add at least ${MIN_DECIDED_TO_RUN} decided applications`, done: f.decided >= MIN_DECIDED_TO_RUN, to: "/app/applications" },
    { label: "Run your first diagnosis", done: Boolean(latestDiagnosis), to: "/app/diagnostics" },
  ];
  const onboardingDone = onboarding.every((o) => o.done);

  const active = currentActions.filter((a) => a.status !== "Queued");
  const completed = active.filter((a) => a.status === "Completed").length;
  const next = [...active].filter((a) => a.status !== "Completed").sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || (a.status === "In Progress" ? -1 : 1))[0];

  const nudges: { text: string; to: string }[] = [];
  const stale = applications.filter((a) => a.status === "Applied" && !a.responseDate && daysBetween(a.dateApplied, today) >= 21 && daysBetween(a.dateApplied, today) < 30);
  if (stale.length) nudges.push({ text: `${stale.length} application${stale.length === 1 ? "" : "s"} pending for 3+ weeks — record any reply.`, to: "/app/applications" });
  const awaiting = applications.filter((a) => a.status === "Interview" || a.interviewOutcome === "Awaiting outcome");
  if (awaiting.length) nudges.push({ text: `${awaiting.length} interview${awaiting.length === 1 ? "" : "s"} awaiting an outcome — update when you hear back.`, to: "/app/applications" });
  const slow = active.filter((a) => a.status === "In Progress" && a.startedAt && daysBetween(todayLocal(a.startedAt.toDate()), today) > 21);
  if (slow.length) nudges.push({ text: `${slow.length} action${slow.length === 1 ? "" : "s"} in progress for over 3 weeks.`, to: "/app/actions" });
  if (latestEvaluation?.verdict === "collecting")
    nudges.push({ text: `${latestEvaluation.required - latestEvaluation.after.n} more to measure your change.`, to: "/app/analytics" });
  const emptyCvs = cvVersions.filter((c) => c.analysis.bulletCount === 0);
  if (emptyCvs.length) nudges.push({ text: `"${emptyCvs[0].label}" has no content — add its text so it can be analysed.`, to: "/app/evidence" });
  if (evidenceChangedSinceDiagnosis && readiness.canRun) nudges.push({ text: "New evidence since your last diagnosis — re-run it.", to: "/app/diagnostics" });

  const recent = applications.slice(0, 6);
  const primary = latestDiagnosis?.primary;

  return (
    <>
      <PageHeader
        title={`Welcome${latestDiagnosis ? " back" : ""}, ${firstName}`}
        description="Your job-search performance, latest diagnosis and corrective actions — all from the evidence in your workspace."
        actions={
          <>
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Add Application
            </Button>
          </>
        }
      />

      {!onboardingDone && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              {onboarding.filter((o) => o.done).length} of {onboarding.length} steps complete
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {onboarding.map((o) => (
              <Link key={o.label} to={o.to} className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                {o.done ? <CheckCircle2 className="h-5 w-5 text-teal" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <span className={o.done ? "text-muted-foreground line-through" : "font-medium text-navy"}>{o.label}</span>
                {!o.done && <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Total applications" value={f.applications} hint={f.pending ? `${f.pending} pending` : undefined} icon={Send} tone="blue" />
        <KpiCard label="Employer responses" value={f.responses} icon={Mail} tone="teal" />
        <KpiCard label="Interviews received" value={f.interviews} icon={CalendarCheck} tone="violet" />
        <KpiCard label="Offers received" value={f.offers} icon={Award} tone="green" />
        <KpiCard label="Response rate" value={pctLabel(f.responseRate)} hint="Responses ÷ decided" icon={Percent} tone="navy" />
        <KpiCard label="Interview conversion" value={pctLabel(f.interviewRate)} hint="Interviews ÷ decided" icon={TrendingUp} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Microscope className="h-4 w-4 text-primary" /> Latest root-cause diagnosis
              </CardTitle>
              <CardDescription className="mt-1">
                {latestDiagnosis?.createdAt ? `Run ${formatDate(latestDiagnosis.createdAt.toDate().toISOString())} · ${latestDiagnosis.sufficiency} evidence` : "Not run yet"}
              </CardDescription>
            </div>
            <EngineBadge />
          </CardHeader>
          <CardContent>
            {!latestDiagnosis ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {readiness.canRun ? "You have enough evidence for a diagnosis." : readiness.checks.find((c) => !c.done)?.detail}
              </div>
            ) : primary ? (
              <div className="rounded-lg border border-l-4 border-l-teal bg-teal-soft/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CauseBadge cause={primary} className="text-sm" />
                  {latestDiagnosis.secondary && (
                    <span className="text-xs text-muted-foreground">
                      Monitoring {latestDiagnosis.secondary} ({latestDiagnosis.classes[latestDiagnosis.secondary].confidence.toFixed(2)})
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{latestDiagnosis.rationale[0]?.text}</p>
                <ConfidenceMeter value={latestDiagnosis.classes[primary].confidence} className="mt-4 max-w-sm" />
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 p-4 text-sm">{latestDiagnosis.rationale[0]?.text}</p>
            )}
            <Button variant="outline" className="mt-4" asChild>
              <Link to="/app/diagnostics">
                {latestDiagnosis ? "View Diagnosis" : "Go to diagnostics"} <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-teal" /> Corrective actions
            </CardTitle>
            <CardDescription>For your primary cause</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini value={active.length} label="Active" />
              <Mini value={completed} label="Completed" />
              <Mini value={`${active.length ? Math.round((completed / active.length) * 100) : 0}%`} label="Complete" />
            </div>
            <Progress value={active.length ? (completed / active.length) * 100 : 0} indicatorClassName="bg-teal" />
            {next ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next priority action</p>
                <p className="mt-1 font-medium text-navy">{next.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PriorityBadge priority={next.priority} />
                  <ActionStatusBadge status={next.status} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{active.length ? "All active actions are complete." : "Actions appear after your first diagnosis."}</p>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link to="/app/actions">Open action plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {nudges.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" /> Keep your evidence up to date
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {nudges.map((n) => (
              <Link key={n.text} to={n.to} className="flex items-center gap-2 rounded-lg border bg-amber-50/50 p-3 text-sm hover:bg-amber-50">
                <span className="min-w-0 flex-1">{n.text}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent applications</CardTitle>
              <CardDescription className="mt-1">
                Latest {recent.length} of {applications.length}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/applications">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {recent.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Employer</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/app/applications?view=${a.id}`)}>
                      <TableCell className="font-medium text-navy">{a.jobTitle}</TableCell>
                      <TableCell className="text-muted-foreground">{a.employer}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(a.dateApplied)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} derived={derivedState(a, today)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Your applications will appear here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ApplicationFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add application"
        initial={emptyInput(cvVersions, user.profile?.targetRoleFamilies[0])}
        cvVersions={cvVersions}
        onSubmit={async (input) => {
          await addApplication(uid, input);
          toast.success("Application added.");
        }}
      />
    </>
  );
}

function Mini({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
