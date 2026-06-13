#!/usr/bin/env node
/**
 * Generates all Google Play Store listing assets for Lalabuba:
 *  - 512×512 app icon
 *  - 1024×500 feature graphic
 *  - Phone screenshots (reused from iOS, resized to 1080×1920)
 *  - Play Store description files (12 languages, adapted from iOS)
 *
 * Output: android/play-store-listing/
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS_IN = path.join(ROOT, 'app-store-assets');
const OUT = path.join(__dirname, 'play-store-listing');

// Ensure output dirs exist
const LANGS = ['en', 'de', 'es', 'fr', 'hi', 'it', 'nl', 'pl', 'pt', 'ru', 'tr', 'zh'];
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });
for (const lang of LANGS) {
  fs.mkdirSync(path.join(OUT, 'screenshots', lang), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'descriptions'), { recursive: true });
}

// ─── 1. App Icon 512×512 ───────────────────────────────────────────────────
async function generateIcon() {
  console.log('Generating 512×512 app icon...');
  await sharp(path.join(ASSETS_IN, 'app-icon-1024.png'))
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT, 'app-icon-512.png'));
  console.log('  ✓ app-icon-512.png');
}

// ─── 2. Feature Graphic 1024×500 ──────────────────────────────────────────
async function generateFeatureGraphic() {
  console.log('Generating feature graphic 1024×500...');

  const svg = `<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0a3c"/>
      <stop offset="50%" style="stop-color:#2d1155"/>
      <stop offset="100%" style="stop-color:#3d0d6b"/>
    </linearGradient>
    <linearGradient id="pill1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c4dff"/>
      <stop offset="100%" style="stop-color:#9c6dff"/>
    </linearGradient>
    <linearGradient id="pill2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff4d8d"/>
      <stop offset="100%" style="stop-color:#ff6da0"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softglow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="500" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="820" cy="80" r="180" fill="#7c4dff" opacity="0.12"/>
  <circle cx="900" cy="420" r="140" fill="#ff4d8d" opacity="0.10"/>
  <circle cx="80" cy="400" r="120" fill="#7c4dff" opacity="0.08"/>

  <!-- Color swatch decorations — right side -->
  <!-- Swatch stack 1 -->
  <rect x="680" y="100" width="70" height="90" rx="12" fill="#ff6b9d" opacity="0.9" transform="rotate(-8, 715, 145)"/>
  <rect x="678" y="98" width="70" height="90" rx="12" fill="none" stroke="white" stroke-width="2" opacity="0.3" transform="rotate(-8, 715, 145)"/>

  <!-- Swatch stack 2 -->
  <rect x="760" y="120" width="70" height="90" rx="12" fill="#7c4dff" opacity="0.9" transform="rotate(5, 795, 165)"/>
  <rect x="758" y="118" width="70" height="90" rx="12" fill="none" stroke="white" stroke-width="2" opacity="0.3" transform="rotate(5, 795, 165)"/>

  <!-- Swatch stack 3 -->
  <rect x="840" y="95" width="70" height="90" rx="12" fill="#4cceac" opacity="0.9" transform="rotate(-3, 875, 140)"/>
  <rect x="838" y="93" width="70" height="90" rx="12" fill="none" stroke="white" stroke-width="2" opacity="0.3" transform="rotate(-3, 875, 140)"/>

  <!-- Mini coloring grid (right side, lower) -->
  <g transform="translate(660, 260)">
    <rect width="44" height="44" rx="6" fill="#ffb347" opacity="0.85"/>
    <rect x="48" width="44" height="44" rx="6" fill="#7c4dff" opacity="0.85"/>
    <rect x="96" width="44" height="44" rx="6" fill="#ff6b9d" opacity="0.85"/>
    <rect x="144" width="44" height="44" rx="6" fill="#4cceac" opacity="0.85"/>
    <rect y="48" width="44" height="44" rx="6" fill="#4cceac" opacity="0.85"/>
    <rect x="48" y="48" width="44" height="44" rx="6" fill="#ffb347" opacity="0.85"/>
    <rect x="96" y="48" width="44" height="44" rx="6" fill="#7c4dff" opacity="0.85"/>
    <rect x="144" y="48" width="44" height="44" rx="6" fill="#ff6b9d" opacity="0.85"/>
    <rect y="96" width="44" height="44" rx="6" fill="#ff6b9d" opacity="0.85"/>
    <rect x="48" y="96" width="44" height="44" rx="6" fill="#4cceac" opacity="0.85"/>
    <rect x="96" y="96" width="44" height="44" rx="6" fill="#ffb347" opacity="0.85"/>
    <rect x="144" y="96" width="44" height="44" rx="6" fill="#7c4dff" opacity="0.85"/>
    <!-- Number overlays -->
    <text x="22" y="28" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold" opacity="0.7">3</text>
    <text x="70" y="28" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold" opacity="0.7">1</text>
    <text x="118" y="28" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold" opacity="0.7">2</text>
    <text x="166" y="28" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold" opacity="0.7">4</text>
  </g>

  <!-- App name — main title -->
  <text x="80" y="200" font-family="Arial Black, Arial" font-size="96" font-weight="900"
        fill="white" filter="url(#softglow)" letter-spacing="-2">Lalabuba</text>

  <!-- Tagline -->
  <text x="82" y="258" font-family="Arial, sans-serif" font-size="28" font-weight="400"
        fill="#c9a8ff" letter-spacing="0.5">Turn any word into a coloring page</text>

  <!-- Feature pills -->
  <rect x="82" y="300" width="175" height="40" rx="20" fill="url(#pill1)" opacity="0.95"/>
  <text x="170" y="325" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="white">🎨 AI-Generated</text>

  <rect x="270" y="300" width="175" height="40" rx="20" fill="url(#pill2)" opacity="0.95"/>
  <text x="358" y="325" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="white">🔢 Color by Number</text>

  <rect x="458" y="300" width="130" height="40" rx="20" fill="#1a8c5e" opacity="0.95"/>
  <text x="523" y="325" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="white">✅ 100% Free</text>

  <!-- Bottom tagline -->
  <text x="82" y="400" font-family="Arial, sans-serif" font-size="22" fill="#a080d0">
    Perfect for kids &amp; families · 12 languages · No account needed
  </text>

  <!-- Small star decorations -->
  <text x="600" y="460" font-family="Arial" font-size="28" fill="#ffb347" opacity="0.7">★★★★★</text>

</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUT, 'feature-graphic-1024x500.png'));
  console.log('  ✓ feature-graphic-1024x500.png');
}

// ─── 3. Screenshots 1080×1920 (from iOS 1284×2778) ──────────────────────────
async function generateScreenshots() {
  console.log('Generating screenshots for Android (1080×1920)...');

  const screenshotNames = [
    '1-create',
    '2-color-by-number',
    '3-gallery',
    '4-daily-challenge',
    '5-challenge',
  ];

  for (const lang of LANGS) {
    const iosDir = path.join(ASSETS_IN, lang, 'iphone');
    const outDir = path.join(OUT, 'screenshots', lang);

    for (const name of screenshotNames) {
      const src = path.join(iosDir, `${name}.png`);
      const dst = path.join(outDir, `${name}.png`);

      if (!fs.existsSync(src)) {
        console.log(`  SKIP: ${lang}/${name}.png (not found)`);
        continue;
      }

      // Resize to fit within 1080×1920, add padding to fill exactly
      const meta = await sharp(src).metadata();
      const targetW = 1080;
      const targetH = 1920;
      const scale = Math.min(targetW / meta.width, targetH / meta.height);
      const newW = Math.round(meta.width * scale);
      const newH = Math.round(meta.height * scale);
      const padLeft = Math.floor((targetW - newW) / 2);
      const padTop = Math.floor((targetH - newH) / 2);

      await sharp(src)
        .resize(newW, newH)
        .extend({
          top: padTop,
          bottom: targetH - newH - padTop,
          left: padLeft,
          right: targetW - newW - padLeft,
          background: { r: 30, g: 10, b: 60, alpha: 1 }, // dark purple padding
        })
        .png()
        .toFile(dst);
    }
    process.stdout.write(`  ✓ ${lang} screenshots\n`);
  }
}

// ─── 4. Play Store descriptions (adapted from iOS) ─────────────────────────
function generateDescriptions() {
  console.log('Generating Play Store descriptions...');

  // Platform-specific replacements per language
  const replacements = {
    en: [['Works on iPhone and iPad', 'Works on Android phones and tablets']],
    de: [['Funktioniert auf iPhone und iPad', 'Funktioniert auf Android-Smartphones und -Tablets']],
    es: [['Funciona en iPhone y iPad', 'Funciona en teléfonos y tabletas Android']],
    fr: [['Fonctionne sur iPhone et iPad', 'Fonctionne sur téléphones et tablettes Android']],
    hi: [['iPhone और iPad पर काम करता है', 'Android फोन और टैबलेट पर काम करता है']],
    it: [['Funziona su iPhone e iPad', 'Funziona su telefoni e tablet Android']],
    nl: [['Werkt op iPhone en iPad', 'Werkt op Android-telefoons en -tablets']],
    pl: [['Działa na iPhone i iPad', 'Działa na telefonach i tabletach Android']],
    pt: [['Funciona em iPhone e iPad', 'Funciona em telemóveis e tablets Android']],
    ru: [['Работает на iPhone и iPad', 'Работает на смартфонах и планшетах Android']],
    tr: [["iPhone ve iPad'de çalışır", 'Android telefon ve tabletlerde çalışır']],
    zh: [['兼容 iPhone 和 iPad', '兼容 Android 手机和平板电脑']],
  };

  for (const lang of LANGS) {
    const srcFile = path.join(ASSETS_IN, `description-${lang}.txt`);
    if (!fs.existsSync(srcFile)) {
      console.log(`  SKIP: description-${lang}.txt not found`);
      continue;
    }

    let text = fs.readFileSync(srcFile, 'utf8');

    // Apply replacements
    for (const [from, to] of (replacements[lang] || [])) {
      text = text.replace(from, to);
    }

    fs.writeFileSync(path.join(OUT, 'descriptions', `${lang}.txt`), text, 'utf8');
    console.log(`  ✓ descriptions/${lang}.txt`);
  }
}

// ─── 5. Short descriptions (≤80 chars for Play Store) ─────────────────────
function generateShortDescriptions() {
  console.log('Generating short descriptions (≤80 chars)...');

  const shorts = {
    en: 'Type any word — free AI coloring page instantly. Color, print, race a friend!',
    de: 'Tippe ein Wort — sofort eine KI-Malseite. Malen, drucken, Freunde herausfordern!',
    es: '¡Escribe una palabra y obtén una lámina de colorear IA gratis! Sin cuenta.',
    fr: 'Tape un mot → page de coloriage IA gratuite ! Colorie, imprime, défie tes amis !',
    hi: 'कोई शब्द लिखें — AI रंग पेज पाएं। रंग भरें, प्रिंट करें, दोस्त को चुनौती दें!',
    it: 'Scrivi una parola → colorare IA gratis! Colora, stampa, sfida gli amici!',
    nl: 'Typ een woord → gratis AI-kleurplaat! Kleuren, afdrukken, vrienden uitdagen!',
    pl: 'Wpisz słowo → darmowa kolorowanka AI! Koloruj, drukuj, rywalizuj z przyjaciółmi!',
    pt: 'Escreve uma palavra → página para colorir IA grátis! Colore, imprime, desafia!',
    ru: 'Введи слово — раскраска от ИИ! Раскрашивай, печатай, соревнуйся с друзьями!',
    tr: 'Bir kelime yaz → ücretsiz AI boyama! Boya, yazdır, arkadaşları meydan oku!',
    zh: '输入任意词 → 立即获得免费 AI 涂色页！涂色、打印、与朋友竞赛！',
  };

  for (const [lang, text] of Object.entries(shorts)) {
    if (text.length > 80) {
      console.warn(`  WARNING: ${lang} short description is ${text.length} chars (>80)`);
    }
    fs.writeFileSync(path.join(OUT, 'descriptions', `${lang}-short.txt`), text, 'utf8');
    console.log(`  ✓ ${lang}-short.txt (${text.length} chars)`);
  }
}

// ─── 6. Summary README ──────────────────────────────────────────────────────
function generateReadme() {
  const readme = `# Lalabuba — Google Play Store Listing Assets

Generated: ${new Date().toISOString().split('T')[0]}

## Files

### Icons & Graphics
- \`app-icon-512.png\` — App icon, 512×512 px (required)
- \`feature-graphic-1024x500.png\` — Feature graphic, 1024×500 px (required)

### Screenshots
\`screenshots/{lang}/1-create.png\` through \`5-challenge.png\`
Size: 1080×1920 px · 12 languages: ${LANGS.join(', ')}

### Descriptions
\`descriptions/{lang}.txt\` — Full description (≤4000 chars)
\`descriptions/{lang}-short.txt\` — Short description (≤80 chars)

## Play Console Upload Checklist

- [ ] App icon: upload \`app-icon-512.png\`
- [ ] Feature graphic: upload \`feature-graphic-1024x500.png\`
- [ ] Screenshots: upload at least 2 from \`screenshots/en/\`
- [ ] Title (max 30 chars): \`Lalabuba\`
- [ ] Short description: copy from \`descriptions/en-short.txt\`
- [ ] Full description: copy from \`descriptions/en.txt\`
- [ ] Privacy policy URL: \`https://lalabuba.com/privacy\`
- [ ] Contact email: \`info@lalabuba.com\`
- [ ] Category: Education
- [ ] Content rating: complete the questionnaire (Everyone/PEGI 3)
- [ ] Repeat for each language in Play Console translations tab
`;
  fs.writeFileSync(path.join(OUT, 'README.md'), readme, 'utf8');
  console.log('  ✓ README.md');
}

// ─── Run all ────────────────────────────────────────────────────────────────
(async () => {
  try {
    await generateIcon();
    await generateFeatureGraphic();
    await generateScreenshots();
    generateDescriptions();
    generateShortDescriptions();
    generateReadme();
    console.log(`\nDone! Assets saved to: android/play-store-listing/`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
