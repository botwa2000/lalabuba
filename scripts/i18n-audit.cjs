const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

console.log('=================  FLUTTER (assets/i18n/*.json)  =================');
const fdir = path.join(root, 'flutter_app/assets/i18n');
const fen = readJson(path.join(fdir, "en.json"));
const fenKeys = Object.keys(fen);
for (const f of fs.readdirSync(fdir).filter(f => f.endsWith('.json') && f !== 'en.json').sort()) {
  const o = readJson(path.join(fdir, f));
  const missing = fenKeys.filter(k => !(k in o));
  // values identical to English (likely untranslated)
  const sameAsEn = fenKeys.filter(k => (k in o) && typeof o[k] === 'string' && o[k] === fen[k] && /[a-zA-Z]/.test(o[k]));
  console.log(`\n[${f}] missing ${missing.length}: ${missing.join(', ') || '—'}`);
  if (sameAsEn.length) console.log(`   identical-to-EN (${sameAsEn.length}): ${sameAsEn.map(k=>k+'="'+fen[k]+'"').join(' | ')}`);
}

console.log('\n=================  WEB (public/js/i18n.js)  =================');
let s = fs.readFileSync(path.join(root, 'public/js/i18n.js'), 'utf8');
const start = s.indexOf('const TRANSLATIONS');
const objStart = s.indexOf('{', start);
let depth = 0, end = -1;
for (let i = objStart; i < s.length; i++) {
  if (s[i] === '{') depth++;
  else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const T = eval('(' + s.slice(objStart, end + 1) + ')');
const wenKeys = Object.keys(T.en);
for (const lang of Object.keys(T).filter(l => l !== 'en')) {
  const missing = wenKeys.filter(k => !(k in T[lang]));
  const sameAsEn = wenKeys.filter(k => (k in T[lang]) && typeof T[lang][k] === 'string' && T[lang][k] === T.en[k] && /[a-zA-Z]/.test(T.en[k]));
  console.log(`\n[${lang}] missing ${missing.length}: ${missing.join(', ') || '—'}`);
  if (sameAsEn.length) console.log(`   identical-to-EN (${sameAsEn.length}): ${sameAsEn.join(', ')}`);
}
