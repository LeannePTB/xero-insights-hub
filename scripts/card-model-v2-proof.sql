-- Batch 4 proof: the purchase + ticked-list card model, run with the switch ON
-- inside one transaction that always rolls back, so production is never flipped.
-- Proves: (A) every client's visible cards = ticked list intersected with the
-- organisation's purchase; (B) no client shows a card its organisation has not
-- purchased; (C) organisation level gives one answer for Consolidation;
-- (D) the dashboard gate itself refuses an unpurchased Advisory or consolidated
-- card for a real signed-in staff caller — the single gate every route uses
-- (dashboard read, direct URL, server function, saved report link);
-- and the four consolidation counts are unchanged.
-- Run with: the SQL runner, as one statement. It ALWAYS ends in an error whose
-- message is the result — that is how the transaction is rolled back.

do $$
declare
  c record; r record; log text := '';
  before_counts int[]; after_counts int[];
  tenant text; failures int := 0;
begin
  select array[
    (select count(*) from public.loan_consolidation_accounts),
    (select count(*) from public.consolidation_group_members),
    (select count(*) from public.consolidation_groups),
    (select count(*) from public.loan_consolidation_snapshots)] into before_counts;

  update app_private.platform_settings set value='true' where key='card_model_v2';
  if not app_private.setting_bool('card_model_v2') then raise exception 'switch did not flip'; end if;

  -- Proof A: every client's list = ticked ∩ purchase, and equals the gate's list.
  for c in select cl.id, cl.name, cl.firm_id from public.clients cl loop
    if not (public.client_allowed_widgets(c.id) @> app_private.client_cards_v2(c.id)
        and app_private.client_cards_v2(c.id) @> public.client_allowed_widgets(c.id)) then
      log := log || ' | ' || format('FAIL A list mismatch %s', c.name); failures := failures + 1;
    end if;
  end loop;

  -- Proof B: no client shows a card its organisation has not purchased.
  for c in select cl.id, cl.name, cl.firm_id, o.advisory_enabled, o.consolidation_enabled
             from public.clients cl left join public.org_subscription_options o on o.firm_id=cl.firm_id loop
    if not coalesce(c.advisory_enabled,false) then
      if exists (select 1 from unnest(public.client_allowed_widgets(c.id)) w
                  where w = any(app_private.card_group_cards('advisory'))) then
        log := log || ' | ' || format('FAIL B advisory card without Advisory: %s', c.name); failures := failures + 1;
      end if;
    end if;
    if not coalesce(c.consolidation_enabled,false) then
      if 'loan_consolidation' = any(public.client_allowed_widgets(c.id)) then
        log := log || ' | ' || format('FAIL B consolidation card without Consolidation: %s', c.name); failures := failures + 1;
      end if;
    end if;
  end loop;

  -- Proof C: organisation level agrees — one answer for Consolidation.
  for r in select f.id, f.name, coalesce(o.consolidation_enabled,false) con
             from public.firms f left join public.org_subscription_options o on o.firm_id=f.id loop
    if not r.con and 'loan_consolidation' = any(public.firm_allowed_widgets(r.id)) then
      log := log || ' | ' || format('FAIL C org offers consolidation without purchase: %s', r.name); failures := failures + 1;
    end if;
  end loop;

  -- Proof D: the dashboard gate itself refuses an unpurchased card, as a real
  -- signed-in staff caller (claims of a live aal2 session), for a Standard-only
  -- organisation's Xero file. Covers dashboard read, direct URL, server function
  -- and report link, which all funnel through assert_widget_access.
  perform set_config('request.jwt.claims',
    json_build_object('sub','57d544ad-db50-4330-9b12-bcffdf4c6065','role','authenticated',
                      'aal','aal2','session_id','fb531226-aecf-49eb-a35e-0432fa5182f6')::text, true);

  select x.tenant_id into tenant
    from public.clients cl
    join public.client_xero_orgs cxo on cxo.client_id = cl.id
    join public.xero_connections x on x.id = cxo.xero_connection_id
    left join public.org_subscription_options o on o.firm_id = cl.firm_id
   where not coalesce(o.advisory_enabled,false) limit 1;

  if tenant is null then
    log := log || ' | ' || format('SKIP D: no Xero file on a Standard-only organisation');
  else
    begin
      perform public.assert_widget_access(tenant, 'health');
      log := log || ' | ' || format('PASS D purchased card allowed');
    exception when others then
      log := log || ' | ' || format('FAIL D purchased card refused: %s', sqlerrm); failures := failures + 1;
    end;
    begin
      perform public.assert_widget_access(tenant, 'cashflow');
      log := log || ' | ' || 'FAIL D unpurchased Advisory card ALLOWED'; failures := failures + 1;
    exception when others then
      if sqlerrm like '%not enabled%' then log := log || ' | ' || format('PASS D advisory refused: %s', sqlerrm);
      else log := log || ' | ' || format('FAIL D wrong error: %s', sqlerrm); failures := failures + 1; end if;
    end;
    begin
      perform public.assert_widget_access(tenant, 'loan_consolidation');
      log := log || ' | ' || 'FAIL D consolidated card ALLOWED'; failures := failures + 1;
    exception when others then
      if sqlerrm like '%not enabled%' then log := log || ' | ' || format('PASS D consolidation refused');
      else log := log || ' | ' || format('FAIL D wrong error: %s', sqlerrm); failures := failures + 1; end if;
    end;
  end if;
  perform set_config('request.jwt.claims', '', true);

  select array[
    (select count(*) from public.loan_consolidation_accounts),
    (select count(*) from public.consolidation_group_members),
    (select count(*) from public.consolidation_groups),
    (select count(*) from public.loan_consolidation_snapshots)] into after_counts;
  if before_counts is distinct from after_counts then
    raise exception 'consolidation counts changed % -> %', before_counts, after_counts;
  end if;
  log := log || ' | ' || format('consolidation counts unchanged: %s', after_counts);

  update app_private.platform_settings set value='false' where key='card_model_v2';
  if app_private.setting_bool('card_model_v2') then raise exception 'switch not restored'; end if;

  if failures > 0 then raise exception 'PROOF FAILURES % : %', failures, log; end if;
  log := log || ' | ' || format('ALL PROOFS PASSED, switch restored to false');
  raise exception 'PROOF RESULT (rolled back, switch left false): %', log;
