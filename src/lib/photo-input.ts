const MAX_BASE64 = 3_000_000; // ≈2.2 MB image; the browser resizes to ~1600px before upload

export type Photo = { mimeType: string; data: string };

// Untrusted upload: only accept real image data URLs of a sane size.
export function parsePhoto(dataUrl: string): Photo {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Please upload a JPEG, PNG or WebP photo");
  if (m[2].length > MAX_BASE64) throw new Error("Photo is too large");
  return { mimeType: m[1], data: m[2] };
}
