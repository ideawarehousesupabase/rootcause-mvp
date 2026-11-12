import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { checkJobUrl, type Portal } from "./portals.js";

// Fetches one advert page (or an advert API response) safely: supported portals only, never internal addresses,
// a few redirects at most, and a time and size limit.

const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 10_000;

export type FetchFailure = "unsupported" | "blocked" | "not-found" | "unavailable" | "too-large";

export class PageError extends Error {
  constructor(
    readonly reason: FetchFailure,
    message: string,
  ) {
    super(message);
  }
}

export function isPrivateAddress(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

async function assertAllowed(raw: string): Promise<{ url: URL; portal: Portal }> {
  const checked = checkJobUrl(raw);
  if ("error" in checked) throw new PageError("unsupported", checked.error);
  const addresses = await lookup(checked.url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new PageError("unavailable", "That site could not be reached.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new PageError("unsupported", "That link can't be read.");
  return checked;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new PageError("too-large", "That page is too large to read.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** The response body and the portal it came from. `kind` is what the response must be. */
export async function fetchFromPortal(raw: string, kind: "html" | "json" = "html"): Promise<{ body: string; url: string; portal: Portal }> {
  let { url, portal } = await assertAllowed(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; RootCauseCareersBot/1.0; reads one advert a user asked for)",
          accept: kind === "json" ? "application/json" : "text/html,application/xhtml+xml",
          "accept-language": "en-GB,en;q=0.9",
        },
      });
    } catch {
      throw new PageError("unavailable", "The advert page did not respond in time.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      ({ url, portal } = await assertAllowed(new URL(res.headers.get("location")!, url).toString()));
      continue;
    }
    if (/\/(authwall|login|signin|sign-in|uas\/login)/i.test(url.pathname)) throw new PageError("blocked", `${portal.name} asked for a sign-in instead of showing the advert.`);
    if ([401, 403, 429, 999].includes(res.status)) throw new PageError("blocked", `${portal.name} blocked automatic reading of this advert.`);
    if (res.status === 404 || res.status === 410) throw new PageError("not-found", "That advert no longer exists.");
    if (!res.ok) throw new PageError("unavailable", `${portal.name} returned an error (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !(kind === "json" ? /json/i : /html/i).test(type)) throw new PageError("not-found", "That link is not a web page.");
    return { body: await readCapped(res), url: url.toString(), portal };
  }
  throw new PageError("unavailable", "That link redirected too many times.");
}
