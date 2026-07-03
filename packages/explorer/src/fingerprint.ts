import { createHash } from "node:crypto";
import type { AccessibilityNode } from "./accessibility.js";

/**
 * Creates a structural fingerprint of the screen based on the accessibility tree.
 * Hashing class names, resource-ids, and visible text structure.
 */
export function fingerprintScreen(nodes: AccessibilityNode[]): string {
  const hash = createHash("sha256");
  
  function feedNode(node: AccessibilityNode) {
    hash.update(node.className);
    hash.update(node.resourceId);
    hash.update(node.packageName);
    // Include visible text labels/descriptions but normalize them
    if (node.text) {
      hash.update(node.text.trim());
    }
    if (node.contentDesc) {
      hash.update(node.contentDesc.trim());
    }
    hash.update(node.clickable ? "1" : "0");
    hash.update(node.scrollable ? "1" : "0");
    
    for (const child of node.children) {
      feedNode(child);
    }
  }

  for (const node of nodes) {
    feedNode(node);
  }

  return hash.digest("hex");
}

/**
 * Compares two fingerprints or accessibility node sets to see if they represent
 * the same screen type or screen layout.
 */
export function isSameScreen(fingerprintA: string, fingerprintB: string): boolean {
  return fingerprintA === fingerprintB;
}
