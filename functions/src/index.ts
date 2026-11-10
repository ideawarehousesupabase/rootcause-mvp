import { HttpsError, onCall } from "firebase-functions/v2/https";
import { advertApiFor } from "./atsApis";
import { fetchFromPortal, PageError } from "./fetchPage";
import { parseJobAdvert, type JobAdvert } from "./jobPosting";
import { checkJobUrl } from "./portals";

// readJobAdvert: reads one public job advert the user pasted a link to and returns its job
// fields. Nothing is stored here; the web app saves the application to the user's records.

const CODES = { unsupported: "invalid-argument", blocked: "permission-denied", "not-found": "not-found", unavailable: "unavailable", "too-large": "out-of-range" } as const;

export const readJobAdvert = onCall({ region: "europe-west2", timeoutSeconds: 30, memory: "256MiB", maxInstances: 5 }, async (request) => {
  const url = (request.data as { url?: unknown })?.url;
  if (typeof url !== "string" || url.length > 2000) throw new HttpsError("invalid-argument", "Enter the link to a job advert.");
  try {
    // Official job APIs (Greenhouse, Lever) first; the advert page otherwise.
    const checked = checkJobUrl(url);
    const api = "error" in checked ? null : advertApiFor(checked.url);
    if (api && !("error" in checked)) {
      const fromApi = await fetchFromPortal(api.apiUrl, "json")
        .then((r): JobAdvert | null => api.parse(JSON.parse(r.body)))
        .catch(() => null);
      if (fromApi) return { ...fromApi, url: checked.url.toString(), portal: checked.portal.name };
    }
    const page = await fetchFromPortal(url);
    const advert = parseJobAdvert(page.body, page.portal.name);
    if (!advert) {
      throw new HttpsError(page.portal.mayBlock ? "permission-denied" : "not-found", `No job details were found on that ${page.portal.name} page.`, { portal: page.portal.name });
    }
    return { ...advert, url: page.url, portal: page.portal.name };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err instanceof PageError) throw new HttpsError(CODES[err.reason], err.message);
    console.error("readJobAdvert failed", err);
    throw new HttpsError("internal", "The advert could not be read.");
  }
});
