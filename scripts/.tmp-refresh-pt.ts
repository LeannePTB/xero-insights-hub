import { resolveRefreshTarget, refreshTenant } from "@/lib/xero/snapshot-refresh.server";
const t = await resolveRefreshTarget("297a370f-81ae-4aeb-b289-ec5c5043ac09");
if (!t || t.clientId !== "0bdbfe31-6256-4a5f-b6bb-aefcd9837ad3") { console.log("target mismatch", t?.clientId); process.exit(1); }
const r = await refreshTenant(t, "manual");
console.log(JSON.stringify(r));
