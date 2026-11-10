import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  Layers,
  ListChecks,
  Microscope,
  Network,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared";

const steps = [
  { icon: ClipboardList, title: "Capture employment evidence", text: "CVs, applications, job descriptions, recruiter responses and interview outcomes in one structured record." },
  { icon: Network, title: "Analyse job-search patterns", text: "Look across every application over time, not one CV or one rejection in isolation." },
  { icon: Microscope, title: "Identify probable root causes", text: "Classify the binding constraint — targeting, qualification, positioning, evidence or delivery — with a confidence score." },
  { icon: ListChecks, title: "Receive corrective actions", text: "Personalised, prioritised steps linked directly to each finding." },
  { icon: TrendingUp, title: "Measure outcomes", text: "Track response, interview and offer rates before and after changes are made." },
];

const features = [
  { icon: Layers, title: "Structured Evidence Capture", text: "Record CV versions, applications, job descriptions and feedback in a consistent format ready for analysis." },
  { icon: Network, title: "Cross-Application Analysis", text: "Compare outcomes across role types, CV versions and employers to reveal patterns a single review would miss." },
  { icon: Microscope, title: "Root-Cause Diagnostics", text: "One primary cause from five mutually exclusive classes, with a confidence score and a rationale traceable to your evidence." },
  { icon: Target, title: "Personalised Corrective Actions", text: "Sequenced actions for the primary cause, so the effect of each change can be measured on its own." },
  { icon: BarChart3, title: "Conversion Analytics", text: "Application-to-response, application-to-interview and interview-to-offer rates tracked over time." },
  { icon: Building2, title: "Institutional Employability Insights", text: "Cohort-level view of common barriers and outcomes for careers services and employability providers." },
];


export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-navy">How it works</a>
            <a href="#capabilities" className="hover:text-navy">Capabilities</a>
            <a href="#audiences" className="hover:text-navy">Who it's for</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-white to-blue-50/40">
        <div className="container grid gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
          <div>
            <Badge variant="teal" className="mb-5">Job-search root-cause diagnostics · UK</Badge>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-navy sm:text-5xl">
              Discover What's Holding Back Your Job Search
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Understand the probable causes behind unsuccessful job applications through evidence-based diagnostics, personalised corrective actions and measurable progress tracking.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Get Started <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Not a job board, recruitment agency or CV builder, and not a one-off CV score against a single job — a diagnostic platform that looks across all your applications to understand why they are not progressing.
            </p>
          </div>

          {/* Product preview */}
          <Card className="shadow-xl shadow-blue-900/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Example diagnosis</CardTitle>
                <Badge variant="amber">Illustrative example</Badge>
              </div>
              <CardDescription>24 applications · 2 interviews · 0 offers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { t: "Evidence — claims without quantified results", c: 0.73, p: "Primary" },
                { t: "Delivery — interviews not converting", c: 0.39, p: "Monitored" },
                { t: "Targeting — role choice", c: 0.1, p: "Ruled out" },
              ].map((f) => (
                <div key={f.t} className="rounded-lg border bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-navy">{f.t}</p>
                    <Badge variant={f.p === "Primary" ? "teal" : f.p === "Monitored" ? "blue" : "slate"}>{f.p}</Badge>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${f.c * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Confidence {f.c.toFixed(2)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-navy">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              Evidence Capture → Analysis → Root-Cause Diagnosis → Corrective Action → Outcome Measurement → Engine Improvement
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              RootCause Careers is being built as an AI-powered diagnostic platform. In this MVP, the analysis is done by a transparent rule-based engine that simulates the planned AI model — no AI processing takes place.
            </p>
          </div>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{i + 1}</span>
                  <s.icon className="h-5 w-5 text-teal" />
                </div>
                <h3 className="mt-4 font-semibold text-navy">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-16 border-y bg-white py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-navy">Core capabilities</h2>
            <p className="mt-3 text-muted-foreground">Connected evidence across many applications, turned into probable causes and targeted actions.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{f.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences" className="scroll-mt-16 py-20">
        <div className="container">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-navy">Who it's for</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Card className="p-2">
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-soft text-teal">
                  <UserRound className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Individual job seekers</CardTitle>
                <CardDescription>For candidates facing repeated rejections who want to know what to change.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {["Recent graduates", "International graduates and students", "Career changers", "Experienced professionals"].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-teal" /> {x}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="p-2">
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Institutional employability providers</CardTitle>
                <CardDescription>Cohort insight into common barriers, conversion rates and candidate progress.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {["University careers services", "Employability departments", "Graduate career programmes", "Recruitment agencies and outplacement providers"].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {x}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


      <footer className="bg-navy text-navy-foreground">
        <div className="container flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo light />
            <p className="mt-3 text-sm text-white/60">Evidence-based job-search diagnostics for the UK.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#capabilities" className="hover:text-white">Capabilities</a>
            <Link to="/login" className="hover:text-white">Sign In</Link>
            <Link to="/register" className="hover:text-white">Register</Link>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="container flex flex-col gap-1 py-4 text-xs text-white/50 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} RootCause Careers Ltd. MVP demonstration.</p>
            <p>
              Diagnoses come from a rule-based engine (AI simulation) and describe probable causes, not confirmed employer reasons.{" "}
              <Link to="/privacy" className="underline">
                Privacy
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
