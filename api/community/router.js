"use strict";
const configHandler      = require("./config");
const nicknamesHandler   = require("./nicknames");
const profileHandler     = require("./profile");
const artworkHandler     = require("./artwork");
const starHandler        = require("./star");
const reportHandler      = require("./report");
const leaderboardHandler = require("./leaderboard");
const progressHandler    = require("./progress");
const familyHandler      = require("./family");
const reactHandler       = require("./react");
const notificationsHandler = require("./notifications");
const variationsHandler  = require("./variations");
const weeklyThemeHandler = require("./weekly-theme");

const ARTWORK_RE    = /^\/api\/community\/artwork\/(\d+)$/;
const STAR_RE       = /^\/api\/community\/star\/(\d+)$/;
const REPORT_RE     = /^\/api\/community\/report\/(\d+)$/;
const REACT_RE      = /^\/api\/community\/react\/(\d+)$/;
const VARIATIONS_RE = /^\/api\/community\/artwork\/(\d+)\/variations$/;

module.exports = async (req, res, p) => {
  try {
    if (p === "/api/community/config")         return await configHandler(req, res);
    if (p === "/api/community/nicknames")      return await nicknamesHandler(req, res);
    if (p === "/api/community/profile")        return await profileHandler(req, res);
    if (p === "/api/community/gallery")        return await artworkHandler(req, res, null);
    if (p === "/api/community/artwork")        return await artworkHandler(req, res, null);
    if (p === "/api/community/leaderboard")    return await leaderboardHandler(req, res);
    if (p === "/api/community/progress")       return await progressHandler(req, res);
    if (p === "/api/community/family")         return await familyHandler(req, res);
    if (p === "/api/community/notifications")  return await notificationsHandler(req, res);
    if (p === "/api/community/weekly-theme")   return await weeklyThemeHandler(req, res);

    let m;
    // Variations must be checked before the generic artwork ID pattern.
    if ((m = VARIATIONS_RE.exec(p))) return await variationsHandler(req, res, m[1]);
    if ((m = ARTWORK_RE.exec(p)))    return await artworkHandler(req, res, m[1]);
    if ((m = STAR_RE.exec(p)))       return await starHandler(req, res, m[1]);
    if ((m = REPORT_RE.exec(p)))     return await reportHandler(req, res, m[1]);
    if ((m = REACT_RE.exec(p)))      return await reactHandler(req, res, m[1]);

    res.status(404).json({ error: "Not found." });
  } catch (err) {
    console.error("[community]", req.method, p, err.message);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error." });
  }
};
