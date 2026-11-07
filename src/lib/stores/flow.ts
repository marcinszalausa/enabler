import "server-only";
import {randomBytes} from "node:crypto";
import {createAdminClient} from "@/lib/supabase/admin";
import {encryptCatalogSecret} from "@/lib/catalog/security";
import {storeKey,intentHash,type StoreProvider} from "./providers";
import type {StoreProof} from "./api";
export async function stageInstallation(proof:StoreProof,intent:string|null){
 const claim=randomBytes(32).toString("hex");
 const {error}=await createAdminClient().from("store_install_receipts").insert({claim_hash:intentHash(claim),intent_hash:intent,provider:proof.provider,provider_id:proof.providerId,store_url:proof.storeUrl,store_key:storeKey(proof.storeUrl),name:proof.name.slice(0,300),credentials_cipher:encryptCatalogSecret(JSON.stringify(proof.credentials)),expires_at:new Date(Date.now()+600000).toISOString()});
 if(error)throw new Error("STORE_PROOF_SAVE_FAILED");return claim;
}
export async function pendingIntent(state:string,provider:StoreProvider){
 if(!/^[a-f0-9]{64}$/.test(state))throw new Error("STORE_STATE_INVALID");
 const {data,error}=await createAdminClient().from("store_connect_intents").select("*").eq("state_hash",intentHash(state)).eq("provider",provider).gt("expires_at",new Date().toISOString()).single();
 if(error||!data)throw new Error("STORE_STATE_INVALID");return data;
}
export function continueInstallation(claim:string){
 // A top-level link also works when a provider loads its callback inside an iframe.
 const href="https://gooidy.com/api/stores/complete?claim="+claim;
 return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to Gooidy</title><body><main style="font-family:system-ui;max-width:32rem;margin:12vh auto;padding:24px"><h1>Store authorized</h1><p>Return to Gooidy to finish connecting your store.</p><a target="_top" rel="noreferrer" style="display:inline-block;padding:16px 24px;background:#5946e8;color:white;border-radius:12px;text-decoration:none" href="'+href+'">Continue to Gooidy →</a></main></body></html>',{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}});
}
