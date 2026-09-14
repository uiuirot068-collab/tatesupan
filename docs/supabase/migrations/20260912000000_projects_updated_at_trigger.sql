-- TSP-PROJECT-UPDATED-AT-001
-- Canonical target: rgvqquuthovqjqfogfra only.
-- Keep public.projects.updated_at at the database-authoritative update time.

begin;

create or replace function public.tatespun_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.tatespun_set_updated_at() from public;
revoke execute on function public.tatespun_set_updated_at() from anon;
revoke execute on function public.tatespun_set_updated_at() from authenticated;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tatespun_set_updated_at();

commit;
