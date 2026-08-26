"use client";

/**
 * TateSpun Renderer PoC — Phase P1
 * Source → Token → Native HTML → Paged Preview Bridge
 *
 * このsectionだけがrepo外のscratch Vivliostyle PoC(bridge server)と通信
 * する。production Editor/Preview/PageCard/export とは一切接続していない。
 *
 * Bridge先(いずれもlocalhostのみ、TateSpun repoの外で動く一時プロセス):
 * - Vivliostyle preview static server: http://127.0.0.1:13020
 * - P1 bridge server (p1-bridge-server.mjs):  http://127.0.0.1:13021
 * どちらもこのPoC専用に手動起動するscratchプロセスで、production build
 * には一切含まれない。bridge未起動でもこのpage自体は例外を投げず、
 * エラーメッセージを表示するだけに留める。
 *
 * セキュリティ(P1 section 6):
 * - fetchはbridge serverのCORS allow-listで見た目のoriginを絞っている
 *   （実際の防御はbridge server側のOrigin検証。詳細はp1-bridge-server.mjs）。
 * - 送信するHTMLはp1Adapter.tsが構築したもののみ —— textareaのraw値を
 *   そのままinnerHTMLへ渡すことはしない。全てのtoken由来テキストは
 *   adapter内でescapeHtml()を通っている。
 * - iframeはsandbox属性で追加のtop-navigation等を制限する。
 */
import { useEffect, useRef, useState } from "react";
import { tokenizeTategaki } from "@/lib/tategaki";
import { tokensToP1Document } from "./p1Adapter";

const VIV_VIEWER_ORIGIN = "http://127.0.0.1:13020";
const BRIDGE_ORIGIN = "http://127.0.0.1:13021";
const DEBOUNCE_MS = 400;

const SAMPLE_SOURCE = `\
　通常段落です。

「会話文です」

｜花厳《かざり》

12月25日

だが男……花厳には――そう言った。

【改ページ】

　改ページ後の段落です。`;

interface P1Metrics {
  tokenCount: number;
  pages: number | null;
  elapsedMs: number | null;
  status: "idle" | "pending" | "ok" | "error";
  errorMessage?: string;
}

export default function P1Section() {
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [showGrid, setShowGrid] = useState(false);
  const [metrics, setMetrics] = useState<P1Metrics>({
    tokenCount: 0,
    pages: null,
    elapsedMs: null,
    status: "idle",
  });
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runPipeline(source, showGrid);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, showGrid]);

  async function runPipeline(currentSource: string, grid: boolean) {
    const seq = ++requestSeqRef.current;
    const tokenCount = tokenizeTategaki(currentSource).length;
    setMetrics((m) => ({ ...m, tokenCount, status: "pending" }));

    let html: string;
    try {
      html = tokensToP1Document(currentSource, { grid });
    } catch (err) {
      setMetrics({
        tokenCount,
        pages: null,
        elapsedMs: null,
        status: "error",
        errorMessage: `adapter error: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    try {
      const res = await fetch(`${BRIDGE_ORIGIN}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      if (seq !== requestSeqRef.current) return; // 新しい入力で上書きされた古いresponseは無視
      if (!res.ok) {
        const body = await res.text();
        setMetrics({
          tokenCount,
          pages: null,
          elapsedMs: null,
          status: "error",
          errorMessage: `bridge HTTP ${res.status}: ${body.slice(0, 200)}`,
        });
        return;
      }
      const data = (await res.json()) as { pages: number | null; elapsedMs: number; timedOut: boolean };
      setMetrics({
        tokenCount,
        pages: data.pages,
        elapsedMs: data.elapsedMs,
        status: data.timedOut ? "error" : "ok",
        errorMessage: data.timedOut ? "typeset timeout (bridge)" : undefined,
      });
      setIframeSrc(
        `${VIV_VIEWER_ORIGIN}/__vivliostyle-viewer/index.html#src=${VIV_VIEWER_ORIGIN}/vivliostyle/current.html?v=${Date.now()}&bookMode=false&renderAllPages=true`
      );
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setMetrics({
        tokenCount,
        pages: null,
        elapsedMs: null,
        status: "error",
        errorMessage: `bridge unreachable — start p1-bridge-server.mjs + vivliostyle preview (scratch, repo外). ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  return (
    <section className="poc-diag-section">
      <h2>Phase P1: Source → Token → Native HTML → Paged Preview Bridge</h2>
      <p className="poc-note">
        既存 <code>tokenizeTategaki()</code>{" "}
        をそのまま再利用し、TategakiToken[]を安全なHTML文書へ変換して、repo外のscratch
        Vivliostyle PoC（bridge server経由）へ送っています。FixedSlot /
        paginateTokensByLines / buildLineSlots は一切使用していません。Bridgeが未起動の場合はエラー表示になります（production側には影響しません）。
      </p>

      <div className="poc-p1-layout">
        <div className="poc-p1-editor">
          <label className="poc-p1-label" htmlFor="p1-textarea">
            TateSpun source（編集するとdebounce後に自動再送信）
          </label>
          <textarea
            id="p1-textarea"
            className="poc-p1-textarea"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="poc-p1-preview">
          <div className="poc-p1-metrics">
            <span>token count: {metrics.tokenCount}</span>
            <span>generated pages: {metrics.pages ?? "—"}</span>
            <span>last pagination time: {metrics.elapsedMs !== null ? `${metrics.elapsedMs}ms` : "—"}</span>
            <span className={`poc-p1-status poc-p1-status-${metrics.status}`}>{metrics.status}</span>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />{" "}
              2D diagnostic grid（観察専用、layoutには不使用）
            </label>
          </div>
          {metrics.errorMessage && <div className="poc-p1-error">{metrics.errorMessage}</div>}
          {iframeSrc ? (
            <iframe
              key={iframeSrc}
              className="poc-p1-iframe"
              src={iframeSrc}
              sandbox="allow-scripts allow-same-origin"
              title="P1 Paged Preview (Vivliostyle, scratch)"
            />
          ) : (
            <div className="poc-p1-iframe poc-p1-iframe-placeholder">
              まだpreviewを取得していません（bridge応答待ち、または未起動）
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
