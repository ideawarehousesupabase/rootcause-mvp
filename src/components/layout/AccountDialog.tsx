import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Download, Loader2, Share2, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FieldError } from "@/components/shared";
import { applicationsToCsv, downloadText } from "@/lib/csv";
import { formatDate, todayLocal } from "@/lib/utils";
import { deleteAccountAndData, exportUserData } from "@/services/account";
import { grantSharing, lookupJoinCode, withdrawSharing } from "@/services/sharing";
import { accountErrorMessage, updateAccountDetails } from "@/services/users";
import { useSession } from "@/store/SessionContext";
import { useOptionalCandidateData } from "@/store/CandidateDataContext";

export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session } = useSession();
  const candidate = useOptionalCandidateData();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [found, setFound] = useState<{ institutionId: string; institutionName: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string>();

  useEffect(() => {
    if (!open || !session) return;
    setFullName(session.fullName);
    setOrganisationName(session.organisationName ?? "");
    setError(undefined);
    setJoinCode("");
    setFound(null);
    setConsent(false);
    setConfirmDelete(false);
    setPassword("");
    setDeleteError(undefined);
  }, [open, session]);

  if (!session) return null;
  const institutional = session.accountType === "institutional";

  async function save() {
    if (!session) return;
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (institutional && organisationName.trim().length < 2) return setError("Enter your organisation name.");
    setSaving(true);
    try {
      await updateAccountDetails(session.uid, { fullName, ...(institutional ? { organisationName } : {}) }, session.institutionId);
      toast.success("Account details updated.");
      onOpenChange(false);
    } catch {
      toast.error("Could not update your account.");
    } finally {
      setSaving(false);
    }
  }

  async function findCode() {
    setSharingBusy(true);
    try {
      const inst = await lookupJoinCode(joinCode);
      setFound(inst);
      if (!inst) toast.error("No institution found for that code.");
    } catch {
      toast.error("Could not check the code.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function share() {
    if (!found || !candidate || !session) return;
    setSharingBusy(true);
    try {
      await grantSharing(
        {
          user: session,
          applications: candidate.applications,
          latestDiagnosis: candidate.latestDiagnosis,
          actions: candidate.currentActions,
          latestEvaluation: candidate.latestEvaluation,
          today: todayLocal(),
        },
        found,
      );
      toast.success(`Sharing your summary with ${found.institutionName}.`);
      setFound(null);
      setJoinCode("");
    } catch {
      toast.error("Could not start sharing.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function stopSharing() {
    if (!session) return;
    setSharingBusy(true);
    try {
      await withdrawSharing(session);
      toast.success("Sharing withdrawn. Your summary has been removed.");
    } catch {
      toast.error("Could not withdraw sharing.");
    } finally {
      setSharingBusy(false);
    }
  }

  async function exportData() {
    if (!session) return;
    try {
      const data = await exportUserData(session);
      downloadText(`rootcause-export-${todayLocal()}.json`, JSON.stringify(data, null, 2), "application/json");
      if (candidate?.applications.length) downloadText(`rootcause-applications-${todayLocal()}.csv`, applicationsToCsv(candidate.applications, candidate.cvLabel));
      toast.success("Your data has been downloaded.");
    } catch {
      toast.error("Export failed.");
    }
  }

  async function remove() {
    if (!session) return;
    if (!password) return setDeleteError("Enter your password to confirm.");
    setSaving(true);
    try {
      await deleteAccountAndData(session, password);
      toast.success("Your account and all its data have been deleted.");
      navigate("/");
    } catch (err) {
      setDeleteError(accountErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            {session.email} · {institutional ? "Institutional" : "Candidate"} account
            {session.createdAt ? ` · created ${formatDate(session.createdAt.toDate().toISOString())}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Full name</Label>
            <Input id="acc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {institutional && (
            <div className="space-y-2">
              <Label htmlFor="acc-org">Organisation name</Label>
              <Input id="acc-org" value={organisationName} onChange={(e) => setOrganisationName(e.target.value)} />
            </div>
          )}
          <FieldError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </DialogFooter>

        {!institutional && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Building2 className="h-4 w-4" /> Share with a careers service
              </p>
              {session.sharing ? (
                <div className="rounded-lg border bg-teal-soft p-3 text-sm">
                  <p>
                    Sharing a summary with <span className="font-semibold">{session.sharing.institutionName}</span>
                    {session.sharing.consentedAt ? ` since ${formatDate(session.sharing.consentedAt.toDate().toISOString())}` : ""}.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={stopSharing} disabled={sharingBusy}>
                    <Unlink /> Withdraw sharing
                  </Button>
                </div>
              ) : !found ? (
                <div className="flex gap-2">
                  <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Join code, e.g. K7M2QX9P" maxLength={8} />
                  <Button variant="outline" onClick={findCode} disabled={joinCode.trim().length !== 8 || sharingBusy}>
                    Find
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border p-3 text-sm">
                  <p>
                    Share your progress summary with <span className="font-semibold">{found.institutionName}</span>?
                  </p>
                  <p className="text-muted-foreground">
                    They will see your name, target role, application, interview and offer counts, monthly activity, your diagnosed causes and rationale,
                    and the titles and statuses of your actions. They will <span className="font-medium">not</span> see your CV, job descriptions or
                    feedback text. You can withdraw at any time.
                  </p>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>I consent to sharing this summary with {found.institutionName}.</span>
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={share} disabled={!consent || sharingBusy}>
                      <Share2 /> Share summary
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFound(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Download everything you have stored. <Link to="/privacy" className="text-primary hover:underline" onClick={() => onOpenChange(false)}>Privacy notice</Link>
            </p>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download /> Export my data
            </Button>
          </div>
          {!confirmDelete ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Permanently delete your account and all of its data.</p>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete account
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-900">
                This deletes your account
                {institutional ? ", your institution, its join code and all shared summaries" : " and every CV file, application, diagnosis, action and roadmap step"}. It
                cannot be undone.
              </p>
              <PasswordInput placeholder="Confirm your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <FieldError message={deleteError} />
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={remove} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Delete everything
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Keep account
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
