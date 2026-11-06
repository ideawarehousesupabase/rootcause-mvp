import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Download, Eye, MessageSquarePlus, Pencil, Plus, Search, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplicationDetailsDialog, ApplicationFormDialog, emptyInput, FeedbackDialog, toInput } from "@/components/candidate/ApplicationDialogs";
import { CsvImportDialog } from "@/components/candidate/CsvImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, LoadingState, PageHeader } from "@/components/shared";
import { APPLICATION_STATUSES, ROLE_FAMILIES, type Application, type ApplicationStatus } from "@/data/types";
import { derivedState } from "@/engine";
import { applicationsToCsv, downloadText } from "@/lib/csv";
import { cn, formatDate, todayLocal } from "@/lib/utils";
import { addApplication, bulkSetStatus, deleteApplication, deleteApplications, patchApplication, setStatus, undoImport, updateApplication } from "@/services/evidence";
import { useCandidateData } from "@/store/CandidateDataContext";

const statusTrigger: Record<ApplicationStatus, string> = {
  Applied: "border-slate-200 bg-slate-50 text-slate-700",
  "Response Received": "border-blue-200 bg-blue-50 text-blue-700",
  Interview: "border-violet-200 bg-violet-50 text-violet-700",
  Rejected: "border-red-200 bg-red-50 text-red-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Withdrawn: "border-slate-200 bg-white text-slate-500",
};

type StatusFilter = "all" | ApplicationStatus | "Pending" | "No response";
const ALL = "__all";

export default function Applications() {
  const { uid, user, loading, applications, cvVersions, funnel, today, cvLabel } = useCandidateData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [family, setFamily] = useState(ALL);
  const [cvFilter, setCvFilter] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ open: boolean; editing: Application | null }>({ open: false, editing: null });
  const [importOpen, setImportOpen] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<Application | null>(null);
  const [toDelete, setToDelete] = useState<Application[] | null>(null);

  const viewing = applications.find((a) => a.id === params.get("view")) ?? null;
  const setViewing = (a: Application | null) => setParams(a ? { view: a.id } : {}, { replace: true });

  const batches = useMemo(() => {
    const m = new Map<string, { id: string; count: number; date: string }>();
    applications.forEach((a) => {
      if (!a.importBatchId) return;
      const b = m.get(a.importBatchId) ?? { id: a.importBatchId, count: 0, date: a.createdAt ? todayLocal(a.createdAt.toDate()) : "" };
      m.set(a.importBatchId, { ...b, count: b.count + 1 });
    });
    return [...m.values()];
  }, [applications]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const d = derivedState(a, today);
      if (statusFilter === "Pending" && d !== "Pending") return false;
      if (statusFilter === "No response" && d !== "No response") return false;
      if (statusFilter !== "all" && statusFilter !== "Pending" && statusFilter !== "No response" && a.status !== statusFilter) return false;
      if (family !== ALL && a.roleFamily !== family) return false;
      if (cvFilter !== ALL && a.cvVersionId !== cvFilter) return false;
      if (source === "manual" && a.source !== "manual") return false;
      if (source !== ALL && source !== "manual" && a.importBatchId !== source) return false;
      return !q || `${a.jobTitle} ${a.employer} ${a.location}`.toLowerCase().includes(q);
    });
  }, [applications, search, statusFilter, family, cvFilter, source, today]);

  if (loading) return <LoadingState />;

  const countOf = (s: StatusFilter) =>
    s === "all"
      ? applications.length
      : s === "Pending" || s === "No response"
        ? applications.filter((a) => derivedState(a, today) === s).length
        : applications.filter((a) => a.status === s).length;
  const selectedApps = applications.filter((a) => selected.has(a.id));
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  return (
    <>
      <PageHeader
        title="Application Tracker"
        description={`${funnel.applications} applications · ${funnel.decided} decided · ${funnel.responses} responses · ${funnel.interviews} interviews · ${funnel.offers} offer${funnel.offers === 1 ? "" : "s"}. Changes update every page instantly.`}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadText(`applications-${today}.csv`, applicationsToCsv(rows, cvLabel))} disabled={!rows.length}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Import CSV
            </Button>
            <Button onClick={() => setForm({ open: true, editing: null })}>
              <Plus /> Add application
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...APPLICATION_STATUSES, "Pending", "No response"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === s ? "border-navy bg-navy text-white" : "bg-white text-muted-foreground hover:bg-muted",
            )}
          >
            {s === "all" ? "All" : s} ({countOf(s)})
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="ml-1 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job title, employer or location"
              className="h-9 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FilterSelect value={family} onChange={setFamily} label="Role family" options={ROLE_FAMILIES.map((f) => [f, f])} />
            <FilterSelect value={cvFilter} onChange={setCvFilter} label="CV version" options={cvVersions.map((c) => [c.id, c.label])} />
            <FilterSelect
              value={source}
              onChange={setSource}
              label="Source"
              options={[["manual", "Manual entry"], ...batches.map((b, i) => [b.id, `Import ${i + 1} (${b.count})`] as [string, string])]}
            />
          </div>
        </div>

        {selectedApps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-blue-50/60 px-4 py-2 text-sm">
            <span className="font-medium text-navy">{selectedApps.length} selected</span>
            <Select
              onValueChange={async (v) => {
                await bulkSetStatus(uid, selectedApps, v as ApplicationStatus);
                toast.success(`Updated ${selectedApps.length} application${selectedApps.length === 1 ? "" : "s"}.`);
                setSelected(new Set());
              }}
            >
              <SelectTrigger className="h-8 w-44 bg-white text-xs">
                <SelectValue placeholder="Set status…" />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => setToDelete(selectedApps)}>
              <Trash2 /> Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <CardContent className="p-0">
          {applications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ClipboardList}
                title="No applications yet"
                description="Add your applications or import them from a spreadsheet."
                action={
                  <Button onClick={() => setImportOpen(true)}>
                    <Upload /> Import CSV
                  </Button>
                }
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Search} title="No matching applications" description="Try a different search or filter." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={allVisibleSelected}
                      onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Date applied</TableHead>
                  <TableHead>CV version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Recruiter feedback</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => {
                  const d = derivedState(a, today);
                  return (
                    <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                      <TableCell>
                        <input type="checkbox" aria-label={`Select ${a.jobTitle}`} checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </TableCell>
                      <TableCell>
                        <button className="text-left font-medium text-navy hover:underline" onClick={() => setViewing(a)}>
                          {a.jobTitle}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {a.roleFamily} · {a.seniority}
                          {a.isGraduateScheme && " · Scheme"}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.employer}
                        {a.location && <p className="text-xs">{a.location}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(a.dateApplied)}</TableCell>
                      <TableCell className="max-w-[130px] truncate text-xs">{cvLabel(a.cvVersionId)}</TableCell>
                      <TableCell>
                        <Select
                          value={a.status}
                          onValueChange={async (v) => {
                            await setStatus(uid, a, v as ApplicationStatus);
                            toast.success(`Status updated to "${v}".`);
                          }}
                        >
                          <SelectTrigger className={cn("h-8 w-[170px] rounded-full text-xs font-medium", statusTrigger[a.status])} aria-label="Update status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPLICATION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {d === "No response" && <p className="mt-1 text-[11px] text-muted-foreground">No response (30+ days)</p>}
                        {d === "Pending" && <p className="mt-1 text-[11px] text-muted-foreground">Pending (under 30 days)</p>}
                      </TableCell>
                      <TableCell className="hidden max-w-xs xl:table-cell">
                        <p className="line-clamp-2 text-xs text-muted-foreground">{a.feedback || a.recruiterResponse || "—"}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button variant="ghost" size="icon" aria-label="View details" title="View details" onClick={() => setViewing(a)}>
                          <Eye />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Add feedback" title="Add feedback" onClick={() => setFeedbackFor(a)}>
                          <MessageSquarePlus />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" title="Edit" onClick={() => setForm({ open: true, editing: a })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" title="Delete" onClick={() => setToDelete([a])}>
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {batches.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-navy">Import history</p>
            <ul className="mt-3 divide-y text-sm">
              {batches.map((b, i) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span>
                    Import {i + 1} · {b.count} application{b.count === 1 ? "" : "s"}
                    {b.date && ` · ${formatDate(b.date)}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const n = await undoImport(uid, b.id);
                      toast.success(`Removed ${n} imported application${n === 1 ? "" : "s"}.`);
                    }}
                  >
                    <Undo2 /> Undo import
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ApplicationDetailsDialog
        application={viewing}
        cvLabel={cvLabel}
        today={today}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(a) => {
          setViewing(null);
          setForm({ open: true, editing: a });
        }}
        onFeedback={(a) => {
          setViewing(null);
          setFeedbackFor(a);
        }}
      />

      <ApplicationFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        title={form.editing ? "Edit application" : "Add application"}
        initial={form.editing ? toInput(form.editing) : emptyInput(cvVersions, user.profile?.targetRoleFamilies[0])}
        cvVersions={cvVersions}
        onSubmit={async (input) => {
          if (form.editing) await updateApplication(uid, form.editing.id, input);
          else await addApplication(uid, input);
          toast.success("Application saved.");
        }}
      />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} uid={uid} cvVersions={cvVersions} applications={applications} />

      <FeedbackDialog
        open={!!feedbackFor}
        onOpenChange={(o) => !o && setFeedbackFor(null)}
        application={feedbackFor}
        applications={applications}
        onSubmit={async (id, draft) => {
          await patchApplication(uid, id, draft);
          toast.success("Feedback saved.");
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} applications?` : "Delete application?"}
        description={
          toDelete?.length === 1 ? `"${toDelete[0].jobTitle} — ${toDelete[0].employer}" will be permanently deleted.` : "The selected applications will be permanently deleted."
        }
        onConfirm={async () => {
          if (!toDelete) return;
          if (toDelete.length === 1) await deleteApplication(uid, toDelete[0].id);
          else await deleteApplications(uid, toDelete.map((a) => a.id));
          setSelected(new Set());
          toast.success("Deleted.");
        }}
      />
    </>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full text-xs sm:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All — {label.toLowerCase()}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
