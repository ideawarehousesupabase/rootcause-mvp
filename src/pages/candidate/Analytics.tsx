import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, BarChart3, CalendarCheck, Info, ListChecks, Mail, Microscope, Send, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CauseBadge, EmptyState, KpiCard, LoadingState, PageHeader } from "@/components/shared";
import { groupFunnel, monthlyActivity } from "@/engine";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatDate } from "@/lib/utils";
import { useCandidateData } from "@/store/CandidateDataContext";

const pctLabel = (x: number) => `${Math.round(x * 100)}%`;
const VERDICT: Record<string, { label: string; variant: "green" | "red" | "amber" | "slate" }> = {
  corroborated: { label: "Corroborated", variant: "green" },
  weakened: { label: "Weakened", variant: "red" },
  inconclusive: { label: "Inconclusive", variant: "amber" },
  collecting: { label: "Collecting evidence", variant: "slate" },
};

export default function Analytics() {
  const { loading, applications, funnel: f, today, latestDiagnosis, currentActions, latestEvaluation, cvLabel, progressSnapshots } = useCandidateData();
  const [breakdown, setBreakdown] = useState<"family" | "cv" | "seniority">("family");
  if (loading) return <LoadingState />;

  if (!applications.length) {
    return (
      <>
        <PageHeader title="Progress Analytics" description="Outcome measurement across your job search." />
        <EmptyState
          icon={BarChart3}
          title="No applications to measure yet"
          description="Log or import applications to see conversion rates over time."
          action={
            <Button asChild>
              <Link to="/app/evidence">Add evidence</Link>
            </Button>
          }
        />
      </>
    );
  }

  const monthly = monthlyActivity(applications, today);
  const active = currentActions.filter((a) => a.status !== "Queued");
  const done = active.filter((a) => a.status === "Completed").length;
  const inProgress = active.filter((a) => a.status === "In Progress").length;
  const actionData = [
    { name: "Completed", value: done, color: CHART_COLORS.responses },
    { name: "In Progress", value: inProgress, color: "#f59e0b" },
    { name: "To Do", value: active.length - done - inProgress, color: "#cbd5e1" },
  ];
  const groups = groupFunnel(applications, today, (a) => (breakdown === "family" ? a.roleFamily : breakdown === "cv" ? cvLabel(a.cvVersionId) : a.seniority))
    .filter((g) => g.decided > 0)
    .map((g) => ({ key: g.key, decided: g.decided, interviewRate: Math.round(g.interviewRate * 100), responseRate: Math.round(g.responseRate * 100) }));
  const ev = latestEvaluation;

  return (
    <>
      <PageHeader title="Progress Analytics" description="Outcome measurement: conversion rates over time and whether your changes are moving them." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total applications" value={f.applications} hint={`${f.decided} decided · ${f.pending} pending`} icon={Send} tone="blue" />
        <KpiCard label="Application → response" value={pctLabel(f.responseRate)} hint={`${f.responses} responses`} icon={Mail} tone="teal" />
        <KpiCard label="Application → interview" value={pctLabel(f.interviewRate)} hint={`${f.interviews} interviews`} icon={CalendarCheck} tone="violet" />
        <KpiCard label="Interview → offer" value={pctLabel(f.interviewToOffer)} hint={`${f.offers} offer${f.offers === 1 ? "" : "s"} from ${f.finishedInterviews} finished`} icon={Award} tone="green" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Closed-loop outcome measurement</CardTitle>
            {ev && <Badge variant={VERDICT[ev.verdict].variant}>{VERDICT[ev.verdict].label}</Badge>}
          </div>
          <CardDescription>
            {latestDiagnosis?.changesAppliedAt
              ? `Comparing applications before ${formatDate(latestDiagnosis.changesAppliedAt)} (last 90 days, or your 10 most recent) with applications since.`
              : "Measurement starts once all active actions for your primary cause are completed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!latestDiagnosis ? (
            <p className="text-sm text-muted-foreground">
              Run a diagnosis to start the loop.{" "}
              <Link to="/app/diagnostics" className="font-medium text-primary hover:underline">
                Go to diagnostics
              </Link>
            </p>
          ) : (
            <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <JourneyStep icon={Send} title="Initial outcomes" tone="slate">
                {ev ? (
                  <>
                    <p>{ev.before.n} {ev.metric === "interviewToOffer" ? "finished interviews" : "decided applications"}</p>
                    <p className="text-lg font-semibold text-navy">{pctLabel(ev.before.rate)}</p>
                    <p>{ev.metric === "interviewToOffer" ? "interview → offer" : "reached interview"}</p>
                  </>
                ) : (
                  <>
                    <p>{latestDiagnosis.inputSummary.decided} decided applications</p>
                    <p>{latestDiagnosis.inputSummary.interviews} interviews at diagnosis</p>
                  </>
                )}
              </JourneyStep>
              <Arrow />
              <JourneyStep icon={Microscope} title="Diagnosis" tone="blue">
                {latestDiagnosis.primary ? (
                  <>
                    <CauseBadge cause={latestDiagnosis.primary} />
                    <p className="mt-1">Confidence {latestDiagnosis.classes[latestDiagnosis.primary].confidence.toFixed(2)}</p>
                  </>
                ) : (
                  <p>No dominant cause yet</p>
                )}
              </JourneyStep>
              <Arrow />
              <JourneyStep icon={ListChecks} title="Corrective actions" tone="amber">
                <p>
                  {done} of {active.length} completed
                </p>
                <Progress value={active.length ? (done / active.length) * 100 : 0} className="mt-1 h-1.5" indicatorClassName="bg-teal" />
                {latestDiagnosis.changesAppliedAt && <p className="mt-1">Applied {formatDate(latestDiagnosis.changesAppliedAt)}</p>}
              </JourneyStep>
              <Arrow />
              <JourneyStep icon={TrendingUp} title="Subsequent outcomes" tone="teal">
                {ev ? (
                  ev.verdict === "collecting" ? (
                    <>
                      <p>
                        {ev.after.n} of {ev.required} needed
                      </p>
                      <Progress value={(ev.after.n / ev.required) * 100} className="mt-1 h-1.5" indicatorClassName="bg-teal" />
                      <p className="mt-1">Keep logging outcomes</p>
                    </>
                  ) : (
                    <>
                      <p>{ev.after.n} since the change</p>
                      <p className="text-lg font-semibold text-navy">{pctLabel(ev.after.rate)}</p>
                      <p>{ev.after.rate >= ev.before.rate ? "▲" : "▼"} {Math.abs(Math.round((ev.after.rate - ev.before.rate) * 100))} points</p>
                    </>
                  )
                ) : (
                  <p>Waiting for completed actions</p>
                )}
              </JourneyStep>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Application outcomes over time</CardTitle>
            <CardDescription>By month of application</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="applications" name="Applications" stroke={CHART_COLORS.applications} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="responses" name="Responses" stroke={CHART_COLORS.responses} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="interviews" name="Interviews" stroke={CHART_COLORS.interviews} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="offers" name="Offers" stroke={CHART_COLORS.offers} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Corrective action completion</CardTitle>
            <CardDescription>{active.length ? `${done} of ${active.length} active actions` : "No active actions"}</CardDescription>
          </CardHeader>
          <CardContent className="relative h-72">
            {active.length ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={actionData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2}>
                      {actionData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center">
                  <p className="text-2xl font-semibold text-navy">{Math.round((done / active.length) * 100)}%</p>
                  <p className="text-xs text-muted-foreground">complete</p>
                </div>
              </>
            ) : (
              <p className="pt-10 text-center text-sm text-muted-foreground">Actions appear after a diagnosis.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Where applications progress</CardTitle>
            <CardDescription className="mt-1">Share of decided applications reaching a response and an interview</CardDescription>
          </div>
          <Tabs value={breakdown} onValueChange={(v) => setBreakdown(v as typeof breakdown)}>
            <TabsList>
              <TabsTrigger value="family">Role family</TabsTrigger>
              <TabsTrigger value="cv">CV version</TabsTrigger>
              <TabsTrigger value="seniority">Seniority</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent style={{ height: Math.max(220, groups.length * 52 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groups} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="key" width={150} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, n, item) => [`${v}% of ${item.payload.decided}`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="responseRate" name="Response" fill={CHART_COLORS.responses} radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="interviewRate" name="Interview" fill={CHART_COLORS.interviews} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {progressSnapshots.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Saved progress history</CardTitle>
            <CardDescription className="mt-1">
              Your overall rates as saved to your account at the end of each month ({progressSnapshots.length} month{progressSnapshots.length === 1 ? "" : "s"} so far)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={progressSnapshots.map((p) => ({
                  month: new Date(`${p.id}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
                  response: Math.round(p.responseRate * 100),
                  interview: Math.round(p.interviewRate * 100),
                  offer: Math.round(p.interviewToOffer * 100),
                }))}
                margin={{ top: 5, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="response" name="Response rate" stroke={CHART_COLORS.responses} strokeWidth={2} dot />
                <Line type="monotone" dataKey="interview" name="Interview rate" stroke={CHART_COLORS.interviews} strokeWidth={2} dot />
                <Line type="monotone" dataKey="offer" name="Interview → offer" stroke={CHART_COLORS.offers} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Alert variant="info" className="mt-6">
        <Info />
        <AlertDescription>
          This comparison is indicative. Sample sizes are small and other factors (timing, vacancies) also change, so it cannot prove the change caused the
          result.
        </AlertDescription>
      </Alert>
    </>
  );
}

function JourneyStep({ icon: Icon, title, tone, children }: { icon: typeof Send; title: string; tone: "slate" | "blue" | "amber" | "teal"; children: ReactNode }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
  };
  return (
    <div className={`min-w-0 rounded-lg border p-4 ${tones[tone]}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" /> {title}
      </p>
      <div className="mt-2 space-y-0.5 text-xs text-slate-700">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground">
      <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
    </div>
  );
}
