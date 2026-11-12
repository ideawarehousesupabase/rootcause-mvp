import { describe, expect, it } from "vitest";
import { advertApiFor } from "./atsApis";
import { isPrivateAddress } from "./fetchPage";
import { htmlToText, parseJobAdvert } from "./jobPosting";
import { checkJobUrl, portalFor } from "./portals";
import { POST } from "../read-job-advert";

const page = (jsonLd: unknown, extra = "") =>
  `<html><head><title>Advert</title><script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${extra}</head><body></body></html>`;

describe("parseJobAdvert", () => {
  it("reads a schema.org JobPosting", () => {
    const advert = parseJobAdvert(
      page({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Graduate Financial Analyst",
        hiringOrganization: { "@type": "Organization", name: "Halden &amp; Rowe" },
        jobLocation: { "@type": "Place", address: { addressLocality: "Leeds", addressRegion: "West Yorkshire", addressCountry: "GB" } },
        description: "<p>Join our FP&amp;A team.</p><ul><li>Strong Excel</li><li>2:1 degree</li></ul>",
        datePosted: "2026-10-01T09:00:00Z",
        employmentType: "FULL_TIME",
      }),
    );
    expect(advert).toEqual({
      title: "Graduate Financial Analyst",
      employer: "Halden & Rowe",
      location: "Leeds, West Yorkshire",
      description: "Join our FP&A team.\n\n• Strong Excel\n• 2:1 degree",
      datePosted: "2026-10-01",
      employmentType: "FULL_TIME",
      method: "structured-data",
    });
  });

  it("finds the posting inside @graph, with entity-encoded HTML and remote work", () => {
    const advert = parseJobAdvert(
      page({
        "@graph": [
          { "@type": "WebPage", name: "x" },
          {
            "@type": ["JobPosting"],
            title: "Data Analyst",
            hiringOrganization: "Northgate Health",
            jobLocationType: "TELECOMMUTE",
            description: "&lt;p&gt;Use SQL &amp;amp; Power BI&lt;/p&gt;",
          },
        ],
      }),
    );
    expect(advert?.title).toBe("Data Analyst");
    expect(advert?.employer).toBe("Northgate Health");
    expect(advert?.location).toBe("Remote");
    expect(advert?.description).toBe("Use SQL & Power BI");
  });

  it("falls back to the page's title and description tags", () => {
    const summary = "Work with operations teams to map processes, gather requirements and improve reporting across the business.";
    const html = `<html><head><meta property="og:title" content="Junior Business Analyst"><meta name="description" content="${summary}"></head></html>`;
    expect(parseJobAdvert(html)).toMatchObject({ title: "Junior Business Analyst", description: summary, method: "page-tags" });
    // A one-line summary such as a location is not enough.
    expect(parseJobAdvert(`<meta property="og:title" content="Analyst"><meta name="description" content="London; Remote (UK)">`)).toBeNull();
  });

  it("ignores sign-in walls, broken JSON and pages without job details", () => {
    expect(parseJobAdvert(`<meta property="og:title" content="LinkedIn Login, Sign in"><meta name="description" content="Sign in to see jobs">`)).toBeNull();
    expect(parseJobAdvert(`<script type="application/ld+json">{not json</script>`)).toBeNull();
    expect(parseJobAdvert(page({ "@type": "Organization", name: "Reed" }))).toBeNull();
    const listing = `<meta property="og:title" content="Ideaforge Careers and Jobs | Webbtree"><meta name="description" content="See all the open positions at Ideaforge. Apply to Ideaforge Jobs Now! Build a successful career in Ideaforge">`;
    expect(parseJobAdvert(listing)).toBeNull();
  });
});

describe("htmlToText", () => {
  it("drops scripts and tags and decodes entities", () => {
    expect(htmlToText("<script>x()</script><p>Salary &pound;30,000&nbsp;&ndash; &#163;35,000</p>")).toBe("Salary £30,000 – £35,000");
  });
});

describe("supported portals and safe addresses", () => {
  it("accepts only supported portals", () => {
    expect(portalFor("www.reed.co.uk")?.name).toBe("Reed");
    expect(portalFor("boards.greenhouse.io")?.name).toBe("Greenhouse");
    expect(portalFor("uk.indeed.com")?.mayBlock).toBe(true);
    expect(portalFor("notreed.co.uk")).toBeNull();
    expect(portalFor("reed.co.uk.evil.example")).toBeNull();
    expect("error" in checkJobUrl("ftp://www.reed.co.uk/jobs/1")).toBe(true);
    expect("error" in checkJobUrl("https://user:pass@www.reed.co.uk/jobs/1")).toBe(true);
    expect("error" in checkJobUrl("https://www.reed.co.uk/jobs/analyst/123")).toBe(false);
  });

  it("accepts adverts on any public website, named after the site", () => {
    const checked = checkJobUrl("https://app.webbtree.com/company/ideaforge/jobs/project-management-intern-effb09df");
    expect("error" in checked ? checked.error : checked.portal.name).toBe("webbtree.com");
    const careers = checkJobUrl("https://careers.example-company.co.uk/jobs/123");
    expect("error" in careers ? careers.error : careers.portal.name).toBe("example-company.co.uk");
    for (const bad of ["http://localhost/jobs", "http://127.0.0.1/x", "http://[::1]/x", "http://intranet/jobs", "http://printer.local/", "https://example.com:8443/jobs"]) {
      expect("error" in checkJobUrl(bad)).toBe(true);
    }
  });

  it("refuses internal network addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.69", "2a00:1450:4009:81f::200e"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("job board APIs", () => {
  it("reads Greenhouse adverts through the Greenhouse job API", () => {
    const api = advertApiFor(new URL("https://job-boards.greenhouse.io/monzo/jobs/8281171"))!;
    expect(api.apiUrl).toBe("https://boards-api.greenhouse.io/v1/boards/monzo/jobs/8281171");
    expect(
      api.parse({ title: "Analytics Engineer", company_name: "Monzo", location: { name: "London" }, content: "&lt;p&gt;Build models&lt;/p&gt;", first_published: "2026-11-09T04:08:37-05:00" }),
    ).toEqual({ title: "Analytics Engineer", employer: "Monzo", location: "London", description: "Build models", datePosted: "2026-11-09", employmentType: null, method: "structured-data" });
    expect(advertApiFor(new URL("https://boards.greenhouse.io/embed/job_app?for=acme&token=123"))?.apiUrl).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/123");
  });

  it("reads Lever adverts through the Lever postings API", () => {
    const api = advertApiFor(new URL("https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b"))!;
    expect(api.apiUrl).toBe("https://api.lever.co/v0/postings/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b");
    const advert = api.parse({
      text: "Account Executive",
      categories: { location: "London", commitment: "Permanent" },
      descriptionPlain: "Sell to businesses.",
      lists: [{ text: "What you'll do", content: "<li>Find new clients</li>" }],
      createdAt: Date.UTC(2026, 10, 1),
    });
    expect(advert).toMatchObject({ title: "Account Executive", employer: "Spotify", location: "London", employmentType: "Permanent", datePosted: "2026-11-01" });
    expect(advert?.description).toBe("Sell to businesses.\n\nWhat you'll do\n• Find new clients");
  });

  it("leaves other links to the page reader", () => {
    expect(advertApiFor(new URL("https://www.reed.co.uk/jobs/analyst/1"))).toBeNull();
    expect(advertApiFor(new URL("https://jobs.lever.co/spotify"))).toBeNull();
  });
});

describe("portal page readers", () => {
  it("reads an NHS Jobs advert from its page layout", () => {
    const html = `<main><h1 id="heading">Data Analyst</h1><h2 id="employer_name">InHealth Group</h2>
      <div id="job_overview"><h3>Job summary</h3><p>Use data to improve care.</p></div>
      <div id="job_description_large"><div><p>Build dashboards.</p><ul><li>SQL</li></ul></div></div>
      <p id="employer_town">Middlewich</p><p id="date_posted">28 October 2026</p><p id="contract_type">Permanent</p></main>`;
    expect(parseJobAdvert(html, "NHS Jobs")).toEqual({
      title: "Data Analyst",
      employer: "InHealth Group",
      location: "Middlewich",
      description: "Job summary\nUse data to improve care.\n\nBuild dashboards.\n\n• SQL",
      datePosted: "2026-10-28",
      employmentType: "Permanent",
      method: "page-tags",
    });
  });
});

describe("POST /api/read-job-advert", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    POST(new Request("https://rootcause.example/api/read-job-advert", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));

  it("rejects missing links, private addresses and other websites' pages", async () => {
    expect((await post({})).status).toBe(400);
    const local = await post({ url: "http://127.0.0.1/admin" });
    expect(local.status).toBe(400);
    expect(((await local.json()) as { error: { message: string } }).error.message).toMatch(/public website/);
    expect((await post({ url: "https://www.reed.co.uk/jobs/1" }, { origin: "https://elsewhere.example" })).status).toBe(400);
  });
});
