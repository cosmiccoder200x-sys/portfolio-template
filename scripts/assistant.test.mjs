import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleUrl="data:text/javascript;base64,"+
  fs.readFileSync("functions/api/chat.js").toString("base64");
const {onRequestPost}=await import(moduleUrl);
const realFetch=globalThis.fetch;
const profile={name:"Sreerang P",bio:"Student developer working on useful software"};
const asset={fetch:async()=>new Response(JSON.stringify(profile),{status:200})};
const origin="https://example.test";
const makeRequest=(message="Tell me about the developer",webSearch=false,headers={})=>
  new Request(origin+"/api/chat",{method:"POST",headers:{
    "Origin":origin,"Content-Type":"application/json","CF-Connecting-IP":"198.51.100.42",...headers
  },body:JSON.stringify({message,webSearch})});

test("Gemini-only configuration answers through a secure server-side key",async()=>{
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url:String(url),options});
    return new Response(JSON.stringify({candidates:[{content:{
      parts:[{text:"He builds software and AI tools."}]
    }}]}),{status:200});
  };
  try{
    const res=await onRequestPost({request:makeRequest(),env:{ASSETS:asset,GEMINI_API_KEY:"test-gemini-secret"}});
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.provider,"gemini");
    assert.equal(body.searched,false);
    assert.match(body.answer,/builds software/);
    assert.equal(requests.length,1);
    assert.match(requests[0].url,/models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(requests[0].options.headers["x-goog-api-key"],"test-gemini-secret");
    const sent=JSON.parse(requests[0].options.body);
    assert.equal(sent.contents.at(-1).parts[0].text,"Tell me about the developer");
    assert.ok(sent.systemInstruction.parts[0].text.includes("Student developer"));
    assert.equal(JSON.stringify(body).includes("test-gemini-secret"),false);
    assert.equal(sent.tools,undefined);
  }finally{globalThis.fetch=realFetch;}
});

test("Groq is preferred when available",async()=>{
  const calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    return new Response(JSON.stringify({choices:[{message:{content:"A concise Groq answer."}}]}),{status:200});
  };
  try{
    const res=await onRequestPost({request:makeRequest("Short question"),env:{
      ASSETS:asset,GROQ_API_KEY:"test-groq-secret",GEMINI_API_KEY:"test-gemini-secret"
    }});
    assert.equal(res.status,200);
    assert.equal((await res.json()).provider,"groq");
    assert.equal(calls.length,1);
    assert.match(calls[0],/api\.groq\.com/);
  }finally{globalThis.fetch=realFetch;}
});

test("When Groq fails, Gemini takes over without exposing provider errors",async()=>{
  const calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(String(url).includes("groq.com"))return new Response("provider down",{status:503});
    return new Response(JSON.stringify({candidates:[{content:{
      parts:[{text:"hidden chain",thought:true},{text:"Gemini fallback succeeded."}]
    }}]}),{status:200});
  };
  const oldError=console.error;console.error=()=>{};
  try{
    const res=await onRequestPost({request:makeRequest("A fallback question"),env:{
      ASSETS:asset,GROQ_API_KEY:"test-groq-secret",GEMINI_API_KEY:"test-gemini-secret"
    }});
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.provider,"gemini");
    assert.equal(body.answer,"Gemini fallback succeeded.");
    assert.equal(calls.length,2);
  }finally{console.error=oldError;globalThis.fetch=realFetch;}
});

test("Web search uses an explicit opt-in and extracts safe citations",async()=>{
  const sent=[];
  globalThis.fetch=async(url,options)=>{
    sent.push(JSON.parse(options.body));
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Here is the answer."}]},
      groundingMetadata:{groundingChunks:[
        {web:{uri:"https://example.org/learn",title:"Documentation"}},
        {web:{uri:"javascript:alert(1)",title:"Unsafe source"}}
      ]}
    }]}),{status:200});
  };
  try{
    const res=await onRequestPost({request:makeRequest("Recent news",true),env:{
      ASSETS:asset,GEMINI_API_KEY:"test-gemini-secret"
    }});
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.searched,true);
    assert.equal(body.sources.length,1);
    assert.equal(body.sources[0].url,"https://example.org/learn");
    assert.deepEqual(sent[0].tools,[{googleSearch:{}}]);
  }finally{globalThis.fetch=realFetch;}
});

test("Missing keys fail safely without leaking configuration",async()=>{
  const res=await onRequestPost({request:makeRequest("Hello"),env:{ASSETS:asset}});
  assert.equal(res.status,503);
  const body=await res.json();
  assert.match(body.error,/not configured/);
  assert.ok(!JSON.stringify(body).includes("GROQ_API_KEY"));
});

test("Gemini provider errors do not return 200 or reveal secrets",async()=>{
  globalThis.fetch=async()=>new Response("invalid key",{status:403});
  const oldError=console.error;console.error=()=>{};
  try{
    const res=await onRequestPost({request:makeRequest("Security check"),env:{
      ASSETS:asset,GEMINI_API_KEY:"secret-do-not-leak"
    }});
    assert.equal(res.status,503);
    const data=await res.json();
    assert.ok(!JSON.stringify(data).includes("secret-do-not-leak"));
    assert.match(data.error,/temporarily unavailable/);
  }finally{console.error=oldError;globalThis.fetch=realFetch;}
});

test("Cross-origin chat requests are denied before contacting providers",async()=>{
  const res=await onRequestPost({request:makeRequest("Hello",false,{"Origin":"https://not-allowed.example"}),env:{
    ASSETS:asset,GEMINI_API_KEY:"test-gemini-secret"
  }});
  assert.equal(res.status,403);
});
