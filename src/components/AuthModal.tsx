'use client';

import React, { useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { BASE_PATH } from '@/lib/basePath';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  notice?: string | null;
}

type ModalMode = 'signin' | 'signup' | 'forgot';

export function AuthModal({ isOpen, onClose, onSuccess, notice }: AuthModalProps) {
  const [mode, setMode] = useState<ModalMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const supabase = createClient();

  if (!isOpen) return null;

  const isSignUp = mode === 'signup';

  const resetLocalState = () => {
    setError(null);
    setForgotSent(false);
  };

  const switchMode = (next: ModalMode) => {
    resetLocalState();
    setMode(next);
  };

  const handleClose = () => {
    resetLocalState();
    setMode('signin');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          // BASE_PATH keeps this correct under https://spuntales.net/tatespun/
          // while staying http://localhost:3000/auth/reset-password at root.
          redirectTo: `${window.location.origin}${BASE_PATH}/auth/reset-password`,
        });
        // Account enumeration対策: Supabaseから返る具体的なエラーの有無にかかわらず、
        // ユーザーへは常に同じ一般的な成功メッセージを表示する。
        if (resetError) {
          console.error('resetPasswordForEmail error:', resetError.message);
        }
        setForgotSent(true);
        return;
      }

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        alert('アカウントを作成し、ログインしました');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || '認証に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const titles: Record<ModalMode, string> = {
    signin: 'ログイン',
    signup: '新規会員登録',
    forgot: 'パスワード再設定',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-gray-800">{titles[mode]}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {notice && (
          <div className="mt-4 whitespace-pre-line rounded bg-blue-50 p-3 text-sm text-blue-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {mode === 'forgot' && forgotSent ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded bg-green-50 p-3 text-sm text-green-700">
              パスワード再設定用のメールを送信しました。メールをご確認ください。
            </div>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mt-2 w-full rounded border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              ログインへ戻る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@example.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  パスワード
                </label>
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
            )}

            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="self-end text-xs text-blue-600 hover:underline"
              >
                パスワードを忘れた方
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded bg-[#c5a059] py-2 text-sm font-semibold text-white hover:bg-[#b38f48] disabled:bg-[#c5a059]/50"
            >
              {isLoading
                ? '処理中...'
                : mode === 'forgot'
                ? '再設定メールを送る'
                : isSignUp
                ? '登録する'
                : 'ログイン'}
            </button>
          </form>
        )}

        {!(mode === 'forgot' && forgotSent) && (
          <div className="mt-4 text-center text-sm text-gray-600">
            {mode === 'forgot' ? (
              <p>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  ログインへ戻る
                </button>
              </p>
            ) : isSignUp ? (
              <p>
                すでにアカウントをお持ちですか？{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  ログイン
                </button>
              </p>
            ) : (
              <p>
                アカウントをお持ちでないですか？{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  新規登録
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
