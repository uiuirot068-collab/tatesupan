"use client";

/**
 * CST-PORT-016 (移植ロードマップ 8 / B6): 長い原稿の表示の速さを測るパネル（開発用）。
 * COLUMNSTAND の LongDocumentPerfPanel を TateSpun に移したもの。URL に `?perf=1`
 * を付けたときだけ右下に出る。ふつうの画面には出ない。
 */

import { useMemo, useState, type CSSProperties } from "react";
import {
  buildLongDocumentFixture,
  clearLongDocumentPerf,
  getLongDocumentPerfSamples,
  getLongDocumentPerfSummary,
  isLongDocumentPerfEnabled,
  LONG_DOCUMENT_FIXTURE_TARGETS,
  LONG_DOCUMENT_PERF_METRIC_LABELS,
  longDocumentEditOffset,
  type LongDocumentEditPosition,
  type LongDocumentFixtureKind,
  type LongDocumentPerfMetric,
} from "@/lib/longDocumentPerf";
import { resolveEditorSurfaceRolloutMode } from "@/lib/editorSurfaceRollout";

type Props = {
  content: string;
  /** 本文を直接書き換える（編集面を通らない） */
  onChange: (next: string) => void;
  /** 原稿全体を1回の編集として置き換える（「元に戻す」で前の原稿に戻せる） */
  onReplaceWholeText: (next: string) => void;
  /** 編集面の入力の道すじで `at` に `text` を入れる */
  onTypeAt: (at: number, text: string) => void;
};

type Target = (typeof LONG_DOCUMENT_FIXTURE_TARGETS)[number];

const POSITION_LABEL: Record<LongDocumentEditPosition, string> = { start: "冒頭", middle: "中央", end: "末尾" };

function nextFrames(count = 2) {
  return new Promise<void>((resolve) => {
    const tick = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => tick(remaining - 1));
    };
    tick(count);
  });
}

// サイトの CSS はボタン・選択欄の枠を消しているので、開発用パネルだけ枠を戻す
const CONTROL_STYLE: CSSProperties = {
  border: "1px solid #c9c2b8",
  borderRadius: 4,
  background: "#fff",
  padding: "2px 8px",
};

/** プレビューの待ち（180ms＋180ms）と組版が終わるのを待つ */
const SETTLE_MS = 900;

export default function LongDocumentPerfPanel({ content, onChange, onReplaceWholeText, onTypeAt }: Props) {
  const enabled = isLongDocumentPerfEnabled();
  const [collapsed, setCollapsed] = useState(false);
  const [target, setTarget] = useState<Target>(50_000);
  const [kind, setKind] = useState<LongDocumentFixtureKind>("plain");
  const [position, setPosition] = useState<LongDocumentEditPosition>("start");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [summaryTick, setSummaryTick] = useState(0);

  const summary = useMemo(
    () => getLongDocumentPerfSummary(),
    // summaryTick intentionally refreshes the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaryTick]
  );

  if (!enabled) return null;

  const finish = async (text: string) => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    setMessage(text);
    setSummaryTick((v) => v + 1);
    setRunning(false);
  };

  const loadFixture = async () => {
    if (
      content.length > 0 &&
      !window.confirm("今の原稿をテスト原稿に置き換えます。あとで「元に戻す」で戻せます。続けますか？")
    ) {
      return;
    }
    setRunning(true);
    setMessage("テスト原稿を作っています…");
    clearLongDocumentPerf();
    const fixture = buildLongDocumentFixture(target, kind);
    onReplaceWholeText(fixture);
    await nextFrames(3);
    await finish(`${fixture.length.toLocaleString()}字を読み込みました`);
  };

  const runEdits = async () => {
    setRunning(true);
    setMessage(`${POSITION_LABEL[position]}を20回計測中…`);
    clearLongDocumentPerf();
    let working = content;
    for (let i = 0; i < 20; i += 1) {
      const at = longDocumentEditOffset(working.length, position);
      working = working.slice(0, at) + (i % 2 === 0 ? "測" : "定") + working.slice(at);
      onChange(working);
      await nextFrames(2);
    }
    await finish("20回の計測が終わりました");
  };

  const runSurfaceEdits = async () => {
    setRunning(true);
    setMessage(`入力面で${POSITION_LABEL[position]}を20回計測中…`);
    clearLongDocumentPerf();
    let at = longDocumentEditOffset(content.length, position);
    for (let i = 0; i < 20; i += 1) {
      onTypeAt(at, i % 2 === 0 ? "測" : "定");
      at += 1;
      await nextFrames(2);
    }
    await finish("入力面の20回計測が終わりました");
  };

  const copyResults = async () => {
    // 原稿の文章は入れない（時間・文字数・ページ数だけ）
    const payload = {
      generatedAt: new Date().toISOString(),
      app: "TateSpun",
      chars: content.length,
      target,
      fixture: kind,
      editPosition: position,
      editorSurface: resolveEditorSurfaceRolloutMode(),
      summary: getLongDocumentPerfSummary(),
      samples: getLongDocumentPerfSamples(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setMessage("計測結果をコピーしました");
    } catch {
      setMessage("コピーできませんでした（DevTools で window.__TATESPUN_LONG_PERF__ を見てください）");
    }
  };

  const metricRows = Object.entries(summary) as [LongDocumentPerfMetric, NonNullable<(typeof summary)[LongDocumentPerfMetric]>][];
  const lastEditorPages = [...getLongDocumentPerfSamples()]
    .reverse()
    .find((sample) => sample.metric === "editorPagination")?.pages;

  return (
    <aside
      aria-label="長文の速度計測（開発用）"
      data-testid="long-document-perf-panel"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: collapsed ? 200 : 380,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "70vh",
        overflow: "auto",
        padding: 10,
        border: "1px solid #c9c2b8",
        borderRadius: 6,
        background: "rgba(255,253,248,0.97)",
        color: "#2b2622",
        font: "12px/1.5 system-ui, sans-serif",
        boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong>長文の速度計測（開発用）</strong>
        <button type="button" onClick={() => setCollapsed((v) => !v)} style={CONTROL_STYLE}>
          {collapsed ? "開く" : "たたむ"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <p style={{ margin: "4px 0 0", color: "#6b6470" }}>
            現在 {content.length.toLocaleString()}字
            {lastEditorPages !== undefined ? ` ／ 編集ページ ${lastEditorPages}` : ""}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
            <label>
              文字数
              <select
                value={target}
                onChange={(event) => setTarget(Number(event.target.value) as Target)}
                disabled={running}
                style={{ ...CONTROL_STYLE, width: "100%" }}
              >
                {LONG_DOCUMENT_FIXTURE_TARGETS.map((value) => (
                  <option key={value} value={value}>
                    {value.toLocaleString()}字
                  </option>
                ))}
              </select>
            </label>

            <label>
              原稿
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as LongDocumentFixtureKind)}
                disabled={running}
                style={{ ...CONTROL_STYLE, width: "100%" }}
              >
                <option value="plain">平文</option>
                <option value="ruby">ルビ・縦中横</option>
                <option value="structure">改ページ・記号</option>
              </select>
            </label>

            <label>
              編集位置
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value as LongDocumentEditPosition)}
                disabled={running}
                style={{ ...CONTROL_STYLE, width: "100%" }}
              >
                <option value="start">冒頭</option>
                <option value="middle">中央</option>
                <option value="end">末尾</option>
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="button" onClick={loadFixture} disabled={running} style={{ ...CONTROL_STYLE, width: "100%" }}>
                テスト原稿を作る
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={runEdits}
              disabled={running || content.length === 0}
              style={{ ...CONTROL_STYLE, flex: 1 }}
              title="本文を直接20回書き換えて測る"
            >
              20回計測
            </button>
            <button
              type="button"
              onClick={runSurfaceEdits}
              disabled={running || content.length === 0}
              style={{ ...CONTROL_STYLE, flex: 1 }}
              title="入力欄の編集の道すじで20回入力して測る"
            >
              入力面20回
            </button>
            <button type="button" onClick={copyResults} disabled={running} style={CONTROL_STYLE}>
              結果コピー
            </button>
            <button
              type="button"
              onClick={() => {
                clearLongDocumentPerf();
                setSummaryTick((v) => v + 1);
                setMessage("計測値を消しました");
              }}
              disabled={running}
              style={CONTROL_STYLE}
            >
              消去
            </button>
          </div>

          {message ? (
            <p role="status" style={{ margin: "8px 0 0" }}>
              {message}
            </p>
          ) : null}

          {metricRows.length ? (
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>項目</th>
                  <th>回</th>
                  <th>平均</th>
                  <th>p95</th>
                  <th>最大</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map(([metric, value]) => (
                  <tr key={metric} data-metric={metric}>
                    <td>{LONG_DOCUMENT_PERF_METRIC_LABELS[metric]}</td>
                    <td style={{ textAlign: "right" }}>{value.count}</td>
                    <td style={{ textAlign: "right" }}>{value.avgMs.toFixed(1)}</td>
                    <td style={{ textAlign: "right" }}>{value.p95Ms.toFixed(1)}</td>
                    <td style={{ textAlign: "right" }}>{value.maxMs.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {metricRows.length ? (
            <p style={{ margin: "4px 0 0", color: "#6b6470" }}>単位 ms</p>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
