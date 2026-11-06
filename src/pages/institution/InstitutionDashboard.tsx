import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import { Activity, Award, CalendarCheck, Copy, Download, Eye, Info, Printer, RefreshCw, Search, Send, UserMinus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionStatusBadge, CauseBadge, EmptyState, KpiCard, LoadingState, PageHeader } from "@/components/shared";
import { CAUSE_CLASSES, SEGMENTS, type Institution, type MemberSummary } from "@/data/types";
import { CATEGORY_COLORS, CHART_COLORS } from "@/lib/chartColors";
import { downloadText } from "@/lib/csv";
import { formatDate } from "@/lib/utils";
import { institutionRef, membersCol, withId } from "@/services/paths";
import { regenerateJoinCode, removeMember } from "@/services/sharing";
import { useSession } from "@/store/SessionContext";

const TABS = ["overview", "candidates", "reports"] as const;
type Tab = (typeof TABS)[number];
type Member = MemberSummary & { id: string };
const ratio = (n: number, d: number) => (d ? n / d : 0);
const pctLabel = (x: number) => `${Math.round(x * 100)}%`;
const ACTIVE_DAYS = 30;

export default function InstitutionDashboard() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const instId = session?.institutionId;

  useEffect(() => {
    if (!instId) return;
    const u1 = onSnapshot(institutionRef(instId), (s) => setInstitution(s.exists() ? ({ id: s.id, ...s.data() } as Institution) : null));
    const u2 = onSnapshot(
      membersCol(instId),
      (snap) => {
        setMembers(snap.docs.map((d) => withId<Member>(d)));
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return () => {
      u1();
      u2();
    };
  }, [instId]);

  const totals = useMemo(() => {
    const now = Date.now();
    const sum = (f: (m: Member) => number) => members.reduce((n, m) => n + f(m), 0);
    return {
      candidates: members.length,
      active: members.filter((m) => m.lastActivityAt && now - m.lastActivityAt.toMillis() <= ACTIVE_DAYS * 86_400_000).length,
      applications: sum((m) => m.funnel.applications),
      decided: sum((m) => m.funnel.decided),
      responses: sum((m) => m.funnel.responses),
      interviews: sum((m) => m.funnel.interviews),
      offers: sum((m) => m.funnel.offers),
      actionsTotal: sum((m) => m.actionsTotal),
      actionsCompleted: sum((m) => m.actionsCompleted),
    };
  }, [members]);

  const barriers = CAUSE_CLASSES.map((c) => ({
    category: c,
    primary: members.filter((m) => m.primaryCause === c).length,
    secondary: members.filter((m) => m.secondaryCause === c).length,
  }))
    .map((b) => ({ ...b, total: b.primary + b.secondary }))
    .sort((a, b) => b.total - a.total);

  if (!instId) return <EmptyState icon={Info} title="No institution linked" description="This account has no institution record." />;
  if (!loaded || !institution) return <LoadingState />;

  return (
    <>
      <PageHeader title={institution.name} description="Cohort view built from the summaries your candidates have chosen to share." />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Candidate join code</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-navy">{institution.joinCode}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Candidates enter this code in their account panel and consent to share a summary. You never see their CV, job descriptions or feedback.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(institution.joinCode);
                toast.success("Join code copied.");
              }}
            >
              <Copy /> Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await regenerateJoinCode(institution.id, institution.joinCode, institution.name);
                  toast.success("New join code created. The old code no longer works; existing members stay.");
                } catch {
                  toast.error("Could not create a new code.");
                }
              }}
            >
              <RefreshCw /> New code
            </Button>
          </div>
        </CardContent>
      </Card>

      {members.length === 0 ? (
        <EmptyState icon={Users} title="No candidates yet" description="Share your join code with candidates. They appear here as soon as they consent to share." />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="overview">Cohort Overview</TabsTrigger>
            <TabsTrigger value="candidates">Candidate Insights</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Overview totals={totals} barriers={barriers} members={members} />
          </TabsContent>
          <TabsContent value="candidates">
            <CandidateInsights members={members} onRemove={(uid) => removeMember(institution.id, uid)} />
          </TabsContent>
          <TabsContent value="reports">
            <Reports totals={totals} barriers={barriers} members={members} name={institution.name} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

type Totals = Record<"candidates" | "active" | "applications" | "decided" | "responses" | "interviews" | "offers" | "actionsTotal" | "actionsCompleted", number>;
type Barrier = { category: string; primary: number; secondary: number; total: number };

function Overview({ totals, barriers, members }: { totals: Totals; barriers: Barrier[]; members: Member[] }) {
  const segments = SEGMENTS.map((s) => ({ segment: s, count: members.filter((m) => m.segment === s).length }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard label="Total candidates" value={totals.candidates} icon={Users} tone="navy" />
        <KpiCard label="Active candidates" value={totals.active} hint={`Activity in the last ${ACTIVE_DAYS} days`} icon={Activity} tone="teal" />
        <KpiCard label="Applications submitted" value={totals.applications} icon={Send} tone="blue" />
        <KpiCard label="Interviews received" value={totals.interviews} hint={`${pctLabel(ratio(totals.interviews, totals.decided))} of decided`} icon={CalendarCheck} tone="violet" />
        <KpiCard label="Offers received" value={totals.offers} icon={Award} tone="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Common diagnostic barriers</CardTitle>
            <CardDescription>Candidates by primary and secondary cause</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barriers} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="primary" name="Primary" stackId="a" fill={CHART_COLORS.navy} />
                <Bar dataKey="secondary" name="Secondary (monitored)" stackId="a" fill={CHART_COLORS.responses} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cohort at a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              {segments.map((s) => (
                <div key={s.segment} className="flex items-center justify-between text-sm">
                  <span>{s.segment}</span>
                  <Badge variant="slate">{s.count}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t pt-4">
              <Rate label="Application → response" value={ratio(totals.responses, totals.decided)} />
              <Rate label="Application → interview" value={ratio(totals.interviews, totals.decided)} />
              <Rate label="Interview → offer" value={ratio(totals.offers, totals.interviews)} />
              <Rate label="Active actions completed" value={ratio(totals.actionsCompleted, totals.actionsTotal)} teal />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Rate({ label, value, teal = false }: { label: string; value: number; teal?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-navy">{pctLabel(value)}</span>
      </div>
      <Progress value={value * 100} indicatorClassName={teal ? "bg-teal" : undefined} />
    </div>
  );
}

function CandidateInsights({ members, onRemove }: { members: Member[]; onRemove: (candidateUid: string) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const selected = members.find((m) => m.id === selectedId) ?? null;
  const rows = members.filter((m) => !search.trim() || `${m.name} ${m.targetRole} ${m.primaryCause ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 border-b p-3">
          <Search className="ml-1 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidates, roles or causes" className="h-9 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Target role</TableHead>
                <TableHead className="text-right">Applications</TableHead>
                <TableHead className="text-right">Interviews</TableHead>
                <TableHead>Primary cause</TableHead>
                <TableHead>Action completion</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const completion = Math.round(ratio(m.actionsCompleted, m.actionsTotal) * 100);
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedId(m.id)}>
                    <TableCell>
                      <p className="font-medium text-navy">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.segment}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.targetRole || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.funnel.applications}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.funnel.interviews}</TableCell>
                    <TableCell>
                      {m.primaryCause ? (
                        <span className="flex items-center gap-1.5">
                          <CauseBadge cause={m.primaryCause} />
                          <span className="text-xs tabular-nums text-muted-foreground">{m.primaryConfidence?.toFixed(2)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not diagnosed</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <Progress value={completion} className="h-1.5" indicatorClassName="bg-teal" />
                        <span className="w-9 text-right text-xs tabular-nums">{completion}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {m.lastActivityAt ? formatDate(m.lastActivityAt.toDate().toISOString()) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(m.id)}>
                        <Eye /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{selected.name}</DialogTitle>
                  <Badge variant="outline">Read-only summary</Badge>
                </div>
                <DialogDescription>
                  {selected.segment} · Target: {selected.targetRole || "not set"} · Updated {selected.updatedAt ? formatDate(selected.updatedAt.toDate().toISOString()) : "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Applications", selected.funnel.applications],
                  ["Responses", selected.funnel.responses],
                  ["Interviews", selected.funnel.interviews],
                  ["Offers", selected.funnel.offers],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-muted/60 p-3 text-center">
                    <p className="text-xl font-semibold text-navy">{v}</p>
                    <p className="text-xs text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
              {selected.monthly.length > 0 && (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selected.monthly} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line dataKey="applications" name="Applications" stroke={CHART_COLORS.applications} strokeWidth={2} dot={false} />
                      <Line dataKey="interviews" name="Interviews" stroke={CHART_COLORS.interviews} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis (rule-based engine)</p>
                {selected.primaryCause ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <CauseBadge cause={selected.primaryCause} /> {selected.primaryConfidence?.toFixed(2)}
                    {selected.secondaryCause && (
                      <>
                        <span className="text-muted-foreground">· monitoring</span> <CauseBadge cause={selected.secondaryCause} />
                      </>
                    )}
                    {selected.latestVerdict && <Badge variant="slate">Outcome: {selected.latestVerdict}</Badge>}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No diagnosis yet.</p>
                )}
                {selected.rationale && <p className="leading-relaxed text-slate-700">{selected.rationale}</p>}
              </div>
              {selected.actions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
                  {selected.actions.map((a) => (
                    <div key={a.title} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="min-w-0 truncate">{a.title}</span>
                      <ActionStatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="justify-self-start text-destructive hover:text-destructive" onClick={() => setToRemove(selected)}>
                <UserMinus /> Remove from cohort
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remove candidate?"
        description={`${toRemove?.name}'s shared summary will be deleted. They can rejoin with your code.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!toRemove) return;
          await onRemove(toRemove.candidateUid);
          setSelectedId(null);
          toast.success("Candidate removed from the cohort.");
        }}
      />
    </>
  );
}

function Reports({ totals, barriers, members, name }: { totals: Totals; barriers: Barrier[]; members: Member[]; name: string }) {
  const primaryShare = barriers.filter((b) => b.primary > 0).map((b) => ({ name: b.category, value: b.primary }));
  const conversion = [
    { stage: "Application → response", rate: Math.round(ratio(totals.responses, totals.decided) * 100) },
    { stage: "Application → interview", rate: Math.round(ratio(totals.interviews, totals.decided) * 100) },
    { stage: "Interview → offer", rate: Math.round(ratio(totals.offers, totals.interviews) * 100) },
  ];
  const monthMap = new Map<string, { key: string; month: string; applications: number; responses: number; interviews: number; offers: number }>();
  members.forEach((m) =>
    m.monthly.forEach((x) => {
      const cur = monthMap.get(x.key) ?? { key: x.key, month: x.month, applications: 0, responses: 0, interviews: 0, offers: 0 };
      monthMap.set(x.key, { ...cur, applications: cur.applications + x.applications, responses: cur.responses + x.responses, interviews: cur.interviews + x.interviews, offers: cur.offers + x.offers });
    }),
  );
  const monthly = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const completionByCandidate = members
    .map((m) => ({ name: m.name.split(" ")[0], completion: Math.round(ratio(m.actionsCompleted, m.actionsTotal) * 100) }))
    .sort((a, b) => b.completion - a.completion);
  const verdicts = ["corroborated", "weakened", "inconclusive", "collecting"].map((v) => ({ v, n: members.filter((m) => m.latestVerdict === v).length }));

  function exportCsv() {
    const header = "candidate,segment,target_role,applications,decided,responses,interviews,offers,response_rate,interview_rate,primary_cause,primary_confidence,secondary_cause,actions_completed,actions_total,latest_verdict";
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = members.map((m) =>
      [
        m.name,
        m.segment,
        m.targetRole,
        m.funnel.applications,
        m.funnel.decided,
        m.funnel.responses,
        m.funnel.interviews,
        m.funnel.offers,
        m.funnel.responseRate.toFixed(3),
        m.funnel.interviewRate.toFixed(3),
        m.primaryCause ?? "",
        m.primaryConfidence?.toFixed(2) ?? "",
        m.secondaryCause ?? "",
        m.actionsCompleted,
        m.actionsTotal,
        m.latestVerdict ?? "",
      ]
        .map((v) => esc(String(v)))
        .join(","),
    );
    downloadText(`${name.replace(/\W+/g, "_")}_cohort_report.csv`, [header, ...lines].join("\n"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {totals.candidates} candidates · {totals.applications} applications · live data
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Root-cause distribution</CardTitle>
            <CardDescription>Candidates by primary cause</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {primaryShare.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={primaryShare} dataKey="value" nameKey="name" outerRadius="75%" label={({ value }) => value}>
                    {primaryShare.map((d, i) => (
                      <Cell key={d.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="pt-16 text-center text-sm text-muted-foreground">No diagnoses yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recruitment conversion rates</CardTitle>
            <CardDescription>Cohort-wide funnel (decided applications)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversion} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="rate" name="Conversion" fill={CHART_COLORS.applications} radius={[4, 4, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cohort progress</CardTitle>
            <CardDescription>Monthly totals across the cohort</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="applications" name="Applications" stroke={CHART_COLORS.applications} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="responses" name="Responses" stroke={CHART_COLORS.responses} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="interviews" name="Interviews" stroke={CHART_COLORS.interviews} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="offers" name="Offers" stroke={CHART_COLORS.offers} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Corrective action completion</CardTitle>
            <CardDescription>
              {totals.actionsCompleted} of {totals.actionsTotal} active actions completed
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionByCandidate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, "Actions completed"]} />
                <Bar dataKey="completion" fill={CHART_COLORS.responses} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Barrier summary and outcome verdicts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cause</TableHead>
                  <TableHead className="text-right">Primary</TableHead>
                  <TableHead className="text-right">Secondary</TableHead>
                  <TableHead className="text-right">Share of cohort</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barriers.map((b) => (
                  <TableRow key={b.category}>
                    <TableCell className="font-medium text-navy">{b.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.primary}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.secondary}</TableCell>
                    <TableCell className="text-right tabular-nums">{pctLabel(ratio(b.total, totals.candidates))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Closed-loop verdicts</p>
            {verdicts.map((v) => (
              <div key={v.v} className="flex items-center justify-between text-sm capitalize">
                <span>{v.v}</span>
                <Badge variant="slate">{v.n}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert variant="info">
        <Info />
        <AlertDescription>Causes are probable, from a rule-based engine (AI simulation). Outcome comparisons are indicative and cannot prove causation.</AlertDescription>
      </Alert>
    </div>
  );
}
