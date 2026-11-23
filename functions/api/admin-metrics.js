// Authenticated metrics summary only. Does not return names, emails or enquiry text.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function equalConstantTime(a,b){
  const left=new TextEncoder().encode(a),right=new TextEncoder().encode(b);
  let different=left.length^right.length;
  for(let i=0;i<Math.max(left.length,right.length);i++) different|=(left[i]||0)^(right[i]||0);
  return different===0;
}
export async function onRequestGet({request,env}){
  if(!env?.ADMIN_METRICS_TOKEN || !env.LEADS_DB) return json({error:"Metrics dashboard is not configured."},503);
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer ") ||
     !equalConstantTime(authorization.slice(7),env.ADMIN_METRICS_TOKEN)) return json({error:"Unauthorized."},401);
  try{
    const counts=await env.LEADS_DB.prepare("SELECT day, event, count FROM event_counts WHERE day >= date('now','-30 days') ORDER BY day DESC, event").all();
    const leads=await env.LEADS_DB.prepare("SELECT status, COUNT(*) AS count FROM enquiries GROUP BY status").all();
    return json({events:counts.results||[],enquiries:leads.results||[],note:"Counts represent recorded events, not unique people."});
  }catch(_){return json({error:"Could not load metrics."},503);}
}
export function onRequestPost(){return json({error:"Method not allowed."},405);}
