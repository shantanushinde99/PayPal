"use client";
import { useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { btn } from "@/components/ui";

const MAX_SIDE = 1600;

// Downscale in the browser so uploads stay small; the server re-validates.
async function toJpegDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function PhotoPicker({ name, label, initial = "" }: { name: string; label: string; initial?: string }) {
  const [src, setSrc] = useState(initial);
  const [error, setError] = useState("");
  const id = `${name}-input`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <label htmlFor={id} className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-canvas transition-colors hover:border-brand/50">
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt={`${label} preview`} className="size-full object-cover" />
          : <span className="flex flex-col items-center gap-1 text-sm text-ink-soft"><ImagePlus aria-hidden className="size-6" />Choose photo</span>}
      </label>
      <input id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try { setError(""); setSrc(await toJpegDataUrl(file)); } catch { setError("Couldn't read that image. Try a JPEG or PNG."); }
      }} />
      <input type="hidden" name={name} value={src} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function PhotoProofForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoPicker name="beforePhoto" label="Before" />
        <PhotoPicker name="afterPhoto" label="After" />
      </div>
      <p className="text-sm text-ink-soft">Take both photos from the same spot so the AI can compare them.</p>
      <SubmitButton className={btn.primary} pending="Uploading…"><Camera aria-hidden className="size-4" /> Submit photos for AI check</SubmitButton>
    </form>
  );
}
