-- Rollback test for Phase 1 voting rules. Run AFTER the migration body inside
-- BEGIN ... ROLLBACK. Raises an exception on the first failed check.
do $$
declare
  s text := (select value from private.settings where key = 'fn_secret');
  nom uuid; nom_closed uuid; o record; r record; ok boolean; n int;
  h text := repeat('a', 64); h2 text := repeat('b', 64); ip text := repeat('c', 64);
begin
  select id into nom from public.nominees where category_id = 'breakthrough-act' and active limit 1;

  -- A second test nominee in a CLOSED paid category, and one in an unpaid category.
  insert into public.nominees(category_id, name, slug) values
    ((select id from public.categories where paid_voting and id <> 'breakthrough-act' limit 1), 'TEST Closed', 'test-closed')
    returning id into nom_closed;

  -- 1. Wrong secret refused
  begin perform public.create_vote_order('nope', nom, 1, h, '07** ***001'); raise exception 'T1 FAIL';
  exception when insufficient_privilege then null; end;

  -- 2. Price comes from DB and is locked on the order
  select * into o from public.create_vote_order(s, nom, 5, h, '07** ***001', ip);
  if o.amount <> 5 * (select value::int from private.settings where key='vote_price') then raise exception 'T2 FAIL amount'; end if;

  -- 3. Closed category refused
  begin perform public.create_vote_order(s, nom_closed, 1, h2, 'x'); raise exception 'T3 FAIL';
  exception when others then if sqlerrm <> 'voting closed' then raise exception 'T3 FAIL: %', sqlerrm; end if; end;

  -- 4. Window enforced: move window into the past
  update public.categories set closes_at = now() - interval '1 minute' where id = 'breakthrough-act';
  begin perform public.create_vote_order(s, nom, 1, h2, 'x'); raise exception 'T4 FAIL';
  exception when others then if sqlerrm <> 'voting closed' then raise exception 'T4 FAIL: %', sqlerrm; end if; end;
  update public.categories set closes_at = now() + interval '1 day' where id = 'breakthrough-act';

  -- 5. Unpaid (jury) category refused even if switched open
  update public.categories set voting_open = true, opens_at = now() - interval '1 day', closes_at = now() + interval '1 day' where id = 'lifetime-achievement';
  insert into public.nominees(category_id, name, slug) values ('lifetime-achievement', 'TEST Honour', 'test-honour');
  begin perform public.create_vote_order(s, (select id from public.nominees where slug='test-honour'), 1, h2, 'x'); raise exception 'T5 FAIL';
  exception when others then if sqlerrm <> 'no paid voting' then raise exception 'T5 FAIL: %', sqlerrm; end if; end;

  -- 6. Settlement: underpayment counts only what was paid; COMPLETE needs matching api_ref
  perform public.attach_invoice(s, o.order_id, 'INV-T6', 'PENDING');
  begin perform public.settle_invoice(s, 'INV-T6', 'COMPLETE', 100, 'REF', null, 'someone-else'); raise exception 'T6a FAIL';
  exception when others then if sqlerrm <> 'api_ref mismatch' then raise exception 'T6a FAIL: %', sqlerrm; end if; end;
  update private.settings set value = '50' where key = 'vote_price';           -- price change after order
  select * into r from public.settle_invoice(s, 'INV-T6', 'COMPLETE', 60, 'REF', null, o.order_id::text);
  if r.votes_counted <> 3 then raise exception 'T6 FAIL: expected 3 votes (60/20), got %', r.votes_counted; end if;
  update private.settings set value = '20' where key = 'vote_price';

  -- 7. Idempotent: settling again never adds votes
  select * into r from public.settle_invoice(s, 'INV-T6', 'COMPLETE', 1000, 'REF', null, o.order_id::text);
  if r.votes_counted <> 3 then raise exception 'T7 FAIL'; end if;
  select votes into n from public.get_board('breakthrough-act') where nominee_id = nom;
  if n < 3 then raise exception 'T7 FAIL board'; end if;

  -- 8. FAILED never counts, and a later FAILED cannot undo a COMPLETE
  select * into r from public.settle_invoice(s, 'INV-T6', 'FAILED', 0, null, 'late', null);
  if r.state <> 'COMPLETE' or r.votes_counted <> 3 then raise exception 'T8 FAIL'; end if;

  -- 9. Per-phone limit: 5 unpaid prompts per 10 minutes
  for i in 1..5 loop perform public.create_vote_order(s, nom, 1, h2, 'x', repeat('d',64)); end loop;
  begin perform public.create_vote_order(s, nom, 1, h2, 'x', repeat('d',64)); raise exception 'T9 FAIL';
  exception when others then if sqlerrm <> 'too many prompts' then raise exception 'T9 FAIL: %', sqlerrm; end if; end;

  -- 10. Per-IP limit: 30 unpaid prompts per 10 minutes
  for i in 1..30 loop perform public.create_vote_order(s, nom, 1, md5(i::text) || md5(i::text), 'x', repeat('e',64)); end loop;
  begin perform public.create_vote_order(s, nom, 1, repeat('f',64), 'x', repeat('e',64)); raise exception 'T10 FAIL';
  exception when others then if sqlerrm <> 'too many prompts from network' then raise exception 'T10 FAIL: %', sqlerrm; end if; end;

  -- 11. Simulator payments refused once test mode is off
  update private.settings set value = 'false' where key = 'test_mode';
  begin perform public.create_vote_order(s, nom, 1, repeat('9',64), 'x', null, 'simulator'); raise exception 'T11 FAIL';
  exception when others then if sqlerrm <> 'simulator not allowed outside test mode' then raise exception 'T11 FAIL: %', sqlerrm; end if; end;
  update private.settings set value = 'true' where key = 'test_mode';

  -- 12. Reconciliation list returns old open invoices only
  update public.vote_orders set invoice_id = 'INV-T12', state = 'PENDING', created_at = now() - interval '5 minutes'
   where id = (select id from public.vote_orders where not counted and invoice_id is null and phone_hash = h2 limit 1);
  select count(*) into n from public.list_open_invoices(s) where invoice_id = 'INV-T12';
  if n <> 1 then raise exception 'T12 FAIL'; end if;

  -- 13. Anon cannot read tables directly
  set local role anon;
  begin perform 1 from public.vote_orders limit 1;
    if found then raise exception 'T13 FAIL: anon read vote_orders'; end if;
  exception when insufficient_privilege then null; end;
  begin perform 1 from private.settings; raise exception 'T13 FAIL settings';
  exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'ALL PHASE 1 TESTS PASSED';
end $$;
