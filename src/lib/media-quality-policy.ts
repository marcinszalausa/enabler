export class QualityError extends Error {}
export class QualityReviewUnavailableError extends Error {}
// minor: the only issues are small ones a shopper would barely notice.
export type QualityVerdict={ok:boolean;issues:string;minor?:boolean};
export const IMAGE_QUALITY_ATTEMPTS=3;
export const REVIEW_ATTEMPTS=2;
export function qualityIssues(value:string){return value.replace(/\s+/g," ").trim().slice(0,400);}
export async function requireReview(review:()=>Promise<QualityVerdict>):Promise<QualityVerdict>{
 for(let attempt=1;attempt<=REVIEW_ATTEMPTS;attempt++){
  try{
   const verdict=await review();
   if(!verdict||typeof verdict.ok!=="boolean"||typeof verdict.issues!=="string")throw new Error("Invalid quality verdict");
   const issues=qualityIssues(verdict.issues);
   if(verdict.ok&&issues)throw new Error("Contradictory quality verdict");
   return {ok:verdict.ok,issues,minor:!verdict.ok&&verdict.minor===true};
  }catch{
   if(attempt===REVIEW_ATTEMPTS)throw new QualityReviewUnavailableError("Quality review could not be completed. Please try again.");
  }
 }
 throw new QualityReviewUnavailableError("Quality review could not be completed.");
}
export async function reviewedCandidate<T>(deps:{
 generate:(attempt:number,avoid?:string)=>Promise<T>;
 validate:(candidate:T)=>Promise<void>;
 review:(candidate:T)=>Promise<QualityVerdict>;
}):Promise<T>{
 let avoid:string|undefined;let usable:T|undefined;
 for(let attempt=1;attempt<=IMAGE_QUALITY_ATTEMPTS;attempt++){
  const candidate=await deps.generate(attempt,avoid);
  try{await deps.validate(candidate);}catch(error){
   if(!(error instanceof QualityError))throw error;
   avoid=qualityIssues(error.message);continue;
  }
  const verdict=await requireReview(()=>deps.review(candidate));
  if(verdict.ok)return candidate;
  // Keep a candidate with only small flaws, so the owner still gets an ad
  // when no try comes out perfect. Hard defects are never delivered.
  if(verdict.minor)usable??=candidate;
  avoid=verdict.issues||"Visible image defects";
 }
 if(usable!==undefined)return usable;
 throw new QualityError(avoid??"The image did not pass quality review.");
}
export function voiceTempo(spoken:number,total:number,start=.3,maxTempo=1.2){
 const room=total-start-.2;
 if(!Number.isFinite(spoken)||spoken<=0||!Number.isFinite(total)||room<=0)throw new QualityError("The voiceover has no usable duration.");
 if(spoken>room*maxTempo+.01)throw new QualityError("The voiceover is too long to fit naturally without cutting off words.");
 return Math.min(maxTempo,Math.max(1,spoken/room));
}
export function sampleTimes(seconds:number){
 if(!Number.isFinite(seconds)||seconds<=0||seconds>15)throw new QualityError("Unsupported shot duration.");
 return [.05,seconds/2,Math.max(.05,seconds-.15)];
}
