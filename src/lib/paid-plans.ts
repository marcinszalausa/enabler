// Commercial descriptions and signup preferences, never proof of paid access.
export const PAID_PLANS=[
 {id:"starter",name:"Launch",price:39,credits:300,accounts:1,maxAccounts:3,recommended:false,outcome:"Create and publish",forWhom:"For a steady posting routine",allowance:"Credits per month",upgrade:"Create and plan",highlights:["300 generation credits every month","Branded image and video ads using credits","One social account included","Free text edits; image and MP4 downloads","Weekly planner and scheduled posts"]},
 {id:"plus",name:"Grow",price:69,credits:600,accounts:1,maxAccounts:5,recommended:true,outcome:"Connect your store and compare",forWhom:"For shops ready to learn what works",allowance:"Credits per month",upgrade:"Everything in Launch, plus",highlights:["600 generation credits every month","Compare up to 16 recent posts","Connect your store and import products","Private product-photo uploads and checks","Download your results as a CSV report"]},
 {id:"growth",name:"Scale",price:99,credits:1000,accounts:1,maxAccounts:10,recommended:false,outcome:"Plan your next campaign",forWhom:"For businesses making more ads and planning their next test",allowance:"Credits per month",upgrade:"Everything in Grow, plus",highlights:["1,000 generation credits every month","Compare up to 30 recent posts","Next-test action plan from your results","Download your next-campaign brief","More included credits for more variations"]},
] as const;
export type PaidPlanId=typeof PAID_PLANS[number]["id"];
export function paidPlan(value:unknown):PaidPlanId|null{return typeof value==="string"&&PAID_PLANS.some(p=>p.id===value)?value as PaidPlanId:null;}
export function paidPlanName(id:PaidPlanId){return PAID_PLANS.find(p=>p.id===id)!.name;}
// Existing verified-signup allowance: changing the selected plan never grants credits.
export const TRY_MODE={id:"free",name:"One-time preview",price:0,credits:100,accounts:1} as const;

