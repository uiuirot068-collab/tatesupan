import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** TSP-SAFE-005/007: the protective headers Cloudflare Pages sends with every page. */
const headers = readFileSync(join(__dirname, "../../public/_headers"), "utf8");

describe("public/_headers", () => {
  it("applies to every page", () => {
    expect(headers).toMatch(/^\/\*$/m);
  });

  it("keeps the SAFE-005 headers", () => {
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(headers).toContain("Permissions-Policy: camera=(), microphone=(), geolocation=()");
  });

  it("SAFE-007: no other site may frame TateSpun", () => {
    expect(headers).toContain("Content-Security-Policy: frame-ancestors 'none'");
    expect(headers).toContain("X-Frame-Options: DENY");
  });

  it("does not yet restrict scripts (a full CSP needs a Report-Only check first)", () => {
    expect(headers).not.toMatch(/script-src|default-src/);
  });
});
