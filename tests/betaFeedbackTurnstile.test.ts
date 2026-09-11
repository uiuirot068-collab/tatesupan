import { describe, expect, it, vi } from "vitest";
import {
  turnstileFailureHttpStatus,
  verifyTurnstileRequest,
  type TurnstileDiagnostic,
} from "../supabase/functions/_shared/turnstileVerification";

const SECRET = "production-secret-must-never-be-logged";
const TOKEN = "fresh-turnstile-token-must-never-be-logged";

function verifier(overrides: Partial<Parameters<typeof verifyTurnstileRequest>[0]> = {}) {
  const diagnostics: TurnstileDiagnostic[] = [];
  const run = () =>
    verifyTurnstileRequest({
      secretKey: SECRET,
      token: TOKEN,
      verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expectedAction: "tatespun-feedback",
      isAllowedHostname: (hostname) => hostname === "spuntales.net",
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: true,
          action: "tatespun-feedback",
          hostname: "spuntales.net",
        }),
      ),
      log: (diagnostic) => diagnostics.push(diagnostic),
      ...overrides,
    });
  return { diagnostics, run };
}

function genericClientFailure(result: Awaited<ReturnType<typeof verifyTurnstileRequest>>) {
  return {
    status: turnstileFailureHttpStatus(result),
    body: { ok: false, error: "verification_failed" },
  };
}

describe("beta-feedback Turnstile server diagnostics", () => {
  it("reports a missing secret internally while keeping the client error generic", async () => {
    const test = verifier({ secretKey: "" });
    const result = await test.run();

    expect(genericClientFailure(result)).toEqual({
      status: 503,
      body: { ok: false, error: "verification_failed" },
    });
    expect(test.diagnostics).toEqual([{ category: "TURNSTILE_SECRET_MISSING" }]);
  });

  it("reports only the HTTP status for a non-2xx Siteverify response", async () => {
    const test = verifier({
      fetchImpl: vi.fn(async () => new Response("raw upstream body", { status: 502 })),
    });
    const result = await test.run();

    expect(genericClientFailure(result).status).toBe(503);
    expect(test.diagnostics).toEqual([
      { category: "TURNSTILE_SITEVERIFY_HTTP_ERROR", httpStatus: 502 },
    ]);
    expect(JSON.stringify(test.diagnostics)).not.toContain("raw upstream body");
  });

  it("reports only a safe error name for fetch or JSON exceptions", async () => {
    const error = new TypeError(`network detail ${SECRET} ${TOKEN}`);
    const test = verifier({ fetchImpl: vi.fn(async () => Promise.reject(error)) });
    const result = await test.run();

    expect(genericClientFailure(result).status).toBe(503);
    expect(test.diagnostics).toEqual([
      { category: "TURNSTILE_SITEVERIFY_FETCH_ERROR", errorName: "TypeError" },
    ]);
  });

  it("reports a safely parsed invalid-input-secret code for success:false", async () => {
    const test = verifier({
      fetchImpl: vi.fn(async () =>
        Response.json({ success: false, "error-codes": ["invalid-input-secret"] }),
      ),
    });
    const result = await test.run();

    expect(genericClientFailure(result)).toEqual({
      status: 403,
      body: { ok: false, error: "verification_failed" },
    });
    expect(test.diagnostics).toEqual([
      { category: "TURNSTILE_SITEVERIFY_INVALID", errorCodes: ["invalid-input-secret"] },
    ]);
  });

  it("passes a valid token, action, and hostname without logging", async () => {
    const test = verifier();
    await expect(test.run()).resolves.toEqual({ ok: true });
    expect(test.diagnostics).toEqual([]);
  });

  it("distinguishes action and hostname mismatches without logging their values", async () => {
    const action = verifier({
      fetchImpl: vi.fn(async () =>
        Response.json({ success: true, action: SECRET, hostname: "spuntales.net" }),
      ),
    });
    const hostname = verifier({
      fetchImpl: vi.fn(async () =>
        Response.json({ success: true, action: "tatespun-feedback", hostname: TOKEN }),
      ),
    });

    await action.run();
    await hostname.run();
    expect(action.diagnostics).toEqual([{ category: "TURNSTILE_ACTION_MISMATCH" }]);
    expect(hostname.diagnostics).toEqual([{ category: "TURNSTILE_HOSTNAME_MISMATCH" }]);
  });

  it("never includes the secret, token, raw response, or exception message in logs", async () => {
    const invalid = verifier({
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: false,
          "error-codes": ["invalid-input-response", SECRET, TOKEN, { raw: SECRET }],
        }),
      ),
    });
    const unsafeErrorName = new Error(`message:${SECRET}:${TOKEN}`);
    unsafeErrorName.name = SECRET;
    const failedFetch = verifier({
      fetchImpl: vi.fn(async () => Promise.reject(unsafeErrorName)),
    });

    await invalid.run();
    await failedFetch.run();
    const output = JSON.stringify([...invalid.diagnostics, ...failedFetch.diagnostics]);
    expect(output).not.toContain(SECRET);
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain("message:");
    expect(output).not.toContain("raw");
    expect(output).toContain("unknown-error-code");
    expect(output).toContain("UnknownError");
  });
});
