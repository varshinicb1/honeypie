# 18 — Security Considerations

## Threat Model

HoneyPie handles three categories of sensitive material: (1) the developer's source code and build artifacts, (2) screenshots of a potentially unreleased app (which may contain real or synthetic user data, internal feature flags, or unreleased UI), and (3) whatever the AI gateway sends to third-party providers.

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Screenshots/copy sent to a third-party AI provider without explicit consent | AI gateway requires explicit provider configuration; `--local-only` mode fully disables network AI calls; first-run experience requires explicit opt-in confirmation before any cloud AI call is made |
| PII leakage in screenshots (real user data captured during exploration against a staging backend with real-looking data) | Configurable redaction rules (`config.ai.redaction`) blur specified regions and strip text patterns before any image leaves the machine; exploration defaults to synthetic data entry so backend responses are less likely to contain real PII in the first place |
| Malicious third-party plugin executing arbitrary code | Plugins run in the same process by default (Node/Rust plugin model) — this is a real trust boundary limitation; mitigated by (a) a curated/verified plugin registry badge for community plugins that have passed conformance + basic static review, (b) documentation making the trust model explicit, (c) a roadmap item (see `docs/26-future-ideas.md`) to sandbox render-theme plugins specifically, since those are the most likely to be authored by untrusted third parties |
| Emulator/device compromise via exploration interacting with unexpected deep links or intents | Exploration never follows external URLs/deep links outside the app's own package by default; explicit allow-list required to permit crossing into other installed apps |
| Credential leakage in `honeypie.config.json` committed to a public repo | AI credentials are never read from the config file, only from environment variables/OS keychain (see `docs/15-configuration-system.md`); `honeypie config init` explicitly warns against putting secrets in the file and lints for accidental key-shaped strings |
| Supply-chain risk from first-party plugin dependencies | First-party plugins pinned to exact versions, published with provenance attestation (npm provenance / sigstore), dependency audit as a CI gate |
| CI secret exposure via verbose logs | AI gateway redacts API keys from all structured logs by default, even in `--verbose` mode |

## Data Retention

- `.honeypie/cache/` (raw screenshots, AI request/response cache) is local-only, gitignored by default (`honeypie config init` writes the appropriate `.gitignore` entries), and never uploaded anywhere by HoneyPie itself.
- No telemetry is collected by default. If usage analytics are ever introduced, they will be opt-in, documented, and reviewed under a separate ADR (none currently planned for v1 — see `docs/24-decision-log.md`).

## Responsible Disclosure

A `SECURITY.md` (to be added alongside this documentation set before public release) will define a private disclosure channel and target response times for vulnerability reports, consistent with standard OSS practice.
