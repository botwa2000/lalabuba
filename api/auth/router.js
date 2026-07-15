"use strict";
const register    = require("./register");
const login       = require("./login");
const refresh     = require("./refresh");
const logout      = require("./logout");
const me          = require("./me");
const linkDevice  = require("./link-device");
const sendOtp     = require("./send-otp");
const verifyEmail = require("./verify-email");
const resendOtp   = require("./resend-otp");
const children    = require("./children");

module.exports = async (req, res, p) => {
  try {
    if (p === "/api/auth/register")      return await register(req, res);
    if (p === "/api/auth/login")         return await login(req, res);
    if (p === "/api/auth/refresh")       return await refresh(req, res);
    if (p === "/api/auth/logout")        return await logout(req, res);
    if (p === "/api/auth/me")            return await me(req, res);
    if (p === "/api/auth/link-device")   return await linkDevice(req, res);
    if (p === "/api/auth/send-otp")      return await sendOtp(req, res);
    if (p === "/api/auth/verify-email")  return await verifyEmail(req, res);
    if (p === "/api/auth/resend-otp")    return await resendOtp(req, res);
    if (p === "/api/auth/children" || /^\/api\/auth\/children\/\d+$/.test(p))
      return await children(req, res, p);
    res.status(404).json({ error: "Not found." });
  } catch (err) {
    console.error("[auth]", req.method, p, err.message);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error." });
  }
};
