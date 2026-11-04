import {pageMetadata} from "@/lib/seo";
// These new guides are written in English. Localized chrome can still be used,
// but do not advertise untranslated copies as separate language editions.
export function informationMetadata(path:string,title:string,description:string){
 return {...pageMetadata("en",path,title,description),alternates:{canonical:path,languages:{en:path,"x-default":path}}};
}
