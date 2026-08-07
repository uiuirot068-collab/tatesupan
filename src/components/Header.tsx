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

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      <div className="text-xl font-bold text-gray-800">
        タテスパン
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="rounded bg-[#c5a059] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#b38f48] disabled:bg-[#c5a059]/50"
              >
                {isSaving ? '保存中...' : 'クラウド保存'}
              </button>
            )}
            {onSelectProject && (
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                保存作品一覧
              </button>
            )}
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
