import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Check, ChevronDown, ChevronUp, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationFormDialog, emptyInput } from "@/components/candidate/ApplicationDialogs";
import { EmptyState, PageHeader } from "@/components/shared";
import { SAMPLE_VACANCIES, type SampleVacancy } from "@/data/sampleVacancies";
import { ROLE_FAMILIES, type ApplicationInput } from "@/data/types";
import { candidateSkills, targetFamilies, vacancyMatch } from "@/engine";
import { cn } from "@/lib/utils";
import { addApplication } from "@/services/evidence";
import { useCandidateData } from "@/store/CandidateDataContext";

const TARGETS = "__targets";
const ALL = "__all";

export default function Jobs() {
  const { uid, user, cvVersions, applications } = useCandidateData();
  const families = targetFamilies(user.profile, applications);
  const [family, setFamily] = useState(families.length ? TARGETS : ALL);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ApplicationInput | null>(null);

  const skills = useMemo(() => candidateSkills(user.profile, cvVersions), [user.profile, cvVersions]);
  const applied = new Set(applications.map((a) => `${a.employer.toLowerCase()}|${a.jobTitle.toLowerCase()}`));

  const shown = SAMPLE_VACANCIES.filter((v) => (family === ALL ? true : family === TARGETS ? families.includes(v.roleFamily) : v.roleFamily === family))
    .filter((v) => !search.trim() || `${v.title} ${v.employer} ${v.location} ${v.description}`.toLowerCase().includes(search.trim().toLowerCase()))
    .map((v) => ({ v, m: vacancyMatch(v, skills, user.profile) }))
    .sort((a, b) => b.m.match - a.m.match);

  const track = (v: SampleVacancy) =>
    setTracking({
      ...emptyInput(cvVersions, v.roleFamily),
      jobTitle: v.title,
      employer: v.employer,
      location: v.location,
      seniority: v.seniority,
      isGraduateScheme: v.isGraduateScheme,
      jobDescription: v.description,
    });

  return (
    <>
      <PageHeader title="Job Opportunities" description="Roles in your target areas, with the requirements each one asks for and how your skills compare." />

      <Alert variant="info" className="mb-5">
        <AlertDescription>
          <Badge variant="amber" className="mr-2">
            Sample vacancies
          </Badge>
          These are fictional example adverts, not real openings. Live job listings will appear here once a job-data provider is approved.
        </AlertDescription>
      </Alert>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, employer, location or skill" className="pl-9" />
        </div>
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Role family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {families.length > 0 && <SelectItem value={TARGETS}>My target families ({families.join(", ")})</SelectItem>}
            <SelectItem value={ALL}>All role families</SelectItem>
            {ROLE_FAMILIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!user.profile?.targetRoleFamilies.length && (
        <p className="mb-4 text-sm text-muted-foreground">
          Tip: set your target role families in <Link to="/app/profile" className="font-medium text-primary hover:underline">My Profile</Link> to see the most relevant roles first.
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState icon={Briefcase} title="No sample vacancies match" description="Try another role family or clear the search." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map(({ v, m }) => {
            const expanded = open === v.id;
            const alreadyTracked = applied.has(`${v.employer.toLowerCase()}|${v.title.toLowerCase()}`);
            return (
              <Card key={v.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{v.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {v.employer} · <MapPin className="inline h-3.5 w-3.5" /> {v.location}
                      </p>
                    </div>
                    <Badge variant="amber">Sample vacancy</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {v.roleFamily} · {v.seniority} · {v.salary} · {v.contract}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-navy">You have {Math.round(m.match * 100)}% of the required skills</span>
                      {m.minYears !== null && (
                        <span className={m.meetsYears ? "text-emerald-700" : "text-amber-700"}>
                          {m.minYears}+ years asked{m.meetsYears ? "" : " — above your profile"}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className={cn("h-full rounded-full", m.match >= 0.7 ? "bg-teal" : m.match >= 0.4 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${m.match * 100}%` }} />
                    </div>
                  </div>
                  <SkillList label="Required" items={m.required} />
                  {m.desirable.length > 0 && <SkillList label="Desirable" items={m.desirable} />}
                  {expanded && <p className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-slate-700">{v.description}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(expanded ? null : v.id)}>
                      {expanded ? <ChevronUp /> : <ChevronDown />} {expanded ? "Hide advert" : "Read advert"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => track(v)} disabled={alreadyTracked}>
                      {alreadyTracked ? <Check /> : <Plus />} {alreadyTracked ? "In your tracker" : "Track as application"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        See every gap across your target roles, with course suggestions, on{" "}
        <Link to="/app/skills" className="font-medium text-primary hover:underline">
          Skills &amp; Courses
        </Link>
        .
      </p>

      <ApplicationFormDialog
        open={Boolean(tracking)}
        onOpenChange={(o) => !o && setTracking(null)}
        title="Track this sample vacancy"
        initial={tracking ?? emptyInput(cvVersions)}
        cvVersions={cvVersions}
        onSubmit={async (input) => {
          await addApplication(uid, input);
          toast.success("Added to your Application Tracker.");
        }}
      />
    </>
  );
}

function SkillList({ label, items }: { label: string; items: { skill: string; have: boolean }[] }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{label}: no specific skills listed.</p>;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Badge key={s.skill} variant={s.have ? "green" : "red"} className="gap-1">
            {s.have ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {s.skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}
