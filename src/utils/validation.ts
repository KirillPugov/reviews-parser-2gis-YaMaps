export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function absoluteUrl(value: unknown, replacements: Record<string, string> = {}): string | null {
  const raw = asString(value);
  if (!raw) return null;
  let normalized = raw;
  for (const [key, replacement] of Object.entries(replacements)) {
    normalized = normalized.replaceAll(key, replacement);
  }
  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
