import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// All Firebase settings come from .env (see .env.example).
// Accounts and all user data are Cloud Firestore documents (no Firebase Authentication).
// Job advert links are read by a Vercel Function (api/read-job-advert.ts), not Firebase.
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const port = (value: string | undefined, fallback: number) => Number(value ?? fallback);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Offline persistence: changes made offline sync when the connection returns.
function createDb(): Firestore | null {
  if (!app) return null;
  try {
    const firestore = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (usingEmulators) connectFirestoreEmulator(firestore, "127.0.0.1", port(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT, 8080));
    return firestore;
  } catch {
    // Already initialised (e.g. this module was hot-reloaded during development).
    return getFirestore(app);
  }
}

export const db = createDb();

export function requireDb(): Firestore {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}
