import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, GraduationCap, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, EngineBadge, LoadingState, PageHeader } from "@/components/shared";
import { COURSE_CATALOGUE } from "@/data/courseCatalogue";
import { SAMPLE_VACANCIES } from "@/data/sampleVacancies";
import type { SkillGap } from "@/data/types";
import { ENGINE_VERSION, courseStep, recommendCourses, skillsGap } from "@/engine";
import { formatDate } from "@/lib/utils";
import { addRoadmapSteps, saveRecommendations } from "@/services/career";
import { useCandidateData } from "@/store/CandidateDataContext";

const gapStatus = (g: SkillGap) =>
  !g.have
    ? { label: "Missing", variant: "red" as const }
    : !g.evidenced
      ? { label: "Listed, not shown in CV", variant: "amber" as const }
      : { label: "Shown in CV", variant: "green" as const };

export default function SkillsCourses() {
  const { uid, user, cvVersions, applications, recommendations, roadmap, loading } = useCandidateData();

  const result = useMemo(
    () => skillsGap({ profile: user.profile, cvVersions, applications, vacancies: SAMPLE_VACANCIES }),
    [user.profile, cvVersions, applications],
  );
  const courses = useMemo(() => recommendCourses(result.gaps, COURSE_CATALOGUE), [result.gaps]);
  const signature = JSON.stringify([result.targetFamilies, result.rolesConsidered, result.gaps, courses]);
  const savedSignature = recommendations
    ? JSON.stringify([recommendations.targetFamilies, recommendations.rolesConsidered, recommendations.gaps, recommendations.courses])
    : null;

  // Keep the saved recommendations in step with the live analysis.
  useEffect(() => {
    if (loading || !result.rolesConsidered || signature === savedSignature) return;
    const t = setTimeout(
      () =>
        saveRecommendations(uid, { engineVersion: ENGINE_VERSION, targetFamilies: result.targetFamilies, rolesConsidered: result.rolesConsidered, gaps: result.gaps, courses }).catch(
          (err) => console.error("Saving recommendations failed", err),
        ),
      1500,
    );
    return () => clearTimeout(t);
  }, [loading, uid, signature, savedSignature]);

  if (loading) return <LoadingState />;

  const onRoadmap = new Set(roadmap.map((s) => s.sourceId));
  const missing = result.gaps.filter((g) => !g.have).length;
  const unshown = result.gaps.filter((g) => g.have && !g.evidenced).length;

  async function addCourse(courseId: string) {
    const course = COURSE_CATALOGUE.find((c) => c.id === courseId);
    if (!course) return;
    try {
      await addRoadmapSteps(uid, [courseStep(course)], (roadmap[roadmap.length - 1]?.order ?? 0) + 1);
      toast.success("Added to your career roadmap.");
    } catch {
      toast.error("Could not add it to the roadmap.");
    }
  }

  return (
    <>
      <PageHeader
        title="Skills & Courses"
        description="The skills and qualifications your target roles ask for, compared with your profile and CV, and courses that close the gaps."
        actions={<EngineBadge />}
      />

      {result.rolesConsidered === 0 ? (
        <EmptyState
          icon={Target}
          title="No target roles to compare against yet"
          description="Choose target role families in My Profile, or add applications with job descriptions, to see your skills gap."
          action={
            <Button asChild>
              <Link to="/app/profile">Go to My Profile</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Roles compared" value={result.rolesConsidered} hint={result.targetFamilies.join(", ")} />
            <Stat label="Missing skills" value={missing} hint="Asked for, not in your profile or CV" />
            <Stat label="Not shown in CV" value={unshown} hint="Listed, but no bullet shows them in use" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Skills gap</CardTitle>
              <CardDescription>
                Built from the sample vacancies and your own applications' job descriptions in {result.targetFamilies.join(" and ")}. Importance is the share of those roles that ask
                for the skill (desirable mentions count half).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Skill or qualification</TableHead>
                    <TableHead className="w-48">Importance</TableHead>
                    <TableHead>Your position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.gaps.map((g) => {
                    const st = gapStatus(g);
                    return (
                      <TableRow key={g.skill}>
                        <TableCell className="font-medium text-navy">
                          {g.skill}
                          {g.required && <span className="ml-2 text-xs font-normal text-muted-foreground">often required</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(g.importance * 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{Math.round(g.importance * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-navy">Recommended courses</h2>
                <p className="text-sm text-muted-foreground">One course per missing skill, most important first.</p>
              </div>
              {recommendations?.generatedAt && (
                <p className="text-xs text-muted-foreground">Saved to your account {formatDate(recommendations.generatedAt.toDate().toISOString())}</p>
              )}
            </div>
            <Alert variant="info" className="mb-4">
              <AlertDescription>
                <Badge variant="amber" className="mr-2">
                  Sample courses
                </Badge>
                Course titles and providers are fictional examples that show how recommendations will work.
              </AlertDescription>
            </Alert>
            {courses.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No courses needed right now" description="You already list every skill that at least 20% of your target roles ask for." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((rec) => {
                  const c = COURSE_CATALOGUE.find((x) => x.id === rec.courseId)!;
                  const added = onRoadmap.has(`course:${c.id}`);
                  return (
                    <Card key={c.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                          <Badge variant="amber">Sample course</Badge>
                        </div>
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        <CardDescription>{c.provider}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                          {c.format} · {c.duration} · {c.cost} · {c.level}
                        </p>
                        <p className="text-slate-700">{rec.reason}</p>
                        <Button size="sm" variant={added ? "ghost" : "outline"} className="mt-auto self-start" onClick={() => addCourse(c.id)} disabled={added}>
                          {added ? <Check /> : <Plus />} {added ? "On your roadmap" : "Add to roadmap"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Follow your plan on the{" "}
            <Link to="/app/actions?tab=roadmap" className="font-medium text-primary hover:underline">
              career roadmap
            </Link>
            .
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
