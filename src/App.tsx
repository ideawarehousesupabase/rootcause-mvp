import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { CandidateLayout, InstitutionLayout } from "@/components/layout/Layouts";
import { isFirebaseConfigured } from "@/lib/firebase";
import { SessionProvider } from "@/store/SessionContext";
import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import Privacy from "@/pages/Privacy";
import Dashboard from "@/pages/candidate/Dashboard";
import Profile from "@/pages/candidate/Profile";
import Evidence from "@/pages/candidate/Evidence";
import Applications from "@/pages/candidate/Applications";
import Diagnostics from "@/pages/candidate/Diagnostics";
import Actions from "@/pages/candidate/Actions";
import Jobs from "@/pages/candidate/Jobs";
import SkillsCourses from "@/pages/candidate/SkillsCourses";
import Analytics from "@/pages/candidate/Analytics";
import InstitutionDashboard from "@/pages/institution/InstitutionDashboard";

function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Firebase is not configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your Firebase web app settings to a <code>.env</code> file (see <code>.env.example</code>) and restart the dev server:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
          VITE_FIREBASE_API_KEY=…{"\n"}VITE_FIREBASE_AUTH_DOMAIN=…{"\n"}VITE_FIREBASE_PROJECT_ID=…{"\n"}VITE_FIREBASE_APP_ID=…{"\n"}VITE_FIREBASE_MESSAGING_SENDER_ID=…
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Create a Cloud Firestore database and publish <code>firestore.rules</code>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isFirebaseConfigured) return <ConfigError />;
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/app" element={<CandidateLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="applications" element={<Applications />} />
            <Route path="diagnostics" element={<Diagnostics />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="skills" element={<SkillsCourses />} />
            <Route path="actions" element={<Actions />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
          <Route path="/institution" element={<InstitutionLayout />}>
            <Route index element={<InstitutionDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" closeButton />
    </SessionProvider>
  );
}
