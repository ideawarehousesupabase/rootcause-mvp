import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  ClipboardList,
  FileSearch,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Microscope,
  PieChart,
  UserRound,
  Users,
} from "lucide-react";
import { LegacyImportDialog } from "@/components/LegacyImportDialog";
import { LoadingState } from "@/components/shared";
import type { AccountType } from "@/data/types";
import { CandidateDataProvider } from "@/store/CandidateDataContext";
import { dashboardPathFor, useSession } from "@/store/SessionContext";
import { AppShell, type NavItem } from "./AppShell";

const candidateNav: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/profile", label: "My Profile", icon: UserRound },
  { to: "/app/evidence", label: "Evidence Capture", icon: FileText },
  { to: "/app/applications", label: "Application Tracker", icon: ClipboardList },
  { to: "/app/diagnostics", label: "Root-Cause Diagnostics", icon: Microscope },
  { to: "/app/actions", label: "Corrective Action Plan", icon: ListChecks },
  { to: "/app/jobs", label: "Job Opportunities", icon: Briefcase },
  { to: "/app/skills", label: "Skills & Courses", icon: GraduationCap },
  { to: "/app/analytics", label: "Progress Analytics", icon: BarChart3 },
];

const institutionNav: NavItem[] = [
  { to: "/institution?tab=overview", label: "Cohort Overview", icon: PieChart },
  { to: "/institution?tab=candidates", label: "Candidate Insights", icon: Users },
  { to: "/institution?tab=reports", label: "Reports", icon: FileSearch },
];

function RequireAccount({ type, children }: { type: AccountType; children: ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <LoadingState label="Signing you in…" />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.accountType !== type) return <Navigate to={dashboardPathFor(session.accountType)} replace />;
  return <>{children}</>;
}

export function CandidateLayout() {
  const { session } = useSession();
  return (
    <RequireAccount type="candidate">
      {session && (
        <CandidateDataProvider key={session.uid} user={session}>
          <AppShell nav={candidateNav}>
            <Outlet />
          </AppShell>
          <LegacyImportDialog user={session} />
        </CandidateDataProvider>
      )}
    </RequireAccount>
  );
}

export function InstitutionLayout() {
  return (
    <RequireAccount type="institutional">
      <AppShell nav={institutionNav}>
        <Outlet />
      </AppShell>
    </RequireAccount>
  );
}
