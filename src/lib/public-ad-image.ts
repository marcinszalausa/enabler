// Only public creative previews use this path. Exports keep their original URL.
const creativeImage=/^\/api\/creatives\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/image$/i;
export function publicAdPreview(src:string):string{
 if(!src.startsWith("/")||src.startsWith("//"))return src;
 const url=new URL(src,"https://gooidy.com");
 if(!creativeImage.test(url.pathname)||url.searchParams.has("download"))return src;
 return url.pathname+"?layout=face-aware-v2&preview=1";
}
export function publicAdRetry(src:string,attempt:number):string{
 const preview=publicAdPreview(src);
 const suffix="?layout=face-aware-v2&preview=1";
 if(!preview.endsWith(suffix)||!creativeImage.test(preview.slice(0,-suffix.length)))return src;
 return preview+"&retry="+attempt;
}
