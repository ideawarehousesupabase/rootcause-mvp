import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/shared";
import { usingEmulators } from "@/lib/firebase";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-navy-foreground lg:flex">
        <Logo light />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">Understand why applications are not progressing.</h2>
          <ul className="mt-8 space-y-4 text-white/80">
            {[
              "Connect evidence across every application",
              "See probable root causes with supporting evidence",
              "Follow a prioritised corrective action plan",
              "Measure response, interview and offer rates",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">RootCause Careers Ltd · MVP demonstration</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {usingEmulators && (
            <p className="mt-4 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
              Connected to local Firebase emulators — test accounts only.
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
