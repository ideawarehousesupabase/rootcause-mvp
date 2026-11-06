import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Undo2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Application, CvVersion } from "@/data/types";
import {
  autoMap,
  CSV_COLUMNS,
  CSV_MAX_BYTES,
  downloadText,
  missingRequired,
  parseCsv,
  rowsToErrorCsv,
  TEMPLATE_CSV,
  validateRows,
  type ColumnMapping,
  type CsvColumn,
  type ParsedCsv,
  type RowResult,
} from "@/lib/csv";
import { cn } from "@/lib/utils";
import { importApplications, undoImport } from "@/services/evidence";

type Step = "upload" | "map" | "preview" | "done";

export function CsvImportDialog({
  open,
  onOpenChange,
  uid,
  cvVersions,
  applications,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  uid: string;
  cvVersions: CvVersion[];
  applications: Application[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<RowResult[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batchId: string; imported: number; skipped: number; failed: number; newCvLabels: string[] } | null>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping({});
    setRows([]);
    setError(undefined);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function load(text: string, name: string) {
    const p = parseCsv(text);
    setFileName(name);
    if (p.error) return setError(p.error);
    if (!p.rows.length) return setError("The file has a header row but no data rows.");
    setError(undefined);
    setParsed(p);
    const m = autoMap(p.headers);
    setMapping(m);
    setStep(missingRequired(m).length ? "map" : "preview");
    if (!missingRequired(m).length) setRows(validate(p, m));
  }

  function validate(p: ParsedCsv, m: ColumnMapping) {
    return validateRows(p.rows, m, { cvLabels: cvVersions.map((c) => c.label), existing: applications });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) return setError("The file is larger than 1 MB.");
    if (!/\.csv$/i.test(file.name)) return setError("Choose a .csv file.");
    load(await file.text(), file.name);
  }

  async function loadSample() {
    const res = await fetch("/templates/sample_applications.csv");
    load(await res.text(), "sample_applications.csv");
  }

  const missing = parsed ? missingRequired(mapping) : [];
  const counts = useMemo(
    () => ({
      ready: rows.filter((r) => r.status === "ready").length,
      warning: rows.filter((r) => r.status === "warning").length,
      error: rows.filter((r) => r.status === "error").length,
      included: rows.filter((r) => r.include).length,
    }),
    [rows],
  );

  async function doImport() {
    const chosen = rows.filter((r) => r.include && r.input);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const r = await importApplications(uid, chosen.map((c) => ({ input: c.input!, cvLabel: c.cvLabel })), cvVersions);
      setResult({ ...r, skipped: rows.filter((x) => !x.include && x.status !== "error").length, failed: counts.error });
      setStep("done");
      toast.success(`Imported ${r.imported} application${r.imported === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Import failed. Nothing was saved for the failed batch.");
    } finally {
      setBusy(false);
    }
  }

  async function doUndo() {
    if (!result) return;
    setBusy(true);
    try {
      const n = await undoImport(uid, result.batchId);
      toast.success(`Removed ${n} imported application${n === 1 ? "" : "s"}.`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Could not undo the import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import applications from CSV</DialogTitle>
          <DialogDescription>Up to 500 rows, 1 MB. Dates as YYYY-MM-DD or DD/MM/YYYY.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/40"
            >
              <Upload className="h-8 w-8 text-primary" />
              <span className="font-medium text-navy">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Header row required</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {fileName && <span className="font-medium">{fileName}: </span>}
                  {error}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadText("applications_template.csv", TEMPLATE_CSV)}>
                <Download /> Download template
              </Button>
              <Button variant="outline" size="sm" onClick={loadSample}>
                <FileSpreadsheet /> Try the fictional sample
              </Button>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-navy">Columns</p>
              <p className="mt-1">
                {CSV_COLUMNS.map((c) => (
                  <span key={c.key} className="mr-2 inline-block">
                    <code>{c.key}</code>
                    {c.required && <span className="text-destructive">*</span>}
                  </span>
                ))}
              </p>
              <p className="mt-2">
                The sample is a fictional finance graduate (24 applications) from the business plan's worked example. Pair it with the sample CV text on the CV tab.
              </p>
            </div>
          </div>
        )}

        {step === "map" && parsed && (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>
                Match your columns to the template. Still missing: {missing.map((m) => <code key={m} className="mr-1">{m}</code>)}
              </AlertDescription>
            </Alert>
            <div className="grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {parsed.headers.map((h) => (
                <div key={h} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{h}</span>
                  <Select value={mapping[h] ?? "__ignore"} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v === "__ignore" ? null : (v as CsvColumn) }))}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore">Ignore column</SelectItem>
                      {CSV_COLUMNS.map((c) => (
                        <SelectItem key={c.key} value={c.key} disabled={Object.entries(mapping).some(([hh, v]) => v === c.key && hh !== h)}>
                          {c.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button
                disabled={missing.length > 0}
                onClick={() => {
                  setRows(validate(parsed, mapping));
                  setStep("preview");
                }}
              >
                Validate rows
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="green">
                <CheckCircle2 className="h-3 w-3" /> {counts.ready} ready
              </Badge>
              <Badge variant="amber">
                <AlertTriangle className="h-3 w-3" /> {counts.warning} with warnings
              </Badge>
              <Badge variant="red">
                <XCircle className="h-3 w-3" /> {counts.error} with errors
              </Badge>
              <span className="text-muted-foreground">{fileName}</span>
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Use</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Job title</TableHead>
                    <TableHead>Employer</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.index} className={cn(r.status === "error" && "bg-red-50/60")}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Include row ${r.index}`}
                          disabled={r.status === "error"}
                          checked={r.include}
                          onChange={(e) => setRows((rs) => rs.map((x) => (x.index === r.index ? { ...x, include: e.target.checked } : x)))}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{r.index}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.input?.jobTitle ?? Object.values(r.raw)[0]}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{r.input?.employer ?? ""}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.input?.dateApplied ?? ""}</TableCell>
                      <TableCell>{r.input?.status ?? ""}</TableCell>
                      <TableCell className="min-w-[220px] text-xs">
                        {r.messages.length ? (
                          <ul className={cn("space-y-0.5", r.status === "error" ? "text-red-700" : "text-amber-800")}>
                            {r.messages.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-emerald-700">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  Start again
                </Button>
                {counts.error > 0 && (
                  <Button variant="outline" onClick={() => downloadText("import_errors.csv", rowsToErrorCsv(rows))}>
                    <Download /> Error report
                  </Button>
                )}
              </div>
              <Button onClick={doImport} disabled={busy || counts.included === 0}>
                {busy && <Loader2 className="animate-spin" />} Import {counts.included} row{counts.included === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 />
              <AlertDescription>
                Imported {result.imported}, skipped {result.skipped}, failed {result.failed}.
                {result.newCvLabels.length > 0 && ` New CV version${result.newCvLabels.length === 1 ? "" : "s"} created: ${result.newCvLabels.join(", ")} — add the CV text on the CV tab.`}
              </AlertDescription>
            </Alert>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={doUndo} disabled={busy}>
                <Undo2 /> Undo this import
              </Button>
              <div className="flex gap-2">
                {result.failed > 0 && (
                  <Button variant="outline" onClick={() => downloadText("import_errors.csv", rowsToErrorCsv(rows))}>
                    <Download /> Error report
                  </Button>
                )}
                <Button
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
