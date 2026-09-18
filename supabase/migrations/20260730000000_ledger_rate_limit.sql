-- Per-IP rate limiting for the public evidence submission endpoint.
--
-- /api/ledger/evidence is public and unauthenticated by design, but with no
-- limiter anyone can script unlimited POSTs, permanently appending junk to
-- the append-only ledger (it cannot be safely deleted from without breaking
-- the hash chain for every entry after it). This adds a small atomic counter
-- table plus a function the Netlify function calls before writing: 5
-- submissions per 10-minute window per hashed client IP (the raw IP is never
-- stored, only its SHA-256 hash, computed in submit-evidence.js).
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL
-- editor. The submit-evidence.js change that calls check_ledger_rate_limit
-- fails open (allows the request through, logging a warning) if this
-- function doesn't exist yet, so applying this migration is not a hard
-- deploy-order blocker, but rate limiting is not actually active until it
-- runs.

create table if not exists ledger_submission_log (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

comment on table ledger_submission_log is
  'Rolling window of hashed-IP submission timestamps, used only for rate limiting /api/ledger/evidence.';

-- Hot path: count recent submissions for one ip_hash.
create index if not exists ledger_submission_log_ip_time_idx
  on ledger_submission_log (ip_hash, created_at);

-- RLS on + no policies => only the service role (used by Netlify functions)
-- may touch this table, matching the convention used for catalog_works etc.
alter table ledger_submission_log enable row level security;

-- Atomic check-and-record. Locks on the ip_hash so two concurrent requests
-- from the same client can't both read a count under the limit before either
-- inserts (same advisory-lock pattern append_ledger_entry uses for the
-- chain tip). The lock is transaction-scoped and releases automatically
-- when this function's implicit transaction ends.
create or replace function check_ledger_rate_limit(
  p_ip_hash        text,
  p_max_count      integer,
  p_window_seconds integer
) returns boolean
language plpgsql
set search_path = ''   -- pin schema resolution (Supabase linter 0011); refs are schema-qualified below
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('ledger_rate_limit:' || p_ip_hash));

  select count(*) into v_count
    from public.ledger_submission_log
   where ip_hash = p_ip_hash
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.ledger_submission_log (ip_hash) values (p_ip_hash);
  return true;
end;
$$;
