// Job portals whose advert pages can be read. Shared by the Cloud Function (which enforces it)
// and the web app (which checks a link before sending it).

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

export function portalFor(hostname: string): Portal | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PORTALS.find((p) => p.domains.some((d) => host === d || host.endsWith(`.${d}`))) ?? null;
}

/** A supported advert link, or a reason it can't be used. */
export function checkJobUrl(raw: string): { url: URL; portal: Portal } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "Enter the full link to the job advert, starting with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "Enter a web link starting with https://" };
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) return { error: "That link can't be read." };
  const portal = portalFor(url.hostname);
  if (!portal) return { error: "That site isn't supported yet. Add the application by hand instead." };
  return { url, portal };
}
