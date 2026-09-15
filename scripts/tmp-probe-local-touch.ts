import { createClient } from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL!,anon=process.env.SUPABASE_PUBLISHABLE_KEY!,svc=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin=createClient(url,svc,{auth:{persistSession:false}});
const {decryptToken}=await import("../src/lib/crypto.server");
const {totpCode}=await import("../src/lib/totp.server");
const {data:a}:any=await admin.from("security_test_accounts" as any).select("user_id,email,password_enc,totp_secret_enc").eq("label","staff").maybeSingle();
await admin.auth.admin.updateUserById(a.user_id,{ban_duration:"none"});
const c=createClient(url,anon,{auth:{persistSession:false}});
await c.auth.signInWithPassword({email:a.email,password:decryptToken(a.password_enc)});
const f=await c.auth.mfa.listFactors();const fid=f.data!.totp[0].id;
const ch=await c.auth.mfa.challenge({factorId:fid});
const v=await c.auth.mfa.verify({factorId:fid,challengeId:ch.data!.id,code:totpCode(decryptToken(a.totp_secret_enc))});
const tok=v.data!.access_token;
const sid=JSON.parse(Buffer.from(tok.split(".")[1],"base64url").toString()).session_id;
const base="http://localhost:8080/_serverFn/1ad2fbe62a40ffa78331df52250ee5cba03db564c692ceb74ffebcb83fd9115e";
for(const [name,u,init] of [
 ["no body",base,{method:"POST",headers:{Authorization:`Bearer ${tok}`}}],
 ["empty obj",base,{method:"POST",headers:{Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:"{}"}],
] as any[]){
  await admin.from("session_activity" as any).delete().eq("session_id",sid);
  const r=await fetch(u,init); const t=await r.text();
  const {data:row}=await admin.from("session_activity" as any).select("session_id").eq("session_id",sid).maybeSingle();
  console.log(name,r.status,t.slice(0,200).replace(/\n/g," "),"row:",row?"written":"none");
}
await c.auth.signOut();
await admin.auth.admin.updateUserById(a.user_id,{ban_duration:"876000h"});
