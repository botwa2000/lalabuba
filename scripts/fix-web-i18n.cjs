// Insert the 6 missing keys into every non-English language block of public/js/i18n.js
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'public', 'js', 'i18n.js');

// key -> { lang: translation }
const T = {
  surpriseMeLong: {
    de: '💡 Überrasch mich', ru: '💡 Удиви меня', fr: '💡 Surprends-moi', es: '💡 Sorpréndeme',
    pt: '💡 Surpreenda-me', it: '💡 Sorprendimi', nl: '💡 Verras me', pl: '💡 Zaskocz mnie',
    tr: '💡 Beni şaşırt', zh: '💡 给我惊喜', hi: '💡 मुझे चौंका दो',
  },
  todayWord: {
    de: 'Heute', ru: 'Сегодня', fr: "Aujourd'hui", es: 'Hoy', pt: 'Hoje', it: 'Oggi',
    nl: 'Vandaag', pl: 'Dziś', tr: 'Bugün', zh: '今天', hi: 'आज',
  },
  orPickSomething: {
    de: '— oder wähl etwas Lustiges —', ru: '— или выбери что-нибудь весёлое —',
    fr: "— ou choisis quelque chose d'amusant —", es: '— o elige algo divertido —',
    pt: '— ou escolha algo divertido —', it: '— o scegli qualcosa di divertente —',
    nl: '— of kies iets leuks —', pl: '— albo wybierz coś fajnego —',
    tr: '— ya da eğlenceli bir şey seç —', zh: '— 或者选个好玩的 —', hi: '— या कुछ मज़ेदार चुनो —',
  },
  verifyHuman: {
    de: 'Kurzer Check — tippe das Kästchen an, damit wir wissen, dass du echt bist!',
    ru: 'Быстрая проверка — нажми на квадратик, чтобы подтвердить, что ты человек!',
    fr: 'Petite vérification — coche la case pour montrer que tu es une vraie personne !',
    es: 'Comprobación rápida — toca la casilla para confirmar que eres una persona real.',
    pt: 'Verificação rápida — toque na caixinha para mostrar que você é real!',
    it: 'Controllo veloce — tocca la casella per dimostrare che sei una persona vera!',
    nl: 'Snelle check — tik op het vakje zodat we weten dat je echt bent!',
    pl: 'Szybkie sprawdzenie — kliknij pole, aby potwierdzić, że jesteś człowiekiem!',
    tr: 'Hızlı kontrol — gerçek biri olduğunu göstermek için kutuya dokun!',
    zh: '快速验证 — 点一下方框，证明你是真人！',
    hi: 'झटपट जाँच — डिब्बे पर टैप करो ताकि पता चले कि तुम असली हो!',
  },
  themeToLight: {
    de: 'Zum hellen Modus wechseln', ru: 'Переключить на светлую тему', fr: 'Passer en mode clair',
    es: 'Cambiar a modo claro', pt: 'Mudar para o modo claro', it: 'Passa alla modalità chiara',
    nl: 'Schakel naar lichte modus', pl: 'Przełącz na tryb jasny', tr: 'Açık moda geç',
    zh: '切换到浅色模式', hi: 'लाइट मोड पर जाएँ',
  },
  themeToDark: {
    de: 'Zum dunklen Modus wechseln', ru: 'Переключить на тёмную тему', fr: 'Passer en mode sombre',
    es: 'Cambiar a modo oscuro', pt: 'Mudar para o modo escuro', it: 'Passa alla modalità scura',
    nl: 'Schakel naar donkere modus', pl: 'Przełącz na tryb ciemny', tr: 'Koyu moda geç',
    zh: '切换到深色模式', hi: 'डार्क मोड पर जाएँ',
  },
};

const order = ['surpriseMeLong', 'todayWord', 'orPickSomething', 'verifyHuman', 'themeToLight', 'themeToDark'];
const langs = ['de', 'ru', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'tr', 'zh', 'hi'];

let s = fs.readFileSync(file, 'utf8');
let added = 0;
for (const lang of langs) {
  const re = new RegExp('(\\n  ' + lang + ': \\{\\n)');
  const m = s.match(re);
  if (!m) { console.log('!! block not found:', lang); continue; }
  const lines = order
    .filter(k => T[k][lang] !== undefined)
    .map(k => `    ${k}: ${JSON.stringify(T[k][lang])},`)
    .join('\n');
  s = s.replace(re, m[1] + lines + '\n');
  added += order.length;
}
fs.writeFileSync(file, s);
console.log('Inserted ~' + added + ' key-translations across ' + langs.length + ' languages.');
