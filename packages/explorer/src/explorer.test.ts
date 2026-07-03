import { describe, test, expect } from "vitest";
import { parseAccessibilityXml, extractInteractiveElements, rankElements } from "./accessibility.js";
import { fingerprintScreen } from "./fingerprint.js";

const SAMPLE_XML = `
<?xml version="1.0" encoding="utf-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,0][1080,1920]" clickable="false" enabled="true">
    <node index="0" text="Submit" resource-id="com.example.app:id/btn_submit" class="android.widget.Button" package="com.example.app" bounds="[100,500][980,600]" clickable="true" enabled="true" />
    <node index="1" text="Delete Account" resource-id="com.example.app:id/btn_delete" class="android.widget.Button" package="com.example.app" bounds="[100,700][980,800]" clickable="true" enabled="true" />
    <node index="2" text="Settings" resource-id="com.example.app:id/nav_settings" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,1800][200,1920]" clickable="true" enabled="true" />
  </node>
</hierarchy>
`;

describe("Explorer Accessibility & Ranking", () => {
  test("parses UI Automator XML correctly", () => {
    const nodes = parseAccessibilityXml(SAMPLE_XML);
    expect(nodes.length).toBeGreaterThan(0);
    const submitNode = nodes.find(n => n.text === "Submit");
    expect(submitNode).toBeDefined();
    expect(submitNode!.clickable).toBe(true);
    expect(submitNode!.bounds.left).toBe(100);
  });

  test("extracts and prioritizes interactive elements", () => {
    const nodes = parseAccessibilityXml(SAMPLE_XML);
    const interactive = extractInteractiveElements(nodes);
    expect(interactive.length).toBe(3);

    const ranked = rankElements(interactive);
    // Settings should be ranked first (navigation)
    expect(ranked[0]!.label).toBe("Settings");
    // Delete Account should be ranked last (destructive)
    expect(ranked[2]!.label).toBe("Delete Account");
  });

  test("fingerprints accessibility nodes", () => {
    const nodes1 = parseAccessibilityXml(SAMPLE_XML);
    const fingerprint1 = fingerprintScreen(nodes1);

    const fingerprint2 = fingerprintScreen(nodes1);
    expect(fingerprint1).toBe(fingerprint2);
  });
});
