# 05 — CLI Specification

## Commands

### `honeypie`
No arguments. Detects the project in the current directory and launches the interactive TUI. Equivalent to `honeypie run --interactive`.

### `honeypie run`
Executes the pipeline.

```
honeypie run [options]

Options:
  --interactive             Launch TUI (default when no other flags given)
  --yes                     Non-interactive; accept all defaults
  --config <path>           Path to honeypie.config.json (default: ./honeypie.config.json)
  --outputs <list>          Comma-separated output targets, e.g. playstore,readme,website
  --dest <path>             Output directory (default: dist/)
  --from <stage>            Resume/re-run starting at a given stage (builder|explorer|vision|copywriter|renderer|publisher)
  --resume                  Resume the last interrupted run from its last checkpoint
  --device <id>             Use a specific already-running device/emulator instead of launching one
  --time-budget <duration>  Exploration time budget, e.g. 5m (default: 8m)
  --max-screens <n>         Cap on discovered screens (default: 60)
  --provider <name>         AI provider override (e.g. anthropic, openai, local)
  --local-only              Disable all external AI calls; use local heuristics only
  --theme <list>            Comma-separated mockup themes to render (default: from config)
  --seed <n>                Seed for reproducible AI-influenced selection where supported
  --dry-run                 Run detection + planning only; print what would happen
  --verbose                 Verbose structured logs
  --json                    Emit machine-readable JSON progress events to stdout (for CI)
```

### `honeypie ship`
Alias for `honeypie run --yes` — the "just do everything" command for CI and power users.

### `honeypie doctor`
Diagnoses environment issues: missing SDKs, no emulator available, missing AI credentials, etc. Exits non-zero with actionable remediation text if problems are found.

### `honeypie explain`
Given an existing `dist/honeypie.json`, prints a human-readable summary of what was generated and why (a terminal-native alternative to `report.html`).

### `honeypie plugins list` / `honeypie plugins add <name>` / `honeypie plugins remove <name>`
Plugin management. See `docs/07-plugin-sdk.md`.

### `honeypie config init`
Generates a starter `honeypie.config.json` based on detected project settings.

### `honeypie clean`
Removes `.honeypie/cache/` and optionally `dist/`.

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic pipeline failure |
| 2 | Environment/detection failure (see `honeypie doctor`) |
| 3 | Build failure |
| 4 | Exploration failure (e.g., emulator crash) |
| 5 | Partial success — some outputs failed, see `errors[]` in `honeypie.json` |
| 10 | Invalid configuration |

## Example CI Invocation

```yaml
- name: Generate marketing assets
  run: |
    npm install -g honeypie
    honeypie ship --outputs playstore,readme,website --provider anthropic --json > honeypie-run.jsonl
  env:
    HONEYPIE_AI_API_KEY: ${{ secrets.HONEYPIE_AI_API_KEY }}
```

## Example Local Interaction

```
$ cd MyFlutterApp
$ honeypie
🍯 HoneyPie v0.1.0

✓ Flutter project detected (pubspec.yaml)
✓ Android target available
✓ No running emulator — will launch Pixel_7_API_34

[TUI launches — see docs/06-tui-specification.md]
```
