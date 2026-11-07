import {NextResponse} from "next/server";
import {catalogBody} from "@/lib/catalog/security";
import {beginPaidConnection,paidProvider} from "@/lib/catalog/paid-accounts";
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return new Response(null,{status:403});
 try{const form=await new Response(await catalogBody(request,4096),{headers:{"Content-Type":request.headers.get("content-type")??""}}).formData();if(form.get("stockConsent")!=="on")return new Response(null,{status:400});const url=await beginPaidConnection(String(form.get("workspaceId")),paidProvider(form.get("provider")));return NextResponse.redirect(url,303);}catch{return NextResponse.redirect(new URL("/dashboard/stores?ad_notice=unavailable",request.url),303);}
}
