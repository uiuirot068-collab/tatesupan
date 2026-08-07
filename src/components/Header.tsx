'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { AuthModal } from './AuthModal';
import { ProjectListModal } from './ProjectListModal';
import { Project } from '@/types/database';

type SaveStatus = 'loading' | 'saved' | 'saving' | 'error';

interface HeaderProps {
  onSave?: () => void;
  onSelectProject?: (project: Project) => void;
  isSaving?: boolean;
  saveStatus?: SaveStatus;
  onOpenHelp?: () => void;
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  const text: Record<SaveStatus, string> = {
    loading: '読み込み中…',
    saving: '下書き保存中…',
    saved: '下書き保存済み',
    error: '下書きの保存に失敗しました',
  };
  const dot: Record<SaveStatus, string> = {
    loading: 'bg-gray-300',
    saving: 'bg-[#c5a059] animate-pulse',
    saved: 'bg-[#c5a059]',
    error: 'bg-red-500',
  };
  const label: Record<SaveStatus, string> = {
    loading: 'text-gray-400',
    saving: 'text-gray-600',
    saved: 'text-gray-600',
    error: 'text-red-500',
  };
  return (
    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      <span className={`whitespace-nowrap ${label[status]}`}>{text[status]}</span>
    </span>
  );
}

export function Header({ onSave, onSelectProject, isSaving, saveStatus, onOpenHelp }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkTheme]);

  const logoSrc = '/caroad_main2.png';

  return (
    <header className="mx-4 my-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-3 gap-y-2">
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline"
        >
          ← 作品一覧
        </Link>
        <img
          src={logoSrc}
          alt="TateSpun"
          width={32}
          height={32}
          className="h-8 w-8 flex-shrink-0 object-contain"
        />
        <div className="flex flex-col leading-tight">
          <span className="whitespace-nowrap flex-shrink-0 text-xl font-bold text-gray-800">TateSpun (タテスパン)</span>
          <span className="whitespace-nowrap flex-shrink-0 text-xs text-gray-500">縦書きWebエディタ</span>
        </div>
        {saveStatus && <SaveStatusLabel status={saveStatus} />}
      </div>
      <div className="flex flex-wrap items-center gap-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap flex-shrink-0 text-sm font-semibold text-gray-700">画面モード</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDarkTheme}
            aria-label="テーマ切り替え"
            onClick={() => setIsDarkTheme((prev) => !prev)}
            className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
              isDarkTheme ? 'bg-[#c5a059]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isDarkTheme ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="使い方"
            title="使い方"
            className="flex h-7 w-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            ？
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium bg-[#c5a059] hover:bg-[#b38f48] text-white rounded-full shadow-sm transition-colors disabled:opacity-50 flex-none whitespace-nowrap flex-shrink-0"
          >
            {isSaving ? '保存中...' : 'クラウドに保存'}
          </button>
        )}
        {onSelectProject && (
          <button
            type="button"
            onClick={() => setIsProjectModalOpen(true)}
            className="shrink-0 whitespace-nowrap bg-[#c5a059] hover:bg-[#b38f48] text-white font-medium px-3 py-1.5 rounded-full shadow-sm transition-colors text-sm"
          >
            保存作品一覧
          </button>
        )}
        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="whitespace-nowrap flex-shrink-0 text-sm text-gray-600 ml-2">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="whitespace-nowrap flex-shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="whitespace-nowrap flex-shrink-0 rounded bg-[#c5a059] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48]"
          >
            ログイン / 会員登録
          </button>
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {onSelectProject && (
        <ProjectListModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          onSelectProject={onSelectProject}
        />
      )}
    </header>
  );
}
