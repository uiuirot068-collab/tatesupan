'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SessionStatus = 'checking' | 'ready' | 'invalid';

// Supabaseは無効・期限切れのrecoveryリンクの場合、code交換を行わずに
// error / error_description をURLへ直接付与してredirectする。
function readUrlError(): string | null {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const description = search.get('error_description') || hash.get('error_description');
  const code = search.get('error') || hash.get('error');
  if (!code && !description) return null;
  return description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'リンクが無効です。';
}

export default function ResetPasswordPage() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() =>
    readUrlError() ? 'invalid' : 'checking'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSucceeded, setUpdateSucceeded] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    // URLのerrorパラメータで既に'invalid'と判定済みの場合、購読は不要。
    if (readUrlError()) return;

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolvedRef.current = true;
        setSessionStatus('ready');
      }
    });

    // codeが無効/期限切れの場合、exchangeが失敗してもイベントは発火しないため、
    // 一定時間待っても recovery が確認できなければ無効として扱う。
    const timeoutId = window.setTimeout(() => {
      if (!resolvedRef.current) {
        setSessionStatus('invalid');
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
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

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // recovery sessionのまま通常利用へ進めず、新しいパスワードでの
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
