-- Phase 1: voting windows, price locked per order, per-IP limit, test mode,
-- nominee pages, reconciliation support, data-deletion requests.

-- Show and accept times in East Africa Time by default.
alter database postgres set timezone to 'Africa/Nairobi';

-- Settings table: lock it down (only SECURITY DEFINER functions read it).
alter table private.settings enable row level security;
insert into private.settings(key, value) values ('test_mode', 'true')
  on conflict (key) do nothing;

-- Categories: voting windows (timestamptz = exact instant; entered/shown in EAT).
alter table public.categories
  add column if not exists opens_at  timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists blurb     text;
comment on column public.categories.opens_at  is 'Voting opens (enter in EAT, e.g. 2027-01-10 08:00+03)';
comment on column public.categories.closes_at is 'Voting closes (enter in EAT)';

-- Nominees: shareable slug and short bio.
alter table public.nominees
  add column if not exists slug text,
  add column if not exists bio  text;
update public.nominees
   set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
 where slug is null;
alter table public.nominees alter column slug set not null;
create unique index if not exists nominees_slug_key on public.nominees(slug);
alter table public.nominees add constraint nominees_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Orders: price locked at order time, provider, IP hash, reconciliation bookkeeping.
alter table public.vote_orders
  add column if not exists unit_price      integer,
  add column if not exists provider        text not null default 'intasend',
  add column if not exists ip_hash         text,
  add column if not exists api_ref_checked boolean not null default false,
  add column if not exists last_checked_at timestamptz,
  add column if not exists check_count     integer not null default 0;
update public.vote_orders set unit_price = amount / greatest(votes_requested, 1) where unit_price is null;
alter table public.vote_orders alter column unit_price set not null;
alter table public.vote_orders add constraint vote_orders_provider_chk
  check (provider in ('intasend', 'simulator'));
create index if not exists vote_orders_ip_recent on public.vote_orders(ip_hash, created_at);
create index if not exists vote_orders_open_invoices on public.vote_orders(created_at)
  where not counted and invoice_id is not null;

-- Data-protection requests (deletion / access). Written only via function.
create table if not exists public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('delete', 'access')),
  phone_hash  text,
  contact     text not null,
  details     text,
  status      text not null default 'NEW',
  created_at  timestamptz not null default now()
);
alter table public.data_requests enable row level security;

-- Is voting open for this category right now?  (Single source of truth.)
create or replace function private.category_votable(c public.categories)
returns boolean language sql stable set search_path = '' as $$
  select c.paid_voting and c.voting_open
     and c.opens_at is not null and c.closes_at is not null
     and now() >= c.opens_at and now() < c.closes_at;
$$;

create or replace function private.category_status(c public.categories)
returns text language sql stable set search_path = '' as $$
  select case
    when not c.paid_voting then 'JURY'
    when private.category_votable(c) then 'OPEN'
    when c.opens_at is not null and now() < c.opens_at and c.voting_open then 'SOON'
    else 'CLOSED' end;
$$;

-- create_vote_order: windows + per-IP limit + price locked on the order.
drop function if exists public.create_vote_order(text, uuid, integer, text, text);
create function public.create_vote_order(
  p_secret text, p_nominee uuid, p_votes integer, p_phone_hash text, p_phone_masked text,
  p_ip_hash text default null, p_provider text default 'intasend')
returns table(order_id uuid, amount integer)
language plpgsql security definer set search_path = '' as $$
declare v_cat public.categories; v_price int; v_recent int; v_ip_recent int; v_test boolean;
begin
  perform private.check_secret(p_secret);
  select c.* into v_cat
    from public.nominees n join public.categories c on c.id = n.category_id
   where n.id = p_nominee and n.active;
  if not found then raise exception 'nominee not found'; end if;
  if not v_cat.paid_voting then raise exception 'no paid voting'; end if;
  if not private.category_votable(v_cat) then raise exception 'voting closed'; end if;
  if p_votes is null or p_votes < 1 or p_votes > 10000 then raise exception 'invalid votes'; end if;
  if p_phone_hash is null or length(p_phone_hash) < 32 then raise exception 'invalid phone'; end if;

  select value = 'true' into v_test from private.settings where key = 'test_mode';
  if p_provider = 'simulator' and not coalesce(v_test, false) then
    raise exception 'simulator not allowed outside test mode';
  end if;

  -- Max 5 unpaid prompts per phone in 10 minutes.
  select count(*) into v_recent from public.vote_orders o
   where o.phone_hash = p_phone_hash and not o.counted and o.created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception 'too many prompts'; end if;

  -- Max 30 unpaid prompts per IP in 10 minutes (generous: mobile networks share IPs).
  if p_ip_hash is not null then
    select count(*) into v_ip_recent from public.vote_orders o
     where o.ip_hash = p_ip_hash and not o.counted and o.created_at > now() - interval '10 minutes';
    if v_ip_recent >= 30 then raise exception 'too many prompts from network'; end if;
  end if;

  select value::int into v_price from private.settings where key = 'vote_price';
  if v_price is null or v_price < 1 then raise exception 'price not set'; end if;

  return query
    insert into public.vote_orders(nominee_id, votes_requested, amount, unit_price, phone_hash, phone_masked, ip_hash, provider)
    values (p_nominee, p_votes, p_votes * v_price, v_price, p_phone_hash, p_phone_masked, p_ip_hash, p_provider)
    returning id, vote_orders.amount;
end $$;

-- settle_invoice: callers MUST pass the state/value they got from the provider's
-- status API (never a webhook body). Votes = floor(paid / price at order time).
drop function if exists public.settle_invoice(text, text, text, numeric, text, text);
create function public.settle_invoice(
  p_secret text, p_invoice text, p_state text, p_value numeric, p_mpesa_ref text, p_reason text,
  p_api_ref text default null)
returns table(order_id uuid, state text, votes_counted integer)
language plpgsql security definer set search_path = '' as $$
declare v_order public.vote_orders%rowtype; v_test boolean;
begin
  perform private.check_secret(p_secret);
  select * into v_order from public.vote_orders o where o.invoice_id = p_invoice for update;
  if not found then raise exception 'unknown invoice'; end if;

  if v_order.counted then  -- idempotent: never count twice
    return query select v_order.id, v_order.state, v_order.votes_counted; return;
  end if;

  if p_state not in ('PENDING','PROCESSING','RETRY','PARTIAL','COMPLETE','FAILED','CANCELED') then
    raise exception 'bad state';
  end if;

  if v_order.provider = 'simulator' then
    select value = 'true' into v_test from private.settings where key = 'test_mode';
    if not coalesce(v_test, false) then raise exception 'simulator not allowed outside test mode'; end if;
  end if;

  if p_state = 'COMPLETE' then
    -- The provider's own record must point back at this order.
    if p_api_ref is distinct from v_order.id::text then raise exception 'api_ref mismatch'; end if;
    update public.vote_orders o set
      state = 'COMPLETE', paid_value = p_value, mpesa_ref = left(p_mpesa_ref, 64),
      votes_counted = least(o.votes_requested, floor(coalesce(p_value, 0) / o.unit_price)::int),
      counted = true, api_ref_checked = true,
      last_checked_at = now(), check_count = o.check_count + 1, updated_at = now()
     where o.id = v_order.id;
  else
    update public.vote_orders o set state = p_state, failed_reason = left(p_reason, 300),
      last_checked_at = now(), check_count = o.check_count + 1, updated_at = now()
     where o.id = v_order.id;
  end if;

  return query select o.id, o.state, o.votes_counted from public.vote_orders o where o.id = v_order.id;
end $$;

-- get_order: what the "check your phone" screen needs.
drop function if exists public.get_order(text, uuid);
create function public.get_order(p_secret text, p_order uuid)
returns table(order_id uuid, invoice_id text, state text, votes_requested integer, votes_counted integer,
              amount integer, paid_value numeric, nominee_id uuid, provider text, failed_reason text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  return query select o.id, o.invoice_id, o.state, o.votes_requested, o.votes_counted,
                      o.amount, o.paid_value, o.nominee_id, o.provider, o.failed_reason, o.created_at
    from public.vote_orders o where o.id = p_order;
end $$;

-- Reconciliation: invoices not settled after p_min_age (default 3 min), up to 48 h old.
create or replace function public.list_open_invoices(p_secret text, p_min_age interval default '3 minutes', p_limit int default 100)
returns table(order_id uuid, invoice_id text, provider text, state text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  return query select o.id, o.invoice_id, o.provider, o.state, o.created_at
    from public.vote_orders o
   where not o.counted and o.invoice_id is not null
     and o.state not in ('FAILED','CANCELED')
     and o.created_at < now() - p_min_age
     and o.created_at > now() - interval '48 hours'
   order by o.created_at limit p_limit;
end $$;

-- Orders that never got an invoice (STK push call failed/crashed): expire after 10 min.
create or replace function public.expire_stale_orders(p_secret text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.check_secret(p_secret);
  update public.vote_orders set state = 'FAILED', failed_reason = 'No payment prompt was created', updated_at = now()
   where invoice_id is null and not counted and state = 'CREATED' and created_at < now() - interval '10 minutes';
  get diagnostics n = row_count;
  return n;
end $$;

-- Data-protection request (form on privacy page).
create or replace function public.create_data_request(p_secret text, p_kind text, p_phone_hash text, p_contact text, p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_recent int;
begin
  perform private.check_secret(p_secret);
  select count(*) into v_recent from public.data_requests where created_at > now() - interval '1 hour';
  if v_recent > 50 then raise exception 'busy'; end if;
  insert into public.data_requests(kind, phone_hash, contact, details)
  values (p_kind, p_phone_hash, left(p_contact, 200), left(p_details, 1000)) returning id into v_id;
  return v_id;
end $$;

-- ---------- Public read functions (anon may call; read-only, no personal data) ----------

create or replace function public.get_site()
returns table(vote_price integer, test_mode boolean, server_time timestamptz)
language sql stable security definer set search_path = '' as $$
  select (select value::int from private.settings where key = 'vote_price'),
         coalesce((select value = 'true' from private.settings where key = 'test_mode'), false),
         now();
$$;

create or replace function public.list_categories()
returns table(id text, name text, group_name text, paid_voting boolean, status text,
              opens_at timestamptz, closes_at timestamptz, nominee_count bigint, sort integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.group_name, c.paid_voting, private.category_status(c),
         c.opens_at, c.closes_at,
         (select count(*) from public.nominees n where n.category_id = c.id and n.active), c.sort
    from public.categories c order by c.sort, c.name;
$$;

create or replace function public.get_category(p_category text)
returns table(id text, name text, group_name text, blurb text, paid_voting boolean, status text,
              opens_at timestamptz, closes_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.group_name, c.blurb, c.paid_voting, private.category_status(c), c.opens_at, c.closes_at
    from public.categories c where c.id = p_category;
$$;

-- Public boards show RANK ONLY (decision 2026-11-04: hide exact numbers so jurors
-- and the public cannot see tallies). Rank is null until a nominee has paid votes.
create or replace function private.category_ranks(p_category text)
returns table(nominee_id uuid, rnk integer)
language sql stable set search_path = '' as $$
  with t as (
    select n.id, coalesce(sum(o.votes_counted) filter (where o.counted), 0) as v
      from public.nominees n left join public.vote_orders o on o.nominee_id = n.id
     where n.category_id = p_category and n.active group by n.id)
  select t.id, case when t.v > 0 then (dense_rank() over (order by t.v desc))::int end from t;
$$;

drop function if exists public.get_board(text);
create function public.get_board(p_category text)
returns table(nominee_id uuid, slug text, name text, location text, photo_url text, rank integer)
language sql stable security definer set search_path = '' as $$
  select n.id, n.slug, n.name, n.location, n.photo_url, r.rnk
    from public.nominees n join private.category_ranks(p_category) r on r.nominee_id = n.id
   order by r.rnk nulls last, n.sort, n.name;
$$;

create or replace function public.get_nominee(p_slug text)
returns table(nominee_id uuid, slug text, name text, location text, photo_url text, bio text,
              category_id text, category_name text, status text, rank integer, nominee_count integer)
language sql stable security definer set search_path = '' as $$
  select n.id, n.slug, n.name, n.location, n.photo_url, n.bio, c.id, c.name, private.category_status(c),
         (select r.rnk from private.category_ranks(c.id) r where r.nominee_id = n.id),
         (select count(*)::int from public.nominees x where x.category_id = c.id and x.active)
    from public.nominees n join public.categories c on c.id = n.category_id
   where n.slug = p_slug and n.active;
$$;

-- Permissions: nothing executable by default; grant explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function public.get_site(), public.list_categories(), public.get_category(text),
  public.get_board(text), public.get_nominee(text) to anon, authenticated;
-- Secret-gated writers stay callable with the anon key (the secret is the gate).
grant execute on function
  public.create_vote_order(text, uuid, integer, text, text, text, text),
  public.attach_invoice(text, uuid, text, text),
  public.fail_order(text, uuid, text),
  public.settle_invoice(text, text, text, numeric, text, text, text),
  public.get_order(text, uuid),
  public.list_open_invoices(text, interval, int),
  public.expire_stale_orders(text),
  public.create_data_request(text, text, text, text, text)
  to anon;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Test window for the one open test category.
update public.categories
   set opens_at = '2026-11-01 00:00+03', closes_at = '2026-12-31 23:59+03'
 where id = 'breakthrough-act';
