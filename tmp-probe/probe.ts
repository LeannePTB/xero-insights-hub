import { getConnectionByTenant } from "@/lib/xero/api.server";
const conn = await getConnectionByTenant("7a684121-3a8f-4162-aef9-d176b55571a1");
async function g(path: string) {
  const res = await fetch(`https://api.xero.com/payroll.xro/1.0/${path}`, {
    headers: { Authorization: `Bearer ${conn.access_token}`, "Xero-tenant-id": conn.tenant_id, Accept: "application/json" },
  });
  const t = await res.text();
  console.log("==", path, res.status, t.slice(0, 2500));
}
await g("PayRuns?page=1");
await g("Settings");
