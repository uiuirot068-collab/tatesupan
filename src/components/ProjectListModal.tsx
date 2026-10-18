'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/types/database';
import { getProjectsResult, deleteProject } from '@/lib/supabase/projects';
import { releaseCloudWorkImages } from '@/lib/trash';

interface ProjectListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
}

export function ProjectListModal({
  isOpen,
  onClose,
  onSelectProject,
}: ProjectListModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // TSP-SAFE-004 QA: a list that could not be read is not an empty list.
  const [loadError, setLoadError] = useState<string | null>(null);
  // TSP-SAFE-004 PC QA: nobody signed in is not an error.
  const [signedOut, setSignedOut] = useState(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    setLoadError(null);
    setSignedOut(false);
    const { data, error, signedOut: noOneSignedIn } = await getProjectsResult();
    setProjects(data);
    setSignedOut(!!noOneSignedIn);
    setLoadError(noOneSignedIn ? null : error);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  // TSP-SAFE-004 QA2: Esc closes it, like the other windows.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;
    const success = await deleteProject(id);
    if (success) {
      // Its illustrations no longer need keeping for the cloud (lib/trash.ts).
      releaseCloudWorkImages(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert('削除に失敗しました。');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white p-6 shadow-xl dark:bg-[#151B24] dark:text-[#D4DBE7]">
        <div className="flex items-center justify-between border-b pb-3 dark:border-[#3A4658]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-[#E4DFD3]">保存した作品一覧</h2>
          <button
            onClick={onClose}
            className="text-xl font-bold text-gray-500 hover:text-gray-700 dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-[#AEB7C6]">
              読み込み中...
            </div>
          ) : signedOut ? (
            <div className="py-8 text-center text-sm text-gray-600 dark:text-[#C8CFDA]">
              ログインすると、クラウドに保存した作品がここに並びます。
            </div>
          ) : loadError !== null ? (
            <div role="alert" className="py-8 text-center text-sm text-gray-600 dark:text-[#C8CFDA]">
              <p>クラウドの作品一覧を読み込めませんでした。通信やログインの状態を確かめて、もう一度お試しください。</p>
              <button
                type="button"
                onClick={() => void fetchProjects()}
                className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#3A4658] dark:text-[#D4DBE7] dark:hover:bg-[#1D2430]"
              >
                もう一度読み込む
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-[#AEB7C6]">
              保存された作品はありません。
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50/30 dark:border-[#3A4658] dark:hover:bg-[#1D2430]"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-[#E4DFD3]">
                      {project.title || '無題の作品'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#939DAF]">
                      更新日時:{' '}
                      {new Date(project.updated_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onSelectProject(project);
                        onClose();
                      }}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      開く
                    </button>
                    <button
                      onClick={() => handleDelete(project.id, project.title)}
                      className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
