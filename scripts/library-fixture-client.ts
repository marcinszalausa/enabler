// CI-only local PostgREST client. Never imported by production application code.
import {createHmac} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
export const LIBRARY_TEST_USER="81000000-0000-4000-8000-000000000001";
const secret="library-fixture-jwt-secret-at-least-32-characters";
export function libraryTestClient(userId=LIBRARY_TEST_USER){
 const encoded=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString("base64url");
 const data=encoded({alg:"HS256",typ:"JWT"})+"."+encoded({role:"authenticated",sub:userId,aud:"authenticated",exp:1893456000});
 const token=data+"."+createHmac("sha256",secret).update(data).digest("base64url");
 const client=createClient("http://localhost:3000","fixture-public-key",{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:"Bearer "+token},fetch:(input,init)=>{
   const u=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
   u.pathname=u.pathname.replace(/^\/rest\/v1/,"");return fetch(u,init);
  }},
 });
 client.auth.getUser=async()=>({data:{user:{id:userId,email:"fixture@example.invalid",app_metadata:{},user_metadata:{},aud:"authenticated",created_at:"2026-11-03T00:00:00Z"}},error:null});
 return client;
}
