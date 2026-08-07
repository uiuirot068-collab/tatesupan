export interface Project {
  id: string;
  user_id: string;
  title: string;
  content: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CreateProjectInput = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateProjectInput = Partial<CreateProjectInput>;
