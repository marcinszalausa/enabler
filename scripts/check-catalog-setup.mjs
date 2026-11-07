import {shopifyConfigured} from "../src/lib/shopify/security.ts";
import {trainingAllowed} from "../src/lib/catalog/security.ts";

// Offline operator preflight. Never prints configuration values, contacts a
// provider, changes a feature flag, starts training, or grants paid access.
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!["--training","--json"].includes(arg))){console.error("Usage: node --experimental-strip-types scripts/check-catalog-setup.mjs [--training] [--json]");process.exitCode=2;}
else{
 const env=process.env,checks=[];
 function setting(name,validate=()=>true){
  const value=env[name];const status=!value?"missing":/^(?:replace[_ -]?me|your[_ -]|<)/i.test(value)?"placeholder":validate(value)?"configured":"invalid";
  checks.push({name,status});
 }
 const flag=name=>setting(name,value=>value==="true");
 setting("VERCEL_ENV",value=>value==="production");
 flag("CATALOG_INGESTION_ENABLED");
 setting("CATALOG_ENCRYPTION_KEY",value=>/^[a-f0-9]{64}$/i.test(value));
 setting("INNGEST_EVENT_KEY");setting("INNGEST_SIGNING_KEY");
 // Public server URL for worker registration, not a secret.
 setting("INNGEST_SERVE_ORIGIN",value=>value==="https://gooidy.com");
 flag("SHOPIFY_CONNECT_ENABLED");setting("SHOPIFY_CLIENT_ID");setting("SHOPIFY_CLIENT_SECRET");
 setting("SHOPIFY_APP_ORIGIN",value=>value==="https://gooidy.com");
 if(args.has("--training")){
  flag("CATALOG_TRAINING_ENABLED");
  setting("CATALOG_PILOT_WORKSPACE_ID",value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value));
  setting("CATALOG_PILOT_PRODUCT_URL",value=>{try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!url.hash&&url.pathname!=="/";}catch{return false;}});
  setting("REPLICATE_API_TOKEN");
  setting("REPLICATE_TRAINER_VERSION",value=>/^[a-f0-9]{64}$/.test(value));
  setting("REPLICATE_TRAINING_DESTINATION",value=>/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(value));
 }
 const gate=shopifyConfigured()&&(!args.has("--training")||trainingAllowed(env.CATALOG_PILOT_WORKSPACE_ID,env.CATALOG_PILOT_PRODUCT_URL));
 const configured=gate&&checks.every(check=>check.status==="configured");
 const report={mode:args.has("--training")?"training-pilot":"shopify-sync",configured,checks,liveServicesVerified:false};
 if(args.has("--json"))console.log(JSON.stringify(report));
 else{
  console.log("Gooidy setup: "+report.mode);
  for(const check of checks)console.log(check.status.padEnd(12)+" "+check.name);
  console.log(configured?"Configuration checks passed. Live services have not been verified.":"Setup is incomplete. No settings were changed.");
  console.log(args.has("--training")?"Also verify the private model destination, a suitable photo set, a confirmed budget and one training allowance. No training was started.":"Also verify the Shopify app release, webhook subscriptions, Inngest app sync and Grow/Scale access. No store was connected.");
 }
 process.exitCode=configured?0:1;
}
