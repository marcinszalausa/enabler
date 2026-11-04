import {IMAGE_CREDITS,VIDEO_CREDITS_PER_SECOND} from "./quality.ts";
import {planTools} from "./plan-value.ts";
export type CatalogPlan={id:string;price:number;credits:number;accounts:number};
export function planFeatureGroups(plan:CatalogPlan){
 const tools=planTools(plan.id),free=plan.id==="free";
 return [
  {name:"Your allowance",features:[
   ["Generation credits",plan.credits.toLocaleString("en-US")+(free?" once":" every month")],
   ["Connected social accounts",String(plan.accounts)],
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
   ["Image and MP4 downloads","Included"],
   ["Campaign-copy download","Included"],
  ]},
  {name:"Plan and publish",features:[
   ["Publish now or schedule manually","Included on supported connected accounts"],
   ["Posting calendar and saved time zone","Included"],
   ["Posting queue and opt-in autopilot","Included; setup and account permissions required"],
   ["Weekly planning preview",tools.weekPlanner?"Included; choose up to 7 saved ads":"Not included — Starter and Growth"],
   ["Download calendar reminders",tools.weekPlanner?"Included; reminders do not publish posts":"Not included — Starter and Growth"],
  ]},
  {name:"Understand the response",features:[
   ["Recent published posts in results",`Up to ${tools.resultsLimit}`],
   ["Available impressions, clicks and video views","Included where network analytics access is available"],
   ["Click rate","Shown when clicks and impressions are available"],
   ["Matching-network post comparisons",tools.resultsComparison?"Included; observed results, not a guaranteed winner":"Not included — Growth"],
   ["Download a results CSV",tools.resultsComparison?"Included; missing metrics remain blank":"Not included — Growth"],
  ]},
 ] as const;
}
export const PRICING_QUESTIONS=[
 ["What does a credit pay for?",`Credits pay for creating ads. Images use ${IMAGE_CREDITS.good}, ${IMAGE_CREDITS.better} or ${IMAGE_CREDITS.best} credits per image for Good, Better or Best quality. Each image idea is produced in two sizes. Videos use ${VIDEO_CREDITS_PER_SECOND.good}, ${VIDEO_CREDITS_PER_SECOND.better} or ${VIDEO_CREDITS_PER_SECOND.best} credits per second for Good, Better or Best, rounded to the nearest five credits per video. Standard video batches contain two videos; single-ad revisions have their own one-output price. The full cost is shown before creation.`],
 ["What is included in Free?","Free includes 100 one-time credits, one connected social account, product import, a saved brand kit, campaign planning, image and video generation using credits, text editing, downloads, manual scheduling and basic post results where available. The credit allowance does not automatically refill. No card is needed to start."],
 ["Why choose Starter instead of Free?","Starter includes 300 credits every month and three connected accounts. It adds a weekly planning preview for up to seven selected ads and downloadable calendar reminders, helping you keep a regular posting routine. Existing creation and publishing tools remain included."],
 ["Why choose Growth instead of Starter?","Growth includes 1,000 monthly credits and ten connected accounts. It adds comparisons for up to 30 recent published posts within matching networks and a downloadable results CSV. At the listed prices ($99 for 1,000 credits versus $39 for 300), its cost per included credit is about 24% lower than Starter. Network data availability still applies."],
 ["Can I get my money back?","Yes. If Gooidy isn't right for you, email hello@gooidy.com within 30 days of your first paid subscription payment and we'll refund that payment in full. There is no introductory discount that later jumps in price: the price you see is the price you pay each month."],
 ["Does a higher plan unlock better generation quality?","All plans can choose from the same available generation quality levels. Higher quality uses more credits. Upgrading adds allowance, account capacity and workflow tools."],
 ["What can I change without generating again?","Image headlines, button labels and post captions can be edited without generation credits. A different scene or rendered video requires new generation. Single-ad revisions show their own price and keep the original. Editing a video post caption does not change the video’s existing narration or on-screen text. Scheduled and published posts do not update automatically."],
 ["Does the weekly planner post for me?","No. The Starter and Growth planner previews available times from your saved posting routine and downloads calendar review reminders. It does not reserve slots or publish. Review each ad and destination, then schedule it through Publishing. The existing opt-in autopilot setting is a separate control."],
 ["Are social posting and paid advertising the same thing?","No. Social publishing shares posts through connected accounts. Paid advertising budgets and paid campaign management are not included in these plans. Saving a campaign plan or using the weekly planner does not purchase advertising or spend generation credits."],
 ["Will I get unlimited ads or guaranteed sales?","No. Credits are finite, and quality, format and video length determine generation cost. Social metrics depend on network support, permissions and analytics access, and can be delayed. Store sales and revenue attribution are not connected, and no advertising results are guaranteed."],
] as const;
export function pricingStructuredData(plans:readonly CatalogPlan[]){return {"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","@id":"https://gooidy.com/pricing#page",url:"https://gooidy.com/pricing",name:"Gooidy pricing and full plan comparison",inLanguage:"en",mainEntity:{"@id":"https://gooidy.com/pricing#plans"}},
 {"@type":"ItemList","@id":"https://gooidy.com/pricing#plans",name:"Gooidy Free, Starter and Growth plans",itemListElement:plans.map((plan,i)=>({"@type":"ListItem",position:i+1,name:"Gooidy "+plan.id[0].toUpperCase()+plan.id.slice(1),description:[`USD ${plan.price}${plan.id==="free"?"; one-time credit allowance":" per month"}`,...planFeatureGroups(plan).flatMap(group=>group.features.map(([label,value])=>label+": "+value))].join(". ")}))},
 {"@type":"FAQPage","@id":"https://gooidy.com/pricing#faq",mainEntity:PRICING_QUESTIONS.map(([name,text])=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}))},
 ]};}
export function pricingStructuredJson(plans:readonly CatalogPlan[]){return JSON.stringify(pricingStructuredData(plans)).replace(/</g,"\\u003c");}
