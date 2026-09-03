-- ============================================================================
-- TSP-LOOP-017B — manuscript-image-purge pg_cron on the canonical project
-- ============================================================================
-- Run **in the vjgxrqgnbgnewfvissgd SQL editor**, and ONLY AFTER:
--   * the `manuscript-image-purge` Edge Function is deployed to vjg
--     (supabase functions deploy manuscript-image-purge --project-ref vjgxrqgnbgnewfvissgd)
--   * MANUSCRIPT_IMAGE_PURGE_SECRET is set on the vjg function
--     (supabase secrets set --project-ref vjgxrqgnbgnewfvissgd MANUSCRIPT_IMAGE_PURGE_SECRET=...)
--
-- This recreates the hourly purge on vjg. It does NOT touch the old rgv cron —
-- keep rgv's schedule running until canonical production QA passes, then unschedule
-- it there separately: select cron.unschedule('manuscript-image-purge-hourly');  (in rgv)
--
-- >>> Replace __PURGE_SECRET__ with the real MANUSCRIPT_IMAGE_PURGE_SECRET value
--     (the same one set on the vjg Edge Function). Do not commit the real value.
--     If you prefer not to inline it, use current_setting(...) as the rgv doc did
--     and set the GUC on vjg (app.settings.manuscript_image_purge_secret).
-- ============================================================================

-- Extensions (no-op if already enabled on vjg)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any existing job of this name first.
select cron.unschedule('manuscript-image-purge-hourly')
where exists (select 1 from cron.job where jobname = 'manuscript-image-purge-hourly');

select cron.schedule(
  'manuscript-image-purge-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://vjgxrqgnbgnewfvissgd.functions.supabase.co/manuscript-image-purge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '__PURGE_SECRET__'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'manuscript-image-purge-hourly';
--   -- and after the next :00, check a run:
--   select * from cron.job_run_details order by start_time desc limit 5;
