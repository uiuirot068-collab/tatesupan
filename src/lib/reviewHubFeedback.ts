/**
 * TSP-B3 「見直し」フィードバック — pure model (no React, no DOM, no storage).
 *
 * Roadmap B3: two questions on the existing β report (報告) modal so the
 * Review Hub and the max-2 footer display can be judged on evidence.
 *
 * TRANSPORT: none of its own. The answers are composed into ONE plain-text
 * `message` and go out as a normal `feedback` submission through the existing
 * `submitBetaFeedback` -> Supabase Edge Function `beta-feedback` -> Discord
 * forum thread + Spreadsheet row. No new endpoint, table, field or function.
 *
 * PRIVACY: `buildReviewHubSurveyMessage` accepts ONLY
 *   - a Q1 choice id and Q2 tool ids (both mapped through fixed allowlists;
 *     anything else is dropped),
 *   - the footer display tool ids (allowlisted),
 *   - two small session counters,
 *   - the writer's own free text (typed into this form's textarea).
 * It has no parameter that could carry manuscript text, a title, a file name,
 * a document id or a selection, so it cannot include them.
 */
import { REVIEW_HUB_TOOLS, type ReviewHubToolId } from "./reviewHub";
import {
  REVIEW_HUB_FOOTER_MAX,
  type ReviewHubFooterToolId,
} from "./reviewHubFooterPins";
import { REVIEW_HUB_USAGE_COUNT_CAP, type ReviewHubSessionUsage } from "./reviewHubUsage";

export const REVIEW_HUB_SURVEY_TAB_LABEL = "見直し";

/** First line of every survey message: makes them filterable in the Sheet and readable in the Discord thread title. */
export const REVIEW_HUB_SURVEY_TAG = "【見直しアンケート】";

export const REVIEW_HUB_SURVEY_INTRO =
  "「見直し」を使ったことがある方だけ、分かる範囲でお答えください。答えなくても、下の自由記述だけでも送れます。";

/** Roadmap B3 Q1 wording. The number is read from the real limit so the question can never drift from the product. */
export const REVIEW_HUB_SLOT_QUESTION = `見直しのフッター表示は最大${REVIEW_HUB_FOOTER_MAX}枠で足りていますか？`;

export const REVIEW_HUB_SLOT_ANSWERS = [
  { id: "enough", label: "足りている" },
  { id: "one-more", label: "もう1枠ほしい" },
  { id: "more", label: "もっとほしい" },
  { id: "no-always-show", label: "常時表示は不要" },
] as const;
export type ReviewHubSlotAnswerId = (typeof REVIEW_HUB_SLOT_ANSWERS)[number]["id"];

/** Roadmap B3 Q2: maximum 2 selections. */
export const REVIEW_HUB_FAVORITES_MAX = 2 as const;
export const REVIEW_HUB_FAVORITES_QUESTION = `「見直し」の中で、よく使っているものを選んでください（${REVIEW_HUB_FAVORITES_MAX}つまで）`;

/** Q2 choices are the tools the Hub really offers (its registry), so an unreleased tool can never be asked about. */
export function reviewHubFavoriteChoices(): ReadonlyArray<{ id: ReviewHubToolId; label: string }> {
  return REVIEW_HUB_TOOLS.map((tool) => ({ id: tool.id, label: tool.title }));
}

export const REVIEW_HUB_SURVEY_NOTE_LABEL = "自由記述（任意）";
export const REVIEW_HUB_SURVEY_NOTE_MAX = 1000;
export const REVIEW_HUB_SURVEY_NOTE_WARNING =
  "原稿の文章・作品名・ファイル名は書かないでください（内容は自動では送られません）。";

export interface ReviewHubSurveyInput {
  slotAnswer: ReviewHubSlotAnswerId | null;
  favorites: readonly ReviewHubToolId[];
  note: string;
  /** Tools currently shown in the footer, in footer order (B2 selection). */
  footerTools: readonly ReviewHubFooterToolId[];
  usage: ReviewHubSessionUsage;
}

export interface ReviewHubSurveyOutput {
  /** The exact text sent as the `feedback` message. */
  message: string;
  /** The same facts as label/value rows, for the on-screen 「一緒に送られる情報」 list. */
  usageRows: Array<[string, string]>;
}

/** Q2 selection rule: toggle one tool; a selection beyond the maximum is refused (the list is returned unchanged). */
export function toggleReviewHubFavorite(
  favorites: readonly ReviewHubToolId[],
  id: ReviewHubToolId,
): ReviewHubToolId[] {
  if (favorites.includes(id)) return favorites.filter((existing) => existing !== id);
  if (favorites.length >= REVIEW_HUB_FAVORITES_MAX) return [...favorites];
  return [...favorites, id];
}

const UNANSWERED = "未回答";

const toolTitle = (id: string): string | undefined => REVIEW_HUB_TOOLS.find((tool) => tool.id === id)?.title;

function cleanFavorites(favorites: readonly string[]): string[] {
  const titles: string[] = [];
  for (const id of favorites) {
    const title = toolTitle(id);
    if (title && !titles.includes(title)) titles.push(title);
    if (titles.length === REVIEW_HUB_FAVORITES_MAX) break;
  }
  return titles;
}

const cappedCount = (value: number): number =>
  Number.isFinite(value) ? Math.min(REVIEW_HUB_USAGE_COUNT_CAP, Math.max(0, Math.floor(value))) : 0;

/** Has the writer given at least one answer (or free text)? Nothing to send otherwise. */
export function canSubmitReviewHubSurvey(input: Pick<ReviewHubSurveyInput, "slotAnswer" | "favorites" | "note">): boolean {
  return (
    input.slotAnswer !== null ||
    cleanFavorites(input.favorites).length > 0 ||
    input.note.trim().length > 0
  );
}

export function buildReviewHubSurveyMessage(input: ReviewHubSurveyInput): ReviewHubSurveyOutput {
  const slotLabel =
    REVIEW_HUB_SLOT_ANSWERS.find((answer) => answer.id === input.slotAnswer)?.label ?? UNANSWERED;
  const favoriteTitles = cleanFavorites(input.favorites);
  const footerTitles = input.footerTools.map(toolTitle).filter((title): title is string => Boolean(title));
  const footerText = `${footerTitles.length ? footerTitles.join(" → ") : "なし"}（${footerTitles.length}/${REVIEW_HUB_FOOTER_MAX}）`;
  const opens = cappedCount(input.usage.hubOpens);
  const pinChanges = cappedCount(input.usage.pinChanges);
  const note = input.note.trim().slice(0, REVIEW_HUB_SURVEY_NOTE_MAX);

  const usageRows: Array<[string, string]> = [
    ["フッターに表示中", footerText],
    ["フッター表示を変えた回数", `${pinChanges}回（このページを開いてから）`],
    ["見直しを開いた回数", `${opens}回（このページを開いてから）`],
  ];

  const message = [
    REVIEW_HUB_SURVEY_TAG,
    `Q1 ${REVIEW_HUB_SLOT_QUESTION}: ${slotLabel}`,
    `Q2 見直しでよく使うもの: ${favoriteTitles.length ? favoriteTitles.join("、") : UNANSWERED}`,
    ...usageRows.map(([label, value]) => `${label}: ${value}`),
    `自由記述: ${note || "（なし）"}`,
  ].join("\n");

  return { message, usageRows };
}
