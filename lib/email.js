"use strict";
// Brevo (formerly Sendinblue) transactional email — Lalabuba OTP + password reset.
// Requires BREVO_API_KEY set as a Swarm secret (same account as taxalex).

const https = require("https");

const FROM_NAME  = "Lalabuba";
const FROM_EMAIL = "no-reply@lalabuba.com";

const OTP_SUBJECT = {
  en: "Your Lalabuba code",
  de: "Dein Lalabuba-Code",
  fr: "Votre code Lalabuba",
  es: "Tu código de Lalabuba",
  pt: "Seu código Lalabuba",
  ru: "Ваш код Lalabuba",
  it: "Il tuo codice Lalabuba",
  nl: "Jouw Lalabuba-code",
  pl: "Twój kod Lalabuba",
  tr: "Lalabuba kodunuz",
  zh: "你的 Lalabuba 验证码",
  hi: "आपका Lalabuba कोड",
};

const OTP_INTRO = {
  en: "Your verification code is:",
  de: "Dein Bestätigungscode lautet:",
  fr: "Votre code de vérification est :",
  es: "Tu código de verificación es:",
  pt: "Seu código de verificação é:",
  ru: "Ваш код подтверждения:",
  it: "Il tuo codice di verifica è:",
  nl: "Jouw verificatiecode is:",
  pl: "Twój kod weryfikacyjny to:",
  tr: "Doğrulama kodunuz:",
  zh: "您的验证码是：",
  hi: "आपका सत्यापन कोड है:",
};

const OTP_EXPIRES = {
  en: "This code expires in 10 minutes. Don't share it with anyone.",
  de: "Der Code ist 10 Minuten gültig. Teile ihn mit niemandem.",
  fr: "Ce code expire dans 10 minutes. Ne le partagez pas.",
  es: "Este código caduca en 10 minutos. No lo compartas.",
  pt: "Este código expira em 10 minutos. Não o compartilhe.",
  ru: "Код действителен 10 минут. Никому не сообщайте его.",
  it: "Questo codice scade in 10 minuti. Non condividerlo.",
  nl: "Deze code verloopt over 10 minuten. Deel hem met niemand.",
  pl: "Ten kod wygasa za 10 minut. Nie udostępniaj go.",
  tr: "Bu kod 10 dakika içinde sona erer. Kimseyle paylaşmayın.",
  zh: "此验证码在 10 分钟后过期。请勿与任何人分享。",
  hi: "यह कोड 10 मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।",
};

async function sendOtp(email, code, lang = "en") {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[email] BREVO_API_KEY not set — OTP not sent. code:", code);
    return { ok: true, skipped: true };
  }

  const subject = OTP_SUBJECT[lang] || OTP_SUBJECT.en;
  const intro   = OTP_INTRO[lang]   || OTP_INTRO.en;
  const expires = OTP_EXPIRES[lang]  || OTP_EXPIRES.en;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9f9fb;margin:0;padding:32px 0;">
  <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,.07);">
    <h1 style="font-size:1.5rem;color:#7c4dff;margin:0 0 8px;">🎨 Lalabuba</h1>
    <p style="color:#555;margin:0 0 24px;font-size:0.95rem;">${intro}</p>
    <div style="text-align:center;background:#f3f0ff;border-radius:12px;padding:24px 0;margin-bottom:24px;">
      <span style="font-size:2.5rem;font-weight:700;letter-spacing:0.35em;color:#1e1b2e;">${code}</span>
    </div>
    <p style="color:#888;font-size:0.85rem;margin:0;">${expires}</p>
  </div>
</body></html>`;

  // Brevo transactional email API (v3)
  const body = JSON.stringify({
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email }],
    subject,
    htmlContent: html,
    textContent: `${intro} ${code}\n\n${expires}`,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.brevo.com",
      path:     "/v3/smtp/email",
      method:   "POST",
      headers: {
        "api-key":        apiKey,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          console.error("[email] Brevo error", res.statusCode, data);
          reject(new Error(`Brevo API error: ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendOtp };
