import {catalogEnabled} from "./security";
export function websiteStoresReady(){return process.env.VERCEL_ENV==="production"&&catalogEnabled()&&!!process.env.INNGEST_EVENT_KEY&&!!process.env.INNGEST_SIGNING_KEY;}
