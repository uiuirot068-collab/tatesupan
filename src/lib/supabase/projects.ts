import { createClient } from './client';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/types/database';
import { CLOUD_PROJECT_LIMIT_ERROR } from './plans';
import { deleteManuscriptImagesForProject } from './manuscriptImages';

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
  // TSP-SAFE-004 (3の6): only this user's works, also on this side — the
  // database's row security (docs/supabase/migrations/20260903000000_*) is
  // the real guard; this keeps the list right even if that were ever off.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { data: [], error: userError?.message ?? 'ログインしていません' };
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
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
  const found = await lookupProject(id);
  return found.status === 'found' ? found.data : null;
}

// TSP-SAFE-002: "could not read it" and "it is gone" are different answers.
// Only `missing` (signed in, the read worked, no such row of this user) may
// drop a work's link to the cloud; `unreachable` (offline, signed out, any
// error) must keep the link and stop the save — before, every error looked
// like a deletion and the next save made a second cloud copy.
export type ProjectLookup =
  | { status: 'found'; data: Project }
  | { status: 'missing' }
  | { status: 'unreachable'; error: string; loggedOut: boolean };

function isSignedOutAuthError(error: { message?: string; name?: string; status?: number } | null): boolean {
  if (!error) return true;
  if (error.name === 'AuthSessionMissingError') return true;
  return /auth session missing|not authenticated|jwt expired|invalid jwt|refresh token/i.test(error.message ?? '');
}

export async function lookupProject(id: string): Promise<ProjectLookup> {
  const supabase = createClient();
  // Signed out, RLS shows no rows — that is not a deletion.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      status: 'unreachable',
      error: userError?.message ?? 'ログインしていません',
      loggedOut: isSignedOutAuthError(userError),
    };
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching project:', error);
    return { status: 'unreachable', error: error.message, loggedOut: false };
  }
  return data ? { status: 'found', data } : { status: 'missing' };
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

// TSP-SAFE-002: an overwrite that did not happen because the cloud work
// changed after it was read (another device saved), or no longer exists.
export const CLOUD_PROJECT_CHANGED_ERROR = 'cloud_project_changed';
export const CLOUD_PROJECT_MISSING_ERROR = 'cloud_project_missing';

/**
 * Overwrites a cloud work. With `expectedUpdatedAt`, the database writes only
 * while the row is still at that save time (projects_set_updated_at keeps
 * updated_at at the database's own clock), so a save from another device
 * between our read and this write is never overwritten. Zero rows written is
 * never a success.
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  expectedUpdatedAt?: string | null
): Promise<ProjectResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user for updateProject:', userError);
    return { data: null, error: userError?.message ?? 'ログインしていません' };
  }

  let query = supabase
    .from('projects')
    // CST-PORT-014: also send the save time. The DB trigger
    // (projects_set_updated_at) overwrites it with its own clock where it is
    // installed; where it is not, updated_at would otherwise never change.
    .update({ ...input, user_id: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (expectedUpdatedAt !== undefined) {
    query = expectedUpdatedAt === null ? query.is('updated_at', null) : query.eq('updated_at', expectedUpdatedAt);
  }
  const { data, error } = await query.select();

  if (error) {
    console.error('Error updating project:', error);
    return { data: null, error: error.message };
  }
  const row = data?.[0];
  if (row) return { data: row, error: null };

  // Nothing written: tell "changed meanwhile" from "gone".
  const now = await lookupProject(id);
  if (now.status === 'found') return { data: null, error: CLOUD_PROJECT_CHANGED_ERROR };
  if (now.status === 'missing') return { data: null, error: CLOUD_PROJECT_MISSING_ERROR };
  return { data: null, error: now.error };
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = createClient();

  // TSP-LOOP-007: まず一時クラウド挿絵（Storage オブジェクト + manifest 行）を
  // 撤去する。manifest は projects への FK cascade でも消えるが、Storage は
  // cascade しないため明示的に消す。他プロジェクト・他ユーザーには触れない
  // （prefix + RLS で二重保証）。best-effort — 失敗しても本体削除は続行し、
  // 取り残しは定期パージが回収する。
  await deleteManuscriptImagesForProject({ projectId: id }).catch(() => {});

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
