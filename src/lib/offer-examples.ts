import {growthTests,growthTestingBrief} from "./growth-testing";
import type {ReportRow} from "./plan-value";

// Deliberately synthetic inputs for a labeled public product preview.
// These are never customer testimonials, live results or workspace data.
export const SCALE_SAMPLE_ROWS:ReportRow[]=[
 {id:"sample-benefit",network:"Instagram",caption:"From pajamas to jeans, one soft layer",date:"2026-01-05",state:"ready",impressions:2000,clicks:60,views:null},
 {id:"sample-curiosity",network:"Instagram",caption:"Why it’s called The Hug Cardigan",date:"2026-01-05",state:"ready",impressions:2000,clicks:30,views:null},
];
export function sampleCampaignBrief(){return "ILLUSTRATIVE SAMPLE — NOT CUSTOMER RESULTS\n\n"+growthTestingBrief(growthTests(SCALE_SAMPLE_ROWS),"Illustrative sample");}
