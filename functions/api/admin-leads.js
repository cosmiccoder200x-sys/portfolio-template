// Server-side private lead inbox. No PII is exposed without the admin token.
// One token gates both /api/admin-metrics and /api/admin-leads.
const STATES = new Set(["new", "seen", "replied", "closed"]);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Vary":"Authorization"}});
function constantTimeEqual(a,b){
  const aBytes=new TextEncoder().encode(a), bBytes=new TextEncoder().encode(b);
  let difference=aBytes.length^bBytes.length;
  for(let i=0;i<Math.max(aBytes.length,bBytes.length);i++) difference|=(aBytes[i]||0)^(bBytes[i]||0);
  return difference===0;
}
function authorized(request,env){
  const secret=env?.ADMIN_METRICS_TOKEN;
  if(typeof secret!=="string"||secret.length<20||!env?.LEADS_DB)return "unconfigured";
  const header=request.headers.get("Authorization")||"";
  return header.startsWith("Bearer ")&&constantTimeEqual(header.slice(7),secret)?"yes":"no";
}
const FIELDS="id, name, email, project_type, budget, details, status, created_at";
export async function onRequestGet({request,env}){
  const access=authorized(request,env);
  if(access==="unconfigured")return json({error:"Private lead inbox is not configured."},503);
  if(access!=="yes")return json({error:"Access denied."},401);
  const search=new URL(request.url).searchParams;
  const filter=search.get("status")||"all";
  if(filter!=="all"&&!STATES.has(filter))return json({error:"Unknown status filter."},400);
  try{
    const query=filter==="all"
      ? env.LEADS_DB.prepare(`SELECT ${FIELDS} FROM enquiries ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'seen' THEN 1 WHEN 'replied' THEN 2 ELSE 3 END ASC, created_at DESC LIMIT 100`)
      : env.LEADS_DB.prepare(`SELECT ${FIELDS} FROM enquiries WHERE status = ? ORDER BY created_at DESC LIMIT 100`).bind(filter);
    const rows=await query.all();
    const counts=await env.LEADS_DB.prepare("SELECT status, COUNT(*) AS count FROM enquiries GROUP BY status").all();
    return json({leads:rows.results||[],counts:counts.results||[],limit:100});
  }catch(_){console.error("Lead inbox query failed");return json({error:"Could not load enquiries."},503);}
}
export async function onRequestPatch({request,env}){
  const access=authorized(request,env);
  if(access==="unconfigured")return json({error:"Private lead inbox is not configured."},503);
  if(access!=="yes")return json({error:"Access denied."},401);
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type")||""))return json({error:"Expected JSON."},415);
  let input;
  try{const raw=await request.text();if(raw.length>600)return json({error:"Request too large."},413);input=JSON.parse(raw);}
  catch(_){return json({error:"Invalid request."},400);}
  if(!input||typeof input!=="object"||Array.isArray(input)||typeof input.id!=="string"||typeof input.status!=="string"||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)||
    !STATES.has(input.status))return json({error:"Invalid lead ID or status."},400);
  try{
    const result=await env.LEADS_DB.prepare("UPDATE enquiries SET status = ? WHERE id = ?").bind(input.status,input.id).run();
    if(!result?.meta?.changes)return json({error:"Enquiry not found."},404);
    return json({ok:true,id:input.id,status:input.status});
  }catch(_){console.error("Lead status change failed");return json({error:"Could not update enquiry."},503);}
}
