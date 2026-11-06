import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onSnapshot } from "firebase/firestore";
import type { AccountType, UserDoc } from "@/data/types";
import { userRef } from "@/services/paths";
import { normaliseUser } from "@/services/users";

// Session for the Firestore-based login: the signed-in user's id is kept in
// sessionStorage (closing the tab signs out) and their record is read live from Firestore.
const SESSION_KEY = "rc-session";

interface SessionValue {
  /** The signed-in user's Firestore record (live). */
  session: UserDoc | null;
  loading: boolean;
  signIn: (uid: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function readUid(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeUid(uid: string | null) {
  try {
    if (uid) sessionStorage.setItem(SESSION_KEY, uid);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the session lasts until the page reloads.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(readUid);
  const [session, setSession] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    setSession(null);
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      userRef(uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          setSession(normaliseUser(snap.data({ serverTimestamps: "estimate" }) as Partial<UserDoc>));
          setLoading(false);
        } else if (!snap.metadata.fromCache) {
          // Confirmed by the server: the account was deleted, so end the session.
          writeUid(null);
          setUid(null);
          setLoading(false);
        }
      },
      () => {
        setSession(null);
        setLoading(false);
      },
    );
  }, [uid]);

  const signIn = useCallback((id: string) => {
    writeUid(id);
    setUid(id);
  }, []);

  const signOut = useCallback(async () => {
    writeUid(null);
    setUid(null);
  }, []);

  const value = useMemo<SessionValue>(() => ({ session, loading, signIn, signOut }), [session, loading, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function dashboardPathFor(accountType: AccountType) {
  return accountType === "institutional" ? "/institution" : "/app/dashboard";
}
