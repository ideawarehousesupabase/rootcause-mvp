// Job advert links. Any public job site can be read; the sites named here get a friendlier name
// and, for those that often block automated reading, a clearer message when they do.
// Shared by the advert reader (api/read-job-advert.ts) and the web app, which checks a link before sending it.

export interface Portal {
  name: string;
  /** The site's domain; subdomains match too. */
  domains: string[];
  /** The site often blocks automated reading. */
  mayBlock?: boolean;
}

export const PORTALS: Portal[] = [
  { name: "Reed", domains: ["reed.co.uk"] },
  { name: "Totaljobs", domains: ["totaljobs.com"] },
  { name: "CV-Library", domains: ["cv-library.co.uk"] },
  { name: "Guardian Jobs", domains: ["jobs.theguardian.com"] },
  { name: "NHS Jobs", domains: ["jobs.nhs.uk"] },
  { name: "Civil Service Jobs", domains: ["civilservicejobs.service.gov.uk"] },
  { name: "Greenhouse", domains: ["greenhouse.io"] },
  { name: "Lever", domains: ["lever.co"] },
  { name: "Workable", domains: ["workable.com"] },
  { name: "Ashby", domains: ["ashbyhq.com"] },
  { name: "SmartRecruiters", domains: ["smartrecruiters.com"] },
  { name: "LinkedIn", domains: ["linkedin.com"], mayBlock: true },
  { name: "Indeed", domains: ["indeed.com", "indeed.co.uk"], mayBlock: true },
];

/** A known job site, or null for any other site. */
export function portalFor(hostname: string): Portal | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PORTALS.find((p) => p.domains.some((d) => host === d || host.endsWith(`.${d}`))) ?? null;
}

/** The site's own name for a link that isn't a known job site, e.g. "app.webbtree.com" → "webbtree.com". */
function siteName(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^(app|jobs|careers|apply|boards)\./, "");
}

/** A readable advert link, or a reason it can't be used. */
export function checkJobUrl(raw: string): { url: URL; portal: Portal } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "Enter the full link to the job advert, starting with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "Enter a web link starting with https://" };
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) return { error: "That link can't be read." };
  // Public websites only: no IP addresses, no local or single-word host names.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[") || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) {
    return { error: "Enter the link to a job advert on a public website." };
  }
  const portal = portalFor(host) ?? { name: siteName(host), domains: [host] };
  return { url, portal };
}
