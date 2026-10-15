/** Mirrors ALLOWED_EXTENSIONS in backend/app/storage/validation.py, grouped for display. */
export const ACCEPTED_GROUPS = {
  Video: ["mp4", "mov", "m4v", "3gp", "webm", "mkv", "avi"],
  Audio: ["mp3", "m4a", "wav", "aac", "ogg", "opus", "oga", "flac", "aiff", "aif", "amr"],
  Images: ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif"],
  Documents: ["pdf", "docx", "xlsx"],
  "Logs & data": ["csv", "json", "txt", "log", "md"],
} as const;

export const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_GROUPS).flat();

/**
 * Value for the file input's accept attribute. The broad MIME families make phones offer their
 * recorder, camera and photo library; the extensions cover desktop pickers.
 */
export const ACCEPT_ATTRIBUTE = ["audio/*", "video/*", "image/*", ...ACCEPTED_EXTENSIONS.map((e) => `.${e}`)].join(",");
export const MAX_UPLOAD_MB = 50;

/** Quick checks before sending a file. The API repeats them against the actual bytes. */
export function checkUpload(file: { name: string; size: number } | null): string | null {
  if (!file || !file.name) return "Choose a file to upload.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Files must be ${MAX_UPLOAD_MB} MB or smaller.`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `.${ext || "?"} files are not accepted. Use video, audio, images, PDF, Word, Excel, CSV, JSON or text.`;
  }
  return null;
}
