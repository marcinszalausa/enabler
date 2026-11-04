// Commercial descriptions and signup preferences, never proof of paid access.
export const PAID_PLANS=[
 {id:"starter",name:"Starter",price:29,credits:300,accounts:1,maxAccounts:3,recommended:false,outcome:"Keep fresh ads ready",forWhom:"For a regular posting routine",allowance:"Credits per month",upgrade:"Create and plan",highlights:["300 generation credits every month","One social account included","Weekly planner and calendar reminders","Your saved brand style in every campaign"]},
 {id:"plus",name:"Plus",price:49,credits:600,accounts:1,maxAccounts:5,recommended:true,outcome:"Create, test and improve",forWhom:"For businesses ready to compare results",allowance:"Credits per month",upgrade:"Everything in Starter, plus",highlights:["600 generation credits every month","One social account included","Compare up to 16 recent posts","Download your results as a CSV report"]},
 {id:"growth",name:"Growth",price:79,credits:1000,accounts:1,maxAccounts:10,recommended:false,outcome:"Make more campaigns",forWhom:"For a busier content calendar",allowance:"Credits per month",upgrade:"Everything in Plus, plus",highlights:["1,000 generation credits every month","One social account included","Compare up to 30 recent posts","More allowance for creative variations"]},
] as const;
export type PaidPlanId=typeof PAID_PLANS[number]["id"];
export function paidPlan(value:unknown):PaidPlanId|null{return typeof value==="string"&&PAID_PLANS.some(p=>p.id===value)?value as PaidPlanId:null;}
export function paidPlanName(id:PaidPlanId){return PAID_PLANS.find(p=>p.id===id)!.name;}
// Existing verified-signup allowance: changing the selected plan never grants credits.
export const TRY_MODE={id:"free",name:"Try mode",price:0,credits:100,accounts:1} as const;
