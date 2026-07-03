import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DeviceManager } from "@honeypie/builder";
import { parseAccessibilityXml, extractInteractiveElements, rankElements, type InteractiveElement } from "./accessibility.js";
import { fingerprintScreen } from "./fingerprint.js";
import { captureScreenshot } from "./screencap.js";

export interface NavigationNode {
  id: string;
  label: string;
  screenType: string;
  fingerprint: string;
  capturePaths: string[];
}

export interface NavigationEdge {
  from: string;
  to: string;
  action: string;
  target: string;
}

export interface NavigationGraph {
  nodes: NavigationNode[];
  edges: NavigationEdge[];
  stats: {
    nodesDiscovered: number;
    edgesTraversed: number;
    durationMs: number;
    budgetExhausted: boolean;
  };
}

export interface ExploreOptions {
  timeBudgetMs: number;
  maxScreens: number;
  exclusions: string[];
  projectRoot: string;
}

export class AutonomousExplorer {
  private readonly deviceManager: DeviceManager;
  private readonly visited = new Map<string, string>(); // fingerprint -> node.id
  private readonly nodes: NavigationNode[] = [];
  private readonly edges: NavigationEdge[] = [];
  private nodeCounter = 0;
  private edgeCounter = 0;

  constructor() {
    this.deviceManager = new DeviceManager();
  }

  async explore(deviceId: string, options: ExploreOptions): Promise<NavigationGraph> {
    const start = Date.now();
    const rawDir = join(options.projectRoot, ".honeypie", "cache", "raw");
    await mkdir(rawDir, { recursive: true });

    let budgetExhausted = false;

    // 1. Initial State Capture
    const initialXml = this.deviceManager.dumpUiAutomator(deviceId);
    if (!initialXml) {
      throw new Error("Failed to capture initial accessibility tree");
    }

    const initialNodes = parseAccessibilityXml(initialXml);
    const initialFingerprint = fingerprintScreen(initialNodes);
    
    const rootNodeId = "screen_0";
    const initialScreenshotPath = join(rawDir, `${rootNodeId}.png`);
    await this.deviceManager.captureScreenshot(deviceId, initialScreenshotPath);

    const rootNode: NavigationNode = {
      id: rootNodeId,
      label: "Launch Screen",
      screenType: "home",
      fingerprint: initialFingerprint,
      capturePaths: [initialScreenshotPath]
    };
    
    this.nodes.push(rootNode);
    this.visited.set(initialFingerprint, rootNodeId);
    this.nodeCounter = 1;

    // Explore queue: frontier of elements we need to click
    // We maintain a stack of { nodeId, elements: InteractiveElement[], index: number }
    const stack: { nodeId: string; elements: InteractiveElement[]; index: number }[] = [];
    
    const initialInteractive = extractInteractiveElements(initialNodes);
    const rankedInitial = rankElements(initialInteractive).filter(
      el => !options.exclusions.some(exc => el.label.toLowerCase().includes(exc.toLowerCase()))
    );

    stack.push({ nodeId: rootNodeId, elements: rankedInitial, index: 0 });

    while (stack.length > 0) {
      if (Date.now() - start > options.timeBudgetMs || this.nodes.length >= options.maxScreens) {
        budgetExhausted = true;
        break;
      }

      const frame = stack[stack.length - 1]!;
      if (frame.index >= frame.elements.length) {
        // Backtrack
        stack.pop();
        if (stack.length > 0) {
          this.deviceManager.pressBack(deviceId);
          // Wait for transition
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }

      const element = frame.elements[frame.index]!;
      frame.index++;

      // Click the element
      const tapped = this.deviceManager.tap(deviceId, element.x, element.y);
      if (!tapped) continue;

      // Wait for screen transition / load
      await new Promise(resolve => setTimeout(resolve, 1500));

      const nextXml = this.deviceManager.dumpUiAutomator(deviceId);
      if (!nextXml) {
        // App might have crashed, go back
        this.deviceManager.pressBack(deviceId);
        continue;
      }

      const nextNodes = parseAccessibilityXml(nextXml);
      const nextFingerprint = fingerprintScreen(nextNodes);

      if (this.visited.has(nextFingerprint)) {
        // Loop detected / known state
        const targetNodeId = this.visited.get(nextFingerprint)!;
        this.edges.push({
          from: frame.nodeId,
          to: targetNodeId,
          action: `tap(${element.x},${element.y})`,
          target: element.label
        });
        
        // Go back to keep exploring current frame's elements
        this.deviceManager.pressBack(deviceId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // New state found!
        const newNodeId = `screen_${this.nodeCounter++}`;
        const screenshotPath = join(rawDir, `${newNodeId}.png`);
        await this.deviceManager.captureScreenshot(deviceId, screenshotPath);

        const newNode: NavigationNode = {
          id: newNodeId,
          label: element.label || `Screen ${newNodeId}`,
          screenType: element.label.toLowerCase().includes("setting") ? "settings" : "detail",
          fingerprint: nextFingerprint,
          capturePaths: [screenshotPath]
        };

        this.nodes.push(newNode);
        this.visited.set(nextFingerprint, newNodeId);

        this.edges.push({
          from: frame.nodeId,
          to: newNodeId,
          action: `tap(${element.x},${element.y})`,
          target: element.label
        });

        // Enumerate elements of the new state
        const newInteractive = extractInteractiveElements(nextNodes);
        const rankedNew = rankElements(newInteractive).filter(
          el => !options.exclusions.some(exc => el.label.toLowerCase().includes(exc.toLowerCase()))
        );

        // Push new screen state to stack to explore deep first
        stack.push({ nodeId: newNodeId, elements: rankedNew, index: 0 });
      }
    }

    return {
      nodes: this.nodes,
      edges: this.edges,
      stats: {
        nodesDiscovered: this.nodes.length,
        edgesTraversed: this.edges.length,
        durationMs: Date.now() - start,
        budgetExhausted
      }
    };
  }
}
