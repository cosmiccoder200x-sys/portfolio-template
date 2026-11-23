// Cloudflare Pages Function + standalone Worker handler.
// Requires TURNSTILE_SECRET_KEY and at least one configured delivery path:
// Resend email or D1 LEADS_DB. No secrets belong in the client.
const ALLOWED_TYPES = new Set(["portfolio","business","dashboard","automation","other","template"]);
const ALLOWED_BUDGETS = new Set(["under-5000","5000-10000","10000-20000","20000-plus","discuss"]);
const response = (body,status=200) => new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const clean = (value,max) => typeof value==="string" ? value.trim().slice(0,max+1) : "";

export async function onRequestPost({request,env}) {
  if (!env?.TURNSTILE_SECRET_KEY || !(env.LEADS_DB || (env.RESEND_API_KEY && env.LEAD_TO_EMAIL && env.LEAD_FROM_EMAIL))) {
    return response({error:"Project enquiries are not configured yet. Please use the contact link."},503);
  }
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin !== url.origin) return response({error:"Invalid request origin."},403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) return response({error:"Expected JSON."},415);
  if (Number(request.headers.get("Content-Length") || 0)>10000) return response({error:"Request too large."},413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length>10000) return response({error:"Request too large."},413);
    body=JSON.parse(raw);
  } catch (_) { return response({error:"Invalid JSON."},400); }
  if (!body || typeof body!=="object" || Array.isArray(body)) return response({error:"Invalid input."},400);
  // Honeypot submissions are silently discarded without contacting external services.
  if (body.website) return response({ok:true},202);
  const name=clean(body.name,80), email=clean(body.email,254).toLowerCase();
  const details=clean(body.details,3000), type=clean(body.projectType,30), budget=clean(body.budget,30);
  if (name.length<2 || name.length>80 || !/^[^<>\r\n]+$/.test(name) ||
      email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
      details.length<20 || details.length>3000 ||
      !ALLOWED_TYPES.has(type) || !ALLOWED_BUDGETS.has(budget) ||
      body.consent!==true) return response({error:"Please check your name, email, project details, and privacy consent."},400);
  const elapsed=Date.now()-Number(body.startedAt);
  if (!Number.isFinite(elapsed) || elapsed<3000 || elapsed>7_200_000) return response({error:"Please reload the form and try again."},400);
  if (env.ENQUIRY_LIMITER) {
    try {
      const key=request.headers.get("CF-Connecting-IP") || "anonymous";
      const decision=await env.ENQUIRY_LIMITER.limit({key});
      if (!decision.success) return response({error:"Too many enquiries. Please try again later."},429);
    } catch (_) { return response({error:"Enquiry service temporarily unavailable."},503); }
  }
  const token=clean(body.turnstileToken,2048);
  if (!token) return response({error:"Please complete the security check."},400);
  let verified=false;
  try {
    const form=new FormData();
    form.append("secret",env.TURNSTILE_SECRET_KEY);
    form.append("response",token);
    const ip=request.headers.get("CF-Connecting-IP");
    if(ip) form.append("remoteip",ip);
    const challenge=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});
    const result=await challenge.json();
    verified=challenge.ok && result.success===true && result.hostname===url.hostname;
  } catch (_) { return response({error:"Could not verify the security check. Please retry."},502); }
  if(!verified) return response({error:"Security check failed or expired. Please retry."},403);

  const id=crypto.randomUUID();
  let stored=false, emailed=false;
  if(env.LEADS_DB){
    try{
      await env.LEADS_DB.prepare("INSERT INTO enquiries (id, name, email, project_type, budget, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)")
        .bind(id,name,email,type,budget,details,new Date().toISOString()).run();
      stored=true;
    }catch(_){ console.error("Enquiry database insert failed"); }
  }
  if(env.RESEND_API_KEY && env.LEAD_TO_EMAIL && env.LEAD_FROM_EMAIL){
    try{
      const delivery=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          from:env.LEAD_FROM_EMAIL,
          to:[env.LEAD_TO_EMAIL],
          reply_to:email,
          subject:`New portfolio enquiry: ${type}`,
          text:`Enquiry ID: ${id}\nName: ${name}\nEmail: ${email}\nType: ${type}\nBudget: ${budget}\n\n${details}`
        })
      });
      emailed=delivery.ok;
    }catch(_){}
    if(!emailed) console.error("Enquiry email delivery failed");
  }
  // Optional no-domain push notification. Leads remain private in D1.
  // This includes only the type and budget, not client contact details.
  if (stored && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const alert = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          chat_id:env.TELEGRAM_CHAT_ID,
          text:`New portfolio enquiry!\nProject: ${type}\nBudget: ${budget}\nReview the enquiry privately in Cloudflare D1 (enquiries table).`,
          disable_web_page_preview:true
        })
      });
      if (!alert.ok) console.error("Telegram lead alert rejected");
    } catch (_) { console.error("Telegram lead alert failed"); }
  }
  if (!stored && !emailed) return response({error:"Could not deliver the enquiry. Please email me directly."},502);
  return response({ok:true,message:"Enquiry received. I'll reply by email."},202);
}
export function onRequestGet(){return response({error:"Method not allowed."},405);}
