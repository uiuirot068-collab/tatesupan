import { createClient } from './client';

export type CloudPlan = 'resident' | 'light' | 'unlimited';

// SPN-UNIFY-001: the plan is the SpunTales portal plan (profiles.plan_tier,
// set by the Stripe webhook). 'free' is TateSpun's "resident" limit -- see
// docs/supabase/migrations/20261005000000_cloud_limit_from_portal_plan.sql.
export const CLOUD_PROJECT_LIMITS: Record<CloudPlan, number | null> = {
  resident: 15,
  light: 30,
  unlimited: null,
};

// Stable identifier raised by the public.enforce_cloud_project_limit()
// DB trigger when a new cloud project would exceed the plan's limit.
export const CLOUD_PROJECT_LIMIT_ERROR = 'cloud_project_limit_reached';

// Portal plan_tier -> TateSpun cloud plan. Anything unknown is the free limit.
export function cloudPlanFromPortalTier(tier: unknown): CloudPlan {
  if (tier === 'light' || tier === 'unlimited') return tier;
  return 'resident';
}

export interface CloudPlanResult {
  plan: CloudPlan | null;
  error: string | null;
}

// Resolves the current user's cloud plan.
// - Not logged in / auth error / query error -> plan: null, error set.
// - Logged in, portal plan 'free' or no profile row -> plan: 'resident', error: null.
// A query error must never silently fall back to 'resident'.
export async function getCloudPlan(): Promise<CloudPlanResult> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { plan: null, error: userError?.message ?? 'ログインしていません' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan_tier')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cloud plan:', error);
    return { plan: null, error: error.message };
  }

  return { plan: cloudPlanFromPortalTier(data?.plan_tier), error: null };
}
