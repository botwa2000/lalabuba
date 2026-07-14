"use strict";
const register    = require("./register");
const login       = require("./login");
const refresh     = require("./refresh");
const logout      = require("./logout");
const me          = require("./me");
const linkDevice  = require("./link-device");

module.exports = async (req, res, p) => {
  try {
    if (p === "/api/auth/register")     return await register(req, res);
    if (p === "/api/auth/login")        return await login(req, res);
    if (p === "/api/auth/refresh")      return await refresh(req, res);
    if (p === "/api/auth/logout")       return await logout(req, res);
    if (p === "/api/auth/me")           return await me(req, res);
    if (p === "/api/auth/link-device")  return await linkDevice(req, res);
    res.status(404).json({ error: "Not found." });
  } catch (err) {
    console.error("[auth]", req.method, p, err.message);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error." });
  }
};
