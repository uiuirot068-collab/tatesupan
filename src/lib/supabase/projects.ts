import { createClient } from './client';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/types/database';

export async function getProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
  return data || [];
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

export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...input, user_id: user.id }])
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    return null;
  }
  return data;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    return null;
  }
  return data;
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
