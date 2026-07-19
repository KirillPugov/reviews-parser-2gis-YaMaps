export class ConfigError extends Error {
  override name = 'ConfigError';
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class AccessError extends Error {
  override name = 'AccessError';
}

export class ResponseFormatError extends Error {
  override name = 'ResponseFormatError';
}
