import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBetaFeedback } from "./betaFeedbackClient";
import type { FeedbackEnvironment } from "./feedbackEnvironment";

// Minimal but fully-typed fixture — every field submitBetaFeedback forwards
// unmodified, never reads individually.
const environment: FeedbackEnvironment = {
  osFamily: "Windows", osVersion: "10", platform: "Win32", deviceClass: "desktop",
  browserName: "Chrome", browserVersion: "120.0.0.0", engine: "Blink",
  userAgent: "ua", uaBrands: "Chrome 120", uaPlatform: "Windows", uaMobile: false,
  viewportWidth: 1440, viewportHeight: 900, screenWidth: 1920, screenHeight: 1080,
  availScreenWidth: 1920, availScreenHeight: 1040, devicePixelRatio: 1, colorDepth: 24,
  pixelDepth: 24, orientation: "landscape-primary", touch: false, maxTouchPoints: 0,
  pointerCapability: "fine", hoverCapability: "hover", hardwareConcurrency: 8,
  deviceMemoryGb: 8, language: "ja", languages: "ja,en", timezone: "Asia/Tokyo",
  timezoneOffsetMinutes: -540, online: true, cookieEnabled: true,
  connectionEffectiveType: "4g", connectionDownlinkMbps: 10, connectionRttMs: 50,
  connectionSaveData: false, colorScheme: "light", reducedMotion: false,
  appVersion: "1.0.0", path: "/", rendererMode: "V2 canonical", rolloutMode: "V2_BETA",
  responsiveMode: "desktop/tablet", featureFlags: "feedback:on, imageAttachments:off",
};

const security = { turnstileToken: "tok-1", honeypot: "", environment };
const submission = { type: "feedback" as const, message: "hello", images: [] as File[] };

describe("submitBetaFeedback — end-to-end Send pipeline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails closed (without ever calling fetch) when Supabase env is not configured — the local-dev gap behind 'Turnstile verified, Send still fails'", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await submitBetaFeedback(submission, security);

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_SUPABASE_URL"));
  });

  it("calls the Edge Function with the verified token and the collected environment, and succeeds on ok:true", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, reportId: "r1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await submitBetaFeedback(submission, security);

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/functions/v1/beta-feedback");
    const form = init.body as FormData;
    const payload = JSON.parse(form.get("payload") as string);
    expect(payload.turnstileToken).toBe("tok-1");
    expect(payload.clientContext).toEqual(environment);
  });

  it("reports ok:false (not a fabricated success) when the Edge Function responds with a non-2xx status", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("record_failed", { status: 502 })));

    const result = await submitBetaFeedback(submission, security);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("HTTP 502"));
  });

  it("reports ok:false when the Edge Function responds 200 but ok:false (e.g. Siteverify or record_failed)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "record_failed" }), { status: 200 })));

    const result = await submitBetaFeedback(submission, security);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("record_failed"));
  });

  it("reports ok:false and logs the exception when fetch itself throws (network failure)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const result = await submitBetaFeedback(submission, security);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith("[betaFeedback] fetch to Edge Function threw", expect.any(Error));
  });

  it("never calls fetch without a Turnstile token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await submitBetaFeedback(submission, { ...security, turnstileToken: "" });

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
