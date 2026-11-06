import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, PageHeader } from "@/components/shared";
import { DEGREE_CLASSIFICATIONS, ROLE_FAMILIES, SEGMENTS, type CandidateProfile, type RoleFamily } from "@/data/types";
import { SKILLS } from "@/engine/config";
import { cn } from "@/lib/utils";
import { saveProfile, updateAccountDetails } from "@/services/users";
import { useCandidateData } from "@/store/CandidateDataContext";

const blank: CandidateProfile = {
  education: "",
  degreeClassification: "None",
  qualifications: [],
  skills: [],
  yearsExperience: 0,
  workExperience: "",
  targetRoleFamilies: [],
  targetRoles: [],
  targetIndustry: "",
  careerBackground: "",
  segment: "Recent graduate",
};

const toList = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

interface Draft extends Omit<CandidateProfile, "qualifications" | "skills" | "targetRoles"> {
  fullName: string;
  qualifications: string;
  skills: string;
  targetRoles: string;
}

function toDraft(fullName: string, p: CandidateProfile | null): Draft {
  const profile = p ?? blank;
  return { ...profile, fullName, qualifications: profile.qualifications.join(", "), skills: profile.skills.join(", "), targetRoles: profile.targetRoles.join("; ") };
}

export default function Profile() {
  const { uid, user } = useCandidateData();
  const initial = useMemo(() => toDraft(user.fullName, user.profile), [user.fullName, user.profile]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initial), [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleFamily = (f: RoleFamily) =>
    setDraft((d) => {
      const has = d.targetRoleFamilies.includes(f);
      if (!has && d.targetRoleFamilies.length >= 3) return d;
      return { ...d, targetRoleFamilies: has ? d.targetRoleFamilies.filter((x) => x !== f) : [...d.targetRoleFamilies, f] };
    });

  async function save() {
    const e: Record<string, string> = {};
    if (draft.fullName.trim().length < 2) e.fullName = "Enter your full name.";
    if (!draft.targetRoleFamilies.length) e.targetRoleFamilies = "Choose 1–3 target role families — the engine uses them to assess targeting.";
    if (!Number.isFinite(draft.yearsExperience) || draft.yearsExperience < 0 || draft.yearsExperience > 50) e.yearsExperience = "Enter a number from 0 to 50.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const { fullName, qualifications, skills, targetRoles, ...rest } = draft;
      await saveProfile(uid, {
        ...rest,
        education: rest.education.trim(),
        workExperience: rest.workExperience.trim(),
        targetIndustry: rest.targetIndustry.trim(),
        careerBackground: rest.careerBackground.trim(),
        yearsExperience: Math.round(rest.yearsExperience * 10) / 10,
        qualifications: toList(qualifications),
        skills: toList(skills),
        targetRoles: toList(targetRoles),
      });
      if (fullName.trim() !== user.fullName) await updateAccountDetails(uid, { fullName }, null);
      toast.success("Profile saved.");
    } catch {
      toast.error("Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your career context. The engine compares it with your applications — for example, your target role families against the roles you actually applied for."
        actions={
          <>
            <Button variant="outline" disabled={!dirty} onClick={() => setDraft(initial)}>
              <Undo2 /> Discard
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          </>
        }
      />
      <Alert variant="info" className="mb-6">
        <Info />
        <AlertDescription>
          Fields marked <span className="font-semibold text-primary">●</span> are used by the diagnostic engine. Your profile is visible only to you.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Background</CardTitle>
            <CardDescription>Education, qualifications, skills and experience.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" error={errors.fullName}>
              <Input id="fullName" value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label="Situation">
              <Select value={draft.segment} onValueChange={(v) => set("segment", v as Draft["segment"])}>
                <SelectTrigger id="segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Education" className="sm:col-span-2">
              <Input id="education" value={draft.education} onChange={(e) => set("education", e.target.value)} placeholder="BSc (Hons) Business Management, University of …, 2025" />
            </Field>
            <Field label="Degree classification" engine>
              <Select value={draft.degreeClassification} onValueChange={(v) => set("degreeClassification", v as Draft["degreeClassification"])}>
                <SelectTrigger id="degree">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEGREE_CLASSIFICATIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Years of relevant experience" engine error={errors.yearsExperience}>
              <Input id="years" type="number" min={0} max={50} step={0.5} value={draft.yearsExperience} onChange={(e) => set("yearsExperience", Number(e.target.value))} />
            </Field>
            <Field label="Qualifications" engine hint="Comma-separated, e.g. AAT Level 3, PRINCE2 Foundation" className="sm:col-span-2">
              <Input id="qualifications" value={draft.qualifications} onChange={(e) => set("qualifications", e.target.value)} />
            </Field>
            <Field label="Skills" engine hint="Comma-separated. Use common names like SQL, Power BI, stakeholder management." className="sm:col-span-2">
              <Input id="skills" list="skill-suggestions" value={draft.skills} onChange={(e) => set("skills", e.target.value)} />
              <datalist id="skill-suggestions">
                {Object.keys(SKILLS).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Work experience" engine hint="One role per line. Skills named here count as held." className="sm:col-span-2">
              <Textarea id="workExperience" rows={3} value={draft.workExperience} onChange={(e) => set("workExperience", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Career targets</CardTitle>
            <CardDescription>Used to assess role targeting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Target role families (1–3)" engine error={errors.targetRoleFamilies}>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_FAMILIES.map((f) => {
                  const on = draft.targetRoleFamilies.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleFamily(f)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Target job titles" hint="Separate with semicolons">
              <Input id="targetRoles" value={draft.targetRoles} onChange={(e) => set("targetRoles", e.target.value)} placeholder="Junior Business Analyst; Data Analyst" />
            </Field>
            <Field label="Target industry and location">
              <Input id="targetIndustry" value={draft.targetIndustry} onChange={(e) => set("targetIndustry", e.target.value)} />
            </Field>
            <Field label="Career background">
              <Textarea id="careerBackground" rows={3} value={draft.careerBackground} onChange={(e) => set("careerBackground", e.target.value)} />
            </Field>
            <Button className="w-full" onClick={save} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, hint, error, engine, className, children }: { label: string; hint?: string; error?: string; engine?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label} {engine && <span className="text-primary" title="Used by the diagnostic engine">●</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}
