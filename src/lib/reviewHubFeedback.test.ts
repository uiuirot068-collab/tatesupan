import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_MESSAGE_LENGTH, validateSubmissionShape } from "./betaFeedback";
import { submitBetaFeedback } from "./betaFeedbackClient";
import type { FeedbackEnvironment } from "./feedbackEnvironment";
import { REVIEW_HUB_TOOLS } from "./reviewHub";
import {
  REVIEW_HUB_FAVORITES_MAX,
  REVIEW_HUB_FAVORITES_QUESTION,
  REVIEW_HUB_SLOT_ANSWERS,
  REVIEW_HUB_SLOT_QUESTION,
  REVIEW_HUB_SURVEY_NOTE_MAX,
  REVIEW_HUB_SURVEY_TAG,
  buildReviewHubSurveyMessage,
  canSubmitReviewHubSurvey,
  reviewHubFavoriteChoices,
  type ReviewHubSurveyInput,
} from "./reviewHubFeedback";
import { REVIEW_HUB_FOOTER_MAX } from "./reviewHubFooterPins";
import {
  REVIEW_HUB_USAGE_COUNT_CAP,
  getReviewHubSessionUsage,
  recordFooterPinChange,
  recordReviewHubOpen,
  resetReviewHubSessionUsageForTest,
} from "./reviewHubUsage";

/**
 * TSP-B3. The roadmap contract (§B3): Q1 + Q2 on the existing report modal;
 * questions never steer to "2 is right"; only real (released) Hub tools are
 * offered; nothing about the manuscript is ever part of the answer.
 */
const baseInput: ReviewHubSurveyInput = {
  slotAnswer: "one-more",
  favorites: ["writing-check", "character-count"],
  note: "",
  footerTools: ["writing-check", "character-count"],
  usage: { hubOpens: 3, pinChanges: 1 },
};

describe("B3 roadmap wording", () => {
  it("Q1 is the roadmap question, with the real footer maximum, and offers exactly the four roadmap choices in order", () => {
    expect(REVIEW_HUB_FOOTER_MAX).toBe(2);
    expect(REVIEW_HUB_SLOT_QUESTION).toBe("見直しのフッター表示は最大2枠で足りていますか？");
    expect(REVIEW_HUB_SLOT_ANSWERS.map((a) => a.label)).toEqual([
      "足りている",
      "もう1枠ほしい",
      "もっとほしい",
      "常時表示は不要",
    ]);
  });

  it("Q2 allows a maximum of 2 selections", () => {
    expect(REVIEW_HUB_FAVORITES_MAX).toBe(2);
    expect(REVIEW_HUB_FAVORITES_QUESTION).toContain("よく使っているものを選んでください");
    expect(REVIEW_HUB_FAVORITES_QUESTION).toContain("2つまで");
  });

  it("Q2 choices are exactly the tools the Hub offers today (registry-driven): no unreleased 描写語・修飾 / 音読 choice", () => {
    const labels = reviewHubFavoriteChoices().map((c) => c.label);
    expect(labels).toEqual(REVIEW_HUB_TOOLS.map((t) => t.title));
    expect(labels).toEqual(["文章チェックβ", "文字数カウント"]);
    expect(labels.join()).not.toMatch(/描写|修飾|音読|リズム|VOICEVOX|傍点/);
  });
});

describe("B3 message composition (what leaves the device)", () => {
  it("builds the complete, human-readable message from the answers + usage", () => {
    const { message } = buildReviewHubSurveyMessage(baseInput);
    expect(message).toBe(
      [
        "【見直しアンケート】",
        "Q1 見直しのフッター表示は最大2枠で足りていますか？: もう1枠ほしい",
        "Q2 見直しでよく使うもの: 文章チェックβ、文字数カウント",
        "フッターに表示中: 文章チェックβ → 文字数カウント（2/2）",
        "フッター表示を変えた回数: 1回（このページを開いてから）",
        "見直しを開いた回数: 3回（このページを開いてから）",
        "自由記述: （なし）",
      ].join("\n")
    );
  });

  it("starts with the filter tag so the Sheet row and the Discord thread title are recognisable", () => {
    expect(buildReviewHubSurveyMessage(baseInput).message.startsWith(REVIEW_HUB_SURVEY_TAG)).toBe(true);
  });

  it("shows 未回答 for unanswered questions, and 0/2 with なし when nothing is shown in the footer", () => {
    const { message, usageRows } = buildReviewHubSurveyMessage({
      ...baseInput,
      slotAnswer: null,
      favorites: [],
      footerTools: [],
      note: "使いやすかった",
    });
    expect(message).toContain("Q1 見直しのフッター表示は最大2枠で足りていますか？: 未回答");
    expect(message).toContain("Q2 見直しでよく使うもの: 未回答");
    expect(message).toContain("フッターに表示中: なし（0/2）");
    expect(message).toContain("自由記述: 使いやすかった");
    expect(usageRows[0]).toEqual(["フッターに表示中", "なし（0/2）"]);
  });

  it("reports the current footer order (single pin, and swapped order)", () => {
    expect(buildReviewHubSurveyMessage({ ...baseInput, footerTools: ["character-count"] }).usageRows[0][1]).toBe("文字数カウント（1/2）");
    expect(buildReviewHubSurveyMessage({ ...baseInput, footerTools: ["character-count", "writing-check"] }).usageRows[0][1]).toBe(
      "文字数カウント → 文章チェックβ（2/2）"
    );
  });

  it("the on-screen rows are exactly the usage lines of the message (no drift between what is shown and what is sent)", () => {
    const { message, usageRows } = buildReviewHubSurveyMessage(baseInput);
    for (const [label, value] of usageRows) expect(message).toContain(`${label}: ${value}`);
    expect(usageRows.map(([label]) => label)).toEqual(["フッターに表示中", "フッター表示を変えた回数", "見直しを開いた回数"]);
  });
});

describe("B3 privacy: the answer can only ever contain allowlisted choices, counters and the writer's own note", () => {
  it("drops unknown / duplicate / excess Q2 ids and unknown footer ids", () => {
    const { message } = buildReviewHubSurveyMessage({
      ...baseInput,
      favorites: ["writing-check", "writing-check", "read-aloud", "character-count", "writing-check"] as never,
      footerTools: ["writing-check", "secret-tool"] as never,
    });
    expect(message).toContain("Q2 見直しでよく使うもの: 文章チェックβ、文字数カウント");
    expect(message).not.toContain("read-aloud");
    expect(message).not.toContain("secret-tool");
    expect(message).toContain("フッターに表示中: 文章チェックβ（1/2）");
  });

  it("an unknown Q1 id never becomes an answer", () => {
    expect(buildReviewHubSurveyMessage({ ...baseInput, slotAnswer: "他の答え" as never }).message).toContain("見直しのフッター表示は最大2枠で足りていますか？: 未回答");
  });

  it("has no channel for manuscript content: extra fields (text, title, file name, ids, selection) are never read", () => {
    const smuggled = {
      ...baseInput,
      content: "吾輩は猫である。名前はまだ無い。",
      manuscript: "秘密の原稿",
      title: "作品タイトル",
      fileName: "novel-final.txt",
      documentId: "doc-1234",
      selectedText: "選択した文",
      characterNames: ["山田太郎"],
    } as unknown as ReviewHubSurveyInput;
    const { message, usageRows } = buildReviewHubSurveyMessage(smuggled);
    const everything = message + JSON.stringify(usageRows);
    for (const secret of ["吾輩は猫", "秘密の原稿", "作品タイトル", "novel-final", "doc-1234", "選択した文", "山田太郎"]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("sanitises the counters (NaN / negative / huge / fractional) into small bounded whole numbers", () => {
    const rows = (hubOpens: number, pinChanges: number) =>
      buildReviewHubSurveyMessage({ ...baseInput, usage: { hubOpens, pinChanges } }).usageRows.map(([, v]) => v);
    expect(rows(Number.NaN, -5)[1]).toBe("0回（このページを開いてから）");
    expect(rows(Number.NaN, -5)[2]).toBe("0回（このページを開いてから）");
    expect(rows(12345678, 2.9)[2]).toBe(`${REVIEW_HUB_USAGE_COUNT_CAP}回（このページを開いてから）`);
    expect(rows(12345678, 2.9)[1]).toBe("2回（このページを開いてから）");
  });

  it("carries only the writer's typed note, trimmed and capped; the whole message stays within the transport limit and is a valid feedback shape", () => {
    const { message } = buildReviewHubSurveyMessage({ ...baseInput, note: `  ${"あ".repeat(5000)}  ` });
    expect(message).toContain(`自由記述: ${"あ".repeat(REVIEW_HUB_SURVEY_NOTE_MAX)}`);
    expect(message).not.toContain("あ".repeat(REVIEW_HUB_SURVEY_NOTE_MAX + 1));
    expect(message.length).toBeLessThan(MAX_MESSAGE_LENGTH);
    expect(validateSubmissionShape({ type: "feedback", message, images: [] })).toEqual({ ok: true });
  });
});

describe("B3 submit gating", () => {
  it("needs at least one answer or note; a blank/whitespace note alone does not count", () => {
    const empty = { slotAnswer: null, favorites: [] as never[], note: "   " };
    expect(canSubmitReviewHubSurvey(empty)).toBe(false);
    expect(canSubmitReviewHubSurvey({ ...empty, slotAnswer: "enough" })).toBe(true);
    expect(canSubmitReviewHubSurvey({ ...empty, favorites: ["character-count"] })).toBe(true);
    expect(canSubmitReviewHubSurvey({ ...empty, note: "ここが分かりにくい" })).toBe(true);
    expect(canSubmitReviewHubSurvey({ ...empty, favorites: ["nope"] as never })).toBe(false);
  });
});

describe("B3 session usage counters are in-memory, bounded and side-effect free", () => {
  beforeEach(() => resetReviewHubSessionUsageForTest());

  it("counts opens and pin changes separately, starting from 0", () => {
    expect(getReviewHubSessionUsage()).toEqual({ hubOpens: 0, pinChanges: 0 });
    recordReviewHubOpen();
    recordReviewHubOpen();
    recordFooterPinChange();
    expect(getReviewHubSessionUsage()).toEqual({ hubOpens: 2, pinChanges: 1 });
  });

  it("is capped", () => {
    for (let i = 0; i < REVIEW_HUB_USAGE_COUNT_CAP + 50; i += 1) recordReviewHubOpen();
    expect(getReviewHubSessionUsage().hubOpens).toBe(REVIEW_HUB_USAGE_COUNT_CAP);
  });

  it("touches no storage and no network (it only mutates module memory)", () => {
    const fetchSpy = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage });
    try {
      recordReviewHubOpen();
      recordFooterPinChange();
      getReviewHubSessionUsage();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe("B3 rides the EXISTING feedback transport unchanged (no new endpoint / field)", () => {
  const environment = { osFamily: "Windows", viewportWidth: 390, viewportHeight: 800 } as unknown as FeedbackEnvironment;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a plain `feedback` payload to the same beta-feedback function; the survey text is just `message`", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test-key");
    const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ ok: true, reportId: "r1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { message } = buildReviewHubSurveyMessage(baseInput);
    const result = await submitBetaFeedback(
      { type: "feedback", message, images: [] },
      { turnstileToken: "tok", honeypot: "", environment }
    );

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/functions/v1/beta-feedback");
    expect(init.headers).toEqual({ apikey: "sb_publishable_test-key" });
    const form = init.body as FormData;
    const payload = JSON.parse(form.get("payload") as string);
    expect(Object.keys(payload).sort()).toEqual(["clientContext", "message", "turnstileToken", "type", "website"]);
    expect(payload.type).toBe("feedback");
    expect(payload.message).toBe(message);
    expect([...form.keys()]).toEqual(["payload"]); // no image parts
  });
});
