"use strict";

// Multilingual blocklist — terms inappropriate for a children's coloring app.
// Add new languages by appending to the same set.
const BLOCKED_TERMS = new Set([
  // English
  "nude","naked","nudity","blood","bloody","gore","gory","kill","killing",
  "murder","murderer","dead","death","dying","corpse","weapon","weapons",
  "gun","guns","rifle","pistol","knife","knives","bomb","bombs","explosive",
  "sex","sexy","sexual","porn","pornography","erotic","erotica",
  "violence","violent","torture","abuse","drug","drugs","cocaine","heroin",
  "meth","terror","terrorist","suicide","rape","racist","racism","nazi",
  // German
  "nackt","nackten","blut","blutig","töten","tötung","mord","mörder",
  "tot","leiche","waffe","waffen","gewehr","messer","bombe","bomben",
  "sex","sexuell","pornografie","gewalt","folter","missbrauch","droge",
  "drogen","terror","terrorist","selbstmord","vergewaltigung",
  // Russian (Cyrillic)
  "голый","голая","голые","кровь","кровавый","убить","убийство","убийца",
  "мертвый","мёртвый","труп","смерть","оружие","пистолет","нож","бомба",
  "секс","порно","насилие","пытка","наркотик","наркотики","террор",
  "суицид","изнасилование","расизм",
  // French
  "nu","nue","nus","nues","sang","sanglant","tuer","meurtre","meurtrier",
  "mort","cadavre","arme","armes","pistolet","couteau","bombe","bombes",
  "sexe","sexuel","pornographie","violence","torture","abus","drogue",
  "drogues","terreur","terroriste","suicide","viol","racisme",
]);

function sanitizeSubject(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isSafeSubject(subject) {
  const words = subject.toLowerCase().split(/[\s,!?;:'"()\[\]{}\-_/\\@#]+/);
  return !words.some(w => w.length > 0 && BLOCKED_TERMS.has(w));
}

module.exports = { BLOCKED_TERMS, sanitizeSubject, isSafeSubject };
