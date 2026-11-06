import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cpu, Loader2, type LucideIcon } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ActionStatus, ApplicationStatus, CauseClass, Priority } from "@/data/types";
import type { DerivedState } from "@/engine";
import { cn } from "@/lib/utils";

export function Logo({ className, light = false, to = "/" }: { className?: string; light?: boolean; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? "#ffffff" : "#13294b"} fillOpacity={light ? 0.1 : 1} />
        <circle cx="16" cy="11" r="4" fill="#2dd4bf" />
        <path d="M16 15v10M16 20l-6 5M16 20l6 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>
      <span className={cn("text-[17px] leading-none", light ? "text-white" : "text-navy")}>
        RootCause <span className={light ? "text-teal-300" : "text-teal"}>Careers</span>
      </span>
    </Link>
  );
}

const statusVariant: Record<ApplicationStatus, BadgeProps["variant"]> = {
  Applied: "slate",
  "Response Received": "blue",
  Interview: "violet",
  Rejected: "red",
  Offer: "green",
  Withdrawn: "outline",
};

export function StatusBadge({ status, derived }: { status: ApplicationStatus; derived?: DerivedState }) {
  if (status === "Applied" && derived === "No response") return <Badge variant="slate">No response (30+ days)</Badge>;
  if (status === "Applied" && derived === "Pending") return <Badge variant="outline">Pending</Badge>;
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

const actionVariant: Record<ActionStatus, BadgeProps["variant"]> = {
  Queued: "outline",
  "To Do": "slate",
  "In Progress": "amber",
  Completed: "green",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Badge variant={actionVariant[status]}>{status}</Badge>;
}

const priorityVariant: Record<Priority, BadgeProps["variant"]> = { High: "red", Medium: "amber", Low: "slate" };

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={priorityVariant[priority]}>{priority} priority</Badge>;
}

/** Honest label for the rule-based engine standing in for the future AI model. */
export function EngineBadge({ className, version }: { className?: string; version?: string }) {
  return (
    <Badge variant="violet" className={className} title="Rule-based diagnostic engine (AI simulation). No AI model is used.">
      <Cpu className="h-3 w-3" />
      Rule-based engine (AI simulation){version ? ` · ${version}` : ""}
    </Badge>
  );
}

const causeVariant: Record<CauseClass, BadgeProps["variant"]> = {
  Targeting: "amber",
  Qualification: "red",
  Positioning: "violet",
  Evidence: "blue",
  Delivery: "teal",
};

export function CauseBadge({ cause, className }: { cause: CauseClass; className?: string }) {
  return (
    <Badge variant={causeVariant[cause]} className={className}>
      {cause}
    </Badge>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "blue" | "teal" | "violet" | "green" | "amber" | "navy";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    navy: "bg-slate-100 text-navy",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("rounded-lg p-2", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Confidence on the business plan's 0–1 scale. */
export function ConfidenceMeter({ value, className, label = "Confidence" }: { value: number; className?: string; label?: string }) {
  const tone = value >= 0.5 ? "bg-teal" : value >= 0.35 ? "bg-primary" : "bg-slate-400";
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-navy">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium text-navy">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
