// Protected daily reminder endpoint, for a scheduler (GitHub Actions or Worker Cron).
// It only sends aggregate counts, never client names/emails/briefs.
const answer=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const compare=(a,b)=>{
  const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
  let n=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)n|=(x[i]||0)^(y[i]||0);
  return n===0;
};
export async function onRequestPost({request,env}){
  if(!env?.LEADS_DB || typeof env.LEAD_REMINDER_TOKEN!=="string" || env.LEAD_REMINDER_TOKEN.length<20)
    return answer({error:"Lead reminders are not configured."},503);
  const auth=request.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer ") || !compare(auth.slice(7),env.LEAD_REMINDER_TOKEN))
    return answer({error:"Unauthorized."},401);
  if(!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) && !(env.RESEND_API_KEY && env.LEAD_FROM_EMAIL && env.LEAD_TO_EMAIL))
    return answer({error:"No alert provider configured."},503);

  let result;
  try{
    result=await env.LEADS_DB.prepare("SELECT status, COUNT(*) AS count FROM enquiries WHERE status IN ('new','seen') AND datetime(created_at) <= datetime('now','-24 hours') GROUP BY status").all();
  }catch(_){return answer({error:"Couldn't check pending enquiries."},503);}
  const pending=Object.fromEntries((result.results||[]).map(r=>[r.status,Number(r.count||0)]));
  const newCount=pending.new||0,seenCount=pending.seen||0,total=newCount+seenCount;
  if(total===0)return answer({ok:true,sent:false,pending:0});

  // Avoid duplicate scheduled reminders on the same UTC date after a successful send.
  const day=new Date().toISOString().slice(0,10);
  try{
    const previous=await env.LEADS_DB.prepare("SELECT day FROM lead_reminder_runs WHERE day = ?").bind(day).first();
    if(previous)return answer({ok:true,sent:false,already_sent:true,pending:total});
  }catch(_){return answer({error:"Reminder database migration is missing."},503);}

  const link=new URL("/leads/",request.url).href;
  const subject=`Portfolio: ${total} client ${total===1?"enquiry needs":"enquiries need"} attention`;
  const note=`${subject}\n\nUnread: ${newCount}\nSeen but not replied: ${seenCount}\n\nPrivate inbox: ${link}\n\nYou are receiving this because these enquiries are older than 24 hours.`;
  let sent=false;

  if(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID){
    try{
      const delivery=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:note,disable_web_page_preview:true})
      });
      const receipt=await delivery.json().catch(()=>({}));
      if(delivery.ok && receipt.ok===true)sent=true;
    }catch(_){}
  }
  if(env.RESEND_API_KEY && env.LEAD_FROM_EMAIL && env.LEAD_TO_EMAIL){
    try{
      const delivery=await fetch("https://api.resend.com/emails",{
        method:"POST",headers:{"Authorization":`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({from:env.LEAD_FROM_EMAIL,to:[env.LEAD_TO_EMAIL],subject,text:note})
      });
      if(delivery.ok)sent=true;
    }catch(_){}
  }
  if(!sent)return answer({error:"Reminder delivery failed; try again."},502);

  try{
    await env.LEADS_DB.prepare("INSERT OR IGNORE INTO lead_reminder_runs (day, sent_at) VALUES (?, ?)")
      .bind(day,new Date().toISOString()).run();
  }catch(_){
    // The message was sent even if the deduplication write fails.
    console.error("Reminder delivered but audit insert failed");
  }
  return answer({ok:true,sent:true,pending:total});
}
export function onRequestGet(){return answer({error:"Method not allowed."},405);}
