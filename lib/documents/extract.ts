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
export async function extractDocuments(
  files: File[],
  signal?: AbortSignal,
  onProgress?: (message: string) => void,
): Promise<string> {
  signal?.throwIfAborted();
  validateFiles(files);
  const output: string[] = [];
  type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;
  const ocr = { worker: null as OcrWorker | null };
  const recognizeImage = async (image: File | HTMLCanvasElement) => {
    signal?.throwIfAborted();
    if (!ocr.worker) {
      const { createWorker } = await abortable(import("tesseract.js"), signal);
      ocr.worker = await abortable(
        createWorker("kor+eng", undefined, {
          logger: ({ status, progress }) => {
            if (status === "recognizing text")
              onProgress?.(`이미지에서 글자를 읽고 있습니다 (${Math.round(progress * 100)}%).`);
          },
        }),
        signal,
      );
    }
    const result = await abortable(ocr.worker.recognize(image), signal);
    return result.data.text;
  };

  try {
    for (const file of files) {
      signal?.throwIfAborted();
      let text = "";
      try {
      if (/\.txt$/i.test(file.name)) text = await abortable(file.text(), signal);
      else if (/\.(png|jpe?g|webp)$/i.test(file.name)) text = await recognizeImage(file);
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
            const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
            if (pageText.trim()) text += pageText + "\n";
            else {
              const baseViewport = page.getViewport({ scale: 1 });
              const scale = Math.min(
                1.75,
                2400 / Math.max(baseViewport.width, baseViewport.height),
              );
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              const context = canvas.getContext("2d");
              if (!context) throw new Error("PDF 페이지를 이미지로 변환하지 못했습니다.");
              await abortable(page.render({ canvas, canvasContext: context, viewport }).promise, signal);
              try {
                text += (await recognizeImage(canvas)) + "\n";
              } finally {
                canvas.width = 0;
                canvas.height = 0;
              }
            }
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
          `${file.name}: 문서를 읽을 수 없습니다. 파일 상태나 형식을 확인해 주세요.`,
        );
      }
      signal?.throwIfAborted();
      if (!text.trim())
        throw new Error(`${file.name}: 이미지에서 글자를 찾지 못했습니다. 선명한 파일인지 확인해 주세요.`);
      if (text.length > MAX_DOCUMENT_CHARS)
        throw new Error(
          `${file.name}: 추출 텍스트는 ${MAX_DOCUMENT_CHARS.toLocaleString()}자 이하여야 합니다.`,
        );
      output.push(`[문서: ${file.name}]\n${text.trim()}`);
    }
  } finally {
    await ocr.worker?.terminate().catch(() => {});
  }
  signal?.throwIfAborted();
  const result = output.join("\n\n");
  if (result.length > MAX_TOTAL_CHARS) throw new Error("전체 문서 텍스트 제한을 초과했습니다.");
  return result;
}
