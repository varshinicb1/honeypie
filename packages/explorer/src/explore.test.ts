import { describe, expect, it } from "vitest";
import { fingerprintUiXml } from "./explore.js";

const sampleXml = (count: number) =>
  `<hierarchy><node resource-id="count" text="${count}" bounds="[10,20][100,200]" clickable="false" /></hierarchy>`;

describe("fingerprintUiXml", () => {
  it("produces the same fingerprint when only bounds differ", () => {
    const a = fingerprintUiXml('<hierarchy><node resource-id="btn" text="Add" bounds="[0,0][100,50]" clickable="true" /></hierarchy>');
    const b = fingerprintUiXml('<hierarchy><node resource-id="btn" text="Add" bounds="[5,5][105,55]" clickable="true" /></hierarchy>');
    expect(a).toBe(b);
  });

  it("produces a different fingerprint when text content differs", () => {
    const a = fingerprintUiXml(sampleXml(0));
    const b = fingerprintUiXml(sampleXml(1));
    expect(a).not.toBe(b);
  });
});
