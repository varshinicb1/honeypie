# Security Policy

HoneyPie handles source code, screenshots, app metadata, and optional AI provider credentials. Security issues are treated as high priority.

## Supported Versions

HoneyPie is pre-1.0. Security fixes land on `main` until the first stable release branch exists.

## Reporting a Vulnerability

Please do not open public issues for vulnerabilities. Use GitHub private vulnerability reporting if available on the repository, or contact the maintainers privately.

Include:

- Affected package or command.
- Reproduction steps.
- Impact and any suspected data exposure.
- Whether external AI provider calls were enabled.

## Security Principles

- Local-only mode must not make external AI calls.
- AI credentials must never be stored in committed config files.
- Plugin failures must be isolated at orchestrator boundaries.
- Generated reports must be offline-viewable and should not load remote resources.
