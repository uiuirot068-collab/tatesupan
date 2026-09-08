/**
 * Writing Check β 2.0 presets (Phase 3, Human-approved exact names):
 * 入稿前おすすめ / 記号だけ / しっかりチェック. Each preset is a real
 * `ruleOverrides` map (relative to the engine's own default set) plus
 * whether dictionary/NG-word entries participate -- never a hardcoded
 * duplicate rule list, so adding a future rule to the engine's own
 * default set automatically flows into 入稿前おすすめ/しっかりチェック
 * without editing this file (only 記号だけ's own deliberately narrow
 * whitelist needs an explicit new entry when a new PUNCTUATION rule is
 * added).
 *
 * Selecting a preset only sets the STARTING configuration -- the user
 * may still individually toggle any rule afterward (see
 * `WritingCheckSettingsPanel.tsx`).
 */
import type { WritingCheckPresetId, WritingRuleId } from "./types";

export const PRESET_LABELS: Record<WritingCheckPresetId, string> = {
  "submission-recommended": "入稿前おすすめ",
  "symbols-only": "記号だけ",
  thorough: "しっかりチェック",
};

export interface PresetDefinition {
  ruleOverrides: Partial<Record<WritingRuleId, boolean>>;
}

// 記号だけ: punctuation/notation structural rules only -- no
// paragraph/whitespace, no character-set review, no dictionary/NG.
const SYMBOLS_ONLY_ENABLED: WritingRuleId[] = ["R1-bracket", "R2-punct", "R3-tcy", "R3-ruby", "R9-ellipsis", "R10-dash"];

export const ALL_TOGGLEABLE_RULE_IDS: WritingRuleId[] = [
  "R1-bracket",
  "R2-punct",
  "R3-tcy",
  "R3-ruby",
  "R4-halfwidth-kana",
  "R5-control-char",
  "R6-trailing-whitespace",
  "R7-mixed-indent",
  "R8-blank-run",
  "R9-ellipsis",
  "R10-dash",
  "R11-dictionary",
  "R12-ngword",
];

export const PRESET_DEFINITIONS: Record<WritingCheckPresetId, PresetDefinition> = {
  // Engine defaults already are "every mechanical rule except R8" -- 入
  // 稿前おすすめ additionally turns on R8 (blank-run) and the
  // dictionary/NG rules (a no-op unless the user has entries configured).
  "submission-recommended": {
    ruleOverrides: { "R8-blank-run": true, "R11-dictionary": true, "R12-ngword": true },
  },
  "symbols-only": {
    ruleOverrides: Object.fromEntries(ALL_TOGGLEABLE_RULE_IDS.map((id) => [id, SYMBOLS_ONLY_ENABLED.includes(id)])),
  },
  // しっかりチェック: every rule on, including the style-sensitive R8.
  thorough: {
    ruleOverrides: Object.fromEntries(ALL_TOGGLEABLE_RULE_IDS.map((id) => [id, true])),
  },
};
