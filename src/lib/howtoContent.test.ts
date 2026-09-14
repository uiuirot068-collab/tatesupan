// TSP-HOWTO-BETA-016 — focused checks for the `/howto` beta onboarding page.
// Run with: npx vitest run --config src/lib/vitest.config.ts
//
// Deliberately NOT a full-page snapshot test (brittle). These assert on the
// specific, testable contracts the task called out: every referenced image
// file exists, the Editor Page / PDF filename explanations say the right
// things without leaking internal terms, and the route wiring (Home entry,
// return link, Help/Feedback reuse, no doubled basePath) is present in the
// page sources.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOWTO_IMAGES,
  HOWTO_ROUTE,
  EDITOR_PAGE_EXPLANATION_BODY,
  PDF_FILENAME_EXPLANATION,
} from "./howtoContent";

const repoRoot = path.resolve(__dirname, "../..");
const assetsDir = path.join(repoRoot, "public/howto/assets");
const howtoPageSrc = readFileSync(
  path.join(repoRoot, "src/app/howto/page.tsx"),
  "utf8"
);
const homePageSrc = readFileSync(path.join(repoRoot, "src/app/page.tsx"), "utf8");

describe("howto route constant", () => {
  it("is /howto (no trailing slash, no basePath baked in)", () => {
    expect(HOWTO_ROUTE).toBe("/howto");
  });
});

describe("HOWTO_IMAGES — every referenced asset exists (req #3)", () => {
  for (const [key, img] of Object.entries(HOWTO_IMAGES)) {
    it(`${key}: public/howto/assets/${img.file} exists`, () => {
      expect(existsSync(path.join(assetsDir, img.file))).toBe(true);
    });

    it(`${key}: filename has no duplicated extension`, () => {
      expect(img.file).not.toMatch(/\.png\.png$/i);
    });

    it(`${key}: has non-empty descriptive alt text`, () => {
      expect(img.alt.trim().length).toBeGreaterThan(1);
    });
  }
});

describe("Editor Page explanation (req #10)", () => {
  it("describes split/join in user-facing terms", () => {
    expect(EDITOR_PAGE_EXPLANATION_BODY).toContain("ここで区切る");
    expect(EDITOR_PAGE_EXPLANATION_BODY).toContain("前のページとつなぐ");
  });

  it("never leaks internal implementation terminology", () => {
    const forbidden = ["forcedBoundaries", "joinedRanges", "WINDOWED", "FULL"];
    for (const term of forbidden) {
      expect(EDITOR_PAGE_EXPLANATION_BODY).not.toContain(term);
    }
  });
});

describe("PDF filename explanation (req #11)", () => {
  it("matches the shipped safe-filename field, not the old post-export notice", () => {
    expect(PDF_FILENAME_EXPLANATION).toContain("保存ファイル名");
    expect(PDF_FILENAME_EXPLANATION).toContain(".pdf");
    expect(PDF_FILENAME_EXPLANATION).toContain("半角");
  });
});

describe("no deferred/experimental feature leakage in visible howto copy (req #9)", () => {
  const forbidden = [
    "V2レンダラー",
    "レンダラーV2",
    "forcedBoundaries",
    "joinedRanges",
    "WINDOWED",
    "クラウド共通チェックリスト",
  ];
  it("howto page source omits forbidden terms", () => {
    for (const term of forbidden) {
      expect(howtoPageSrc).not.toContain(term);
    }
  });
});

describe("routing safety — no doubled basePath (req #4)", () => {
  it("howto page never hardcodes /tatespun/howto or /tatespun/tatespun", () => {
    expect(howtoPageSrc).not.toContain("/tatespun/howto");
    expect(howtoPageSrc).not.toContain("/tatespun/tatespun");
  });

  it("home page never hardcodes /tatespun/howto or /tatespun/tatespun", () => {
    expect(homePageSrc).not.toContain("/tatespun/howto");
    expect(homePageSrc).not.toContain("/tatespun/tatespun");
  });

  it("uses withBasePath (not a hardcoded production origin) for /howto assets", () => {
    expect(howtoPageSrc).not.toContain("https://spuntales.net");
    expect(howtoPageSrc).toContain("withBasePath");
  });
});

describe("navigation wiring", () => {
  it("Home links to /howto (req #5)", () => {
    expect(homePageSrc).toContain('href="/howto"');
  });

  it("howto page links back to the bookshelf (req #6)", () => {
    expect(howtoPageSrc).toMatch(/href="\/"/);
  });

  it("howto page reuses the shared HelpModal, not a fork (req #7)", () => {
    expect(howtoPageSrc).toContain('import HelpModal from "@/components/HelpModal"');
    expect(howtoPageSrc).toContain("<HelpModal");
  });

  it("howto page reuses the shared BetaFeedbackModal, not a fork (req #8)", () => {
    expect(howtoPageSrc).toContain(
      'import BetaFeedbackModal from "@/components/BetaFeedbackModal"'
    );
    expect(howtoPageSrc).toContain("<BetaFeedbackModal");
  });
});

describe("accessibility basics (req #12)", () => {
  it("has exactly one h1", () => {
    const matches = howtoPageSrc.match(/<h1[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("every <img> tag carries an alt attribute", () => {
    const imgTags = howtoPageSrc.match(/<img\b[^>]*>/g) ?? [];
    expect(imgTags.length).toBeGreaterThan(0);
    for (const tag of imgTags) {
      expect(tag).toMatch(/\balt=/);
    }
  });
});
