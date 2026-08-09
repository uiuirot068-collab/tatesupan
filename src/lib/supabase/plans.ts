import { createClient } from './client';

export type CloudPlan = 'resident' | 'light' | 'unlimited';

// A missing row in user_plans means "resident" -- see
// docs/supabase/migrations/20260809000000_cloud_project_limits.sql.
export const CLOUD_PROJECT_LIMITS: Record<CloudPlan, number | null> = {
  resident: 15,
  light: 30,
  unlimited: null,
};

// Stable identifier raised by the public.enforce_cloud_project_limit()
// DB trigger when a new cloud project would exceed the plan's limit.
export const CLOUD_PROJECT_LIMIT_ERROR = 'cloud_project_limit_reached';

export interface CloudPlanResult {
  plan: CloudPlan | null;
  error: string | null;
}

// Resolves the current user's cloud plan.
// - Not logged in / auth error / query error -> plan: null, error set.
// - Logged in with no user_plans row -> plan: 'resident', error: null.
// A query error must never silently fall back to 'resident'.
export async function getCloudPlan(): Promise<CloudPlanResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { plan: null, error: userError?.message ?? 'ログインしていません' };
  }

  const { data, error } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cloud plan:', error);
    return { plan: null, error: error.message };
  }

  return { plan: (data?.plan as CloudPlan | undefined) ?? 'resident', error: null };
}
