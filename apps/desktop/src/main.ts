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

window.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.querySelector<HTMLElement>("#drop-zone")!;
  const pickFolderBtn = document.querySelector<HTMLButtonElement>("#pick-folder-btn")!;
  const repoForm = document.querySelector<HTMLFormElement>("#repo-form")!;
  const repoInput = document.querySelector<HTMLInputElement>("#repo-input")!;
  const repoBtn = document.querySelector<HTMLButtonElement>("#repo-btn")!;
  const selectedPathEl = document.querySelector<HTMLParagraphElement>("#selected-path")!;
  const statusEl = document.querySelector<HTMLElement>("#status")!;
  const statusTextEl = document.querySelector<HTMLParagraphElement>("#status-text")!;
  const errorBoxEl = document.querySelector<HTMLElement>("#error-box")!;
  const errorTextEl = document.querySelector<HTMLParagraphElement>("#error-text")!;
  const galleryEl = document.querySelector<HTMLElement>("#gallery")!;
  const gallerySummaryEl = document.querySelector<HTMLParagraphElement>("#gallery-summary")!;
  const galleryGridEl = document.querySelector<HTMLDivElement>("#gallery-grid")!;
  const logOutputEl = document.querySelector<HTMLPreElement>("#log-output")!;
  const openFolderBtn = document.querySelector<HTMLButtonElement>("#open-folder-btn")!;

  function setBusy(message: string) {
    running = true;
    pickFolderBtn.disabled = true;
    repoBtn.disabled = true;
    repoInput.disabled = true;
    errorBoxEl.hidden = true;
    galleryEl.hidden = true;
    statusEl.hidden = false;
    statusTextEl.textContent = message;
  }

  function setIdle() {
    running = false;
    pickFolderBtn.disabled = false;
    repoBtn.disabled = false;
    repoInput.disabled = false;
    statusEl.hidden = true;
  }

  function showError(message: string) {
    errorBoxEl.hidden = false;
    errorTextEl.textContent = message;
  }

  async function renderResult(label: string, outcome: PipelineOutcome) {
    logOutputEl.textContent = outcome.log;
    lastDestination = outcome.destination;
    if (!outcome.destination) {
      gallerySummaryEl.textContent = `${label}: done, but no output folder was reported.`;
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
    gallerySummaryEl.textContent = `${label}: generated ${images.length} asset${images.length === 1 ? "" : "s"} in ${outcome.destination}`;
    galleryGridEl.innerHTML = "";
    for (const image of images) {
      const figure = document.createElement("figure");
      figure.className = "gallery-item";
      const img = document.createElement("img");
      img.src = image.data_url;
      img.alt = image.label;
      const caption = document.createElement("figcaption");
      caption.textContent = image.label;
      figure.append(img, caption);
      galleryGridEl.append(figure);
    }
    galleryEl.hidden = false;
  }

  async function runOnFolder(folder: string) {
    selectedPathEl.textContent = folder;
    setBusy(`Running HoneyPie on ${folder}…`);
    try {
      const outcome = await invoke<PipelineOutcome>("run_local_pipeline", { projectDir: folder });
      await renderResult(folder, outcome);
    } catch (error) {
      showError(String(error));
    } finally {
      setIdle();
    }
  }

  async function runOnRepo(url: string) {
    selectedPathEl.textContent = url;
    setBusy(`Cloning ${url} and running HoneyPie…`);
    try {
      const outcome = await invoke<PipelineOutcome>("run_from_repo_url", { repoUrl: url });
      await renderResult(url, outcome);
    } catch (error) {
      showError(String(error));
    } finally {
      setIdle();
    }
  }

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
});
