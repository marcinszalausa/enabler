"use server";
import {createClient} from "@/lib/supabase/server";
import {canEditWorkspace,WORKSPACE_WRITE_DENIED} from "@/lib/workspace-access";
import {planTools,type PlannedPost} from "@/lib/plan-value";
import {nextSlots,parseSlots,isTimeZone,toLocal,fromLocal} from "@/lib/social/schedule";
export type WeekPlanState={error:string|null;posts:PlannedPost[];timeZone:string;createdAt:string};
export async function buildWeekPlan(_previous:WeekPlanState,form:FormData):Promise<WeekPlanState>{
 const fail=(error:string):WeekPlanState=>({error,posts:[],timeZone:"",createdAt:""});
 const ids=form.getAll("creativeIds").map(String).filter(Boolean);
 if(ids.length<1||ids.length>7||new Set(ids).size!==ids.length||ids.some(id=>!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)))return fail("Choose between 1 and 7 different ads.");
 const db=await createClient();const {data:auth}=await db.auth.getUser();if(!auth.user)return fail("Sign in again before planning posts.");
 const {data:ws,error:wsError}=await db.from("workspaces").select("id,plan").order("created_at").limit(1).single();
 if(wsError||!ws)return fail("Your workspace could not be loaded.");
 if(!planTools(ws.plan).weekPlanner)return fail("The weekly planner is included with Starter and Growth. Your existing publishing tools are still available.");
 if(!(await canEditWorkspace(db,ws.id)))return fail(WORKSPACE_WRITE_DENIED);
 const [{data:ads,error:adError},{data:schedule,error:scheduleError},{data:upcoming,error:postError}]=await Promise.all([
  db.from("creatives").select("id,headline,primary_text,generations!inner(product_id,status)").eq("workspace_id",ws.id).in("id",ids),
  db.from("publishing_schedules").select("time_zone,slots").eq("workspace_id",ws.id).maybeSingle(),
  db.from("posts").select("scheduled_for").eq("workspace_id",ws.id).eq("status","scheduled").gt("scheduled_for",new Date().toISOString()).limit(1000),
 ]);
 if(adError||scheduleError||postError)return fail("We couldn’t load your ads and posting routine. Try again.");
 if(!ads||ads.length!==ids.length)return fail("Choose only ads saved in your workspace.");
 if(!schedule||!isTimeZone(schedule.time_zone)||!parseSlots(schedule.slots).length)return fail("Save your time zone and posting times in Publishing first.");
 if((upcoming?.length??0)>=1000)return fail("Your queue is too large to preview safely. Review scheduled posts first.");
 const now=new Date(),zone=schedule.time_zone as string,taken=new Set<string>((upcoming??[]).map(p=>toLocal(new Date(p.scheduled_for),zone)));
 const slots=nextSlots(parseSlots(schedule.slots),zone,taken,ids.length,now);
 if(slots.length!==ids.length)return fail("No free posting times could be found. Review your posting routine.");
 const posts:PlannedPost[]=[];
 for(const [i,id]of ids.entries()){
  const ad=ads.find(a=>a.id===id)!;const run=ad.generations as unknown as {product_id:string;status:string};
  if(run.status!=="succeeded")return fail("Wait for the selected ads to finish before planning them.");
  if(toLocal(fromLocal(slots[i],zone),zone)!==slots[i])return fail("A posting time falls in a daylight-saving clock change. Adjust that time in Publishing first.");
  posts.push({id,headline:ad.headline??"Your product ad",caption:ad.primary_text??"",productId:run.product_id,at:fromLocal(slots[i],zone).toISOString()});
 }
 // This is a preview and calendar reminder only. No posts, credits or provider calls.
 return {error:null,posts,timeZone:zone,createdAt:now.toISOString()};
}
