-- Privacy notice promise: internet-address codes are deleted after 90 days.
create or replace function public.purge_old_ip_hashes(p_secret text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.check_secret(p_secret);
  update public.vote_orders set ip_hash = null where ip_hash is not null and created_at < now() - interval '90 days';
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function public.purge_old_ip_hashes(text) from public, authenticated;
grant execute on function public.purge_old_ip_hashes(text) to anon;
