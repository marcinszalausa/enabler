import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createSecureContext } from "node:tls";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fetchPublicUrl, parsePublicHttpUrl, isPublicAddress, verifyPublicUrl,
  requestPinnedUrl, type PublicFetchDependencies, type PublicResponse } from "../src/lib/public-fetch.ts";

const public4={address:"93.184.216.34",family:4 as const};
const response=(status=200,body:Buffer|string="ok",headers:PublicResponse["headers"]={}):PublicResponse=>({
  status,headers,body:Readable.from([Buffer.isBuffer(body)?body:Buffer.from(body)]),
});
function mocks(
  request:PublicFetchDependencies["request"]=async()=>response(),
  resolve:PublicFetchDependencies["resolve"]=async()=>[public4],
):PublicFetchDependencies{return {request,resolve};}
const fails=(code:string)=>(error:unknown)=>typeof error==="object"&&error!==null&&"code" in error&&error.code===code;

test("private, special-use and metadata IPs are denied",()=>{
  for(const address of ["0.0.0.0","10.0.0.1","100.64.0.1","100.100.100.200","127.0.0.1",
    "169.254.169.254","172.16.0.1","172.31.255.255","192.0.0.9","192.0.2.1",
    "192.88.99.1","192.168.1.1","198.18.0.1","198.19.0.1","198.51.100.1","203.0.113.1",
    "224.0.0.1","240.0.0.1","255.255.255.255","168.63.129.16",
    "::","::1","::ffff:127.0.0.1","::ffff:8.8.8.8","fc00::1","fe80::1","fe80::1%eth0",
    "ff02::1","64:ff9b::7f00:1","2001::1","2001:db8::1","2002:7f00:1::1","3ffe::1","3fff::1"]){
    assert.equal(isPublicAddress(address),false,address);
  }
});
test("ordinary public IPv4 and global unicast IPv6 remain supported",()=>{
  for(const address of ["1.1.1.1","8.8.8.8","93.184.216.34","172.32.0.1","198.20.0.1","2606:4700:4700::1111","2001:4860:4860::8888"]){
    assert.equal(isPublicAddress(address),true,address);
  }
});
test("URL parsing rejects schemes, credentials, internal names and unusual IP representations",()=>{
  for(const url of ["ftp://example.com","file:///etc/passwd","gopher://example.com","https://user:secret@example.com",
    "https://example.com:8443","http://example.com:8080","http://localhost","http://localhost.",
    "http://localhost.example.local","http://shop.internal.","http://router.home.arpa",
    "http://127.0.0.1.","http://0x7f000001.","https://example.com/a"+String.fromCharCode(92)+"b","http://127.1","http://2130706433","http://0x7f000001","http://0177.0.0.1","http://169.254.169.254",
    "http://[::1]","http://[::ffff:127.0.0.1]","https://example.com/\nprivate"]){
    assert.throws(()=>parsePublicHttpUrl(url),PublicFetchError,url);
  }
  assert.equal(parsePublicHttpUrl("example.com/path?q=value#fragment").toString(),"https://example.com/path?q=value");
  assert.equal(parsePublicHttpUrl("https://example.com.:443/path").hostname,"example.com");
  assert.equal(parsePublicHttpUrl("https://[2606:4700:4700::1111]/").protocol,"https:");
});
test("a domain resolving to private infrastructure never reaches the transport",async()=>{
  let calls=0;
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100},mocks(async()=>{calls++;return response();},
    async()=>[{address:"127.0.0.1",family:4}])),fails("address"));
  assert.equal(calls,0);
});
test("mixed DNS answers, wrong families, and missing answers fail closed",async()=>{
  for(const answers of [[public4,{address:"::1",family:6}],[{address:"8.8.8.8",family:6}],[]]){
    await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100},mocks(
      async()=>{throw new Error("must not connect");},async()=>answers)),fails("address"));
  }
});
test("DNS errors are generic and do not leak resolver details",async()=>{
  await assert.rejects(fetchPublicUrl("https://example.com/private?token=secret",{maxBytes:100},mocks(
    async()=>response(),async()=>{throw new Error("internal resolver secret");})),error=>{
      assert.equal((error as Error).message.includes("secret"),false);return fails("dns")(error);
    });
});
test("the resolved public address is passed to transport without a second lookup",async()=>{
  let lookups=0;
  const result=await fetchPublicUrl("https://example.com/path",{maxBytes:100},mocks(async(url,address)=>{
    assert.equal(url.hostname,"example.com");assert.deepEqual(address,public4);return response(200,"hello");
  },async()=>{lookups++;return lookups===1?[public4]:[{address:"127.0.0.1",family:4}];}));
  assert.equal(lookups,1);assert.equal(result.body.toString(),"hello");
});
test("literal public IPs do not require DNS",async()=>{
  await fetchPublicUrl("https://8.8.8.8/",{maxBytes:100},mocks(async(_url,address)=>{
    assert.deepEqual(address,{address:"8.8.8.8",family:4});return response();
  },async()=>{throw new Error("must not resolve");}));
});
test("redirect targets are checked before connecting",async()=>{
  for(const target of ["http://169.254.169.254/","https://user:secret@example.com/","file:///etc/passwd","https://example.com:8443/","http://example.com/plaintext"]){
    let requests=0;
    await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100},mocks(async()=>{
      requests++;return response(302,"",{location:target});
    })),fails("redirect"));
    assert.equal(requests,1);
  }
});
test("redirect DNS is revalidated even when the hostname stays the same",async()=>{
  let requests=0,lookups=0;
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100},mocks(async()=>{
    requests++;return response(302,"",{location:"/next"});
  },async()=>++lookups===1?[public4]:[{address:"10.0.0.1",family:4}])),fails("address"));
  assert.equal(requests,1);assert.equal(lookups,2);
});
test("relative redirects retain the effective final URL; HTTP can upgrade to HTTPS",async()=>{
  let count=0;
  const result=await fetchPublicUrl("http://example.com/start",{maxBytes:100},mocks(async()=>{
    count++;return count===1?response(301,"",{location:"https://example.com/new/base"}):
      count===2?response(302,"",{location:"../product"}):response(200,"page",{"content-type":"text/html; charset=utf-8"});
  }));
  assert.equal(result.url.toString(),"https://example.com/product");assert.equal(result.contentType,"text/html");
});
test("redirect loops stop at the configured hop limit",async()=>{
  let requests=0;
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100,maxRedirects:2},mocks(async()=>{
    requests++;return response(302,"",{location:"/again"});
  })),fails("redirect"));
  assert.equal(requests,3);
});
test("declared and streamed size limits apply before retaining oversized responses",async()=>{
  const declared=response(200,"small",{"content-length":"1000"});
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:10},mocks(async()=>declared)),fails("size"));
  assert.equal(declared.body.destroyed,true);
  for(const headers of [{},{"content-length":"1"}]){
    const streamed={status:200,headers,body:Readable.from([Buffer.alloc(6),Buffer.alloc(6)])};
    await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:10},mocks(async()=>streamed)),fails("size"));
    assert.equal(streamed.body.destroyed,true);
  }
});
test("compressed responses are decoded and decoded-byte limits stop compression bombs",async()=>{
  for(const [encoding,compress] of [["gzip",gzipSync],["deflate",deflateSync],["br",brotliCompressSync]] as const){
    const result=await fetchPublicUrl("https://example.com",{maxBytes:100},mocks(async()=>response(200,compress("hello"),{"content-encoding":encoding})));
    assert.equal(result.body.toString(),"hello");
    await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:1000},mocks(async()=>response(200,compress("a".repeat(100000)),{"content-encoding":encoding}))),fails("size"));
  }
});
test("unsupported encodings are rejected",async()=>{
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100},mocks(async()=>response(200,"data",{"content-encoding":"unknown"}))),fails("encoding"));
});
test("one deadline covers DNS, headers and a stalled response body",async()=>{
  const never=()=>new Promise<never>(()=>{});
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100,timeoutMs:20},mocks(async()=>response(),never)),fails("timeout"));
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100,timeoutMs:20},mocks(never)),fails("timeout"));
  const stream=new Readable({read(){}});
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100,timeoutMs:20},mocks(async()=>({status:200,headers:{},body:stream}))),fails("timeout"));
  assert.equal(stream.destroyed,true);
});
test("redirects share the original deadline",async()=>{
  let requests=0;
  await assert.rejects(fetchPublicUrl("https://example.com",{maxBytes:100,timeoutMs:25},mocks(async()=>{
    await new Promise(r=>setTimeout(r,15));requests++;
    return requests===1?response(302,"",{location:"/next"}):response();
  })),fails("timeout"));
});
test("PUT uploads are bounded and are never replayed to a redirect target",async()=>{
  let requests=0;
  await assert.rejects(fetchPublicUrl("https://example.com/upload",{maxBytes:100,method:"PUT",body:Buffer.from("asset")},mocks(async(_url,_address,_signal,options)=>{
    requests++;assert.equal(options.method,"PUT");assert.equal(Buffer.from(options.body!).toString(),"asset");
    return response(307,"",{location:"https://other.example.com/upload"});
  })),fails("redirect"));
  assert.equal(requests,1);
});
test("URL preflight shares the public DNS policy",async()=>{
  await assert.rejects(verifyPublicUrl("https://example.com",mocks(async()=>response(),async()=>[{address:"192.168.1.1",family:4}])),fails("address"));
});

test("real HTTP transport pins the socket but preserves the original Host and path",{timeout:5000},async()=>{
  let observedHost="",observedPath="";
  const server=createServer((req,res)=>{
    observedHost=req.headers.host??"";observedPath=req.url??"";
    assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);
    res.end("pinned");
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  try{
    const address=server.address();assert.ok(address&&typeof address!=="string");
    // Test the transport layer with a test-only loopback destination. The
    // policy tests above prove fetchPublicUrl never admits this address.
    const result=await requestPinnedUrl(new URL("http://shop.invalid:"+address.port+"/product?q=1"),
      {address:"127.0.0.1",family:4},new AbortController().signal,{method:"GET",accept:"text/plain"});
    const chunks:Buffer[]=[];for await(const chunk of result.body)chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(),"pinned");
    assert.equal(observedHost,"shop.invalid:"+address.port);assert.equal(observedPath,"/product?q=1");
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test("real HTTPS transport keeps SNI and rejects an untrusted certificate",{timeout:10000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),"gooidy-tls-test-"));
  let server:ReturnType<typeof createHttpsServer>|undefined;
  try{
    const keyPath=join(dir,"key.pem"),certPath=join(dir,"cert.pem");
    const generated=spawnSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",keyPath,"-out",certPath,"-days","1","-subj","/CN=shop.invalid","-addext","subjectAltName=DNS:shop.invalid"],{stdio:"ignore"});
    assert.equal(generated.status,0,"Test-only certificate generation failed");
    const key=await readFile(keyPath),cert=await readFile(certPath);
    let sni="";
    server=createHttpsServer({key,cert,SNICallback:(name,callback)=>{sni=name;callback(null,createSecureContext({key,cert}));}},(_req,res)=>res.end("should not trust"));
    server.on("tlsClientError",()=>{});
    await new Promise<void>((resolve,reject)=>{server!.once("error",reject);server!.listen(0,"127.0.0.1",resolve);});
    const address=server.address();assert.ok(address&&typeof address!=="string");
    await assert.rejects(requestPinnedUrl(new URL("https://shop.invalid:"+address.port+"/"),
      {address:"127.0.0.1",family:4},new AbortController().signal,{method:"GET",accept:"*/*"}),/self.signed|certificate/i);
    assert.equal(sni,"shop.invalid");
  }finally{
    if(server?.listening)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    await rm(dir,{recursive:true,force:true});
  }
});
