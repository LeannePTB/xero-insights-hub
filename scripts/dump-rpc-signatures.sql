-- Read-only snapshot of every callable public function signature, by INPUT
-- argument name. Used by tests/rpc-signatures.test.ts to prove that every
-- `.rpc("name", { ... })` call in src still matches the live database, and by
-- scripts/check-rpc-signatures.sh to prove the snapshot itself is not stale.
--
-- Only input arguments matter here: PostgREST resolves an RPC by the JSON keys
-- posted, so an added or renamed parameter is exactly what breaks a caller.
with fn as (
  select
    p.proname as name,
    p.pronargs as nargs,
    p.pronargdefaults as ndefaults,
    coalesce(
      (
        select array_agg(a.argname order by a.ord)
        from unnest(
               coalesce(p.proargnames, array[]::text[]),
               coalesce(p.proargmodes, array_fill('i'::"char", array[coalesce(array_length(p.proargnames, 1), 0)]))
             ) with ordinality as a(argname, argmode, ord)
        where a.argmode in ('i', 'b', 'v')
      ),
      array[]::text[]
    ) as in_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
)
select jsonb_pretty(
  jsonb_agg(
    jsonb_build_object('name', name, 'args', to_jsonb(in_args), 'required', greatest(nargs - greatest(ndefaults, 0), 0))
    order by name, nargs
  )
)
from fn;
