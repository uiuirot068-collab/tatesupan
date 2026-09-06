// Decision trace (Core Contract §23). Observational only — recording must
// never influence the decisions it records. Every analysis function that
// accepts an optional TraceRecorder must return byte-identical results
// whether or not one is supplied (verified in breaks/opportunity.test.ts).

import type { SourceSpan } from "../source/span";

export interface TraceEvent {
  sourceSpan: SourceSpan;
  ruleApplied: string; // e.g. "cl-07 line-start prohibition" or "cl-23 jukugo internal break"
  alternativesConsidered: string[];
  outcome: string;
}

export interface LayoutDecisionTrace {
  // Which RuleSetVersion produced every event below (Contract §25
  // reproducibility requirement, hardened at P3-L06A). Stored once on the
  // container rather than duplicated onto every TraceEvent — a trace is
  // always produced by exactly one analysis run against exactly one
  // RuleSetVersion, so per-event duplication would be redundant, not safer.
  ruleSetVersion: string;
  events: TraceEvent[];
}

export interface TraceRecorder {
  record(event: TraceEvent): void;
  readonly trace: LayoutDecisionTrace;
}

export function createTraceRecorder(ruleSetVersion: string): TraceRecorder {
  const events: TraceEvent[] = [];
  return {
    record(event: TraceEvent) {
      events.push(event);
    },
    get trace(): LayoutDecisionTrace {
      return { ruleSetVersion, events };
    },
  };
}
