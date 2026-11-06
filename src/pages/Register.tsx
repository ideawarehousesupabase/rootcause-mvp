import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Building2, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/shared";
import { AuthLayout } from "@/components/layout/AuthLayout";
import type { AccountType } from "@/data/types";
import { cn } from "@/lib/utils";
import { accountErrorMessage, register } from "@/services/users";
import { dashboardPathFor, useSession } from "@/store/SessionContext";

type Errors = Partial<Record<"fullName" | "email" | "password" | "confirm" | "organisationName" | "privacy" | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { session, signIn: startSession } = useSession();
  const [accountType, setAccountType] = useState<AccountType>("candidate");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "", organisationName: "" });
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  if (session && !submitting) return <Navigate to={dashboardPathFor(session.accountType)} replace />;

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate(): Errors {
    const e: Errors = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter your full name.";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (form.password.length < 8) e.password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = "Include at least one letter and one number.";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match.";
    if (accountType === "institutional" && form.organisationName.trim().length < 2) e.organisationName = "Enter your organisation name.";
    if (!privacy) e.privacy = "Please confirm you agree before continuing.";
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const uid = await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        accountType,
        organisationName: accountType === "institutional" ? form.organisationName : null,
      });
      startSession(uid);
      toast.success("Account created. Welcome to RootCause Careers.");
      navigate(dashboardPathFor(accountType), { replace: true });
    } catch (err) {
      setErrors({ form: accountErrorMessage(err) });
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start diagnosing your job search with your own evidence.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label>Account type</Label>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {(
              [
                { value: "candidate", label: "Candidate", hint: "Individual job seeker", icon: UserRound },
                { value: "institutional", label: "Institutional", hint: "Careers / employability", icon: Building2 },
              ] as const
            ).map((opt) => (
              <button
                type="button"
                role="radio"
                aria-checked={accountType === opt.value}
                key={opt.value}
                onClick={() => setAccountType(opt.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  accountType === opt.value ? "border-primary bg-blue-50 ring-1 ring-primary" : "hover:bg-muted/60",
                )}
              >
                <opt.icon className={cn("mt-0.5 h-5 w-5", accountType === opt.value ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} />
          <FieldError message={errors.fullName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          <FieldError message={errors.email} />
        </div>
        {accountType === "institutional" && (
          <div className="space-y-2">
            <Label htmlFor="organisationName">Organisation name</Label>
            <Input id="organisationName" value={form.organisationName} onChange={set("organisationName")} placeholder="University Careers Service" />
            <FieldError message={errors.organisationName} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
            <FieldError message={errors.password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput id="confirm" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
            <FieldError message={errors.confirm} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm">
            <input id="privacy" type="checkbox" className="mt-1" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
            <span>
              I agree that RootCause Careers stores my account and the job-search information I enter to provide diagnostics, as described in the{" "}
              <Link to="/privacy" className="font-medium text-primary hover:underline" target="_blank">
                privacy notice
              </Link>
              .
            </span>
          </label>
          <FieldError message={errors.privacy} />
        </div>

        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
