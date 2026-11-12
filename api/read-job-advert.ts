import { advertApiFor } from "./_lib/atsApis.js";
import { fetchFromPortal, PageError, type FetchFailure } from "./_lib/fetchPage.js";
import { parseJobAdvert, type JobAdvert } from "./_lib/jobPosting.js";
import { checkJobUrl } from "./_lib/portals.js";

// POST /api/read-job-advert  { url }  →  the advert's job fields, or { error }.
// A Vercel Function: it reads the one public job advert a user pasted a link to and returns
// its job fields. Nothing is stored here; the web app saves the application to Firestore.

const STATUS: Record<FetchFailure | "bad-request" | "no-advert" | "internal", number> = {
  "bad-request": 400,
  unsupported: 400,
  blocked: 422,
  "not-found": 404,
  "no-advert": 422,
  unavailable: 502,
  "too-large": 413,
  internal: 500,
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const fail = (code: keyof typeof STATUS, message: string) => reply({ error: { code, message } }, STATUS[code]);

export async function readAdvert(url: string): Promise<Response> {
  const checked = checkJobUrl(url);
  if ("error" in checked) return fail("unsupported", checked.error);
  try {
    // Official job APIs (Greenhouse, Lever) first; the advert page otherwise.
    const api = advertApiFor(checked.url);
    if (api) {
      const fromApi = await fetchFromPortal(api.apiUrl, "json")
        .then((r): JobAdvert | null => api.parse(JSON.parse(r.body)))
        .catch(() => null);
      if (fromApi) return reply({ ...fromApi, url: checked.url.toString(), portal: checked.portal.name });
    }
    const page = await fetchFromPortal(checked.url.toString());
    const advert = parseJobAdvert(page.body, page.portal.name);
    if (!advert) {
      return page.portal.mayBlock
        ? fail("blocked", `${page.portal.name} didn't show the advert to automatic reading. Fill in the details by hand.`)
        : fail("no-advert", `No job details were found on that ${page.portal.name} page. Check it is the advert itself (not a list of jobs), or fill in the details by hand.`);
    }
    return reply({ ...advert, url: page.url, portal: page.portal.name });
  } catch (err) {
    if (err instanceof PageError) return fail(err.reason, err.message);
    console.error("read-job-advert failed", err);
    return fail("internal", "The advert could not be read.");
  }
}

export async function POST(request: Request): Promise<Response> {
  // Only this app's own pages may use the reader.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail("bad-request", "Not allowed.");
  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return fail("bad-request", "Enter the link to a job advert.");
  }
  if (typeof body?.url !== "string" || !body.url.trim() || body.url.length > 2000) return fail("bad-request", "Enter the link to a job advert.");
  return readAdvert(body.url);
}
