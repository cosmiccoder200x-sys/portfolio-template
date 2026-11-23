import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const load = async (file) => import("data:text/javascript;base64," + fs.readFileSync(file).toString("base64"));
const enquiry = await load("functions/api/enquiry.js");
const events = await load("functions/api/event.js");
const metrics = await load("functions/api/admin-metrics.js");
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

test("untrusted Turnstile hostname is rejected", async()=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({success:true,hostname:"attacker.example"}),{status:200});
  try{assert.equal((await enquiry.onRequestPost({request:req(valid()),env})).status,403);}
  finally{globalThis.fetch=realFetch;}
});
test("database persistence is sufficient when the email provider fails",async()=>{
  let inserted=false;
  const database={prepare:()=>({bind:()=>({run:async()=>{inserted=true;}})})};
  globalThis.fetch=async url=>String(url).includes("siteverify")
    ? new Response(JSON.stringify({success:true,hostname:"portfolio.example"}),{status:200})
    : new Response(JSON.stringify({error:"email down"}),{status:503});
  try{
    const res=await enquiry.onRequestPost({request:req(valid()),env:{...env,LEADS_DB:database}});
    assert.equal(res.status,202);
    assert.equal(inserted,true);
  }finally{globalThis.fetch=realFetch;}
});
test("admin metrics rejects absent or incorrect token and returns counts only",async()=>{
  const database={prepare:(sql)=>({all:async()=>({results:sql.includes("event_counts")
    ? [{day:"2026-11-22",event:"hire_view",count:5}]
    : [{status:"new",count:2}]})})};
  const get=token=>new Request(origin+"/api/admin-metrics",{headers:token?{"Authorization":"Bearer "+token}:{}});
  assert.equal((await metrics.onRequestGet({request:get("bad"),env:{LEADS_DB:database,ADMIN_METRICS_TOKEN:"super-long-test-token"}})).status,401);
  const good=await metrics.onRequestGet({request:get("super-long-test-token"),env:{LEADS_DB:database,ADMIN_METRICS_TOKEN:"super-long-test-token"}});
  assert.equal(good.status,200);
  const data=await good.json();
  assert.equal(data.events[0].count,5);
  assert.equal(JSON.stringify(data).includes("client@example.com"),false);
});

test("exactly three independently styled demos are linked from the storefront",()=>{
  const store=fs.readFileSync("templates/index.html","utf8");
  const paths=["terminal-starter","editorial-atelier","launchpad-saas"];
  assert.equal((store.match(/class="design-card /g)||[]).length,3);
  assert.equal((store.match(/class="design-actions"/g)||[]).length,3);
  for (const path of paths) {
    assert.ok(store.includes('src="'+path+'/'));
    assert.ok(store.includes('href="'+path+'/'));
    const html=fs.readFileSync("templates/"+path+"/index.html","utf8");
    assert.ok(html.includes('name="viewport"'));
    assert.ok(html.includes('@media'));
    assert.ok(html.includes('<main'));
  }
  assert.ok(store.includes("not paid downloadable template bundles"));
  assert.ok(!store.includes('id="template-checkout"'));
});
test("storefront and hire page have navigable cross-links",()=>{
  const store=fs.readFileSync("templates/index.html","utf8");
  const hire=fs.readFileSync("hire/index.html","utf8");
  assert.ok(store.includes('../hire/?project=template'));
  assert.ok(hire.includes('../templates/'));
  assert.ok(hire.includes('id="hire-form"'));
  assert.ok(hire.includes('id="turnstile"'));
});
test("public config contains only a Turnstile site key and no secrets",()=>{
  const config=fs.readFileSync("monetization.config.js","utf8");
  assert.match(config,/turnstileSiteKey:\s*"0x4/);
  assert.ok(!config.includes("TURNSTILE_SECRET_KEY"));
  assert.ok(!config.includes("RESEND_API_KEY"));
});

test("VELA flagship design ships valid local assets and distinct interactive dashboard modes",()=>{
  const source=fs.readFileSync("templates/launchpad-saas/index.html","utf8");
  const css=fs.readFileSync("templates/launchpad-saas/style.css","utf8");
  const js=fs.readFileSync("templates/launchpad-saas/app.js","utf8");
  const store=fs.readFileSync("templates/index.html","utf8");
  assert.match(source, /VELA — Work in a new dimension/);
  assert.match(store, /VELA — Product OS/);
  assert.ok(source.includes('href="style.css"'));
  assert.ok(source.includes('src="app.js"'));
  assert.ok(source.includes('id="workspace"'));
  assert.ok(source.includes('id="pricing"'));
  assert.equal((source.match(/data-scene=/g)||[]).length, 3);
  assert.equal((source.match(/data-billing=/g)||[]).length, 2);
  assert.match(source, /SAMPLE DATA/);
  assert.match(source, /No payments, accounts, or subscriptions/);
  assert.ok(css.includes("@media(max-width:670px)"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
  let depth=0;
  for(const char of css.replace(/\/\*[\s\S]*?\*\//g,"")){
    if(char==="{")depth++;
    if(char==="}")depth--;
    assert.ok(depth>=0);
  }
  assert.equal(depth,0);
  assert.doesNotThrow(()=>new vm.Script(js,{filename:"templates/launchpad-saas/app.js"}));
});
test("VELA scene tabs update dashboard and billing switch updates sample prices",()=>{
  const source=fs.readFileSync("templates/launchpad-saas/app.js","utf8");
  const nodes=new Map();
  function element(id){
    if(!nodes.has(id)){
      const node={
        id,textContent:"",dataset:{},attributes:{},listeners:{},children:[],
        classList:{toggle(name,enabled){node.attributes["class:"+name]=Boolean(enabled)}},
        setAttribute(name,value){node.attributes[name]=value},
        addEventListener(name,callback){node.listeners[name]=callback},
        replaceChildren(...items){node.children=items;node.textContent=items.map(i=>typeof i==="string"?i:i.textContent||"").join("")}
      };
      nodes.set(id,node);
    }
    return nodes.get(id);
  }
  const sceneNames=["overview","projects","signals"];
  const sceneButtons=sceneNames.map(name=>{
    const node=element("scene-"+name);node.dataset.scene=name;return node;
  });
  const billingButtons=["monthly","yearly"].map(name=>{
    const node=element("billing-"+name);node.dataset.billing=name;return node;
  });
  const prices=[["499","399"],["1299","1039"]].map((values,i)=>{
    const node=element("price-"+i);node.dataset.month=values[0];node.dataset.year=values[1];return node;
  });
  const document={
    getElementById:element,
    querySelector(selector){return selector===".graph"?element("graph"):null},
    querySelectorAll(selector){
      return {"[data-scene]":sceneButtons,"[data-billing]":billingButtons,"[data-month][data-year]":prices}[selector]||[];
    },
    createTextNode(value){return {textContent:value}},
    createElement(tag){return element("new-"+tag+"-"+Math.random())}
  };
  vm.runInNewContext(source,{document,console,Number,String,Object,Array,Math},{timeout:3000});
  sceneButtons[1].listeners.click();
  assert.match(element("dash-title").textContent,/impact/);
  assert.equal(element("metric-1-label").textContent,"Projects in flow");
  assert.equal(element("metric-1-value").textContent,"14");
  assert.equal(sceneButtons[1].attributes["aria-pressed"],"true");
  sceneButtons[2].listeners.click();
  assert.match(element("dash-title").textContent,/on demand/);
  assert.equal(sceneButtons[1].attributes["aria-pressed"],"false");
  billingButtons[1].listeners.click();
  assert.equal(prices[0].textContent,"399");
  assert.equal(prices[1].textContent,"1,039");
  assert.equal(billingButtons[1].attributes["aria-pressed"],"true");
  billingButtons[0].listeners.click();
  assert.equal(prices[0].textContent,"499");
});
