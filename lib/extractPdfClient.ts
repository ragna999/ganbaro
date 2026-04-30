import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

let workerSet = false;

function ensureWorker() {
  if (workerSet) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerSet = true;
}

export async function extractPdfText(
  file: File,
  maxChars = 6000
): Promise<{ text: string; pages: number }> {
  ensureWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => item.str)
      .join(" ");
    text += pageText + "\n";
    if (text.length >= maxChars) break;
  }

  return { text: text.slice(0, maxChars), pages: pdf.numPages };
}
