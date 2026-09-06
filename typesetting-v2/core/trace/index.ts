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
  events: TraceEvent[];
}

export interface TraceRecorder {
  record(event: TraceEvent): void;
  readonly trace: LayoutDecisionTrace;
}

export function createTraceRecorder(): TraceRecorder {
  const events: TraceEvent[] = [];
  return {
    record(event: TraceEvent) {
      events.push(event);
    },
    get trace(): LayoutDecisionTrace {
      return { events };
    },
  };
}
