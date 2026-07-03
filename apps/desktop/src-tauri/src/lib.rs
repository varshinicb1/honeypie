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

/// Strips the Windows extended-length ("verbatim") path prefix `\\?\`.
///
/// `tauri::path::PathResolver::resolve` returns paths in this form on Windows.
/// Node.js's internal module resolution (`resolveMainPath` / `realpathSync`) does not handle
/// this prefix correctly and corrupts the path down to just the drive letter, crashing with
/// `EISDIR: illegal operation on a directory, lstat 'C:'` before any of our JS even loads. This
/// was root-caused by reproducing the exact crash from a real installed build (not just `tauri
/// dev`, which never hits this code path) via targeted diagnostic logging, then confirming the
/// fix by byte-for-byte reproduction: the same node invocation with the prefix crashes, and
/// without it succeeds, regardless of working directory.
fn strip_verbatim_prefix(path: &std::path::Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

/// Runs the bundled HoneyPie CLI (via the Node sidecar) with the given args, and captures both
/// the combined stdout/stderr log and the `Generated <dest>/honeypie.json` line the CLI prints
/// on success, so the caller knows where to read results from.
///
/// `cwd` is required, not optional, on purpose: when HoneyPie is launched from a Start Menu
/// shortcut or desktop icon (not a terminal), Windows can hand the process an unusable inherited
/// working directory - e.g. the bare string "C:" with no trailing separator - which crashes the
/// sidecar in the same way as the verbatim-prefix bug above. Making this parameter non-optional
/// means a future call site can't silently reintroduce that bug by omitting it.
async fn spawn_honeypie(app: &tauri::AppHandle, args: Vec<String>, cwd: String) -> Result<PipelineOutcome, String> {
    let cli_path = app
        .path()
        .resolve("resources/honeypie-cli.mjs", BaseDirectory::Resource)
        .map_err(|error| format!("Could not locate bundled honeypie-cli.mjs: {error}"))?;

    let mut all_args = vec![strip_verbatim_prefix(&cli_path)];
    all_args.extend(args);

    let command = app
        .shell()
        .sidecar("node")
        .map_err(|error| format!("Could not locate bundled Node runtime: {error}"))?
        .args(all_args)
        .current_dir(cwd);

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

/// Resolves (and creates) a directory that is guaranteed to be a valid working directory for
/// the sidecar, for commands that have no natural cwd of their own (repo-url runs, doctor).
fn resolve_safe_cache_dir(app: &tauri::AppHandle) -> Result<String, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Could not resolve app cache directory: {error}"))?;
    fs::create_dir_all(&cache_dir).map_err(|error| format!("Could not create {}: {error}", cache_dir.display()))?;
    Ok(cache_dir.to_string_lossy().to_string())
}

/// Runs the real local-only pipeline (zero external dependencies) against a folder the user
/// picked or dropped.
#[tauri::command]
async fn run_local_pipeline(app: tauri::AppHandle, project_dir: String) -> Result<PipelineOutcome, String> {
    spawn_honeypie(
        &app,
        vec!["run".into(), "--yes".into(), "--local-only".into(), "--dest".into(), "dist".into()],
        project_dir,
    )
    .await
}

/// Clones `repo_url` and runs whichever real pipeline applies (auto-detected).
#[tauri::command]
async fn run_from_repo_url(app: tauri::AppHandle, repo_url: String) -> Result<PipelineOutcome, String> {
    let cache_dir = resolve_safe_cache_dir(&app)?;
    spawn_honeypie(
        &app,
        vec!["run".into(), "--yes".into(), "--repo".into(), repo_url, "--dest".into(), "dist".into()],
        cache_dir,
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

/// Runs `honeypie doctor` via the bundled CLI sidecar and returns the output.
#[tauri::command]
async fn run_doctor_command(app: tauri::AppHandle) -> Result<PipelineOutcome, String> {
    let cache_dir = resolve_safe_cache_dir(&app)?;
    spawn_honeypie(&app, vec!["doctor".into()], cache_dir).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            run_local_pipeline,
            run_from_repo_url,
            read_dist_images,
            run_doctor_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

