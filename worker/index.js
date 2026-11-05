import { onRequestGet, onRequestPost } from "../functions/api/chat.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    // Everything else is served from the existing root-level static site.
    return env.ASSETS.fetch(request);
  }
};
