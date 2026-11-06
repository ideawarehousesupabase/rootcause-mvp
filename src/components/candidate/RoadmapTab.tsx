import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, BookOpen, Briefcase, CheckCircle2, Circle, Clock, ListChecks, Map, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared";
import { SAMPLE_VACANCIES } from "@/data/sampleVacancies";
import { ROADMAP_STATUSES, type ActionStatus, type RoadmapKind, type RoadmapStatus, type RoadmapStep } from "@/data/types";
import { skillsGap, suggestRoadmapSteps } from "@/engine";
import { cn, formatDate } from "@/lib/utils";
import { addRoadmapSteps, deleteRoadmapStep, moveRoadmapStep, setRoadmapStatus, setRoadmapTargetDate } from "@/services/career";
import { setActionStatus } from "@/services/diagnosis";
import { useCandidateData } from "@/store/CandidateDataContext";

const KIND: Record<RoadmapKind, { label: string; icon: typeof ListChecks; variant: "blue" | "teal" | "violet" }> = {
  action: { label: "Corrective action", icon: ListChecks, variant: "blue" },
  learning: { label: "Learning", icon: BookOpen, variant: "teal" },
  career: { label: "Career step", icon: Briefcase, variant: "violet" },
};
const statusIcon = { "To Do": Circle, "In Progress": Clock, Completed: CheckCircle2 } as const;
const statusActive = {
  "To Do": "bg-slate-700 text-white border-slate-700",
  "In Progress": "bg-amber-500 text-white border-amber-500",
  Completed: "bg-teal text-white border-teal",
} as const;

/** The career roadmap: corrective actions, learning and career steps in one ordered plan. */
export function RoadmapTab() {
  const { uid, user, cvVersions, applications, actions, currentActions, roadmap } = useCandidateData();
  const [busy, setBusy] = useState(false);
  const gap = useMemo(() => skillsGap({ profile: user.profile, cvVersions, applications, vacancies: SAMPLE_VACANCIES }), [user.profile, cvVersions, applications]);
  const suggestions = suggestRoadmapSteps({ actions: currentActions, gaps: gap.gaps, families: gap.targetFamilies, existing: roadmap });

  // A corrective-action step always shows (and changes) the action's own status.
  const actionById = new globalThis.Map(actions.map((a) => [a.id, a]));
  const statusOf = (s: RoadmapStep): RoadmapStatus => {
    if (s.kind !== "action" || !s.sourceId?.startsWith("action:")) return s.status;
    const a = actionById.get(s.sourceId.slice(7));
    return !a ? s.status : a.status === "Queued" ? "To Do" : (a.status as RoadmapStatus);
  };
  const done = roadmap.filter((s) => statusOf(s) === "Completed").length;
  const percent = roadmap.length ? Math.round((done / roadmap.length) * 100) : 0;

  async function addSuggestions() {
    setBusy(true);
    try {
      await addRoadmapSteps(uid, suggestions, (roadmap[roadmap.length - 1]?.order ?? 0) + 1);
      toast.success(`Added ${suggestions.length} step${suggestions.length === 1 ? "" : "s"} to your roadmap.`);
    } catch {
      toast.error("Could not update the roadmap.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(step: RoadmapStep, status: RoadmapStatus) {
    try {
      const action = step.kind === "action" && step.sourceId ? actionById.get(step.sourceId.slice(7)) : undefined;
      if (action && action.status !== "Queued" && !action.archived) await setActionStatus(uid, action, status as ActionStatus);
      else await setRoadmapStatus(uid, step, status);
    } catch {
      toast.error("Could not update the step.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roadmap progress</p>
            <p className="mt-1 text-sm text-navy">
              {done} of {roadmap.length} steps completed
            </p>
            <Progress value={percent} className="mt-2 h-2 max-w-md" indicatorClassName="bg-teal" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/skills">
                <BookOpen /> Find courses
              </Link>
            </Button>
            <Button size="sm" onClick={addSuggestions} disabled={busy || suggestions.length === 0}>
              <Sparkles /> {suggestions.length ? `Add ${suggestions.length} suggested step${suggestions.length === 1 ? "" : "s"}` : "No new suggestions"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {roadmap.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Your roadmap is empty"
          description="Add the suggested steps — your current corrective actions plus career steps from your skills gap — or add courses from Skills & Courses."
        />
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-200 pl-6">
          {roadmap.map((s, i) => {
            const k = KIND[s.kind];
            const status = statusOf(s);
            return (
              <li key={s.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[33px] top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white",
                    status === "Completed" ? "border-teal bg-teal" : status === "In Progress" ? "border-amber-500" : "border-slate-300",
                  )}
                />
                <Card className={cn(status === "Completed" && "bg-muted/30")}>
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={k.variant} className="gap-1">
                          <k.icon className="h-3 w-3" /> {k.label}
                        </Badge>
                        <p className={cn("font-semibold text-navy", status === "Completed" && "text-muted-foreground line-through decoration-1")}>{s.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <label className="flex items-center gap-1.5">
                          Target date
                          <Input
                            type="date"
                            className="h-7 w-36 text-xs"
                            value={s.targetDate ?? ""}
                            onChange={(e) => setRoadmapTargetDate(uid, s, e.target.value || null).catch(() => toast.error("Could not save the date."))}
                          />
                        </label>
                        {s.completedAt && status === "Completed" && <span>Completed {formatDate(s.completedAt.toDate().toISOString())}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex rounded-lg border bg-white p-1" role="radiogroup" aria-label={`Status for ${s.title}`}>
                        {ROADMAP_STATUSES.map((st) => {
                          const Icon = statusIcon[st];
                          const on = status === st;
                          return (
                            <button
                              key={st}
                              role="radio"
                              aria-checked={on}
                              onClick={() => !on && changeStatus(s, st)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-colors",
                                on ? statusActive[st] : "text-muted-foreground hover:bg-muted",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {st}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move up" disabled={i === 0} onClick={() => moveRoadmapStep(uid, roadmap, i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Move down"
                          disabled={i === roadmap.length - 1}
                          onClick={() => moveRoadmapStep(uid, roadmap, i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label="Remove step"
                          onClick={() => deleteRoadmapStep(uid, s).catch(() => toast.error("Could not remove the step."))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
