'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SessionStatus = 'checking' | 'ready' | 'invalid';

// Supabase は無効・期限切れの recovery リンクの場合、code 交換を行わずに
// error / error_description を URL（query か hash）へ直接付与して redirect する。
function readUrlError(): string | null {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const description = search.get('error_description') || hash.get('error_description');
  const code = search.get('error') || hash.get('error');
  if (!code && !description) return null;
  return description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'リンクが無効です。';
}

// recovery リンクは PKCE フローでは `?code=<pkce>`、実装によっては
// `#access_token=...&type=recovery` として届く。@supabase/ssr の
// detectSessionInUrl は **共有シングルトン**クライアント（AuthProvider が
// このページより先に生成する）が code を交換した直後に `?code=` を URL から
// 除去し、`PASSWORD_RECOVERY` イベントもそのとき一度だけ発火する。よって
// このページの購読が間に合わず「有効なのに無効」と誤判定していた。
function readArrivedViaAuthLink(): boolean {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return Boolean(
    search.get('code') ||
      hash.get('access_token') ||
      hash.get('type') === 'recovery',
  );
}

export default function ResetPasswordPage() {
  // 明示的な URL error はマウント時点で確定できる（既存の挙動を踏襲）。
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() =>
    readUrlError() ? 'invalid' : 'checking',
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSucceeded, setUpdateSucceeded] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    // 1. URL に明示的な error があれば、初期 state で既に 'invalid'。購読不要。
    if (readUrlError()) return;

    const arrivedViaLink = readArrivedViaAuthLink();
    const supabase = createClient();
    let cancelled = false;
    const timers: number[] = [];

    const markReady = () => {
      if (cancelled) return;
      cancelled = true;
      timers.forEach(window.clearTimeout);
      setSessionStatus('ready');
    };
    const markInvalid = () => {
      if (cancelled) return;
      cancelled = true;
      timers.forEach(window.clearTimeout);
      setSessionStatus('invalid');
    };

    // 2. 「有効の証明」は event ではなく **セッションの実在**。共有クライアントが
    //    既に PKCE 交換を終えていれば getSession() がそれを返す。まだ交換中なら
    //    短い間隔でポーリングして待つ（8秒固定タイマーを唯一の判定にしない）。
    const deadline = Date.now() + (arrivedViaLink ? 15_000 : 3_000);
    const poll = async () => {
      if (cancelled) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        markReady();
        return;
      }
      if (Date.now() >= deadline) {
        markInvalid();
        return;
      }
      timers.push(window.setTimeout(poll, 700));
    };
    poll();

    // 3. 交換がこのページのマウント後に完了する速いケースも取りこぼさない。
    //    自前の signOut() による SIGNED_OUT では絶対に「無効」へ倒さない。
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (
        event === 'PASSWORD_RECOVERY' ||
        (event !== 'SIGNED_OUT' && session)
      ) {
        markReady();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      timers.forEach(window.clearTimeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!password || !confirmPassword) {
      setFormError('パスワードを入力してください。');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('パスワードが一致しません。');
      return;
    }
    if (password.length < 6) {
      setFormError('パスワードは6文字以上で入力してください。');
      return;
    }
    if (doneRef.current) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      // 念のため、更新前にセッションの実在を再確認する（匿名では通さない）。
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSessionStatus('invalid');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      doneRef.current = true;

      // recovery セッションのまま通常利用へ進めず、新しいパスワードでの
      // 明示的な再ログインを必須にする。
      await supabase.auth.signOut();
      setUpdateSucceeded(true);
    } catch (err) {
      console.error('updateUser error:', err instanceof Error ? err.message : err);
      setFormError('パスワードの更新に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h1 className="border-b pb-3 text-lg font-bold text-gray-800">パスワード再設定</h1>

        {sessionStatus === 'checking' && (
          <p className="mt-6 text-center text-sm text-gray-500">確認しています…</p>
        )}

        {sessionStatus === 'invalid' && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              このリンクは無効か、有効期限が切れています。お手数ですが、もう一度パスワード再設定の手続きをお試しください。
            </div>
            <Link
              href="/"
              className="mt-2 w-full rounded bg-[#c5a059] py-2 text-center text-sm font-semibold text-white hover:bg-[#b38f48]"
            >
              トップページへ戻る
            </Link>
          </div>
        )}

        {sessionStatus === 'ready' && !updateSucceeded && (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {formError && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-600">{formError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">新しいパスワード</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6文字以上"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="もう一度入力"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded bg-[#c5a059] py-2 text-sm font-semibold text-white hover:bg-[#b38f48] disabled:bg-[#c5a059]/50"
            >
              {isSubmitting ? '処理中...' : 'パスワードを更新する'}
            </button>
          </form>
        )}

        {updateSucceeded && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded bg-green-50 p-3 text-sm text-green-700">
              パスワードを変更しました。新しいパスワードでログインしてください。
            </div>
            <Link
              href="/"
              className="mt-2 w-full rounded bg-[#c5a059] py-2 text-center text-sm font-semibold text-white hover:bg-[#b38f48]"
            >
              トップページへ戻る
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
