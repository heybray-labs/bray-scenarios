export const MEDIA_MAX_BYTES = 500 * 1024;
export const MEDIA_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type MediaAssetDto = {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdBy: number | null;
  createdAt: string;
  usageCount?: number;
  url: string;
};

export function mediaUrl(mediaId: number): string {
  return `/api/media/${mediaId}`;
}

export function validateImageFile(file: File): string | null {
  if (!MEDIA_ALLOWED_MIME.has(file.type)) {
    return "Unsupported image type. Use JPEG, PNG, or WebP.";
  }
  if (file.size <= 0 || file.size > MEDIA_MAX_BYTES) {
    return `Image must be at most ${MEDIA_MAX_BYTES / 1024} KB.`;
  }
  return null;
}

export async function uploadMediaFile(file: File): Promise<MediaAssetDto> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const token = localStorage.getItem("auth_token");
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/media", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // keep statusText
    }
    throw new Error(message);
  }

  return res.json();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
