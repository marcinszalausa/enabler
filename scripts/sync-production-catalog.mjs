import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
let endpoint='https://gooidy.com/api/inngest';
async function request(method='GET'){
 for(let redirects=0;redirects<4;redirects++){
  const response=await fetch(endpoint,{method,cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)});
  if([301,302,307,308].includes(response.status)){
   const next=new URL(response.headers.get('location'),endpoint);
   assert.ok(next.protocol==='https:'&&['gooidy.com','www.gooidy.com'].includes(next.hostname)&&next.pathname==='/api/inngest','Unexpected registration redirect');
   endpoint=next.href;continue;
  }
  return response;
 }
 throw new Error('Too many registration redirects');
}
let ready=false;
for(let attempt=0;attempt<30;attempt++){
 try{
  const response=await request(),body=await response.json();
  console.log('Worker readiness',JSON.stringify({http:response.status,count:body.function_count,mode:body.mode,code:body.code,settings:body.missing_or_invalid_settings}));
  if(response.ok&&body.function_count>=15){ready=true;break;}
 }catch(error){console.log('Worker readiness request failed',error.name);}
 await pause(10000);
}
assert.ok(ready,'Production did not expose all 15 catalog workers before the deployment deadline');
const response=await request('PUT');
console.log('Registration HTTP status',response.status);
assert.ok(response.ok,'Inngest production registration failed: HTTP '+response.status);
console.log('Production catalog endpoint exposes all workers; Inngest registration succeeded. No training or ad mutations requested.');
