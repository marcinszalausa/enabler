// Pre-launch only. Publishing draft policies never enables payments.
export const LEGAL_POLICY_VERSION = "2026-11-05-r5";
export const PAID_CHECKOUT_STATUS = "unavailable" as const;
export const LEGAL_DOCUMENT_STATUS = "prelaunch-review" as const;
export const LEGAL_OPERATOR_NAME: string|null = null;
export const LEGAL_BUSINESS_ADDRESS: string|null = null;
export const POLICY_IDS = ["terms","privacy","billing","cookies","acceptable-use","privacy-requests"] as const;
export type PolicyId = typeof POLICY_IDS[number];
export function isPolicyId(value:unknown):value is PolicyId{
 return typeof value==="string"&&(POLICY_IDS as readonly string[]).includes(value);
}
export function policyPath(id:PolicyId){
 return id==="terms"||id==="privacy"?"/"+id:"/policies/"+id;
}
export const PRIVACY_REQUESTS = {
 export:"Request a copy of my data",
 correction:"Correct my information",
 deletion:"Request account/data deletion",
 appeal:"Appeal a privacy decision"
} as const;
export function privacyRequestHref(kind:keyof typeof PRIVACY_REQUESTS){
 return "mailto:hello@gooidy.com?subject="+encodeURIComponent("Gooidy privacy request: "+kind)+"&body="+encodeURIComponent("Hello, I would like help with a privacy "+kind+" request. Please tell me the appropriate verification steps. I will not include passwords, one-time codes or payment details in this email.");
}
