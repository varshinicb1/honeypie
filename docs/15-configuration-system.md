# 15 — Configuration System

## Philosophy

Zero-config for the common case; every default overridable. Configuration is a single JSON file (`honeypie.config.json`) validated against a published JSON Schema, with CLI flags able to override any field for a single run without editing the file.

## Full Schema (annotated)

```json
{
  "$schema": "https://honeypie.dev/schema/v1/config.json",
  "outputs": ["playstore", "appstore", "readme", "website", "opengraph", "social"],
  "destination": "dist/",
  "exploration": {
    "timeBudget": "8m",
    "maxScreens": 60,
    "exclusions": ["Delete Account", "Payment*", "Logout"]
  },
  "vision": {
    "weights": { "visualQuality": 1, "clutter": 1, "readability": 1, "aesthetic": 1 },
    "forceInclude": [],
    "forceExclude": []
  },
  "copy": {
    "tone": "professional",
    "language": "en"
  },
  "themes": ["clean", "premium", "glass"],
  "brand": {
    "primaryColor": "#FF6B35",
    "secondaryColor": "#1A1A2E",
    "font": "Inter",
    "logo": "./assets/logo.svg"
  },
  "ai": {
    "provider": "anthropic",
    "mode": "cloud",
    "models": { "vision": "claude-sonnet-5", "copywriting": "claude-sonnet-5" },
    "redaction": { "patterns": ["email", "phone"], "blurRegions": [] }
  },
  "plugins": ["honeypie-plugin-theme-neon"],
  "devices": {
    "android": "Pixel_7_API_34",
    "ios": null
  }
}
```

## Precedence Order

1. CLI flags (highest precedence)
2. `honeypie.config.json` in project root
3. `honeypie.config.local.json` (gitignored, for local/dev overrides — merged *before* the shared config so shared config still wins unless explicitly listed as overridable; see note below)
4. Built-in defaults (lowest precedence)

Note: `honeypie.config.local.json` is intended for local secrets/paths (e.g., a developer's own emulator name) and is deep-merged with lower priority than the committed config for any key present in both, to avoid a local file silently overriding team-agreed settings — only keys absent from the shared config are taken from the local file.

## Validation

`honeypie config init` generates a schema-valid starter file from detected project settings. `honeypie run` validates the fully-merged config against the JSON Schema before any stage executes, failing fast with field-level error messages (exit code 10, see `docs/05-cli-specification.md`).

## Environment Variables

AI credentials are never stored in `honeypie.config.json` (to keep it safely committable). They're read from environment variables (`HONEYPIE_AI_API_KEY`, provider-specific overrides like `HONEYPIE_ANTHROPIC_API_KEY`) or an OS keychain integration for local interactive use.

## Config Evolution

The schema is versioned (`$schema` URL includes version). `honeypie config migrate` upgrades an older config file to the current schema version, part of the upgrade path documented in `docs/22-release-process.md`.
