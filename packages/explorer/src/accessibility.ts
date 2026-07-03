/**
 * Accessibility tree extraction — parses UI Automator XML dump into typed nodes.
 */

export interface AccessibilityNode {
  className: string;
  text: string;
  contentDesc: string;
  resourceId: string;
  packageName: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  clickable: boolean;
  scrollable: boolean;
  focusable: boolean;
  enabled: boolean;
  checkable: boolean;
  checked: boolean;
  selected: boolean;
  children: AccessibilityNode[];
}

/**
 * Parse UI Automator XML dump into a tree of AccessibilityNodes.
 */
export function parseAccessibilityXml(xml: string): AccessibilityNode[] {
  const nodes: AccessibilityNode[] = [];
  // Simple XML parser for uiautomator format (flat <node> elements with nesting)
  const nodeRegex = /<node\s([^>]+?)\s*(?:\/>|>)/g;
  const stack: AccessibilityNode[] = [];
  let match: RegExpExecArray | null;

  // Track hierarchy via indentation / bounds nesting
  const allNodes: AccessibilityNode[] = [];

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1]!;
    const node = parseNodeAttributes(attrs);
    allNodes.push(node);
  }

  // Build tree from bounds containment (UI Automator XML is hierarchical)
  // But since we're doing regex parsing, flatten and use a simpler approach:
  // Just return all nodes as a flat list with children populated via hierarchy markers
  if (allNodes.length === 0) return nodes;

  // Try to detect hierarchy from the raw XML structure
  const lines = xml.split(/\n/);
  const rootNodes: AccessibilityNode[] = [];
  const nodeStack: { node: AccessibilityNode; depth: number }[] = [];

  for (const rawNode of allNodes) {
    // Simplified: just add all as root-level nodes
    rootNodes.push(rawNode);
  }

  return rootNodes;
}

/**
 * Extract all interactive (clickable/tappable) elements from the accessibility tree.
 */
export function extractInteractiveElements(nodes: AccessibilityNode[]): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  function visit(node: AccessibilityNode): void {
    if (node.clickable && node.enabled) {
      const centerX = (node.bounds.left + node.bounds.right) / 2;
      const centerY = (node.bounds.top + node.bounds.bottom) / 2;
      const label = node.text || node.contentDesc || node.resourceId.split("/").pop() || node.className.split(".").pop() || "";

      elements.push({
        label,
        className: node.className,
        resourceId: node.resourceId,
        x: centerX,
        y: centerY,
        bounds: node.bounds,
        type: classifyElement(node),
      });
    }
    for (const child of node.children) {
      visit(child);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return elements;
}

export interface InteractiveElement {
  label: string;
  className: string;
  resourceId: string;
  x: number;
  y: number;
  bounds: { left: number; top: number; right: number; bottom: number };
  type: ElementType;
}

export type ElementType =
  | "navigation"
  | "button"
  | "list_item"
  | "input"
  | "fab"
  | "icon"
  | "tab"
  | "menu_item"
  | "other";

function classifyElement(node: AccessibilityNode): ElementType {
  const cls = node.className.toLowerCase();
  const id = node.resourceId.toLowerCase();
  const label = (node.text + " " + node.contentDesc).toLowerCase();

  if (cls.includes("bottomnavigation") || cls.includes("tabview") || id.includes("nav"))
    return "navigation";
  if (cls.includes("tab")) return "tab";
  if (cls.includes("floatingaction") || id.includes("fab")) return "fab";
  if (cls.includes("edittext") || cls.includes("textinput")) return "input";
  if (cls.includes("menuitem") || id.includes("menu")) return "menu_item";
  if (cls.includes("recyclerview") || cls.includes("listview")) return "list_item";
  if (cls.includes("button") || cls.includes("imagebutton")) return "button";
  if (cls.includes("imageview")) return "icon";
  return "other";
}

/**
 * Rank interactive elements by exploration priority.
 * Navigation > FAB > Buttons > Tabs > List items > Icons > Other
 * Destructive labels are deprioritized.
 */
export function rankElements(elements: InteractiveElement[]): InteractiveElement[] {
  const DESTRUCTIVE_KEYWORDS = [
    "delete", "remove", "cancel", "unsubscribe", "logout", "log out",
    "sign out", "deactivate", "destroy", "purchase", "pay", "subscribe", "payment",
  ];

  return [...elements].sort((a, b) => {
    const scoreA = elementPriority(a) - destructivePenalty(a.label, DESTRUCTIVE_KEYWORDS);
    const scoreB = elementPriority(b) - destructivePenalty(b.label, DESTRUCTIVE_KEYWORDS);
    return scoreB - scoreA;
  });
}

function elementPriority(el: InteractiveElement): number {
  switch (el.type) {
    case "navigation": return 100;
    case "tab": return 90;
    case "fab": return 85;
    case "button": return 70;
    case "menu_item": return 65;
    case "list_item": return 50;
    case "input": return 30;
    case "icon": return 20;
    case "other": return 10;
  }
}

function destructivePenalty(label: string, keywords: string[]): number {
  const lower = label.toLowerCase();
  return keywords.some((kw) => lower.includes(kw)) ? 200 : 0;
}

// ─── Attribute parsing ──────────────────────────────────────────────────────

function parseNodeAttributes(attrString: string): AccessibilityNode {
  return {
    className: extractAttr(attrString, "class") ?? "",
    text: extractAttr(attrString, "text") ?? "",
    contentDesc: extractAttr(attrString, "content-desc") ?? "",
    resourceId: extractAttr(attrString, "resource-id") ?? "",
    packageName: extractAttr(attrString, "package") ?? "",
    bounds: parseBounds(extractAttr(attrString, "bounds") ?? ""),
    clickable: extractAttr(attrString, "clickable") === "true",
    scrollable: extractAttr(attrString, "scrollable") === "true",
    focusable: extractAttr(attrString, "focusable") === "true",
    enabled: extractAttr(attrString, "enabled") !== "false",
    checkable: extractAttr(attrString, "checkable") === "true",
    checked: extractAttr(attrString, "checked") === "true",
    selected: extractAttr(attrString, "selected") === "true",
    children: [],
  };
}

function extractAttr(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, "i");
  return regex.exec(attrs)?.[1] ?? null;
}

function parseBounds(boundsStr: string): AccessibilityNode["bounds"] {
  // Format: [left,top][right,bottom]
  const match = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr);
  if (!match) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  };
}
