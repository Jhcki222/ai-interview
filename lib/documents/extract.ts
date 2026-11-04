"use client";
import { validateFiles, MAX_DOCUMENT_CHARS, MAX_TOTAL_CHARS } from "./limits";
function abortError() {
  return new DOMException("문서 추출을 취소했습니다.", "AbortError");
}
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(abortError());
    signal.addEventListener("abort", cancel, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", cancel);
        if (signal.aborted) reject(abortError());
        else resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", cancel);
        reject(signal.aborted ? abortError() : error);
      },
    );
  });
}
export async function extractDocuments(files: File[], signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  validateFiles(files);
  const output: string[] = [];
  for (const file of files) {
    signal?.throwIfAborted();
    let text = "";
    try {
      if (/\.txt$/i.test(file.name)) text = await abortable(file.text(), signal);
      else if (/\.docx$/i.test(file.name)) {
        const mammoth = await abortable(import("mammoth/mammoth.browser"), signal);
        const arrayBuffer = await abortable(file.arrayBuffer(), signal);
        signal?.throwIfAborted();
        text = (await abortable(mammoth.extractRawText({ arrayBuffer }), signal)).value;
      } else {
        const pdfjs = await abortable(import("pdfjs-dist"), signal);
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const data = await abortable(file.arrayBuffer(), signal);
        signal?.throwIfAborted();
        const task = pdfjs.getDocument({ data });
        const cancel = () => {
          void task.destroy().catch(() => {});
        };
        signal?.addEventListener("abort", cancel, { once: true });
        try {
          const pdf = await abortable(task.promise, signal);
          for (let i = 1; i <= pdf.numPages; i++) {
            signal?.throwIfAborted();
            const page = await abortable(pdf.getPage(i), signal);
            const content = await abortable(page.getTextContent(), signal);
            text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
            if (text.length > MAX_DOCUMENT_CHARS) break;
          }
        } finally {
          signal?.removeEventListener("abort", cancel);
          await task.destroy().catch(() => {});
        }
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError"))
        throw abortError();
      throw new Error(
        `${file.name}: 문서를 읽을 수 없습니다. 암호화 여부나 파일 형식을 확인해 주세요.`,
      );
    }
    signal?.throwIfAborted();
    if (!text.trim())
      throw new Error(
        `${file.name}: 추출 가능한 텍스트가 없습니다. 스캔 PDF는 텍스트로 변환해 주세요.`,
      );
    if (text.length > MAX_DOCUMENT_CHARS)
      throw new Error(
        `${file.name}: 추출 텍스트는 ${MAX_DOCUMENT_CHARS.toLocaleString()}자 이하여야 합니다.`,
      );
    output.push(`[문서: ${file.name}]\n${text.trim()}`);
  }
  signal?.throwIfAborted();
  const result = output.join("\n\n");
  if (result.length > MAX_TOTAL_CHARS) throw new Error("전체 문서 텍스트 제한을 초과했습니다.");
  return result;
}
