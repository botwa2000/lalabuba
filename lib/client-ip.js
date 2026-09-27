"use strict";
// The ONE place that decides a request's client IP. Every rate limit keys on it.
//
// Trust model: the origin only accepts connections from Cloudflare (nginx
// ssl_verify_client + Cloudflare Authenticated Origin Pulls — see
// deploy/nginx/lalabuba.com.conf). Cloudflare overwrites any client-sent
// CF-Connecting-IP, so that header is the real client address. X-Forwarded-For is
// NOT consulted: it is client-appendable and would let a caller rotate identities.
// The socket address is the fallback for local dev / direct-to-container calls
// (the container port is not reachable from the internet).
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  return (req.socket?.remoteAddress || "unknown").toString().trim();
}

module.exports = { clientIp };
