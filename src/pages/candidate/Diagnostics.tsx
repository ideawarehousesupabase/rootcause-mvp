import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  History,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Microscope,
  Play,
  RefreshCw,
  Send,
} from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionStatusBadge, CauseBadge, ConfidenceMeter, EngineBadge, LoadingState, PageHeader } from "@/components/shared";
import { CAUSE_CLASSES, CAUSE_DESCRIPTIONS, ROLE_FAMILIES, type CauseClass, type Diagnosis, type EvidenceRef } from "@/data/types";
import { ENGINE_VERSION, generateActions, runDiagnosis } from "@/engine";
import { PRIMARY_THRESHOLD, SECONDARY_THRESHOLD } from "@/engine/config";
import { cn, formatDate } from "@/lib/utils";
import { saveDiagnosis } from "@/services/diagnosis";
import { useCandidateData } from "@/store/CandidateDataContext";

const STATUS_LABEL: Record<Diagnosis["status"], { label: string; variant: "teal" | "slate" | "green" | "red" | "amber" }> = {
  active: { label: "Active", variant: "teal" },
  superseded: { label: "Superseded", variant: "slate" },
  corroborated: { label: "Corroborated by outcomes", variant: "green" },
  weakened: { label: "Weakened by outcomes", variant: "red" },
  inconclusive: { label: "Inconclusive so far", variant: "amber" },
};

export function refLink(ref: EvidenceRef) {
  if (ref.type === "application" || ref.type === "feedback") return `/app/applications?view=${ref.id}`;
  if (ref.type === "cvBullet") return "/app/evidence";
  return "/app/profile";
}

export default function Diagnostics() {
  const data = useCandidateData();
  const { uid, user, loading, cvVersions, applications, diagnoses, actions, multipliers, readiness, latestDiagnosis, evidenceChangedSinceDiagnosis, today, funnel } = data;
  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [step, setStep] = useState(0);
  const [viewId, setViewId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (loading) return <LoadingState />;

  const bullets = Math.max(0, ...cvVersions.map((c) => c.analysis.bulletCount));
  const withJd = applications.filter((a) => a.jobDescription.trim()).length;
  const STEPS = [
    `Analysing ${bullets} CV statements`,
    `Reading ${withJd} job descriptions`,
    `Comparing ${funnel.decided} decided applications`,
    "Scoring five causal classes",
    "Generating rationale and corrective actions",
  ];

  function run() {
    if (!readiness.canRun || !user.profile) return;
    setPhase("running");
    setStep(0);
    timers.current.forEach(clearTimeout);
    timers.current = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), (i + 1) * 550));
    timers.current.push(
      window.setTimeout(async () => {
        try {
          const input = { profile: user.profile, cvVersions, applications, multipliers, today };
          const result = runDiagnosis(input);
          const drafts = generateActions(input, result);
          const openActions = actions.filter((a) => !a.archived && a.status !== "Completed");
          await saveDiagnosis(uid, result, drafts, diagnoses, openActions);
          setViewId(null);
          toast.success(result.primary ? `Diagnosis complete: ${result.primary}.` : "Diagnosis complete: no single cause stands out yet.");
        } catch (err) {
          console.error(err);
          toast.error("The diagnosis could not be saved. Please try again.");
        } finally {
          setPhase("idle");
        }
      }, STEPS.length * 550 + 300),
    );
  }

  const shown = diagnoses.find((d) => d.id === viewId) ?? latestDiagnosis;
  const isLatest = shown?.id === latestDiagnosis?.id;

  return (
    <>
      <PageHeader
        title="Root-Cause Diagnostics"
        description="The most probable cause of unsuccessful applications, classified from patterns across all your evidence."
        actions={
          <Button onClick={run} disabled={phase === "running" || !readiness.canRun} size="lg">
            {phase === "running" ? <Loader2 className="animate-spin" /> : latestDiagnosis ? <RefreshCw /> : <Play />}
            {phase === "running" ? "Analysing…" : latestDiagnosis ? "Run Diagnosis again" : "Run Diagnosis"}
          </Button>
        }
      />

      <Alert variant="warning" className="mb-6">
        <AlertTriangle />
        <AlertTitle className="flex flex-wrap items-center gap-2">
          Probable causes, not confirmed employer reasons <EngineBadge version={ENGINE_VERSION} />
        </AlertTitle>
        <AlertDescription>
          Results come from a transparent rule-based engine that simulates how the planned AI model will work. No AI model is used. Every score is
          traceable to the evidence below.
        </AlertDescription>
      </Alert>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Send, label: "Decided applications", value: funnel.decided, hint: funnel.pending ? `${funnel.pending} pending` : undefined },
          { icon: FileText, label: "Job descriptions", value: withJd },
          { icon: MessageSquareQuote, label: "Responses & feedback", value: applications.filter((a) => a.feedback || a.recruiterResponse).length },
          { icon: Layers, label: "Role families", value: ROLE_FAMILIES.filter((r) => applications.some((a) => a.roleFamily === r)).length },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <div className="rounded-lg bg-blue-50 p-2 text-primary">
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-navy">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.label}
                {s.hint ? ` · ${s.hint}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!readiness.canRun && phase === "idle" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Before your first diagnosis</CardTitle>
            <CardDescription>The engine needs enough evidence to compare.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {readiness.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-3 text-sm">
                  {c.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-teal" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className={cn("font-medium", c.done ? "text-navy" : "text-slate-700")}>{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  {!c.done && (
                    <Button asChild size="sm" variant="outline" className="ml-auto">
                      <Link to={c.id === "profile" ? "/app/profile" : "/app/evidence"}>Go</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {phase === "running" && (
        <Card>
          <CardContent className="mx-auto max-w-xl py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-lg font-semibold text-navy">Running the diagnostic engine…</p>
            </div>
            <Progress value={(step / STEPS.length) * 100} className="mt-6" />
            <ul className="mt-6 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-3 text-sm", i < step ? "text-navy" : "text-muted-foreground")}>
                  {i < step ? <CheckCircle2 className="h-4 w-4 text-teal" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border" />}
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {phase === "idle" && !shown && readiness.canRun && (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Microscope className="h-10 w-10 text-primary" />
            <p className="mt-4 text-lg font-semibold text-navy">Ready to analyse your job search</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">The engine will compare {funnel.decided} decided applications and classify the most probable cause.</p>
            <Button className="mt-6" onClick={run}>
              <Play /> Run Diagnosis
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "idle" && shown && (
        <>
          {isLatest && evidenceChangedSinceDiagnosis && (
            <Alert variant="info" className="mb-6">
              <Info />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                New evidence has been added since this diagnosis.
                <Button size="sm" variant="outline" onClick={run} disabled={!readiness.canRun}>
                  <RefreshCw /> Re-run
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!isLatest && (
            <Alert className="mb-6">
              <History />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                Viewing a past diagnosis (read-only).
                <Button size="sm" variant="outline" onClick={() => setViewId(null)}>
                  Back to latest
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Report key={shown.id} diagnosis={shown} />
        </>
      )}

      {diagnoses.length > 0 && phase === "idle" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Diagnosis history
            </CardTitle>
            <CardDescription>Every run is stored as an unchanged snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Primary cause</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnoses.map((d) => (
                  <TableRow key={d.id} data-state={shown?.id === d.id ? "selected" : undefined}>
                    <TableCell className="whitespace-nowrap">{d.createdAt ? formatDate(d.createdAt.toDate().toISOString()) : "Saving…"}</TableCell>
                    <TableCell>{d.primary ? <CauseBadge cause={d.primary} /> : <span className="text-xs text-muted-foreground">No dominant cause</span>}</TableCell>
                    <TableCell className="tabular-nums">{d.primary ? d.classes[d.primary].confidence.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.inputSummary.decided} decided · {d.sufficiency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABEL[d.status].variant}>{STATUS_LABEL[d.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewId(d.id)} disabled={shown?.id === d.id}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const barColour = (d: Diagnosis, c: CauseClass) => (c === d.primary ? "#0d9488" : c === d.secondary ? "#1d4ed8" : "#cbd5e1");

function Report({ diagnosis: d }: { diagnosis: Diagnosis }) {
  const { actions, evaluations } = useCandidateData();
  const [open, setOpen] = useState<CauseClass | null>(d.primary);
  const chart = CAUSE_CLASSES.map((c) => ({ name: c, confidence: d.classes[c].confidence, assessable: d.classes[c].assessable }));
  const linked = actions.filter((a) => a.diagnosisId === d.id);
  const evaluation = evaluations.find((e) => e.diagnosisId === d.id);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{d.primary ? "Primary cause" : "No dominant cause yet"}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={STATUS_LABEL[d.status].variant}>{STATUS_LABEL[d.status].label}</Badge>
                <Badge variant={d.sufficiency === "sufficient" ? "green" : "amber"}>{d.sufficiency === "sufficient" ? "Sufficient evidence" : "Limited evidence — confidence reduced"}</Badge>
              </div>
            </div>
            <CardDescription>
              {d.createdAt ? formatDate(d.createdAt.toDate().toISOString()) : ""} · {d.inputSummary.decided} decided applications · {d.inputSummary.withJobDescription} job descriptions ·{" "}
              {d.engineVersion}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {d.primary && (
              <div className="rounded-lg border-l-4 border-l-teal bg-teal-soft/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CauseBadge cause={d.primary} className="text-sm" />
                  <span className="text-sm text-muted-foreground">{CAUSE_DESCRIPTIONS[d.primary]}</span>
                </div>
                <ConfidenceMeter value={d.classes[d.primary].confidence} className="mt-3 max-w-sm" />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rationale</p>
              {d.rationale.map((s, i) => (
                <div key={i} className="text-sm leading-relaxed">
                  <p>{s.text}</p>
                  {s.refs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.refs.map((r, j) => (
                        <Link
                          key={`${r.id}-${j}`}
                          to={refLink(r)}
                          className="max-w-[260px] truncate rounded-full border bg-white px-2.5 py-0.5 text-xs text-navy hover:border-primary hover:text-primary"
                          title={r.excerpt}
                        >
                          {r.excerpt}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {d.secondary && (
              <div className="rounded-lg border bg-blue-50/50 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
                  Secondary: <CauseBadge cause={d.secondary} /> <span className="tabular-nums">{d.classes[d.secondary].confidence.toFixed(2)}</span>
                  <Badge variant="outline">Monitored — not yet actioned</Badge>
                </p>
                {d.classes[d.secondary].notes.map((n) => (
                  <p key={n} className="mt-1 text-xs text-muted-foreground">
                    {n}
                  </p>
                ))}
              </div>
            )}
            <Button asChild>
              <Link to="/app/actions">
                View Action Plan <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Confidence by causal class</CardTitle>
            <CardDescription>
              Primary needs ≥ {PRIMARY_THRESHOLD.toFixed(2)}, secondary ≥ {SECONDARY_THRESHOLD.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, _n, item) => [item.payload.assessable ? v.toFixed(2) : "Not assessable", "Confidence"]} />
                <ReferenceLine x={PRIMARY_THRESHOLD} stroke="#0d9488" strokeDasharray="4 4" />
                <ReferenceLine x={SECONDARY_THRESHOLD} stroke="#1d4ed8" strokeDasharray="4 4" />
                <Bar dataKey="confidence" radius={[0, 4, 4, 0]} barSize={18}>
                  {chart.map((c) => (
                    <Cell key={c.name} fill={barColour(d, c.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How each class was scored</CardTitle>
          <CardDescription>Signal value × weight = contribution. Confidence = 0.10 + 0.70 × total, adjusted for evidence sufficiency and your outcome history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {CAUSE_CLASSES.map((c) => {
            const r = d.classes[c];
            const expanded = open === c;
            return (
              <div key={c} className="rounded-lg border">
                <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(expanded ? null : c)} aria-expanded={expanded}>
                  <CauseBadge cause={c} />
                  <span className="hidden flex-1 text-sm text-muted-foreground md:block">{CAUSE_DESCRIPTIONS[c]}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums text-navy">{r.assessable ? r.confidence.toFixed(2) : "n/a"}</span>
                  {c === d.primary && <Badge variant="teal">Primary</Badge>}
                  {c === d.secondary && <Badge variant="blue">Secondary</Badge>}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="border-t px-3 pb-3">
                    {r.notes.map((n) => (
                      <p key={n} className="mt-2 text-xs font-medium text-amber-700">
                        {n}
                      </p>
                    ))}
                    <div className="mt-2 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Signal</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="text-right">Weight</TableHead>
                            <TableHead className="text-right">Contribution</TableHead>
                            <TableHead>Evidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.signals.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="min-w-[180px]">
                                <p className="font-medium text-navy">
                                  {s.id} · {s.label}
                                </p>
                                <p className="text-xs text-muted-foreground">{s.detail}</p>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{s.value.toFixed(2)}</TableCell>
                              <TableCell className="text-right tabular-nums">{s.weight.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{s.contribution.toFixed(3)}</TableCell>
                              <TableCell className="min-w-[200px]">
                                <div className="flex flex-wrap gap-1">
                                  {s.evidenceRefs.slice(0, 4).map((ref, j) => (
                                    <Link key={j} to={refLink(ref)} title={ref.excerpt} className="max-w-[200px] truncate rounded border px-1.5 py-0.5 text-[11px] hover:border-primary">
                                      {ref.excerpt}
                                    </Link>
                                  ))}
                                  {s.evidenceRefs.length > 4 && <span className="text-[11px] text-muted-foreground">+{s.evidenceRefs.length - 4}</span>}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Market context</CardTitle>
            <CardDescription>Not a root cause</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">{d.marketContext.note}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outcome check</CardTitle>
            <CardDescription>Closed-loop measurement</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            {!d.primary
              ? "No primary cause to measure."
              : !d.changesAppliedAt
                ? "Starts when all active actions are completed."
                : evaluation
                  ? evaluation.verdict === "collecting"
                    ? `Changes applied ${formatDate(d.changesAppliedAt)}. Collecting: ${evaluation.after.n} of ${evaluation.required} needed.`
                    : `Verdict: ${evaluation.verdict}. ${Math.round(evaluation.before.rate * 100)}% → ${Math.round(evaluation.after.rate * 100)}%.`
                  : `Changes applied ${formatDate(d.changesAppliedAt)}.`}
            <Link to="/app/analytics" className="mt-2 block text-xs font-medium text-primary hover:underline">
              See Progress Analytics →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-teal" /> Actions from this diagnosis
            </CardTitle>
            <CardDescription>{d.calibrationNotes.length ? d.calibrationNotes.join("; ") : "Engine not yet adjusted by your outcomes"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {linked.length === 0 && <p className="text-sm text-muted-foreground">No actions — add more evidence and re-run.</p>}
            {linked.slice(0, 5).map((a) => (
              <Link key={a.id} to="/app/actions" className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
                <span className="min-w-0 truncate">{a.title}</span>
                <ActionStatusBadge status={a.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
