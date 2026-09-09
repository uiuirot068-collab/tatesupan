/**
 * TateSpun 11-B — Editor Session Metrics.
 *
 * This module measures manuscript editing activity only. It deliberately has
 * no dependency on typesetting, canonical layout, Preview, or publication.
 * All string quantities are Unicode code points (never UTF-16 code units).
 */

export interface SessionActivity {
  insertedCodePoints: number;
  deletedCodePoints: number;
  totalActivity: number;
}

export interface ActivityDelta {
  insertedCodePoints: number;
  deletedCodePoints: number;
}

export const ZERO_ACTIVITY: SessionActivity = Object.freeze({
  insertedCodePoints: 0,
  deletedCodePoints: 0,
  totalActivity: 0,
});

const ZERO_DELTA: ActivityDelta = Object.freeze({
  insertedCodePoints: 0,
  deletedCodePoints: 0,
});

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function activityDelta(
  deletedCodePoints: number,
  insertedCodePoints: number
): ActivityDelta {
  return {
    insertedCodePoints: Math.max(0, insertedCodePoints),
    deletedCodePoints: Math.max(0, deletedCodePoints),
  };
}

export function addActivity(current: SessionActivity, delta: ActivityDelta): SessionActivity {
  const insertedCodePoints = current.insertedCodePoints + delta.insertedCodePoints;
  const deletedCodePoints = current.deletedCodePoints + delta.deletedCodePoints;
  return {
    insertedCodePoints,
    deletedCodePoints,
    totalActivity: insertedCodePoints + deletedCodePoints,
  };
}

export function combineActivityDeltas(deltas: readonly ActivityDelta[]): ActivityDelta {
  return deltas.reduce(
    (sum, delta) => ({
      insertedCodePoints: sum.insertedCodePoints + delta.insertedCodePoints,
      deletedCodePoints: sum.deletedCodePoints + delta.deletedCodePoints,
    }),
    ZERO_DELTA
  );
}

export function reverseActivityDelta(delta: ActivityDelta): ActivityDelta {
  return {
    insertedCodePoints: delta.deletedCodePoints,
    deletedCodePoints: delta.insertedCodePoints,
  };
}

/**
 * Measures one contiguous resulting text mutation. Common code-point prefix
 * and suffix are retained; the changed middle is deletion + insertion.
 * This is used for ordinary typing/deletion and browser historyUndo/historyRedo.
 */
export function measureContiguousMutation(before: string, after: string): ActivityDelta {
  if (before === after) return ZERO_DELTA;

  const oldPoints = Array.from(before);
  const newPoints = Array.from(after);
  let prefix = 0;
  const maxPrefix = Math.min(oldPoints.length, newPoints.length);
  while (prefix < maxPrefix && oldPoints[prefix] === newPoints[prefix]) prefix += 1;

  let suffix = 0;
  const oldRemaining = oldPoints.length - prefix;
  const newRemaining = newPoints.length - prefix;
  while (
    suffix < oldRemaining &&
    suffix < newRemaining &&
    oldPoints[oldPoints.length - 1 - suffix] === newPoints[newPoints.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return activityDelta(
    oldPoints.length - prefix - suffix,
    newPoints.length - prefix - suffix
  );
}

/** An explicit replacement counts the full deleted and inserted operands. */
export function measureReplacement(deletedText: string, insertedText: string): ActivityDelta {
  return activityDelta(codePointLength(deletedText), codePointLength(insertedText));
}

export interface BeforeInputSnapshot {
  beforeText: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
}

function selectedText(snapshot: BeforeInputSnapshot): string {
  return snapshot.beforeText.slice(snapshot.selectionStart, snapshot.selectionEnd);
}

/**
 * Measures a browser beforeinput/input pair. Selection-aware insertion is
 * important: paste-over-selection and replacement count the whole selected
 * deletion plus the whole insertion, even when the two strings share text.
 */
export function measureBeforeInputCommit(
  snapshot: BeforeInputSnapshot,
  afterText: string
): ActivityDelta {
  if (snapshot.inputType === "historyUndo" || snapshot.inputType === "historyRedo") {
    return measureContiguousMutation(snapshot.beforeText, afterText);
  }

  const selectedCodePoints = codePointLength(selectedText(snapshot));
  const beforeLength = codePointLength(snapshot.beforeText);
  const afterLength = codePointLength(afterText);

  if (snapshot.inputType.startsWith("insert")) {
    const insertedCodePoints = afterLength - (beforeLength - selectedCodePoints);
    if (insertedCodePoints >= 0) {
      return activityDelta(selectedCodePoints, insertedCodePoints);
    }
  }

  if (snapshot.inputType.startsWith("delete")) {
    if (selectedCodePoints > 0) return activityDelta(selectedCodePoints, 0);
    return measureContiguousMutation(snapshot.beforeText, afterText);
  }

  return measureContiguousMutation(snapshot.beforeText, afterText);
}

interface CompositionSnapshot {
  beforeText: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface TextInputActivityState {
  lastText: string;
  pendingBeforeInput: BeforeInputSnapshot | null;
  composition: CompositionSnapshot | null;
}

export interface ActivityTransition {
  state: TextInputActivityState;
  delta: ActivityDelta;
}

export function createTextInputActivityState(text: string): TextInputActivityState {
  return { lastText: text, pendingBeforeInput: null, composition: null };
}

/** Syncs programmatic/load/structural changes without counting them. */
export function syncTextInputActivityState(
  state: TextInputActivityState,
  text: string
): TextInputActivityState {
  if (state.lastText === text) return state;
  return { ...state, lastText: text, pendingBeforeInput: null };
}

export function captureBeforeInput(
  state: TextInputActivityState,
  snapshot: BeforeInputSnapshot
): TextInputActivityState {
  if (state.composition) return state;
  return { ...state, pendingBeforeInput: snapshot };
}

export function startComposition(
  state: TextInputActivityState,
  text: string,
  selectionStart: number,
  selectionEnd: number
): TextInputActivityState {
  return {
    lastText: text,
    pendingBeforeInput: null,
    composition: { beforeText: text, selectionStart, selectionEnd },
  };
}

/** compositionupdate/intermediate input changes the live text but adds zero. */
export function applyTextInputChange(
  state: TextInputActivityState,
  afterText: string
): ActivityTransition {
  if (state.composition) {
    return {
      state: { ...state, lastText: afterText, pendingBeforeInput: null },
      delta: ZERO_DELTA,
    };
  }

  const pending = state.pendingBeforeInput;
  const delta =
    pending && pending.beforeText === state.lastText
      ? measureBeforeInputCommit(pending, afterText)
      : measureContiguousMutation(state.lastText, afterText);
  return {
    state: { lastText: afterText, pendingBeforeInput: null, composition: null },
    delta,
  };
}

/** Counts the final committed IME delta once; an unchanged/cancelled composition is zero. */
export function finishComposition(
  state: TextInputActivityState,
  finalText: string
): ActivityTransition {
  const composition = state.composition;
  if (!composition || composition.beforeText === finalText) {
    return {
      state: { lastText: finalText, pendingBeforeInput: null, composition: null },
      delta: ZERO_DELTA,
    };
  }

  const snapshot: BeforeInputSnapshot = {
    ...composition,
    inputType: "insertFromComposition",
  };
  return {
    state: { lastText: finalText, pendingBeforeInput: null, composition: null },
    delta: measureBeforeInputCommit(snapshot, finalText),
  };
}

export type ExcludedMutationSource =
  | "load-existing-manuscript"
  | "import"
  | "normalization"
  | "internal-migration"
  | "autosave"
  | "preview-recomposition"
  | "typesetting-recomposition"
  | "publication-generation"
  | "page-break-ui"
  | "image-ui"
  | "ruby-structural-transform"
  | "writing-check-analysis"
  | "writing-check-ignore"
  | "writing-check-settings";

export type EditorActivityOperation =
  | { kind: "manual-text"; before: string; after: string }
  | { kind: "explicit-replacements"; replacements: readonly { deletedText: string; insertedText: string }[] }
  | { kind: "ruby-ui"; userEdits: readonly { deletedText: string; insertedText: string }[] }
  | { kind: "excluded"; source: ExcludedMutationSource };

/** Central policy boundary for non-textarea Editor operations. */
export function measureEditorActivityOperation(operation: EditorActivityOperation): ActivityDelta {
  if (operation.kind === "excluded") return ZERO_DELTA;
  if (operation.kind === "manual-text") {
    return measureContiguousMutation(operation.before, operation.after);
  }
  const replacements = operation.kind === "ruby-ui" ? operation.userEdits : operation.replacements;
  return combineActivityDeltas(
    replacements.map(({ deletedText, insertedText }) =>
      measureReplacement(deletedText, insertedText)
    )
  );
}

export function formatSessionActivityShareText(activity: SessionActivity): string {
  return `このセッションで${activity.totalActivity}文字分編集しました（入力 ${activity.insertedCodePoints}文字・削除 ${activity.deletedCodePoints}文字） #TateSpun`;
}
