import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { cvFileKind, docxHtmlToText, extractCvText, extractDocx, pdfItemsToText } from "./cvExtract";

async function makeDocx(paragraphs: string[]) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("CV file extraction", () => {
  it("recognises the supported file types", () => {
    expect(cvFileKind("cv.pdf")).toBe("pdf");
    expect(cvFileKind("CV.DOCX")).toBe("docx");
    expect(cvFileKind("cv.txt")).toBe("text");
    expect(cvFileKind("cv.doc")).toBeNull();
  });

  it("reads plain-text files", async () => {
    const text = await extractCvText(new File(["EXPERIENCE\n- Built a tracker"], "cv.txt", { type: "text/plain" }));
    expect(text).toContain("Built a tracker");
  });

  it("reads Word (.docx) files", async () => {
    const text = await extractDocx(await makeDocx(["PERSONAL STATEMENT", "Finance graduate.", "EXPERIENCE", "- Reduced invoice errors by 25%."]));
    expect(text).toContain("Finance graduate.");
    expect(text).toContain("Reduced invoice errors by 25%.");
  });

  it("keeps Word list items as bullets and table cells apart", () => {
    const html =
      "<h2>EXPERIENCE</h2><table><tr><td><p>Data Intern</p></td><td><p>Jun 2024 – Aug 2024</p></td></tr></table>" +
      "<ul><li>Cut report time by 30% &amp; automated checks.</li><li>Built a &lt;SQL&gt; model.</li></ul><p>SKILLS</p>";
    expect(docxHtmlToText(html)).toBe("EXPERIENCE\nData Intern | Jun 2024 – Aug 2024\n\n• Cut report time by 30% & automated checks.\n• Built a <SQL> model.\nSKILLS");
  });

  it("rebuilds lines from PDF text runs", () => {
    const items = [
      { str: "EXPERIENCE", hasEOL: true, transform: [1, 0, 0, 1, 50, 700] },
      { str: "- Built a ", transform: [1, 0, 0, 1, 50, 680] },
      { str: "model", transform: [1, 0, 0, 1, 120, 680] },
      { str: "SKILLS", transform: [1, 0, 0, 1, 50, 640] },
    ];
    expect(pdfItemsToText(items)).toBe("EXPERIENCE\n- Built a model\nSKILLS");
  });

  it("separates text runs on one line that are far apart, such as right-aligned dates", () => {
    const items = [
      { str: "Software Intern", transform: [10, 0, 0, 10, 50, 600], width: 80 },
      { str: "Jun 2024 – Aug 2024", transform: [10, 0, 0, 10, 450, 600], width: 90 },
      { str: "Acme", transform: [10, 0, 0, 10, 50, 585], width: 25 },
      { str: "Ltd", transform: [10, 0, 0, 10, 78, 585], width: 15 },
    ];
    expect(pdfItemsToText(items)).toBe("Software Intern | Jun 2024 – Aug 2024\nAcme Ltd");
  });

  it("explains unsupported files", async () => {
    await expect(extractCvText(new File(["x"], "cv.doc"))).rejects.toThrow(/\.docx/);
  });
});
