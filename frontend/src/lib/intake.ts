export const ACCEPTED_EXTENSIONS = ["mp4", "wav", "mp3", "pdf", "csv", "json", "txt", "png", "jpg"] as const;
export const MAX_UPLOAD_MB = 50;

/** Quick checks before sending a file. The API repeats them against the actual bytes. */
export function checkUpload(file: { name: string; size: number } | null): string | null {
  if (!file || !file.name) return "Choose a file to upload.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Files must be ${MAX_UPLOAD_MB} MB or smaller.`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `This type is not accepted. Use ${ACCEPTED_EXTENSIONS.join(", ").toUpperCase()}.`;
  }
  return null;
}
