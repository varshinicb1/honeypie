use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Runs the bundled HoneyPie CLI (via the Node sidecar) against `project_dir`, using the
/// deterministic local-only pipeline — the one path with zero external tool dependencies
/// beyond what's bundled in this installer.
#[tauri::command]
async fn run_local_pipeline(app: tauri::AppHandle, project_dir: String) -> Result<String, String> {
    let cli_path = app
        .path()
        .resolve("resources/honeypie-cli.mjs", BaseDirectory::Resource)
        .map_err(|error| format!("Could not locate bundled honeypie-cli.mjs: {error}"))?;

    let (mut receiver, _child) = app
        .shell()
        .sidecar("node")
        .map_err(|error| format!("Could not locate bundled Node runtime: {error}"))?
        .args([
            cli_path.to_string_lossy().to_string(),
            "run".into(),
            "--yes".into(),
            "--local-only".into(),
            "--dest".into(),
            "dist".into(),
        ])
        .current_dir(project_dir)
        .spawn()
        .map_err(|error| format!("Failed to spawn HoneyPie: {error}"))?;

    let mut output = String::new();
    while let Some(event) = receiver.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => output.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Stderr(bytes) => output.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Error(message) => return Err(message),
            CommandEvent::Terminated(payload) => {
                return match payload.code {
                    Some(0) => Ok(output),
                    _ => Err(format!("HoneyPie exited with a non-zero status.\n\n{output}")),
                };
            }
            _ => {}
        }
    }

    Ok(output)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_local_pipeline])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
