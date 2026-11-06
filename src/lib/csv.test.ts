import { describe, expect, it } from "vitest";
import { autoMap, CSV_MAX_ROWS, missingRequired, parseCsv, parseDate, validateRows } from "./csv";

const header = "job_title,employer,role_family,date_applied,cv_version,status";

describe("CSV import", () => {
  it("parses UK and ISO dates", () => {
    expect(parseDate("03/11/2026")).toBe("2026-11-03");
    expect(parseDate("2026-11-03")).toBe("2026-11-03");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Nov 3")).toBeNull();
  });

  it("maps headers case-insensitively and reports missing required columns", () => {
    const m = autoMap(["Job Title", "EMPLOYER", "Role Family", "Date Applied"]);
    expect(m["Job Title"]).toBe("job_title");
    expect(missingRequired(m)).toEqual(["cv_version"]);
  });

  it("flags invalid enums and missing required fields", () => {
    const p = parseCsv(`${header}\nAnalyst,Acme,Astronaut,2026-09-01,CV v1,Applied\n,Acme,Marketing,2026-09-01,CV v1,Applied\n`);
    const rows = validateRows(p.rows, autoMap(p.headers), { cvLabels: ["CV v1"], existing: [] });
    expect(rows[0].status).toBe("error");
    expect(rows[0].messages[0]).toMatch(/role_family/);
    expect(rows[1].status).toBe("error");
    expect(rows[1].messages.join(" ")).toMatch(/job title/i);
  });

  it("detects duplicates against existing data and within the file", () => {
    const p = parseCsv(`${header}\nAnalyst,Acme,Marketing,01/09/2026,CV v1,Applied\nAnalyst,Acme,Marketing,2026-09-01,CV v1,Applied\nAnalyst,Beta,Marketing,2026-09-02,CV v1,Applied\n`);
    const rows = validateRows(p.rows, autoMap(p.headers), {
      cvLabels: ["CV v1"],
      existing: [{ employer: "Beta", jobTitle: "Analyst", dateApplied: "2026-09-02" }],
    });
    expect(rows.map((r) => r.duplicate)).toEqual([false, true, true]);
    expect(rows[1].include).toBe(false);
  });

  it("flags new CV labels and missing job descriptions as warnings", () => {
    const p = parseCsv(`${header}\nAnalyst,Acme,Marketing,2026-09-01,CV v9,Applied\n`);
    const [row] = validateRows(p.rows, autoMap(p.headers), { cvLabels: ["CV v1"], existing: [] });
    expect(row.status).toBe("warning");
    expect(row.isNewCv).toBe(true);
  });

  it("enforces the row limit", () => {
    const body = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `Analyst,Acme ${i},Marketing,2026-09-01,CV v1,Applied`).join("\n");
    expect(parseCsv(`${header}\n${body}\n`).error).toMatch(/limit/);
  });
});
