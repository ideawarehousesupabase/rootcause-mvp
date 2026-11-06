import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { cvFileKind, extractCvText, extractDocx, pdfItemsToText } from "./cvExtract";

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

  it("rebuilds lines from PDF text runs", () => {
    const items = [
      { str: "EXPERIENCE", hasEOL: true, transform: [1, 0, 0, 1, 50, 700] },
      { str: "- Built a ", transform: [1, 0, 0, 1, 50, 680] },
      { str: "model", transform: [1, 0, 0, 1, 120, 680] },
      { str: "SKILLS", transform: [1, 0, 0, 1, 50, 640] },
    ];
    expect(pdfItemsToText(items)).toBe("EXPERIENCE\n- Built a model\nSKILLS");
  });

  it("explains unsupported files", async () => {
    await expect(extractCvText(new File(["x"], "cv.doc"))).rejects.toThrow(/\.docx/);
  });
});
