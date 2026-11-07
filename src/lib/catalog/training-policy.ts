export function trainingSetup(env:Record<string,string|undefined>=process.env){
 const required=["REPLICATE_API_TOKEN","REPLICATE_TRAINER_VERSION","REPLICATE_TRAINING_DESTINATION"];
 const configured=required.every(k=>!!env[k]?.trim())&&/^[a-f0-9]{64}$/.test(env.REPLICATE_TRAINER_VERSION??"")&&/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(env.REPLICATE_TRAINING_DESTINATION??"");
 // A cancellation watchdog is not a provider-enforced dollar limit. Operators
 // must establish an actual capped provider arrangement before enabling spend.
 return {configured,spendingEnabled:configured&&env.CATALOG_TRAINING_ENABLED==="true"&&env.CATALOG_PROVIDER_HARD_CAP_CONFIRMED==="true"};
}
export function selectedPhotoKeys(value:unknown){
 if(!Array.isArray(value)||value.length<10||value.length>20||value.some(v=>typeof v!=="string"||!/^store:\d{1,2}$|^upload:[a-f0-9-]{36}$/.test(v))||new Set(value).size!==value.length)throw new Error("PHOTO_SELECTION_INVALID");return value as string[];
}
export const MODEL_REVIEW_SCENES=[
 "A clear studio product photograph on an uncluttered warm white background, showing the complete product.",
 "A premium lifestyle advertising photograph of the product in a bright natural daylight setting, showing the complete product.",
 "A close-up product photograph emphasizing the true material, construction and distinctive details."
] as const;
