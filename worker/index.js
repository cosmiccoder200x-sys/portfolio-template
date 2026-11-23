import { onRequestGet, onRequestPost } from "../functions/api/chat.js";
import { onRequestPost as submitEnquiry } from "../functions/api/enquiry.js";
import { onRequestPost as trackEvent } from "../functions/api/event.js";
import { onRequestGet as readMetrics } from "../functions/api/admin-metrics.js";
import { onRequestGet as readLeads, onRequestPatch as changeLeadStatus } from "../functions/api/admin-leads.js";
import { onRequestPost as sendLeadReminder } from "../functions/api/lead-reminder.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // No publicly hosted lead dashboard: preserve data and private API.
    if (url.pathname === "/leads" || url.pathname.startsWith("/leads/")) {
      return new Response("Not found.", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    // Route the existing Pages Function through this standalone Worker.
    if (url.pathname === "/api/chat") {
      if (request.method === "POST") {
        return onRequestPost({ request, env });
      }
      if (request.method === "GET") {
        return onRequestGet({ request, env });
      }
      return new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Allow": "GET, POST"
        }
      });
    }

    if (url.pathname === "/api/admin-metrics") {
      if (request.method !== "GET") return new Response("Method not allowed.", {status:405,headers:{"Allow":"GET"}});
      return readMetrics({request,env});
    }
    if (url.pathname === "/api/lead-reminder") {
      if (request.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed."}),{
        status:405,headers:{"Content-Type":"application/json","Allow":"POST","Cache-Control":"no-store"}
      });
      return sendLeadReminder({request,env});
    }
    if (url.pathname === "/api/admin-leads") {
      if (request.method === "GET") return readLeads({request,env});
      if (request.method === "PATCH") return changeLeadStatus({request,env});
      return new Response(JSON.stringify({error:"Method not allowed."}), {
        status:405,headers:{"Content-Type":"application/json","Allow":"GET, PATCH","Cache-Control":"no-store"}
      });
    }
    if (url.pathname === "/api/enquiry" || url.pathname === "/api/event") {
      if (request.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed."}), {
        status:405,headers:{"Content-Type":"application/json","Allow":"POST","Cache-Control":"no-store"}
      });
      return url.pathname === "/api/enquiry"
        ? submitEnquiry({ request, env })
        : trackEvent({ request, env });
    }

    // Everything else is served from the existing root-level static site.
    return env.ASSETS.fetch(request);
  }
};
