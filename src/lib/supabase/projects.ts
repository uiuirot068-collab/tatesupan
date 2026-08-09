import { createClient } from './client';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/types/database';
import { CLOUD_PROJECT_LIMIT_ERROR } from './plans';

function isCloudProjectLimitError(error: { message?: string } | null): boolean {
  return !!error?.message?.includes(CLOUD_PROJECT_LIMIT_ERROR);
}

export interface CloudProjectCountResult {
  count: number | null;
  error: string | null;
}

// Counts only the current user's cloud projects (never other users',
// and never the local-only usage-guide sample, which is never stored here).
export async function getCloudProjectCount(): Promise<CloudProjectCountResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { count: null, error: userError?.message ?? 'ログインしていません' };
  }

  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error counting cloud projects:', error);
    return { count: null, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export interface ProjectsResult {
  data: Project[];
  error: string | null;
}

export async function getProjectsResult(): Promise<ProjectsResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

export async function getProjects(): Promise<Project[]> {
  return (await getProjectsResult()).data;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return null;
  }
  return data;
}

export interface ProjectResult {
  data: Project | null;
  error: string | null;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user for createProject:', userError);
    return { data: null, error: userError?.message ?? 'ログインしていません' };
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...input, user_id: user.id }])
    .select()
    .single();

  if (error) {
    if (isCloudProjectLimitError(error)) {
      return { data: null, error: CLOUD_PROJECT_LIMIT_ERROR };
    }
    console.error('Error creating project:', error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user for updateProject:', userError);
    return { data: null, error: userError?.message ?? 'ログインしていません' };
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ ...input, user_id: user.id })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    return false;
  }
  return true;
}
