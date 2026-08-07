'use client';

import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-gray-800">
            {isSignUp ? '新規会員登録' : 'ログイン'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex flex-col gap-4">
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

          <button
            type="submit"
            className="mt-2 w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {isSignUp ? (
            <p>
              すでにアカウントをお持ちですか？{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
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
                onClick={() => setIsSignUp(true)}
                className="text-blue-600 hover:underline font-medium"
              >
                新規登録
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
