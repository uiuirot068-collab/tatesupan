"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { BASE_PATH } from "@/lib/basePath";
import {
  CANONICAL_ORIGIN,
  canonicalUrl,
  isOldAddress,
  MOVE_DONE,
  MOVE_READY,
  MOVE_WORKS,
  moveFilename,
  OLD_ORIGIN,
  readMovePayload,
  type BookshelfMovePayload,
} from "@/lib/bookshelfMove";
import { countMovableWorks, exportBookshelf, importBookshelf, type BookshelfMoveResult } from "@/lib/db";

/**
 * TSP-SAFE-006: TateSpun's bookshelf is the one at spuntales.net (なつお, 10/19).
 * At the old address (tatespun.pages.dev) an empty bookshelf goes straight to
 * spuntales.net; one with works says so and moves them (never dropping them).
 * At spuntales.net, `?move=1` (opened by the old address) or `?move=file`
 * receives them.
 */

const LOCAL_DOCUMENT_LIMIT = 60;
const MOVED_AT_KEY = "tatespun:bookshelf-moved-at";
const NO_ANSWER_MS = 60_000;

const FULL_MESSAGE = `spuntales.net の本棚がいっぱい（${LOCAL_DOCUMENT_LIMIT}作品）のため、移せませんでした。spuntales.net で使わない作品をゴミ箱に移してから、もう一度お試しください。`;
const FAILED_MESSAGE = "作品を移せませんでした。下の「ファイルに書き出す」もお試しください。";

function readMovedAt(): number | null {
  try {
    const value = Number(window.localStorage.getItem(MOVED_AT_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeMovedAt(at: number): void {
  try {
    window.localStorage.setItem(MOVED_AT_KEY, String(at));
  } catch {
    // best effort: the notice simply stays
  }
}

function resultText(result: BookshelfMoveResult): string {
  if (result.works + result.trash === 0) return "どの作品も、もう spuntales.net の本棚に移してありました。";
  const parts = [`${result.works}作品`];
  if (result.trash > 0) parts.push(`ゴミ箱の${result.trash}作品`);
  const moved = `${parts.join("と")}を spuntales.net の本棚に移しました。`;
  return result.skipped > 0 ? `${moved}（${result.skipped}作品はもう移してあったので、そのままにしました）` : moved;
}

const bandClass =
  "w-full border-b border-[#17243a]/15 bg-[#f4f0e7] px-4 py-4 text-[#17243a] sm:px-6 dark:border-[#e4dfd3]/15 dark:bg-[#10151d] dark:text-[#e4dfd3]";
const primaryClass =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-[#17243a] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[#c6af63] dark:text-[#10151d]";
const secondaryClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-[#17243a]/25 px-5 py-2 text-sm font-semibold transition-colors hover:bg-[#17243a]/5 disabled:opacity-50 dark:border-[#e4dfd3]/25 dark:hover:bg-[#e4dfd3]/5";

type OldPhase =
  | { kind: "ready" }
  | { kind: "sending" }
  | { kind: "done"; text: string }
  | { kind: "problem"; text: string }
  | { kind: "exported" };

function OldAddressPanel({ works, trash }: { works: number | null; trash: number }) {
  const [phase, setPhase] = useState<OldPhase>({ kind: "ready" });
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const moveByWindow = useCallback(() => {
    cleanupRef.current?.();
    const target = window.open(`${CANONICAL_ORIGIN}${BASE_PATH}/?move=1`, "_blank");
    if (!target) {
      setPhase({ kind: "problem", text: "新しいタブを開けませんでした。下の「ファイルに書き出す」をお使いください。" });
      return;
    }
    setPhase({ kind: "sending" });
    let sent: BookshelfMovePayload | null = null;
    const finish = (next: OldPhase) => {
      cleanupRef.current?.();
      setPhase(next);
    };
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== CANONICAL_ORIGIN || event.source !== target) return;
      const data = event.data as { type?: unknown; result?: unknown } | null;
      if (data?.type === MOVE_READY && !sent) {
        try {
          sent = await exportBookshelf();
          target.postMessage({ type: MOVE_WORKS, payload: sent }, CANONICAL_ORIGIN);
        } catch {
          finish({ kind: "problem", text: FAILED_MESSAGE });
        }
      } else if (data?.type === MOVE_DONE && sent) {
        const result = data.result as BookshelfMoveResult | "full" | "failed" | undefined;
        if (result === "full") finish({ kind: "problem", text: FULL_MESSAGE });
        else if (!result || result === "failed") finish({ kind: "problem", text: FAILED_MESSAGE });
        else {
          // Works changed here after this point bring the notice back.
          writeMovedAt(sent.exportedAt);
          finish({ kind: "done", text: resultText(result) });
        }
      }
    };
    const timer = window.setTimeout(
      () => finish({ kind: "problem", text: "spuntales.net から返事がありませんでした。下の「ファイルに書き出す」もお試しください。" }),
      NO_ANSWER_MS
    );
    window.addEventListener("message", onMessage);
    cleanupRef.current = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      cleanupRef.current = null;
    };
  }, []);

  const exportToFile = useCallback(async () => {
    try {
      const payload = await exportBookshelf();
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = moveFilename(new Date(payload.exportedAt));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setPhase({ kind: "exported" });
    } catch {
      setPhase({ kind: "problem", text: "ファイルに書き出せませんでした。" });
    }
  }, []);

  const busy = phase.kind === "sending";
  return (
    <section className={bandClass} aria-labelledby="bookshelf-move-title" data-bookshelf-move="old">
      <div className="mx-auto max-w-[960px]">
        <h2 id="bookshelf-move-title" className="font-serif text-base font-semibold text-[#17243a] dark:text-[#e4dfd3]">
          本棚の場所が変わりました
        </h2>
        <p className="mt-1 text-sm leading-7">
          TateSpun の本棚は spuntales.net に移りました。このアドレス（tatespun.pages.dev）の本棚にある
          {works === null ? "作品" : `${works}作品${trash > 0 ? `（ゴミ箱に${trash}作品）` : ""}`}は、そのままでは spuntales.net に出てきません。下のボタンで移してください。ここにある作品は消えません。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={primaryClass} onClick={moveByWindow} disabled={busy}>
            {busy ? "移しています…" : "作品を spuntales.net に移す"}
          </button>
          <button type="button" className={secondaryClass} onClick={() => void exportToFile()} disabled={busy}>
            ファイルに書き出す
          </button>
        </div>
        <div aria-live="polite" className="mt-2 text-sm leading-7">
          {busy && <p>spuntales.net のタブが開きます。開いたタブは閉じずにお待ちください。</p>}
          {phase.kind === "done" && (
            <p>
              {phase.text}{" "}
              <a className="underline underline-offset-4" href={`${CANONICAL_ORIGIN}${BASE_PATH}/`}>
                spuntales.net の本棚を開く
              </a>
            </p>
          )}
          {phase.kind === "problem" && <p role="alert">{phase.text}</p>}
          {phase.kind === "exported" && (
            <p>
              書き出しました。spuntales.net で「ファイルから読み込む」を押して、このファイルを選んでください。{" "}
              <a className="underline underline-offset-4" href={`${CANONICAL_ORIGIN}${BASE_PATH}/?move=file`}>
                spuntales.net で読み込む
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

type ReceivePhase =
  | { kind: "waiting" }
  | { kind: "file" }
  | { kind: "moving" }
  | { kind: "done"; text: string }
  | { kind: "problem"; text: string };

async function receive(payload: BookshelfMovePayload | null): Promise<BookshelfMoveResult | "full" | "failed"> {
  if (!payload) return "failed";
  try {
    return await importBookshelf(payload, LOCAL_DOCUMENT_LIMIT);
  } catch {
    return "failed";
  }
}

function phaseFor(result: BookshelfMoveResult | "full" | "failed"): ReceivePhase {
  if (result === "full") return { kind: "problem", text: FULL_MESSAGE };
  if (result === "failed") return { kind: "problem", text: "作品を受け取れませんでした。もう一度お試しください。" };
  return { kind: "done", text: resultText(result) };
}

function ReceivePanel({ byWindow, onClose }: { byWindow: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<ReceivePhase>(byWindow ? { kind: "waiting" } : { kind: "file" });

  useEffect(() => {
    if (!byWindow) return;
    const opener = window.opener as Window | null;
    if (!opener) return;
    // Said again until the old address answers (its page may still be busy).
    const sayReady = () => {
      try {
        opener.postMessage({ type: MOVE_READY }, OLD_ORIGIN);
      } catch {
        // the old tab was closed
      }
    };
    const ready = window.setInterval(sayReady, 1000);
    let received = false;
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== OLD_ORIGIN || event.source !== opener || received) return;
      const data = event.data as { type?: unknown; payload?: unknown } | null;
      if (data?.type !== MOVE_WORKS) return;
      received = true;
      window.clearInterval(ready);
      setPhase({ kind: "moving" });
      const result = await receive(readMovePayload(data.payload));
      opener.postMessage({ type: MOVE_DONE, result }, OLD_ORIGIN);
      setPhase(phaseFor(result));
    };
    window.addEventListener("message", onMessage);
    sayReady();
    const giveUp = window.setTimeout(() => {
      window.clearInterval(ready);
      if (!received) setPhase({ kind: "file" });
    }, 30_000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(ready);
      window.clearTimeout(giveUp);
    };
  }, [byWindow]);

  const readFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhase({ kind: "moving" });
    let payload: BookshelfMovePayload | null = null;
    try {
      payload = readMovePayload(JSON.parse(await file.text()));
    } catch {
      payload = null;
    }
    if (!payload) {
      setPhase({ kind: "problem", text: "このファイルは読み込めませんでした。tatespun.pages.dev の「ファイルに書き出す」で作ったファイルを選んでください。" });
      return;
    }
    setPhase(phaseFor(await receive(payload)));
  }, []);

  const showPicker = phase.kind === "file" || phase.kind === "problem";
  return (
    <section className={bandClass} aria-labelledby="bookshelf-receive-title" data-bookshelf-move="receive">
      <div className="mx-auto max-w-[960px]">
        <h2 id="bookshelf-receive-title" className="font-serif text-base font-semibold text-[#17243a] dark:text-[#e4dfd3]">
          tatespun.pages.dev から作品を移す
        </h2>
        <div aria-live="polite" className="mt-1 text-sm leading-7">
          {phase.kind === "waiting" && <p>作品を受け取っています。もとのタブは閉じずにお待ちください。</p>}
          {phase.kind === "moving" && <p>作品を本棚に入れています…</p>}
          {phase.kind === "file" && <p>tatespun.pages.dev の「ファイルに書き出す」で作ったファイルを選んでください。</p>}
          {phase.kind === "done" && <p>{phase.text}</p>}
          {phase.kind === "problem" && <p role="alert">{phase.text}</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {showPicker && (
            <label className={`${primaryClass} cursor-pointer`}>
              ファイルから読み込む
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void readFile(event)} />
            </label>
          )}
          {(phase.kind === "done" || phase.kind === "file" || phase.kind === "problem") && (
            <button type="button" className={secondaryClass} onClick={onClose}>
              閉じる
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** A small reminder on the other pages of the old address. */
function OldAddressReminder() {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div
      className="fixed bottom-3 left-3 z-[60] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-[#17243a]/20 bg-[#f4f0e7] py-1.5 pl-4 pr-1.5 text-xs text-[#17243a] dark:border-[#e4dfd3]/20 dark:bg-[#10151d] dark:text-[#e4dfd3]"
      data-bookshelf-move="reminder"
    >
      <Link href="/" className="underline underline-offset-4">
        本棚は spuntales.net に移りました（作品を移す）
      </Link>
      <button type="button" aria-label="閉じる" className="h-7 w-7 rounded-full hover:bg-[#17243a]/10" onClick={() => setClosed(true)}>
        ×
      </button>
    </div>
  );
}

type Shown = { kind: "old"; works: number | null; trash: number } | { kind: "receive"; byWindow: boolean } | null;

export default function BookshelfMoveNotice() {
  const pathname = usePathname();
  const [shown, setShown] = useState<Shown>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let cancelled = false;
    if (!isOldAddress(window.location.hostname)) {
      const move = params.get("move");
      // Opened by the old address (`?move=1`) it waits for the works; without
      // that tab (opened by hand, or the link was cut) it asks for the file.
      const byWindow = move === "1" && !!window.opener;
      if (move === "1" || move === "file") {
        void Promise.resolve().then(() => {
          if (!cancelled) setShown({ kind: "receive", byWindow });
        });
      }
      return () => {
        cancelled = true;
      };
    }
    void countMovableWorks()
      .then((count) => {
        if (cancelled) return;
        const movedAt = readMovedAt();
        const nothingToMove = count.works + count.trash === 0 || (movedAt !== null && count.latest <= movedAt);
        // `?stay=1` keeps the old address open (for checking what is left here).
        if (nothingToMove && params.get("stay") !== "1") {
          window.location.replace(canonicalUrl(window.location));
          return;
        }
        setShown({ kind: "old", works: count.works, trash: count.trash });
      })
      .catch(() => {
        // The bookshelf could not be read: say where it is now, without moving away.
        if (!cancelled) setShown({ kind: "old", works: null, trash: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeReceive = useCallback(() => {
    setShown(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("move");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  if (!shown) return null;
  if (shown.kind === "receive") return <ReceivePanel byWindow={shown.byWindow} onClose={closeReceive} />;
  const home = (pathname.replace(/\/+$/, "") || "/") === "/";
  return home ? <OldAddressPanel works={shown.works} trash={shown.trash} /> : <OldAddressReminder />;
}
