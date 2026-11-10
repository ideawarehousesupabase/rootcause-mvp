import { useState } from "react";
import { Link } from "react-router-dom";
import { Archive, CheckCircle2, ChevronDown, Circle, Clock, Info, ListChecks, Lock, Microscope, Target } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ActionStatusBadge, CauseBadge, EmptyState, LoadingState, PageHeader, PriorityBadge } from "@/components/shared";
import type { ActionStatus, CorrectiveAction } from "@/data/types";
import { EVALUATION } from "@/engine";
import { cn, formatDate } from "@/lib/utils";
import { setActionStatus } from "@/services/diagnosis";
import { useCandidateData } from "@/store/CandidateDataContext";

const EDITABLE: ActionStatus[] = ["To Do", "In Progress", "Completed"];
const statusIcon = { "To Do": Circle, "In Progress": Clock, Completed: CheckCircle2 } as const;
const statusActive = {
  "To Do": "bg-slate-700 text-white border-slate-700",
  "In Progress": "bg-amber-500 text-white border-amber-500",
  Completed: "bg-teal text-white border-teal",
} as const;
const PRIORITY = { High: 0, Medium: 1, Low: 2 };

export default function Actions() {
  const { uid, loading, latestDiagnosis, currentActions, actions, latestEvaluation } = useCandidateData();
  const [showArchived, setShowArchived] = useState(false);

  const active = currentActions.filter((a) => a.status !== "Queued").sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
  const queued = currentActions.filter((a) => a.status === "Queued");
  const archived = actions.filter((a) => a.archived);
  const completed = active.filter((a) => a.status === "Completed").length;
  const percent = active.length ? Math.round((completed / active.length) * 100) : 0;

  if (loading) return <LoadingState />;
  const header = (
    <PageHeader
      title="Corrective Action Plan"
      description="Actions for your primary cause are active; secondary actions are held back so one change can be measured at a time."
    />
  );

  if (!latestDiagnosis) {
    return (
      <>
        {header}
        <EmptyState
          icon={ListChecks}
          title="No action plan yet"
          description="Run a diagnosis first. Your actions are generated from the primary cause it finds."
          action={
            <Button asChild>
              <Link to="/app/diagnostics">Go to diagnostics</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Active actions completed</CardTitle>
            <CardDescription>
              {completed} of {active.length} · diagnosis of {latestDiagnosis.createdAt ? formatDate(latestDiagnosis.createdAt.toDate().toISOString()) : "today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-semibold tabular-nums text-navy">{percent}%</span>
            <Progress value={percent} className="mt-3 h-3" indicatorClassName="bg-teal" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary cause</p>
            <div className="mt-2">{latestDiagnosis.primary ? <CauseBadge cause={latestDiagnosis.primary} className="text-sm" /> : <span className="text-sm">None yet</span>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Queued</p>
            <p className="mt-2 text-2xl font-semibold text-navy">{queued.length}</p>
          </CardContent>
        </Card>
      </div>

      {latestDiagnosis.changesAppliedAt && (
        <Alert variant="success" className="mt-6">
          <Target />
          <AlertDescription>
            Changes applied on {formatDate(latestDiagnosis.changesAppliedAt)}. Keep logging applications — the effect is measured after{" "}
            {latestDiagnosis.primary === "Delivery" ? `${EVALUATION.requiredAfterInterviews} more finished interviews` : `${EVALUATION.requiredAfterApplications} more decided applications`}
            {latestEvaluation?.verdict === "collecting" ? ` (${latestEvaluation.after.n} so far).` : "."}{" "}
            <Link to="/app/analytics" className="font-medium underline">
              Track it
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {!latestDiagnosis.primary && (
        <Alert variant="info" className="mt-6">
          <Info />
          <AlertDescription>
            Your latest diagnosis found no single dominant cause, so no actions were generated. Add more applications, job descriptions and feedback, then
            re-run.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-4">
        {active.map((a) => (
          <ActionCard key={a.id} action={a} uid={uid} />
        ))}
      </div>

      {queued.length > 0 && (
        <div className="mt-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Lock className="h-4 w-4" /> Queued — held until your first change has been measured
          </p>
          <div className="mt-3 grid gap-3">
            {queued.map((a) => (
              <ActionCard key={a.id} action={a} uid={uid} locked />
            ))}
          </div>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
            <Archive /> Archived from earlier diagnoses ({archived.length})
            <ChevronDown className={cn("transition-transform", showArchived && "rotate-180")} />
          </Button>
          {showArchived && (
            <div className="mt-3 grid gap-3 opacity-80">
              {archived.map((a) => (
                <ActionCard key={a.id} action={a} uid={uid} locked archived />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ActionCard({ action, uid, locked = false, archived = false }: { action: CorrectiveAction; uid: string; locked?: boolean; archived?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={cn(action.status === "Completed" && !archived && "bg-muted/30", locked && !archived && "border-dashed")}>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold text-navy", action.status === "Completed" && "text-muted-foreground line-through decoration-1")}>{action.title}</p>
            <CauseBadge cause={action.causeClass} />
            {!locked && <PriorityBadge priority={action.priority} />}
            <ActionStatusBadge status={action.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{action.description}</p>
          <button className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Hide steps" : "Show steps and success measure"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">
                {action.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-xs">
                <span className="font-medium text-navy">Success measure:</span> {action.successMeasure}
              </p>
            </div>
          )}
          {!archived && (
            <Link to="/app/diagnostics" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Microscope className="h-3.5 w-3.5" /> Linked to the {action.causeClass} finding
            </Link>
          )}
          {action.completedAt && <p className="mt-1 text-xs text-muted-foreground">Completed {formatDate(action.completedAt.toDate().toISOString())}</p>}
        </div>
        {!locked && (
          <div className="flex shrink-0 rounded-lg border bg-white p-1" role="radiogroup" aria-label={`Status for ${action.title}`}>
            {EDITABLE.map((s) => {
              const Icon = statusIcon[s as keyof typeof statusIcon];
              const on = action.status === s;
              return (
                <button
                  key={s}
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={async () => {
                    if (on) return;
                    setBusy(true);
                    try {
                      await setActionStatus(uid, action, s);
                      toast.success(`"${action.title}" marked ${s.toLowerCase()}.`);
                    } catch {
                      toast.error("Could not update the action.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-xs font-medium transition-colors",
                    on ? statusActive[s as keyof typeof statusActive] : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
