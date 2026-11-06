import { Link } from "react-router-dom";
import { Logo } from "@/components/shared";

const sections = [
  {
    h: "What we store",
    p: "Your account details (name, email, account type), the career profile you complete, the CVs you upload or type (the text taken from an uploaded file; the file itself is not kept), the job applications you log or import (including job descriptions, responses and feedback), and what the platform produces from them: diagnoses, corrective actions, skills-gap results, course recommendations, your career roadmap and monthly progress figures.",
  },
  {
    h: "Where it is stored",
    p: "Your records are kept in Google Cloud Firestore under your account. Your password is never stored: only a salted one-way hash (PBKDF2-SHA256) is saved, and signing in checks your password against it.",
  },
  {
    h: "Why we store it",
    p: "Only to provide your diagnostics: to analyse patterns across your applications, identify the probable cause of unsuccessful outcomes, suggest corrective actions and learning, and measure what happens next. Your data is not used for anyone else's diagnostics.",
  },
  {
    h: "Who can see it",
    p: "Records cannot be browsed or listed: the app reaches yours only through your email address and password. In this MVP there is no separate sign-in service, so the database cannot confirm who is asking, and someone who knows your email address and queries the database directly could reach your records. If you choose to share with a careers service or employability provider using their join code, they see a summary only: your name, target role, application, interview and offer counts, monthly activity, diagnosed causes and rationale, and the titles and statuses of your actions. They never see your CV, job descriptions or feedback text. You can withdraw sharing at any time, which deletes the summary.",
  },
  {
    h: "Sample vacancies and courses",
    p: "The Job Opportunities and Skills & Courses pages use clearly labelled sample vacancies and sample courses. They are fictional examples until live job and course data are approved; nothing you enter is sent to them.",
  },
  {
    h: "How diagnoses are produced",
    p: "RootCause Careers is being built as an AI-powered diagnostic platform. In this MVP, diagnoses, skills gaps and recommendations come from a transparent rule-based engine that simulates the planned AI model. No AI model is used. Results describe probable causes and are never confirmed reasons for an employer's decision.",
  },
  {
    h: "Exporting and deleting your data",
    p: "From the account panel (bottom of the sidebar) you can download everything stored for you, or permanently delete your account, every record and every uploaded file.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center">
          <Logo />
        </div>
      </header>
      <main className="container max-w-3xl py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">Privacy notice</h1>
        <p className="mt-2 text-muted-foreground">How RootCause Careers handles the job-search information you enter.</p>
        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-navy">{s.h}</h2>
              <p className="mt-1 leading-relaxed text-slate-700">{s.p}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm">
          <Link to="/" className="font-medium text-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
