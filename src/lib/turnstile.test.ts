import { describe, expect, it, vi } from "vitest";
import { renderVisibleTurnstile, type TurnstileApi } from "./turnstile";

describe("visible Turnstile contract", () => {
  it("renders an always-visible widget and retains token/expiry/error callbacks", () => {
    let options: Record<string, unknown> | undefined;
    const api: TurnstileApi = {
      render: (_element, next) => {
        options = next;
        return "widget-1";
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const verified = vi.fn();
    const expired = vi.fn();
    const failed = vi.fn();

    expect(renderVisibleTurnstile(api, {} as HTMLElement, "test-site-key", {
      verified,
      expired,
      failed,
    })).toBe("widget-1");
    expect(options).toMatchObject({
      sitekey: "test-site-key",
      appearance: "always",
      size: "flexible",
      theme: "auto",
      retry: "auto",
      "refresh-expired": "auto",
    });
    (options?.callback as (token: string) => void)("token");
    (options?.["expired-callback"] as () => void)();
    (options?.["error-callback"] as () => void)();
    expect(verified).toHaveBeenCalledWith("token");
    expect(expired).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledOnce();
  });
});
