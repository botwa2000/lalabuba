'use strict';

const { buildNav } = require('./lp-nav-component');

const COMM_LANGS = ['en','de','fr','es','pt','ru','it','nl','pl','tr','zh','hi'];

const HREFLANG_MAP = Object.fromEntries(
  COMM_LANGS.map(l => [l, `https://lalabuba.com/${l}/community`])
);

const T = {
  en: {
    htmlLang:'en', title:'Community Gallery — Lalabuba Free AI Coloring Pages for Kids',
    desc:'Browse artwork created and shared by the Lalabuba community. Color templates made by other kids!',
    h1:'Community Gallery', heroPara:'See what kids are creating — and color any template yourself!',
    filterAll:'All', filterColored:'🎨 Colored', filterTemplates:'📋 Templates', filterFreehand:'✏️ Freehand',
    search:'Search artworks…', colorIt:'🎨 Color it!', noArtworks:'No artworks yet — be the first to share! 🌟',
    loadMore:'Load more', shareHint:'Share your own artwork from the app',
    breadcrumb:'Community',
  },
  de: {
    htmlLang:'de', title:'Community-Galerie — Lalabuba Kostenlose KI-Malvorlagen für Kinder',
    desc:'Entdecke Kunstwerke, die von der Lalabuba-Community geteilt wurden. Male Vorlagen anderer Kinder aus!',
    h1:'Community-Galerie', heroPara:'Sieh, was Kinder mit Lalabuba erschaffen — und male jede Vorlage selbst aus!',
    filterAll:'Alle', filterColored:'🎨 Ausmalungen', filterTemplates:'📋 Vorlagen', filterFreehand:'✏️ Zeichnungen',
    search:'Kunstwerke suchen…', colorIt:'🎨 Ausmalen!', noArtworks:'Noch keine Werke — sei der Erste! 🌟',
    loadMore:'Mehr laden', shareHint:'Eigene Kunstwerke in der App teilen',
    breadcrumb:'Community',
  },
  fr: {
    htmlLang:'fr', title:'Galerie communautaire — Lalabuba Pages de coloriage IA gratuites pour enfants',
    desc:'Parcours les œuvres créées et partagées par la communauté Lalabuba. Colorie des modèles faits par d\'autres enfants !',
    h1:'Galerie communautaire', heroPara:'Découvre ce que les enfants créent — et colorie n\'importe quel modèle toi-même !',
    filterAll:'Tout', filterColored:'🎨 Colorié', filterTemplates:'📋 Modèles', filterFreehand:'✏️ Dessins',
    search:'Rechercher des œuvres…', colorIt:'🎨 Colorier !', noArtworks:'Pas encore d\'œuvres — sois le premier à partager ! 🌟',
    loadMore:'Charger plus', shareHint:'Partage ta propre œuvre depuis l\'application',
    breadcrumb:'Communauté',
  },
  es: {
    htmlLang:'es', title:'Galería comunitaria — Lalabuba Páginas para colorear IA gratuitas para niños',
    desc:'Explora las obras creadas y compartidas por la comunidad Lalabuba. ¡Colorea plantillas hechas por otros niños!',
    h1:'Galería comunitaria', heroPara:'¡Mira lo que crean los niños — y colorea cualquier plantilla tú mismo!',
    filterAll:'Todo', filterColored:'🎨 Coloreado', filterTemplates:'📋 Plantillas', filterFreehand:'✏️ Dibujos',
    search:'Buscar obras…', colorIt:'🎨 ¡Colorear!', noArtworks:'Aún no hay obras — ¡sé el primero en compartir! 🌟',
    loadMore:'Cargar más', shareHint:'Comparte tu propia obra desde la app',
    breadcrumb:'Comunidad',
  },
  pt: {
    htmlLang:'pt', title:'Galeria da comunidade — Lalabuba Páginas para colorir IA gratuitas para crianças',
    desc:'Explora as obras criadas e partilhadas pela comunidade Lalabuba. Colore modelos feitos por outras crianças!',
    h1:'Galeria da comunidade', heroPara:'Vê o que as crianças estão a criar — e colore qualquer modelo tu mesmo!',
    filterAll:'Tudo', filterColored:'🎨 Colorido', filterTemplates:'📋 Modelos', filterFreehand:'✏️ Desenhos',
    search:'Pesquisar obras…', colorIt:'🎨 Colorir!', noArtworks:'Ainda sem obras — sê o primeiro a partilhar! 🌟',
    loadMore:'Carregar mais', shareHint:'Partilha a tua obra na app',
    breadcrumb:'Comunidade',
  },
  ru: {
    htmlLang:'ru', title:'Галерея сообщества — Lalabuba Бесплатные раскраски с ИИ для детей',
    desc:'Смотри работы, созданные сообществом Lalabuba. Раскрась шаблоны, сделанные другими детьми!',
    h1:'Галерея сообщества', heroPara:'Смотри, что создают дети — и раскрась любой шаблон сам!',
    filterAll:'Все', filterColored:'🎨 Раскрашенные', filterTemplates:'📋 Шаблоны', filterFreehand:'✏️ Рисунки',
    search:'Поиск работ…', colorIt:'🎨 Раскрасить!', noArtworks:'Пока нет работ — будь первым! 🌟',
    loadMore:'Загрузить ещё', shareHint:'Поделись своей работой из приложения',
    breadcrumb:'Сообщество',
  },
  it: {
    htmlLang:'it', title:'Galleria della community — Lalabuba Pagine da colorare IA gratuite per bambini',
    desc:'Sfoglia le opere create e condivise dalla community Lalabuba. Colora i modelli creati da altri bambini!',
    h1:'Galleria della community', heroPara:'Guarda cosa creano i bambini — e colora qualsiasi modello tu stesso!',
    filterAll:'Tutti', filterColored:'🎨 Colorati', filterTemplates:'📋 Modelli', filterFreehand:'✏️ Disegni',
    search:'Cerca opere…', colorIt:'🎨 Colora!', noArtworks:'Ancora nessuna opera — sii il primo a condividere! 🌟',
    loadMore:'Carica altro', shareHint:'Condividi la tua opera dall\'app',
    breadcrumb:'Community',
  },
  nl: {
    htmlLang:'nl', title:'Community-galerij — Lalabuba Gratis AI-kleurplaten voor kinderen',
    desc:'Blader door kunstwerken gemaakt en gedeeld door de Lalabuba-community. Kleur sjablonen van andere kinderen in!',
    h1:'Community-galerij', heroPara:'Zie wat kinderen maken — en kleur elk sjabloon zelf in!',
    filterAll:'Alles', filterColored:'🎨 Ingekleurd', filterTemplates:'📋 Sjablonen', filterFreehand:'✏️ Tekeningen',
    search:'Kunstwerken zoeken…', colorIt:'🎨 Inkleuren!', noArtworks:'Nog geen werken — wees de eerste! 🌟',
    loadMore:'Meer laden', shareHint:'Deel je eigen werk vanuit de app',
    breadcrumb:'Community',
  },
  pl: {
    htmlLang:'pl', title:'Galeria społeczności — Lalabuba Darmowe kolorowanki AI dla dzieci',
    desc:'Przeglądaj prace stworzone i udostępnione przez społeczność Lalabuba. Pokoloruj szablony innych dzieci!',
    h1:'Galeria społeczności', heroPara:'Zobacz, co tworzą dzieci — i pokoloruj każdy szablon sam!',
    filterAll:'Wszystkie', filterColored:'🎨 Pokolorowane', filterTemplates:'📋 Szablony', filterFreehand:'✏️ Rysunki',
    search:'Szukaj prac…', colorIt:'🎨 Pokoloruj!', noArtworks:'Brak prac — bądź pierwszy! 🌟',
    loadMore:'Załaduj więcej', shareHint:'Podziel się własną pracą w aplikacji',
    breadcrumb:'Społeczność',
  },
  tr: {
    htmlLang:'tr', title:'Topluluk Galerisi — Lalabuba Çocuklar için Ücretsiz Yapay Zeka Boyama Sayfaları',
    desc:'Lalabuba topluluğu tarafından oluşturulan ve paylaşılan eserlere göz at. Diğer çocukların şablonlarını boya!',
    h1:'Topluluk Galerisi', heroPara:'Çocukların neler yarattığını gör — ve istediğin şablonu kendin boya!',
    filterAll:'Tümü', filterColored:'🎨 Boyalı', filterTemplates:'📋 Şablonlar', filterFreehand:'✏️ Çizimler',
    search:'Eser ara…', colorIt:'🎨 Boya!', noArtworks:'Henüz eser yok — ilk paylaşan sen ol! 🌟',
    loadMore:'Daha fazla yükle', shareHint:'Kendi eserini uygulamadan paylaş',
    breadcrumb:'Topluluk',
  },
  zh: {
    htmlLang:'zh-Hans', title:'社区画廊 — Lalabuba 儿童免费AI涂色页',
    desc:'浏览Lalabuba社区创建和分享的作品。为其他孩子制作的模板涂色！',
    h1:'社区画廊', heroPara:'看看孩子们在创作什么——给任意模板涂色！',
    filterAll:'全部', filterColored:'🎨 已涂色', filterTemplates:'📋 模板', filterFreehand:'✏️ 绘画',
    search:'搜索作品…', colorIt:'🎨 涂色！', noArtworks:'暂无作品——成为第一个分享的人！🌟',
    loadMore:'加载更多', shareHint:'在应用中分享你的作品',
    breadcrumb:'社区',
  },
  hi: {
    htmlLang:'hi', title:'सामुदायिक गैलरी — Lalabuba बच्चों के लिए मुफ़्त AI रंग पेज',
    desc:'Lalabuba समुदाय द्वारा बनाई और साझा की गई कृतियाँ देखें। दूसरे बच्चों के टेम्पलेट रंग भरें!',
    h1:'सामुदायिक गैलरी', heroPara:'देखें बच्चे क्या बना रहे हैं — और किसी भी टेम्पलेट को खुद रंग भरें!',
    filterAll:'सभी', filterColored:'🎨 रंगा हुआ', filterTemplates:'📋 टेम्पलेट', filterFreehand:'✏️ चित्र',
    search:'कृतियाँ खोजें…', colorIt:'🎨 रंग भरें!', noArtworks:'अभी कोई कृति नहीं — पहले साझा करें! 🌟',
    loadMore:'और लोड करें', shareHint:'ऐप से अपनी कृति साझा करें',
    breadcrumb:'समुदाय',
  },
};

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const AVATARS = ['🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺','🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘'];

function renderCommunityPage(lang) {
  const t = T[lang] || T.en;
  const activeLang = T[lang] ? lang : 'en';
  const canon = `https://lalabuba.com/${activeLang}/community`;

  const navHtml = buildNav({ lang: activeLang, breadcrumbs: [{ label: t.breadcrumb }], hreflangMap: HREFLANG_MAP });

  const hreflangTags = COMM_LANGS.map(l =>
    `  <link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="https://lalabuba.com/${l}/community"/>`
  ).concat(['  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/community"/>'])
  .join('\n');

  const avatarJson = JSON.stringify(AVATARS);

  return `<!doctype html>
<html lang="${esc(t.htmlLang)}">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var th=localStorage.getItem('lalabuba-theme');if(th){document.documentElement.setAttribute('data-theme',th);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();<\/script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(t.title)}</title>
  <meta name="description" content="${esc(t.desc)}"/>
  <link rel="canonical" href="${canon}"/>
${hreflangTags}
  <meta property="og:title" content="${esc(t.h1)}"/>
  <meta property="og:description" content="${esc(t.desc)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canon}"/>
  <meta property="og:image" content="https://lalabuba.com/og-image.png"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(t.h1)}"/>
  <meta name="twitter:description" content="${esc(t.desc)}"/>
  <meta name="twitter:image" content="https://lalabuba.com/og-image.png"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css"/>
  <link rel="stylesheet" href="/css/community-page.css"/>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Lalabuba","item":"https://lalabuba.com/"},{"@type":"ListItem","position":2,"name":${JSON.stringify(t.breadcrumb)},"item":"${canon}"}]}
  <\/script>
  <script type="module" src="/js/lp-nav.js"><\/script>
</head>
<body>

${navHtml}

<div class="lp-hero comm-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">🌟</span>
    <h1>${esc(t.h1)}</h1>
    <p class="lp-hero-desc">${esc(t.heroPara)}</p>
  </div>
</div>

<div class="comm-page">

  <div class="comm-controls">
    <div class="comm-filters" role="group">
      <button class="comm-filter active" data-type="all">${esc(t.filterAll)}</button>
      <button class="comm-filter" data-type="colored">${esc(t.filterColored)}</button>
      <button class="comm-filter" data-type="template">${esc(t.filterTemplates)}</button>
      <button class="comm-filter" data-type="freehand">${esc(t.filterFreehand)}</button>
    </div>
    <input type="search" id="comm-search" class="comm-search" placeholder="${esc(t.search)}"
      autocomplete="off" spellcheck="false" aria-label="${esc(t.search)}"/>
  </div>

  <div id="comm-grid" class="comm-grid" role="list"></div>

  <div id="comm-empty" class="comm-empty hidden">${esc(t.noArtworks)}</div>

  <div id="comm-loadmore-wrap" class="comm-loadmore-wrap hidden">
    <button id="comm-loadmore" class="comm-loadmore-btn">${esc(t.loadMore)}</button>
  </div>

</div>

<!-- Lightbox -->
<div id="comm-lightbox" class="comm-lightbox hidden" aria-modal="true" role="dialog" aria-label="${esc(t.h1)}">
  <div class="comm-lightbox-card">
    <button id="comm-lightbox-close" class="comm-lightbox-close" aria-label="Close">✕</button>
    <img id="comm-lightbox-img" src="" alt="" class="comm-lightbox-img"/>
    <div class="comm-lightbox-meta">
      <span id="comm-lightbox-nick" class="comm-lightbox-nick"></span>
      <span id="comm-lightbox-stars" class="comm-lightbox-stars"></span>
    </div>
    <button id="comm-lightbox-color" class="lp-cta comm-lightbox-color hidden">${esc(t.colorIt)}</button>
  </div>
</div>

<footer class="legal-footer">
  <div class="legal-footer-inner">
    <a href="/">🎨 Lalabuba</a> ·
    <a href="/${activeLang}/features">Features</a> ·
    <a href="/about">About</a> ·
    <a href="/${activeLang}/faq">FAQ</a> ·
    <a href="/privacy">Privacy</a> ·
    <a href="/terms">Terms</a> ·
    <a href="/contact">Contact</a>
  </div>
</footer>

<script>
(function () {
  var AVATARS = ${avatarJson};
  var colorItLabel = ${JSON.stringify(t.colorIt)};
  var currentFilter = 'all';
  var nextPage = 0;
  var loading = false;
  var allLoaded = false;
  var searchQuery = '';

  var grid    = document.getElementById('comm-grid');
  var empty   = document.getElementById('comm-empty');
  var lmWrap  = document.getElementById('comm-loadmore-wrap');
  var lmBtn   = document.getElementById('comm-loadmore');
  var lightbox = document.getElementById('comm-lightbox');
  var lbImg   = document.getElementById('comm-lightbox-img');
  var lbNick  = document.getElementById('comm-lightbox-nick');
  var lbStars = document.getElementById('comm-lightbox-stars');
  var lbColor = document.getElementById('comm-lightbox-color');
  var lbClose = document.getElementById('comm-lightbox-close');
  var searchEl = document.getElementById('comm-search');

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function loadPage() {
    if (loading || allLoaded) return;
    loading = true;
    if (nextPage === 0) {
      grid.innerHTML = '<div class="comm-skeleton"></div><div class="comm-skeleton"></div><div class="comm-skeleton"></div><div class="comm-skeleton"></div>';
      empty.classList.add('hidden');
      lmWrap.classList.add('hidden');
    }
    var qs = 'page=' + nextPage + '&type=' + currentFilter + (searchQuery ? '&q=' + encodeURIComponent(searchQuery) : '');
    fetch('/api/community/gallery?' + qs)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (nextPage === 0) grid.innerHTML = '';
        var aws = data.artworks || [];
        if (aws.length === 0 && nextPage === 0) {
          empty.classList.remove('hidden');
        } else {
          renderCards(aws);
          allLoaded = data.nextPage === null;
          nextPage = data.nextPage != null ? data.nextPage : nextPage;
          lmWrap.classList.toggle('hidden', allLoaded);
        }
      })
      .catch(function() {
        if (nextPage === 0) grid.innerHTML = '';
      })
      .finally(function() { loading = false; });
  }

  function renderCards(artworks) {
    artworks.forEach(function(aw) {
      var card = document.createElement('div');
      card.className = 'comm-card';
      card.setAttribute('role', 'listitem');
      var nick = aw.nickname || 'Colorist';
      var avatar = AVATARS[aw.avatarIndex || 1] || '🐧';
      var isTemplate = aw.shareType === 'template';
      card.innerHTML =
        '<div class="comm-card-img-wrap">' +
          '<img src="' + esc(aw.imageUrl) + '" alt="' + esc(aw.subject || 'artwork') + '" loading="lazy"/>' +
          (isTemplate ? '<div class="comm-card-badge">' + esc(colorItLabel) + '</div>' : '') +
        '</div>' +
        '<div class="comm-card-footer">' +
          '<span class="comm-card-nick">' + esc(avatar) + ' ' + esc(nick) + '</span>' +
          '<span class="comm-card-stars">⭐ ' + (aw.starCount || 0) + '</span>' +
        '</div>';
      card.addEventListener('click', function() { openLightbox(aw); });
      grid.appendChild(card);
    });
  }

  function openLightbox(aw) {
    lbImg.src = aw.imageUrl || '';
    lbImg.alt = aw.subject || '';
    var nick = aw.nickname || 'Colorist';
    var avatar = AVATARS[aw.avatarIndex || 1] || '🐧';
    lbNick.textContent = avatar + ' ' + nick;
    lbStars.textContent = '⭐ ' + (aw.starCount || 0);
    var isTemplate = aw.shareType === 'template';
    lbColor.classList.toggle('hidden', !isTemplate);
    if (isTemplate) {
      lbColor.onclick = function() {
        var url = '/?s=1&img=' + encodeURIComponent(aw.imageUrl || '') +
          '&q=' + encodeURIComponent(aw.subject || '') +
          '&d=' + encodeURIComponent(aw.difficulty || 'medium');
        window.location.href = url;
      };
    }
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLightbox(); });

  document.querySelectorAll('.comm-filter').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.type === currentFilter) return;
      document.querySelectorAll('.comm-filter').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.type;
      nextPage = 0; allLoaded = false;
      loadPage();
    });
  });

  var searchTimer;
  searchEl.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      searchQuery = searchEl.value.trim();
      nextPage = 0; allLoaded = false;
      loadPage();
    }, 350);
  });

  lmBtn.addEventListener('click', loadPage);

  loadPage();
})();
<\/script>
</body>
</html>`;
}

module.exports = { renderCommunityPage, COMM_LANGS };
