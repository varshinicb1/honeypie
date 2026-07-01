import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

let selectedFolder: string | null = null;

window.addEventListener("DOMContentLoaded", () => {
  const pickFolderBtn = document.querySelector<HTMLButtonElement>("#pick-folder-btn")!;
  const runBtn = document.querySelector<HTMLButtonElement>("#run-btn")!;
  const selectedFolderEl = document.querySelector<HTMLParagraphElement>("#selected-folder")!;
  const logEl = document.querySelector<HTMLPreElement>("#log")!;

  pickFolderBtn.addEventListener("click", async () => {
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder === "string") {
      selectedFolder = folder;
      selectedFolderEl.textContent = folder;
      runBtn.disabled = false;
    }
  });

  runBtn.addEventListener("click", async () => {
    if (!selectedFolder) return;
    runBtn.disabled = true;
    logEl.textContent = "Running HoneyPie…\n";
    try {
      const output = await invoke<string>("run_local_pipeline", { projectDir: selectedFolder });
      logEl.textContent += output;
      logEl.textContent += "\nDone. See dist/ in your project folder.";
    } catch (error) {
      logEl.textContent += `\nError: ${String(error)}`;
    } finally {
      runBtn.disabled = false;
    }
  });
});
