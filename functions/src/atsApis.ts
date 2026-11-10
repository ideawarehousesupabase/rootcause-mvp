import { htmlToText, type JobAdvert } from "./jobPosting";

// Some applicant tracking systems publish each advert through an official public API.
// Where a link belongs to one of them, that API is read instead of the page.

type Json = Record<string, unknown>;

export interface AdvertApi {
  apiUrl: string;
  parse: (data: Json) => JobAdvert | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const titleCase = (slug: string) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function greenhouse(url: URL): AdvertApi | null {
  const eu = url.hostname.includes(".eu.greenhouse.io");
  let board: string | undefined;
  let id: string | undefined;
  const path = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (path) [, board, id] = path;
  else if (url.pathname.startsWith("/embed/job_app")) {
    board = url.searchParams.get("for") ?? undefined;
    id = url.searchParams.get("token") ?? undefined;
  }
  if (!board || !id || !/^\d+$/.test(id)) return null;
  return {
    apiUrl: `https://boards-api${eu ? ".eu" : ""}.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${id}`,
    parse: (d) => {
      const title = str(d.title);
      if (!title) return null;
      return {
        title,
        employer: str(d.company_name) || titleCase(board!),
        location: str((d.location as Json)?.name),
        description: htmlToText(str(d.content)),
        datePosted: str(d.first_published).slice(0, 10) || null,
        employmentType: null,
        method: "structured-data",
      };
    },
  };
}

function lever(url: URL): AdvertApi | null {
  const m = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const [, company, id] = m;
  const eu = url.hostname.includes(".eu.lever.co");
  return {
    apiUrl: `https://api${eu ? ".eu" : ""}.lever.co/v0/postings/${encodeURIComponent(company)}/${id}`,
    parse: (d) => {
      const title = str(d.text);
      if (!title) return null;
      const categories = (d.categories ?? {}) as Json;
      const lists = Array.isArray(d.lists) ? (d.lists as Json[]) : [];
      const description = [
        str(d.descriptionPlain) || htmlToText(str(d.description)),
        ...lists.map((l) => `${str(l.text)}\n${htmlToText(str(l.content))}`),
        str(d.additionalPlain),
      ]
        .filter(Boolean)
        .join("\n\n");
      const created = Number(d.createdAt);
      return {
        title,
        employer: titleCase(company),
        location: str(categories.location),
        description: description.slice(0, 20_000),
        datePosted: Number.isFinite(created) && created > 0 ? new Date(created).toISOString().slice(0, 10) : null,
        employmentType: str(categories.commitment) || null,
        method: "structured-data",
      };
    },
  };
}

export function advertApiFor(url: URL): AdvertApi | null {
  const host = url.hostname.toLowerCase();
  if (/(^|\.)greenhouse\.io$/.test(host) && !host.startsWith("boards-api")) return greenhouse(url);
  if (/^jobs\.(eu\.)?lever\.co$/.test(host)) return lever(url);
  return null;
}
