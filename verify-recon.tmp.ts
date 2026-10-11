import { resolveRefreshTarget, refreshTenant } from "@/lib/xero/snapshot-refresh.server";
import { writeKeyFigures } from "@/lib/overview/key-figures.server";
const tenants = process.argv.slice(2);
for (const t of tenants) {
  const target = await resolveRefreshTarget(t);
  if (!target) { console.log(t, "no target"); continue; }
  const r = await refreshTenant(target, "manual");
  console.log(t, r.status, r.succeeded, r.failed, (r as any).errors?.join(" | ")?.slice(0, 300) ?? "");
  await writeKeyFigures(target);
}
