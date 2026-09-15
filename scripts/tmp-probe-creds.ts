import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
const url=process.env.SUPABASE_URL!,svc=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin=createClient(url,svc,{auth:{persistSession:false}});
const {decryptToken}=await import("../src/lib/crypto.server");
const {data:a}:any=await admin.from("security_test_accounts" as any).select("user_id,email,password_enc,totp_secret_enc").eq("label","staff").maybeSingle();
await admin.auth.admin.updateUserById(a.user_id,{ban_duration:"none"});
writeFileSync("/tmp/browser/idle/creds.json",JSON.stringify({email:a.email,password:decryptToken(a.password_enc),secret:decryptToken(a.totp_secret_enc)}),{mode:0o600});
console.log("credentials staged for the contained test account (not printed)");
