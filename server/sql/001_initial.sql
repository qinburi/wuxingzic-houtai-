create table if not exists app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log_archive (
  id text primary key,
  kind text not null,
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  result text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function reject_audit_mutation() returns trigger as $$
begin
  raise exception 'audit records are append only';
end;
$$ language plpgsql;

drop trigger if exists audit_archive_no_update on audit_log_archive;
create trigger audit_archive_no_update before update or delete on audit_log_archive
for each row execute function reject_audit_mutation();
