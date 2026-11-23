// Client enquiry inbox. Authentication token is never persisted; text is never rendered as HTML.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const login = $("inbox-login"),loginArea=$("login-area"),area=$("inbox-area");
  const loginStatus=$("login-status"),status=$("inbox-status"),list=$("lead-list");
  let token="",leads=[],counts=[],filter="all",search="";
  const states=["new","seen","replied","closed"];
  const displayDate=(date)=>{
    const time=new Date(date);
    return Number.isNaN(time.getTime())?"Unknown time":time.toLocaleString("en-IN",{
      dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"
    })+" IST";
  };
  const overdue=lead=>["new","seen"].includes(lead.status)&&
    Date.now()-new Date(lead.created_at).getTime()>24*60*60*1000;
  const el=(tag,cls,content)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(content!==undefined)node.textContent=String(content);
    return node;
  };
  const setStatus=(message,error=false)=>{
    status.textContent=message;
    status.className="status"+(error?" error":"");
  };
  function lock(error=""){
    token="";leads=[];counts=[];
    area.hidden=true;loginArea.hidden=false;
    $("inbox-token").value="";
    loginStatus.textContent=error;loginStatus.className="status"+(error?" error":"");
    list.replaceChildren();
  }
  async function load(){
    if(!token)return;
    setStatus("Refreshing enquiries...");
    const response=await fetch("/api/admin-leads",{method:"GET",headers:{
      Authorization:"Bearer "+token
    },cache:"no-store",credentials:"same-origin"});
    if(response.status===401)throw Error("Invalid access token. Unlock your inbox again.");
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"Could not load your enquiries.");
    leads=Array.isArray(data.leads)?data.leads.filter(l=>l&&typeof l.id==="string"): [];
    counts=Array.isArray(data.counts)?data.counts:[];
    render();
    setStatus("Updated "+displayDate(new Date().toISOString()));
  }
  function render(){
    const count=key=>counts.filter(item=>item.status===key).reduce((n,item)=>n+Number(item.count||0),0);
    $("count-new").textContent=String(count("new"));
    $("count-seen").textContent=String(count("seen"));
    $("count-replied").textContent=String(count("replied"));
    $("count-overdue").textContent=String(leads.filter(overdue).length);

    document.querySelectorAll("[data-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.filter===filter)));
    const shown=leads.filter(lead=>(filter==="all"||lead.status===filter)&&
      [lead.name,lead.email,lead.project_type,lead.details].join(" ").toLowerCase().includes(search));
    $("inbox-total").textContent=shown.length+" shown / "+leads.length+" recent leads. Up to 100 records.";
    list.replaceChildren();
    if(!shown.length){
      list.append(el("div","inbox-empty","No enquiries match your current filter."));
      return;
    }
    for(const lead of shown){
      const card=el("article","lead-card"+(overdue(lead)?" is-overdue":""));
      const top=el("div","lead-card-top");
      const titleWrap=el("div");
      const title=el("h3",null,lead.name||"Unknown client");
      const meta=el("div","lead-meta",displayDate(lead.created_at)+" • "+String(lead.project_type||"project").replaceAll("_"," ")+" • "+String(lead.budget||"budget not specified"));
      const email=el("a","lead-email",lead.email||"");
      email.href="mailto:"+encodeURIComponent(lead.email||"");
      titleWrap.append(title,meta,email);
      const tags=el("div","lead-tags");
      tags.append(el("span","lead-tag status-"+lead.status,states.includes(lead.status)?lead.status:"unknown"));
      if(overdue(lead))tags.append(el("span","lead-tag overdue","Reply overdue"));
      top.append(titleWrap,tags);
      const details=el("p","lead-summary",lead.details||"(No details supplied)");
      const actions=el("div","lead-card-actions");
      const reply=el("a","btn primary","Reply by email ↗");
      const subject="Re: your "+String(lead.project_type||"web development")+" enquiry";
      reply.href="mailto:"+encodeURIComponent(lead.email||"")+"?subject="+encodeURIComponent(subject);
      reply.setAttribute("aria-label","Compose reply to "+(lead.name||"client"));
      const label=el("label","inbox-help","Status: ");
      const select=el("select");
      select.setAttribute("aria-label","Update status for "+(lead.name||"client"));
      for(const state of states){
        const option=el("option",null,state.charAt(0).toUpperCase()+state.slice(1));
        option.value=state;select.append(option);
      }
      select.value=lead.status;
      select.addEventListener("change",async()=>{
        const previous=lead.status;const next=select.value;
        select.disabled=true;setStatus("Updating status...");
        try{
          const response=await fetch("/api/admin-leads",{method:"PATCH",headers:{
            "Content-Type":"application/json",Authorization:"Bearer "+token
          },body:JSON.stringify({id:lead.id,status:next}),credentials:"same-origin"});
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.ok)throw Error(data.error||"Could not change status.");
          lead.status=next;
          const old=counts.find(c=>c.status===previous);
          if(old)old.count=Number(old.count)-1;
          const current=counts.find(c=>c.status===next);
          if(current)current.count=Number(current.count)+1;
          else counts.push({status:next,count:1});
          render();
          setStatus("Saved status: "+next);
        }catch(error){
          select.value=previous;setStatus(error.message||"Update failed",true);
          if(error.message?.includes("Access denied"))lock(error.message);
        }finally{select.disabled=false;}
      });
      label.append(select);
      actions.append(reply,label);
      card.append(top,details,actions);list.append(card);
    }
  }
  login.addEventListener("submit",async event=>{
    event.preventDefault();
    const value=$("inbox-token").value;
    $("inbox-token").value="";
    token=value;
    loginStatus.textContent="Checking secure access...";
    try{
      await load();
      loginArea.hidden=true;area.hidden=false;
      loginStatus.textContent="";
    }catch(error){lock(error.message||"Could not unlock inbox.");}
  });
  $("refresh-leads").addEventListener("click",async()=>{
    try{await load();}catch(error){setStatus(error.message||"Refresh failed",true);}
  });
  $("logout-leads").addEventListener("click",()=>lock());
  $("lead-search").addEventListener("input",event=>{
    search=String(event.target.value||"").trim().toLowerCase();render();
  });
  document.querySelectorAll("[data-filter]").forEach(button=>button.addEventListener("click",()=>{
    filter=button.dataset.filter;render();
  }));
})();
