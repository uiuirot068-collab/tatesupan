'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/types/database';
import { getProjects, deleteProject } from '@/lib/supabase/projects';

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

  const fetchProjects = async () => {
    setIsLoading(true);
    const data = await getProjects();
    setProjects(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;
    const success = await deleteProject(id);
    if (success) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert('削除に失敗しました。');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-gray-800">保存した作品一覧</h2>
          <button
            onClick={onClose}
            className="text-xl font-bold text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              読み込み中...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              保存された作品はありません。
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50/30"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {project.title || '無題の作品'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
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
