import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
const version=execFileSync("npm",["view","onnxruntime-web","version"],{encoding:"utf8"}).trim();
if(!/^\d+\\.\d+\\.\d+$/.test(version))throw new Error("Expected stable runtime version");
execFileSync("npm",["install","--save-exact","onnxruntime-web@"+version],{stdio:"inherit"});
const url="https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet/face_detection_yunet_2026may.onnx";
const response=await fetch(url);if(!response.ok)throw new Error("Model download failed");
const model=Buffer.from(await response.arrayBuffer()),sha=createHash("sha256").update(model).digest("hex");
if(sha!=="ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0")throw new Error("Model hash mismatch");
mkdirSync("src/models",{recursive:true});writeFileSync("src/models/yunet.onnx",model);
const ort=await import("onnxruntime-web");ort.env.wasm.numThreads=1;
const session=await ort.InferenceSession.create(model,{executionProviders:["wasm"]});
const start=performance.now();const output=await session.run({[session.inputNames[0]]:new ort.Tensor("float32",new Float32Array(3*640*640),[1,3,640,640])});
console.log("RUNTIME_META",JSON.stringify({version,modelSha:sha,modelBytes:model.length,inputs:session.inputNames,outputs:Object.fromEntries(Object.entries(output).map(([key,value])=>[key,value.dims])),ms:performance.now()-start}));
await session.release();
for(const path of ["package.json","package-lock.json","src/models/yunet.onnx"]){const b=readFileSync(path).toString("base64");for(let i=0;i<b.length;i+=4000)console.log("VENDOR_FILE",path,i/4000,b.slice(i,i+4000));}
