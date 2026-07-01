use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use serde_json::Value;
use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
struct PipelineOutcome {
    log: String,
    destination: Option<String>,
}

#[derive(Serialize)]
struct GalleryImage {
    label: String,
    data_url: String,
}

/// Runs the bundled HoneyPie CLI (via the Node sidecar) with the given args/cwd, and captures
/// both the combined stdout/stderr log and the `Generated <dest>/honeypie.json` line the CLI
/// prints on success, so the caller knows where to read results from.
async fn spawn_honeypie(app: &tauri::AppHandle, args: Vec<String>, cwd: Option<String>) -> Result<PipelineOutcome, String> {
    let cli_path = app
        .path()
        .resolve("resources/honeypie-cli.mjs", BaseDirectory::Resource)
        .map_err(|error| format!("Could not locate bundled honeypie-cli.mjs: {error}"))?;

    let mut all_args = vec![cli_path.to_string_lossy().to_string()];
    all_args.extend(args);

    let mut command = app
        .shell()
        .sidecar("node")
        .map_err(|error| format!("Could not locate bundled Node runtime: {error}"))?
        .args(all_args);
    if let Some(dir) = cwd {
        command = command.current_dir(dir);
    }

    let (mut receiver, _child) = command.spawn().map_err(|error| format!("Failed to spawn HoneyPie: {error}"))?;

    let mut output = String::new();
    while let Some(event) = receiver.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => output.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Stderr(bytes) => output.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Error(message) => return Err(message),
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(format!("HoneyPie exited with a non-zero status.\n\n{output}"));
                }
                let destination = parse_destination(&output);
                return Ok(PipelineOutcome { log: output, destination });
            }
            _ => {}
        }
    }

    Ok(PipelineOutcome { log: output, destination: None })
}

fn parse_destination(log: &str) -> Option<String> {
    let line = log.lines().find(|line| line.starts_with("Generated "))?;
    let path = line.strip_prefix("Generated ")?.trim();
    let suffix = "/honeypie.json";
    let path = path.strip_suffix(suffix).unwrap_or(path);
    Some(path.to_string())
}

/// Runs the real local-only pipeline (zero external dependencies) against a folder the user
/// picked or dropped.
#[tauri::command]
async fn run_local_pipeline(app: tauri::AppHandle, project_dir: String) -> Result<PipelineOutcome, String> {
    spawn_honeypie(
        &app,
        vec!["run".into(), "--yes".into(), "--local-only".into(), "--dest".into(), "dist".into()],
        Some(project_dir),
    )
    .await
}

/// Clones `repo_url` and runs whichever real pipeline applies (auto-detected).
#[tauri::command]
async fn run_from_repo_url(app: tauri::AppHandle, repo_url: String) -> Result<PipelineOutcome, String> {
    spawn_honeypie(
        &app,
        vec!["run".into(), "--yes".into(), "--repo".into(), repo_url, "--dest".into(), "dist".into()],
        None,
    )
    .await
}

/// Reads honeypie.json at `destination` and returns the generated images (mockups if present,
/// else raw screenshots) as data URLs the frontend can render directly.
#[tauri::command]
fn read_dist_images(destination: String) -> Result<Vec<GalleryImage>, String> {
    let manifest_path = Path::new(&destination).join("honeypie.json");
    let manifest_text = fs::read_to_string(&manifest_path).map_err(|error| format!("Could not read {}: {error}", manifest_path.display()))?;
    let manifest: Value = serde_json::from_str(&manifest_text).map_err(|error| format!("Could not parse honeypie.json: {error}"))?;
    let assets = manifest["assets"].as_array().cloned().unwrap_or_default();

    let mut mockups: Vec<GalleryImage> = Vec::new();
    let mut screenshots: Vec<GalleryImage> = Vec::new();

    for asset in assets {
        let target = asset["target"].as_str().unwrap_or("");
        let path = match asset["path"].as_str() {
            Some(path) => path,
            None => continue,
        };
        if target != "mockups" && target != "screenshots" {
            continue;
        }
        let full_path = Path::new(&destination).join(path);
        let bytes = match fs::read(&full_path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        let label = asset["sourceScreen"].as_str().unwrap_or(path).to_string();
        let data_url = if path.ends_with(".svg") {
            format!("data:image/svg+xml;base64,{}", STANDARD.encode(&bytes))
        } else {
            format!("data:image/png;base64,{}", STANDARD.encode(&bytes))
        };
        let image = GalleryImage { label, data_url };
        if target == "mockups" {
            mockups.push(image);
        } else {
            screenshots.push(image);
        }
    }

    Ok(if mockups.is_empty() { screenshots } else { mockups })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_local_pipeline, run_from_repo_url, read_dist_images])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
