'use client';

import React, { useState } from 'react';
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
  const [isKinariTheme, setIsKinariTheme] = useState(false);

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <svg
          className="h-8 w-8 flex-shrink-0 text-[#c5a059]"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M9 7v10M15 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-bold text-gray-800">TateSpun (タテスパン)</span>
          <span className="text-xs text-gray-500">縦書きWebエディタ</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIsKinariTheme((prev) => !prev)}
          aria-pressed={isKinariTheme}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            isKinariTheme
              ? 'border-[#c5a059] bg-[#c5a059] text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          生成り
        </button>
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
