import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

type Failure = "url" | "address" | "dns" | "redirect" | "size" | "encoding" | "timeout" | "network";
const messages: Record<Failure, string> = {
  url: "Only public HTTP(S) URLs on standard ports are supported.",
  address: "That address is not a public website.",
  dns: "The website could not be resolved to a public address.",
  redirect: "The website returned an unsafe or excessive redirect.",
  size: "The remote response is too large.",
  encoding: "The remote response uses an unsupported encoding.",
  timeout: "The remote download timed out.",
  network: "The remote download failed.",
};
export class PublicFetchError extends Error {
  readonly code: Failure;
  constructor(code: Failure) { super(messages[code]); this.name = "PublicFetchError"; this.code = code; }
}

const denied4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0",8], ["10.0.0.0",8], ["100.64.0.0",10], ["127.0.0.0",8],
  ["169.254.0.0",16], ["172.16.0.0",12], ["192.0.0.0",24], ["192.0.2.0",24],
  ["192.88.99.0",24], ["192.168.0.0",16], ["198.18.0.0",15],
  ["198.51.100.0",24], ["203.0.113.0",24], ["224.0.0.0",4], ["240.0.0.0",4],
] as [string,number][]) denied4.addSubnet(address,prefix,"ipv4");
// Azure's platform virtual IP is not an ordinary public Internet endpoint.
denied4.addAddress("168.63.129.16","ipv4");
const global6 = new BlockList();
global6.addSubnet("2000::",3,"ipv6");
const denied6 = new BlockList();
for (const [address,prefix] of [
  ["2001::",23], ["2001:db8::",32], ["2002::",16], ["3ffe::",16], ["3fff::",20],
] as [string,number][]) denied6.addSubnet(address,prefix,"ipv6");

export function isPublicAddress(address: string): boolean {
  if (address.includes("%")) return false;
  const family = isIP(address);
  if (family === 4) return !denied4.check(address,"ipv4");
  // Excludes loopback, ULA, link-local, multicast, mapped IPv4 and NAT64.
  if (family === 6) return global6.check(address,"ipv6") && !denied6.check(address,"ipv6");
  return false;
}

function hostname(url: URL) { return url.hostname.replace(/^\[|\]$/g,""); }

export function parsePublicHttpUrl(raw: string | URL): URL {
  let url: URL;
  try {
    const value = String(raw).trim();
    if (!value || value.length > 16384 || value.includes("\\") || /[\u0000-\u0020\u007f]/.test(value)) throw new Error();
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : "https://" + value);
  } catch { throw new PublicFetchError("url"); }
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password || url.port) throw new PublicFetchError("url");
  const host = hostname(url).toLowerCase().replace(/\.+$/,"");
  const family = isIP(host);
  if (family) {
    if (!isPublicAddress(host)) throw new PublicFetchError("address");
    if (family === 4) url.hostname = host;
  } else {
    if (!host.includes(".") || host === "localhost"
      || /\.(localhost|local|internal|lan|home|home\.arpa)$/.test(host)
      || !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
      throw new PublicFetchError("address");
    }
    url.hostname = host;
  }
  url.hash = "";
  return url;
}

export type PublicAddress = { address: string; family: 4 | 6 };
export type PublicResponse = {
  status: number;
  headers: Record<string,string | string[] | undefined>;
  body: Readable;
};
export type PublicRequest = { method: "GET" | "PUT"; accept: string; contentType?: string; body?: Uint8Array };
export type PublicFetchDependencies = {
  resolve: (host: string) => Promise<{ address: string; family: number }[]>;
  request: (url: URL, address: PublicAddress, signal: AbortSignal, options: PublicRequest) => Promise<PublicResponse>;
};

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new PublicFetchError("timeout"));
  return new Promise((resolve,reject) => {
    const abort = () => { signal.removeEventListener("abort",abort); reject(new PublicFetchError("timeout")); };
    signal.addEventListener("abort",abort,{once:true});
    promise.then(value => {
      signal.removeEventListener("abort",abort);
      if (signal.aborted) reject(new PublicFetchError("timeout")); else resolve(value);
    }, error => { signal.removeEventListener("abort",abort); reject(error); });
  });
}

async function publicAddress(url: URL, resolve: PublicFetchDependencies["resolve"], signal: AbortSignal): Promise<PublicAddress> {
  const host = hostname(url);
  const literalFamily = isIP(host);
  if (literalFamily === 4 || literalFamily === 6) return {address:host,family:literalFamily};
  let addresses: {address:string;family:number}[];
  try { addresses = await abortable(resolve(host),signal); }
  catch (error) { if (signal.aborted) throw new PublicFetchError("timeout"); throw error instanceof PublicFetchError ? error : new PublicFetchError("dns"); }
  if (!addresses.length || addresses.length > 64 || addresses.some(a =>
    !isPublicAddress(a.address) || isIP(a.address) !== a.family || ![4,6].includes(a.family))) throw new PublicFetchError("address");
  // Prefer IPv4 for deployments without IPv6 egress; never fall back to an
  // unchecked address. All answers must be public, even though we pin one.
  const selected = addresses.find(a=>a.family===4) ?? addresses[0];
  return {address:selected.address,family:selected.family as 4|6};
}

function canonicalAddress(address: string) {
  return isIP(address) === 6 ? new URL("http://["+address+"]/").hostname : address;
}

// Low-level transport. The policy layer above must approve the supplied address.
// Exported so the real socket-pinning behavior can be tested with a local server.
export function requestPinnedUrl(url: URL, address: PublicAddress, signal: AbortSignal, options: PublicRequest): Promise<PublicResponse> {
  return new Promise((resolve,reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(url, {
      method: options.method, agent: false, family: address.family, rejectUnauthorized: true,
      lookup: (_host,_options,callback) => callback(null,address.address,address.family),
      servername: isIP(hostname(url)) ? undefined : hostname(url),
      signal,
      headers: {
        accept: options.accept, "accept-encoding": "gzip, deflate, br",
        "user-agent": "Mozilla/5.0 (compatible; GooidyBot/0.2; +https://gooidy.com)",
        ...(options.body ? {"content-length":String(options.body.byteLength)} : {}),
        ...(options.contentType ? {"content-type":options.contentType} : {}),
      },
    }, response => resolve({status:response.statusCode ?? 0,headers:response.headers,body:response}));
    req.once("socket",socket=>socket.once("connect",()=>{
      if (!socket.remoteAddress || canonicalAddress(socket.remoteAddress) !== canonicalAddress(address.address)) {
        req.destroy(new PublicFetchError("address"));
      }
    }));
    req.on("error",reject);
    req.end(options.body);
  });
}

const dependencies: PublicFetchDependencies = {
  resolve: host => lookup(host,{all:true,verbatim:true}),
  request: requestPinnedUrl,
};

export async function verifyPublicUrl(raw: string | URL, deps: PublicFetchDependencies = dependencies): Promise<URL> {
  const url = parsePublicHttpUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),3000);
  try { await publicAddress(url,deps.resolve,controller.signal); return url; }
  finally { clearTimeout(timer); }
}

function header(response: PublicResponse, name: string): string {
  const value = response.headers[name];
  return Array.isArray(value) ? value.join(",") : value ?? "";
}

async function boundedBody(response: PublicResponse, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const declared = header(response,"content-length");
  if (/^\d+$/.test(declared) && Number(declared)>maxBytes) {
    response.body.destroy(); throw new PublicFetchError("size");
  }
  const encoding = header(response,"content-encoding").trim().toLowerCase();
  const decoder = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate()
    : encoding === "br" ? createBrotliDecompress() : null;
  if (encoding && encoding !== "identity" && !decoder) {
    response.body.destroy(); throw new PublicFetchError("encoding");
  }
  let wireBytes=0, decodedBytes=0;
  const chunks: Buffer[]=[];
  const wireLimit = new Transform({transform(chunk: Buffer,_encoding,callback){
    wireBytes+=chunk.byteLength;
    callback(wireBytes>maxBytes ? new PublicFetchError("size") : null,chunk);
  }});
  const sink = new Writable({write(chunk: Buffer,_encoding,callback){
    decodedBytes+=chunk.byteLength;
    if (decodedBytes>maxBytes) { callback(new PublicFetchError("size")); return; }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); callback();
  }});
  const streams: (Readable|Transform|Writable)[]=[response.body,wireLimit];
  if (decoder) streams.push(decoder);
  streams.push(sink);
  await pipeline(streams,{signal});
  return Buffer.concat(chunks,decodedBytes);
}

export async function fetchPublicUrl(
  raw: string | URL,
  options: {maxBytes:number;timeoutMs?:number;maxRedirects?:number;accept?:string;method?:"GET"|"PUT";body?:Uint8Array;contentType?:string},
  deps: PublicFetchDependencies = dependencies,
): Promise<{url:URL;status:number;contentType:string;body:Buffer}> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes<1 || options.maxBytes>128*1024*1024
    || (options.body && options.body.byteLength>128*1024*1024)) throw new PublicFetchError("size");
  const timeout = options.timeoutMs ?? 15000;
  const redirects = options.maxRedirects ?? 5;
  if (!Number.isFinite(timeout) || timeout<1 || timeout>60000 || !Number.isInteger(redirects) || redirects<0 || redirects>5) throw new PublicFetchError("url");
  let current = parsePublicHttpUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try {
    for (let hop=0;;hop++) {
      const address = await publicAddress(current,deps.resolve,controller.signal);
      const response = await abortable(deps.request(current,address,controller.signal,{
        method:options.method ?? "GET", accept:options.accept ?? "*/*",body:options.body,contentType:options.contentType,
      }),controller.signal);
      if ([301,302,303,307,308].includes(response.status)) {
        response.body.destroy();
        if (hop>=redirects || options.method === "PUT") throw new PublicFetchError("redirect");
        const location = header(response,"location");
        if (!location || location.length>16384) throw new PublicFetchError("redirect");
        let next: URL;
        try { next = parsePublicHttpUrl(new URL(location,current)); }
        catch { throw new PublicFetchError("redirect"); }
        if (current.protocol === "https:" && next.protocol !== "https:") throw new PublicFetchError("redirect");
        current = next;
        continue;
      }
      const body = await boundedBody(response,options.maxBytes,controller.signal);
      return {url:current,status:response.status,contentType:header(response,"content-type").split(";")[0].trim().toLowerCase(),body};
    }
  } catch (error) {
    if (error instanceof PublicFetchError) throw error;
    throw new PublicFetchError(controller.signal.aborted ? "timeout" : "network");
  } finally { clearTimeout(timer); }
}
