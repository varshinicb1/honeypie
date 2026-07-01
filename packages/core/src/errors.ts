export class HoneyPieError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigError extends HoneyPieError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIG_INVALID", details);
  }
}

export class PluginCompatibilityError extends HoneyPieError {
  constructor(message: string, details?: unknown) {
    super(message, "PLUGIN_SDK_INCOMPATIBLE", details);
  }
}

export class PipelineError extends HoneyPieError {
  constructor(message: string, details?: unknown) {
    super(message, "PIPELINE_FAILED", details);
  }
}
