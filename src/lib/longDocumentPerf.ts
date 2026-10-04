/**
 * CST-PORT-016 (移植ロードマップ 8 / B6): 長い原稿の表示の速さを測る、開発用の
 * 計測。COLUMNSTAND の `src/lib/longDocumentPerf.ts` と同じ考え方で、URL に
 * `?perf=1` を付けたときだけ動く。付けていないときは各関数が真偽1つを見て
 * すぐ戻る（記録も確保もしない）。
 *
 * 記録するのは時間（ms）・文字数・ページ数だけ。原稿の文章・題名は残さない。
 *
 * `?perfDebug=1`（lib/perfDebug.ts、入力の詳しい追跡用）とは別の仕組み。
 * こちらは回数・平均・p95 の表にまとめて比べるためのもの。
 */

export type LongDocumentPerfMetric =
  /** 本文が変わってから次の描画まで（入力の重さ） */
  | "inputToNextFrame"
  /** 編集ページ（約5万字ごと）への分け直し */
  | "editorPagination"
  /** プレビューの組版（V2 ワーカーに頼んでから返事が来るまで） */
  | "previewCompose"
  /** 本文が変わってからプレビューに反映されるまで（待ち時間を含む） */
  | "inputToPreview"
  /** LEGACY 表示の組版（V2 の最初の組版ができるまで等） */
  | "legacyPaginate";

export const LONG_DOCUMENT_PERF_METRIC_LABELS: Record<LongDocumentPerfMetric, string> = {
  inputToNextFrame: "入力→次の描画",
  editorPagination: "編集ページ分け",
  previewCompose: "プレビュー組版",
  inputToPreview: "入力→プレビュー反映",
  legacyPaginate: "旧方式の組版",
};

export interface LongDocumentPerfSample {
  metric: LongDocumentPerfMetric;
  ms: number;
  chars: number;
  pages?: number;
  at: number;
}

export interface LongDocumentPerfSummaryRow {
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export type LongDocumentPerfSummary = Partial<Record<LongDocumentPerfMetric, LongDocumentPerfSummaryRow>>;

export interface LongDocumentPerfStore {
  enabled: true;
  samples: LongDocumentPerfSample[];
  clear: () => void;
  summary: () => LongDocumentPerfSummary;
}

declare global {
  interface Window {
    __TATESPUN_LONG_PERF__?: LongDocumentPerfStore;
  }
}

export const LONG_DOCUMENT_PERF_MAX_SAMPLES = 500;

/** 回数・平均・p95・最大（記録順は問わない） */
export function summarizeLongDocumentPerf(samples: readonly LongDocumentPerfSample[]): LongDocumentPerfSummary {
  const grouped = new Map<LongDocumentPerfMetric, number[]>();
  for (const sample of samples) {
    const values = grouped.get(sample.metric) ?? [];
    values.push(sample.ms);
    grouped.set(sample.metric, values);
  }
  const result: LongDocumentPerfSummary = {};
  for (const [metric, values] of grouped) {
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
    result[metric] = {
      count: sorted.length,
      avgMs: total / sorted.length,
      p95Ms: sorted[p95Index],
      maxMs: sorted[sorted.length - 1],
    };
  }
  return result;
}

export function createLongDocumentPerfStore(): LongDocumentPerfStore {
  const samples: LongDocumentPerfSample[] = [];
  return {
    enabled: true,
    samples,
    clear: () => {
      samples.splice(0, samples.length);
    },
    summary: () => summarizeLongDocumentPerf(samples),
  };
}

/** 古いものから捨てて最大 `LONG_DOCUMENT_PERF_MAX_SAMPLES` 件に保つ */
export function pushLongDocumentPerfSample(store: LongDocumentPerfStore, sample: LongDocumentPerfSample) {
  store.samples.push(sample);
  if (store.samples.length > LONG_DOCUMENT_PERF_MAX_SAMPLES) {
    store.samples.splice(0, store.samples.length - LONG_DOCUMENT_PERF_MAX_SAMPLES);
  }
}

let enabledCache: boolean | null = null;

export function isLongDocumentPerfEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === "undefined") return false;
  try {
    enabledCache = new URLSearchParams(window.location.search).get("perf") === "1";
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

function getStore(): LongDocumentPerfStore | null {
  if (!isLongDocumentPerfEnabled()) return null;
  if (!window.__TATESPUN_LONG_PERF__) {
    window.__TATESPUN_LONG_PERF__ = createLongDocumentPerfStore();
    console.info(
      "[TateSpun perf] Long-document probe enabled. " +
        "Use window.__TATESPUN_LONG_PERF__.summary() or .samples in DevTools."
    );
  }
  return window.__TATESPUN_LONG_PERF__;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function recordLongDocumentPerf(sample: Omit<LongDocumentPerfSample, "at">) {
  const store = getStore();
  if (!store) return;
  pushLongDocumentPerfSample(store, { ...sample, at: Date.now() });
}

/** `work` を測って記録する（計測しないときはそのまま実行するだけ） */
export function measureLongDocumentPerf<T>(
  metric: Extract<LongDocumentPerfMetric, "editorPagination" | "legacyPaginate">,
  chars: number,
  work: () => T,
  pagesOf?: (result: T) => number
): T {
  if (!isLongDocumentPerfEnabled()) return work();
  const startedAt = now();
  const result = work();
  recordLongDocumentPerf({ metric, ms: now() - startedAt, chars, pages: pagesOf?.(result) });
  return result;
}

/** 最後の本文変更（同じ文字列がプレビューに届いたら「入力→プレビュー反映」を記録） */
let pendingInput: { content: string; at: number } | null = null;

/** 本文が変わったとき（編集面・計測パネルの両方から）に呼ぶ */
export function noteLongDocumentInput(content: string) {
  if (!isLongDocumentPerfEnabled()) return;
  const startedAt = now();
  pendingInput = { content, at: startedAt };
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    recordLongDocumentPerf({ metric: "inputToNextFrame", ms: now() - startedAt, chars: content.length });
  });
}

/** プレビューの組版の返事を受け取ったとき（V2）に呼ぶ */
export function noteLongDocumentPreviewComposed(content: string, requestedAt: number, pages: number) {
  if (!isLongDocumentPerfEnabled()) return;
  recordLongDocumentPerf({ metric: "previewCompose", ms: now() - requestedAt, chars: content.length, pages });
  const input = pendingInput;
  if (!input || input.content !== content) return;
  pendingInput = null;
  const startedAt = input.at;
  const record = () =>
    recordLongDocumentPerf({ metric: "inputToPreview", ms: now() - startedAt, chars: content.length, pages });
  if (typeof requestAnimationFrame === "undefined") record();
  else requestAnimationFrame(record);
}

export function longDocumentPerfNow(): number {
  return now();
}

export function clearLongDocumentPerf() {
  getStore()?.clear();
  pendingInput = null;
}

export function getLongDocumentPerfSummary(): LongDocumentPerfSummary {
  return getStore()?.summary() ?? {};
}

export function getLongDocumentPerfSamples(): LongDocumentPerfSample[] {
  const store = getStore();
  return store ? [...store.samples] : [];
}

// ---- テスト原稿（計測パネル用、毎回同じ条件で比べられるよう決まった文） ----

export type LongDocumentFixtureKind = "plain" | "ruby" | "structure";
export type LongDocumentEditPosition = "start" | "middle" | "end";

export const LONG_DOCUMENT_FIXTURE_TARGETS = [50_000, 100_000, 300_000] as const;

const FIXTURE_BLOCKS: Record<LongDocumentFixtureKind, string> = {
  plain:
    "これはTateSpun長文計測用の本文です。文章の入力とページ組版の負荷を測ります。\n" +
    "同じ原稿を繰り返し作り、毎回同じ条件で比べられるようにしています。\n\n",
  ruby:
    "｜長文《ちょうぶん》の計測です。[tate]A5[/tate]判、12ページ、｜誌面《しめん》を確かめます。\n" +
    "｜文字組《もじぐみ》と34の縦中横を含め、解析の負荷の差を確かめます。\n\n",
  structure:
    "　計測の区切りです――段落と空行を含む構造の計測……。\n本文を組みます。\n\n【改ページ】\n" +
    "　次の章の書き出しです。\n\n",
};

export function buildLongDocumentFixture(target: number, kind: LongDocumentFixtureKind): string {
  const block = FIXTURE_BLOCKS[kind];
  let out = "";
  while (out.length < target) out += block;
  return out.slice(0, target);
}

/** 冒頭（1文字目の後）・中央・末尾（最後の1文字の前）に入れる位置 */
export function longDocumentEditOffset(length: number, position: LongDocumentEditPosition): number {
  if (position === "start") return Math.min(1, length);
  if (position === "middle") return Math.floor(length / 2);
  return Math.max(0, length - 1);
}
