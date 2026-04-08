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
  // Spanish
  "desnudo","desnuda","desnudos","desnudas","sangre","sangriento","matar",
  "asesinato","asesino","muerto","muerta","cadaver","muerte","morir",
  "arma","armas","fusil","pistola","cuchillo","bomba","bombas","explosivo",
  "sexo","sexual","pornografia","porno","erotico","violencia","tortura",
  "abuso","droga","drogas","cocaina","heroina","metanfetamina","terror",
  "terrorista","suicidio","violacion","racismo","racista","nazi",
  // Italian
  "nudo","nuda","nudi","nude","sangue","sanguinoso","uccidere","omicidio",
  "assassino","morto","morta","cadavere","morte","morire","arma","armi",
  "fucile","pistola","coltello","bomba","bombe","esplosivo","sesso",
  "sessuale","pornografia","porno","erotico","violenza","tortura","abuso",
  "droga","droghe","cocaina","eroina","terrore","terrorista","suicidio",
  "stupro","razzismo","razzista","nazista",
  // Portuguese
  "nu","nua","nus","nuas","sangue","sangrento","matar","assassinato",
  "assassino","morto","morta","cadaver","morte","morrer","arma","armas",
  "espingarda","pistola","faca","bomba","bombas","explosivo","sexo",
  "sexual","pornografia","porno","erotico","violencia","tortura","abuso",
  "droga","drogas","cocaina","heroina","metanfetamina","terror","terrorista",
  "suicidio","estupro","racismo","racista","nazista",
  // Dutch
  "naakt","naakte","bloed","bloederig","doden","moord","moordenaar",
  "dood","lijk","doodgaan","sterven","wapen","wapens","geweer","pistool",
  "mes","bom","bommen","explosief","seks","seksueel","pornografie","porno",
  "erotisch","geweld","foltering","misbruik","drugs","drug","cocaine",
  "heroïne","heroïne","terreur","terrorist","zelfmoord","verkrachting",
  "racisme","racist","nazi",
  // Polish
  "nagi","naga","nadzy","nagie","krew","krwawy","zabic","zabic","morderstwo",
  "morderca","martwy","martwa","trup","smierc","umrzec","bron","bronie",
  "karabin","pistolet","noz","bomba","bomby","material","seks","seksualny",
  "pornografia","porno","erotyczny","przemoc","tortury","naduzycie","narkotyk",
  "narkotyki","kokaina","heroina","terror","terrorysta","samobojstwo",
  "gwalt","rasizm","rasista","nazista",
  // Turkish
  "ciplak","kan","kanli","oldur","cinayet","katil","olu","ceset","olum",
  "silah","silahlar","tufek","tabanca","bicak","bomba","bombalar","patlayici",
  "seks","cinsel","pornografi","porno","erotik","siddet","iskence","istismar",
  "uyusturucu","kokain","eroin","metanfetamin","teror","terorist","intihar",
  "tecavuz","irkcilik","irkci","nazi",
  // Chinese Simplified
  "裸体","裸露","血","血腥","杀","杀死","谋杀","杀人犯","死亡","尸体",
  "武器","枪","步枪","手枪","刀","炸弹","爆炸物","色情","性","暴力",
  "折磨","虐待","毒品","可卡因","海洛因","恐怖","恐怖分子","自杀",
  "强奸","种族主义","纳粹",
  // Hindi (Devanagari)
  "नग्न","खून","खूनी","हत्या","हत्यारा","मृत","लाश","मृत्यु","हथियार",
  "बंदूक","चाकू","बम","विस्फोटक","सेक्स","अश्लील","पोर्न","हिंसा",
  "यातना","दुर्व्यवहार","नशा","ड्रग्स","आतंक","आतंकवादी","आत्महत्या",
  "बलात्कार","नस्लवाद","नाजी",
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
