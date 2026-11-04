import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock("tesseract.js", () => ({ createWorker: mocks.createWorker }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }));

import { extractDocuments } from "../lib/documents/extract";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recognize.mockResolvedValue({ data: { text: "프런트엔드 개발자 채용" } });
  mocks.terminate.mockResolvedValue(undefined);
  mocks.createWorker.mockResolvedValue({
    recognize: mocks.recognize,
    terminate: mocks.terminate,
  });
});

it("extracts Korean text from an image with the browser OCR worker", async () => {
  const image = new File(["image"], "job-posting.png", { type: "image/png" });

  await expect(extractDocuments([image])).resolves.toContain("프런트엔드 개발자 채용");
  expect(mocks.createWorker).toHaveBeenCalledWith(
    "kor+eng",
    undefined,
    expect.objectContaining({ logger: expect.any(Function) }),
  );
  expect(mocks.recognize).toHaveBeenCalledWith(image);
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it("uses OCR for PDF pages without a text layer", async () => {
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({})),
  };
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  const page = {
    getTextContent: vi.fn().mockResolvedValue({ items: [] }),
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 400 * scale, height: 600 * scale })),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  };
  const pdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(page) };
  const task = { promise: Promise.resolve(pdf), destroy: vi.fn().mockResolvedValue(undefined) };
  mocks.getDocument.mockReturnValue(task);
  const document = new File(["pdf"], "job-posting.pdf", { type: "application/pdf" });

  await expect(extractDocuments([document])).resolves.toContain("프런트엔드 개발자 채용");
  expect(page.render).toHaveBeenCalledOnce();
  expect(mocks.recognize).toHaveBeenCalledWith(canvas);
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
  expect(mocks.terminate).toHaveBeenCalledOnce();
  expect(task.destroy).toHaveBeenCalledOnce();
});