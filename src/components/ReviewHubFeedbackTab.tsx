"use client";

import type { ReviewHubToolId } from "@/lib/reviewHub";
import {
  REVIEW_HUB_FAVORITES_MAX,
  REVIEW_HUB_FAVORITES_QUESTION,
  REVIEW_HUB_SLOT_ANSWERS,
  REVIEW_HUB_SLOT_QUESTION,
  REVIEW_HUB_SURVEY_INTRO,
  REVIEW_HUB_SURVEY_NOTE_LABEL,
  REVIEW_HUB_SURVEY_NOTE_MAX,
  REVIEW_HUB_SURVEY_NOTE_WARNING,
  reviewHubFavoriteChoices,
  toggleReviewHubFavorite,
  type ReviewHubSlotAnswerId,
} from "@/lib/reviewHubFeedback";

/**
 * TSP-B3 「見直し」tab of the β report modal. Presentational only: the modal
 * owns the answers and the sending (through the existing feedback transport).
 * It reads no editor content and takes none as a prop.
 */
export interface ReviewHubSurveyAnswers {
  slotAnswer: ReviewHubSlotAnswerId | null;
  favorites: ReviewHubToolId[];
  note: string;
}

interface ReviewHubFeedbackTabProps {
  answers: ReviewHubSurveyAnswers;
  onChange: (next: ReviewHubSurveyAnswers) => void;
  /** Label/value rows that will travel with the answers (built by the same function that builds the message). */
  usageRows: ReadonlyArray<readonly [string, string]>;
}

const OPTION = "flex items-center gap-2 text-sm text-ink";

export default function ReviewHubFeedbackTab({ answers, onChange, usageRows }: ReviewHubFeedbackTabProps) {
  const favoriteChoices = reviewHubFavoriteChoices();
  const favoritesFull = answers.favorites.length >= REVIEW_HUB_FAVORITES_MAX;

  return (
    <div data-review-hub-survey="" className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-ink/70">{REVIEW_HUB_SURVEY_INTRO}</p>

      <fieldset data-review-hub-survey-slot="" className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-ink">{REVIEW_HUB_SLOT_QUESTION}</legend>
        {REVIEW_HUB_SLOT_ANSWERS.map((answer) => (
          <label key={answer.id} className={OPTION}>
            <input
              type="radio"
              name="review-hub-slot-answer"
              value={answer.id}
              checked={answers.slotAnswer === answer.id}
              onChange={() => onChange({ ...answers, slotAnswer: answer.id })}
              className="h-3.5 w-3.5 accent-accent"
            />
            {answer.label}
          </label>
        ))}
      </fieldset>

      <fieldset data-review-hub-survey-favorites="" className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-ink">{REVIEW_HUB_FAVORITES_QUESTION}</legend>
        {favoriteChoices.map((choice) => {
          const checked = answers.favorites.includes(choice.id);
          return (
            <label key={choice.id} className={`${OPTION} ${!checked && favoritesFull ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && favoritesFull}
                onChange={() =>
                  onChange({ ...answers, favorites: toggleReviewHubFavorite(answers.favorites, choice.id) })
                }
                className="h-3.5 w-3.5 accent-accent"
              />
              {choice.label}
            </label>
          );
        })}
      </fieldset>

      <label className="flex flex-col gap-1 text-xs text-ink/70">
        {REVIEW_HUB_SURVEY_NOTE_LABEL}
        <textarea
          data-review-hub-survey-note=""
          value={answers.note}
          onChange={(event) => onChange({ ...answers, note: event.target.value })}
          rows={3}
          maxLength={REVIEW_HUB_SURVEY_NOTE_MAX}
          className="w-full resize-y rounded border border-ink/20 bg-base p-2 text-sm text-ink outline-none focus:border-ink/40"
        />
        <span className="text-[11px] text-amber-700">{REVIEW_HUB_SURVEY_NOTE_WARNING}</span>
      </label>

      <section
        data-review-hub-survey-usage=""
        aria-label="回答と一緒に送られる情報"
        className="rounded border border-ink/10 bg-ink/[0.025] p-2"
      >
        <h3 className="text-xs font-semibold text-ink">【回答と一緒に送られる情報】</h3>
        <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[11px] text-ink/70">
          {usageRows.map(([label, detail]) => (
            <div key={label} className="contents">
              <dt className="font-medium text-ink/60">{label}:</dt>
              <dd className="min-w-0 break-words">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
