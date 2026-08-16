'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { AuthModal } from './AuthModal';
import { ProjectListModal } from './ProjectListModal';
import { Project } from '@/types/database';
import ThemeToggle from './ThemeToggle';

type SaveStatus = 'loading' | 'saved' | 'saving' | 'error';

interface HeaderProps {
  onSave?: () => void;
  onSelectProject?: (project: Project) => void;
  isSaving?: boolean;
  saveStatus?: SaveStatus;
  onOpenHelp?: () => void;
  /** 'editor'（既定・従来どおり「←作品一覧」を表示）/ 'home'（NON-EMPTY Home専用: 兄弟サービス表記、back linkなし） */
  variant?: 'editor' | 'home';
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

export function Header({ onSave, onSelectProject, isSaving, saveStatus, onOpenHelp, variant = 'editor' }: HeaderProps) {
  const isHome = variant === 'home';
  const { user, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalNotice, setAuthModalNotice] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const logoSrc = '/caroad_main2.png';

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalNotice(null);
  };

  const handleSaveClick = () => {
    if (!user) {
      setAuthModalNotice(
        'クラウド保存にはログインが必要です。\nローカル作品はこのブラウザにそのまま残ります。'
      );
      setIsAuthModalOpen(true);
      return;
    }
    onSave?.();
  };

  return (
    <header
      className={`mx-4 my-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-y-2 ${isHome ? 'min-[780px]:flex-nowrap min-[780px]:gap-x-6' : ''}`}
    >
      {isHome && (
        <div className="flex w-full flex-col items-center gap-2 min-[780px]:hidden">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-gray-500">SpunTales</span>
            <span aria-hidden="true" className="shrink-0 text-gray-300">｜</span>
            <img
              src={logoSrc}
              alt="TateSpun"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 object-contain dark:brightness-0 dark:invert"
            />
            <span className="shrink-0 whitespace-nowrap text-base font-bold text-gray-800">TateSpun (タテスパン)</span>
            <span
              title="現在β版です。テスト運用期間中のため、機能や表示が変更される場合があります。"
              className="shrink-0 whitespace-nowrap rounded-full border border-[#c5a059]/40 bg-[#c5a059]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#b38f48]"
            >
              β版
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="whitespace-nowrap text-xs font-medium text-gray-600">画面</span>
              <ThemeToggle />
            </div>

            {user ? (
              <button
                onClick={() => signOut()}
                className="shrink-0 whitespace-nowrap rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                ログアウト
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthModalNotice(null);
                  setIsAuthModalOpen(true);
                }}
                className="shrink-0 whitespace-nowrap rounded bg-[#c5a059] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48]"
              >
                ログイン / 会員登録
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={
          isHome
            ? 'hidden min-w-0 items-center gap-3 gap-y-2 min-[780px]:flex min-[780px]:w-auto min-[780px]:flex-nowrap min-[780px]:justify-start'
            : 'flex w-full min-w-0 flex-wrap items-center gap-3 gap-y-2 sm:w-auto'
        }
      >
        {!isHome && (
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline"
          >
            ← 作品一覧
          </Link>
        )}
        {isHome && (
          <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-500">
            SpunTales
            <span aria-hidden="true" className="text-gray-300">｜</span>
          </span>
        )}
        <img
          src={logoSrc}
          alt="TateSpun"
          width={32}
          height={32}
          className={`h-8 w-8 flex-shrink-0 object-contain ${isHome ? 'dark:brightness-0 dark:invert' : ''}`}
        />
        <div className="flex shrink-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="flex-shrink-0 text-xl font-bold text-gray-800">TateSpun (タテスパン)</span>
            <span
              title="現在β版です。テスト運用期間中のため、機能や表示が変更される場合があります。"
              className="flex-shrink-0 rounded-full border border-[#c5a059]/40 bg-[#c5a059]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#b38f48]"
            >
              β版
            </span>
          </span>
          <span className="hidden sm:block whitespace-nowrap flex-shrink-0 text-xs text-gray-500">縦書きWebエディタ</span>
        </div>
        {saveStatus && <SaveStatusLabel status={saveStatus} />}
      </div>
      <div
        className={isHome ? 'hidden' : 'flex w-full flex-wrap items-center gap-4 gap-y-2 sm:w-auto'}
      >
        <div className="flex items-center gap-2">
          {isHome && (
            <span className="sm:hidden whitespace-nowrap flex-shrink-0 text-xs font-medium text-gray-600">画面</span>
          )}
          <span className="hidden sm:inline whitespace-nowrap flex-shrink-0 text-sm font-semibold text-gray-700">画面モード</span>
          <ThemeToggle />
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
            onClick={handleSaveClick}
            disabled={isSaving}
            className="text-xs px-2.5 py-1 sm:text-sm sm:px-3 sm:py-1.5 font-medium bg-[#c5a059] hover:bg-[#b38f48] text-white rounded-full shadow-sm transition-colors disabled:opacity-50 flex-none whitespace-nowrap flex-shrink-0"
          >
            {isSaving ? '保存中...' : 'クラウドに保存'}
          </button>
        )}
        {onSelectProject && (
          <button
            type="button"
            onClick={() => setIsProjectModalOpen(true)}
            className="shrink-0 whitespace-nowrap bg-[#c5a059] hover:bg-[#b38f48] text-white font-medium text-xs px-2.5 py-1 sm:text-sm sm:px-3 sm:py-1.5 rounded-full shadow-sm transition-colors"
          >
            保存作品一覧
          </button>
        )}
        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden md:inline whitespace-nowrap flex-shrink-0 text-sm text-gray-600 ml-2">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="whitespace-nowrap flex-shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setAuthModalNotice(null);
              setIsAuthModalOpen(true);
            }}
            className="whitespace-nowrap flex-shrink-0 rounded bg-[#c5a059] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48]"
          >
            ログイン / 会員登録
          </button>
        )}
      </div>

      {isHome && (
        <div className="hidden shrink-0 flex-col items-end gap-1.5 min-[780px]:flex">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm font-semibold text-gray-700">画面モード</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="whitespace-nowrap text-sm text-gray-600">{user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="whitespace-nowrap rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAuthModalNotice(null);
                  setIsAuthModalOpen(true);
                }}
                className="whitespace-nowrap rounded bg-[#c5a059] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48]"
              >
                ログイン / 会員登録
              </button>
            )}
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        notice={authModalNotice}
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
