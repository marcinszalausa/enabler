import {NextResponse} from "next/server";
import {completePaidOAuth,paidProvider} from "@/lib/catalog/paid-accounts";
export async function GET(request:Request,context:RouteContext<"/api/catalog/ad-accounts/[provider]/callback">){
 const target=new URL("/dashboard/stores",request.url);
 try{const provider=paidProvider((await context.params).provider),query=new URL(request.url).searchParams;if(query.has("error"))throw new Error("CANCELED");const id=await completePaidOAuth(provider,query.get("state")??"",query.get(provider==="meta"?"code":"auth_code")??"");target.searchParams.set("ad_intent",id);}catch{target.searchParams.set("ad_notice","connection_error");}
 const response=NextResponse.redirect(target,303);response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");return response;
}
