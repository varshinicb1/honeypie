import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";

interface SimpleImage {
  width: number;
  height: number;
  data: Buffer; // Raw RGBA bytes
}

/**
 * Decodes a PNG buffer into raw RGBA pixels using native Node zlib.
 */
export function decodePng(buffer: Buffer): SimpleImage {
  // Check PNG signature
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (width === 0 || height === 0) {
    throw new Error("Invalid PNG dimensions");
  }

  // Concatenate and inflate IDAT data
  const compressed = Buffer.concat(idatChunks);
  const inflated = inflateSync(compressed);

  // PNG filter types are at the start of each scanline (row).
  // For colorType 6 (RGBA) with 8-bit depth: each pixel is 4 bytes.
  // Row width in bytes = 1 (filter type) + width * 4.
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = 1 + width * bytesPerPixel;
  const decompressed = Buffer.alloc(width * height * 4); // Target: RGBA always

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    const filterType = inflated[rowStart]!;
    let prevRowStart = (y - 1) * stride;

    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * bytesPerPixel;
      const targetIdx = (y * width + x) * 4;

      let r = 0, g = 0, b = 0, a = 255;

      // Extract raw bytes before filtering (ignoring complex filter types for basic hash)
      if (bytesPerPixel === 4) {
        r = inflated[idx]!;
        g = inflated[idx + 1]!;
        b = inflated[idx + 2]!;
        a = inflated[idx + 3]!;
      } else if (bytesPerPixel === 3) {
        r = inflated[idx]!;
        g = inflated[idx + 1]!;
        b = inflated[idx + 2]!;
      } else {
        r = g = b = inflated[idx]!;
      }

      // Reconstruct filters minimally
      if (filterType === 1 && x > 0) { // Sub
        r = (r + decompressed[targetIdx - 4]!) & 0xff;
        g = (g + decompressed[targetIdx - 3]!) & 0xff;
        b = (b + decompressed[targetIdx - 2]!) & 0xff;
        a = (a + decompressed[targetIdx - 1]!) & 0xff;
      } else if (filterType === 2 && y > 0) { // Up
        const upIdx = ((y - 1) * width + x) * 4;
        r = (r + decompressed[upIdx]!) & 0xff;
        g = (g + decompressed[upIdx + 1]!) & 0xff;
        b = (b + decompressed[upIdx + 2]!) & 0xff;
        a = (a + decompressed[upIdx + 3]!) & 0xff;
      }

      decompressed[targetIdx] = r;
      decompressed[targetIdx + 1] = g;
      decompressed[targetIdx + 2] = b;
      decompressed[targetIdx + 3] = a;
    }
  }

  return { width, height, data: decompressed };
}

/**
 * Computes an average hash (aHash) for a PNG image.
 */
export function computeAverageHash(buffer: Buffer): string {
  try {
    const img = decodePng(buffer);
    
    // Resize to 8x8 by simple downsampling
    const gray = new Uint8Array(64);
    const cellW = img.width / 8;
    const cellH = img.height / 8;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        // Average the pixels in this cell
        let sum = 0;
        let count = 0;
        const startY = Math.floor(row * cellH);
        const endY = Math.floor((row + 1) * cellH);
        const startX = Math.floor(col * cellW);
        const endX = Math.floor((col + 1) * cellW);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * img.width + x) * 4;
            const r = img.data[idx]!;
            const g = img.data[idx + 1]!;
            const b = img.data[idx + 2]!;
            // Convert to grayscale using standard luminance formula
            sum += 0.299 * r + 0.587 * g + 0.114 * b;
            count++;
          }
        }
        gray[row * 8 + col] = count > 0 ? sum / count : 0;
      }
    }

    // Compute average value
    const avg = gray.reduce((a, b) => a + b, 0) / 64;

    // Generate 64-bit hash (1 if value >= average, 0 otherwise)
    let hashStr = "";
    for (let i = 0; i < 64; i += 8) {
      let byteVal = 0;
      for (let j = 0; j < 8; j++) {
        if (gray[i + j]! >= avg) {
          byteVal |= (1 << (7 - j));
        }
      }
      hashStr += byteVal.toString(16).padStart(2, "0");
    }

    return hashStr;
  } catch (error) {
    // Fall back to a standard MD5 if PNG decode fails
    return createHash("md5").update(buffer).digest("hex");
  }
}

/**
 * Computes the Hamming distance between two hex hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i]!, 16);
    const val2 = parseInt(hash2[i]!, 16);
    let xor = val1 ^ val2;
    while (xor > 0) {
      if (xor & 1) distance++;
      xor >>= 1;
    }
  }
  return distance;
}
