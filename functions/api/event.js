// Anonymous aggregate conversion counters. No names, emails, cookies or IPs are saved.
const EVENTS=new Set(["hire_view","hire_cta","template_view","template_preview","template_interest","enquiry_success"]);
const response=(status=204)=>new Response(null,{status,headers:{"Cache-Control":"no-store"}});
export async function onRequestPost({request,env}){
  const origin=request.headers.get("Origin");
  if(origin!==new URL(request.url).origin) return response(403);
  if(!env?.LEADS_DB) return response(); // Event measurement is opt-in via D1.
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type")||"")) return response(415);
  let event;
  try{
    const raw=await request.text();
    if(raw.length>512) return response(413);
    const parsed=JSON.parse(raw);
    event=parsed?.event;
  }catch(_){return response(400);}
  if(!EVENTS.has(event)) return response(400);
  if(env.EVENT_LIMITER){
    try{
      const verdict=await env.EVENT_LIMITER.limit({key:request.headers.get("CF-Connecting-IP")||"anonymous"});
      if(!verdict.success) return response(429);
    }catch(_){return response(503);}
  }
  try{
    await env.LEADS_DB.prepare("INSERT INTO event_counts (day, event, count) VALUES (?, ?, 1) ON CONFLICT(day, event) DO UPDATE SET count=count+1")
      .bind(new Date().toISOString().slice(0,10),event).run();
  }catch(_){return response(503);}
  return response();
}
export function onRequestGet(){return response(405);}
