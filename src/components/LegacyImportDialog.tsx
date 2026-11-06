import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/shared";
import type { UserDoc } from "@/data/types";
import { findLegacyWorkspaces, isImportSkipped, skipImport, type LegacyWorkspace } from "@/lib/legacyImport";
import { importLegacyWorkspace } from "@/services/legacy";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Offers, once per account, to import workspaces the previous version saved in this browser. */
export function LegacyImportDialog({ user }: { user: UserDoc }) {
  const [workspaces, setWorkspaces] = useState<LegacyWorkspace[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (user.legacyImportedAt || isImportSkipped(user.uid)) return;
    const found = findLegacyWorkspaces();
    setWorkspaces(found);
    setOpen(found.length > 0);
  }, [user.uid, user.legacyImportedAt]);

  async function runImport(ws: LegacyWorkspace) {
    setBusy(ws.key);
    setError(undefined);
    try {
      const c = await importLegacyWorkspace(user.uid, ws, { hasProfile: Boolean(user.profile) });
      toast.success(`Imported ${plural(c.cvVersions, "CV")}, ${plural(c.applications, "application")} and ${plural(c.diagnoses, "diagnosis", "diagnoses")}.`);
      const rest = workspaces.filter((w) => w.key !== ws.key);
      setWorkspaces(rest);
      if (!rest.length) setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import failed. Nothing was removed from this browser.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import data saved in this browser?</DialogTitle>
          <DialogDescription>
            The previous version of RootCause Careers kept workspaces in this browser. Import one to copy it into your account, where it is saved
            securely and available on any device. The browser copy is kept, not deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <div key={ws.key} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium text-navy">
                  {plural(ws.counts.cvVersions, "CV")} · {plural(ws.counts.applications, "application")} · {plural(ws.counts.diagnoses, "diagnosis", "diagnoses")} ·{" "}
                  {plural(ws.counts.actions, "action")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ws.demoOnly ? "Looks like the unchanged demonstration data." : ws.store.profile ? "Includes a career profile." : "No career profile."}
                </p>
              </div>
              <Button size="sm" onClick={() => runImport(ws)} disabled={Boolean(busy)}>
                {busy === ws.key && <Loader2 className="animate-spin" />} Import
              </Button>
            </div>
          ))}
          <FieldError message={error} />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              skipImport(user.uid);
              setOpen(false);
            }}
            disabled={Boolean(busy)}
          >
            Don't ask again
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={Boolean(busy)}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
