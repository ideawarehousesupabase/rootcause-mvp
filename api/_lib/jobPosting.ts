// Reads a job advert page. Most job portals publish the advert as schema.org JobPosting
// structured data (the format search engines use for job listings); that is read first,
// with the page's title and description tags as a fallback.

export interface JobAdvert {
  title: string;
  employer: string;
  location: string;
  description: string;
  datePosted: string | null;
  employmentType: string | null;
  method: "structured-data" | "page-tags";
}

const MAX_DESCRIPTION = 20_000;

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", pound: "£", euro: "€", bull: "•" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Advert HTML to readable plain text, keeping paragraphs and bullet points. */
export function htmlToText(html: string): string {
  // Some portals entity-encode the HTML inside their structured data.
  const source = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  const text = source
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

const clean = (v: unknown): string => (typeof v === "string" ? decodeEntities(v).replace(/\s+/g, " ").trim() : "");
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

type Node = Record<string, unknown>;

function findJobPosting(value: unknown): Node | null {
  for (const item of asArray(value as Node | Node[])) {
    if (!item || typeof item !== "object") continue;
    const types = asArray(item["@type"] as string | string[]);
    if (types.some((t) => typeof t === "string" && t.toLowerCase() === "jobposting")) return item;
    const nested = findJobPosting(item["@graph"]) ?? findJobPosting(item["mainEntity"]);
    if (nested) return nested;
  }
  return null;
}

function locationOf(job: Node): string {
  const places = asArray(job.jobLocation as Node | Node[]).map((place) => {
    const address = (place?.address ?? place) as Node | string;
    if (typeof address === "string") return clean(address);
    const parts = [address?.addressLocality, address?.addressRegion].map(clean).filter(Boolean);
    if (!parts.length) parts.push(clean(address?.addressCountry) || clean((address?.addressCountry as Node)?.name));
    return parts.filter(Boolean).join(", ");
  });
  const unique = [...new Set(places.filter(Boolean))];
  const remote = asArray(job.jobLocationType as string | string[]).some((t) => /telecommute/i.test(String(t)));
  if (remote) unique.push("Remote");
  return unique.slice(0, 3).join(" / ");
}

function employerOf(job: Node): string {
  const org = job.hiringOrganization as Node | string | undefined;
  return typeof org === "string" ? clean(org) : clean(org?.name);
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return clean(tag?.match(/content=["']([^"']*)["']/i)?.[1]);
}

/** The HTML inside the element with this id (same-name nested tags are balanced). */
export function elementHtmlById(html: string, id: string): string | null {
  const open = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i").exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(open.index + open[0].length, m.index);
  }
  return null;
}

const textById = (html: string, id: string) => htmlToText(elementHtmlById(html, id) ?? "");

// Portals that don't publish structured data, read from their page layout.
const PAGE_READERS: Record<string, (html: string) => JobAdvert | null> = {
  "NHS Jobs": (html) => {
    const firstLine = (id: string) => textById(html, id).split("\n")[0].trim();
    const title = firstLine("heading");
    const description = [textById(html, "job_overview"), textById(html, "job_description_large") || textById(html, "job_description")].filter(Boolean).join("\n\n");
    if (!title || !description) return null;
    const posted = textById(html, "date_posted").match(/\d{1,2} \w+ \d{4}/)?.[0];
    const postedDate = posted ? new Date(`${posted} UTC`) : null;
    return {
      title,
      employer: firstLine("employer_name"),
      location: firstLine("employer_town"),
      description: description.slice(0, MAX_DESCRIPTION),
      datePosted: postedDate && !Number.isNaN(postedDate.getTime()) ? postedDate.toISOString().slice(0, 10) : null,
      employmentType: firstLine("contract_type").replace(/^Contract\s*/i, "") || null,
      method: "page-tags",
    };
  },
};

/** The job advert in a page, or null when the page holds none. */
export function parseJobAdvert(html: string, portalName?: string): JobAdvert | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim().replace(/^<!--|-->$/g, "").replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, ""));
    } catch {
      continue;
    }
    const job = findJobPosting(data);
    if (!job) continue;
    const title = clean(job.title);
    if (!title) continue;
    return {
      title,
      employer: employerOf(job),
      location: locationOf(job),
      description: htmlToText(typeof job.description === "string" ? job.description : ""),
      datePosted: clean(job.datePosted).slice(0, 10) || null,
      employmentType: asArray(job.employmentType as string | string[]).map(clean).filter(Boolean).join(", ") || null,
      method: "structured-data",
    };
  }

  const reader = portalName ? PAGE_READERS[portalName] : undefined;
  const fromLayout = reader?.(html);
  if (fromLayout) return fromLayout;

  // Fallback: the page's own title and description tags.
  const title = metaContent(html, "og:title") || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = metaContent(html, "og:description") || metaContent(html, "description");
  // A one-line summary (often just the location) is not an advert.
  if (!title || description.length < 80) return null;
  // Sign-in walls and bot checks are not adverts.
  if (/sign ?in|log ?in|access denied|just a moment|captcha|are you a robot|security check/i.test(title)) return null;
  // Nor are pages listing many jobs.
  if (/careers and jobs|open positions|all (open )?jobs|job openings|current vacancies|search jobs|jobs at /i.test(`${title} ${description}`)) return null;
  return { title, employer: "", location: "", description, datePosted: null, employmentType: null, method: "page-tags" };
}
