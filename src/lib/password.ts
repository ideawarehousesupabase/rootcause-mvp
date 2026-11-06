// Password handling for the Firestore-based login. Passwords are never stored:
// only a salted PBKDF2-SHA256 hash is saved, and login re-derives and compares it.

export const PBKDF2_ITERATIONS = 210_000;

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Document key for an email: its SHA-256 hash, so login records aren't named by readable email addresses. */
export async function emailKey(email: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normaliseEmail(email))));
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { passwordHash: await derive(password, salt, iterations), salt: toHex(salt), iterations, algorithm: "PBKDF2-SHA256" };
}

export async function verifyPassword(password: string, stored: { passwordHash: string; salt: string; iterations: number }) {
  const candidate = await derive(password, fromHex(stored.salt), stored.iterations);
  // Compare every character so timing doesn't reveal how much matched.
  let diff = candidate.length ^ stored.passwordHash.length;
  for (let i = 0; i < Math.max(candidate.length, stored.passwordHash.length); i++) {
    diff |= (candidate.charCodeAt(i) || 0) ^ (stored.passwordHash.charCodeAt(i) || 0);
  }
  return diff === 0;
}
