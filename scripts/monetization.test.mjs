import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const load = async (file) => import("data:text/javascript;base64," + fs.readFileSync(file).toString("base64"));
const enquiry = await load("functions/api/enquiry.js");
const events = await load("functions/api/event.js");
const origin = "https://portfolio.example";
const valid = () => ({
  name:"Sample Client",email:"client@example.com",projectType:"portfolio",budget:"5000-10000",
  details:"I need a responsive website for my projects and skills.",
  consent:true,website:"",startedAt:Date.now()-5000,turnstileToken:"valid-token"
});
const req=(data,headers={})=>new Request(origin+"/api/enquiry",{
  method:"POST",headers:{"Origin":origin,"Content-Type":"application/json",...headers},body:JSON.stringify(data)
});
const env={TURNSTILE_SECRET_KEY:"test-secret",RESEND_API_KEY:"test-key",LEAD_TO_EMAIL:"owner@example.com",LEAD_FROM_EMAIL:"site@example.com"};
const realFetch=globalThis.fetch;
test("backend refuses to fake submissions when unconfigured", async()=>{
  const res=await enquiry.onRequestPost({request:req(valid()),env:{}});
  assert.equal(res.status,503);
});
test("same-origin and content-type enforced",async()=>{
  assert.equal((await enquiry.onRequestPost({request:req(valid(),{"Origin":"https://evil.example"}),env})).status,403);
  assert.equal((await enquiry.onRequestPost({request:req(valid(),{"Content-Type":"text/plain"}),env})).status,415);
});
test("server validates fields and consent",async()=>{
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),email:"not-an-email"}),env})).status,400);
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),consent:false}),env})).status,400);
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),details:"Hi"}),env})).status,400);
});
test("honeypot and minimum completion time reject automation",async()=>{
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),website:"bot"}),env})).status,202);
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),startedAt:Date.now()}),env})).status,400);
});
test("missing challenge token does not deliver lead",async()=>{
  assert.equal((await enquiry.onRequestPost({request:req({...valid(),turnstileToken:""}),env})).status,400);
});
test("Turnstile verification is mandatory",async()=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({success:false}),{status:200});
  try{assert.equal((await enquiry.onRequestPost({request:req(valid()),env})).status,403);}
  finally{globalThis.fetch=realFetch;}
});
test("successful verification delivers sanitized text email",async()=>{
  const calls=[];
  globalThis.fetch=async (url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).includes("siteverify")) return new Response(JSON.stringify({success:true,hostname:"portfolio.example"}),{status:200});
    return new Response(JSON.stringify({id:"email-1"}),{status:200});
  };
  try{
    const res=await enquiry.onRequestPost({request:req(valid()),env});
    assert.equal(res.status,202);
    assert.equal((await res.json()).ok,true);
    assert.equal(calls.length,2);
    const body=JSON.parse(calls[1].options.body);
    assert.equal(body.reply_to,"client@example.com");
    assert.ok(body.text.includes("responsive website"));
    assert.equal(body.html,undefined);
  }finally{globalThis.fetch=realFetch;}
});
test("delivery errors are reported, not silently acknowledged",async()=>{
  globalThis.fetch=async(url)=>String(url).includes("siteverify")
    ? new Response(JSON.stringify({success:true,hostname:"portfolio.example"}),{status:200})
    : new Response(JSON.stringify({error:"bad sender"}),{status:422});
  try{assert.equal((await enquiry.onRequestPost({request:req(valid()),env})).status,502);}
  finally{globalThis.fetch=realFetch;}
});
test("configured rate limiter returns 429",async()=>{
  const limiter={limit:async()=>({success:false})};
  assert.equal((await enquiry.onRequestPost({request:req(valid()),env:{...env,ENQUIRY_LIMITER:limiter}})).status,429);
});
test("anonymous aggregate events are whitelisted",async()=>{
  const calls=[];
  const database={prepare:(sql)=>({bind:(...values)=>({run:async()=>{calls.push({sql,values});}})})};
  const makeEvent=(e,originHeader=origin)=>new Request(origin+"/api/event",{method:"POST",
    headers:{"Origin":originHeader,"Content-Type":"application/json"},body:JSON.stringify({event:e})});
  assert.equal((await events.onRequestPost({request:makeEvent("hire_view"),env:{LEADS_DB:database}})).status,204);
  assert.deepEqual(calls[0].values.slice(1),["hire_view"]);
  assert.equal((await events.onRequestPost({request:makeEvent("email_dump"),env:{LEADS_DB:database}})).status,400);
  assert.equal((await events.onRequestPost({request:makeEvent("hire_view","https://evil.example"),env:{LEADS_DB:database}})).status,403);
});
