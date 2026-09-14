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

describe("Hero vs. menu-icon asset identity (QA correction 016A)", () => {
  // Regression guard: the original source assets had `hero-guide-illust.png`
  // and `guide-cat.png` as byte-identical files (a prep mistake) — the Hero
  // showed correctly, but the small sticky-nav icon wrongly reused the full
  // Hero illustration instead of the intended cropped cat-face icon.
  it("Hero uses the cat+PC+question-mark illustration", () => {
    expect(HOWTO_IMAGES.hero.file).toBe("hero-guide-illust.png");
  });

  it("the small nav/menu icon is a distinct asset from the Hero", () => {
    expect(HOWTO_IMAGES.guideCat.file).toBe("guide-cat-icon.png");
    expect(HOWTO_IMAGES.guideCat.file).not.toBe(HOWTO_IMAGES.hero.file);
  });

  it("Hero and menu-icon files are not byte-identical", () => {
    const heroBytes = readFileSync(path.join(assetsDir, HOWTO_IMAGES.hero.file));
    const iconBytes = readFileSync(path.join(assetsDir, HOWTO_IMAGES.guideCat.file));
    expect(heroBytes.equals(iconBytes)).toBe(false);
  });
});

describe("scrolling + top-anchor wiring (QA correction 016A)", () => {
  it("opts out of the app-shell scroll lock, same convention as / and /guide", () => {
    expect(howtoPageSrc).toContain("data-howto-page");
    const globalsCss = readFileSync(
      path.join(repoRoot, "src/app/globals.css"),
      "utf8"
    );
    expect(globalsCss).toContain("[data-howto-page]");
  });

  it("has a stable #howto-top Hero anchor, and the sticky brand links back to it", () => {
    expect(howtoPageSrc).toContain('id="howto-top"');
    expect(howtoPageSrc).toContain('href="#howto-top"');
  });
});

describe("Help is discoverable without scrolling to the bottom (QA correction 016A)", () => {
  it("offers a labelled (non-icon-only) Help trigger in the first-viewport hero nav", () => {
    expect(howtoPageSrc).toContain("ヘルプを見る");
  });

  it("offers a labelled Help trigger in the persistent sticky nav", () => {
    expect(howtoPageSrc).toContain("data-howto-help-cta=\"sticky-nav\"");
  });
});

describe("Home HOW TO entry is distinct from the Help entry (QA correction 016A)", () => {
  it("Home has a dedicated HOW TO quick-action card", () => {
    expect(homePageSrc).toContain("data-home-howto-card");
    expect(homePageSrc).toContain('href="/howto"');
  });

  it("the quick-actions grid (incl. the HOW TO card) is not gated to zero-work Home only", () => {
    const gridStart = homePageSrc.indexOf("data-home-howto-card");
    const onboardingGateStart = homePageSrc.indexOf("{onboarding && (");
    const onboardingGateEnd = homePageSrc.indexOf(
      ")}",
      homePageSrc.indexOf("data-home-onboarding-actions")
    );
    // The HOW TO card must sit outside the onboarding-only conditional block,
    // so it also renders for the returning-user (non-empty bookshelf) Home.
    expect(gridStart).toBeGreaterThan(-1);
    expect(gridStart > onboardingGateEnd || onboardingGateStart === -1).toBe(true);
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
