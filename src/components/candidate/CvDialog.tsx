import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/shared";
import type { BulletStrength, CvExperience, CvProject, CvVersion } from "@/data/types";
import { analyseBullet } from "@/engine";
import { splitCvText } from "@/lib/cvText";
import { CV_MAX_BYTES, cvContentType, extractCvText } from "@/lib/cvExtract";
import type { CvInput } from "@/services/evidence";

const strengthVariant: Record<BulletStrength, "green" | "amber" | "red"> = { Strong: "green", Partial: "amber", Weak: "red" };

export function BulletStrength({ text }: { text: string }) {
  if (!text.trim()) return null;
  const a = analyseBullet(text);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={strengthVariant[a.strength]}>{a.strength}</Badge>
      {a.reasons.length > 0 && <span className="text-xs text-muted-foreground">{a.reasons.join(" · ")}</span>}
    </span>
  );
}

const emptyExperience = (): CvExperience => ({ role: "", employer: "", start: "", end: "", bullets: [] });

export function CvDialog({
  open,
  onOpenChange,
  editing,
  existingLabels,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: CvVersion | null;
  existingLabels: string[];
  /** `fromFile` is true when the text came from a file chosen in this dialog. */
  onSave: (cv: CvInput, fromFile: boolean) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [statement, setStatement] = useState("");
  const [experience, setExperience] = useState<CvExperience[]>([emptyExperience()]);
  const [bulletText, setBulletText] = useState<string[]>([""]);
  const [projects, setProjects] = useState<{ name: string; text: string }[]>([]);
  const [skills, setSkills] = useState("");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null | undefined>(undefined);
  const [reading, setReading] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function fill(cv: { personalStatement: string; experience: CvExperience[]; projects?: CvProject[]; skillsSection: string[] }) {
    setStatement(cv.personalStatement);
    const exp = cv.experience.length ? cv.experience : [emptyExperience()];
    setExperience(exp);
    setBulletText(exp.map((e) => e.bullets.join("\n")));
    setProjects((cv.projects ?? []).map((p) => ({ name: p.name, text: p.bullets.join("\n") })));
    setSkills(cv.skillsSection.join(", "));
  }

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setNote(undefined);
    setPaste("");
    setShowPaste(!editing);
    setLabel(editing?.label ?? `CV v${existingLabels.length + 1}`);
    setFile(editing?.fileName ? { name: editing.fileName, size: editing.fileSize ?? 0 } : null);
    setNewFile(null);
    setExtractedText(undefined);
    fill(editing ?? { personalStatement: "", experience: [], projects: [], skillsSection: [] });
  }, [open, editing?.id]);

  function applyPaste(text: string) {
    const split = splitCvText(text);
    fill(split);
    setShowPaste(false);
    const roles = split.experience.length;
    const projectCount = split.projects.length;
    setNote(
      `Found ${roles} role${roles === 1 ? "" : "s"} with ${split.experience.flatMap((e) => e.bullets).length} bullets` +
        (projectCount ? ` and ${projectCount} project${projectCount === 1 ? "" : "s"}` : "") +
        " — please check and correct them below before saving.",
    );
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(undefined);
    if (!cvContentType(f)) return setError("Upload a PDF, Word (.docx) or plain-text file. Older .doc files can't be read — save as .docx first.");
    if (f.size > CV_MAX_BYTES) return setError("The file is larger than 5 MB.");
    setReading(true);
    try {
      const text = await extractCvText(f);
      setFile({ name: f.name, size: f.size });
      setNewFile(f);
      setExtractedText(text);
      if (text) applyPaste(text);
      else {
        setNote(`No text found in ${f.name}. If it is a scanned image, paste the CV text below.`);
        setShowPaste(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function loadSample() {
    const res = await fetch("/templates/sample_cv.txt");
    setLabel("CV v1 - Internships");
    applyPaste(await res.text());
  }

  const updateProject = (i: number, changes: Partial<{ name: string; text: string }>) => setProjects((ps) => ps.map((p, j) => (j === i ? { ...p, ...changes } : p)));
  const updateExp = (i: number, changes: Partial<CvExperience>) => setExperience((xs) => xs.map((x, j) => (j === i ? { ...x, ...changes } : x)));

  async function save() {
    const finalExp = experience.map((e, i) => ({ ...e, bullets: (bulletText[i] ?? "").split("\n").map((b) => b.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean) }));
    if (!label.trim()) return setError("Give this CV version a name.");
    const clash = existingLabels.some((l) => l.trim().toLowerCase() === label.trim().toLowerCase() && l !== editing?.label);
    if (clash) return setError("Another CV version already has this name.");
    if (!finalExp.some((e) => e.bullets.length)) return setError("Add at least one experience bullet.");
    setSaving(true);
    try {
      await onSave({
        label,
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        personalStatement: statement,
        experience: finalExp,
        projects: projects.map((p) => ({ name: p.name, bullets: p.text.split("\n").map((b) => b.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean) })),
        skillsSection: skills.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean),
        ...(extractedText !== undefined ? { extractedText } : {}),
      }, Boolean(newFile));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message.includes("5 MB") ? err.message : "Could not save the CV. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.label}` : "Add CV version"}</DialogTitle>
          <DialogDescription>Upload a PDF or Word file, or paste or type your CV. Each bullet is checked for measurable results as you type.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="cv-label">Version name</Label>
              <Input id="cv-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPaste((s) => !s)}>
                <ClipboardPaste /> Paste text
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                {reading ? <Loader2 className="animate-spin" /> : <FileText />} Upload file
              </Button>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
          {file && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              File: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB) —{" "}
              {newFile ? "text extracted. Only the text is saved, not the file itself." : "name recorded only."}
            </p>
          )}

          {showPaste && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="cv-paste">Paste your CV as plain text</Label>
              <Textarea
                id="cv-paste"
                rows={6}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"PERSONAL STATEMENT\n…\nEXPERIENCE\nRole | Employer | Jun 2024 - Aug 2024\n- Bullet\nSKILLS\nExcel, SQL"}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => applyPaste(paste)} disabled={!paste.trim()}>
                  Split into sections
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={loadSample}>
                  Use the fictional sample CV
                </Button>
              </div>
            </div>
          )}
          {note && (
            <Alert variant="info">
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="cv-statement">Personal statement</Label>
            <Textarea id="cv-statement" rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </div>

          <div className="space-y-3">
            <Label>Experience</Label>
            {experience.map((e, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input aria-label="Role" placeholder="Role" value={e.role} onChange={(ev) => updateExp(i, { role: ev.target.value })} className="sm:col-span-2" />
                  <Input aria-label="Employer" placeholder="Employer" value={e.employer} onChange={(ev) => updateExp(i, { employer: ev.target.value })} className="sm:col-span-2" />
                  <Input aria-label="Start" placeholder="Start (e.g. Jun 2024)" value={e.start} onChange={(ev) => updateExp(i, { start: ev.target.value })} className="sm:col-span-2" />
                  <Input aria-label="End" placeholder="End" value={e.end} onChange={(ev) => updateExp(i, { end: ev.target.value })} className="sm:col-span-2" />
                </div>
                <Textarea
                  aria-label="Bullets"
                  rows={3}
                  placeholder="One achievement per line"
                  value={bulletText[i] ?? ""}
                  onChange={(ev) => setBulletText((bs) => bs.map((b, j) => (j === i ? ev.target.value : b)))}
                />
                <ul className="space-y-1">
                  {(bulletText[i] ?? "")
                    .split("\n")
                    .filter((b) => b.trim())
                    .map((b, j) => (
                      <li key={j} className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-2">
                        <span className="truncate text-slate-700 sm:max-w-[55%]">{b.replace(/^\s*[-•*]\s*/, "")}</span>
                        <BulletStrength text={b.replace(/^\s*[-•*]\s*/, "")} />
                      </li>
                    ))}
                </ul>
                {experience.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setExperience((xs) => xs.filter((_, j) => j !== i));
                      setBulletText((bs) => bs.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 /> Remove role
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setExperience((xs) => [...xs, emptyExperience()]);
                setBulletText((bs) => [...bs, ""]);
              }}
            >
              <Plus /> Add role
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Projects</Label>
              <p className="text-xs text-muted-foreground">Kept separate from your work experience. Skills named here still count as evidence.</p>
            </div>
            {projects.map((p, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <Input aria-label="Project name" placeholder="Project name" value={p.name} onChange={(ev) => updateProject(i, { name: ev.target.value })} />
                <Textarea aria-label="Project details" rows={2} placeholder="What you did, one point per line" value={p.text} onChange={(ev) => updateProject(i, { text: ev.target.value })} />
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setProjects((ps) => ps.filter((_, j) => j !== i))}>
                  <Trash2 /> Remove project
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setProjects((ps) => [...ps, { name: "", text: "" }])}>
              <Plus /> Add project
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cv-skills">Skills section</Label>
            <Input id="cv-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Excel, SQL, stakeholder management" />
          </div>
          <FieldError message={error} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || reading}>
            {saving && <Loader2 className="animate-spin" />} Save CV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
