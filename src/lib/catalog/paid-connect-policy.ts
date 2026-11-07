import {createHash,timingSafeEqual} from "node:crypto";
export function paidIntentMatches(intent:{user_id:string;nonce_hash:string;expires_at:string;status:string},userId:string,nonce:string,now=Date.now()){
 if(intent.user_id!==userId||intent.status==="consumed"||!Number.isFinite(Date.parse(intent.expires_at))||Date.parse(intent.expires_at)<=now||!/^[a-f0-9]{64}$/.test(intent.nonce_hash)||!/^[a-f0-9]{64}$/.test(nonce))return false;
 return timingSafeEqual(Buffer.from(intent.nonce_hash,"hex"),createHash("sha256").update(nonce).digest());
}
