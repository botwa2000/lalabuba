"use strict";
// Printable packs (growth plan L9): a hand-picked set of library pictures as one A4
// PDF per language, with a download page in every language, linked from the
// Christmas topic pages and the hubs.
//
//   PDFs:  public/printables/<slug>.pdf, built by scripts/make-printable-pack.py
//          (rebuild after changing PICTURES or the pdf* strings below).
//   Pages: /<hub>/<slug>/ (e.g. /en/coloring-pages/christmas-coloring-pack/), served by
//          server.js → renderPackPage(); banner → packBanner().
//
// Every picture here was picked and inspected by hand (2026-11-23, contact sheets of
// all 174 Christmas/winter library pictures). Don't add one without looking at it.

const LANGS = ["en", "de", "fr", "es", "pt", "ru", "it", "nl", "pl", "tr", "zh", "hi"];
const HUB = {
  en: "/en/coloring-pages/", de: "/de/ausmalbilder/", fr: "/pages-a-colorier/", es: "/paginas-para-colorear/",
  pt: "/paginas-para-colorir/", ru: "/raskraski/", it: "/disegni-da-colorare/", nl: "/kleurplaten/",
  pl: "/kolorowanki/", tr: "/boyama-sayfalari/", zh: "/zhuose-ye/", hi: "/rang-bharane-ke-chitra/",
};
// Where "make your own" in the PDF leads (the app in that language), tagged so PDF visits
// show up as their own source in /admin/stats → Visit sources.
const APP_ROOT = { en: "/", de: "/de/", fr: "/fr/", es: "/es/", pt: "/pt/", ru: "/ru/", it: "/it/", nl: "/nl/", pl: "/pl/", tr: "/tr/", zh: "/zh/", hi: "/hi/" };

// [topic, picture slug, stored file in data/images/g, English subject] in pack order (easy → detailed).
const CHRISTMAS_PICTURES = [
  ["santa", "santa-easy", "santa-easy-348542687.png", "Santa Claus waving with a big smile"],
  ["schneemann", "snowman-easy-7", "schneemann-easy-1849227532.png", "happy snowman with scarf and top hat"],
  ["gingerbread", "gingerbread-easy", "gingerbread-easy-1183450098.png", "gingerbread man with icing buttons"],
  ["christmasstar", "smiling-medium", "christmasstar-medium-1100413168.png", "smiling star with a Christmas hat"],
  ["adventskalender", "penguin-medium", "adventskalender-medium-1185857636.png", "cute penguin with a Christmas hat"],
  ["weihnachten", "christmas-easy-4", "weihnachten-easy-1198060880.png", "Christmas bells with a ribbon bow"],
  ["reindeer", "reindeer-easy-3", "reindeer-easy-1318023883.png", "reindeer wearing a scarf and a Christmas hat"],
  ["winteranimals", "polar-easy", "winteranimals-easy-714840745.png", "polar bear cub on the ice"],
  ["christmasangel", "angel-easy-2", "christmasangel-easy-902383757.png", "angel holding a candle"],
  ["weihnachten", "teddy-medium", "weihnachten-medium-1028149932.png", "teddy bear unwrapping a Christmas present"],
  ["gingerbread", "gingerbread-easy-2", "gingerbread-easy-1314972355.png", "gingerbread house with a candy roof"],
  ["weihnachten", "christmas-easy", "weihnachten-easy-1267667399.png", "decorated Christmas tree with presents underneath"],
  ["adventskalender", "advent-easy", "adventskalender-easy-1668680778.png", "advent wreath with four candles and pine branches"],
  ["reindeer", "reindeer-hard-3", "reindeer-hard-1184476268.png", "reindeer pulling a little sled with presents"],
  ["weihnachten", "santa-hard", "weihnachten-hard-521160870.png", "Santa Claus with a sack of presents"],
  ["adventskalender", "christmas-hard", "adventskalender-hard-267655475.png", "Christmas cookies in star and heart shapes"],
  ["adventskalender", "squirrel-hard", "adventskalender-hard-1488943184.png", "squirrel with a lantern in the snow"],
].map(([topic, slug, file, subject]) => ({ topic, slug, file, subject }));

const N = CHRISTMAS_PICTURES.length;
const fill = (s) => s.replace(/\{n\}/g, N);

// Strings per language. {n} = number of pictures.
const S = {
  en: {
    slug: "christmas-coloring-pack", name: "Christmas Coloring Pack",
    title: "Christmas Coloring Pages PDF — {n} Free Printables | Lalabuba",
    desc: "Free Christmas coloring pages as one PDF: Santa, snowman, reindeer, gingerbread and more. {n} A4 pages for home and class, easy to detailed.",
    h1: "Christmas Coloring Pages PDF — Free Printable Pack",
    intro: "Santa, a snowman, reindeer, gingerbread, angels and winter animals: {n} of our favourite Christmas coloring pages in one PDF, ready to print. Easy pages for little ones, more detailed ones for older kids. Every page has a space for a name, so it works in the classroom too.",
    download: "Download the PDF", meta: "{n} pages · A4 · free", inside: "What's inside",
    tips: ["Made for A4; on US Letter paper, choose “Fit to page”.", "Free for home, kindergarten and classroom use. Please share the link rather than selling the pages.", "Want a different picture? Type any idea and Lalabuba draws a new coloring page in seconds."],
    makeOwn: "Make your own coloring page →",
    banner: "All our favourite Christmas pictures in one PDF, ready to print: {n} pages, free.", bannerBtn: "Get the PDF →",
    pdfSub: "{n} free pages to print and color", pdfName: "Name:", pdfFooter: "Make your own coloring page at lalabuba.com", pdfLicense: "Free for home and classroom use. Not for resale.",
  },
  de: {
    slug: "weihnachts-malbuch-pdf", name: "Weihnachts-Malbuch",
    title: "Ausmalbilder Weihnachten PDF – {n} Seiten kostenlos | Lalabuba",
    desc: "Kostenlose Weihnachts-Ausmalbilder als ein PDF: Weihnachtsmann, Schneemann, Rentier, Lebkuchen und mehr. {n} Seiten A4 für Zuhause, Kita und Schule.",
    h1: "Ausmalbilder Weihnachten als PDF – kostenloses Malbuch",
    intro: "Weihnachtsmann, Schneemann, Rentier, Lebkuchen, Engel und Wintertiere: {n} unserer schönsten Weihnachts-Ausmalbilder in einem PDF, fertig zum Ausdrucken. Einfache Bilder für die Kleinen, detailliertere für größere Kinder. Auf jeder Seite ist Platz für den Namen – praktisch für Kita und Grundschule.",
    download: "PDF herunterladen", meta: "{n} Seiten · A4 · kostenlos", inside: "Das ist drin",
    tips: ["Für A4 gemacht; auf US-Letter „An Seite anpassen“ wählen.", "Kostenlos für Zuhause, Kita und Schule. Bitte teilt lieber den Link, statt die Seiten zu verkaufen.", "Lieber ein anderes Motiv? Schreib eine Idee, und Lalabuba malt in Sekunden ein neues Ausmalbild."],
    makeOwn: "Eigenes Ausmalbild erstellen →",
    banner: "Unsere schönsten Weihnachtsbilder in einem PDF zum Ausdrucken: {n} Seiten, kostenlos.", bannerBtn: "Zum PDF →",
    pdfSub: "{n} kostenlose Seiten zum Ausdrucken und Ausmalen", pdfName: "Name:", pdfFooter: "Eigene Ausmalbilder erstellen auf lalabuba.com", pdfLicense: "Kostenlos für Zuhause, Kita und Schule. Nicht zum Weiterverkauf.",
  },
  fr: {
    slug: "cahier-coloriage-noel-pdf", name: "Cahier de coloriage de Noël",
    title: "Coloriage Noël PDF — {n} pages gratuites à imprimer",
    desc: "Coloriages de Noël gratuits en un seul PDF : Père Noël, bonhomme de neige, renne, pain d'épices et plus. {n} pages A4 pour la maison et l'école.",
    h1: "Coloriages de Noël en PDF — cahier gratuit à imprimer",
    intro: "Père Noël, bonhomme de neige, rennes, pain d'épices, anges et animaux de l'hiver : {n} de nos coloriages de Noël préférés dans un seul PDF, prêt à imprimer. Des dessins faciles pour les petits, plus détaillés pour les grands. Chaque page a une ligne pour le prénom, idéal en classe.",
    download: "Télécharger le PDF", meta: "{n} pages · A4 · gratuit", inside: "Au programme",
    tips: ["Format A4 ; sur papier Letter, choisissez « Ajuster à la page ».", "Gratuit pour la maison, la crèche et l'école. Merci de partager le lien plutôt que de vendre les pages.", "Envie d'un autre dessin ? Écris une idée et Lalabuba dessine un nouveau coloriage en quelques secondes."],
    makeOwn: "Créer mon propre coloriage →",
    banner: "Nos plus beaux coloriages de Noël dans un seul PDF à imprimer : {n} pages, gratuit.", bannerBtn: "Voir le PDF →",
    pdfSub: "{n} pages gratuites à imprimer et colorier", pdfName: "Prénom :", pdfFooter: "Crée ton propre coloriage sur lalabuba.com", pdfLicense: "Gratuit pour la maison et l'école. Revente interdite.",
  },
  es: {
    slug: "cuadernillo-navidad-pdf", name: "Cuadernillo de Navidad",
    title: "Dibujos de Navidad para colorear PDF — {n} gratis | Lalabuba",
    desc: "Dibujos de Navidad gratis en un solo PDF: Papá Noel, muñeco de nieve, reno, galleta de jengibre y más. {n} páginas A4 para casa y el cole.",
    h1: "Dibujos de Navidad para colorear en PDF — cuadernillo gratis",
    intro: "Papá Noel, un muñeco de nieve, renos, galletas de jengibre, ángeles y animales del invierno: {n} de nuestros dibujos de Navidad favoritos en un solo PDF, listo para imprimir. Dibujos fáciles para los peques y otros más detallados para los mayores. Cada página tiene un espacio para el nombre, ideal para el aula.",
    download: "Descargar el PDF", meta: "{n} páginas · A4 · gratis", inside: "Qué incluye",
    tips: ["Formato A4; en papel carta elige «Ajustar a la página».", "Gratis para casa, guardería y colegio. Por favor, comparte el enlace en lugar de vender las páginas.", "¿Quieres otro dibujo? Escribe una idea y Lalabuba dibuja una nueva lámina en segundos."],
    makeOwn: "Crear mi propio dibujo →",
    banner: "Nuestros dibujos de Navidad favoritos en un solo PDF para imprimir: {n} páginas, gratis.", bannerBtn: "Ver el PDF →",
    pdfSub: "{n} páginas gratis para imprimir y colorear", pdfName: "Nombre:", pdfFooter: "Crea tu propio dibujo para colorear en lalabuba.com", pdfLicense: "Gratis para casa y el colegio. Prohibida la venta.",
  },
  pt: {
    slug: "caderno-natal-pdf", name: "Caderno de colorir de Natal",
    title: "Desenhos de Natal para colorir PDF — {n} grátis | Lalabuba",
    desc: "Desenhos de Natal grátis em um único PDF: Papai Noel, boneco de neve, rena, biscoito de gengibre e mais. {n} páginas A4 para casa e escola.",
    h1: "Desenhos de Natal para colorir em PDF — caderno grátis",
    intro: "Papai Noel, boneco de neve, renas, biscoitos de gengibre, anjos e bichinhos do inverno: {n} dos nossos desenhos de Natal favoritos em um único PDF, pronto para imprimir. Desenhos fáceis para os pequenos e outros mais detalhados para os maiores. Cada página tem espaço para o nome, ótimo para a sala de aula.",
    download: "Baixar o PDF", meta: "{n} páginas · A4 · grátis", inside: "O que tem dentro",
    tips: ["Formato A4; em papel Carta, escolha “Ajustar à página”.", "Grátis para casa, creche e escola. Por favor, compartilhe o link em vez de vender as páginas.", "Quer outro desenho? Escreva uma ideia e a Lalabuba desenha uma nova página para colorir em segundos."],
    makeOwn: "Criar meu próprio desenho →",
    banner: "Nossos desenhos de Natal favoritos em um único PDF para imprimir: {n} páginas, grátis.", bannerBtn: "Ver o PDF →",
    pdfSub: "{n} páginas grátis para imprimir e colorir", pdfName: "Nome:", pdfFooter: "Crie seu próprio desenho para colorir em lalabuba.com", pdfLicense: "Grátis para casa e escola. Proibida a revenda.",
  },
  ru: {
    slug: "novogodnie-raskraski-pdf", name: "Новогодний альбом раскрасок",
    title: "Новогодние раскраски PDF — {n} страниц бесплатно | Lalabuba",
    desc: "Бесплатные новогодние раскраски одним PDF: Санта, снеговик, олень, пряники и многое другое. {n} страниц A4 для дома, садика и школы.",
    h1: "Новогодние раскраски в PDF — бесплатный альбом",
    intro: "Санта, снеговик, олени, пряники, ангелы и зимние зверята: {n} наших любимых новогодних раскрасок в одном PDF, готовом к печати. Простые картинки для малышей и более подробные для ребят постарше. На каждой странице есть строчка для имени — удобно в детском саду и школе.",
    download: "Скачать PDF", meta: "{n} страниц · A4 · бесплатно", inside: "Что внутри",
    tips: ["Формат A4; при печати на Letter выберите «Вписать в страницу».", "Бесплатно для дома, садика и школы. Пожалуйста, делитесь ссылкой, а не продавайте страницы.", "Хотите другую картинку? Напишите идею, и Lalabuba за секунды нарисует новую раскраску."],
    makeOwn: "Создать свою раскраску →",
    banner: "Наши любимые новогодние раскраски в одном PDF для печати: {n} страниц, бесплатно.", bannerBtn: "К PDF →",
    pdfSub: "{n} бесплатных страниц для печати и раскрашивания", pdfName: "Имя:", pdfFooter: "Создай свою раскраску на lalabuba.com", pdfLicense: "Бесплатно для дома и школы. Не для продажи.",
  },
  it: {
    slug: "album-natale-pdf", name: "Album da colorare di Natale",
    title: "Disegni di Natale da colorare PDF — {n} gratis | Lalabuba",
    desc: "Disegni di Natale gratis in un unico PDF: Babbo Natale, pupazzo di neve, renna, omino di pan di zenzero e altro. {n} pagine A4 per casa e scuola.",
    h1: "Disegni di Natale da colorare in PDF — album gratis",
    intro: "Babbo Natale, un pupazzo di neve, renne, biscotti di pan di zenzero, angeli e animali dell'inverno: {n} dei nostri disegni di Natale preferiti in un unico PDF, pronto da stampare. Disegni facili per i più piccoli e più dettagliati per i grandi. Ogni pagina ha lo spazio per il nome, perfetta anche in classe.",
    download: "Scarica il PDF", meta: "{n} pagine · A4 · gratis", inside: "Cosa contiene",
    tips: ["Formato A4; su carta Letter scegli «Adatta alla pagina».", "Gratis per casa, asilo e scuola. Per favore condividi il link invece di vendere le pagine.", "Vuoi un altro disegno? Scrivi un'idea e Lalabuba disegna una nuova pagina da colorare in pochi secondi."],
    makeOwn: "Crea il tuo disegno →",
    banner: "I nostri disegni di Natale preferiti in un unico PDF da stampare: {n} pagine, gratis.", bannerBtn: "Vai al PDF →",
    pdfSub: "{n} pagine gratis da stampare e colorare", pdfName: "Nome:", pdfFooter: "Crea il tuo disegno da colorare su lalabuba.com", pdfLicense: "Gratis per casa e scuola. Vietata la rivendita.",
  },
  nl: {
    slug: "kerst-kleurboek-pdf", name: "Kerstkleurboek",
    title: "Kerstkleurplaten PDF — {n} gratis om te printen | Lalabuba",
    desc: "Gratis kerstkleurplaten in één PDF: de Kerstman, sneeuwpop, rendier, peperkoek en meer. {n} pagina's A4 voor thuis, opvang en school.",
    h1: "Kerstkleurplaten als PDF — gratis kleurboek",
    intro: "De Kerstman, een sneeuwpop, rendieren, peperkoek, engelen en winterdieren: {n} van onze favoriete kerstkleurplaten in één PDF, klaar om te printen. Makkelijke platen voor de kleintjes, gedetailleerdere voor grotere kinderen. Op elke pagina is ruimte voor een naam, handig in de klas.",
    download: "Download de PDF", meta: "{n} pagina's · A4 · gratis", inside: "Wat zit erin",
    tips: ["Gemaakt voor A4; kies op Letter-papier ‘Aanpassen aan pagina’.", "Gratis voor thuis, opvang en school. Deel liever de link dan de pagina's te verkopen.", "Liever een andere plaat? Typ een idee en Lalabuba tekent in een paar seconden een nieuwe kleurplaat."],
    makeOwn: "Maak je eigen kleurplaat →",
    banner: "Onze favoriete kerstkleurplaten in één PDF om te printen: {n} pagina's, gratis.", bannerBtn: "Naar de PDF →",
    pdfSub: "{n} gratis pagina's om te printen en te kleuren", pdfName: "Naam:", pdfFooter: "Maak je eigen kleurplaat op lalabuba.com", pdfLicense: "Gratis voor thuis en school. Niet voor verkoop.",
  },
  pl: {
    slug: "kolorowanki-swiateczne-pdf", name: "Świąteczne kolorowanki PDF",
    title: "Kolorowanki świąteczne PDF — {n} stron za darmo | Lalabuba",
    desc: "Darmowe kolorowanki świąteczne w jednym PDF: Mikołaj, bałwan, renifer, pierniczki i więcej. {n} stron A4 do domu, przedszkola i szkoły.",
    h1: "Kolorowanki świąteczne PDF — darmowy zestaw do druku",
    intro: "Mikołaj, bałwan, renifery, pierniczki, aniołki i zimowe zwierzątka: {n} naszych ulubionych kolorowanek świątecznych w jednym PDF, gotowym do druku. Łatwe obrazki dla maluchów i bardziej szczegółowe dla starszych dzieci. Na każdej stronie jest miejsce na imię — przyda się w przedszkolu i szkole.",
    download: "Pobierz PDF", meta: "{n} stron · A4 · za darmo", inside: "Co jest w środku",
    tips: ["Format A4; na papierze Letter wybierz „Dopasuj do strony”.", "Za darmo do domu, przedszkola i szkoły. Prosimy udostępniać link zamiast sprzedawać strony.", "Chcesz inny obrazek? Wpisz pomysł, a Lalabuba w kilka sekund narysuje nową kolorowankę."],
    makeOwn: "Stwórz własną kolorowankę →",
    banner: "Nasze ulubione kolorowanki świąteczne w jednym PDF do druku: {n} stron, za darmo.", bannerBtn: "Do PDF →",
    pdfSub: "{n} darmowych stron do druku i kolorowania", pdfName: "Imię:", pdfFooter: "Stwórz własną kolorowankę na lalabuba.com", pdfLicense: "Za darmo do domu i szkoły. Zakaz odsprzedaży.",
  },
  tr: {
    slug: "yilbasi-boyama-kitabi-pdf", name: "Yılbaşı Boyama Kitabı",
    title: "Yılbaşı Boyama Sayfaları PDF — {n} Sayfa Ücretsiz | Lalabuba",
    desc: "Ücretsiz yılbaşı boyama sayfaları tek PDF'te: Noel Baba, kardan adam, ren geyiği, zencefilli kurabiye ve dahası. Ev, anaokulu ve okul için {n} A4 sayfa.",
    h1: "Yılbaşı Boyama Sayfaları PDF — Ücretsiz Boyama Kitabı",
    intro: "Noel Baba, kardan adam, ren geyikleri, zencefilli kurabiyeler, melekler ve kış hayvanları: en sevdiğimiz {n} yılbaşı boyama sayfası, yazdırmaya hazır tek bir PDF'te. Minikler için kolay, büyükler için daha detaylı resimler. Her sayfada isim yazacak yer var; sınıfta da kullanışlı.",
    download: "PDF'i indir", meta: "{n} sayfa · A4 · ücretsiz", inside: "İçinde neler var",
    tips: ["A4 için hazırlandı; Letter kâğıtta “Sayfaya sığdır”ı seçin.", "Ev, anaokulu ve okul için ücretsiz. Lütfen sayfaları satmak yerine bağlantıyı paylaşın.", "Başka bir resim mi istiyorsun? Bir fikir yaz, Lalabuba saniyeler içinde yeni bir boyama sayfası çizsin."],
    makeOwn: "Kendi boyamanı oluştur →",
    banner: "En sevdiğimiz yılbaşı boyama sayfaları, yazdırmaya hazır tek PDF'te: {n} sayfa, ücretsiz.", bannerBtn: "PDF'e git →",
    pdfSub: "Yazdırıp boyamak için {n} ücretsiz sayfa", pdfName: "Adı:", pdfFooter: "Kendi boyama sayfanı lalabuba.com'da oluştur", pdfLicense: "Ev ve okul için ücretsiz. Satılamaz.",
  },
  zh: {
    slug: "shengdan-tuse-pdf", name: "圣诞涂色册",
    title: "圣诞节涂色页 PDF — {n} 页免费打印 | Lalabuba",
    desc: "免费圣诞节涂色页合集，一个 PDF 搞定：圣诞老人、雪人、驯鹿、姜饼人等。{n} 页 A4，适合家庭、幼儿园和学校。",
    h1: "圣诞节涂色页 PDF — 免费打印涂色册",
    intro: "圣诞老人、雪人、驯鹿、姜饼、天使和冬天的小动物：我们最喜欢的 {n} 张圣诞涂色页，合成一个 PDF，直接打印。简单的适合小朋友，细节多的适合大孩子。每页都有写名字的地方，课堂上也好用。",
    download: "下载 PDF", meta: "{n} 页 · A4 · 免费", inside: "包含内容",
    tips: ["按 A4 纸设计；用 Letter 纸打印时请选择“适合页面”。", "家庭、幼儿园和学校均可免费使用。请分享链接，不要出售这些页面。", "想要别的图案？输入一个想法，Lalabuba 几秒钟就能画出新的涂色页。"],
    makeOwn: "生成我自己的涂色页 →",
    banner: "我们最喜欢的圣诞涂色页合成一个 PDF，直接打印：{n} 页，免费。", bannerBtn: "查看 PDF →",
    pdfSub: "{n} 页免费涂色页，打印即可涂色", pdfName: "姓名：", pdfFooter: "在 lalabuba.com 生成你自己的涂色页", pdfLicense: "家庭和学校免费使用，禁止转售。",
  },
  hi: {
    slug: "christmas-coloring-pdf", name: "क्रिसमस रंग भरने की किताब",
    title: "क्रिसमस रंग भरने के चित्र PDF — {n} पेज मुफ़्त | Lalabuba",
    desc: "मुफ़्त क्रिसमस रंग भरने के चित्र एक PDF में: सांता, स्नोमैन, रेनडियर, जिंजरब्रेड और भी बहुत कुछ। घर, प्ले स्कूल और स्कूल के लिए {n} A4 पेज।",
    h1: "क्रिसमस रंग भरने के चित्र PDF — मुफ़्त प्रिंट करने योग्य किताब",
    intro: "सांता, स्नोमैन, रेनडियर, जिंजरब्रेड, फ़रिश्ते और सर्दियों के जानवर: हमारे {n} पसंदीदा क्रिसमस रंग भरने के चित्र एक PDF में, प्रिंट के लिए तैयार। छोटे बच्चों के लिए आसान चित्र, बड़े बच्चों के लिए ज़्यादा बारीक चित्र। हर पेज पर नाम लिखने की जगह है, इसलिए कक्षा में भी काम आता है।",
    download: "PDF डाउनलोड करें", meta: "{n} पेज · A4 · मुफ़्त", inside: "इसमें क्या है",
    tips: ["A4 के लिए बना है; Letter पेपर पर “Fit to page” चुनें।", "घर, प्ले स्कूल और स्कूल के लिए मुफ़्त। कृपया पेज बेचने के बजाय लिंक शेयर करें।", "कोई और चित्र चाहिए? कोई भी आइडिया लिखें और Lalabuba कुछ ही सेकंड में नया रंग भरने का चित्र बना देगा।"],
    makeOwn: "अपना चित्र बनाएं →",
    banner: "हमारे पसंदीदा क्रिसमस चित्र एक PDF में, प्रिंट के लिए तैयार: {n} पेज, मुफ़्त।", bannerBtn: "PDF देखें →",
    pdfSub: "प्रिंट करके रंग भरने के लिए {n} मुफ़्त पेज", pdfName: "नाम:", pdfFooter: "lalabuba.com पर अपना रंग भरने का चित्र बनाएं", pdfLicense: "घर और स्कूल के लिए मुफ़्त। बेचने के लिए नहीं।",
  },
};

/** Strings for one language with {n} filled in. */
function strings(lang) {
  const s = S[lang];
  if (!s) return null;
  const out = {};
  for (const [k, v] of Object.entries(s)) out[k] = Array.isArray(v) ? v.map(fill) : fill(v);
  return out;
}

const pagePath = (lang) => (S[lang] ? `${HUB[lang]}${S[lang].slug}/` : null);
const pdfPath = (lang) => (S[lang] ? `/printables/${S[lang].slug}.pdf` : null);
/** "Make your own" link printed in the PDF: the app in that language, tagged as the PDF source. */
const pdfAppUrl = (lang) => `https://lalabuba.com${APP_ROOT[lang]}?utm_source=christmas-pack&utm_medium=pdf&utm_campaign=l9`;
/** Language of a pack page path, or null. */
function langForPath(p) {
  const want = p.endsWith("/") ? p : p + "/";
  return LANGS.find((l) => pagePath(l) === want) || null;
}

/** Banner linking to the pack page, for Christmas topic pages and the hubs. */
function packBanner(lang) {
  const s = strings(lang);
  if (!s) return "";
  return `<section class="lp-section lp-pack" aria-label="${s.name}">
    <a class="lp-pack-card" href="${pagePath(lang)}">
      <img class="lp-pack-thumb" src="/printables/${S[lang].slug}.png" alt="" width="120" height="170" loading="lazy" decoding="async"/>
      <span class="lp-pack-text">
        <span class="lp-pack-kicker">PDF · ${s.meta}</span>
        <strong class="lp-pack-title">${s.name}</strong>
        <span class="lp-pack-desc">${s.banner}</span>
        <span class="lp-pack-btn">${s.bannerBtn}</span>
      </span>
    </a>
  </section>`;
}

/** Topic page: banner right before the shared topic nav (else before the footer). */
function withPackBanner(html, lang) {
  const b = packBanner(lang);
  if (!b || typeof html !== "string" || html.includes('class="lp-section lp-pack"')) return html;
  const navIdx = html.indexOf('<section class="lp-section lp-topic-nav">');
  if (navIdx !== -1) return html.slice(0, navIdx) + b + "\n  " + html.slice(navIdx);
  const footIdx = html.indexOf("<footer");
  if (footIdx === -1) return html;
  const divIdx = html.lastIndexOf("</div>", footIdx);
  return divIdx === -1 ? html : html.slice(0, divIdx) + b + "\n" + html.slice(divIdx);
}

module.exports = {
  LANGS, CHRISTMAS_PICTURES, strings, pagePath, pdfPath, pdfAppUrl, langForPath, packBanner, withPackBanner,
};
