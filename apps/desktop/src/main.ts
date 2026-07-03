import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

interface PipelineOutcome {
  log: string;
  destination: string | null;
}

interface GalleryImage {
  label: string;
  data_url: string;
}

let lastDestination: string | null = null;
let running = false;

// ── Progress step helpers ──────────────────────
const STEPS = ["step-detect", "step-explore", "step-vision", "step-publish"] as const;
const STEP_PROGRESS = [10, 35, 65, 90];

function setStep(index: number) {
  STEPS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("active", i === index);
    el.classList.toggle("done", i < index);
    const dot = el.querySelector<HTMLElement>(".step-dot");
    if (dot) dot.classList.toggle("pulse", i === index);
  });
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = `${STEP_PROGRESS[index] ?? 95}%`;
}

function completeProgress() {
  STEPS.forEach((id) => {
    const el = document.getElementById(id);
    el?.classList.add("done");
    el?.classList.remove("active");
    const dot = el?.querySelector<HTMLElement>(".step-dot");
    if (dot) dot.classList.remove("pulse");
  });
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = "100%";
}

// ── Tab switching ──────────────────────────────
function initTabs() {
  const navItems = document.querySelectorAll<HTMLButtonElement>(".nav-item");
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset["tab"];
      document.querySelectorAll<HTMLElement>(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tab}`);
      });
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const dropZone        = document.querySelector<HTMLElement>("#drop-zone")!;
  const pickFolderBtn   = document.querySelector<HTMLButtonElement>("#pick-folder-btn")!;
  const repoForm        = document.querySelector<HTMLFormElement>("#repo-form")!;
  const repoInput       = document.querySelector<HTMLInputElement>("#repo-input")!;
  const repoBtn         = document.querySelector<HTMLButtonElement>("#repo-btn")!;
  const selectedPathEl  = document.querySelector<HTMLParagraphElement>("#selected-path")!;
  const statusEl        = document.querySelector<HTMLElement>("#status")!;
  const statusTextEl    = document.querySelector<HTMLParagraphElement>("#status-text")!;
  const errorBoxEl      = document.querySelector<HTMLElement>("#error-box")!;
  const errorTextEl     = document.querySelector<HTMLPreElement>("#error-text")!;
  const galleryEl       = document.querySelector<HTMLElement>("#gallery")!;
  const gallerySummaryEl = document.querySelector<HTMLParagraphElement>("#gallery-summary")!;
  const galleryGridEl   = document.querySelector<HTMLDivElement>("#gallery-grid")!;
  const logOutputEl     = document.querySelector<HTMLPreElement>("#log-output")!;
  const openFolderBtn   = document.querySelector<HTMLButtonElement>("#open-folder-btn")!;
  const errorDismiss    = document.querySelector<HTMLButtonElement>("#error-dismiss")!;
  const doctorBtn       = document.querySelector<HTMLButtonElement>("#doctor-btn")!;
  const doctorOverlay   = document.querySelector<HTMLElement>("#doctor-overlay")!;
  const doctorClose     = document.querySelector<HTMLButtonElement>("#doctor-close")!;
  const doctorOutput    = document.querySelector<HTMLPreElement>("#doctor-output")!;

  initTabs();

  // ── busy / idle state ─────────────────────────
  function setBusy(message: string) {
    running = true;
    pickFolderBtn.disabled = true;
    repoBtn.disabled = true;
    repoInput.disabled = true;
    errorBoxEl.hidden = true;
    galleryEl.hidden = true;
    statusEl.hidden = false;
    statusTextEl.textContent = message;
    setStep(0);
  }

  function setIdle() {
    running = false;
    pickFolderBtn.disabled = false;
    repoBtn.disabled = false;
    repoInput.disabled = false;
    statusEl.hidden = true;
    const fill = document.getElementById("progress-fill");
    if (fill) fill.style.width = "0%";
  }

  function showError(message: string) {
    errorBoxEl.hidden = false;
    errorTextEl.textContent = message;
  }

  errorDismiss.addEventListener("click", () => { errorBoxEl.hidden = true; });

  // ── simulate progress steps during run ────────
  function startProgressSimulation(totalMs: number): () => void {
    const stepDurations = [0.1, 0.35, 0.35, 0.2].map((f) => f * totalMs);
    let cancelled = false;
    const stepMessages = [
      "Detecting framework & building project…",
      "Exploring screens autonomously…",
      "Vision scoring & deduplication…",
      "Publishing assets to dist…",
    ];

    let currentStep = 0;
    function advance() {
      if (cancelled || currentStep >= STEPS.length) return;
      setStep(currentStep);
      statusTextEl.textContent = stepMessages[currentStep] ?? "Working…";
      const delay = stepDurations[currentStep] ?? 2000;
      currentStep++;
      setTimeout(advance, delay);
    }
    advance();
    return () => { cancelled = true; };
  }

  // ── render results ────────────────────────────
  async function renderResult(label: string, outcome: PipelineOutcome) {
    completeProgress();
    await new Promise((r) => setTimeout(r, 400)); // let progress bar reach 100%
    logOutputEl.textContent = outcome.log;
    lastDestination = outcome.destination;

    if (!outcome.destination) {
      gallerySummaryEl.textContent = `Done. No output folder was reported.`;
      galleryGridEl.innerHTML = "";
      galleryEl.hidden = false;
      return;
    }

    let images: GalleryImage[] = [];
    try {
      images = await invoke<GalleryImage[]>("read_dist_images", { destination: outcome.destination });
    } catch {
      images = [];
    }

    const shortLabel = label.length > 40 ? `…${label.slice(-38)}` : label;
    gallerySummaryEl.textContent = `${images.length} asset${images.length === 1 ? "" : "s"} generated in ${shortLabel}`;
    galleryGridEl.innerHTML = "";

    for (const image of images) {
      const figure = document.createElement("figure");
      figure.className = "gallery-item";
      const img = document.createElement("img");
      img.src = image.data_url;
      img.alt = image.label;
      img.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = image.label;
      figure.append(img, caption);
      galleryGridEl.append(figure);
    }

    galleryEl.hidden = false;
  }

  // ── pipeline runners ──────────────────────────
  async function runOnFolder(folder: string) {
    selectedPathEl.textContent = folder;
    setBusy(`Running HoneyPie on ${folder}…`);
    const cancelSim = startProgressSimulation(25_000);
    try {
      const outcome = await invoke<PipelineOutcome>("run_local_pipeline", { projectDir: folder });
      cancelSim();
      await renderResult(folder, outcome);
    } catch (error) {
      cancelSim();
      showError(String(error));
    } finally {
      setIdle();
    }
  }

  async function runOnRepo(url: string) {
    selectedPathEl.textContent = url;
    setBusy(`Cloning ${url}…`);
    const cancelSim = startProgressSimulation(60_000);
    try {
      const outcome = await invoke<PipelineOutcome>("run_from_repo_url", { repoUrl: url });
      cancelSim();
      await renderResult(url, outcome);
    } catch (error) {
      cancelSim();
      showError(String(error));
    } finally {
      setIdle();
    }
  }

  // ── event wiring ──────────────────────────────
  pickFolderBtn.addEventListener("click", async () => {
    if (running) return;
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder === "string") await runOnFolder(folder);
  });

  repoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (running) return;
    const url = repoInput.value.trim();
    if (url) await runOnRepo(url);
  });

  openFolderBtn.addEventListener("click", async () => {
    if (lastDestination) await openPath(lastDestination);
  });

  // ── drag-drop ─────────────────────────────────
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "over") {
      dropZone.classList.add("drop-zone-active");
    } else if (event.payload.type === "drop") {
      dropZone.classList.remove("drop-zone-active");
      const [firstPath] = event.payload.paths;
      if (firstPath && !running) void runOnFolder(firstPath);
    } else {
      dropZone.classList.remove("drop-zone-active");
    }
  });

  // Keyboard accessibility for drop zone
  dropZone.addEventListener("keydown", async (event) => {
    if ((event.key === "Enter" || event.key === " ") && !running) {
      event.preventDefault();
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder === "string") await runOnFolder(folder);
    }
  });

  // ── doctor overlay ────────────────────────────
  doctorBtn.addEventListener("click", async () => {
    doctorOverlay.hidden = false;
    doctorOutput.textContent = "Running diagnostics…";
    try {
      const result = await invoke<{ exitCode: number; stdout: string; stderr: string }>("run_doctor_command");
      doctorOutput.textContent = result.stdout + (result.stderr ? `\n${result.stderr}` : "");
    } catch {
      // Fallback: just show what we can from the Tauri side
      doctorOutput.textContent = "Diagnostics unavailable from this context.\nRun: honeypie doctor  in a terminal for full output.";
    }
  });

  doctorClose.addEventListener("click", () => { doctorOverlay.hidden = true; });
  doctorOverlay.addEventListener("click", (e) => {
    if (e.target === doctorOverlay) doctorOverlay.hidden = true;
  });
});
