import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Link2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared";
import { checkJobUrl, PORTALS } from "../../../functions/src/portals";
import { advertErrorMessage, readJobAdvert, type JobAdvert } from "@/services/jobAdverts";

/** Step 1 of "Import from job link": read the advert. The caller then shows the pre-filled application form. */
export function JobLinkDialog({
  open,
  onOpenChange,
  onRead,
  onManual,
  hasCv,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRead: (advert: JobAdvert) => void;
  /** Fill the application in by hand, keeping the link. */
  onManual: (url: string) => void;
  /** Applications record the CV used, so one must exist first. */
  hasCv: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [failed, setFailed] = useState<string>();
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl("");
      setError(undefined);
      setFailed(undefined);
    }
  }, [open]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const checked = checkJobUrl(url);
    if ("error" in checked) return setError(checked.error);
    setError(undefined);
    setFailed(undefined);
    setReading(true);
    try {
      onRead(await readJobAdvert(checked.url.toString()));
    } catch (err) {
      setFailed(advertErrorMessage(err));
    } finally {
      setReading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !reading && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from job link</DialogTitle>
          <DialogDescription>Paste the link to a job advert. The app reads the advert and fills in a new application for you to check and save.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="job-url">Advert link</Label>
            <Input id="job-url" type="url" inputMode="url" placeholder="https://www.reed.co.uk/jobs/…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
            <FieldError message={error} />
          </div>
          <p className="text-xs text-muted-foreground">Supported: {PORTALS.map((p) => p.name).join(", ")}.</p>
          {!hasCv && (
            <Alert variant="info">
              <AlertDescription>
                Add a CV version in{" "}
                <Link to="/app/evidence" className="font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                  Evidence Capture
                </Link>{" "}
                first, so the application can record which CV you sent.
              </AlertDescription>
            </Alert>
          )}
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{failed}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {failed && (
              <Button type="button" variant="outline" onClick={() => onManual(url.trim())}>
                Fill in by hand
              </Button>
            )}
            <Button type="submit" disabled={reading || !url.trim() || !hasCv}>
              {reading ? <Loader2 className="animate-spin" /> : <Link2 />} Read advert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
