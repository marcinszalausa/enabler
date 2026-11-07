import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
const endpoint='https://gooidy.com/api/inngest';
let ready=false;
for(let attempt=0;attempt<60;attempt++){
 try{const response=await fetch(endpoint,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});const body=await response.json();if(response.ok&&body.function_count>=15){ready=true;break;}}catch{}
 await pause(10000);
}
assert.ok(ready,'Production did not expose all 15 catalog workers before the deployment deadline');
const response=await fetch(endpoint,{method:'PUT',redirect:'error',signal:AbortSignal.timeout(90000)});
assert.ok(response.ok,'Inngest production registration failed: HTTP '+response.status);
console.log('Production catalog endpoint exposes all workers; Inngest registration succeeded. No training or ad mutations requested.');
