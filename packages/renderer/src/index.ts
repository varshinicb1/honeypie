export interface RenderDeviceFrameSvgOptions {
  screenshotPng: Buffer;
  appName: string;
  frameWidthPx?: number;
}

interface PngDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width/height straight out of the PNG IHDR chunk — no image library required. */
export function readPngDimensions(png: Buffer): PngDimensions {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Buffer is not a valid PNG (bad signature)");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  return { width, height };
}

/**
 * Renders a real screenshot inside a simple SVG "device frame" mockup. Deliberately
 * dependency-free (no sharp/canvas/jimp): the screenshot is embedded as a base64 <image>.
 */
export function renderDeviceFrameSvg(options: RenderDeviceFrameSvgOptions): string {
  const { width: pngWidth, height: pngHeight } = readPngDimensions(options.screenshotPng);
  const frameWidth = options.frameWidthPx ?? 360;
  const bezel = 18;
  const captionHeight = 60;
  const screenWidth = frameWidth - bezel * 2;
  const screenHeight = Math.round((screenWidth * pngHeight) / pngWidth);
  const frameHeight = screenHeight + bezel * 2 + captionHeight;
  const cornerRadius = 36;
  const base64Png = options.screenshotPng.toString("base64");
  const title = escapeXml(options.appName);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}" role="img" aria-label="${title} screenshot mockup">
  <rect width="${frameWidth}" height="${frameHeight}" rx="${cornerRadius}" fill="#111827" />
  <rect x="${bezel}" y="${bezel}" width="${screenWidth}" height="${screenHeight}" rx="${cornerRadius - bezel / 2}" fill="#000000" />
  <clipPath id="screen-clip">
    <rect x="${bezel}" y="${bezel}" width="${screenWidth}" height="${screenHeight}" rx="${cornerRadius - bezel / 2}" />
  </clipPath>
  <image
    x="${bezel}"
    y="${bezel}"
    width="${screenWidth}"
    height="${screenHeight}"
    clip-path="url(#screen-clip)"
    preserveAspectRatio="xMidYMid slice"
    href="data:image/png;base64,${base64Png}"
  />
  <text x="${frameWidth / 2}" y="${frameHeight - captionHeight / 2 + 6}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#f97316">${title}</text>
</svg>
`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
