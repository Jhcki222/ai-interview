export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 15000;
export const MAX_TOTAL_CHARS = 45000;
const supportedDocument = /\.(pdf|docx|txt|png|jpe?g|webp)$/i;
export function validateFiles(files: readonly { name: string; size: number }[]) {
  if (files.length > 3) throw new Error("파일은 최대 3개까지 업로드할 수 있습니다.");
  for (const file of files) {
    if (!supportedDocument.test(file.name))
      throw new Error("PDF, DOCX, TXT, PNG, JPG, WEBP 파일만 지원합니다.");
    if (file.size > MAX_FILE_BYTES) throw new Error("파일당 최대 크기는 5MB입니다.");
    if (file.size === 0) throw new Error("빈 파일은 사용할 수 없습니다.");
  }
}
