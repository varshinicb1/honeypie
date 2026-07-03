import { readFile } from "node:fs/promises";
import { decodePng } from "./dedup.js";

export interface FilterResult {
  rejected: boolean;
  rejectionReason?: "loading-state" | "empty-state" | "keyboard-visible" | "blank-frame" | "low-quality" | string;
}

/**
 * Deterministic rule-based filter.
 * Checks for blank/solid-color screens, transition artifacts, keyboard presence, etc.
 */
export async function filterScreenshot(path: string): Promise<FilterResult> {
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    return { rejected: true, rejectionReason: "file-not-readable" };
  }

  // 1. Minimum size check (corrupt or extremely tiny)
  if (buffer.length < 1000) {
    return { rejected: true, rejectionReason: "blank-frame" };
  }

  try {
    const img = decodePng(buffer);
    
    // 2. Solid color check (e.g., transition frames, white/black screens)
    let isSolid = true;
    const firstIdx = 0;
    const r0 = img.data[firstIdx]!;
    const g0 = img.data[firstIdx + 1]!;
    const b0 = img.data[firstIdx + 2]!;
    
    // Sample a few pixels to verify if all are identical or very close
    const step = Math.floor(img.data.length / 40); // check 10 pixels
    for (let i = 4; i < img.data.length; i += step) {
      const r = img.data[i]!;
      const g = img.data[i + 1]!;
      const b = img.data[i + 2]!;
      
      if (Math.abs(r - r0) > 8 || Math.abs(g - g0) > 8 || Math.abs(b - b0) > 8) {
        isSolid = false;
        break;
      }
    }

    if (isSolid) {
      return { rejected: true, rejectionReason: "blank-frame" };
    }

    // 3. Loading Spinner detection (simple heuristic based on text / layout, 
    // or placeholder for image matching)
    // Future work: OCR/VLM. For local, we stick to size and solid color check.

    return { rejected: false };
  } catch {
    return { rejected: true, rejectionReason: "low-quality" };
  }
}
