import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readPngDimensions, renderDeviceFrameSvg } from "./index.js";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/** Builds a minimal valid single-pixel red PNG, byte-for-byte, with no image library. */
function buildTestPng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type: RGB
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const rawRow = Buffer.alloc(1 + width * 3 * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    rawRow[offset] = 0; // filter type: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      rawRow[offset] = 0xff;
      rawRow[offset + 1] = 0x00;
      rawRow[offset + 2] = 0x00;
      offset += 3;
    }
  }
  const idatData = deflateSync(rawRow);

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

describe("readPngDimensions", () => {
  it("reads width/height from a real PNG's IHDR chunk", () => {
    const png = buildTestPng(4, 8);
    expect(readPngDimensions(png)).toEqual({ width: 4, height: 8 });
  });

  it("rejects a buffer with a bad signature", () => {
    expect(() => readPngDimensions(Buffer.from("not a png"))).toThrow(/bad signature/);
  });
});

describe("renderDeviceFrameSvg", () => {
  it("embeds the screenshot and app name in the output SVG", () => {
    const png = buildTestPng(2, 4);
    const svg = renderDeviceFrameSvg({ screenshotPng: png, appName: "HoneyPie <Demo>" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).toContain("HoneyPie &lt;Demo&gt;");
  });
});
