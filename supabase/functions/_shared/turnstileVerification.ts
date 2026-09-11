export type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; retriable: boolean };

export type TurnstileDiagnostic =
  | { category: "TURNSTILE_SECRET_MISSING" }
  | { category: "TURNSTILE_SITEVERIFY_HTTP_ERROR"; httpStatus: number }
  | { category: "TURNSTILE_SITEVERIFY_FETCH_ERROR"; errorName: string }
  | { category: "TURNSTILE_SITEVERIFY_INVALID"; errorCodes: string[] }
  | { category: "TURNSTILE_ACTION_MISMATCH" }
  | { category: "TURNSTILE_HOSTNAME_MISMATCH" };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface VerifyTurnstileOptions {
  secretKey: string;
  token: string;
  verifyUrl: string;
  expectedAction: string;
  isAllowedHostname: (hostname: unknown) => boolean;
  fetchImpl: FetchLike;
  log: (diagnostic: TurnstileDiagnostic) => void;
}

const SAFE_TURNSTILE_ERROR_CODES = new Set([
  "missing-input-secret",
  "invalid-input-secret",
  "missing-input-response",
  "invalid-input-response",
  "bad-request",
  "timeout-or-duplicate",
  "internal-error",
]);

const SAFE_TURNSTILE_ERROR_NAMES = new Set([
  "AbortError",
  "Error",
  "NetworkError",
  "SyntaxError",
  "TypeError",
]);

function emitDiagnostic(
  log: VerifyTurnstileOptions["log"],
  diagnostic: TurnstileDiagnostic,
): void {
  try {
    log(diagnostic);
  } catch {
    // Diagnostics must never change the fail-closed verification result.
  }
}

function safeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return ["unknown-error-code"];
  const codes = new Set<string>();
  let hadUnknown = false;
  for (const item of value) {
    if (typeof item === "string" && SAFE_TURNSTILE_ERROR_CODES.has(item)) {
      codes.add(item);
    } else {
      hadUnknown = true;
    }
  }
  if (hadUnknown || codes.size === 0) codes.add("unknown-error-code");
  return [...codes];
}

function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  return SAFE_TURNSTILE_ERROR_NAMES.has(name) ? name : "UnknownError";
}

function safeHttpStatus(status: unknown): number {
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : 0;
}

export function turnstileFailureHttpStatus(result: TurnstileVerificationResult): 403 | 503 {
  if (result.ok) throw new Error("Successful Turnstile verification has no failure status");
  return result.retriable ? 503 : 403;
}

export async function verifyTurnstileRequest({
  secretKey,
  token,
  verifyUrl,
  expectedAction,
  isAllowedHostname,
  fetchImpl,
  log,
}: VerifyTurnstileOptions): Promise<TurnstileVerificationResult> {
  if (!secretKey) {
    emitDiagnostic(log, { category: "TURNSTILE_SECRET_MISSING" });
    return { ok: false, retriable: true };
  }
  if (!token) {
    emitDiagnostic(log, {
      category: "TURNSTILE_SITEVERIFY_INVALID",
      errorCodes: ["missing-input-response"],
    });
    return { ok: false, retriable: false };
  }

  let data: {
    success?: boolean;
    action?: string;
    hostname?: string;
    "error-codes"?: unknown;
  } | null = null;
  try {
    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", token);
    const response = await fetchImpl(verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      emitDiagnostic(log, {
        category: "TURNSTILE_SITEVERIFY_HTTP_ERROR",
        httpStatus: safeHttpStatus(response.status),
      });
      return { ok: false, retriable: true };
    }
    data = await response.json();
  } catch (error) {
    emitDiagnostic(log, {
      category: "TURNSTILE_SITEVERIFY_FETCH_ERROR",
      errorName: safeErrorName(error),
    });
    return { ok: false, retriable: true };
  }

  if (!data || data.success !== true) {
    emitDiagnostic(log, {
      category: "TURNSTILE_SITEVERIFY_INVALID",
      errorCodes: safeErrorCodes(data?.["error-codes"]),
    });
    return { ok: false, retriable: false };
  }
  if (data.action !== expectedAction) {
    emitDiagnostic(log, { category: "TURNSTILE_ACTION_MISMATCH" });
    return { ok: false, retriable: false };
  }
  if (!isAllowedHostname(data.hostname)) {
    emitDiagnostic(log, { category: "TURNSTILE_HOSTNAME_MISMATCH" });
    return { ok: false, retriable: false };
  }
  return { ok: true };
}
