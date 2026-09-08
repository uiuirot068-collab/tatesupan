"use client";

import { useCallback } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import { PRESET_DEFINITIONS, type WritingCheckPresetId, type WritingRuleId } from "@/lib/writingCheckEngine";

interface RuleConfigState {
  /** null = the user has diverged from any preset via an individual toggle ("custom"). */
  presetId: WritingCheckPresetId | null;
  ruleOverrides: Partial<Record<WritingRuleId, boolean>>;
}

// Human-approved default preset on first visit: 入稿前おすすめ.
const DEFAULT_STATE: RuleConfigState = {
  presetId: "submission-recommended",
  ruleOverrides: PRESET_DEFINITIONS["submission-recommended"].ruleOverrides,
};

const STORAGE_KEY = "tatespun_writing_check_rule_config";
const useRuleConfigStorage = createJsonLocalStorageHook<RuleConfigState>(STORAGE_KEY, DEFAULT_STATE);

/**
 * Preset selection + individual per-rule overrides (文章チェック設定). A
 * preset only sets the STARTING configuration -- selecting one afterward
 * always applies fresh (never merges with the previous state), while an
 * individual toggle marks the state "custom" (`presetId: null`) so the UI
 * never shows a preset as selected when the user has since diverged from
 * it.
 */
export function useWritingCheckRuleConfig() {
  const [state, setState] = useRuleConfigStorage();

  const selectPreset = useCallback(
    (presetId: WritingCheckPresetId) => {
      setState({ presetId, ruleOverrides: PRESET_DEFINITIONS[presetId].ruleOverrides });
    },
    [setState]
  );

  const setRuleEnabled = useCallback(
    (ruleId: WritingRuleId, enabled: boolean) => {
      setState({ presetId: null, ruleOverrides: { ...state.ruleOverrides, [ruleId]: enabled } });
    },
    [state, setState]
  );

  return { presetId: state.presetId, ruleOverrides: state.ruleOverrides, selectPreset, setRuleEnabled };
}
