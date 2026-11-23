// Intentionally do not expose the private lead manager as a public web page.
// Saved enquiry records and Telegram notifications continue through /api/enquiry.
// Admin endpoints remain token-protected for future private, access-gated tools.
export function onRequest() {
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
