import { describe, expect, it } from "vitest";
import { listDevices } from "./adb.js";

describe("listDevices", () => {
  it("returns real attached devices, or an empty list if none are attached", async () => {
    const devices = await listDevices();
    if (devices.length === 0) {
      console.warn("skipping assertions: no adb devices attached in this environment");
      return;
    }
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0]).toMatch(/^[\w-]+$/);
  }, 20_000);
});
