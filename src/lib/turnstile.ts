"use client";

/**
 * TSP-LOOP-019 — Cloudflare Turnstile（フィードバック / review 共通）。
 *
 * - 公開 site key（NEXT_PUBLIC_TURNSTILE_SITE_KEY）だけを使う。secret key は
 *   Supabase Edge Function 環境のみで、ここには絶対に現れない。
 * - サードパーティ npm 依存は増やさず、Cloudflare 公式スクリプトを明示レンダーで
 *   使う（`?render=explicit`）。モーダルが開いた時だけ読み込む。
 * - トークンは使い捨て。送信を1回試みたら（成功／失敗どちらでも）呼び出し側が
 *   `reset()` して新しいトークンを要求する。expired / error でも自動的に無効化。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_ACTION, TURNSTILE_SITE_KEY } from "./betaFeedback";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptStatus: "none" | "loading" | "ready" | "error" = "none";
const scriptWaiters = new Set<(ok: boolean) => void>();

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.turnstile) {
      scriptStatus = "ready";
      return resolve(true);
    }
    if (scriptStatus === "ready") return resolve(true);
    if (scriptStatus === "error") return resolve(false);
    scriptWaiters.add(resolve);
    if (scriptStatus === "loading") return;
    scriptStatus = "loading";
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      scriptStatus = window.turnstile ? "ready" : "error";
      const ok = scriptStatus === "ready";
      scriptWaiters.forEach((w) => w(ok));
      scriptWaiters.clear();
    };
    s.onerror = () => {
      scriptStatus = "error";
      scriptWaiters.forEach((w) => w(false));
      scriptWaiters.clear();
    };
    document.head.appendChild(s);
  });
}

export type TurnstileStatus =
  | "unconfigured" // NEXT_PUBLIC_TURNSTILE_SITE_KEY 未設定
  | "loading"
  | "ready" // widget 表示済み・未チェック
  | "verified" // 有効なトークンあり
  | "expired"
  | "error";

export interface UseTurnstile {
  /** widget をマウントする要素へ渡すコールバック ref。 */
  mount: (el: HTMLDivElement | null) => void;
  token: string;
  status: TurnstileStatus;
  /** トークンを破棄し widget を再チャレンジ可能状態へ戻す。 */
  reset: () => void;
}

export function useTurnstile(): UseTurnstile {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<TurnstileStatus>(
    TURNSTILE_SITE_KEY ? "loading" : "unconfigured"
  );

  const reset = useCallback(() => {
    setToken("");
    try {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } catch {
      /* noop */
    }
    setStatus((s) => (s === "unconfigured" ? s : "ready"));
  }, []);

  useEffect(() => {
    // TURNSTILE_SITE_KEY はビルド時定数。未設定なら初期 state が既に
    // "unconfigured" なので、ここでは何もしない（effect 内での同期 setState を避ける）。
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript().then((ok) => {
      if (cancelled) return;
      if (!ok || !containerRef.current || !window.turnstile) {
        setStatus("error");
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: TURNSTILE_ACTION,
          callback: (t: string) => {
            if (cancelled) return;
            setToken(t);
            setStatus("verified");
          },
          "expired-callback": () => {
            if (cancelled) return;
            setToken("");
            setStatus("expired");
          },
          "timeout-callback": () => {
            if (cancelled) return;
            setToken("");
            setStatus("expired");
          },
          "error-callback": () => {
            if (cancelled) return;
            setToken("");
            setStatus("error");
          },
        });
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {
        /* noop */
      }
      widgetIdRef.current = null;
    };
  }, []);

  const mount = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  return { mount, token, status, reset };
}
