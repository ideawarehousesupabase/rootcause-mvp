// Text extraction from uploaded CV files, in the browser. The PDF and Word libraries are
// loaded only when a file of that type is chosen, so they don't slow the first page load.

export type CvFileKind = "pdf" | "docx" | "text";

export const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/plain",
};

export function cvContentType(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return CV_CONTENT_TYPES[ext] ?? null;
}

export function cvFileKind(name: string, type = ""): CvFileKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "docx" || type.includes("wordprocessingml")) return "docx";
  if (ext === "txt" || ext === "md" || type.startsWith("text/")) return "text";
  return null;
}

interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
}

/**
 * Join PDF text runs into lines, starting a new line on an end-of-line flag or a change of baseline.
 * Runs on one line with a wide gap between them (such as dates set at the right margin) are joined with " | ".
 */
export function pdfItemsToText(items: PdfTextItem[]) {
  let out = "";
  let lastY: number | null = null;
  let lastEnd: number | null = null;
  for (const item of items) {
    const y = item.transform?.[5] ?? null;
    const x = item.transform?.[4] ?? null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
    else if (lastEnd !== null && x !== null && !out.endsWith("\n") && item.str.trim()) {
      const size = Math.abs(item.transform?.[0] ?? 10) || 10;
      const gap = x - lastEnd;
      if (gap > size * 2) out += " | ";
      else if (gap > size * 0.15 && !/\s$/.test(out)) out += " ";
    }
    out += item.str;
    if (item.hasEOL) out += "\n";
    if (y !== null) lastY = y;
    lastEnd = x !== null && item.width !== undefined ? x + item.width : null;
  }
  return out
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(pdfItemsToText(content.items as PdfTextItem[]));
  }
  return pages.join("\n\n");
}

export async function extractDocx(data: ArrayBuffer) {
  const mammoth = await import("mammoth");
  // The browser build reads `arrayBuffer`; the Node build (used in tests) reads `buffer`.
  const input = { arrayBuffer: data, buffer: data } as unknown as Parameters<typeof mammoth.extractRawText>[0];
  const result = await mammoth.extractRawText(input);
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}

/** Plain text of a CV file. Throws a readable error for unsupported or unreadable files. */
export async function extractCvText(file: File) {
  const kind = cvFileKind(file.name, file.type);
  if (!kind) throw new Error("Upload a PDF, Word (.docx) or plain-text file. Older .doc files can't be read — save as .docx first.");
  try {
    if (kind === "text") return (await file.text()).trim();
    const data = await file.arrayBuffer();
    return kind === "pdf" ? await extractPdf(data) : await extractDocx(data);
  } catch {
    throw new Error(`Couldn't read the text in ${file.name}. If it is a scanned image, paste the CV text instead.`);
  }
}
