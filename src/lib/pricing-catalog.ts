import {IMAGE_CREDITS,VIDEO_CREDITS_PER_SECOND} from "./quality.ts";
import {PAID_PLANS,TRY_MODE} from "./paid-plans.ts";
import {planTools} from "./plan-value.ts";
export type CatalogPlan={id:string;price:number;credits:number;accounts:number};
export function planFeatureGroups(plan:CatalogPlan){
 const tools=planTools(plan.id),free=plan.id==="free";
 return [
  {name:"Your allowance",features:[
   ["Generation credits",plan.credits.toLocaleString("en-US")+(free?" once":" every month")],
   ["Connected social accounts",free?String(plan.accounts):`${plan.accounts} included; optional extra connections are separately priced before activation`],
   ["Images and videos","Share the same credit balance"],
   ["Cost before generation","Shown before you confirm"],
  ]},
  {name:"Create and keep your brand",features:[
   ["Product-page import and brand brief","Included"],
   ["Square and vertical image ads","2, 6 or 10 images per standard batch"],
   ["Vertical video ads","7–30 seconds; 2 videos per standard batch"],
   ["Video narration, captions and music","Included in video generation"],
   ["Language and voice choices","Available when creating ads"],
   ["Saved logo, colors, font and brand voice","Included"],
   ["Campaign plans and seasonal ideas","Included"],
   ["Reusable creative starting points","Included; editable directions, not fixed layouts"],
  ]},
  {name:"Review, edit and download",features:[
   ["Automated image and video quality checks","Included; your final review is still required"],
   ["Image headline and button edits","Included; no generation credits"],
   ["Post-caption edits","Included; no generation credits"],
   ["Recreate one selected image or video","Uses the single-output price shown before creation"],
   ["Free redo when an image doesn't match your product","Up to 3 per month"],
   ["Image and MP4 downloads","Included"],
   ["Campaign-copy download","Included"],
  ]},
  {name:"Plan and publish",features:[
   ["Publish now or schedule manually","Included on supported connected accounts"],
   ["Posting calendar and saved time zone","Included"],
   ["Posting queue and opt-in autopilot","Included; setup and account permissions required"],
   ["Weekly planning preview",tools.weekPlanner?"Included; choose up to 7 saved ads":"Not included — paid plans"],
   ["Download calendar reminders",tools.weekPlanner?"Included; reminders do not publish posts":"Not included — paid plans"],
  ]},
  {name:"Understand the response",features:[
   ["Recent published posts in results",`Up to ${tools.resultsLimit}`],
   ["Available impressions, clicks and video views","Included where network analytics access is available"],
   ["Click rate","Shown when clicks and impressions are available"],
   ["Matching-network post comparisons",tools.resultsComparison?"Included; observed results, not a guaranteed winner":"Not included — Plus and Growth"],
   ["Filter comparisons by social network",tools.resultsComparison?"Included; CSV export follows the selected view":"Not included — Plus and Growth"],
   ["Results-based next-test action plan",tools.growthActionPlan?"Included; up to 3 exploratory tests from comparable posts with sufficient metrics":"Not included — Growth only"],
   ["Download a next-campaign testing brief",tools.growthActionPlan?"Included; planning uses no generation credits":"Not included — Growth only"],
   ["Download a results CSV",tools.resultsComparison?"Included; missing metrics remain blank":"Not included — Plus and Growth"],
  ]},
 ] as const;
}
export const PRICING_QUESTIONS=[
 ["Can I get my money back?","Email hello@gooidy.com within 30 days of your first paid monthly subscription payment for a full refund of that first payment. The guarantee applies once per customer; later renewals and one-time credit packs follow the disclosed purchase terms and applicable law."],
 ["Can I try Gooidy for free?",`Choose Starter, Plus or Growth to try the core ad-creation workflow with ${TRY_MODE.credits} one-time starter credits. The allowance is shared across your account and does not reset when you choose another plan. No card is needed and no subscription starts automatically. Monthly allowances and paid workflow tools require paid activation. Existing accounts retain their current credits and access.`],
 ["What is the monthly price?",PAID_PLANS.map(p=>`${p.name} is $${p.price} USD per month with ${p.credits.toLocaleString("en-US")} monthly generation credits`).join(". ")+". There is no separate introductory price or higher automatic renewal amount."],
 ["How are additional social accounts priced?","Each new paid plan includes one social account. Extra connections are optional, separately priced and confirmed before paid activation. Selecting free preview does not purchase extra accounts. Existing accounts keep their current connection limits."],
 ["What does a credit pay for?",`Images use ${IMAGE_CREDITS.good}, ${IMAGE_CREDITS.better} or ${IMAGE_CREDITS.best} credits per image for Good, Better or Best quality. Each standard image idea comes in two sizes. Video uses ${VIDEO_CREDITS_PER_SECOND.good}, ${VIDEO_CREDITS_PER_SECOND.better} or ${VIDEO_CREDITS_PER_SECOND.best} credits per second, rounded to the nearest five credits per video. Standard video batches have two videos; single-ad revisions have a one-output price. The full cost is shown before creation.`],
 ["Does a higher plan unlock better generation quality?","All plans can choose the same available generation quality levels. Higher quality uses more credits. Upgrading adds monthly allowance and workflow tools."],
 ["What can I edit without using generation credits?","Image headlines, button labels and post captions can be edited without generation credits. Recreating an image or video uses its displayed credit price and keeps the original. Editing a video post caption does not change its rendered narration or on-screen text. Existing scheduled and published posts stay as they were."],
 ["Does the planner post automatically?","The paid weekly planner previews posting times and downloads calendar reminders. It does not reserve slots or publish. Review each ad and destination before scheduling in Publishing. The existing opt-in autopilot setting is separate."],
 ["How do the reporting tools differ?","Basic post results show up to eight recent published posts where network analytics is available. Plus adds comparisons for up to 16 recent posts, network filtering and CSV reports for the selected view. Growth expands that view to 30 and adds an exclusive next-test action plan and downloadable campaign brief. A suggestion needs two distinct posts on the same network or network combination, each with at least 500 reported impressions, usable click metrics and different observed click rates. Up to three exploratory test ideas are shown; insufficient data produces no recommendation. Planning and downloading use no generation credits. New ad creation has its own displayed credit cost. These are not controlled A/B tests, automatic publishing, guaranteed winners or store-sales attribution. Metrics may be delayed or unavailable."],
 ["Do I have to try before buying?","No. A free preview is optional. Purchases are currently unavailable, so the Buy buttons are disabled. Try for free uses the one-time allowance and does not start a subscription. When purchasing is available, payment will require a separate checkout confirmation showing the monthly price, optional charges and billing terms."],
 ["Are advertising budgets or unlimited ads included?","No. Credits are finite and shared between images and videos. Paid advertising budgets are separate from creative generation and social posting. Store-sales attribution, paid campaign management and guaranteed results are not included."],
] as const;
export function pricingStructuredData(plans:readonly CatalogPlan[]){return {"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","@id":"https://gooidy.com/pricing#page",url:"https://gooidy.com/pricing",name:"Gooidy pricing and full plan comparison",inLanguage:"en",mainEntity:{"@id":"https://gooidy.com/pricing#plans"}},
 {"@type":"ItemList","@id":"https://gooidy.com/pricing#plans",name:"Gooidy Starter, Plus and Growth plans",itemListElement:plans.map((plan,i)=>({"@type":"ListItem",position:i+1,name:"Gooidy "+plan.id[0].toUpperCase()+plan.id.slice(1),description:[`USD ${plan.price}${plan.id==="free"?"; one-time credit allowance":" per month"}`,...planFeatureGroups(plan).flatMap(group=>group.features.map(([label,value])=>label+": "+value))].join(". ")}))},
 {"@type":"FAQPage","@id":"https://gooidy.com/pricing#faq",mainEntity:PRICING_QUESTIONS.map(([name,text])=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}))},
 ]};}
export function pricingStructuredJson(plans:readonly CatalogPlan[]){return JSON.stringify(pricingStructuredData(plans)).replace(/</g,"\\u003c");}
