'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { AuthModal } from './AuthModal';
import { ProjectListModal } from './ProjectListModal';
import { Project } from '@/types/database';

interface HeaderProps {
  onSave?: () => void;
  onSelectProject?: (project: Project) => void;
  isSaving?: boolean;
}

export function Header({ onSave, onSelectProject, isSaving }: HeaderProps) {
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
    <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src={logoSrc}
          alt="TateSpun"
          width={32}
          height={32}
          className="h-8 w-8 flex-shrink-0 object-contain"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-bold text-gray-800">TateSpun (タテスパン)</span>
          <span className="text-xs text-gray-500">縦書きWebエディタ</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">画面モード</span>
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
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 ml-2">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="rounded bg-[#c5a059] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48]"
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
