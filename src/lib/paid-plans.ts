// Commercial descriptions and signup preferences, never proof of paid access.
export const PAID_PLANS=[
 {id:"starter",name:"Launch",price:39,credits:300,accounts:1,maxAccounts:3,recommended:false,outcome:"Keep fresh ads ready",forWhom:"For a regular posting routine",allowance:"Credits per month",upgrade:"Create and plan",highlights:["300 generation credits every month","Image and video ads in your brand","One social account included","Free text edits and ad downloads","Weekly planner and scheduled posts"]},
 {id:"plus",name:"Grow",price:69,credits:600,accounts:1,maxAccounts:5,recommended:true,outcome:"Create, test and improve",forWhom:"For businesses ready to compare results",allowance:"Credits per month",upgrade:"Everything in Launch, plus",highlights:["600 generation credits every month","Compare up to 16 recent posts","Spot posts with higher click rates","Filter results by social network","Download your results as a CSV report"]},
 {id:"growth",name:"Scale",price:99,credits:1000,accounts:1,maxAccounts:10,recommended:false,outcome:"Know what to test next",forWhom:"For businesses turning results into their next campaign",allowance:"Credits per month",upgrade:"Everything in Grow, plus",highlights:["1,000 generation credits every month","Compare up to 30 recent posts","Scale-only next-test action plan","Download your next-campaign brief","Lowest price per included credit"]},
] as const;
export type PaidPlanId=typeof PAID_PLANS[number]["id"];
export function paidPlan(value:unknown):PaidPlanId|null{return typeof value==="string"&&PAID_PLANS.some(p=>p.id===value)?value as PaidPlanId:null;}
export function paidPlanName(id:PaidPlanId){return PAID_PLANS.find(p=>p.id===id)!.name;}
// Existing verified-signup allowance: changing the selected plan never grants credits.
export const TRY_MODE={id:"free",name:"Free preview",price:0,credits:100,accounts:1} as const;
