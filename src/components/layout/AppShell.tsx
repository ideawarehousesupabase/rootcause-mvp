import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Settings, WifiOff, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/shared";
import { usingEmulators } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/SessionContext";
import { AccountDialog } from "./AccountDialog";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function SidebarBody({ nav, onNavigate, onOpenAccount }: { nav: NavItem[]; onNavigate?: () => void; onOpenAccount: () => void }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname + location.search;

  return (
    <div className="flex h-full flex-col bg-navy text-navy-foreground">
      <div className="px-5 py-5">
        <Logo light to={nav[0]?.to ?? "/"} />
      </div>
      <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {session?.accountType === "institutional" ? "Institutional workspace" : "Candidate workspace"}
      </p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((item) => {
          // Query-string items (institution tabs) are matched exactly; path items by prefix.
          const active = item.to.includes("?")
            ? current === item.to || (current === item.to.split("?")[0] && item === nav[0])
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className={cn("h-4 w-4", active && "text-teal-300")} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      {session && (
        <div className="border-t border-white/10 p-3">
          <button
            onClick={onOpenAccount}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/90 text-sm font-semibold text-white">
              {initials(session.fullName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{session.fullName}</span>
              <span className="block truncate text-xs text-white/50">
                {session.accountType === "institutional" ? session.organisationName ?? "Institutional" : session.email}
              </span>
            </span>
            <Settings className="h-4 w-4 text-white/50" />
          </button>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-white/70 hover:bg-white/5 hover:text-white"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            <LogOut /> Log out
          </Button>
        </div>
      )}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AppShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const online = useOnline();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const openAccount = () => {
    setMobileOpen(false);
    setAccountOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody nav={nav} onOpenAccount={openAccount} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
          <SidebarBody nav={nav} onNavigate={() => setMobileOpen(false)} onOpenAccount={openAccount} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
          <Logo />
        </header>
        {usingEmulators && (
          <div className="border-b border-violet-200 bg-violet-50 px-4 py-1.5 text-center text-xs text-violet-900 sm:px-8">
            Connected to local Firebase emulators — test data only.
          </div>
        )}
        {!online && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            <WifiOff className="h-3.5 w-3.5" /> Offline — changes will sync when you reconnect.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}
