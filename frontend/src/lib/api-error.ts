/**
 * Parses the backend's standardized error envelope:
 *   {"error": {"code": "...", "message": "...", "retryable": bool, "request_id": "..."}}
 *
 * Falls back to the legacy FastAPI `{"detail": "..."}` shape for any
 * endpoint that hasn't been migrated yet, so callers never need to know
 * which shape a given response uses.
 */
export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

export async function parseApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  const body = await response.json().catch(() => null);

  const envelope = (body as { error?: Partial<ApiError> } | null)?.error;
  if (envelope && typeof envelope.message === "string") {
    return {
      code: envelope.code || "REQUEST_FAILED",
      message: envelope.message,
      retryable: Boolean(envelope.retryable),
      requestId: envelope.requestId || response.headers.get("x-request-id") || "",
    };
  }

  const legacyDetail = (body as { detail?: string } | null)?.detail;
  return {
    code: "REQUEST_FAILED",
    message: legacyDetail || fallbackMessage,
    retryable: response.status >= 500 || response.status === 408 || response.status === 429,
    requestId: response.headers.get("x-request-id") || "",
  };
}

export class TimeoutError extends Error {
  constructor(message = "Processing is taking longer than expected.") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Wraps `fetch` with a hard timeout so the UI never waits indefinitely. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 90_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError();
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
